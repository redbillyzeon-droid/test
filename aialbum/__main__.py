"""起動: python -m aialbum [--add フォルダ] [--port 8765]"""

from __future__ import annotations

import argparse
import os
import threading
import webbrowser
from pathlib import Path


def default_data_dir() -> Path:
    env = os.environ.get("AIALBUM_DATA_DIR")
    if env:
        return Path(env)
    return Path.home() / ".aialbum"


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="aialbum", description="AI生成画像のタグで探せるアルバム")
    parser.add_argument("--add", action="append", default=[], metavar="FOLDER", help="画像フォルダを登録する (複数可)")
    parser.add_argument("--data-dir", default=str(default_data_dir()), help="索引とサムネイルの保存先")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--no-browser", action="store_true", help="起動時にブラウザを開かない")
    parser.add_argument(
        "--stealth", choices=["auto", "always", "never"], default="auto",
        help="ステルスpnginfoの読み取り (auto: 通常の情報が無いときだけ)",
    )
    parser.add_argument("--thumb-size", type=int, default=384)
    args = parser.parse_args(argv)

    import uvicorn

    from .server import _norm, create_app

    app = create_app(args.data_dir, stealth=args.stealth, thumb_size=args.thumb_size)
    db = app.state.db
    for folder in args.add:
        path = _norm(folder)
        if os.path.isdir(path):
            db.add_folder(path)
        else:
            print(f"フォルダが見つかりません: {path}")

    # 起動のたびに差分だけ読み直す
    app.state.scanner.start()

    url = f"http://{args.host}:{args.port}/"
    print(f"AI Image Album: {url}  (終了は Ctrl+C)")
    if not args.no_browser:
        threading.Timer(1.0, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
