import os
import io
import time
from datetime import datetime
import streamlit as st
from PIL import Image
import numpy as np

from classifier import detect_waste, classify_detection, get_active_model_info
from database import init_db, log_detection, get_stats, reset_all_detections

# Page config
st.set_page_config(
    page_title="Smart Public Waste AI",
    page_icon="♻️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize database
init_db()

# Custom CSS for modern styling
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(135deg, #059669 0%, #10b981 100%);
        padding: 24px;
        border-radius: 16px;
        color: white;
        margin-bottom: 24px;
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
    }
    .bin-card {
        padding: 16px 20px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        margin-top: 12px;
        box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }
    .stat-box {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 16px;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)

# App Header
st.markdown("""
<div class="main-header">
    <h1 style="margin:0; font-size: 2rem;">🌿 ระบบจำแนกประเภทขยะอัจฉริยะ</h1>
    <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 1.05rem;">
        Smart Public Waste Sorting AI System — ขับเคลื่อนด้วย YOLOv8 + เสียงแนะนำภาษาไทย
    </p>
</div>
""", unsafe_allow_html=True)

# Sidebar
with st.sidebar:
    st.subheader("⚙️ สถานะระบบ AI")
    model_info = get_active_model_info()
    st.success(f"🤖 โมเดล: {model_info.get('model_type', 'YOLOv8')}")
    st.info(f"📂 ไฟล์โมเดล: {model_info.get('model_path', 'waste_yolov8.pt')}")
    st.caption("พัฒนาเพื่อส่งเสริมการคัดแยกขยะในพื้นที่สาธารณะและลดก๊าซเรือนกระจก")
    st.divider()
    st.markdown("### 🗑️ ถังขยะ 4 สีมาตรฐาน")
    st.markdown("🔵 **ขยะรีไซเคิล (สีน้ำเงิน):** พลาสติก, ขวดแก้ว, กระป๋อง, กระดาษ")
    st.markdown("🟢 **ขยะอินทรีย์/เปียก (สีเขียว):** เศษอาหาร, เปลือกผลไม้")
    st.markdown("🔴 **ขยะอันตราย (สีแดง):** ขยะอิเล็กทรอนิกส์, แบตเตอรี่, ยา")
    st.markdown("🟡 **ขยะทั่วไป (สีเหลือง):** ซองขนม, กล่องโฟม, ถุงพลาสติกเปื้อน")

# Navigation Tabs
tab_scan, tab_dash, tab_about = st.tabs([
    "📸 สแกนจำแนกขยะ (AI Scan)",
    "📊 แดชบอร์ดสถิติ (Dashboard)",
    "ℹ️ เกี่ยวกับระบบ (About)"
])

with tab_scan:
    col_input, col_result = st.columns([1, 1], gap="medium")
    
    with col_input:
        st.subheader("1. ถ่ายภาพหรืออัปโหลดรูปขยะ")
        input_mode = st.radio("เลือกวิธีนำเข้ารูปภาพ:", ["📷 เปิดกล้องถ่ายภาพ (Camera)", "📁 อัปโหลดไฟล์ภาพ (Upload)"], horizontal=True)
        
        img_file = None
        if "กล้อง" in input_mode:
            img_file = st.camera_input("กดปุ่ม Take Photo เพื่อสแกนขยะ")
        else:
            img_file = st.file_uploader("เลือกรูปภาพขยะ (JPG, PNG)", type=["jpg", "jpeg", "png"])
            
    with col_result:
        st.subheader("2. ผลการวิเคราะห์จาก AI")
        if img_file is not None:
            # Read and process image
            image_bytes = img_file.getvalue()
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            
            with st.spinner("🤖 AI กำลังประมวลผลจำแนกประเภทขยะ..."):
                start_time = time.time()
                detections = detect_waste(pil_img, conf_threshold=0.25)
                classification = classify_detection(detections)
                proc_time = (time.time() - start_time) * 1000
                
            # Log to DB
            log_detection(
                primary_label=classification.get("primary_label", "Unknown"),
                primary_confidence=classification.get("primary_confidence", 0.0),
                waste_type_th=classification.get("waste_type_th", "ไม่ระบุ"),
                bin_color=classification.get("bin_color", "general"),
                bin_color_th=classification.get("bin_color_th", "ถังทั่วไป"),
                instruction=classification.get("instruction", ""),
                processing_time_ms=proc_time,
                items_detected=classification.get("items_detected", [])
            )
            
            # Show annotated image
            annotated_img = classification.get("annotated_image")
            if annotated_img:
                st.image(annotated_img, caption="ผลการตรวจจับตำแหน่งและประเภทขยะ", use_container_width=True)
            else:
                st.image(pil_img, caption="รูปภาพต้นฉบับ", use_container_width=True)
                
            # Bin result badge
            bin_color = classification.get("bin_color", "general")
            bin_bg_map = {
                "blue": "#2563eb",
                "green": "#16a34a",
                "yellow": "#eab308",
                "red": "#dc2626"
            }
            bg_hex = bin_bg_map.get(bin_color, "#64748b")
            
            st.markdown(f"""
            <div class="bin-card" style="background-color: {bg_hex};">
                <h3 style="margin:0 0 6px 0; font-size:1.4rem;">🗑️ โปรดทิ้งลง: {classification.get('bin_color_th')}</h3>
                <p style="margin:0; font-size:1.1rem; opacity:0.95;">
                    🏷️ <strong>ประเภท:</strong> {classification.get('waste_type_th')} (ความมั่นใจ {classification.get('primary_confidence', 0)*100:.1f}%)
                </p>
                <p style="margin:6px 0 0 0; font-size:1rem; opacity:0.9;">
                    💡 <strong>คำแนะนำ:</strong> {classification.get('instruction')}
                </p>
            </div>
            """, unsafe_allow_html=True)
            
            # Audio playback
            audio_file = classification.get("audio_file")
            if audio_file and os.path.exists(os.path.join("static", "audio", audio_file)):
                audio_path = os.path.join("static", "audio", audio_file)
                st.audio(audio_path, format="audio/mp3", autoplay=True)
                st.caption(f"🔊 เสียงแนะนำภาษาไทย: {audio_file}")
                
            st.info(f"⚡ เวลาประมวลผล AI: {proc_time:.1f} ms | วัตถุที่พบ: {len(classification.get('items_detected', []))} ชิ้น")
        else:
            st.info("👆 กรุณาเปิดกล้องหรืออัปโหลดรูปภาพเพื่อเริ่มการวิเคราะห์")

with tab_dash:
    st.subheader("📊 แดชบอร์ดสรุปสถิติการทิ้งขยะแบบเรียลไทม์")
    stats = get_stats()
    
    # 4 Key Metrics
    m1, m2, m3, m4 = st.columns(4)
    with m1:
        st.metric("📦 ขยะทั้งหมดที่คัดแยก", f"{stats.get('total_detections', 0):,} ชิ้น")
    with m2:
        st.metric("♻️ ขยะรีไซเคิล", f"{stats.get('recyclable_count', 0):,} ชิ้น")
    with m3:
        st.metric("🌱 ลดคาร์บอน (CO₂ Saved)", f"{stats.get('co2_saved_kg', 0):.2f} kg")
    with m4:
        st.metric("⚡ อัตราส่วนรีไซเคิล", f"{stats.get('recycle_rate', 0):.1f}%")
        
    st.divider()
    
    # Chart & breakdown
    c1, c2 = st.columns([1, 1])
    with c1:
        st.markdown("#### 🥧 สัดส่วนประเภทขยะ")
        by_color = stats.get("by_color", {})
        if any(by_color.values()):
            import pandas as pd
            chart_data = pd.DataFrame({
                "ถังขยะ": ["ถังรีไซเคิล (น้ำเงิน)", "ถังขยะเปียก (เขียว)", "ถังขยะทั่วไป (เหลือง)", "ถังขยะอันตราย (แดง)"],
                "จำนวนชิ้น": [
                    by_color.get("blue", 0),
                    by_color.get("green", 0),
                    by_color.get("yellow", 0),
                    by_color.get("red", 0)
                ]
            })
            st.bar_chart(chart_data.set_index("ถังขยะ"))
        else:
            st.caption("ยังไม่มีข้อมูลสถิติเพียงพอ")
            
    with c2:
        st.markdown("#### 🕒 ประวัติการสแกนล่าสุด (Recent Detections)")
        recent = stats.get("recent_detections", [])
        if recent:
            import pandas as pd
            df_recent = pd.DataFrame(recent)
            cols_to_show = ["id", "waste_type_th", "bin_color_th", "primary_confidence", "created_at"]
            available_cols = [c for c in cols_to_show if c in df_recent.columns]
            st.dataframe(df_recent[available_cols], use_container_width=True, hide_index=True)
        else:
            st.caption("ยังไม่มีรายการสแกน")
            
    st.divider()
    if st.button("🗑️ รีเซ็ตฐานข้อมูลสถิติ (Reset Database)", type="secondary"):
        reset_all_detections()
        st.success("รีเซ็ตข้อมูลสถิติเรียบร้อยแล้ว!")
        st.rerun()

with tab_about:
    st.subheader("💡 วัตถุประสงค์และที่มาของโครงการ")
    st.markdown("""
    **ระบบจำแนกประเภทขยะอัจฉริยะเพื่อการจัดการสิ่งแวดล้อมในพื้นที่สาธารณะ**
    
    * **ทำอะไร (What):** ระบบปัญญาประดิษฐ์ (AI) สำหรับจำแนกประเภทขยะผ่านกล้องแบบอัตโนมัติ พร้อมแสดงสีถังขยะที่ถูกต้องและให้คำแนะนำด้วยเสียงภาษาไทย
    * **ทำทำไม (Why):** เพื่อแก้ปัญหาประชาชนทิ้งขยะผิดถัง ลดการปนเปื้อนของขยะรีไซเคิล และช่วยลดภาวะโลกร้อน (Greenhouse Gas Emission)
    * **ทำอย่างไร (How):** ใช้สถาปัตยกรรม Deep Learning **Ultralytics YOLOv8** ฝึกฝนกับชุดข้อมูลภาพขยะในชีวิตประจำวัน เชื่อมโยงกับฐานข้อมูลจัดเก็บสถิติและประเมินปริมาณการลดการปล่อยก๊าซคาร์บอนไดออกไซด์ (CO₂ Reduction)
    """)
