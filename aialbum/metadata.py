"""画像ファイルに埋め込まれた生成情報を読み取る。

対応形式:
- Stable Diffusion WebUI (A1111 / Forge / Forge Neo): PNG の ``parameters`` チャンク、
  JPEG / WebP の EXIF UserComment
- NovelAI: PNG の ``Comment`` (JSON) / ``Description`` チャンク
- ステルス pnginfo: アルファ (または RGB) の最下位ビットに隠された情報 (NovelAI / A1111 拡張)
"""

from __future__ import annotations

import gzip
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image

SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


@dataclass
class ImageMeta:
    source: str = "unknown"  # "a1111" / "novelai" / "unknown"
    prompt: str = ""
    negative: str = ""
    # NovelAI V4 のキャラクター別プロンプト: [{"prompt": str, "negative": str, "center": {...}}]
    characters: list[dict[str, Any]] = field(default_factory=list)
    params: dict[str, Any] = field(default_factory=dict)
    width: int = 0
    height: int = 0
    raw: str = ""
    stealth: bool = False

    @property
    def model(self) -> str:
        return str(self.params.get("Model") or self.params.get("model") or "")

    @property
    def seed(self) -> int | None:
        value = self.params.get("Seed", self.params.get("seed"))
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    @property
    def steps(self) -> int | None:
        value = self.params.get("Steps", self.params.get("steps"))
        try:
            return int(value)
        except (TypeError, ValueError):
            return None

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "prompt": self.prompt,
            "negative": self.negative,
            "characters": self.characters,
            "params": self.params,
            "width": self.width,
            "height": self.height,
            "stealth": self.stealth,
        }


# ---------------------------------------------------------------------------
# A1111 / Forge 形式
# ---------------------------------------------------------------------------

# A1111 本体の re_param_code と同じ考え方: `Key: value, Key2: "quoted, value"`
_RE_PARAM = re.compile(r'\s*([\w][\w \-/()]*?):\s*("(?:\\.|[^\\"])*"|[^,]*)(?:,|$)')
_RE_PARAMS_LINE = re.compile(r"^\s*Steps:\s*\d+")


def parse_a1111(text: str) -> ImageMeta:
    """`parameters` テキストを プロンプト / ネガティブ / パラメータに分解する。"""
    lines = text.strip().split("\n")
    params_line = ""
    if lines and _RE_PARAMS_LINE.match(lines[-1]):
        params_line = lines.pop()

    prompt_lines: list[str] = []
    negative_lines: list[str] = []
    in_negative = False
    for line in lines:
        if line.startswith("Negative prompt:"):
            in_negative = True
            line = line[len("Negative prompt:"):].strip()
        (negative_lines if in_negative else prompt_lines).append(line)

    params: dict[str, Any] = {}
    for key, value in _RE_PARAM.findall(params_line):
        value = value.strip()
        if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
            try:
                value = json.loads(value)
            except json.JSONDecodeError:
                value = value[1:-1]
        params[key.strip()] = value

    meta = ImageMeta(
        source="a1111",
        prompt="\n".join(prompt_lines).strip(),
        negative="\n".join(negative_lines).strip(),
        params=params,
        raw=text,
    )
    size = params.get("Size", "")
    if isinstance(size, str) and "x" in size:
        w, _, h = size.partition("x")
        if w.isdigit() and h.isdigit():
            meta.width, meta.height = int(w), int(h)
    return meta


# ---------------------------------------------------------------------------
# NovelAI 形式
# ---------------------------------------------------------------------------

_NAI_PARAM_KEYS = {
    "steps": "Steps",
    "sampler": "Sampler",
    "seed": "Seed",
    "scale": "CFG scale",
    "cfg_rescale": "CFG rescale",
    "noise_schedule": "Noise schedule",
    "sm": "SMEA",
    "sm_dyn": "SMEA DYN",
    "uncond_scale": "UC scale",
    "strength": "Strength",
    "noise": "Noise",
}


def parse_novelai(info: dict[str, Any]) -> ImageMeta | None:
    """NovelAI の PNG テキスト情報 (Description / Comment / Source ...) を解析する。"""
    comment = info.get("Comment")
    data: dict[str, Any] = {}
    if isinstance(comment, str):
        try:
            data = json.loads(comment)
        except json.JSONDecodeError:
            data = {}
    elif isinstance(comment, dict):
        data = comment
    if not data and not info.get("Description"):
        return None

    meta = ImageMeta(source="novelai", raw=json.dumps(info, ensure_ascii=False))
    v4 = data.get("v4_prompt") or {}
    v4_neg = data.get("v4_negative_prompt") or {}
    caption = v4.get("caption") or {}
    neg_caption = v4_neg.get("caption") or {}

    meta.prompt = caption.get("base_caption") or data.get("prompt") or info.get("Description") or ""
    meta.negative = neg_caption.get("base_caption") or data.get("uc") or ""

    neg_chars = neg_caption.get("char_captions") or []
    for i, char in enumerate(caption.get("char_captions") or []):
        entry: dict[str, Any] = {"prompt": char.get("char_caption", "")}
        if i < len(neg_chars):
            entry["negative"] = neg_chars[i].get("char_caption", "")
        centers = char.get("centers") or []
        if centers:
            entry["center"] = centers[0]
        meta.characters.append(entry)

    for key, label in _NAI_PARAM_KEYS.items():
        if key in data and data[key] not in (None, ""):
            meta.params[label] = data[key]
    source = info.get("Source")
    if source:
        # 例: "NovelAI Diffusion V4.5 4BDE2A90" → モデル名として扱う
        meta.params["Model"] = re.sub(r"\s+[0-9A-F]{8}$", "", str(source))
    if info.get("Software"):
        meta.params["Software"] = info["Software"]
    meta.width = int(data.get("width") or 0)
    meta.height = int(data.get("height") or 0)
    return meta


# ---------------------------------------------------------------------------
# EXIF (JPEG / WebP)
# ---------------------------------------------------------------------------

_EXIF_IFD = 0x8769
_USER_COMMENT = 0x9286


def _decode_user_comment(value: Any) -> str:
    if isinstance(value, str):
        return value.strip("\x00")
    if not isinstance(value, (bytes, bytearray)):
        return ""
    data = bytes(value)
    prefix, body = data[:8], data[8:]
    if prefix.startswith(b"UNICODE"):
        # piexif (A1111) は UTF-16BE、ツールによっては LE。ヌルバイトの位置で判定する
        be = body[0:1] == b"\x00" if body else True
        try:
            return body.decode("utf-16-be" if be else "utf-16-le").strip("\x00")
        except UnicodeDecodeError:
            return body.decode("utf-16-le", errors="ignore").strip("\x00")
    if prefix.startswith(b"ASCII"):
        return body.decode("ascii", errors="ignore").strip("\x00")
    return data.decode("utf-8", errors="ignore").strip("\x00")


def _read_exif_text(img: Image.Image) -> str:
    try:
        exif = img.getexif()
    except Exception:
        return ""
    value = None
    try:
        value = exif.get_ifd(_EXIF_IFD).get(_USER_COMMENT)
    except Exception:
        value = None
    if value is None:
        value = exif.get(_USER_COMMENT)
    return _decode_user_comment(value) if value is not None else ""


# ---------------------------------------------------------------------------
# ステルス pnginfo
# ---------------------------------------------------------------------------

_STEALTH_SIGS = {
    b"stealth_pnginfo": ("alpha", False),
    b"stealth_pngcomp": ("alpha", True),
    b"stealth_rgbinfo": ("rgb", False),
    b"stealth_rgbcomp": ("rgb", True),
}
_SIG_LEN = 15


def _stealth_bits(img: Image.Image, mode: str):
    import numpy as np

    if mode == "alpha":
        if img.mode != "RGBA":
            return None
        arr = np.asarray(img)[:, :, 3]
        # 列優先 (x → y の順) で読む
        return (arr.T.ravel() & 1).astype(np.uint8)
    arr = np.asarray(img.convert("RGB"))
    return (arr.transpose(1, 0, 2).ravel() & 1).astype(np.uint8)


def read_stealth(img: Image.Image) -> str | None:
    """アルファ / RGB の最下位ビットに埋め込まれた情報を取り出す。"""
    import numpy as np

    for mode in ("alpha", "rgb"):
        bits = _stealth_bits(img, mode)
        if bits is None or bits.size < (_SIG_LEN + 4) * 8:
            continue
        sig = np.packbits(bits[: _SIG_LEN * 8]).tobytes()
        found = _STEALTH_SIGS.get(sig)
        if not found or found[0] != mode:
            continue
        compressed = found[1]
        pos = _SIG_LEN * 8
        length = int(np.packbits(bits[pos : pos + 32]).view(">u4")[0])
        pos += 32
        if length <= 0 or pos + length > bits.size:
            return None
        payload = np.packbits(bits[pos : pos + length]).tobytes()
        try:
            if compressed:
                payload = gzip.decompress(payload)
            return payload.decode("utf-8")
        except Exception:
            return None
    return None


def _parse_stealth_payload(text: str) -> ImageMeta | None:
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        data = None
    if isinstance(data, dict):
        meta = parse_novelai(data)
        if meta:
            return meta
    if "Steps:" in text or text.strip():
        return parse_a1111(text)
    return None


# ---------------------------------------------------------------------------
# 入口
# ---------------------------------------------------------------------------


def read_metadata(path: str | Path, stealth: str = "auto") -> ImageMeta:
    """画像ファイルから生成情報を読む。

    stealth: "auto" (通常のメタデータが無いときだけ試す) / "always" / "never"
    """
    path = Path(path)
    with Image.open(path) as img:
        info: dict[str, Any] = dict(getattr(img, "text", {}) or {})
        for key, value in img.info.items():
            if isinstance(value, str):
                info.setdefault(key, value)
        size = img.size

        meta: ImageMeta | None = None
        if "Comment" in info and ("Software" in info or "Source" in info or "Description" in info):
            meta = parse_novelai(info)
        if meta is None and info.get("parameters"):
            meta = parse_a1111(info["parameters"])
        if meta is None:
            exif_text = _read_exif_text(img)
            if exif_text:
                try:
                    data = json.loads(exif_text)
                except json.JSONDecodeError:
                    data = None
                meta = parse_novelai(data) if isinstance(data, dict) else parse_a1111(exif_text)

        if (meta is None and stealth == "auto") or stealth == "always":
            if path.suffix.lower() in {".png", ".webp"}:
                try:
                    payload = read_stealth(img)
                except Exception:
                    payload = None
                if payload:
                    found = _parse_stealth_payload(payload)
                    if found:
                        found.stealth = True
                        meta = meta or found

    meta = meta or ImageMeta()
    meta.width, meta.height = size
    return meta
