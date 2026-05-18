@echo off
cd /d "%~dp0"
echo.
echo ========================================
echo   LXSBest Content Publisher
echo ========================================
echo.
node scripts/publish.js
echo.
pause
