import os
from typing import List, Dict, Any
import numpy as np
from ultralytics import YOLO

try:
    import torch
    torch.set_num_threads(1)
    torch.set_grad_enabled(False)
except Exception:
    pass

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 4 Standard Bins for Thailand Public Waste Management:
# 1. Yellow (เหลือง) - Recyclable (ขยะรีไซเคิล)
# 2. Green (เขียว) - Organic / Wet (ขยะเปียก / ขยะอินทรีย์)
# 3. Red / Orange (แดง / ส้ม) - Hazardous / E-waste / Infectious (ขยะอันตราย / ขยะติดเชื้อ)
# 4. Blue (น้ำเงิน) - General waste (ขยะทั่วไป)

WASTE_METADATA = {
    "plastic": {
        "thai_name": "ขวดพลาสติก / แก้วพลาสติก",
        "waste_type": "ขยะรีไซเคิล",
        "bin_color": "yellow",
        "bin_title": "ถังขยะรีไซเคิล (สีเหลือง)",
        "icon": "🥤",
        "instruction": "เทของเหลวออกให้หมดและบีบขวดให้แบนก่อนทิ้ง",
        "voice_alert": "ขวดพลาสติก ทิ้งลงถังขยะรีไซเคิลสีเหลืองค่ะ",
        "audio_file": "/static/audio/plastic.mp3",
        "co2_saved_g": 35.0
    },
    "metal": {
        "thai_name": "กระป๋องโลหะ / อะลูมิเนียม",
        "waste_type": "ขยะรีไซเคิล",
        "bin_color": "yellow",
        "bin_title": "ถังขยะรีไซเคิล (สีเหลือง)",
        "icon": "🥫",
        "instruction": "เทน้ำออก ล้างเล็กน้อยและบีบให้แบนเพื่อประหยัดพื้นที่",
        "voice_alert": "กระป๋องโลหะ ทิ้งลงถังขยะรีไซเคิลสีเหลืองค่ะ",
        "audio_file": "/static/audio/metal.mp3",
        "co2_saved_g": 85.0
    },
    "glass": {
        "thai_name": "ขวดแก้ว / บรรจุภัณฑ์แก้ว",
        "waste_type": "ขยะรีไซเคิล",
        "bin_color": "yellow",
        "bin_title": "ถังขยะรีไซเคิล (สีเหลือง)",
        "icon": "🍾",
        "instruction": "ระมัดระวังการแตก วางลงในถังอย่างเบามือ",
        "voice_alert": "ขวดแก้ว ทิ้งลงถังขยะรีไซเคิลสีเหลืองค่ะ",
        "audio_file": "/static/audio/glass.mp3",
        "co2_saved_g": 50.0
    },
    "cardboard": {
        "thai_name": "กล่องกระดาษ / ลังกระดาษ",
        "waste_type": "ขยะรีไซเคิล",
        "bin_color": "yellow",
        "bin_title": "ถังขยะรีไซเคิล (สีเหลือง)",
        "icon": "📦",
        "instruction": "กรุณาพับกล่องให้แบนเพื่อประหยัดพื้นที่ในถัง",
        "voice_alert": "กล่องกระดาษ ทิ้งลงถังขยะรีไซเคิลสีเหลืองค่ะ",
        "audio_file": "/static/audio/cardboard.mp3",
        "co2_saved_g": 40.0
    },
    "paper": {
        "thai_name": "กระดาษ / เศษกระดาษ",
        "waste_type": "ขยะรีไซเคิล",
        "bin_color": "yellow",
        "bin_title": "ถังขยะรีไซเคิล (สีเหลือง)",
        "icon": "📄",
        "instruction": "รวบรวมไว้รีไซเคิล หลีกเลี่ยงอย่าให้เปียกน้ำ",
        "voice_alert": "กระดาษ ทิ้งลงถังขยะรีไซเคิลสีเหลืองค่ะ",
        "audio_file": "/static/audio/paper.mp3",
        "co2_saved_g": 30.0
    },
    "biological": {
        "thai_name": "เศษอาหาร / ขยะอินทรีย์",
        "waste_type": "ขยะเปียก / ขยะอินทรีย์",
        "bin_color": "green",
        "bin_title": "ถังขยะอินทรีย์ (สีเขียว)",
        "icon": "🍎",
        "instruction": "แยกน้ำแกงออก สามารถนำไปทำปุ๋ยหมักชีวภาพได้",
        "voice_alert": "เศษอาหาร ขยะเปียก ทิ้งลงถังขยะอินทรีย์สีเขียวค่ะ",
        "audio_file": "/static/audio/organic.mp3",
        "co2_saved_g": 20.0
    },
    "organic": {
        "thai_name": "เศษอาหาร / ขยะอินทรีย์",
        "waste_type": "ขยะเปียก / ขยะอินทรีย์",
        "bin_color": "green",
        "bin_title": "ถังขยะอินทรีย์ (สีเขียว)",
        "icon": "🍎",
        "instruction": "แยกน้ำแกงออก สามารถนำไปทำปุ๋ยหมักชีวภาพได้",
        "voice_alert": "เศษอาหาร ขยะเปียก ทิ้งลงถังขยะอินทรีย์สีเขียวค่ะ",
        "audio_file": "/static/audio/organic.mp3",
        "co2_saved_g": 20.0
    },
    "battery": {
        "thai_name": "ถ่านไฟฉาย / แบตเตอรี่",
        "waste_type": "ขยะอันตราย",
        "bin_color": "red",
        "bin_title": "ถังขยะอันตราย (สีแดง/ส้ม)",
        "icon": "🔋",
        "instruction": "มีสารเคมีอันตรายและโลหะหนัก ห้ามทิ้งปนเด็ดขาด",
        "voice_alert": "ถ่านไฟฉาย ขยะอันตราย ทิ้งลงถังขยะอันตรายสีแดงค่ะ",
        "audio_file": "/static/audio/e-waste.mp3",
        "co2_saved_g": 0.0
    },
    "e-waste": {
        "thai_name": "ขยะอิเล็กทรอนิกส์ / ถ่าน / แบตเตอรี่",
        "waste_type": "ขยะอันตราย",
        "bin_color": "red",
        "bin_title": "ถังขยะอันตราย (สีแดง/ส้ม)",
        "icon": "🔋",
        "instruction": "มีสารเคมีและโลหะหนัก ห้ามทิ้งปนเด็ดขาด",
        "voice_alert": "ขยะอิเล็กทรอนิกส์ ขยะอันตราย ทิ้งลงถังขยะอันตรายสีแดงค่ะ",
        "audio_file": "/static/audio/e-waste.mp3",
        "co2_saved_g": 0.0
    },
    "medical": {
        "thai_name": "ขยะติดเชื้อ / หน้ากากอนามัย",
        "waste_type": "ขยะติดเชื้อ / อันตราย",
        "bin_color": "red",
        "bin_title": "ถังขยะติดเชื้อ (สีแดง)",
        "icon": "💉",
        "instruction": "มัดปากถุงให้มิดชิด ทิ้งลงถังเฉพาะเพื่อป้องกันการแพร่เชื้อ",
        "voice_alert": "ขยะติดเชื้อ ทิ้งลงถังขยะติดเชื้อสีแดงค่ะ",
        "audio_file": "/static/audio/medical.mp3",
        "co2_saved_g": 0.0
    },
    "trash": {
        "thai_name": "ขยะทั่วไป / ซองขนม / ถุงพลาสติก",
        "waste_type": "ขยะทั่วไป",
        "bin_color": "blue",
        "bin_title": "ถังขยะทั่วไป (สีน้ำเงิน)",
        "icon": "🗑️",
        "instruction": "ขยะย่อยสลายยากและไม่คุ้มค่ารีไซเคิล ทิ้งลงถังสีน้ำเงิน",
        "voice_alert": "ขยะทั่วไป ทิ้งลงถังขยะทั่วไปสีน้ำเงินค่ะ",
        "audio_file": "/static/audio/general.mp3",
        "co2_saved_g": 0.0
    }
}

DEFAULT_METADATA = {
    "thai_name": "ขยะทั่วไป",
    "waste_type": "ขยะทั่วไป",
    "bin_color": "blue",
    "bin_title": "ถังขยะทั่วไป (สีน้ำเงิน)",
    "icon": "🗑️",
    "instruction": "ขยะที่ไม่สามารถรีไซเคิลได้ ทิ้งลงถังขยะทั่วไปเพื่อนำไปกำจัดอย่างถูกต้อง",
    "voice_alert": "ขยะทั่วไป ทิ้งลงถังขยะทั่วไปสีน้ำเงินค่ะ",
    "audio_file": "/static/audio/general.mp3",
    "co2_saved_g": 0.0
}

_model = None
_active_model_name = "None"

def find_best_model_path():
    base_dir = os.path.dirname(__file__)
    # Prioritize 12-class waste model, then 8-class model
    candidates = [
        "waste_yolo12.pt",
        "waste_yolov8.pt",
        "best.pt",
        "model.pt"
    ]
    for c in candidates:
        p = os.path.join(base_dir, c)
        if os.path.exists(p) and os.path.getsize(p) >= 40 * 1024 * 1024:
            return p

    for f in os.listdir(base_dir):
        if f.endswith(".pt") and not f.startswith("yolov8n"):
            p = os.path.join(base_dir, f)
            if os.path.getsize(p) >= 40 * 1024 * 1024:
                return p

    return "waste_yolov8.pt"

def get_model():
    global _model, _active_model_name
    if _model is not None:
        return _model

    target_path = find_best_model_path()
    if target_path:
        try:
            print(f"Loading YOLO model from: {target_path} ...")
            _model = YOLO(target_path)
            _active_model_name = os.path.basename(target_path)
            # Warm up model to eliminate initial latency
            try:
                import torch
                torch.set_num_threads(1)
                dummy = np.zeros((384, 384, 3), dtype=np.uint8)
                _model(dummy, conf=0.25, imgsz=384, verbose=False)
                print(f"Model {_active_model_name} loaded and warmed up successfully!")
            except Exception:
                pass
            return _model
        except Exception as e:
            print(f"Failed to load {target_path} ({e})")

    try:
        fallback = os.path.join(os.path.dirname(__file__), "waste_yolov8.pt")
        _model = YOLO(fallback)
        _active_model_name = "waste_yolov8.pt"
        return _model
    except Exception as e:
        print(f"Model fallback failed: {e}")
        return None

def get_active_model_info():
    global _active_model_name, _model
    model = get_model()
    class_count = len(model.names) if model else 0
    classes = list(model.names.values()) if model else []
    return {
        "model_file": _active_model_name,
        "class_count": class_count,
        "classes": classes
    }

def reload_model(specified_path: str = None):
    global _model, _active_model_name
    _model = None
    if specified_path and os.path.exists(specified_path):
        _model = YOLO(specified_path)
        _active_model_name = os.path.basename(specified_path)
    else:
        get_model()

def classify_detection(class_name: str) -> Dict[str, Any]:
    norm_key = class_name.strip().lower()
    
    # Specific class mappings
    if "battery" in norm_key:
        return WASTE_METADATA["battery"]
    if "biological" in norm_key or "organic" in norm_key:
        return WASTE_METADATA["biological"]
    if "glass" in norm_key:
        return WASTE_METADATA["glass"]
    if "cardboard" in norm_key or "box" in norm_key:
        return WASTE_METADATA["cardboard"]
    if "paper" in norm_key or "book" in norm_key:
        return WASTE_METADATA["paper"]
    if "plastic" in norm_key or "bottle" in norm_key or "cup" in norm_key:
        return WASTE_METADATA["plastic"]
    if "metal" in norm_key or "can" in norm_key or "aluminum" in norm_key:
        return WASTE_METADATA["metal"]
    if "trash" in norm_key or "shoes" in norm_key or "clothes" in norm_key:
        return WASTE_METADATA["trash"]
    if "medical" in norm_key or "mask" in norm_key:
        return WASTE_METADATA["medical"]

    # Fuzzy matches
    for key, meta in WASTE_METADATA.items():
        if key in norm_key or norm_key in key:
            return meta

    return DEFAULT_METADATA

def detect_waste(image_np: np.ndarray, conf_threshold: float = 0.18) -> List[Dict[str, Any]]:
    model = get_model()
    if model is None:
        return []

    try:
        # Use conf=conf_threshold with imgsz=384 for ultra-fast and sensitive detection
        results = model(image_np, conf=conf_threshold, imgsz=384, verbose=False)
    except Exception as e:
        print(f"Inference error: {e}")
        return []
    
    detections = []
    if not results or len(results) == 0:
        return detections

    r = results[0]
    boxes = r.boxes
    if boxes is None:
        return detections

    h, w = image_np.shape[:2]

    for box in boxes:
        cls_id = int(box.cls[0].item())
        conf = float(box.conf[0].item())
        xyxy = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
        
        # Get raw label
        raw_name = model.names.get(cls_id, f"Item_{cls_id}")
        meta = classify_detection(raw_name)

        detections.append({
            "raw_class": raw_name,
            "thai_name": meta["thai_name"],
            "waste_type": meta["waste_type"],
            "bin_color": meta["bin_color"],
            "bin_title": meta["bin_title"],
            "icon": meta["icon"],
            "instruction": meta["instruction"],
            "voice_alert": meta["voice_alert"],
            "audio_file": meta.get("audio_file", "/static/audio/general.mp3"),
            "co2_saved_g": meta["co2_saved_g"],
            "confidence": round(conf * 100, 1),
            "box": [round(c, 1) for c in xyxy],
            "norm_box": [
                round(xyxy[0] / w, 4),
                round(xyxy[1] / h, 4),
                round(xyxy[2] / w, 4),
                round(xyxy[3] / h, 4),
            ]
        })

    return detections
