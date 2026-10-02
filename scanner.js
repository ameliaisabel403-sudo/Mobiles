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

  showCameraStatus('⌛ Checking camera...');

  try {
    // Make sure the QR reader area is clean before creating a new scanner.
    if (html5QrCodeScanner) {
      await stopCameraStream();
    }

    if (!window.Html5Qrcode) {
      showCameraStatus('❌ QR scanner library is not loaded. Refresh the page and try again.');
      return;
    }

    // Check browser camera support/permission.
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraStatus('❌ Camera access is not supported here. Open the Vercel HTTPS site in Chrome/Edge.');
      return;
    }

    html5QrCodeScanner = new window.Html5Qrcode("qr-reader");

    showCameraStatus('⌛ Finding available camera...');

    // Get actual camera devices. This is more reliable than relying only on
    // { facingMode: "environment" }.
    let cameras = [];
    try {
      cameras = await window.Html5Qrcode.getCameras();
    } catch (cameraListError) {
      console.warn('Could not list cameras:', cameraListError);
    }

    const rearCamera =
      cameras.find(c => /back|rear|environment|world/i.test(c.label || '')) ||
      cameras[cameras.length - 1];

    const cameraConfig = rearCamera
      ? { deviceId: { exact: rearCamera.id } }
      : { facingMode: "environment" };

    const config = {
      fps: 10,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minDim = Math.min(viewfinderWidth, viewfinderHeight);
        const size = Math.max(180, Math.floor(minDim * 0.75));
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
      disableFlip: false
    };

    showCameraStatus('⌛ Starting camera...');

    await html5QrCodeScanner.start(
      cameraConfig,
      config,
      (decodedText) => {
        handleScanResult(decodedText);
      },
      () => {
        // QR decode errors are normal while the camera is searching.
      }
    );

    showCameraStatus('🟢 Camera Active. Point the rear camera at the Phone QR Code.');
  } catch (err) {
    console.error('Camera start error:', err);

    const message = String(err?.message || err || '');

    if (/permission|notallowed|denied/i.test(message)) {
      showCameraStatus('❌ Camera permission denied. Allow Camera access for this website, then reload.');
    } else if (/notfound|no camera|device not found/i.test(message)) {
      showCameraStatus('❌ No camera was found. Check that your device has a working camera.');
    } else if (/secure|https/i.test(message) || location.protocol !== 'https:') {
      showCameraStatus('❌ Camera requires HTTPS. Open the Vercel HTTPS address, not a local file.');
    } else {
      showCameraStatus(`❌ Camera could not start: ${message || 'Unknown camera error'}`);
    }

    // Clean up failed scanner instance.
    try {
      if (html5QrCodeScanner) {
        await html5QrCodeScanner.clear();
      }
    } catch (e) {}

    html5QrCodeScanner = null;
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
async function handleScanResult(scannedRawValue) {
  if (!scannedRawValue) return;

  const cleanPhoneId = parsePhoneIdFromQR(scannedRawValue);

  playBeepSound();

  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100]); } catch (e) {}
  }

  // Save the callback BEFORE stopping/closing the scanner.
  // closeScannerModal() clears currentScanCallback.
  const callback = currentScanCallback;

  await stopCameraStream();

  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
  }

  currentScanCallback = null;

  if (callback) {
    callback(cleanPhoneId);
  }
}

function showCameraStatus(msg) {
  const statusEl = document.getElementById('camera-status-msg');
  if (statusEl) statusEl.textContent = msg;
}
