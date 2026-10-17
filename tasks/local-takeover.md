# ローカルのセッションへの引き継ぎ

作成：2026-10-17（利用者の指示「作業環境をローカルに移すのでセッションに引き継ぐ命令を書いて」）

## 1. 利用者が PC で行うこと

```
git clone https://github.com/redbillyzeon-droid/test.git
cd test
git checkout claude/nifty-newton-3wjyv0
git pull origin claude/nifty-newton-3wjyv0
```

すでに clone してあるときは、`git fetch origin` のあと、上の `checkout` と `pull` だけでよい。そのフォルダで Claude Code を起動し、下の「2. 最初に貼る命令」を貼る。

- `CLAUDE.local.md`（commit と push の承認）は Git 管理外なので、PC には届かない。ローカルでも同じ承認を使うなら、利用者が自分で作り直す（クラウドの内容：「ブランチ `claude/nifty-newton-3wjyv0` への commit と push は、作業の区切りごとに確認なしで行ってよい。ほかのブランチへの push、公開、削除、外部への送信などは、これまでどおり毎回確認する」）。
- ティラノスクリプト本体は、ライセンスで再配布できないのでリポジトリに入っていない。PC のティラノビルダー、または公式サイトから入手したものを使う。

## 2. 最初に貼る命令

```
クラウドのセッションから、ゲーム「ロスト・アイランド ～転生したら無人島で、吸血鬼と妖怪と神獣と竜に囲まれていた～」の制作を引き継いでください。回答は日本語でお願いします。

ブランチは claude/nifty-newton-3wjyv0 です。まず次を読んでください。
- AGENTS.md と CLAUDE.md（共通ルール。役割ごとのサブエージェントは docs/game/team.md）
- tasks/local-takeover.md（このファイル。3章が残りの作業）
- tasks/handoff.md（これまでの経過）
- docs/game/plan.md の「決まったこと」の表

読んだら、いまの状態（git status、最新の commit、残りの作業）を短くまとめて報告し、3章の1から進めてください。
決まっていないことは、おすすめを示して私に確認してください。
push、公開、削除、外部への送信は、AGENTS.md のとおり毎回確認してください（CLAUDE.local.md に承認を書いた場合は、それに従ってください）。
```

## 3. 残りの作業（重要な順）

1. **試作の戦闘プログラムを仕上げる**（`game/tyrano-proto/`）
   - 2026-10-17 追記：プログラム担当の作業は終わった（最終版は commit `a38ea26` と同じ内容）。クラウドで `check_battle.js` 56/56、`check_adv.js` 14/14（担当の実行）、`test_nai_generate.py` 12/12 に合格。残りは、ティラノビルダーで動くかの確認と、下の解釈の確認。
   - 担当の解釈で、`battle.md` と照らして確かめたい点：道具は試作の仮の規則で自動に選ぶ／カバネの大技は直後の敵の番に効く／ハクレンの大技は主人公が倒れていると連携攻撃になる／全員で挑むときの幻影は好感度が低い2人の分。報酬の変数名 `item_ore`・`item_stone`・`item_scale`・`gift_white_flower` は推測。
   - `f.dev`、`f.final_retry_used`、`f.built_*` を `system.md` の変数表に足す。
   - 頼んであった内容：`docs/game/design/battle.md` 7章（設定の項目、計算の変更、決戦の割り込み、書き戻し、自動戦闘の判断）。加えて次の決定：
     - 全員倒れたら `f.battle_result = "wipe"` で .ks に戻り、「もう一度」と「タイトルに戻る」は .ks で分ける。
     - 島の発展度の変数名は `f.dev`。
     - 自動戦闘の守りの技は、敵の強い行動の予告が出たターンだけ（全員で挑むときは1人、カバネの骨の盾を優先）。
     - 決着で全員で挑むときは、「絆」を1回選べば5人の大技が順に出て、最後の1人で支配の力が0になる。
   - 確かめ方：ティラノスクリプト本体のフォルダに `game/tyrano-proto/data/` の中身をコピーし、`python -m http.server 8799` で公開して、`node game/tyrano-proto/tools/check_battle.js http://localhost:8799/index.html` と `check_adv.js` を実行する（Node.js と Playwright が要る。導入は利用者の承認を得てから）。
   - 通ったら、`docs/game/handoff-local-engine-check.md` の手順で、ティラノビルダーで動くかも確かめる（エンジンを決めるための作業）。
2. **`game/tools/nai_generate.py`**：済み（2026-10-17、テスト 12/12）。参照画像の API の項目名は要確認（`REFERENCE_KEYS`）。元の依頼：男性キャラ（主人公ユウ、GM など）のネガティブから `flat chest` を外す。V4.5 で V5 の絵を参照する引数を足す（API の項目名は要確認。既定は dry run のまま）。
3. **確認役のレビュー**：今日の変更（`design/battle.md`、`design/affection.md`、`system.md`、`battle-ui.md`、`script/`、`game/`）を `project-reviewer` に見てもらい、指摘を直す。
4. **区切りの評価**：試作が動く版になったら、評価役 `game-director-review` に全体を評価してもらう（本人の意見ではない物差し）。
5. **台本を .ks にする**：エンジンが決まってから。好感度のしくみは `docs/game/design/affection.md` 6-2 に、プログラムに頼むことがまとまっている。

## 4. 利用者の判断を待っていること

- カバネの本当の名前と、タトゥーの花の種類。
- カバネが数十年前から島にいて、GM の前のゲームを見てきたという設定（`characters.md`）。
- NovelAI の API を使うなら、API キーをどこに置くか（ローカルでは環境変数 `NOVELAI_API_KEY`。チャットには貼らない）。
- 素材（BGM・効果音）の入手方法と予算、声を入れるか（`docs/game/sound/`）。

## 5. 今日決まったこと（2026-10-17、おすすめを採用。くわしくは `docs/game/plan.md`）

- 決戦で全員倒れたら、その段階の最初からやり直せる（「もう一度」と「タイトルに戻る」）。
- 後半で選択肢が1つになるのは、判定値が2以下のとき。
- 発展度4以上なら、中盤で1回だけ言葉を選び直せる。
- 探索に相棒を1人誘える（+3。誘った人の「出会い」は出ない）。
- 森のぬしは7日目以降の「森-X2」。
- 真エンドは1周目から狙える（好感度のしくみを見直した。`design/affection.md`）。段階5に3人届く遊び方は止めない。
- 評価役 `game-director-review` を追加した。
