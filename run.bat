@echo off
rem AI Image Album を起動する (初回は必要なものを自動でインストールします)
chcp 65001 > nul
cd /d "%~dp0"
if not exist .venv (
  echo 初回セットアップ中...
  python -m venv .venv || (echo Python 3.10 以上をインストールしてください & pause & exit /b 1)
  .venv\Scripts\python -m pip install -r requirements.txt || (pause & exit /b 1)
)
.venv\Scripts\python -m aialbum %*
pause
