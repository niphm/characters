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

"%NODE%" tools\vault-admin.mjs update-character --id hestia --title "Hestia Hearthstone" --tracker "private-src/hestia/hestia-main.html" --spellbook "private-src/hestia/hestia-spells.html" --inventory "private-src/hestia/hestia-inventory.html" --data "private-src/hestia/hestia-data.html" --journal "private-src/hestia/hestia-journal.html"
echo.
pause
