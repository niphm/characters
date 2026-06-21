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

echo.
echo TIDEWICK ENCRYPTED VAULT SETUP
echo.
echo You will choose:
echo   1. An administrator recovery passphrase
echo   2. Your vault username
echo   3. Your vault login password
echo.
echo Use long, unique passphrases. Nothing you type is saved as plaintext.
echo.

"%NODE%" tools\vault-admin.mjs init-character --id tidewick --title "Tidewick Greyholt" --tracker "private-src\tidewick-greyholt-level-4.html" --spellbook "private-src\Tidewick Spells Level 4.html" --inventory "private-src\Tidewick Inventory Level 4.html"
if errorlevel 1 goto :failed

set /p "VAULT_USERNAME=Choose your vault username: "
if "%VAULT_USERNAME%"=="" goto :failed

"%NODE%" tools\vault-admin.mjs add-user --character tidewick --username "%VAULT_USERNAME%"
if errorlevel 1 goto :failed

echo.
echo Vault setup complete. Open index.html through a web server or publish to GitHub Pages.
pause
exit /b 0

:failed
echo.
echo Vault setup was not completed.
pause
exit /b 1
