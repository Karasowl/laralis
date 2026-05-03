@echo off
setlocal

cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\open-cypress-stage.ps1"

echo.
echo Cypress se cerro o termino la ejecucion.
pause

