import os
import base64
import io
import socket
import time
from typing import Optional
from fastapi import FastAPI, Request, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image

from database import init_db, log_detection, get_stats, delete_detection, reset_all_detections
from classifier import detect_waste, classify_detection, reload_model, get_active_model_info

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = FastAPI(title="Smart Public Waste Sorting System")

# Prevent browser from aggressively caching scripts, styles and templates
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Enable CORS for mobile phone access on local network
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static and templates directory exist
os.makedirs(os.path.join(BASE_DIR, "static"), exist_ok=True)
os.makedirs(os.path.join(BASE_DIR, "templates"), exist_ok=True)

app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))

# Initialize DB on startup
@app.on_event("startup")
def on_startup():
    init_db()

def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    local_ip = get_local_ip()
    return templates.TemplateResponse(
        request=request,
        name="index.html",
        context={"local_ip": local_ip, "port": 8000, "cache_bust": int(time.time())}
    )

@app.get("/dashboard", response_class=HTMLResponse)
async def read_dashboard(request: Request):
    local_ip = get_local_ip()
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html",
        context={"local_ip": local_ip, "port": 8000, "cache_bust": int(time.time())}
    )

@app.get("/presentation", response_class=HTMLResponse)
async def read_presentation(request: Request):
    local_ip = get_local_ip()
    return templates.TemplateResponse(
        request=request,
        name="presentation.html",
        context={"local_ip": local_ip, "port": 8000, "cache_bust": int(time.time())}
    )

@app.get("/slide-mockup", response_class=HTMLResponse)
async def read_slide_mockup(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="slide_mockup.html",
        context={"request": request}
    )

@app.post("/api/detect")
async def api_detect(
    image_base64: Optional[str] = Form(None),
    conf_threshold: float = Form(0.35),
    auto_log: bool = Form(False),
    file: Optional[UploadFile] = File(None)
):
    try:
        image = None
        if file is not None:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents)).convert("RGB")
        elif image_base64:
            if "," in image_base64:
                image_base64 = image_base64.split(",")[1]
            img_data = base64.b64decode(image_base64)
            image = Image.open(io.BytesIO(img_data)).convert("RGB")

        if image is None:
            return JSONResponse({"status": "error", "message": "No image provided"}, status_code=400)

        # Downscale incoming mobile images immediately for 10x faster CPU inference
        if image.width > 480 or image.height > 480:
            image.thumbnail((480, 480), Image.Resampling.BILINEAR)

        image_np = np.array(image)
        detections = detect_waste(image_np, conf_threshold=conf_threshold)

        # If auto_log is true and detections found, log the highest confidence detection
        if auto_log and detections:
            top = max(detections, key=lambda d: d["confidence"])
            log_detection(
                class_name=top["raw_class"],
                waste_type=top["waste_type"],
                bin_color=top["bin_color"],
                confidence=top["confidence"],
                co2_saved_g=top["co2_saved_g"]
            )

        return JSONResponse({
            "status": "success",
            "count": len(detections),
            "detections": detections
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/log")
async def api_log_detection(
    class_name: str = Form(...),
    waste_type: str = Form(...),
    bin_color: str = Form(...),
    confidence: float = Form(...),
    co2_saved_g: float = Form(0.0)
):
    try:
        log_detection(class_name, waste_type, bin_color, confidence, co2_saved_g)
        return JSONResponse({"status": "success"})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/stats")
async def api_get_stats():
    try:
        data = get_stats()
        model_info = get_active_model_info()
        data["model_info"] = model_info
        return JSONResponse({"status": "success", "data": data})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/logs/delete/{log_id}")
@app.delete("/api/logs/{log_id}")
async def api_delete_log(log_id: int):
    try:
        success = delete_detection(log_id)
        return JSONResponse({"status": "success", "deleted": success})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/logs/reset")
async def api_reset_logs():
    try:
        reset_all_detections()
        return JSONResponse({"status": "success", "message": "All detection records have been cleared."})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/model/info")
async def api_model_info():
    try:
        return JSONResponse({"status": "success", "data": get_active_model_info()})
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.post("/api/model/upload")
async def api_upload_model(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith(".pt"):
            return JSONResponse({"status": "error", "message": "กรุณาอัปโหลดไฟล์โมเดลนามสกุล .pt เท่านั้น"}, status_code=400)
        
        save_path = os.path.join(BASE_DIR, "waste_yolov8.pt")
        contents = await file.read()
        with open(save_path, "wb") as f:
            f.write(contents)
        
        # Reload the newly uploaded model
        reload_model(save_path)
        
        return JSONResponse({
            "status": "success",
            "message": f"เชื่อมต่อโมเดล {file.filename} เรียบร้อยแล้ว!",
            "model_info": get_active_model_info()
        })
    except Exception as e:
        return JSONResponse({"status": "error", "message": str(e)}, status_code=500)

@app.get("/api/info")
async def api_get_info():
    local_ip = get_local_ip()
    return JSONResponse({
        "status": "success",
        "local_ip": local_ip,
        "mobile_url": f"http://{local_ip}:8000"
    })
