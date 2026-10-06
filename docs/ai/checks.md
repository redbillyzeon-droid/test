# 作業別の合格条件と検査

検査を実行したら、結果（成功・失敗・未実行）を `tasks/active.md` の「検証の証拠」に書きます。

## 共通

- [ ] 依頼された範囲だけが変わっている（`git status` と `git diff` で確認）。
- [ ] 依頼外のファイルを変更・削除・移動していない。
- [ ] 実行していない検査を「確認済み」と書いていない。

## AI用の設定（AGENTS.md、CLAUDE.md、.claude/ 配下）

```bash
python .claude/hooks/check_ai_config.py
python .claude/hooks/tests/test_stop_hook.py
```

- 1つ目は、JSON の構文、必須ファイル、`@` で読み込むファイルの有無、循環、Hook の重複を調べる。
- 2つ目は、Stop Hook の動き（正常、異常、再ブロックしない、タイムアウト）を、一時フォルダの中で試す。実際の設定は変えない。
- YAML frontmatter は、決まった形の行だけを簡易的に調べる。YAML として正式に検証はしていない。

手動で確認すること（新しいセッションで）：

- `/memory`：CLAUDE.md と AGENTS.md が読み込まれている。
- `/context`：読み込まれた指示の量が多すぎない。
- `/hooks`：Stop Hook が1件だけ登録されている。
- `/agents`：`project-reviewer` が表示され、使える道具が Read、Grep、Glob だけになっている。
- `/permissions`：`.env` などの読み取り・編集の禁止が表示されている。
- `/` メニュー：`project-work` と `project-check` が表示される。

## aialbum（Python のコード）

```bash
python -m pip install -r requirements-dev.txt   # 依存の導入。利用者の承認を得てから
python -m pytest
```

- [ ] テストがすべて通る。
- [ ] 索引の作り方を変えたときは、README の注意（`~/.aialbum/index.sqlite3` を作り直すとマイタグも消える）を利用者に伝えた。
- [ ] 画面（`aialbum/static/`）を変えたときは、ブラウザで表示を確認した。確認できなかったときは「未確認」と書いた。

## 文章（docs/、tasks/、README.md、HANDOFF.md、outputs/）

- [ ] 普通の日本語で、具体的に書いている。不要な比喩や宣伝文句がない。
- [ ] 数字、日付、出典、ライセンスは元の資料で確かめた。確かめていないものは「要確認」と書いた。

## ゲーム開発（`docs/game/`）

- [ ] 台本と設定が、`docs/game/plan.md` の「決まったこと」と食い違っていない。
- [ ] キャラクターの口調・一人称・呼び方が `docs/game/characters.md` と合っている。
- [ ] ヒロインは全員、成人として描かれている。
- [ ] 好感度などの数字を変えたときは、`docs/game/outline.md` も直した。
- [ ] `.ks` ファイルは、PC のティラノビルダーで読み込んで動かすまで「ティラノビルダーでは未確認」と書く。
- [ ] 戦闘画面の試作（`game/tyrano-proto/`）を変えたら、ティラノスクリプト本体に重ねて `node game/tyrano-proto/tools/check_battle.js <URL>` を実行する（本体はリポジトリに入れない。利用規約で再配布が禁止されている）。
