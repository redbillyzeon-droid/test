"""検索クエリの解析と SQL の組み立て。

書き方 (カンマ区切りで AND):
    1girl, long hair          タグをすべて含む
    -nsfw                     除外
    blue eyes | red eyes      どれかを含む (OR)
    *hair                     ワイルドカード
    lora:xxx  model:xxx  neg:xxx  char:xxx  source:novelai
    my:お気に入り               自分で付けたタグ
    folder:xxx                フォルダ名の一部
    seed:12345
    "文字列"                    プロンプトやファイル名の部分一致
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .tags import normalize_tag

TAG_KINDS = {
    "prompt": "prompt",
    "neg": "negative",
    "negative": "negative",
    "lora": "lora",
    "model": "model",
    "char": "char",
    "source": "source",
    "src": "source",
}

PROMPT_KINDS = {"prompt", "negative", "char"}

SORTS = {
    "mtime": "i.mtime",
    "name": "i.name COLLATE NOCASE",
    "seed": "i.seed",
    "steps": "i.steps",
    "pixels": "(i.width * i.height)",
    "tags": "i.tag_count",
    "model": "i.model COLLATE NOCASE",
    "folder": "i.folder COLLATE NOCASE, i.name COLLATE NOCASE",
    # ページをまたいでも順番が変わらないよう、シード付きの疑似乱数で並べる
    "random": "((i.id * 2654435761 + {seed}) % 4294967291)",
}


@dataclass
class Condition:
    sql: str
    params: list[Any]


def _like(value: str) -> str:
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return escaped.replace("*", "%")


def _term(term: str) -> Condition | None:
    term = term.strip()
    if not term:
        return None
    if len(term) >= 2 and term[0] == '"' and term[-1] == '"':
        pattern = "%" + _like(term[1:-1]) + "%"
        return Condition(
            "(i.prompt LIKE ? ESCAPE '\\' OR i.name LIKE ? ESCAPE '\\' OR i.meta_json LIKE ? ESCAPE '\\')",
            [pattern, pattern, pattern],
        )

    prefix, sep, rest = term.partition(":")
    prefix = prefix.strip().lower()
    if sep and prefix in ("my", "user", "fav"):
        return Condition(
            "i.fingerprint IN (SELECT fingerprint FROM user_tags WHERE tag = ?)", [rest.strip()]
        )
    if sep and prefix == "folder":
        return Condition("i.folder LIKE ? ESCAPE '\\'", ["%" + _like(rest.strip()) + "%"])
    if sep and prefix == "seed":
        try:
            return Condition("i.seed = ?", [int(rest.strip())])
        except ValueError:
            return Condition("0", [])

    kind = "prompt"
    value = term
    if sep and prefix in TAG_KINDS:
        kind = TAG_KINDS[prefix]
        value = rest
    # LoRA / モデル名はファイル名なので "_" をそのまま残す
    value = normalize_tag(value) if kind in PROMPT_KINDS else value.strip().lower()
    if "*" in value:
        return Condition(
            "i.id IN (SELECT image_id FROM tags WHERE kind = ? AND tag LIKE ? ESCAPE '\\')",
            [kind, _like(value)],
        )
    return Condition("i.id IN (SELECT image_id FROM tags WHERE kind = ? AND tag = ?)", [kind, value])


def build_where(query: str, folder: str | None = None) -> Condition:
    parts: list[str] = []
    params: list[Any] = []
    for raw in (query or "").split(","):
        raw = raw.strip()
        if not raw:
            continue
        negate = raw.startswith("-") and len(raw) > 1
        if negate:
            raw = raw[1:]
        alternatives = [c for c in (_term(t) for t in raw.split("|")) if c]
        if not alternatives:
            continue
        sql = " OR ".join(c.sql for c in alternatives)
        sql = f"({sql})"
        if negate:
            sql = f"NOT {sql}"
        parts.append(sql)
        for c in alternatives:
            params.extend(c.params)
    if folder:
        parts.append("i.folder = ?")
        params.append(folder)
    return Condition(" AND ".join(parts) if parts else "1", params)


def order_by(sort: str, order: str, seed: int = 0) -> str:
    column = SORTS.get(sort, SORTS["mtime"])
    if sort == "random":
        return column.format(seed=int(seed) % 1000003)
    direction = "ASC" if order == "asc" else "DESC"
    return ", ".join(f"{c.strip()} {direction}" for c in column.split(",")) + f", i.id {direction}"
