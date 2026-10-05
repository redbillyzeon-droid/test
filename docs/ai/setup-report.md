# Claude Code 環境設定の報告

実施日：2026-10-05　／　実施環境：Claude Code 2.1.289（クラウドのコンテナ、Linux、bash、Python 3.11.15、Node 22.22.0）

## 調べた結果

- 対象：`/home/user/test`（Git リポジトリ。aialbum のコードと ComfyUI の調査メモ `HANDOFF.md` がある）。ホーム直下や複数案件の親フォルダではない。
- 用途：混在（Python の開発、調査メモ、今後のゲーム開発）。
- 作業前の状態：未コミットの変更なし。CLAUDE.md、CLAUDE.local.md、AGENTS.md、AGENTS.override.md、`.claude/` はどれもなかった。上位のフォルダにも CLAUDE.md / AGENTS.md はなかった。ユーザー設定（`~/.claude/settings.json`）もなかった。
- Codex：このコンテナには入っていない（`codex` コマンドも `~/.codex` もない）。AGENTS.override.md の影響は確認していない。
- 仕様：2026-10-05 に公式資料（memory、settings、permissions、hooks、skills、sub-agents、sandboxing）を取得して確認した。

## 作成・変更したファイル

| ファイル | 内容 |
|---|---|
| `.gitignore`（変更） | 末尾に、個人用設定・バックアップ・ログ・`.env` の除外を追加。既存の行はそのまま |
| `AGENTS.md` | ツール共通のルール（49行）。正本 |
| `CLAUDE.md` | Claude 固有の入口。独立した行の `@AGENTS.md` で共通ルールを読み込む |
| `.claude/settings.json` | 秘密ファイルの Read / Edit 禁止と、Stop Hook の登録 |
| `.claude/rules/aialbum-code.md` | aialbum のコードを触るときだけ読むルール（`paths` 指定あり） |
| `.claude/rules/japanese-writing.md` | 文書を書くときだけ読むルール（`paths` 指定あり） |
| `.claude/skills/project-work/SKILL.md` | `/project-work`：依頼を1件進める手順 |
| `.claude/skills/project-check/SKILL.md` | `/project-check`：合格条件で検査して報告する手順 |
| `.claude/agents/project-reviewer.md` | 読み取り専用の確認役（tools：Read, Grep, Glob） |
| `.claude/hooks/check_ai_config.py` | AI用設定の構造検査（標準ライブラリだけを使う） |
| `.claude/hooks/tests/test_stop_hook.py` | Stop Hook の単体テスト（一時フォルダで実行） |
| `docs/ai/context.md`、`docs/ai/checks.md`、このファイル | 前提、合格条件、報告 |
| `tasks/active.md`、`tasks/handoff.md` | 作業の記録と引き継ぎのひな形 |
| `outputs/.gitkeep` | 成果物の置き場所 |

## 採用した構成

- 指示は「`CLAUDE.md` → `@AGENTS.md`」の1本だけ。公式資料によると、CLAUDE.md と AGENTS.md の両方があると、Claude は既定で CLAUDE.md だけを読む。そのため import が必要。import した AGENTS.md が二重に読まれることはない、とも書かれている。
- 詳しい資料（context、checks、tasks）は import しない。AGENTS.md に用途付きの参照先として載せた。
- Rules は `paths` 付きの2つだけ。常に読み込まれるルールは作っていない。
- Skills は2つとも `disable-model-invocation: true`。`allowed-tools` はないので、承認を省略しない。
- Stop Hook は、exec 形式の `python <script> --hook`、timeout 15 秒。

## 実行した検査と結果

| 検査 | 結果 |
|---|---|
| `python .claude/hooks/check_ai_config.py` | 成功（問題0件、注意0件） |
| `python .claude/hooks/tests/test_stop_hook.py` | 成功（8/8）：正常、異常（block と reason）、`stop_hook_active` での再ブロック防止、壊れた入力、循環の検出、Hook の重複の検出、stdin が閉じられない場合の自己終了（約3秒）、所要時間 |
| 実際の settings.json に登録したあとの Hook の直接実行 | 成功（出力なし、終了コード 0） |
| 登録処理の再実行（重複して登録されないか） | 成功（Stop は1件のまま） |
| aialbum の既存テスト（`python -m pytest`） | **未実行**。pytest、fastapi、pillow、numpy が入っておらず、パッケージの導入は今回の許可に含まれないため |
| 確認役サブエージェント `project-reviewer` | **独立レビュー未実施**。このセッションは定義を作る前に始まっていて読み込まれていなかった（`Agent type 'project-reviewer' not found`）。代わりに主担当が観点を変えて読み直した |
| 新しいセッションで設定が読み込まれるか | **未確認**（下の「利用者が確認すること」を参照） |

## 未適用・未確認の項目

- **YAML frontmatter**：決まった形の行を見る簡易検査だけ。YAML として正式には検証していない。
- **Windows での Hook**：`python` が PATH にある前提。Python が入っていないか、Microsoft Store の案内用の `python` しかない場合、Hook はエラーになる。ただし、ブロックしないエラーとして扱われる（公式資料による）。Windows での実行は確認していない。
- **Sandbox**：macOS、Linux、WSL2 で動く。ネイティブの Windows ではコマンドがサンドボックスなしで実行される（公式資料）。このコンテナには bubblewrap / socat がない。有効にしていない。
- **保護の限界**：Read / Edit の禁止は Claude のファイル用ツールに効く。Bash などのシェル処理を完全には防げない。Sandbox も、守るのはシェルコマンドだけ。Hooks や MCP サーバーは Sandbox の外で動く。`.gitignore` や CLAUDE.md には、アクセスを防ぐ働きはない。
- **過剰な権限**：今回の設定ファイルにはない（bypassPermissions も、Bash の全面許可も使っていない）。
- **MCP**：追加していない。必要になったら、用途、権限、接続先、送るデータを確かめてから提案する。
- **別セッションの「AI社員」（役割別エージェント）**：設定の中身が見えないため、移していない。

## 利用者が確認すること（新しいセッションで）

1. `/memory`：CLAUDE.md と、そこから読み込まれる AGENTS.md が表示される。
2. `/context`：指示が読み込まれていて、量が多すぎない。
3. `/hooks`：Stop に `python … check_ai_config.py --hook` が1件ある。
4. `/agents`：`project-reviewer` があり、使える道具が Read、Grep、Glob だけ。
5. `/permissions`：`Read(./.env)` などが禁止に表示される。
6. `/` を入力すると、`project-work` と `project-check` が出てくる。
7. Windows の PC では、`python --version` が 3.10 以上を表示する（Hook と aialbum の両方に必要）。

## 今回の変更だけを元に戻す手順

`git reset --hard` と `git clean` は使わないでください。

1. `.gitignore`：`.claude/backups/setup-20261005/.gitignore.orig` に変更前のファイルがあります。これを `.gitignore` にコピーして戻します（または、末尾に追加した空行1行と、「# Claude Code:」から始まる10行を消します）。
2. 新しく作ったファイルを消します。消すのは上の表にあるファイルだけです。コマンドの例：
   ```bash
   rm AGENTS.md CLAUDE.md docs/ai/context.md docs/ai/checks.md docs/ai/setup-report.md \
      tasks/active.md tasks/handoff.md outputs/.gitkeep \
      .claude/settings.json .claude/rules/aialbum-code.md .claude/rules/japanese-writing.md \
      .claude/skills/project-work/SKILL.md .claude/skills/project-check/SKILL.md \
      .claude/agents/project-reviewer.md .claude/hooks/check_ai_config.py \
      .claude/hooks/tests/test_stop_hook.py
   ```
   消したあとに空になったフォルダは、残っていても動きに影響はありません。
