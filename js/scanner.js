/* ==========================================================================
   COMPANY PHONE TRACKER - FOOLPROOF CAMERA QR SCANNER & PARSER
   ========================================================================== */

let html5QrCodeScanner = null;
let currentScanCallback = null;

// Foolproof QR Payload Parser: Converts ANY text containing 1-20 into 'PHONE-XXX'
export function parsePhoneIdFromQR(scannedText) {
  if (!scannedText) return '';
  let str = String(scannedText).trim();

  // 1. Remove URL prefix if scanned from web link
  if (str.includes('/')) {
    const parts = str.split('/').filter(p => p.length > 0);
    str = parts[parts.length - 1] || str;
  }

  // 2. Extract any digits 1 to 20 (e.g., '1', '001', 'PHONE-1', 'phone001', 'Device #5')
  const digitMatch = str.match(/(\d+)/);
  if (digitMatch && digitMatch[1]) {
    const num = parseInt(digitMatch[1], 10);
    if (num >= 1 && num <= 20) {
      return `PHONE-${String(num).padStart(3, '0')}`;
    }
  }

  // 3. Fallback: Upper-case clean string
  return str.toUpperCase();
}

// Crisp Audio Beep Feedback via Web Audio API
function playBeepSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
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
  if (modal) {
    modal.classList.add('active');
  }

  // Wait 150ms for modal transition so #qr-reader has full layout dimensions
  setTimeout(() => {
    initCameraStream();
  }, 150);
}

// Close Camera Scanner Modal
export function closeScannerModal() {
  stopCameraStream();
  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
  }
  currentScanCallback = null;
}

// Initialize Camera Engine
async function initCameraStream() {
  const qrRegion = document.getElementById('qr-reader');
  if (!qrRegion) return;

  showCameraStatus('⌛ Starting camera engine...');

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
          return { width: Math.floor(minDim * 0.8), height: Math.floor(minDim * 0.8) };
        },
        aspectRatio: 1.0
      };

      // Try starting rear back camera ('environment')
      await html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScanResult(decodedText);
        },
        (errorMessage) => {}
      );

      showCameraStatus('🟢 Camera Active. Point camera at Phone QR Code.');
    } else {
      showCameraStatus('⚠️ Camera library loading... Try clicking Scan again.');
    }
  } catch (err) {
    console.warn('Primary camera note:', err);
    // Fallback: try default camera if facingMode environment fails
    try {
      if (html5QrCodeScanner) {
        await html5QrCodeScanner.start(
          true, // Use any default camera
          { fps: 15, qrbox: { width: 220, height: 220 } },
          (decodedText) => handleScanResult(decodedText),
          () => {}
        );
        showCameraStatus('🟢 Camera Active (Default). Point at QR Code.');
        return;
      }
    } catch (fallbackErr) {
      console.warn('Fallback camera note:', fallbackErr);
    }
    showCameraStatus('💡 Camera permission needed, or use quick select below.');
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

// Handle Successful QR Scan Result
function handleScanResult(scannedRawValue) {
  if (!scannedRawValue) return;

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
