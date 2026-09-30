# AI Image Album

Stable Diffusion WebUI (Forge / Forge Neo / A1111) と NovelAI で作った画像を、**画像に埋め込まれたプロンプトをタグとして**検索・並べ替えできるアルバムです。
Python で動くローカルのWebアプリで、画面はブラウザに表示されます。画像がインターネットに送られることはありません。

## できること

- **読める形式**
  - Forge / Forge Neo / A1111: PNG の `parameters`、JPEG / WebP の EXIF
  - NovelAI: PNG の `Comment` (V4 / V4.5 のキャラクター別プロンプトと位置も表示)
  - ステルス pnginfo (アルファ / RGB の最下位ビットに隠された情報)
- **タグ検索**: 入力補完つき。含む / 除外 / どれか (OR) / ワイルドカード
- **絞り込み**: 使用回数の多いタグ一覧から、クリックで絞り込み・右クリックで除外。プロンプト / キャラ / LoRA / モデル / 生成元 / ネガティブ別
- **並べ替え**: 更新日時、ファイル名、フォルダ、モデル、Seed、Steps、画像サイズ、タグ数、ランダム
- **閲覧**: サムネイル一覧 (大きさ調整可、無限スクロール)、拡大表示 (← → で移動)、プロンプトのコピー
- **整理**: お気に入り (★ / F キー)、自分で付けるタグ (マイタグ)、複数選択 (Ctrl / Shift クリック) して移動・コピー
  - マイタグはファイルの内容で覚えているので、移動してもリネームしても消えません
- **CSV 出力**: 表示中の検索結果を Excel で開ける CSV に保存
- **差分読み込み**: 2回目以降は、追加・変更・削除されたファイルだけを読み直します

## 使い方 (Windows)

1. [Python 3.10 以上](https://www.python.org/downloads/) をインストールする (「Add python.exe to PATH」にチェック)
2. このフォルダの `run.bat` をダブルクリックする
   - 初回だけ、必要なものを自動でインストールします
   - ブラウザで `http://127.0.0.1:8765/` が開きます
3. 左の「フォルダ」欄に画像フォルダのパスを貼り付けて「追加」する
   - Forge Neo: `(Forge Neo のフォルダ)\outputs`
   - NovelAI: ダウンロードした画像の保存フォルダ

コマンドで起動する場合:

```bat
python -m pip install -r requirements.txt
python -m aialbum --add "D:\forge-neo\outputs" --add "D:\NovelAI"
```

| オプション | 説明 |
|---|---|
| `--add フォルダ` | 画像フォルダを登録する (複数指定可) |
| `--port 8765` | ポート番号 |
| `--no-browser` | 起動時にブラウザを開かない |
| `--stealth auto/always/never` | ステルス pnginfo の読み取り。`auto` は通常の情報が無い画像だけ調べる |
| `--data-dir パス` | 索引とサムネイルの保存先 (既定: `ユーザーフォルダ\.aialbum`、環境変数 `AIALBUM_DATA_DIR` でも指定可) |
| `--thumb-size 384` | サムネイルの大きさ (px) |

## 検索の書き方

検索欄に入力して Enter (または候補を選択) すると、条件が1つずつ追加されます。条件はすべて AND です。
条件をクリックすると「含む」と「除外」が切り替わります。

| 書き方 | 意味 |
|---|---|
| `long hair` | タグを含む (`long_hair` と書いても同じ) |
| `-nsfw` | タグを含まない |
| `blue eyes \| red eyes` | どれかを含む |
| `*hair` | ワイルドカード |
| `char:kimono` | NovelAI のキャラクタープロンプトに含む |
| `lora:detail_tweaker` | LoRA |
| `model:animagine*` | モデル名 |
| `neg:lowres` | ネガティブプロンプト |
| `source:novelai` / `source:a1111` | 生成元 |
| `my:お気に入り` | 自分で付けたタグ |
| `folder:2026-09` | フォルダ名の一部 |
| `seed:12345` | Seed |
| `"spy x family"` | プロンプトやファイル名に含まれる文字列 |

タグは次のように整えてから索引に入れます。

- `(tag:1.2)` `[tag]` `{{tag}}` `1.5::tag::` などの強調は外す
- `\(` `\)` はタグ名の一部として残す (例: `yor briar (spy x family)`)
- `<lora:name:0.8>` は LoRA として別扱い
- `BREAK` / `AND` / 改行も区切りとして扱う
- 小文字にそろえ、`_` は空白にそろえる

## 自分で改造するとき

| ファイル | 内容 |
|---|---|
| `aialbum/metadata.py` | 画像からの生成情報の読み取り。新しい形式 (ComfyUI など) はここに追加 |
| `aialbum/tags.py` | プロンプトをタグに分解するルール |
| `aialbum/search.py` | 検索の書き方と並べ替え |
| `aialbum/db.py` | SQLite の索引 (`~/.aialbum/index.sqlite3`) |
| `aialbum/scanner.py` | フォルダの走査 (差分読み込み) |
| `aialbum/server.py` | Web API (FastAPI) |
| `aialbum/static/` | 画面 (HTML / CSS / JavaScript。ビルド不要) |

索引の作り方を変えたときは、`~/.aialbum/index.sqlite3` を削除して起動し直すと全部読み直します (マイタグも消えるので注意)。

テスト:

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

## 注意

- 移動・コピーはファイルを実際に動かします。削除機能はありません。
- 「フォルダの登録解除」は索引から外すだけで、画像ファイルは消えません。
- サーバーは自分の PC (`127.0.0.1`) からしか開けません。
