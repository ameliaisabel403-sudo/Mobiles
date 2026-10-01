/* ==========================================================================
   COMPANY PHONE TRACKER - SMART QR CODE PARSER & SCANNER MODULE
   ========================================================================== */

let html5QrCodeScanner = null;
let currentScanCallback = null;

// Smart QR Payload Parser: Normalizes any scanned string into 'PHONE-XXX' format
export function parsePhoneIdFromQR(scannedText) {
  if (!scannedText) return '';
  let str = String(scannedText).trim();

  // 1. Extract last segment if text is a URL (e.g. https://site.com/PHONE-005)
  if (str.includes('/')) {
    const parts = str.split('/').filter(p => p.length > 0);
    str = parts[parts.length - 1] || str;
  }

  // 2. Match pattern 'PHONE-1', 'phone-001', 'PHONE001'
  const match = str.match(/PHONE-?(\d+)/i);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 20) {
      return `PHONE-${String(num).padStart(3, '0')}`;
    }
  }

  // 3. Match pure numbers e.g. '1', '01', '001'
  if (/^\d+$/.test(str)) {
    const num = parseInt(str, 10);
    if (num >= 1 && num <= 20) {
      return `PHONE-${String(num).padStart(3, '0')}`;
    }
  }

  // 4. Default fallback: Clean uppercase string
  return str.toUpperCase();
}

// Audio Beep Feedback using Web Audio API
function playBeepSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

// Open Camera Scanner Modal
export function openScannerModal(onScanSuccess) {
  currentScanCallback = onScanSuccess;
  const modal = document.getElementById('scanner-modal');
  if (modal) modal.classList.add('active');

  initCameraStream();
}

// Close Camera Scanner Modal
export function closeScannerModal() {
  stopCameraStream();
  const modal = document.getElementById('scanner-modal');
  if (modal) modal.classList.remove('active');
  currentScanCallback = null;
}

// Initialize Camera Stream
async function initCameraStream() {
  const qrRegion = document.getElementById('qr-reader');
  if (!qrRegion) return;

  try {
    if (window.Html5Qrcode) {
      if (html5QrCodeScanner) {
        await stopCameraStream();
      }

      html5QrCodeScanner = new window.Html5Qrcode("qr-reader");

      const config = {
        fps: 15,
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const minDim = Math.min(viewfinderWidth, viewfinderHeight);
          return { width: Math.floor(minDim * 0.75), height: Math.floor(minDim * 0.75) };
        },
        aspectRatio: 1.0,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };

      await html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScanResult(decodedText);
        },
        (errorMessage) => {}
      );

      showCameraStatus('🟢 Camera Active. Point at Phone QR Tag.');
    } else {
      showCameraStatus('⚠️ Loading camera scanner...');
    }
  } catch (err) {
    showCameraStatus('💡 Camera permission needed, or select Phone ID below.');
  }
}

// Stop Camera Stream
export async function stopCameraStream() {
  if (html5QrCodeScanner) {
    try {
      await html5QrCodeScanner.stop();
      html5QrCodeScanner.clear();
    } catch (e) {}
    html5QrCodeScanner = null;
  }
}

// Handle Successful QR Scan
function handleScanResult(scannedRawValue) {
  if (!scannedRawValue) return;

  // Smart sanitize payload into valid 'PHONE-XXX'
  const cleanPhoneId = parsePhoneIdFromQR(scannedRawValue);

  playBeepSound();

  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100]); } catch (e) {}
  }

  closeScannerModal();

  if (currentScanCallback) {
    currentScanCallback(cleanPhoneId);
  }
}

function showCameraStatus(msg) {
  const statusEl = document.getElementById('camera-status-msg');
  if (statusEl) statusEl.textContent = msg;
}
