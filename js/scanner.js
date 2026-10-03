/* ==========================================================================
   CINNAMON LIFE HK MOBILE - ROBUST CAMERA QR SCANNER & PARSER
   ========================================================================== */

let html5QrCodeScanner = null;
let currentScanCallback = null;

// Convert scanned QR text into standard format
export function parsePhoneIdFromQR(scannedText) {
  if (!scannedText) return '';

  let str = String(scannedText).trim();

  // Remove URL prefix if QR contains a URL
  if (str.includes('/')) {
    const parts = str.split('/').filter(p => p.length > 0);
    str = parts[parts.length - 1] || str;
  }

  // Extract number (e.g. 1 -> PHONE-001)
  const digitMatch = str.match(/(\d+)/);
  if (digitMatch && digitMatch[1]) {
    const num = parseInt(digitMatch[1], 10);
    if (num >= 1 && num <= 20) {
      return `PHONE-${String(num).padStart(3, '0')}`;
    }
  }

  return str.toUpperCase();
}

// Play pleasant audio beep when QR is detected
function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.warn('Audio beep note:', e);
  }
}

// ================================================================
// OPEN SCANNER
// ================================================================
export function openScannerModal(onScanSuccess) {
  currentScanCallback = onScanSuccess;

  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.add('active');
  }

  // Wait 250ms for modal DOM to be fully visible before starting camera
  setTimeout(() => {
    initCameraStream();
  }, 250);
}

// ================================================================
// CLOSE SCANNER
// ================================================================
export function closeScannerModal() {
  stopCameraStream();

  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
  }

  currentScanCallback = null;
}

// ================================================================
// START CAMERA WITH PROGRESSIVE FALLBACK
// ================================================================
async function initCameraStream() {
  const qrRegion = document.getElementById('qr-reader');
  if (!qrRegion) {
    console.error('QR reader container #qr-reader not found.');
    return;
  }

  showCameraStatus('⌛ Starting camera...');

  try {
    // 1. Stop any previous instance
    if (html5QrCodeScanner) {
      await stopCameraStream();
    }

    // 2. Check library availability
    if (!window.Html5Qrcode) {
      showCameraStatus('❌ QR scanner library not loaded. Please reload the page.');
      return;
    }

    // 3. Check browser mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraStatus('❌ Camera is not supported in this browser. Try Chrome or Safari over HTTPS.');
      return;
    }

    // 4. Create scanner instance
    html5QrCodeScanner = new window.Html5Qrcode('qr-reader');

    const config = {
      fps: 15,
      qrbox: (w, h) => {
        const min = Math.min(w, h);
        const size = Math.max(180, Math.floor(min * 0.75));
        return { width: size, height: size };
      },
      aspectRatio: 1.0,
      disableFlip: false
    };

    // Attempt Strategy 1: facingMode environment (rear mobile camera)
    try {
      await html5QrCodeScanner.start(
        { facingMode: 'environment' },
        config,
        decodedText => handleScanResult(decodedText),
        () => {}
      );
      showCameraStatus('🟢 Camera Active (Back Camera). Align QR code.');
      return;
    } catch (envError) {
      console.warn('Strategy 1 (facingMode: environment) failed:', envError);
    }

    // Attempt Strategy 2: query camera list and pick back or first camera
    try {
      const cameras = await window.Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        const backCam = cameras.find(c => /back|rear|environment|world/i.test(c.label || '')) || cameras[cameras.length - 1];
        await html5QrCodeScanner.start(
          backCam.id,
          config,
          decodedText => handleScanResult(decodedText),
          () => {}
        );
        showCameraStatus('🟢 Camera Active. Align QR code.');
        return;
      }
    } catch (camListError) {
      console.warn('Strategy 2 (Camera list) failed:', camListError);
    }

    // Attempt Strategy 3: user facing or default
    await html5QrCodeScanner.start(
      { facingMode: 'user' },
      config,
      decodedText => handleScanResult(decodedText),
      () => {}
    );
    showCameraStatus('🟢 Camera Active. Align QR code.');

  } catch (error) {
    console.error('All camera start strategies failed:', error);
    const msg = String(error?.message || error || '');

    if (/permission|notallowed|denied/i.test(msg)) {
      showCameraStatus('❌ Camera permission denied. Please allow camera access in browser settings.');
    } else if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      showCameraStatus('❌ Camera requires HTTPS. Please open the live Vercel URL.');
    } else {
      showCameraStatus(`❌ Could not start camera: ${msg}. Select Phone ID below.`);
    }

    try {
      if (html5QrCodeScanner) await html5QrCodeScanner.clear();
    } catch (e) {}
    html5QrCodeScanner = null;
  }
}

// ================================================================
// STOP CAMERA
// ================================================================
export async function stopCameraStream() {
  if (!html5QrCodeScanner) return;

  try {
    await html5QrCodeScanner.stop();
  } catch (e) {
    console.warn('Camera stop note:', e);
  }

  try {
    await html5QrCodeScanner.clear();
  } catch (e) {}

  html5QrCodeScanner = null;
}

// ================================================================
// HANDLE SUCCESSFUL QR SCAN
// ================================================================
async function handleScanResult(scannedRawValue) {
  if (!scannedRawValue) return;

  const cleanVal = parsePhoneIdFromQR(scannedRawValue);

  // Play audio beep
  playBeepSound();

  // Haptic feedback for mobile
  if (navigator.vibrate) {
    try { navigator.vibrate([100, 50, 100]); } catch (e) {}
  }

  // Save callback reference
  const callback = currentScanCallback;

  // Stop camera & close modal
  await stopCameraStream();

  const modal = document.getElementById('scanner-modal');
  if (modal) {
    modal.classList.remove('active');
  }

  currentScanCallback = null;

  // Execute callback with scanned value
  if (callback) {
    callback(cleanVal);
  }
}

// ================================================================
// CAMERA STATUS MESSAGE
// ================================================================
function showCameraStatus(message) {
  const statusElement = document.getElementById('camera-status-msg');
  if (statusElement) {
    statusElement.textContent = message;
  }
}