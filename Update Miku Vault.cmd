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

"%NODE%" tools\vault-admin.mjs update-character --id miku --title "Miku Noelani" --tracker "private-src/miku/miku-main.html" --attack "private-src/miku/miku-attack.html" --inventory "private-src/miku/miku-inventory.html" --data "private-src/miku/miku-data.html" --journal "private-src/miku/miku-journal.html"
echo.
pause
