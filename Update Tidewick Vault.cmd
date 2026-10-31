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

"%NODE%" tools\vault-admin.mjs update-character --id tidewick --title "Tidewick Grayholt" --tracker "private-src/tidewick/tidewick-main.html" --spellbook "private-src/tidewick/tidewick-spells.html" --inventory "private-src/tidewick/tidewick-inventory.html" --data "private-src/tidewick/tidewick-data.html" --journal "private-src/tidewick/tidewick-journal.html"
echo.
pause
