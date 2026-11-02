// Smart Public Waste AI - Client Application Logic (Capture & Scan Mode)

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
const confThresholdInput = document.getElementById('confThreshold');
const confDisplay = document.getElementById('confDisplay');
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

// Voice Feedback
const synth = window.speechSynthesis;

// 1. Camera Initialization
async function startCamera() {
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

function flipCamera() {
    currentFacingMode = (currentFacingMode === "environment") ? "user" : "environment";
    if (videoStream) {
        startCamera();
    }
}

function updateThreshold(val) {
    confidenceThreshold = val / 100.0;
    confDisplay.textContent = val + "%";
}

// 2. Snapshot & Scan Logic (High Resolution & High Accuracy)
async function takeSnapshotAndDetect() {
    if (!videoStream || !webcamVideo.videoWidth) {
        alert("กรุณาเปิดกล้องก่อนถ่ายรูปครับ");
        return;
    }

    // Unlock audio playback immediately within user touch gesture
    unlockAudioOnGesture();

    const w = webcamVideo.videoWidth;
    const h = webcamVideo.videoHeight;
    detectionCanvas.width = w;
    detectionCanvas.height = h;
    snapshotCanvas.width = w;
    snapshotCanvas.height = h;

    // Freeze snapshot on canvas
    const ctx = detectionCanvas.getContext('2d');
    ctx.drawImage(webcamVideo, 0, 0, w, h);

    // Capture high quality frame for AI
    const snapCtx = snapshotCanvas.getContext('2d');
    snapCtx.drawImage(webcamVideo, 0, 0, w, h);
    const base64Data = snapshotCanvas.toDataURL('image/jpeg', 0.88);

    // Show Scanning Loading Overlay
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

function retakePhoto() {
    // Clear canvas
    const ctx = detectionCanvas.getContext('2d');
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);

    resetGuidanceCard();
    btnRetake.classList.add('hidden');
    btnCapture.classList.remove('hidden');
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

    // Speak Voice Alert
    if (voiceEnabled) {
        playVoiceAudio(topItem.audio_file, topItem.voice_alert);
    }

    // Auto Log to Database
    logToBackend(topItem);
}

function showNoDetectionFeedback() {
    emptyState.classList.remove('hidden');
    detectedState.classList.add('hidden');

    emptyState.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-3xl mb-3 shadow-inner">
            ⚠️
        </div>
        <h3 class="text-base md:text-lg font-bold text-amber-300">ไม่พบประเภทขยะในภาพนี้</h3>
        <p class="text-xs text-slate-300 mt-1 max-w-xs leading-relaxed">
            กรุณาถือกล้องนิ่งๆ ขยับเข้าใกล้วัตถุมากขึ้น หรือปรับมุมแสง แล้วกดปุ่ม <b>"ถ่ายรูปใหม่"</b> อีกครั้งครับ
        </p>
    `;

    if (voiceEnabled) {
        playVoiceAudio("/static/audio/not_found.mp3", "ไม่พบประเภทขยะในภาพค่ะ กรุณาถ่ายใหม่อีกครั้ง");
    }
}

function updateGuidanceCard(item) {
    emptyState.classList.add('hidden');
    detectedState.classList.remove('hidden');

    detectedIcon.textContent = item.icon || "🗑️";
    detectedName.textContent = item.thai_name;
    detectedConfidence.textContent = `${item.confidence}% ความมั่นใจ`;
    binTitle.textContent = item.bin_title;
    ecoTip.textContent = item.instruction;

    // Apply color styling to binBox
    const colorStyles = {
        yellow: {
            border: 'border-yellow-400',
            bg: 'bg-yellow-500/15',
            text: 'text-yellow-300',
            iconBg: 'bg-yellow-500 text-slate-900',
            glow: 'bg-yellow-500/20'
        },
        green: {
            border: 'border-green-500',
            bg: 'bg-green-500/15',
            text: 'text-green-300',
            iconBg: 'bg-green-500 text-white',
            glow: 'bg-green-500/20'
        },
        red: {
            border: 'border-red-500',
            bg: 'bg-red-500/15',
            text: 'text-red-300',
            iconBg: 'bg-red-500 text-white',
            glow: 'bg-red-500/20'
        },
        blue: {
            border: 'border-blue-500',
            bg: 'bg-blue-500/15',
            text: 'text-blue-300',
            iconBg: 'bg-blue-500 text-white',
            glow: 'bg-blue-500/20'
        }
    };

    const style = colorStyles[item.bin_color] || colorStyles.blue;
    binBox.className = `w-full my-3 p-4 rounded-xl border-2 flex items-center justify-center gap-3 shadow-lg transition-all duration-300 ${style.border} ${style.bg} ${style.text}`;
    binIconWrapper.className = `w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-md ${style.iconBg}`;
    resultGlow.className = `absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-all ${style.glow}`;
}

function resetGuidanceCard() {
    emptyState.classList.remove('hidden');
    detectedState.classList.add('hidden');
    emptyState.innerHTML = `
        <div class="w-16 h-16 rounded-2xl bg-slate-700/60 border border-slate-600 flex items-center justify-center text-3xl mb-3 shadow-inner">
            📷
        </div>
        <h3 class="text-base md:text-lg font-bold text-slate-200">พร้อมถ่ายรูปสแกนขยะ</h3>
        <p class="text-xs text-slate-400 mt-1 max-w-xs">นำขยะมาจ่อหน้ากล้องในระยะ 30-80 ซม. แล้วกดปุ่ม "ถ่ายรูปเพื่อสแกนขยะ"</p>
    `;
    resultGlow.className = "absolute -top-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none transition-all";
}

// 4. Voice Feedback (Dual Engine: Natural Human MP3 + Web Speech Fallback)
const voiceAudio = new Audio();
let audioUnlocked = false;

function unlockAudioOnGesture() {
    if (!audioUnlocked) {
        try {
            voiceAudio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
            voiceAudio.play().catch(() => {});
            audioUnlocked = true;
        } catch (e) {}
    }
}

function playVoiceAudio(audioUrl, fallbackText) {
    if (!voiceEnabled) return;

    if (audioUrl) {
        try {
            voiceAudio.pause();
            voiceAudio.currentTime = 0;
            voiceAudio.src = audioUrl;
            const playPromise = voiceAudio.play();
            if (playPromise !== undefined) {
                playPromise.catch(() => {
                    speakFallbackThai(fallbackText);
                });
            }
        } catch (e) {
            speakFallbackThai(fallbackText);
        }
    } else {
        speakFallbackThai(fallbackText);
    }
}

function speakFallbackThai(text) {
    if (!('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1.0;
        const voices = window.speechSynthesis.getVoices();
        const thai = voices.find(v => v.lang && (v.lang.startsWith('th') || v.name.toLowerCase().includes('thai')));
        if (thai) utterance.voice = thai;
        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn("Speech synthesis error:", e);
    }
}

function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    const voiceIcon = document.getElementById('voiceIcon');
    const voiceStatusText = document.getElementById('voiceStatusText');
    const btn = document.getElementById('btnVoiceToggle');

    if (voiceEnabled) {
        voiceIcon.className = "fa-solid fa-volume-high";
        voiceStatusText.textContent = "เสียงแนะนำ: เปิด";
        btn.classList.replace('bg-slate-700', 'bg-emerald-600/30');
        btn.classList.replace('text-slate-300', 'text-emerald-300');
    } else {
        voiceIcon.className = "fa-solid fa-volume-xmark";
        voiceStatusText.textContent = "เสียงแนะนำ: ปิด";
        btn.classList.replace('bg-emerald-600/30', 'bg-slate-700');
        btn.classList.replace('text-emerald-300', 'text-slate-300');
        try {
            voiceAudio.pause();
            window.speechSynthesis.cancel();
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
            quickCo2Saved.textContent = (json.data.co2_saved_kg || 0).toFixed(2);
            quickTotalSorted.textContent = json.data.total_today || 0;
        }
    } catch (e) {
        // Ignore background stat error
    }
}

// Initial fetch on page load
fetchQuickStats();
