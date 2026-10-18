"""NovelAI の infill（一部だけを描き直す）で、立ち絵の決めた範囲だけを描き直すスクリプト。

状態：未完成。2026-10-18 にカバネの鎖骨で3回試し、どれも使えなかった。
  - nai-diffusion-5-full-inpainting：範囲に文字の札が描かれた
  - nai-diffusion-4-5-full-inpainting（マスク 1/8、元の大きさの両方）：範囲が灰色の四角になった
  送り方（強さ、マスクの形、項目名など）のどこかが合っていない。公式の資料で確かめてから直す。

nai_generate.py のプロンプト検査・ネガティブ・キーの読み方をそのまま使う。
送り方は D:/AI社員/tools/encore_nai_outpaint.py（Ver4.5 の inpainting で実績あり）に合わせた。
Ver5 の inpainting のモデル名は公式の資料で確かめていない（要確認）。

使い方：
  # 描き直す範囲（x0,y0,x1,y1）を確かめる。マスクを重ねた確認用の画像を作るだけで、送信しない
  python game/tools/nai_inpaint.py --src outputs/nai/v5_kabane_normal_b_seed2378716315.png \
      --box 340,205,490,265 --name kabane_collar --prompt "..." --negative "..."

  # 実際に送る（Anlas を使う場合がある）
  python game/tools/nai_inpaint.py ... --seed 1 --run

保存先は outputs/nai/（Git 管理外）。
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import sys
import time
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))
import nai_generate as ng  # noqa: E402

DEFAULT_MODEL = "nai-diffusion-4-5-full-inpainting"


def png_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def make_mask(size: tuple[int, int], box: tuple[int, int, int, int]) -> Image.Image:
    """描き直す範囲を白（255）、残す範囲を黒（0）にしたマスク。"""
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rectangle(box, fill=255)
    return mask


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="NovelAI の infill で、画像の一部だけを描き直す")
    ap.add_argument("--src", type=Path, required=True, help="もとの画像（PNG）")
    ap.add_argument("--box", required=True, help="描き直す範囲 x0,y0,x1,y1（もとの画像の座標）")
    ap.add_argument("--name", required=True)
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--negative", default="")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--strength", type=float, default=0.7, help="描き直しの強さ（0〜1）")
    ap.add_argument("--full-mask", action="store_true", help="マスクを 1/8 に縮めず、もとの大きさで送る")
    ap.add_argument("--run", action="store_true")
    args = ap.parse_args(argv)

    ng.check_prompt(args.prompt)
    box = tuple(int(v) for v in args.box.split(","))
    if len(box) != 4:
        sys.exit("中止：--box は x0,y0,x1,y1 の4つの数")
    src = Image.open(args.src).convert("RGB")
    w, h = src.size
    mask = make_mask((w, h), box)
    seed = args.seed if args.seed is not None else int(time.time()) % 4294967295

    ng.OUT_DIR.mkdir(parents=True, exist_ok=True)
    preview = src.copy()
    overlay = Image.new("RGB", (w, h), (255, 0, 0))
    preview.paste(Image.blend(src, overlay, 0.45), mask=mask)
    preview_path = ng.OUT_DIR / f"{args.name}_mask_preview.png"
    preview.save(preview_path)

    negative = ng.build_negative(args.negative, ng.detect_gender(args.prompt))
    payload = ng.build_payload(args.prompt, negative, "portrait", seed, args.model, 28, 5.0)
    payload["action"] = "infill"
    payload["parameters"].update({
        "width": w, "height": h,
        "image": png_b64(src),
        "mask": png_b64(mask if args.full_mask else mask.resize((w // 8, h // 8), Image.NEAREST)),
        "strength": args.strength, "noise": 0, "extra_noise_seed": seed,
        "inpaintImg2ImgStrength": 1, "request_type": "NativeInfillingRequest", "color_correct": True,
    })

    if not args.run:
        print(f"送信しません。描き直す範囲を赤で重ねた確認用の画像：{preview_path.relative_to(ng.ROOT)}")
        return 0

    api_key = ng.load_key()
    if not api_key:
        sys.exit("中止：環境変数 NOVELAI_API_KEY（または novelai）がありません")
    png = ng.generate(payload, api_key)
    out = ng.OUT_DIR / f"{args.name}_seed{seed}.png"
    out.write_bytes(png)
    meta = json.loads(json.dumps(payload))
    meta["parameters"]["image"] = f"<{args.src}>"
    meta["parameters"]["mask"] = f"<box {args.box}>"
    (ng.OUT_DIR / f"{args.name}_seed{seed}.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"保存しました：{out.relative_to(ng.ROOT)}")
    return 0


if __name__ == "__main__":
    for s in (sys.stdout, sys.stderr):
        try:
            s.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    sys.exit(main())
