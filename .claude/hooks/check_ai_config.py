"""AI用設定ファイルの構造検査（追加のパッケージ不要）。

対象はこのリポジトリの AI 用設定だけです。プロジェクト全体は走査しません。
  - AGENTS.md / CLAUDE.md と、そこから @ で読み込むファイル（存在、循環、重複）
  - .claude/settings.json / .claude/settings.local.json（JSON 構文、Hook の重複登録）
  - .claude/skills/*/SKILL.md、.claude/agents/*.md、.claude/rules/**/*.md（frontmatter の簡易検査）
  - docs/ai/、tasks/ の必須ファイル

使い方:
  python .claude/hooks/check_ai_config.py          結果を表示（問題があれば終了コード 1）
  python .claude/hooks/check_ai_config.py --hook   Stop Hook 用（stdin の JSON を読み、問題があれば decision: block を返す）

YAML は正式には解析しません。決まった形の行だけを見る簡易検査です。
"""

from __future__ import annotations

import json
import os
import re
import sys
import threading
from pathlib import Path

ROOT = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path(__file__).resolve().parents[2]).resolve()

REQUIRED_FILES = [
    "AGENTS.md",
    "CLAUDE.md",
    ".claude/settings.json",
    ".claude/skills/project-work/SKILL.md",
    ".claude/skills/project-check/SKILL.md",
    ".claude/agents/project-reviewer.md",
    "docs/ai/context.md",
    "docs/ai/checks.md",
    "docs/ai/setup-report.md",
    "tasks/active.md",
    "tasks/handoff.md",
]
SETTINGS_FILES = [".claude/settings.json", ".claude/settings.local.json"]
ENTRY_FILES = ["CLAUDE.md", "AGENTS.md"]
REVIEWER_ALLOWED_TOOLS = {"Read", "Grep", "Glob"}
AGENTS_MAX_LINES = 100
MAX_IMPORT_DEPTH = 4  # 公式資料の「最大4段」に合わせる
MAX_FILES_PER_DIR = 200  # 想定外に大きいフォルダを読まないための上限
STDIN_WAIT_SECONDS = 3.0

IMPORT_RE = re.compile(r"(?<![\w`])@((?:[^\s`\\]|\\ )+)")
FENCE_RE = re.compile(r"^\s*(```|~~~)")
CODE_SPAN_RE = re.compile(r"`[^`]*`")


def rel(path: Path) -> str:
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return str(path)


def find_imports(text: str) -> list[str]:
    """Markdown のコードブロックとコードスパンを除いて @path を集める。"""
    found: list[str] = []
    in_fence = False
    for line in text.splitlines():
        if FENCE_RE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        line = CODE_SPAN_RE.sub("", line)
        for m in IMPORT_RE.finditer(line):
            target = m.group(1).replace("\\ ", " ").rstrip(".,;:)」）")
            # メールアドレスや @ だけの文字列は読み込みではないので除く
            if "/" in target or "." in target:
                found.append(target)
    return found


def check_imports(errors: list[str], warnings: list[str]) -> None:
    seen_from: dict[Path, str] = {}

    def walk(path: Path, chain: list[Path]) -> None:
        if len(chain) > MAX_IMPORT_DEPTH + 1:
            warnings.append(f"@ の読み込みが {MAX_IMPORT_DEPTH} 段を超えています: {' -> '.join(rel(p) for p in chain)}")
            return
        try:
            text = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError) as e:
            errors.append(f"{rel(path)} を読めません: {e.__class__.__name__}")
            return
        for target in find_imports(text):
            dest = (Path(target).expanduser() if target.startswith("~") else (path.parent / target)).resolve()
            if dest in chain:
                errors.append(f"@ の読み込みが循環しています: {' -> '.join(rel(p) for p in chain + [dest])}")
                continue
            if not dest.is_file():
                errors.append(f"{rel(path)} の @{target} が見つかりません")
                continue
            if dest in seen_from:
                warnings.append(f"{rel(dest)} が2か所から読み込まれています（{seen_from[dest]} と {rel(path)}）")
                continue
            seen_from[dest] = rel(path)
            walk(dest, chain + [dest])

    for name in ENTRY_FILES:
        p = ROOT / name
        if p.is_file() and p.resolve() not in seen_from:
            walk(p.resolve(), [p.resolve()])

    claude = ROOT / "CLAUDE.md"
    if claude.is_file() and (ROOT / "AGENTS.md").is_file():
        if "AGENTS.md" not in [Path(t).name for t in find_imports(claude.read_text(encoding="utf-8"))]:
            errors.append("CLAUDE.md が AGENTS.md を @ で読み込んでいません（両方あるとき、Claude は既定で CLAUDE.md だけを読みます）")


def check_agents_length(warnings: list[str]) -> None:
    p = ROOT / "AGENTS.md"
    if p.is_file():
        n = len(p.read_text(encoding="utf-8").splitlines())
        if n > AGENTS_MAX_LINES:
            warnings.append(f"AGENTS.md が {n} 行あります（目安は {AGENTS_MAX_LINES} 行以内）")


def hook_signature(handler: dict) -> str:
    return json.dumps(
        {k: handler.get(k) for k in ("type", "command", "args", "url", "prompt", "shell")},
        sort_keys=True,
        ensure_ascii=False,
    )


def check_settings(errors: list[str], warnings: list[str]) -> None:
    for name in SETTINGS_FILES:
        p = ROOT / name
        if not p.is_file():
            continue
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as e:
            # 内容を表示しない（秘密を含む可能性があるため）。位置だけ示す
            where = f"{e.lineno} 行目" if isinstance(e, json.JSONDecodeError) else e.__class__.__name__
            errors.append(f"{name} の JSON が壊れています（{where}）")
            continue
        if not isinstance(data, dict):
            errors.append(f"{name} の最上位がオブジェクトではありません")
            continue
        perms = data.get("permissions", {})
        if isinstance(perms, dict):
            if perms.get("defaultMode") == "bypassPermissions":
                warnings.append(f"{name}: defaultMode が bypassPermissions です")
            for rule in perms.get("allow", []) or []:
                if rule in ("Bash", "Bash(*)", "Bash(**)"):
                    warnings.append(f"{name}: Bash を全面的に許可しています（{rule}）")
        hooks = data.get("hooks", {})
        if not isinstance(hooks, dict):
            errors.append(f"{name}: hooks がオブジェクトではありません")
            continue
        for event, groups in hooks.items():
            if not isinstance(groups, list):
                errors.append(f"{name}: hooks.{event} が配列ではありません")
                continue
            seen: set[tuple[str, str]] = set()
            for group in groups:
                if not isinstance(group, dict) or not isinstance(group.get("hooks"), list):
                    errors.append(f"{name}: hooks.{event} の要素に hooks 配列がありません")
                    continue
                for handler in group["hooks"]:
                    if not isinstance(handler, dict) or "type" not in handler:
                        errors.append(f"{name}: hooks.{event} に type のない Hook があります")
                        continue
                    key = (str(group.get("matcher", "")), hook_signature(handler))
                    if key in seen:
                        errors.append(f"{name}: hooks.{event} に同じ Hook が重複して登録されています")
                    seen.add(key)


def read_frontmatter(path: Path) -> dict[str, str] | None:
    """先頭の --- で囲まれた部分から、「キー: 値」の行と、リストの有無だけを読む。"""
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    fields: dict[str, str] = {}
    current = None
    for line in lines[1:]:
        if line.strip() == "---":
            return fields
        m = re.match(r"^([A-Za-z_][\w-]*):\s*(.*)$", line)
        if m:
            current = m.group(1)
            fields[current] = m.group(2).strip()
        elif current and re.match(r"^\s+-\s+\S", line):
            fields[current] = (fields[current] + " " + line.strip()).strip()
    return None  # 閉じの --- がない


def limited_glob(base: Path, pattern: str) -> list[Path]:
    if not base.is_dir():
        return []
    out = []
    for p in base.glob(pattern):
        out.append(p)
        if len(out) >= MAX_FILES_PER_DIR:
            break
    return sorted(out)


def check_frontmatter(errors: list[str], warnings: list[str]) -> None:
    skill_names: dict[str, str] = {}
    for p in limited_glob(ROOT / ".claude/skills", "*/SKILL.md"):
        fm = read_frontmatter(p)
        if fm is None:
            errors.append(f"{rel(p)}: frontmatter（--- で囲んだ部分）がないか閉じていません")
            continue
        for key in ("name", "description"):
            if not fm.get(key):
                errors.append(f"{rel(p)}: {key} がありません")
        name = fm.get("name", "")
        if name and name in skill_names:
            errors.append(f"{rel(p)}: name「{name}」が {skill_names[name]} と重複しています")
        skill_names[name] = rel(p)
        if p.parent.name in ("project-work", "project-check"):
            if fm.get("disable-model-invocation", "").lower() != "true":
                errors.append(f"{rel(p)}: disable-model-invocation: true がありません")
            if "allowed-tools" in fm:
                warnings.append(f"{rel(p)}: allowed-tools があります。承認を省略する範囲を確認してください")

    agent_names: dict[str, str] = {}
    for p in limited_glob(ROOT / ".claude/agents", "*.md"):
        fm = read_frontmatter(p)
        if fm is None:
            errors.append(f"{rel(p)}: frontmatter がないか閉じていません")
            continue
        for key in ("name", "description"):
            if not fm.get(key):
                errors.append(f"{rel(p)}: {key} がありません")
        name = fm.get("name", "")
        if ":" in name:
            errors.append(f"{rel(p)}: name に「:」は使えません")
        if name and name in agent_names:
            errors.append(f"{rel(p)}: name「{name}」が {agent_names[name]} と重複しています")
        agent_names[name] = rel(p)
        if name == "project-reviewer":
            tools = {t.strip(" -[]'\"") for t in re.split(r"[,\s]+", fm.get("tools", "")) if t.strip(" -[]'\"")}
            if not tools:
                errors.append(f"{rel(p)}: tools がありません（省略すると全ツールを引き継ぎます）")
            elif not tools <= REVIEWER_ALLOWED_TOOLS:
                errors.append(f"{rel(p)}: tools に読み取り以外のツールがあります: {', '.join(sorted(tools - REVIEWER_ALLOWED_TOOLS))}")

    for p in limited_glob(ROOT / ".claude/rules", "**/*.md"):
        text = p.read_text(encoding="utf-8")
        if text.startswith("---"):
            fm = read_frontmatter(p)
            if fm is None:
                errors.append(f"{rel(p)}: frontmatter が閉じていません")
            elif "paths" not in fm:
                warnings.append(f"{rel(p)}: paths がないため、常に読み込まれます")
        else:
            warnings.append(f"{rel(p)}: paths がないため、常に読み込まれます")


def run_checks() -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    for name in REQUIRED_FILES:
        if not (ROOT / name).is_file():
            errors.append(f"必須ファイルがありません: {name}")
    check_settings(errors, warnings)
    check_imports(errors, warnings)
    check_agents_length(warnings)
    check_frontmatter(errors, warnings)
    return errors, warnings


def read_stdin_with_timeout(seconds: float) -> str | None:
    """stdin が閉じられないときに Hook が止まり続けないよう、待つ時間に上限を付ける。"""
    box: list[str] = []

    def reader() -> None:
        try:
            box.append(sys.stdin.buffer.read().decode("utf-8", "replace"))
        except Exception:
            box.append("")

    t = threading.Thread(target=reader, daemon=True)
    t.start()
    t.join(seconds)
    return box[0] if box else None


def hook_main() -> int:
    raw = read_stdin_with_timeout(STDIN_WAIT_SECONDS)
    if raw is None:
        print("check_ai_config: stdin を読めなかったため、検査を省略しました", file=sys.stderr)
        return 0
    try:
        payload = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError:
        print("check_ai_config: stdin が JSON ではないため、検査を省略しました", file=sys.stderr)
        return 0
    if isinstance(payload, dict) and payload.get("stop_hook_active") is True:
        # Stop Hook によってすでに続行中。再びブロックすると止まらなくなるので、何もしない
        return 0
    errors, _ = run_checks()
    if errors:
        reason = "AI用設定の構造検査（.claude/hooks/check_ai_config.py）で問題が見つかりました。直すか、直せない理由を利用者に伝えてください:\n- " + "\n- ".join(errors)
        print(json.dumps({"decision": "block", "reason": reason}, ensure_ascii=False))
    return 0


def cli_main() -> int:
    errors, warnings = run_checks()
    print(f"対象: {ROOT}")
    for e in errors:
        print(f"[NG] {e}")
    for w in warnings:
        print(f"[注意] {w}")
    print("[未検証] YAML frontmatter は簡易検査のみ（YAML として正式には解析していません）")
    if errors:
        print(f"結果: 不合格（問題 {len(errors)} 件、注意 {len(warnings)} 件）")
        return 1
    print(f"結果: 合格（注意 {len(warnings)} 件）")
    return 0


if __name__ == "__main__":
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
    code = hook_main() if "--hook" in sys.argv[1:] else cli_main()
    sys.stdout.flush()
    sys.stderr.flush()
    # stdin を読むスレッドが残っていても終了処理で止まらないよう、os._exit で終える
    os._exit(code)
