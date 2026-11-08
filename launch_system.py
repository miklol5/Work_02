import os
import sys

# Force UTF-8 encoding on Windows console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import time
import subprocess
import re
import socket
import webbrowser
import qrcode

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLOUDFLARED_PATH = os.path.join(BASE_DIR, "cloudflared.exe")

def is_port_open(port=8000):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(('127.0.0.1', port)) == 0

def main():
    os.system("color 0A" if sys.platform == "win32" else "clear")
    print("=" * 65)
    print("  🌿 ระบบจำแนกประเภทขยะอัจฉริยะ (Smart Public Waste AI)")
    print("  🚀 เริ่มต้นระบบความเร็วสูง (Lightning Fast HTTPS Tunnel)")
    print("=" * 65)
    print()

    # 1. Start Uvicorn if not running
    uvicorn_proc = None
    if not is_port_open(8000):
        print("⚡ [1/2] กำลังเริ่มเซิร์ฟเวอร์ AI บนเครื่องของคุณ...")
        uvicorn_proc = subprocess.Popen(
            [sys.executable, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000"],
            cwd=BASE_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        time.sleep(2)
    else:
        print("✅ [1/2] เซิร์ฟเวอร์ AI กำลังทำงานอยู่ที่พอร์ต 8000")

    # 2. Check cloudflared
    if not os.path.exists(CLOUDFLARED_PATH):
        print("❌ ไม่พบ cloudflared.exe กำลังดาวน์โหลดใหม่อัตโนมัติ...")
        import urllib.request
        url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        urllib.request.urlretrieve(url, CLOUDFLARED_PATH)

    print("🌐 [2/2] กำลังสร้างลิงก์ HTTPS ความเร็วสูง (Cloudflare Edge Bangkok)...")
    cmd = [CLOUDFLARED_PATH, "tunnel", "--url", "http://127.0.0.1:8000"]
    cf_proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace"
    )

    tunnel_url = None
    start_time = time.time()
    while time.time() - start_time < 20:
        line = cf_proc.stdout.readline()
        if not line:
            time.sleep(0.1)
            continue
        m = re.search(r"https://[a-zA-Z0-9\-]+\.trycloudflare\.com", line)
        if m:
            tunnel_url = m.group(0)
            break

    if not tunnel_url:
        print("❌ ไม่สามารถดึงลิงก์ Tunnel ได้ กรุณาลองใหม่อีกครั้ง")
        return

    # Print success info
    print("\n" + "=" * 65)
    print("  🎉 ระบบพร้อมใช้งานแล้ว! (ความเร็วระดับเสี้ยววินาที)")
    print("=" * 65)
    print(f"\n📱 ลิงก์เข้าใช้งานบนมือถือ (HTTPS แท้ กล้องเปิดได้ 100%):")
    print(f"👉 \033[1;36m{tunnel_url}\033[0m\n")
    print(f"📊 หน้าแดชบอร์ดสถิติ:")
    print(f"👉 {tunnel_url}/dashboard\n")
    print(f"📑 หน้าสไลด์นำเสนอ:")
    print(f"👉 {tunnel_url}/presentation\n")

    # Print ASCII QR code in terminal
    try:
        qr = qrcode.QRCode(border=1)
        qr.add_data(tunnel_url)
        qr.make(fit=True)
        print("📲 สแกน QR Code นี้ด้วยกล้องมือถือเพื่อเข้าใช้งานได้ทันที:")
        qr.print_ascii(invert=True)
    except Exception:
        pass

    print("-" * 65)
    print("💡 ข้อแนะนำ: เปิดหน้าต่างนี้ไว้ขณะใช้งาน (กดปิดหน้าต่างนี้เมื่อต้องการหยุด)")
    print("=" * 65)

    try:
        # Keep process alive
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nกำลังปิดระบบ...")
    finally:
        cf_proc.terminate()
        if uvicorn_proc:
            uvicorn_proc.terminate()
        print("ปิดระบบเรียบร้อยแล้วครับ")

if __name__ == "__main__":
    main()
