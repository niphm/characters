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

"%NODE%" tools\vault-admin.mjs update-character --id tidewick --title "Tidewick Greyholt" --tracker "private-src/tidewick-greyholt-level-4.html" --spellbook "private-src/Tidewick Spells Level 4.html" --inventory "private-src/Tidewick Inventory Level 4.html"
echo.
pause
