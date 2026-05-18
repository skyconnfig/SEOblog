@echo off
cd /d "%~dp0"
chcp 65001 >nul

echo.
echo ========================================
echo    LXSBest Blog - 启动中...
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装：
    echo         https://nodejs.org
    echo.
    pause
    exit /b 1
)

node scripts/start.js
if %errorlevel% neq 0 (
    echo.
    echo [错误] 启动失败，请检查日志。
    pause
)
