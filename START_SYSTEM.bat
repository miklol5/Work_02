@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Smart Public Waste AI - Launcher
python -X utf8 launch_system.py
pause
