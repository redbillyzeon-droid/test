# 使っている素材とライセンス

作成：2026-10-16。素材を足したら、ここに書き足す。発売するときは、ゲームの中（スタッフロールや readme）にも同じ内容を入れる。

## フォント

| フォント | 使う場所 | ライセンス | 入手元 | ライセンス文 |
|---|---|---|---|---|
| Dela Gothic One | 見出し（日付、名前の札、ボタン） | SIL Open Font License 1.1 | google/fonts（`ofl/delagothicone`） | `game/tyrano-proto/data/others/adv_ui/fonts/DelaGothicOne-OFL.txt` |
| Zen Kaku Gothic New（Medium、Bold） | 本文（会話の文） | SIL Open Font License 1.1 | google/fonts（`ofl/zenkakugothicnew`） | `game/tyrano-proto/data/others/adv_ui/fonts/ZenKakuGothicNew-OFL.txt` |

SIL Open Font License 1.1 の主な条件（ライセンス文の要約。正式な条件はライセンス文を見ること）：

- 商用の作品に同梱して配布できる。
- フォントを配布するときは、著作権表示とライセンス文を一緒に入れる。
- フォントのファイルだけを単体で売ることはできない。

## エンジン

| ソフト | ライセンス | 注意 |
|---|---|---|
| ティラノスクリプト | 独自の利用規約（無料、商用利用可） | 本体の再配布は禁止（作品として配布するのは可）。リポジトリには入れていない |

## 音楽・効果音

まだ決まっていない。候補と一覧は `docs/game/sound/`（音楽・効果音担当が作る）。

## 絵

NovelAI で作る予定（未生成）。商用で使えるかは要確認（`docs/game/plan.md`）。

画面の部品（印、素材・道具・施設のアイコン、天気の印）は、図形（SVG か CSS）で自作する予定（2026-10-17 の案。`docs/game/menu-ui.md` 8章）。外部の素材は使わない予定。もし外部のアイコン素材を使うことになったら、商用で使えるか・表記が要るかを確かめて、ここに書き足す。

- 新しい画面（`menu-ui.md`）のフォントは、上の組み合わせ A の2書体だけを使う。新しいフォントは足していない。
- 2026-10-17 追加の部品（好物つきの印、好物のアイコン5つ、「初めて」の札、「？」の枠、「ゆかり」の札、「渡した」の札、「誰と建てる？」の選んだ印）も、図形で自作する予定。外部の素材は使わない。
- 2026-10-17 追加の拠点の背景3枚（`bg_base_dev0`・`bg_base_dev2`・`bg_base_dev4`）は NovelAI で作る予定（未生成）。ほかの NovelAI の絵と同じく、商用で使えるか・販売サイトでの扱いは要確認。
- Dela Gothic One に、メニューで使う漢字（「鍛」「鱗」「錠」など）がすべて入っているかは要確認。入っていない字は Zen Kaku Gothic New で表示する。
