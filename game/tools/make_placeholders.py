"""試作用の仮の画像（背景と立ち絵のシルエット）を作る。標準ライブラリだけで動く。

本番の絵は NovelAI で作る。これは配置と動きの確認用。
出力：game/tyrano-proto/data/bgimage/proto_*.png、data/fgimage/chara/proto/*.png
使い方：python game/tools/make_placeholders.py
"""

from __future__ import annotations

import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "tyrano-proto" / "data"


def write_png(path: Path, width: int, height: int, rows: list[bytes], rgba: bool) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + r for r in rows)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6 if rgba else 2, 0, 0, 0)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def beach(path: Path) -> None:
    w, h = 1280, 720
    rows = []
    for y in range(h):
        if y < 300:
            c = lerp((124, 198, 242), (191, 230, 251), y / 300)
        elif y < 370:
            c = lerp((58, 166, 216), (121, 203, 232), (y - 300) / 70)
        else:
            c = lerp((244, 230, 196), (217, 194, 140), (y - 370) / 350)
        rows.append(bytes(c) * w)
    write_png(path, w, h, rows, rgba=False)


def silhouette(path: Path, color: tuple[int, int, int], w: int = 300, h: int = 680) -> None:
    rows = []
    for y in range(h):
        row = bytearray()
        for x in range(w):
            # 頭（円）と体（下に広がる形）
            hx, hy, hr = w / 2, 90, 70
            in_head = (x - hx) ** 2 + (y - hy) ** 2 <= hr ** 2
            body_half = 60 + (y - 160) * 0.12 if y >= 160 else -1
            in_body = y >= 160 and abs(x - w / 2) <= body_half
            if in_head or in_body:
                shade = 1.0 - 0.25 * (y / h)
                row += bytes(int(v * shade) for v in color) + b"\xff"
            else:
                row += b"\x00\x00\x00\x00"
        rows.append(bytes(row))
    write_png(path, w, h, rows, rgba=True)


def main() -> None:
    beach(ROOT / "bgimage" / "proto_beach_day.png")
    silhouette(ROOT / "fgimage" / "chara" / "proto" / "konoha.png", (217, 130, 43))
    silhouette(ROOT / "fgimage" / "chara" / "proto" / "noctia.png", (110, 30, 50))
    print("作成しました")


if __name__ == "__main__":
    main()
