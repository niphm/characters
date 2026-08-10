@echo off
setlocal
set "PYTHON=C:\Users\david\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
cd /d "%~dp0"

if not exist "%PYTHON%" (
  echo The bundled Python runtime was not found.
  echo Install Python, then run: python -m http.server 8000
  pause
  exit /b 1
)

start "" http://127.0.0.1:8000/
"%PYTHON%" -m http.server 8000 --bind 127.0.0.1
