"""ローカル Web サーバー (FastAPI)。"""

from __future__ import annotations

import csv
import io
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .db import Database
from .scanner import Scanner, index_file
from .search import TAG_KINDS, build_where, order_by
from .thumbs import ThumbCache

STATIC_DIR = Path(__file__).parent / "static"
LIST_COLUMNS = "i.id, i.name, i.folder, i.width, i.height, i.source, i.model, i.seed, i.mtime, i.fingerprint"


class FolderIn(BaseModel):
    path: str


class UserTagIn(BaseModel):
    ids: list[int]
    tag: str
    on: bool = True


class MoveIn(BaseModel):
    ids: list[int]
    dest: str
    mode: str = "move"  # "move" / "copy"


def _norm(path: str) -> str:
    return os.path.normpath(os.path.abspath(os.path.expanduser(path.strip().strip('"'))))


def _is_within(path: str, root: str) -> bool:
    try:
        return os.path.commonpath([os.path.normcase(path), os.path.normcase(root)]) == os.path.normcase(root)
    except ValueError:  # 別ドライブ
        return False


def _unique_dest(dest_dir: str, name: str) -> str:
    target = os.path.join(dest_dir, name)
    stem, ext = os.path.splitext(name)
    n = 1
    while os.path.exists(target):
        target = os.path.join(dest_dir, f"{stem} ({n}){ext}")
        n += 1
    return target


def create_app(data_dir: str | Path, stealth: str = "auto", thumb_size: int = 384) -> FastAPI:
    data_dir = Path(data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)
    db = Database(data_dir / "index.sqlite3")
    thumbs = ThumbCache(data_dir / "thumbs", size=thumb_size)
    scanner = Scanner(db, stealth=stealth)

    app = FastAPI(title="AI Image Album")
    app.state.db = db
    app.state.scanner = scanner

    def image_or_404(image_id: int) -> dict[str, Any]:
        item = db.get_image(image_id)
        if not item:
            raise HTTPException(404, "画像が見つかりません")
        return item

    # --- フォルダ / スキャン ------------------------------------------------

    @app.get("/api/folders")
    def list_folders():
        counts = {r["root"]: r["n"] for r in db.query("SELECT root, COUNT(*) AS n FROM images GROUP BY root")}
        subfolders = db.query("SELECT root, folder, COUNT(*) AS n FROM images GROUP BY root, folder ORDER BY folder")
        result = []
        for root in db.folders():
            result.append({
                "path": root,
                "exists": os.path.isdir(root),
                "count": counts.get(root, 0),
                "subfolders": [
                    {"path": r["folder"], "count": r["n"]} for r in subfolders if r["root"] == root
                ],
            })
        return result

    @app.post("/api/folders")
    def add_folder(body: FolderIn):
        path = _norm(body.path)
        if not os.path.isdir(path):
            raise HTTPException(400, f"フォルダが見つかりません: {path}")
        for root in db.folders():
            if _is_within(path, root):
                raise HTTPException(400, f"すでに登録済みのフォルダに含まれています: {root}")
        db.add_folder(path)
        scanner.start([path])
        return {"path": path}

    @app.delete("/api/folders")
    def remove_folder(path: str):
        db.remove_folder(path)
        return {"ok": True}

    @app.post("/api/scan")
    def start_scan():
        return {"started": scanner.start(), "status": scanner.status.to_dict()}

    @app.get("/api/scan")
    def scan_status():
        return scanner.status.to_dict()

    # --- 検索 ---------------------------------------------------------------

    @app.get("/api/images")
    def list_images(
        q: str = "",
        folder: str | None = None,
        sort: str = "mtime",
        order: str = "desc",
        seed: int = 0,
        offset: int = 0,
        limit: int = Query(200, le=1000),
    ):
        where = build_where(q, folder)
        total = db.query(f"SELECT COUNT(*) AS n FROM images i WHERE {where.sql}", where.params)[0]["n"]
        rows = db.query(
            f"SELECT {LIST_COLUMNS} FROM images i WHERE {where.sql} "
            f"ORDER BY {order_by(sort, order, seed)} LIMIT ? OFFSET ?",
            [*where.params, limit, offset],
        )
        return {"total": total, "items": [dict(r) for r in rows]}

    @app.get("/api/facets")
    def facets(q: str = "", folder: str | None = None, kind: str = "prompt", limit: int = Query(150, le=2000)):
        kind = TAG_KINDS.get(kind, kind)
        where = build_where(q, folder)
        if kind == "user":
            rows = db.query(
                f"SELECT u.tag, COUNT(*) AS n FROM user_tags u JOIN images i ON i.fingerprint = u.fingerprint "
                f"WHERE {where.sql} GROUP BY u.tag ORDER BY n DESC LIMIT ?",
                [*where.params, limit],
            )
        else:
            rows = db.query(
                f"SELECT t.tag, COUNT(*) AS n FROM tags t JOIN images i ON i.id = t.image_id "
                f"WHERE t.kind = ? AND {where.sql} GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT ?",
                [kind, *where.params, limit],
            )
        return [{"tag": r["tag"], "count": r["n"]} for r in rows]

    @app.get("/api/suggest")
    def suggest(prefix: str, limit: int = 20):
        prefix = prefix.strip().lstrip("-").strip()
        if not prefix:
            return []
        head, sep, rest = prefix.partition(":")
        kinds = ["prompt", "char", "lora", "model", "source"]
        label = ""
        if sep and head.lower() in TAG_KINDS:
            kinds = [TAG_KINDS[head.lower()]]
            label = head.lower() + ":"
            prefix = rest.strip()
        if sep and head.lower() in ("my", "user", "fav"):
            rows = db.query(
                "SELECT tag, COUNT(*) AS n FROM user_tags WHERE tag LIKE ? GROUP BY tag ORDER BY n DESC LIMIT ?",
                [rest.strip() + "%", limit],
            )
            return [{"value": "my:" + r["tag"], "count": r["n"]} for r in rows]
        # LIKE の "_" は任意の1文字なので "long_hair" でも "long hair" に当たる
        value = prefix.lower().strip()
        marks = ",".join("?" * len(kinds))
        rows = db.query(
            f"SELECT kind, tag, COUNT(*) AS n, (tag LIKE ?) AS starts FROM tags "
            f"WHERE kind IN ({marks}) AND tag LIKE ? GROUP BY kind, tag "
            f"ORDER BY starts DESC, n DESC LIMIT ?",
            [value + "%", *kinds, "%" + value + "%", limit],
        )
        result = []
        for r in rows:
            prefix_label = label or ("" if r["kind"] == "prompt" else r["kind"] + ":")
            result.append({"value": prefix_label + r["tag"], "count": r["n"]})
        return result

    @app.get("/api/export.csv")
    def export_csv(q: str = "", folder: str | None = None, sort: str = "mtime", order: str = "desc"):
        where = build_where(q, folder)
        rows = db.query(
            f"SELECT i.path, i.source, i.model, i.seed, i.steps, i.width, i.height, i.prompt, i.negative "
            f"FROM images i WHERE {where.sql} ORDER BY {order_by(sort, order)}",
            where.params,
        )
        buf = io.StringIO()
        buf.write("﻿")  # Excel で文字化けしないように BOM を付ける
        writer = csv.writer(buf)
        writer.writerow(["path", "source", "model", "seed", "steps", "width", "height", "prompt", "negative"])
        for r in rows:
            writer.writerow(list(r))
        return StreamingResponse(
            iter([buf.getvalue()]),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": 'attachment; filename="album_export.csv"'},
        )

    # --- 画像 ---------------------------------------------------------------

    @app.get("/api/images/{image_id}")
    def image_detail(image_id: int):
        return image_or_404(image_id)

    @app.get("/api/thumb/{image_id}")
    def thumb(image_id: int):
        rows = db.query("SELECT path, fingerprint FROM images WHERE id = ?", (image_id,))
        if not rows or not os.path.exists(rows[0]["path"]):
            raise HTTPException(404)
        try:
            dest = thumbs.get(rows[0]["path"], rows[0]["fingerprint"])
        except Exception as exc:
            raise HTTPException(500, str(exc))
        return FileResponse(dest, media_type="image/webp", headers={"Cache-Control": "max-age=604800"})

    @app.get("/api/file/{image_id}")
    def original(image_id: int):
        rows = db.query("SELECT path FROM images WHERE id = ?", (image_id,))
        if not rows or not os.path.exists(rows[0]["path"]):
            raise HTTPException(404)
        return FileResponse(rows[0]["path"])

    @app.post("/api/reveal/{image_id}")
    def reveal(image_id: int):
        """エクスプローラー / Finder でファイルの場所を開く。"""
        path = image_or_404(image_id)["path"]
        if sys.platform.startswith("win"):
            subprocess.Popen(["explorer", "/select,", path])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", "-R", path])
        else:
            subprocess.Popen(["xdg-open", os.path.dirname(path)])
        return {"ok": True}

    # --- ユーザータグ / 振り分け ------------------------------------------------

    @app.get("/api/usertags")
    def user_tags():
        return db.all_user_tags()

    @app.post("/api/usertags")
    def set_user_tag(body: UserTagIn):
        tag = body.tag.strip()
        if not tag or not body.ids:
            raise HTTPException(400, "タグと画像を指定してください")
        db.set_user_tag(body.ids, tag, body.on)
        return {"ok": True}

    @app.post("/api/move")
    def move(body: MoveIn):
        dest = _norm(body.dest)
        os.makedirs(dest, exist_ok=True)
        roots = db.folders()
        root = next((r for r in roots if _is_within(dest, r)), None)
        if root is None:
            # 登録外のフォルダへ振り分けたときは、そのフォルダも登録して見失わないようにする
            db.add_folder(dest)
            root = dest
        done, errors = 0, []
        for image_id in body.ids:
            rows = db.query("SELECT path FROM images WHERE id = ?", (image_id,))
            if not rows:
                continue
            src = rows[0]["path"]
            try:
                target = _unique_dest(dest, os.path.basename(src))
                if body.mode == "copy":
                    shutil.copy2(src, target)
                    index_file(db, root, target, stealth=stealth)
                    db.commit()
                else:
                    shutil.move(src, target)
                    db.execute(
                        "UPDATE images SET path = ?, root = ?, folder = ?, name = ? WHERE id = ?",
                        (target, root, os.path.dirname(target), os.path.basename(target), image_id),
                    )
                done += 1
            except Exception as exc:
                errors.append(f"{src}: {exc}")
        return {"done": done, "errors": errors, "dest": dest}

    # --- 画面 ---------------------------------------------------------------

    @app.get("/")
    def index():
        return FileResponse(STATIC_DIR / "index.html")

    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    return app
