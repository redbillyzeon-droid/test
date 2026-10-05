# CLAUDE.md

共通ルールの正本は AGENTS.md です（下の行で読み込みます）。

@AGENTS.md

## Claude Code 固有

- 作業を始めるときは `/project-work <依頼内容>`、仕上がりを確かめるときは `/project-check <対象>` を使える。どちらも利用者が明示的に呼び出す。
- 作成者とは別の視点で確認したいときは、読み取り専用のサブエージェント `project-reviewer` に、合格条件・差分・元資料を渡す。テストは主担当が実行し、結果を渡す。
- 終了時に Stop Hook が `.claude/hooks/check_ai_config.py` を実行し、AI用設定の構造だけを検査する。成果物そのものの品質はこの Hook では判定しない。
- 個人的な指示は `CLAUDE.local.md`（Git 管理外）に書く。
