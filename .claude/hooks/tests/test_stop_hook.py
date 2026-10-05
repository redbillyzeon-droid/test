"""check_ai_config.py の Stop Hook としての動きを試す（追加のパッケージ不要）。

実際の設定は変えず、一時フォルダにコピーした設定で試します。
  python .claude/hooks/tests/test_stop_hook.py
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCRIPT = ROOT / ".claude/hooks/check_ai_config.py"
COPY = [
    "AGENTS.md",
    "CLAUDE.md",
    ".claude/settings.json",
    ".claude/skills",
    ".claude/agents",
    ".claude/rules",
    "docs/ai",
    "tasks",
]
HOOK_TIMEOUT = 15  # settings.json の timeout と同じ値


def make_project(tmp: Path) -> Path:
    proj = tmp / "proj"
    for name in COPY:
        src, dst = ROOT / name, proj / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)
    return proj


def run_hook(proj: Path, stdin: str | None, keep_stdin_open: bool = False) -> tuple[int, str, str, float]:
    env = dict(os.environ, CLAUDE_PROJECT_DIR=str(proj))
    start = time.monotonic()
    p = subprocess.Popen(
        [sys.executable, str(SCRIPT), "--hook"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    if keep_stdin_open:
        # stdin を閉じずに、Hook が自分の待ち時間の上限で終わるかを見る
        try:
            p.wait(timeout=HOOK_TIMEOUT)
        except subprocess.TimeoutExpired:
            p.kill()
            p.wait()
        out, err = p.stdout.read(), p.stderr.read()
        p.stdin.close()
    else:
        out, err = p.communicate((stdin or "").encode("utf-8"), timeout=HOOK_TIMEOUT)
    return p.returncode, out.decode("utf-8"), err.decode("utf-8"), time.monotonic() - start


def stop_input(active: bool) -> str:
    return json.dumps(
        {
            "session_id": "dummy",
            "transcript_path": "/dev/null",
            "cwd": "/dummy",
            "permission_mode": "default",
            "hook_event_name": "Stop",
            "stop_hook_active": active,
            "last_assistant_message": "テスト",
            "background_tasks": [],
            "session_crons": [],
        }
    )


def main() -> int:
    results: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str = "") -> None:
        results.append((name, ok, detail))

    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)

        proj = make_project(tmp / "ok")
        code, out, err, sec = run_hook(proj, stop_input(False))
        check("正常: 問題なしなら出力なしで終了コード 0", code == 0 and out.strip() == "", f"code={code} out={out!r}")

        bad = make_project(tmp / "bad")
        (bad / ".claude/settings.json").write_text("{ broken", encoding="utf-8")
        (bad / "CLAUDE.md").write_text("# x\n\n@missing.md\n", encoding="utf-8")
        code, out, err, sec = run_hook(bad, stop_input(False))
        try:
            decision = json.loads(out)
        except json.JSONDecodeError:
            decision = {}
        check(
            "異常: 問題ありなら decision: block と具体的な reason",
            code == 0
            and decision.get("decision") == "block"
            and "settings.json" in decision.get("reason", "")
            and "missing.md" in decision.get("reason", ""),
            f"code={code} out={out[:200]!r}",
        )

        code, out, err, sec = run_hook(bad, stop_input(True))
        check("再ブロック防止: stop_hook_active が true なら何も返さない", code == 0 and out.strip() == "", f"code={code} out={out!r}")

        code, out, err, sec = run_hook(proj, "not json")
        check("壊れた入力: JSON でない stdin ではブロックしない", code == 0 and out.strip() == "", f"code={code} out={out!r}")

        cyc = make_project(tmp / "cycle")
        (cyc / "AGENTS.md").write_text((cyc / "AGENTS.md").read_text(encoding="utf-8") + "\n@CLAUDE.md\n", encoding="utf-8")
        code, out, err, sec = run_hook(cyc, stop_input(False))
        check("循環: AGENTS.md と CLAUDE.md の相互読み込みを検出", "循環" in out, f"out={out[:200]!r}")

        dup = make_project(tmp / "dup")
        s = json.loads((dup / ".claude/settings.json").read_text(encoding="utf-8"))
        h = {"type": "command", "command": "python", "args": ["x.py"]}
        s["hooks"] = {"Stop": [{"hooks": [h]}, {"hooks": [h]}]}
        (dup / ".claude/settings.json").write_text(json.dumps(s), encoding="utf-8")
        code, out, err, sec = run_hook(dup, stop_input(False))
        check("重複: 同じ Hook の二重登録を検出", "重複" in out, f"out={out[:200]!r}")

        code, out, err, sec = run_hook(proj, None, keep_stdin_open=True)
        check(
            f"タイムアウト: stdin が閉じられなくても {HOOK_TIMEOUT} 秒以内に自分で終わり、ブロックしない",
            code == 0 and out.strip() == "" and sec < HOOK_TIMEOUT,
            f"code={code} sec={sec:.1f}",
        )

        code, out, err, sec = run_hook(proj, stop_input(False))
        check("所要時間: 正常時は 3 秒未満", sec < 3, f"sec={sec:.2f}")

    failed = 0
    for name, ok, detail in results:
        print(f"[{'OK' if ok else 'NG'}] {name}" + ("" if ok else f"  ({detail})"))
        failed += not ok
    print(f"結果: {len(results) - failed}/{len(results)} 合格")
    return 1 if failed else 0


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    sys.exit(main())
