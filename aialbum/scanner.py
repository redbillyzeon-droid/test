"""登録フォルダを走査して索引を更新する。"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path

from .db import Database
from .metadata import SUPPORTED_EXTS, read_metadata
from .tags import tags_for

log = logging.getLogger(__name__)

_CHUNK = 64 * 1024


def fingerprint(path: str | Path, size: int | None = None) -> str:
    """ファイル先頭と末尾 64KB + サイズから作る軽量なハッシュ。"""
    path = Path(path)
    size = path.stat().st_size if size is None else size
    h = hashlib.sha1(str(size).encode())
    with open(path, "rb") as f:
        h.update(f.read(_CHUNK))
        if size > _CHUNK * 2:
            f.seek(-_CHUNK, os.SEEK_END)
            h.update(f.read(_CHUNK))
    return h.hexdigest()


def iter_images(root: str | Path):
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if Path(name).suffix.lower() in SUPPORTED_EXTS:
                yield os.path.join(dirpath, name)


def index_file(db: Database, root: str, path: str, stealth: str = "auto") -> None:
    st = os.stat(path)
    meta = read_metadata(path, stealth=stealth)
    record = {
        "path": path,
        "root": root,
        "folder": os.path.dirname(path),
        "name": os.path.basename(path),
        "mtime": st.st_mtime,
        "size": st.st_size,
        "fingerprint": fingerprint(path, st.st_size),
        "source": meta.source,
        "model": meta.model,
        "seed": meta.seed,
        "steps": meta.steps,
        "width": meta.width,
        "height": meta.height,
        "prompt": meta.prompt,
        "negative": meta.negative,
        "meta_json": json.dumps(meta.to_dict(), ensure_ascii=False, default=str),
    }
    db.upsert_image(record, tags_for(meta))


@dataclass
class ScanStatus:
    running: bool = False
    folder: str = ""
    total: int = 0
    done: int = 0
    added: int = 0
    removed: int = 0
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "running": self.running,
            "folder": self.folder,
            "total": self.total,
            "done": self.done,
            "added": self.added,
            "removed": self.removed,
            "errors": self.errors[-20:],
        }


def scan_folder(db: Database, root: str, status: ScanStatus | None = None, stealth: str = "auto") -> ScanStatus:
    """フォルダを走査し、新規 / 更新されたファイルだけ読み直す。"""
    status = status or ScanStatus()
    status.folder = root
    known = db.known_files(root)
    current = list(iter_images(root)) if os.path.isdir(root) else []
    current_set = set(current)

    removed = [p for p in known if p not in current_set]
    db.delete_paths(removed)
    status.removed += len(removed)

    todo = []
    for path in current:
        try:
            st = os.stat(path)
        except OSError:
            continue
        prev = known.get(path)
        if prev is None or prev[0] != st.st_mtime or prev[1] != st.st_size:
            todo.append(path)

    status.total += len(todo)
    for i, path in enumerate(todo, start=1):
        try:
            index_file(db, root, path, stealth=stealth)
            status.added += 1
        except Exception as exc:  # 壊れた画像などは飛ばす
            log.warning("読み込み失敗: %s (%s)", path, exc)
            status.errors.append(f"{path}: {exc}")
        status.done += 1
        if i % 200 == 0:
            db.commit()
    db.commit()
    return status


class Scanner:
    """バックグラウンドで全フォルダを走査する。"""

    def __init__(self, db: Database, stealth: str = "auto"):
        self.db = db
        self.stealth = stealth
        self.status = ScanStatus()
        self._thread: threading.Thread | None = None
        self._lock = threading.Lock()

    def start(self, folders: list[str] | None = None) -> bool:
        with self._lock:
            if self._thread and self._thread.is_alive():
                return False
            self.status = ScanStatus(running=True)
            targets = folders if folders is not None else self.db.folders()
            self._thread = threading.Thread(target=self._run, args=(targets,), daemon=True)
            self._thread.start()
            return True

    def _run(self, folders: list[str]) -> None:
        try:
            for folder in folders:
                scan_folder(self.db, folder, self.status, stealth=self.stealth)
        finally:
            self.status.running = False

    def wait(self) -> None:
        if self._thread:
            self._thread.join()
