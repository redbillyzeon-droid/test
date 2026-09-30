"""SQLite の索引。"""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Iterable

SCHEMA = """
CREATE TABLE IF NOT EXISTS images (
    id          INTEGER PRIMARY KEY,
    path        TEXT NOT NULL UNIQUE,
    root        TEXT NOT NULL,
    folder      TEXT NOT NULL,
    name        TEXT NOT NULL,
    mtime       REAL NOT NULL,
    size        INTEGER NOT NULL,
    fingerprint TEXT NOT NULL,
    source      TEXT NOT NULL,
    model       TEXT NOT NULL DEFAULT '',
    seed        INTEGER,
    steps       INTEGER,
    width       INTEGER NOT NULL DEFAULT 0,
    height      INTEGER NOT NULL DEFAULT 0,
    prompt      TEXT NOT NULL DEFAULT '',
    negative    TEXT NOT NULL DEFAULT '',
    meta_json   TEXT NOT NULL DEFAULT '{}',
    tag_count   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_images_mtime ON images(mtime);
CREATE INDEX IF NOT EXISTS idx_images_root ON images(root);
CREATE INDEX IF NOT EXISTS idx_images_folder ON images(folder);
CREATE INDEX IF NOT EXISTS idx_images_fp ON images(fingerprint);

CREATE TABLE IF NOT EXISTS tags (
    image_id INTEGER NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    kind     TEXT NOT NULL,
    tag      TEXT NOT NULL,
    pos      INTEGER NOT NULL DEFAULT 0,  -- プロンプト内での順番
    PRIMARY KEY (image_id, kind, tag)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_tags_kind_tag ON tags(kind, tag, image_id);

-- ユーザーが付けたタグ (お気に入りなど)。ファイルを移動しても消えないよう内容のハッシュで持つ
CREATE TABLE IF NOT EXISTS user_tags (
    fingerprint TEXT NOT NULL,
    tag         TEXT NOT NULL,
    PRIMARY KEY (fingerprint, tag)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS idx_user_tags_tag ON user_tags(tag, fingerprint);

CREATE TABLE IF NOT EXISTS folders (
    path TEXT PRIMARY KEY
);
"""


class Database:
    def __init__(self, path: str | Path):
        self.path = str(path)
        self._lock = threading.RLock()
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.execute("PRAGMA journal_mode = WAL")
        self.conn.executescript(SCHEMA)

    def close(self) -> None:
        self.conn.close()

    # --- 汎用 ---------------------------------------------------------------

    def query(self, sql: str, params: Iterable[Any] = ()) -> list[sqlite3.Row]:
        with self._lock:
            return self.conn.execute(sql, tuple(params)).fetchall()

    def execute(self, sql: str, params: Iterable[Any] = ()) -> None:
        with self._lock:
            self.conn.execute(sql, tuple(params))
            self.conn.commit()

    # --- フォルダ -------------------------------------------------------------

    def folders(self) -> list[str]:
        return [r["path"] for r in self.query("SELECT path FROM folders ORDER BY path")]

    def add_folder(self, path: str) -> None:
        self.execute("INSERT OR IGNORE INTO folders(path) VALUES (?)", (path,))

    def remove_folder(self, path: str) -> None:
        with self._lock:
            self.conn.execute("DELETE FROM folders WHERE path = ?", (path,))
            self.conn.execute("DELETE FROM images WHERE root = ?", (path,))
            self.conn.commit()

    # --- 画像 ---------------------------------------------------------------

    def known_files(self, root: str) -> dict[str, tuple[float, int]]:
        rows = self.query("SELECT path, mtime, size FROM images WHERE root = ?", (root,))
        return {r["path"]: (r["mtime"], r["size"]) for r in rows}

    def upsert_image(self, record: dict[str, Any], tags: list[tuple[str, str]]) -> None:
        with self._lock:
            cur = self.conn.execute("SELECT id FROM images WHERE path = ?", (record["path"],))
            row = cur.fetchone()
            cols = [
                "path", "root", "folder", "name", "mtime", "size", "fingerprint", "source", "model",
                "seed", "steps", "width", "height", "prompt", "negative", "meta_json",
            ]
            values = [record[c] for c in cols]
            tag_count = sum(1 for kind, _ in tags if kind == "prompt")
            if row:
                image_id = row["id"]
                sets = ", ".join(f"{c} = ?" for c in cols)
                self.conn.execute(
                    f"UPDATE images SET {sets}, tag_count = ? WHERE id = ?",
                    (*values, tag_count, image_id),
                )
                self.conn.execute("DELETE FROM tags WHERE image_id = ?", (image_id,))
            else:
                cur = self.conn.execute(
                    f"INSERT INTO images ({', '.join(cols)}, tag_count) "
                    f"VALUES ({', '.join('?' * len(cols))}, ?)",
                    (*values, tag_count),
                )
                image_id = cur.lastrowid
            self.conn.executemany(
                "INSERT OR IGNORE INTO tags(image_id, kind, tag, pos) VALUES (?, ?, ?, ?)",
                [(image_id, kind, tag, pos) for pos, (kind, tag) in enumerate(tags)],
            )

    def delete_paths(self, paths: Iterable[str]) -> None:
        with self._lock:
            self.conn.executemany("DELETE FROM images WHERE path = ?", [(p,) for p in paths])

    def commit(self) -> None:
        with self._lock:
            self.conn.commit()

    def get_image(self, image_id: int) -> dict[str, Any] | None:
        rows = self.query("SELECT * FROM images WHERE id = ?", (image_id,))
        if not rows:
            return None
        item = dict(rows[0])
        item["meta"] = json.loads(item.pop("meta_json") or "{}")
        item["tags"] = [
            {"kind": r["kind"], "tag": r["tag"]}
            for r in self.query(
                "SELECT kind, tag FROM tags WHERE image_id = ? ORDER BY pos", (image_id,)
            )
        ]
        item["user_tags"] = self.user_tags_for(item["fingerprint"])
        return item

    def update_path(self, image_id: int, path: str, folder: str, name: str, mtime: float) -> None:
        self.execute(
            "UPDATE images SET path = ?, folder = ?, name = ?, mtime = ? WHERE id = ?",
            (path, folder, name, mtime, image_id),
        )

    # --- ユーザータグ ---------------------------------------------------------

    def user_tags_for(self, fingerprint: str) -> list[str]:
        rows = self.query(
            "SELECT tag FROM user_tags WHERE fingerprint = ? ORDER BY tag", (fingerprint,)
        )
        return [r["tag"] for r in rows]

    def set_user_tag(self, image_ids: list[int], tag: str, on: bool) -> None:
        with self._lock:
            fps = [
                r["fingerprint"]
                for r in self.conn.execute(
                    f"SELECT DISTINCT fingerprint FROM images WHERE id IN ({','.join('?' * len(image_ids))})",
                    image_ids,
                )
            ]
            if on:
                self.conn.executemany(
                    "INSERT OR IGNORE INTO user_tags(fingerprint, tag) VALUES (?, ?)",
                    [(fp, tag) for fp in fps],
                )
            else:
                self.conn.executemany(
                    "DELETE FROM user_tags WHERE fingerprint = ? AND tag = ?",
                    [(fp, tag) for fp in fps],
                )
            self.conn.commit()

    def all_user_tags(self) -> list[dict[str, Any]]:
        rows = self.query(
            "SELECT u.tag, COUNT(DISTINCT i.id) AS n FROM user_tags u "
            "JOIN images i ON i.fingerprint = u.fingerprint GROUP BY u.tag ORDER BY n DESC, u.tag"
        )
        return [{"tag": r["tag"], "count": r["n"]} for r in rows]

