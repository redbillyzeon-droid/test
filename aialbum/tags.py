"""プロンプト文字列を検索用のタグに分解する。"""

from __future__ import annotations

import re

from .metadata import ImageMeta

# <lora:name:0.8> / <lyco:name> / <hypernet:name:1>
_RE_EXTRA_NET = re.compile(r"<\s*(lora|lyco|locon|hypernet)\s*:\s*([^:>]+)(?::[^>]*)?>", re.I)
# NovelAI V4 の数値強調: "1.5::tag, tag::" / "-1::tag::"
_RE_NAI_NUMERIC = re.compile(r"-?\d+(?:\.\d+)?::")
# 括弧内の重み "(tag:1.2)" の ":1.2" 部分
_RE_WEIGHT = re.compile(r":\s*-?\d+(?:\.\d+)?\s*(?=[)\]}]|$)")
_RE_SPACES = re.compile(r"\s+")

_ESC_OPEN = "\x01"
_ESC_CLOSE = "\x02"


def extract_loras(prompt: str) -> list[str]:
    return [m.group(2).strip() for m in _RE_EXTRA_NET.finditer(prompt)]


def normalize_tag(tag: str) -> str:
    tag = tag.replace("_", " ")
    tag = _RE_SPACES.sub(" ", tag).strip().lower()
    return tag


def split_prompt(prompt: str) -> list[str]:
    """プロンプトを重複なしのタグ列に分解する (出現順を保つ)。"""
    if not prompt:
        return []
    text = _RE_EXTRA_NET.sub(",", prompt)
    # エスケープされた括弧 "\(" は名前の一部なので退避しておく
    text = text.replace("\\(", _ESC_OPEN).replace("\\)", _ESC_CLOSE)
    text = re.sub(r"\bBREAK\b|\bAND\b", ",", text)
    text = _RE_NAI_NUMERIC.sub(",", text).replace("::", ",")
    text = text.replace("|", ",")

    tags: list[str] = []
    seen: set[str] = set()
    for part in re.split(r"[,\n]", text):
        part = _RE_WEIGHT.sub("", part)
        part = re.sub(r"[()\[\]{}]", "", part)
        part = _RE_WEIGHT.sub("", part)
        part = part.replace(_ESC_OPEN, "(").replace(_ESC_CLOSE, ")")
        tag = normalize_tag(part)
        if tag and tag not in seen:
            seen.add(tag)
            tags.append(tag)
    return tags


def tags_for(meta: ImageMeta) -> list[tuple[str, str]]:
    """索引に入れる (kind, tag) の一覧を返す。"""
    result: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    def add(kind: str, tag: str) -> None:
        if tag and (kind, tag) not in seen:
            seen.add((kind, tag))
            result.append((kind, tag))

    prompts = [meta.prompt] + [c.get("prompt", "") for c in meta.characters]
    negatives = [meta.negative] + [c.get("negative", "") for c in meta.characters]
    for text in prompts:
        for tag in split_prompt(text):
            add("prompt", tag)
        for lora in extract_loras(text):
            add("lora", lora.lower())
    for char in meta.characters:
        for tag in split_prompt(char.get("prompt", "")):
            add("char", tag)
    for text in negatives:
        for tag in split_prompt(text):
            add("negative", tag)

    lora_hashes = meta.params.get("Lora hashes")
    if isinstance(lora_hashes, str):
        for item in lora_hashes.split(","):
            name = item.split(":")[0].strip()
            add("lora", name.lower())
    if meta.model:
        add("model", meta.model.lower())
    add("source", meta.source)
    return result
