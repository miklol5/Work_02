@echo off
chcp 65001 >nul
title Smart Public Waste AI
echo ============================================================
echo   Smart Public Waste AI - ระบบจำแนกประเภทขยะอัจฉริยะ
echo ============================================================
echo.
echo กำลังเริ่มต้นระบบ Web Server...
echo เข้าใช้งานผ่านเบราว์เซอร์:
echo   - บนเครื่องนี้:  http://localhost:8000
echo   - หรือเปิดหน้ากล้องเพื่อสแกน QR Code สำหรับมือถือ
echo.
echo กด Ctrl + C เพื่อหยุดการทำงาน
echo ============================================================
echo.

python -m uvicorn app:app --host 0.0.0.0 --port 8000
pause
