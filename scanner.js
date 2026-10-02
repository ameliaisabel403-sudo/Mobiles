/* ==========================================================================
   COMPANY PHONE TRACKER - CAMERA QR SCANNER & PARSER
   ========================================================================== */

let html5QrCodeScanner = null;
let currentScanCallback = null;

// Convert QR text into PHONE-001 ... PHONE-020
export function parsePhoneIdFromQR(scannedText) {
  if (!scannedText) return '';

  let str = String(scannedText).trim();

  // Remove URL prefix if QR contains a URL
  if (str.includes('/')) {
    const parts = str.split('/').filter(p => p.length > 0);
    str = parts[parts.length - 1] || str;
  }

  // Extract number
  const digitMatch = str.match(/(\d+)/);

  if (digitMatch && digitMatch[1]) {
    const num = parseInt(digitMatch[1], 10);

    if (num >= 1 && num <= 20) {
      return `PHONE-${String(num).padStart(3, '0')}`;
    }
  }

  return str.toUpperCase();
}


// Beep when QR is detected
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
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      audioCtx.currentTime + 0.15
    );

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);

  } catch (e) {
    console.warn('Beep error:', e);
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

  // Wait until modal is visible
  setTimeout(() => {
    initCameraStream();
  }, 300);
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
// START CAMERA
// ================================================================

async function initCameraStream() {

  const qrRegion = document.getElementById('qr-reader');

  if (!qrRegion) {
    console.error('QR reader element not found.');
    return;
  }

  showCameraStatus('⌛ Checking camera...');

  try {

    // Stop any previous scanner
    if (html5QrCodeScanner) {
      await stopCameraStream();
    }

    // Check library
    if (!window.Html5Qrcode) {

      showCameraStatus(
        '❌ QR scanner library is not loaded. Please refresh the page.'
      );

      return;
    }


    // Check browser camera support
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      showCameraStatus(
        '❌ Camera is not supported by this browser.'
      );

      return;
    }


    // Create scanner
    html5QrCodeScanner = new window.Html5Qrcode('qr-reader');


    showCameraStatus('⌛ Finding camera...');


    // Get available cameras
    let cameras = [];

    try {

      cameras = await window.Html5Qrcode.getCameras();

    } catch (cameraError) {

      console.warn(
        'Unable to list cameras:',
        cameraError
      );

    }


    // Select rear camera
    let selectedCamera = null;

    if (cameras && cameras.length > 0) {

      selectedCamera =
        cameras.find(camera =>
          /back|rear|environment|world/i.test(
            camera.label || ''
          )
        ) || cameras[cameras.length - 1];

    }


    let cameraSource;


    if (selectedCamera) {

      cameraSource = {
        deviceId: {
          exact: selectedCamera.id
        }
      };

    } else {

      // Fallback
      cameraSource = {
        facingMode: 'environment'
      };

    }


    // Scanner configuration
    const config = {

      fps: 10,

      qrbox: (
        viewfinderWidth,
        viewfinderHeight
      ) => {

        const minDimension =
          Math.min(
            viewfinderWidth,
            viewfinderHeight
          );

        const size =
          Math.max(
            180,
            Math.floor(
              minDimension * 0.75
            )
          );

        return {
          width: size,
          height: size
        };

      },

      aspectRatio: 1.0,

      disableFlip: false

    };


    showCameraStatus(
      '⌛ Starting camera...'
    );


    // Start camera
    await html5QrCodeScanner.start(

      cameraSource,

      config,

      decodedText => {

        handleScanResult(decodedText);

      },

      () => {
        // QR scan errors are normal
      }

    );


    showCameraStatus(
      '🟢 Camera Active. Point the camera at the Phone QR Code.'
    );


  } catch (error) {

    console.error(
      'Camera start error:',
      error
    );


    const message =
      String(
        error?.message ||
        error ||
        ''
      );


    if (
      /permission|notallowed|denied/i.test(
        message
      )
    ) {

      showCameraStatus(
        '❌ Camera permission denied. Allow camera access for this website and reload the page.'
      );

    } else if (
      /notfound|no camera|device not found/i.test(
        message
      )
    ) {

      showCameraStatus(
        '❌ No camera was found on this device.'
      );

    } else if (
      location.protocol !== 'https:'
    ) {

      showCameraStatus(
        '❌ Camera requires HTTPS. Use your Vercel HTTPS website.'
      );

    } else {

      showCameraStatus(
        `❌ Camera could not start: ${
          message || 'Unknown camera error'
        }`
      );

    }


    // Clean up
    try {

      if (html5QrCodeScanner) {
        await html5QrCodeScanner.clear();
      }

    } catch (e) {}

    html5QrCodeScanner = null;

  }

}


// ================================================================
// STOP CAMERA
// ================================================================

export async function stopCameraStream() {

  if (!html5QrCodeScanner) {
    return;
  }

  try {

    await html5QrCodeScanner.stop();

  } catch (e) {

    console.warn(
      'Camera stop warning:',
      e
    );

  }


  try {

    html5QrCodeScanner.clear();

  } catch (e) {}


  html5QrCodeScanner = null;
}


// ================================================================
// HANDLE SUCCESSFUL QR SCAN
// ================================================================

async function handleScanResult(scannedRawValue) {

  if (!scannedRawValue) {
    return;
  }


  const cleanPhoneId =
    parsePhoneIdFromQR(
      scannedRawValue
    );


  console.log(
    'QR detected:',
    scannedRawValue,
    '→',
    cleanPhoneId
  );


  // Beep
  playBeepSound();


  // Vibrate Android
  if (navigator.vibrate) {

    try {

      navigator.vibrate([
        100,
        50,
        100
      ]);

    } catch (e) {}

  }


  // IMPORTANT:
  // Save callback before stopping scanner.
  // The old code cleared the callback too early.

  const callback =
    currentScanCallback;


  // Stop camera
  await stopCameraStream();


  // Close modal
  const modal =
    document.getElementById(
      'scanner-modal'
    );

  if (modal) {

    modal.classList.remove(
      'active'
    );

  }


  // Clear callback
  currentScanCallback = null;


  // Send Phone ID back to app.js
  if (callback) {

    callback(
      cleanPhoneId
    );

  }

}


// ================================================================
// CAMERA STATUS MESSAGE
// ================================================================

function showCameraStatus(message) {

  const statusElement =
    document.getElementById(
      'camera-status-msg'
    );

  if (statusElement) {

    statusElement.textContent =
      message;

  }

}