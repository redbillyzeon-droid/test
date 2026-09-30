"""テスト用のサンプル画像を作る。"""

from __future__ import annotations

import gzip
import json
from pathlib import Path

import numpy as np
from PIL import Image, PngImagePlugin

A1111_PARAMS = """masterpiece, best quality, 1girl, (long_hair:1.2), blue eyes, yor briar \\(spy x family\\), <lora:detail_tweaker:0.8>
BREAK smile
Negative prompt: (worst quality:1.4), lowres, bad hands
Steps: 28, Sampler: Euler a, Schedule type: Automatic, CFG scale: 5, Seed: 123456, Size: 832x1216, Model hash: abcd1234, Model: animagine-xl-4.0, Lora hashes: "detail_tweaker: 1234abcd", Version: neo"""

NAI_COMMENT = {
    "prompt": "2girls, outdoors, {{masterpiece}}, 1.3::cherry blossoms::, artist:foo",
    "steps": 28,
    "height": 1216,
    "width": 832,
    "scale": 5,
    "seed": 987654321,
    "sampler": "k_euler_ancestral",
    "noise_schedule": "karras",
    "uc": "lowres, bad anatomy",
    "v4_prompt": {
        "caption": {
            "base_caption": "2girls, outdoors, {{masterpiece}}, 1.3::cherry blossoms::, artist:foo",
            "char_captions": [
                {"char_caption": "girl, red hair, school uniform", "centers": [{"x": 0.3, "y": 0.5}]},
                {"char_caption": "girl, [black hair], kimono", "centers": [{"x": 0.7, "y": 0.5}]},
            ],
        },
        "use_coords": True,
        "use_order": True,
    },
    "v4_negative_prompt": {
        "caption": {
            "base_caption": "lowres, bad anatomy",
            "char_captions": [{"char_caption": "hat"}, {"char_caption": ""}],
        }
    },
}


def nai_info() -> dict[str, str]:
    return {
        "Title": "NovelAI generated image",
        "Description": NAI_COMMENT["prompt"],
        "Software": "NovelAI",
        "Source": "NovelAI Diffusion V4.5 4BDE2A90",
        "Comment": json.dumps(NAI_COMMENT),
    }


def make_a1111_png(path: Path) -> Path:
    info = PngImagePlugin.PngInfo()
    info.add_text("parameters", A1111_PARAMS)
    Image.new("RGB", (64, 96), (200, 100, 50)).save(path, pnginfo=info)
    return path


def make_nai_png(path: Path) -> Path:
    info = PngImagePlugin.PngInfo()
    for key, value in nai_info().items():
        info.add_text(key, value)
    Image.new("RGBA", (64, 96), (50, 100, 200, 255)).save(path, pnginfo=info)
    return path


def make_a1111_jpeg(path: Path, little_endian: bool = False) -> Path:
    img = Image.new("RGB", (64, 64), (10, 200, 10))
    exif = Image.Exif()
    body = A1111_PARAMS.encode("utf-16-le" if little_endian else "utf-16-be")
    exif.get_ifd(0x8769)[0x9286] = b"UNICODE\x00" + body
    img.save(path, "JPEG", exif=exif.tobytes())
    return path


def make_stealth_png(path: Path, compressed: bool = True) -> Path:
    """NovelAI 方式 (アルファの最下位ビット、列優先) で情報を埋め込んだ PNG。"""
    payload = json.dumps(nai_info()).encode()
    sig = b"stealth_pngcomp" if compressed else b"stealth_pnginfo"
    if compressed:
        payload = gzip.compress(payload)
    bits = np.unpackbits(np.frombuffer(sig, dtype=np.uint8))
    length_bits = np.unpackbits(np.frombuffer(np.array([len(payload) * 8], dtype=">u4").tobytes(), dtype=np.uint8))
    data_bits = np.unpackbits(np.frombuffer(payload, dtype=np.uint8))
    all_bits = np.concatenate([bits, length_bits, data_bits])

    w, h = 128, 128
    assert all_bits.size <= w * h
    alpha = np.full(w * h, 254, dtype=np.uint8)
    alpha[: all_bits.size] |= all_bits
    alpha = alpha.reshape(w, h).T  # 列優先で並べたものを (h, w) に戻す
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    rgba[:, :, 0] = 120
    rgba[:, :, 3] = alpha
    Image.fromarray(rgba, "RGBA").save(path)
    return path


def make_plain_png(path: Path) -> Path:
    Image.new("RGB", (32, 32), (0, 0, 0)).save(path)
    return path
