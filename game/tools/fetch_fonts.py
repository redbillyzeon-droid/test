"""会話画面の試作で使うフォントを取ってくる（標準ライブラリだけで動く）。

フォントはどれも SIL Open Font License 1.1（商用利用・ゲームへの同梱ができる）。
ライセンス文（OFL.txt）も一緒に保存する。同梱するときは、ライセンス文もゲームに入れること。

取ってくる元：GitHub の google/fonts リポジトリ（raw.githubusercontent.com）
保存先：game/tyrano-proto/data/others/adv_ui/fonts/

2026-10-16 に組み合わせ A（Dela Gothic One ＋ Zen Kaku Gothic New）に決まり、
この2書体とライセンス文はリポジトリに入れた。このスクリプトは、ファイルがなくなったときの取り直し用。

使い方：python game/tools/fetch_fonts.py
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

BASE = "https://raw.githubusercontent.com/google/fonts/main/ofl/"
FONTS = {
    # 保存する名前: (google/fonts の中のパス)
    "DelaGothicOne-Regular.ttf": "delagothicone/DelaGothicOne-Regular.ttf",
    "DelaGothicOne-OFL.txt": "delagothicone/OFL.txt",
    "ZenKakuGothicNew-Medium.ttf": "zenkakugothicnew/ZenKakuGothicNew-Medium.ttf",
    "ZenKakuGothicNew-Bold.ttf": "zenkakugothicnew/ZenKakuGothicNew-Bold.ttf",
    "ZenKakuGothicNew-OFL.txt": "zenkakugothicnew/OFL.txt",
}

OUT = Path(__file__).resolve().parents[1] / "tyrano-proto" / "data" / "others" / "adv_ui" / "fonts"


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    failed = 0
    for name, path in FONTS.items():
        dest = OUT / name
        if dest.exists() and dest.stat().st_size > 0:
            print(f"あり：{name}")
            continue
        try:
            with urllib.request.urlopen(BASE + path, timeout=120) as res:
                dest.write_bytes(res.read())
            print(f"保存：{name}")
        except Exception as e:  # ネットワークの失敗は、名前と理由だけ出して続ける
            print(f"失敗：{name}（{e}）", file=sys.stderr)
            failed += 1
    print("完了" if not failed else f"失敗 {failed} 件")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
