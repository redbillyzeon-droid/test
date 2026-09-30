"""サムネイルのキャッシュ。"""

from __future__ import annotations

import threading
from pathlib import Path

from PIL import Image, ImageOps


class ThumbCache:
    def __init__(self, cache_dir: str | Path, size: int = 384):
        self.dir = Path(cache_dir)
        self.dir.mkdir(parents=True, exist_ok=True)
        self.size = size
        self._locks: dict[str, threading.Lock] = {}
        self._guard = threading.Lock()

    def _lock_for(self, key: str) -> threading.Lock:
        with self._guard:
            return self._locks.setdefault(key, threading.Lock())

    def get(self, src: str | Path, fingerprint: str) -> Path:
        dest = self.dir / fingerprint[:2] / f"{fingerprint}_{self.size}.webp"
        if dest.exists():
            return dest
        with self._lock_for(fingerprint):
            if dest.exists():
                return dest
            dest.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(src) as img:
                img = ImageOps.exif_transpose(img)
                img.thumbnail((self.size, self.size * 2), Image.Resampling.LANCZOS)
                if img.mode not in ("RGB", "RGBA"):
                    img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
                tmp = dest.with_suffix(".tmp")
                img.save(tmp, "WEBP", quality=82, method=4)
                tmp.replace(dest)
        return dest
