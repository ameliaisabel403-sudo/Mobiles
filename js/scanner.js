/* ==========================================================================
   COMPANY PHONE TRACKER - CAMERA QR SCANNER MODULE
   ========================================================================== */

let html5QrCodeScanner = null;
let currentScanCallback = null;

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

// Initialize Html5Qrcode Camera Engine
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
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Frame scan error (ignore normal scanning frames)
        }
      );
    } else {
      console.warn('html5-qrcode library not loaded yet.');
    }
  } catch (err) {
    console.warn('Camera stream error (may be desktop without camera):', err);
    showCameraWarning('Camera access unavailable. Use quick select below.');
  }
}

// Stop Camera Stream
export async function stopCameraStream() {
  if (html5QrCodeScanner) {
    try {
      await html5QrCodeScanner.stop();
      html5QrCodeScanner.clear();
    } catch (e) {
      // Ignore stop errors if already stopped
    }
    html5QrCodeScanner = null;
  }
}

// Handle Successful QR Scan
function handleScanResult(scannedValue) {
  if (!scannedValue) return;
  const cleanVal = scannedValue.trim().toUpperCase();

  // Trigger Haptic Feedback on supported phones
  if (navigator.vibrate) {
    navigator.vibrate(100);
  }

  closeScannerModal();

  if (currentScanCallback) {
    currentScanCallback(cleanVal);
  }
}

// Show Camera Warning message
function showCameraWarning(msg) {
  const statusEl = document.getElementById('camera-status-msg');
  if (statusEl) statusEl.textContent = msg;
}
