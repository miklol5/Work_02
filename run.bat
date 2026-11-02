@echo off
title Smart Public Waste AI Server
echo ============================================================
echo   Smart Public Waste AI - Waste Sorting System
echo ============================================================
echo.
echo Starting Web Server...
echo Open your browser at: http://localhost:8000
echo Dashboard:            http://localhost:8000/dashboard
echo.
echo Press Ctrl+C to stop the server.
echo ============================================================
echo.

python -m uvicorn app:app --host 0.0.0.0 --port 8000
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to start server.
    echo.
)
pause
