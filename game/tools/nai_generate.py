"""NovelAI の API で画像を1枚ずつ生成するスクリプト（標準ライブラリだけで動く）。

状態：未確認。NovelAI の API の仕様（URL、パラメーター名、返ってくる形式）は、
      公式の資料で確かめていない。最初に実行するときは、少ない枚数で試すこと。

APIキーは、環境変数 NOVELAI_API_KEY から読む。キーをファイルやチャットに書かない。
このスクリプトはキーを表示しない。

使い方：
  # 送る内容だけを表示する（送信しない。キーがなくても動く）
  python game/tools/nai_generate.py --name konoha_normal --prompt "1girl, adult, ..." --size portrait

  # 実際に生成する（Anlas を使う場合がある）
  python game/tools/nai_generate.py --name konoha_normal --prompt "..." --size portrait --seed 12345 --run

生成した画像は outputs/nai/ に保存する（Git 管理外）。
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request
import zipfile
from pathlib import Path

# 以下の3つは、NovelAI の公式の資料で要確認
API_URL = "https://image.novelai.net/ai/generate-image"
DEFAULT_MODEL = "nai-diffusion-4-5-full"
SIZES = {"portrait": (832, 1216), "landscape": (1216, 832), "square": (1024, 1024)}

COMMON_NEGATIVE = (
    "lowres, bad anatomy, bad hands, extra fingers, missing fingers, text, watermark, signature, "
    "blurry, jpeg artifacts, child, loli, petite, flat chest, school uniform"
)
REQUIRED_ADULT_TAGS = ("adult",)  # 人物を描くときに必ず入れるタグ（docs/game/art/nai-prompts.md）

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "outputs" / "nai"


def build_payload(prompt: str, negative: str, size: str, seed: int, model: str, steps: int, scale: float) -> dict:
    width, height = SIZES[size]
    return {
        "input": prompt,
        "model": model,
        "action": "generate",
        "parameters": {
            "width": width,
            "height": height,
            "n_samples": 1,
            "seed": seed,
            "steps": steps,
            "scale": scale,
            "sampler": "k_euler_ancestral",
            "negative_prompt": negative,
            "v4_prompt": {"caption": {"base_caption": prompt, "char_captions": []}, "use_coords": False, "use_order": True},
            "v4_negative_prompt": {"caption": {"base_caption": negative, "char_captions": []}},
        },
    }


def check_prompt(prompt: str) -> None:
    tags = {t.strip().lower() for t in prompt.split(",") if t.strip()}
    if "no humans" in tags:
        return
    person_tags = {"1girl", "2girls", "3girls", "multiple girls", "1boy", "2boys", "multiple boys", "1other"}
    has_person = bool(tags & person_tags)
    if has_person and not all(t in tags for t in REQUIRED_ADULT_TAGS):
        sys.exit("中止：人物のプロンプトに 'adult' がありません（全員を成人の見た目で描く決まり）")


def generate(payload: dict, api_key: str) -> bytes:
    req = urllib.request.Request(
        API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as res:
            body = res.read()
    except urllib.error.HTTPError as e:
        # 応答の本文には、キーは含まれない想定。念のため長さを制限して表示する
        detail = e.read()[:300].decode("utf-8", "replace")
        sys.exit(f"失敗：HTTP {e.code} {detail}")
    except urllib.error.URLError as e:
        sys.exit(f"失敗：接続できません（{e.reason}）。ネットワークの設定で image.novelai.net が許可されているか確認してください")
    # 返ってくるのは、PNG を含む ZIP の想定（要確認）
    try:
        with zipfile.ZipFile(io.BytesIO(body)) as z:
            names = [n for n in z.namelist() if n.lower().endswith(".png")]
            if not names:
                sys.exit("失敗：応答の ZIP に PNG がありません")
            return z.read(names[0])
    except zipfile.BadZipFile:
        if body[:8] == b"\x89PNG\r\n\x1a\n":
            return body
        sys.exit("失敗：応答が ZIP でも PNG でもありません（API の仕様を確認してください）")


def main() -> int:
    ap = argparse.ArgumentParser(description="NovelAI で画像を1枚生成する")
    ap.add_argument("--name", required=True, help="保存するファイルの名前（拡張子なし）")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--negative", default="", help="共通のネガティブに足すタグ")
    ap.add_argument("--size", choices=sorted(SIZES), default="portrait")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--scale", type=float, default=5.0)
    ap.add_argument("--run", action="store_true", help="実際に送信する（指定しなければ、送る内容を表示するだけ）")
    args = ap.parse_args()

    check_prompt(args.prompt)
    negative = COMMON_NEGATIVE + (", " + args.negative if args.negative else "")
    seed = args.seed if args.seed is not None else int(time.time()) % 4294967295
    payload = build_payload(args.prompt, negative, args.size, seed, args.model, args.steps, args.scale)

    if not args.run:
        print("送信しません（--run を付けると送信します）。送る内容：")
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    api_key = os.environ.get("NOVELAI_API_KEY", "").strip()
    if not api_key:
        sys.exit("中止：環境変数 NOVELAI_API_KEY がありません")

    png = generate(payload, api_key)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{args.name}_seed{seed}.png"
    out.write_bytes(png)
    meta = {k: v for k, v in payload.items()}
    (OUT_DIR / f"{args.name}_seed{seed}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"保存しました：{out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    sys.exit(main())
