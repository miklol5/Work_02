// Smart Public Waste AI - Client Application Logic (Photo Capture & Scan Mode)

let videoStream = null;
let currentFacingMode = "environment"; // Default to back camera for mobile
let confidenceThreshold = 0.35;
let voiceEnabled = true;

// DOM Elements
const webcamVideo = document.getElementById('webcamVideo');
const detectionCanvas = document.getElementById('detectionCanvas');
const snapshotCanvas = document.getElementById('snapshotCanvas');
const cameraStandby = document.getElementById('cameraStandby');
const liveBadge = document.getElementById('liveBadge');
const btnFlipCamera = document.getElementById('btnFlipCamera');
const btnCameraToggle = document.getElementById('btnCameraToggle');
const cameraIcon = document.getElementById('cameraIcon');
const cameraBtnText = document.getElementById('cameraBtnText');
const btnCapture = document.getElementById('btnCapture');
const btnRetake = document.getElementById('btnRetake');
const scanOverlay = document.getElementById('scanOverlay');

// Guidance Card Elements
const mainResultCard = document.getElementById('mainResultCard');
const emptyState = document.getElementById('emptyState');
const detectedState = document.getElementById('detectedState');
const detectedIcon = document.getElementById('detectedIcon');
const detectedName = document.getElementById('detectedName');
const detectedConfidence = document.getElementById('detectedConfidence');
const binBox = document.getElementById('binBox');
const binTitle = document.getElementById('binTitle');
const binIconWrapper = document.getElementById('binIconWrapper');
const ecoTip = document.getElementById('ecoTip');
const resultGlow = document.getElementById('resultGlow');
const quickCo2Saved = document.getElementById('quickCo2Saved');
const quickTotalSorted = document.getElementById('quickTotalSorted');

// Audio Element for Fallback Audio
const voiceAudio = new Audio();
let audioUnlocked = false;

// Pre-load voices for SpeechSynthesis
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.getVoices();
}

function unlockAudioOnGesture() {
    if (!audioUnlocked) {
        try {
            voiceAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
            voiceAudio.play().catch(() => {});
            audioUnlocked = true;
        } catch (e) {}
    }
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.resume();
        } catch (e) {}
    }
}

// 1. Camera Initialization
async function startCamera() {
    unlockAudioOnGesture();
    try {
        if (videoStream) {
            stopCamera();
        }

        const constraints = {
            audio: false,
            video: {
                facingMode: { ideal: currentFacingMode },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        webcamVideo.srcObject = videoStream;

        await new Promise((resolve) => {
            webcamVideo.onloadedmetadata = () => {
                webcamVideo.play();
                resolve();
            };
        });

        // Set canvas internal dimensions to match video
        detectionCanvas.width = webcamVideo.videoWidth || 1280;
        detectionCanvas.height = webcamVideo.videoHeight || 720;
        snapshotCanvas.width = webcamVideo.videoWidth || 1280;
        snapshotCanvas.height = webcamVideo.videoHeight || 720;

        // UI Updates
        cameraStandby.classList.add('opacity-0', 'pointer-events-none');
        liveBadge.classList.remove('hidden');
        btnFlipCamera.classList.remove('hidden');
        cameraIcon.className = "fa-solid fa-stop";
        cameraBtnText.textContent = "ปิดกล้อง";
        btnCameraToggle.classList.replace('bg-emerald-600', 'bg-red-600');
        btnCameraToggle.classList.replace('hover:bg-emerald-500', 'hover:bg-red-500');

        // Show Shutter Button & Hide Retake
        btnCapture.classList.remove('hidden');
        btnRetake.classList.add('hidden');
        resetGuidanceCard();
    } catch (err) {
        console.error("Camera access failed:", err);
        alert("ไม่สามารถเข้าถึงกล้องได้: โปรดตรวจสอบสิทธิ์การใช้งานกล้องในเบราว์เซอร์");
    }
}

function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    webcamVideo.srcObject = null;

    // Clear canvas
    const ctx = detectionCanvas.getContext('2d');
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);

    // Reset UI
    cameraStandby.classList.remove('opacity-0', 'pointer-events-none');
    liveBadge.classList.add('hidden');
    btnFlipCamera.classList.add('hidden');
    cameraIcon.className = "fa-solid fa-video";
    cameraBtnText.textContent = "เปิดกล้อง";
    btnCameraToggle.classList.replace('bg-red-600', 'bg-emerald-600');
    btnCameraToggle.classList.replace('hover:bg-red-500', 'hover:bg-emerald-500');

    btnCapture.classList.add('hidden');
    btnRetake.classList.add('hidden');
    resetGuidanceCard();
}

function toggleCamera() {
    if (videoStream) {
        stopCamera();
    } else {
        startCamera();
    }
}

async function flipCamera() {
    currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
    if (videoStream) {
        await startCamera();
    }
}

// 2. Snapshot & Scan Logic (Photo Mode)
async function takeSnapshotAndDetect() {
    if (!videoStream || !webcamVideo.videoWidth) {
        alert("กรุณาเปิดกล้องก่อนถ่ายรูปครับ");
        return;
    }

    // Unlock audio & speech in this synchronous user gesture
    unlockAudioOnGesture();

    const w = webcamVideo.videoWidth;
    const h = webcamVideo.videoHeight;
    detectionCanvas.width = w;
    detectionCanvas.height = h;
    snapshotCanvas.width = w;
    snapshotCanvas.height = h;

    // 1. FREEZE the viewfinder on the captured frame
    try {
        webcamVideo.pause();
    } catch (e) {}

    // 2. Draw frozen frame to overlay canvas & snapshot canvas
    const ctx = detectionCanvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0, w, h);

    const snapCtx = snapshotCanvas.getContext('2d');
    snapCtx.drawImage(webcamVideo, 0, 0, w, h);
    const base64Data = snapshotCanvas.toDataURL('image/jpeg', 0.90);

    // 3. Show Scanning Loading Overlay & switch buttons
    scanOverlay.classList.remove('hidden');
    btnCapture.classList.add('hidden');

    try {
        const formData = new FormData();
        formData.append("image_base64", base64Data);
        formData.append("conf_threshold", confidenceThreshold);

        const res = await fetch("/api/detect", {
            method: "POST",
            body: formData
        });

        const data = await res.json();
        scanOverlay.classList.add('hidden');

        if (data.status === "success") {
            handleDetectionResults(data.detections || []);
        } else {
            alert("เกิดข้อผิดพลาดในการวิเคราะห์: " + (data.message || "Unknown"));
        }
    } catch (err) {
        scanOverlay.classList.add('hidden');
        alert("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
        btnRetake.classList.remove('hidden');
    }
}

// Handle Direct File Upload / Mobile Camera Photo
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    unlockAudioOnGesture();

    if (videoStream) {
        stopCamera();
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            detectionCanvas.width = img.width;
            detectionCanvas.height = img.height;
            const ctx = detectionCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            cameraStandby.classList.add('opacity-0', 'pointer-events-none');
            scanOverlay.classList.remove('hidden');
            btnCapture.classList.add('hidden');

            try {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("conf_threshold", confidenceThreshold);

                const res = await fetch("/api/detect", {
                    method: "POST",
                    body: formData
                });

                const data = await res.json();
                scanOverlay.classList.add('hidden');

                if (data.status === "success") {
                    handleDetectionResults(data.detections || []);
                } else {
                    alert("เกิดข้อผิดพลาดในการวิเคราะห์: " + (data.message || "Unknown"));
                }
            } catch (err) {
                scanOverlay.classList.add('hidden');
                alert("ไม่สามารถวิเคราะห์ภาพได้ กรุณาลองใหม่อีกครั้ง");
            } finally {
                btnRetake.classList.remove('hidden');
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function retakePhoto() {
    // Clear canvas
    const ctx = detectionCanvas.getContext('2d');
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);

    resetGuidanceCard();
    btnRetake.classList.add('hidden');

    if (videoStream) {
        // Resume live camera stream
        try {
            webcamVideo.play();
        } catch (e) {}
        btnCapture.classList.remove('hidden');
    } else {
        cameraStandby.classList.remove('opacity-0', 'pointer-events-none');
    }
}

// 3. Render Results & Bounding Boxes
function handleDetectionResults(detections) {
    const ctx = detectionCanvas.getContext('2d');

    if (!detections || detections.length === 0) {
        showNoDetectionFeedback();
        return;
    }

    // Sort by highest confidence
    detections.sort((a, b) => b.confidence - a.confidence);
    const topItem = detections[0];

    // Draw Bounding Boxes on overlay canvas over frozen frame
    detections.forEach((det) => {
        const [normX1, normY1, normX2, normY2] = det.norm_box;
        const x = normX1 * detectionCanvas.width;
        const y = normY1 * detectionCanvas.height;
        const w = (normX2 - normX1) * detectionCanvas.width;
        const h = (normY2 - normY1) * detectionCanvas.height;

        // Choose color
        let strokeColor = "#2563eb"; // Blue
        if (det.bin_color === "yellow") strokeColor = "#eab308";
        if (det.bin_color === "green") strokeColor = "#16a34a";
        if (det.bin_color === "red") strokeColor = "#dc2626";

        // Draw Box
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, w, h);

        // Draw Tag Background
        const labelText = `${det.thai_name} (${det.confidence}%)`;
        ctx.font = "bold 16px Prompt, sans-serif";
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = strokeColor;
        ctx.fillRect(x, Math.max(0, y - 28), textWidth + 16, 28);

        // Draw Text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(labelText, x + 8, Math.max(20, y - 8));
    });

    // Update Guidance Card
    updateGuidanceCard(topItem);

    // Speak Voice Alert (เหมือนตอนแรก)
    if (voiceEnabled) {
        let audioUrl = topItem.audio_file;
        if (!audioUrl) {
            const binAudioMap = {
                'yellow': '/static/audio/plastic.mp3',
                'green': '/static/audio/organic.mp3',
                'red': '/static/audio/e-waste.mp3',
                'blue': '/static/audio/general.mp3'
            };
            audioUrl = binAudioMap[topItem.bin_color] || '/static/audio/general.mp3';
        }
        speakThai(topItem.voice_alert, audioUrl);
    }

    // Auto Log to Database
    logToBackend(topItem);
}

function showNoDetectionFeedback() {
    detectedState.classList.add('hidden');
    emptyState.classList.remove('hidden');

    emptyState.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 text-3xl mb-3">
            <i class="fa-solid fa-magnifying-glass"></i>
        </div>
        <h4 class="text-base md:text-lg font-bold text-amber-400">ยังตรวจไม่พบขยะในภาพ</h4>
        <p class="text-xs text-slate-300 mt-1 max-w-xs">กรุณานำขยะมาจ่อให้ชัดเจน หรือขยับมุมกล้อง แล้วกดปุ่มถ่ายรูปใหม่อีกครั้งครับ</p>
    `;

    if (voiceEnabled) {
        speakThai("ไม่พบประเภทขยะในภาพค่ะ กรุณาถ่ายใหม่อีกครั้ง", "/static/audio/not_found.mp3");
    }
}

function updateGuidanceCard(item) {
    emptyState.classList.add('hidden');
    detectedState.classList.remove('hidden');

    detectedIcon.textContent = item.icon || "🗑️";
    detectedName.textContent = item.thai_name;
    detectedConfidence.textContent = `${item.confidence}% ความมั่นใจ`;

    const color = item.bin_color;
    binBox.className = `p-4 rounded-xl border flex items-center space-x-3 transition-colors ${getBinThemeClasses(color)}`;
    binTitle.textContent = item.bin_title;
    binTitle.className = `font-bold text-base md:text-lg ${getBinTextClasses(color)}`;
    binIconWrapper.className = `w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${getBinIconBgClasses(color)}`;
    binIconWrapper.innerHTML = getBinIconHtml(color);

    ecoTip.textContent = item.instruction || item.eco_tip || "แยกขยะเพื่อโลกที่สะอาดขึ้น";

    // Dynamic result glow
    resultGlow.className = `absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all ${getGlowColor(color)}`;
}

function getBinThemeClasses(color) {
    switch (color) {
        case 'yellow': return "bg-yellow-500/10 border-yellow-500/40";
        case 'green': return "bg-green-500/10 border-green-500/40";
        case 'red': return "bg-red-500/10 border-red-500/40";
        default: return "bg-blue-500/10 border-blue-500/40";
    }
}

function getBinTextClasses(color) {
    switch (color) {
        case 'yellow': return "text-yellow-400";
        case 'green': return "text-green-400";
        case 'red': return "text-red-400";
        default: return "text-blue-400";
    }
}

function getBinIconBgClasses(color) {
    switch (color) {
        case 'yellow': return "bg-yellow-500/20 text-yellow-300";
        case 'green': return "bg-green-500/20 text-green-300";
        case 'red': return "bg-red-500/20 text-red-300";
        default: return "bg-blue-500/20 text-blue-300";
    }
}

function getBinIconHtml(color) {
    switch (color) {
        case 'yellow': return '<i class="fa-solid fa-recycle"></i>';
        case 'green': return '<i class="fa-solid fa-leaf"></i>';
        case 'red': return '<i class="fa-solid fa-triangle-exclamation"></i>';
        default: return '<i class="fa-solid fa-trash-can"></i>';
    }
}

function getGlowColor(color) {
    switch (color) {
        case 'yellow': return "bg-yellow-500/20";
        case 'green': return "bg-green-500/20";
        case 'red': return "bg-red-500/20";
        default: return "bg-blue-500/20";
    }
}

function resetGuidanceCard() {
    detectedState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    emptyState.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center text-slate-400 text-3xl mb-3">
            <i class="fa-solid fa-camera"></i>
        </div>
        <h4 class="text-base md:text-lg font-bold text-white">พร้อมตรวจจับขยะ</h4>
        <p class="text-xs text-slate-400 mt-1 max-w-xs">นำขยะมาจ่อหน้ากล้องให้ชัดเจน แล้วกดปุ่ม "ถ่ายภาพเพื่อจำแนกขยะ"</p>
    `;
    resultGlow.className = "absolute -top-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none transition-all";
}

// 4. Voice Feedback (เสียงพูดเหมือนตอนแรก + สำรองด้วยไฟล์เสียง)
function speakThai(text, audioUrl = null) {
    if (!voiceEnabled) return;

    let spoken = false;

    // 1. Web Speech API (เสียงสังเคราะห์ภาษาไทยเหมือนตอนแรก)
    if ('speechSynthesis' in window) {
        try {
            window.speechSynthesis.cancel();
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            }
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'th-TH';
            utterance.rate = 1.0;
            const voices = window.speechSynthesis.getVoices();
            const thai = voices.find(v => v.lang && (v.lang.startsWith('th') || (v.name && v.name.toLowerCase().includes('thai'))));
            if (thai) utterance.voice = thai;

            utterance.onerror = (e) => {
                console.warn("SpeechSynthesis error, falling back to MP3:", e);
                if (audioUrl) playVoiceAudioFile(audioUrl);
            };

            window.speechSynthesis.speak(utterance);
            spoken = true;
        } catch (e) {
            console.warn("Speech synthesis error:", e);
        }
    }

    // 2. หากเบราว์เซอร์ไม่รองรับ Web Speech หรือเล่นไม่สำเร็จ ให้ใช้ไฟล์เสียง MP3 แทน
    if (!spoken && audioUrl) {
        playVoiceAudioFile(audioUrl);
    }
}

function playVoiceAudioFile(audioUrl) {
    if (!audioUrl || !voiceEnabled) return;
    try {
        voiceAudio.pause();
        voiceAudio.currentTime = 0;
        voiceAudio.src = audioUrl;
        voiceAudio.play().catch(e => {
            console.warn("Audio file play error:", e);
        });
    } catch (e) {}
}

function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    const voiceIcon = document.getElementById('voiceIcon');
    const voiceStatusText = document.getElementById('voiceStatusText');
    const btn = document.getElementById('btnVoiceToggle');

    unlockAudioOnGesture();

    if (voiceEnabled) {
        voiceIcon.className = "fa-solid fa-volume-high";
        voiceStatusText.textContent = "เสียงแนะนำ: เปิด";
        btn.classList.replace('bg-slate-700', 'bg-emerald-600/30');
        btn.classList.replace('text-slate-300', 'text-emerald-300');
        speakThai("ระบบเสียงแนะนำเปิดแล้วค่ะ", "/static/audio/general.mp3");
    } else {
        voiceIcon.className = "fa-solid fa-volume-xmark";
        voiceStatusText.textContent = "เสียงแนะนำ: ปิด";
        btn.classList.replace('bg-emerald-600/30', 'bg-slate-700');
        btn.classList.replace('text-emerald-300', 'text-slate-300');
        try {
            voiceAudio.pause();
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
        } catch (e) {}
    }
}

// 5. Database Logging & Quick Stats
async function logToBackend(item) {
    try {
        const formData = new FormData();
        formData.append("class_name", item.thai_name);
        formData.append("waste_type", item.waste_type);
        formData.append("bin_color", item.bin_color);
        formData.append("confidence", item.confidence);
        formData.append("co2_saved_g", item.co2_saved_g || 0);

        await fetch("/api/log", {
            method: "POST",
            body: formData
        });

        fetchQuickStats();
    } catch (e) {
        console.warn("Auto-log failed:", e);
    }
}

async function fetchQuickStats() {
    try {
        const res = await fetch("/api/stats");
        const json = await res.json();
        if (json.status === "success" && json.data) {
            const summary = json.data.summary;
            if (quickCo2Saved) quickCo2Saved.textContent = (summary.total_co2_kg || 0).toFixed(2);
            if (quickTotalSorted) quickTotalSorted.textContent = summary.total_sorted || 0;
        }
    } catch (e) {
        console.warn("Fetch stats error:", e);
    }
}

// On page load
document.addEventListener("DOMContentLoaded", () => {
    fetchQuickStats();
    // Warm up audio
    document.body.addEventListener('click', () => {
        unlockAudioOnGesture();
    }, { once: true });

    // Demo Mode for presentation and screenshot capture
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') {
        detectionCanvas.width = 1280;
        detectionCanvas.height = 720;
        const ctx = detectionCanvas.getContext('2d');
        
        // Draw realistic background and sample plastic bottle
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, 1280, 720);

        // Table surface
        ctx.fillStyle = "#1e293b";
        ctx.beginPath();
        ctx.ellipse(640, 560, 480, 140, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bottle body
        ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
        ctx.strokeStyle = "#38bdf8";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(560, 220, 160, 310, [30, 30, 15, 15]);
        ctx.fill();
        ctx.stroke();

        // Bottle neck & cap
        ctx.fillStyle = "#0284c7";
        ctx.fillRect(610, 160, 60, 60);
        ctx.fillStyle = "#0ea5e9";
        ctx.fillRect(600, 135, 80, 28);

        // Water level inside bottle
        ctx.fillStyle = "rgba(14, 165, 233, 0.6)";
        ctx.beginPath();
        ctx.roundRect(568, 320, 144, 202, [5, 5, 12, 12]);
        ctx.fill();

        cameraStandby.classList.add('opacity-0', 'pointer-events-none');
        liveBadge.classList.remove('hidden');
        liveBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span><span class="font-medium text-white tracking-wide pl-1">CAPTURED & SCANNED</span>';
        btnCapture.classList.add('hidden');
        btnRetake.classList.remove('hidden');

        handleDetectionResults([{
            raw_class: "plastic bottle",
            thai_name: "ขวดพลาสติก / พลาสติกรีไซเคิล",
            waste_type: "ขยะรีไซเคิล",
            bin_color: "yellow",
            bin_title: "ถังขยะรีไซเคิล (สีเหลือง)",
            icon: "♻️",
            instruction: "เทของเหลวออกให้หมด บีบขวดให้แบนก่อนทิ้งลงถังขยะรีไซเคิลสีเหลือง",
            voice_alert: "ขวดพลาสติก กรุณาทิ้งลงถังสีเหลือง ถังรีไซเคิลค่ะ",
            confidence: 94.8,
            co2_saved_g: 35.0,
            norm_box: [0.42, 0.16, 0.58, 0.78]
        }]);
    }
});
