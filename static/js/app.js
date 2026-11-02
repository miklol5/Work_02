// Smart Public Waste AI - Client Application Logic

let videoStream = null;
let currentFacingMode = "environment"; // Default to back camera for mobile
let isDetecting = false;
let detectionInterval = null;
let confidenceThreshold = 0.35;
let voiceEnabled = true;
let lastSpokenClass = "";
let lastSpokenTime = 0;
let lastLoggedClass = "";
let lastLoggedTime = 0;
let consecutiveCount = 0;

// DOM Elements
const webcamVideo = document.getElementById('webcamVideo');
const detectionCanvas = document.getElementById('detectionCanvas');
const snapshotCanvas = document.getElementById('snapshotCanvas');
const cameraStandby = document.getElementById('cameraStandby');
const liveBadge = document.getElementById('liveBadge');
const fpsCounter = document.getElementById('fpsCounter');
const btnFlipCamera = document.getElementById('btnFlipCamera');
const btnCameraToggle = document.getElementById('btnCameraToggle');
const cameraIcon = document.getElementById('cameraIcon');
const cameraBtnText = document.getElementById('cameraBtnText');
const confThresholdInput = document.getElementById('confThreshold');
const confDisplay = document.getElementById('confDisplay');

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
        detectionCanvas.width = webcamVideo.videoWidth || 640;
        detectionCanvas.height = webcamVideo.videoHeight || 480;
        snapshotCanvas.width = 640;
        snapshotCanvas.height = 480;

        // UI Updates
        cameraStandby.classList.add('opacity-0', 'pointer-events-none');
        liveBadge.classList.remove('hidden');
        btnFlipCamera.classList.remove('hidden');
        cameraIcon.className = "fa-solid fa-stop";
        cameraBtnText.textContent = "ปิดกล้อง";
        btnCameraToggle.classList.replace('bg-emerald-600', 'bg-red-600');
        btnCameraToggle.classList.replace('hover:bg-emerald-500', 'hover:bg-red-500');

        isDetecting = true;
        startDetectionLoop();
    } catch (err) {
        console.error("Camera access failed:", err);
        alert("ไม่สามารถเข้าถึงกล้องได้: โปรดตรวจสอบสิทธิ์การใช้งานกล้องในเบราว์เซอร์");
    }
}

function stopCamera() {
    isDetecting = false;
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }

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

// 2. Detection Loop (Continuous Streaming)
let isProcessingFrame = false;
let frameCount = 0;
let lastFpsTime = Date.now();

function startDetectionLoop() {
    if (detectionInterval) clearInterval(detectionInterval);

    // Run inference every 300ms (~3.3 FPS for ultra-stable server load)
    detectionInterval = setInterval(async () => {
        if (!isDetecting || isProcessingFrame || !videoStream) return;
        
        isProcessingFrame = true;
        await captureAndDetectFrame();
        isProcessingFrame = false;

        // Calculate FPS
        frameCount++;
        const now = Date.now();
        if (now - lastFpsTime >= 1000) {
            fpsCounter.textContent = `${frameCount} FPS`;
            frameCount = 0;
            lastFpsTime = now;
        }
    }, 300);
}

async function captureAndDetectFrame() {
    if (!webcamVideo.videoWidth) return;

    // Capture small snapshot for fast HTTP transmission
    const snapCtx = snapshotCanvas.getContext('2d');
    snapCtx.drawImage(webcamVideo, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
    const base64Data = snapshotCanvas.toDataURL('image/jpeg', 0.65);

    try {
        const formData = new FormData();
        formData.append("image_base64", base64Data);
        formData.append("conf_threshold", confidenceThreshold);

        const res = await fetch("/api/detect", {
            method: "POST",
            body: formData
        });

        if (!res.ok) return;
        const data = await res.json();

        if (data.status === "success") {
            handleDetectionResults(data.detections || []);
        }
    } catch (err) {
        // Silently handle frame loss in live stream
    }
}

// 3. Render Results & Bounding Boxes
function handleDetectionResults(detections) {
    const ctx = detectionCanvas.getContext('2d');
    ctx.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);

    if (!detections || detections.length === 0) {
        consecutiveCount = 0;
        resetGuidanceCard();
        return;
    }

    // Sort by highest confidence
    detections.sort((a, b) => b.confidence - a.confidence);
    const topItem = detections[0];

    // Draw Bounding Boxes on overlay canvas
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
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);

        // Draw Tag Background
        const labelText = `${det.thai_name} (${det.confidence}%)`;
        ctx.font = "bold 14px Prompt, sans-serif";
        const textWidth = ctx.measureText(labelText).width;

        ctx.fillStyle = strokeColor;
        ctx.fillRect(x, Math.max(0, y - 24), textWidth + 12, 24);

        // Draw Text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(labelText, x + 6, Math.max(16, y - 6));
    });

    // Update the Guidance Card on the right with the top detection
    updateGuidanceCard(topItem);

    // Handle Voice Feedback & Database Logging
    handleVoiceAndLog(topItem);
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
    resultGlow.className = "absolute -top-24 -right-24 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none transition-all";
}

// 4. Voice Feedback & Debounced DB Logging
function handleVoiceAndLog(item) {
    const now = Date.now();

    // Voice announcement (Every 4 seconds or when class changes)
    if (voiceEnabled && item.voice_alert) {
        if (item.thai_name !== lastSpokenClass || (now - lastSpokenTime) > 4500) {
            speakThai(item.voice_alert);
            lastSpokenClass = item.thai_name;
            lastSpokenTime = now;
        }
    }

    // Auto Log to Database (Prevent duplicate logging within 5 seconds for same object)
    if (item.thai_name !== lastLoggedClass || (now - lastLoggedTime) > 5000) {
        logToBackend(item);
        lastLoggedClass = item.thai_name;
        lastLoggedTime = now;
    }
}

function speakThai(text) {
    if (!('speechSynthesis' in window)) return;
    try {
        synth.cancel(); // Stop prior audio
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1.05;
        synth.speak(utterance);
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
        synth.cancel();
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

        // Refresh today's summary stats
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
