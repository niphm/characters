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

"%NODE%" tools\vault-admin.mjs update-character --id azrael --title "Azrael Ognyan" --tracker "private-src/azrael/azrael-main.html" --spellbook "private-src/azrael/azrael-spells.html" --attack "private-src/azrael/azrael-attack.html" --inventory "private-src/azrael/azrael-inventory.html" --data "private-src/azrael/azrael-data.html" --journal "private-src/azrael/azrael-journal.html"
echo.
pause
