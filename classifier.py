import os
from typing import List, Dict, Any
import numpy as np
from ultralytics import YOLO

MODEL_PATH = os.path.join(os.path.dirname(__file__), "waste_yolov8.pt")

# Waste classification definitions tailored for Thai public waste management standards
# 4 Standard Bins:
# 1. Yellow (เหลือง) - Recyclable (ขยะรีไซเคิล)
# 2. Green (เขียว) - Organic / Wet (ขยะเปียก / ขยะอินทรีย์)
# 3. Red / Orange (แดง / ส้ม) - Hazardous / E-waste / Infectious (ขยะอันตราย / ขยะติดเชื้อ)
# 4. Blue (น้ำเงิน) - General waste (ขยะทั่วไป)

WASTE_METADATA = {
    "cardboard": {
        "thai_name": "กล่องกระดาษ / ลังกระดาษ",
        "waste_type": "ขยะรีไซเคิล",
        "bin_color": "yellow",
        "bin_title": "ถังขยะรีไซเคิล (สีเหลือง)",
        "icon": "📦",
        "instruction": "กรุณาพับกล่องให้แบนเพื่อประหยัดพื้นที่",
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
    "plastic": {
        "thai_name": "ขวดพลาสติก / พลาสติกรีไซเคิล",
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
        "instruction": "เทน้ำออก ล้างเล็กน้อยและบีบให้แบน",
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
    "organic waste": {
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
    "medical waste": {
        "thai_name": "ขยะติดเชื้อ / ขยะทางการแพทย์",
        "waste_type": "ขยะติดเชื้อ / อันตราย",
        "bin_color": "red",
        "bin_title": "ถังขยะติดเชื้อ (สีแดง)",
        "icon": "💉",
        "instruction": "มัดปากถุงให้มิดชิด ทิ้งลงถังเฉพาะเพื่อป้องกันการแพร่เชื้อ",
        "voice_alert": "ขยะติดเชื้อ ทิ้งลงถังขยะติดเชื้อสีแดงค่ะ",
        "audio_file": "/static/audio/medical.mp3",
        "co2_saved_g": 0.0
    }
}

DEFAULT_METADATA = {
    "thai_name": "ขยะทั่วไป",
    "waste_type": "ขยะทั่วไป",
    "bin_color": "blue",
    "bin_title": "ถังขยะทั่วไป (สีน้ำเงิน)",
    "icon": "🗑️",
    "instruction": "ขยะที่ไม่สามารถรีไซเคิลได้ ทิ้งลงถังขยะทั่วไปเพื่อนำไปฝังกลบหรือกำจัด",
    "voice_alert": "ขยะทั่วไป ทิ้งลงถังขยะทั่วไปสีน้ำเงินค่ะ",
    "audio_file": "/static/audio/general.mp3",
    "co2_saved_g": 0.0
}

_model = None
_active_model_name = "None"

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
        return True
    get_model()
    return True

def find_best_model_path():
    base_dir = os.path.dirname(__file__)
    # Expected model files are usually > 20MB (YOLOv8s/m waste models)
    candidates = [
        "waste_yolov8.pt",
        "yolov8m_object_material_best.pt",
        "best.pt",
        "model.pt"
    ]
    for c in candidates:
        p = os.path.join(base_dir, c)
        if os.path.exists(p) and os.path.getsize(p) >= 40 * 1024 * 1024:
            return p

    # Check any .pt file >= 40MB in project directory
    for f in os.listdir(base_dir):
        if f.endswith(".pt") and not f.startswith("yolov8n"):
            p = os.path.join(base_dir, f)
            if os.path.getsize(p) >= 40 * 1024 * 1024:
                return p

    return "yolov8n.pt"

def get_model():
    global _model, _active_model_name
    if _model is not None:
        return _model

    target_path = find_best_model_path()
    if target_path and target_path != "yolov8n.pt":
        try:
            print(f"Loading YOLO model from: {target_path} ...")
            _model = YOLO(target_path)
            _active_model_name = os.path.basename(target_path)
            # Warm up model to eliminate initial latency
            try:
                import torch
                torch.set_num_threads(2)
                dummy = np.zeros((512, 512, 3), dtype=np.uint8)
                _model(dummy, conf=0.5, imgsz=512, verbose=False)
                print("Model warmed up successfully!")
            except Exception:
                pass
            return _model
        except Exception as e:
            print(f"Failed to load {target_path} ({e})")

    # Fallback to standard baseline
    try:
        print("Loading baseline yolov8n.pt ...")
        _model = YOLO("yolov8n.pt")
        _active_model_name = "yolov8n.pt"
        return _model
    except Exception as e:
        print(f"Model not ready yet: {e}")
        return None

def classify_detection(class_name: str) -> Dict[str, Any]:
    norm_key = class_name.strip().lower()
    for key, meta in WASTE_METADATA.items():
        if key in norm_key or norm_key in key:
            return meta
    # Common YOLO general class matching if baseline is used
    if any(k in norm_key for k in ["bottle", "cup", "can"]):
        return WASTE_METADATA["plastic"]
    if any(k in norm_key for k in ["banana", "apple", "sandwich", "orange", "broccoli", "carrot", "pizza", "donut", "cake"]):
        return WASTE_METADATA["organic waste"]
    if any(k in norm_key for k in ["cell phone", "remote", "keyboard", "mouse", "laptop"]):
        return WASTE_METADATA["e-waste"]
    if any(k in norm_key for k in ["book"]):
        return WASTE_METADATA["paper"]
    return DEFAULT_METADATA

def detect_waste(image_np: np.ndarray, conf_threshold: float = 0.35) -> List[Dict[str, Any]]:
    model = get_model()
    if model is None:
        return []

    try:
        results = model(image_np, conf=conf_threshold, verbose=False)
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
