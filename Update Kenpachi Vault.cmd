@echo off
setlocal
set "NODE=C:\Users\david\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
cd /d "%~dp0"

if not exist "%NODE%" (
  echo The bundled Node.js runtime was not found.
  echo Install Node.js, then edit NODE in this file to point to node.exe.
  pause
  exit /b 1
)

"%NODE%" tools\vault-admin.mjs update-character --id kenpachi --title "Kenpachi" --tracker "private-src/kenpachi/kenpachi-main.html" --attack "private-src/kenpachi/kenpachi-attack.html" --inventory "private-src/kenpachi/kenpachi-inventory.html" --data "private-src/kenpachi/kenpachi-data.html" --journal "private-src/kenpachi/kenpachi-journal.html"
echo.
pause
