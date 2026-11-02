@echo off
cd /d "%~dp0"
title Mobile Tunnel (HTTPS)
echo ============================================================
echo   Starting HTTPS Tunnel for Mobile (Port 8000)
echo ============================================================
echo.
echo Make sure run.bat is already running!
echo Generating free HTTPS link for your phone...
echo.

call npx.cmd localtunnel --port 8000
pause
