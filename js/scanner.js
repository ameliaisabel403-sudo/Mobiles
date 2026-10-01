/* ==========================================================================
   COMPANY PHONE TRACKER - UPGRADED CAMERA QR SCANNER MODULE
   ========================================================================== */

let html5QrCodeScanner = null;
let currentScanCallback = null;

// Audio Beep Feedback using Web Audio API (No external sound files required)
function playBeepSound() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz crisp beep
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    console.log('Audio beep note:', e);
  }
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

// Initialize Html5Qrcode Camera Engine with High-Performance Settings
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

      // Prefer rear back camera on mobile phones ('environment')
      await html5QrCodeScanner.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          handleScanResult(decodedText);
        },
        (errorMessage) => {
          // Frame scan pass
        }
      );

      showCameraStatus('🟢 Camera Active. Point at Phone QR Tag.');
    } else {
      showCameraStatus('⚠️ Camera engine loading... Please retry in a second.');
    }
  } catch (err) {
    console.warn('Camera stream note:', err);
    showCameraStatus('💡 Camera permissions needed, or use quick select below.');
  }
}

// Stop Camera Stream
export async function stopCameraStream() {
  if (html5QrCodeScanner) {
    try {
      await html5QrCodeScanner.stop();
      html5QrCodeScanner.clear();
    } catch (e) {
      // Ignore cleanup error if stream stopped
    }
    html5QrCodeScanner = null;
  }
}

// Handle Successful QR Scan
function handleScanResult(scannedValue) {
  if (!scannedValue) return;
  const cleanVal = scannedValue.trim().toUpperCase();

  // 1. Play Crisp Audio Beep
  playBeepSound();

  // 2. Trigger Haptic Vibration on Mobile Devices
  if (navigator.vibrate) {
    try {
      navigator.vibrate([100, 50, 100]);
    } catch (e) {}
  }

  // 3. Close scanner & trigger callback
  closeScannerModal();

  if (currentScanCallback) {
    currentScanCallback(cleanVal);
  }
}

// Update Camera Status Text
function showCameraStatus(msg) {
  const statusEl = document.getElementById('camera-status-msg');
  if (statusEl) statusEl.textContent = msg;
}
