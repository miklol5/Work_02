@echo off
cd /d "%~dp0"
title Smart Public Waste AI Server
echo ============================================================
echo   Smart Public Waste AI - Waste Sorting System
echo ============================================================
echo.
echo Starting Web Server...
echo Address: http://127.0.0.1:8000
echo.
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://127.0.0.1:8000"
python -m uvicorn app:app --host 0.0.0.0 --port 8000
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start server.
    echo.
)
pause
