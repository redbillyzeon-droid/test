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

  # Ver4.5 で、Ver5 の絵を参照画像にして差分を出す（送る内容の確認だけ。項目名は要確認）
  python game/tools/nai_generate.py --name konoha_smile --prompt "1girl, adult, ..." \
      --reference outputs/nai/v5_konoha_normal_seed20003.png --reference-strength 0.6

男性キャラクター（主人公ユウ、黒瀬カイ、先輩 など。プロンプトに 1boy があり、女性のタグがない）のときは、
共通のネガティブから flat chest を外し、breasts, female を足す（docs/game/art/nai-prompts.md 1-2 の申し送り）。
--gender で手動で切りかえられる。

生成した画像は outputs/nai/ に保存する（Git 管理外）。
"""

from __future__ import annotations

import argparse
import base64
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
# 男性キャラクターのとき：共通のネガティブから外すタグと、足すタグ
MALE_REMOVE_NEGATIVE = ("flat chest",)
MALE_EXTRA_NEGATIVE = ("breasts", "female")
FEMALE_TAGS = {"1girl", "2girls", "3girls", "multiple girls"}
MALE_TAGS = {"1boy", "2boys", "3boys", "multiple boys"}

# 参照画像（Ver4.5 で Ver5 の絵を参照する）。
# 要確認：NovelAI の API で参照画像を送る項目名と値の形は、公式の資料で確かめていない。
#   下の項目名は仮。--run で参照画像を送るときは、確かめたうえで --reference-confirmed を付ける。
REFERENCE_KEYS = {
    "images": "reference_image_multiple",                       # 要確認：画像（PNG を base64 にした文字列）のリスト
    "strength": "reference_strength_multiple",                  # 要確認：強さのリスト（0〜1 の想定）
    "information": "reference_information_extracted_multiple",  # 要確認：取り出す情報の量のリスト（0〜1 の想定）
}
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
REQUIRED_ADULT_TAGS = ("adult",)  # 人物を描くときに必ず入れるタグ（docs/game/art/nai-prompts.md）

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "outputs" / "nai"


def split_tags(text: str) -> list[str]:
    return [t.strip() for t in text.split(",") if t.strip()]


def detect_gender(prompt: str) -> str:
    """プロンプトの人数のタグから、"male"・"female"・"mixed"・"none" を返す。"""
    tags = {t.lower() for t in split_tags(prompt)}
    girl, boy = bool(tags & FEMALE_TAGS), bool(tags & MALE_TAGS)
    if girl and boy:
        return "mixed"
    return "male" if boy else "female" if girl else "none"


def build_negative(extra: str, gender: str) -> str:
    """共通のネガティブに、キャラクターごとのタグ（extra）を足す。男性のときは flat chest を外す。

    gender は "male" のときだけ男性用にする（"mixed" は女性もいるので、共通のまま）。重なったタグは1つにする。
    """
    tags = split_tags(COMMON_NEGATIVE)
    if gender == "male":
        tags = [t for t in tags if t.lower() not in MALE_REMOVE_NEGATIVE] + list(MALE_EXTRA_NEGATIVE)
    out: list[str] = []
    seen: set[str] = set()
    for t in tags + split_tags(extra):
        key = t.lower()
        if gender == "male" and key in MALE_REMOVE_NEGATIVE:
            continue  # キャラクターごとのタグで入れても外す（男性の胸がふくらむ方向に効くおそれ）
        if key not in seen:
            seen.add(key)
            out.append(t)
    return ", ".join(out)


def load_reference(path: Path) -> str:
    """参照画像（PNG）を読み、base64 の文字列にする。"""
    data = path.read_bytes()
    if data[:8] != PNG_MAGIC:
        raise ValueError(f"参照画像が PNG ではありません：{path}")
    return base64.b64encode(data).decode("ascii")


def add_reference(payload: dict, image_b64: str, strength: float, information: float) -> dict:
    """参照画像の項目を payload に足す（項目名と値の形は要確認。REFERENCE_KEYS を見る）。"""
    params = payload["parameters"]
    params[REFERENCE_KEYS["images"]] = [image_b64]
    params[REFERENCE_KEYS["strength"]] = [strength]
    params[REFERENCE_KEYS["information"]] = [information]
    return payload


def redact_payload(payload: dict) -> dict:
    """表示・記録用に、参照画像の base64 を短い印に置きかえた写しを返す。"""
    out = json.loads(json.dumps(payload))
    imgs = out.get("parameters", {}).get(REFERENCE_KEYS["images"])
    if imgs:
        out["parameters"][REFERENCE_KEYS["images"]] = [f"<PNG base64 {len(x)} 文字>" for x in imgs]
    return out


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
    person_tags = FEMALE_TAGS | MALE_TAGS | {"1other"}
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


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="NovelAI で画像を1枚生成する")
    ap.add_argument("--name", required=True, help="保存するファイルの名前（拡張子なし）")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--negative", default="", help="共通のネガティブに足すタグ")
    ap.add_argument("--size", choices=sorted(SIZES), default="portrait")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--scale", type=float, default=5.0)
    ap.add_argument("--gender", choices=("auto", "female", "male"), default="auto",
                    help="ネガティブの男女の切りかえ（auto はプロンプトの 1girl／1boy で決める）")
    ap.add_argument("--reference", type=Path, default=None, help="参照画像（PNG）。Ver5 で作った基準の絵")
    ap.add_argument("--reference-strength", type=float, default=0.6, help="参照画像の強さ（0〜1。おすすめの値は要確認）")
    ap.add_argument("--reference-information", type=float, default=1.0, help="参照画像から取り出す情報の量（0〜1。要確認）")
    ap.add_argument("--reference-confirmed", action="store_true",
                    help="参照画像の項目名を公式の資料で確かめたあとに付ける（付けないと、参照画像つきでは送信しない）")
    ap.add_argument("--run", action="store_true", help="実際に送信する（指定しなければ、送る内容を表示するだけ）")
    args = ap.parse_args(argv)

    check_prompt(args.prompt)
    gender = detect_gender(args.prompt) if args.gender == "auto" else args.gender
    negative = build_negative(args.negative, gender)
    seed = args.seed if args.seed is not None else int(time.time()) % 4294967295
    payload = build_payload(args.prompt, negative, args.size, seed, args.model, args.steps, args.scale)
    if args.reference is not None:
        for name, v in (("--reference-strength", args.reference_strength), ("--reference-information", args.reference_information)):
            if not 0.0 <= v <= 1.0:
                sys.exit(f"中止：{name} は 0〜1 にしてください")
        try:
            add_reference(payload, load_reference(args.reference), args.reference_strength, args.reference_information)
        except (OSError, ValueError) as e:
            sys.exit(f"中止：参照画像を読めません（{e}）")

    if not args.run:
        print("送信しません（--run を付けると送信します）。送る内容：")
        print(json.dumps(redact_payload(payload), ensure_ascii=False, indent=2))
        if args.reference is not None:
            print("注意：参照画像の項目名と値の形は要確認です（REFERENCE_KEYS）。")
        return 0

    if args.reference is not None and not args.reference_confirmed:
        sys.exit("中止：参照画像の項目名が要確認のため送信しません。公式の資料で確かめてから --reference-confirmed を付けてください")

    api_key = os.environ.get("NOVELAI_API_KEY", "").strip()
    if not api_key:
        sys.exit("中止：環境変数 NOVELAI_API_KEY がありません")

    png = generate(payload, api_key)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = OUT_DIR / f"{args.name}_seed{seed}.png"
    out.write_bytes(png)
    meta = redact_payload(payload)  # 参照画像の base64 は記録しない
    if args.reference is not None:
        meta["reference_file"] = str(args.reference)
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
