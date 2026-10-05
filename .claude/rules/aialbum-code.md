---
paths:
  - "aialbum/**/*.py"
  - "aialbum/static/**"
  - "tests/**/*.py"
---

# aialbum のコードを触るとき

- 既存の書き方に合わせる：`from __future__ import annotations`、型ヒント、日本語の docstring とコメント。
- 対応する Python は 3.10 以上（`pyproject.toml`）。それより新しい文法は使わない。
- 画面（`aialbum/static/`）はビルドなしの HTML / CSS / JavaScript。ビルド手順やフレームワークを持ち込まない。
- ファイルを動かす処理（移動・コピー）を変えるときは、テストを `tmp_path` の中だけで行う。実際の画像フォルダや `~/.aialbum/` を使わない。
- 新しい画像形式（ComfyUI など）の読み取りは `aialbum/metadata.py` に追加し、`tests/samples.py` にサンプルを作ってテストする。
- 依存パッケージを増やすときは、`requirements.txt` と `pyproject.toml` の両方を直す。追加そのものは利用者の承認を得てから。
