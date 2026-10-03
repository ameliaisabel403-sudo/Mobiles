/* ==========================================================================
   CINNAMON LIFE HK MOBILE - CAMERA QR SCANNER
   ========================================================================== */

let html5QrCodeScanner = null;
let currentScanCallback = null;
let scanLocked = false;


/* ==========================================================================
   PHONE QR PARSER
   ========================================================================== */

export function parsePhoneIdFromQR(scannedText) {
  if (!scannedText) return '';

  let str = String(scannedText).trim();

  // Remove URL prefix if QR contains a URL
  if (str.includes('/')) {
    const parts = str.split('/').filter(p => p.length > 0);
    str = parts[parts.length - 1] || str;
  }

  // Convert number to PHONE-001 format
  const digitMatch = str.match(/(\d+)/);

  if (digitMatch && digitMatch[1]) {
    const num = parseInt(digitMatch[1], 10);

    if (num >= 1 && num <= 20) {
      return `PHONE-${String(num).padStart(3, '0')}`;
    }
  }

  return str.toUpperCase();
}


/* ==========================================================================
   BEEP SOUND
   ========================================================================== */

function playBeepSound() {
  try {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) return;

    const audioCtx = new AudioContext();

    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(
      880,
      audioCtx.currentTime
    );

    gain.gain.setValueAtTime(
      0.2,
      audioCtx.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.01,
      audioCtx.currentTime + 0.15
    );

    oscillator.connect(gain);
    gain.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);

  } catch (e) {
    console.warn('Audio beep:', e);
  }
}


/* ==========================================================================
   OPEN SCANNER
   ========================================================================== */

export function openScannerModal(onScanSuccess) {

  if (typeof onScanSuccess !== 'function') {
    console.error('Scanner callback is missing.');
    return;
  }

  scanLocked = false;
  currentScanCallback = onScanSuccess;

  const modal = document.getElementById('scanner-modal');

  if (modal) {
    modal.classList.add('active');
  }

  showCameraStatus('⌛ Requesting camera permission...');

  // Give the modal time to appear before starting camera
  setTimeout(() => {
    initCameraStream();
  }, 300);
}

window.openScannerModal = openScannerModal;


/* ==========================================================================
   CLOSE SCANNER
   ========================================================================== */

export async function closeScannerModal() {

  await stopCameraStream();

  const modal = document.getElementById('scanner-modal');

  if (modal) {
    modal.classList.remove('active');
  }

  currentScanCallback = null;
  scanLocked = false;
}

window.closeScannerModal = closeScannerModal;


/* ==========================================================================
   START CAMERA
   ========================================================================== */

async function initCameraStream() {

  const qrRegion = document.getElementById('qr-reader');

  if (!qrRegion) {
    console.error(
      'QR reader container #qr-reader not found.'
    );
    return;
  }

  showCameraStatus('⌛ Starting camera...');

  try {

    // Stop previous scanner
    if (html5QrCodeScanner) {
      await stopCameraStream();
    }

    // Check QR library
    if (!window.Html5Qrcode) {

      showCameraStatus(
        '❌ QR scanner library not loaded. Please reload the page.'
      );

      return;
    }

    // Check browser camera support
    if (
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {

      showCameraStatus(
        '❌ Camera is not supported. Please use Chrome or Safari.'
      );

      return;
    }

    // Check HTTPS
    if (
      location.protocol !== 'https:' &&
      location.hostname !== 'localhost'
    ) {

      showCameraStatus(
        '❌ Camera requires HTTPS. Please open the Vercel website.'
      );

      return;
    }

    // Create scanner
    html5QrCodeScanner =
      new window.Html5Qrcode('qr-reader');


    /* --------------------------------------------------------------
       CAMERA SETTINGS
       -------------------------------------------------------------- */

    const config = {

      fps: 10,

      qrbox: function(width, height) {

        const minSize = Math.min(width, height);

        const size = Math.max(
          180,
          Math.floor(minSize * 0.70)
        );

        return {
          width: size,
          height: size
        };
      },

      aspectRatio: 1.0,

      disableFlip: false
    };


    /* --------------------------------------------------------------
       TRY BACK CAMERA
       -------------------------------------------------------------- */

    try {

      await html5QrCodeScanner.start(

        {
          facingMode: {
            exact: 'environment'
          }
        },

        config,

        function(decodedText) {

          handleScanResult(decodedText);

        },

        function(errorMessage) {
          // QR not detected yet
        }

      );

      showCameraStatus(
        '🟢 Camera Active. Align the QR code inside the box.'
      );

      return;

    } catch (error) {

      console.warn(
        'Back camera failed:',
        error
      );
    }


    /* --------------------------------------------------------------
       TRY CAMERA LIST
       -------------------------------------------------------------- */

    try {

      const cameras =
        await window.Html5Qrcode.getCameras();

      if (cameras && cameras.length > 0) {

        const backCamera =
          cameras.find(camera =>
            /back|rear|environment|world/i.test(
              camera.label || ''
            )
          ) || cameras[0];


        await html5QrCodeScanner.start(

          backCamera.id,

          config,

          function(decodedText) {

            handleScanResult(decodedText);

          },

          function(errorMessage) {
            // QR not detected
          }

        );

        showCameraStatus(
          '🟢 Camera Active. Align the QR code.'
        );

        return;
      }

    } catch (error) {

      console.warn(
        'Camera list failed:',
        error
      );
    }


    /* --------------------------------------------------------------
       FINAL CAMERA FALLBACK
       -------------------------------------------------------------- */

    try {

      await html5QrCodeScanner.start(

        {
          facingMode: 'user'
        },

        config,

        function(decodedText) {

          handleScanResult(decodedText);

        },

        function(errorMessage) {
          // QR not detected
        }

      );

      showCameraStatus(
        '🟢 Camera Active. Align the QR code.'
      );

    } catch (error) {

      console.error(
        'All camera methods failed:',
        error
      );

      const message =
        String(error?.message || error || '');

      if (
        /permission|notallowed|denied/i.test(message)
      ) {

        showCameraStatus(
          '❌ Camera permission denied. Allow camera access in browser settings.'
        );

      } else {

        showCameraStatus(
          '❌ Could not start camera. Please select the ID manually below.'
        );
      }

      try {

        if (html5QrCodeScanner) {
          await html5QrCodeScanner.clear();
        }

      } catch (e) {}

      html5QrCodeScanner = null;
    }
  }
}


/* ==========================================================================
   STOP CAMERA
   ========================================================================== */

export async function stopCameraStream() {

  if (!html5QrCodeScanner) {
    return;
  }

  try {

    await html5QrCodeScanner.stop();

  } catch (error) {

    console.warn(
      'Camera stop:',
      error
    );
  }


  try {

    await html5QrCodeScanner.clear();

  } catch (error) {}


  html5QrCodeScanner = null;
}


/* ==========================================================================
   HANDLE SUCCESSFUL QR SCAN
   ========================================================================== */

async function handleScanResult(scannedRawValue) {

  // Ignore empty results
  if (!scannedRawValue) {
    return;
  }

  // Prevent multiple scans
  if (scanLocked) {
    return;
  }

  scanLocked = true;


  // IMPORTANT:
  // DO NOT convert the QR into PHONE-001 here.
  //
  // Employee QR and Phone QR are different.
  // app.js decides which type of QR is being scanned.
  //
  const rawValue =
    String(scannedRawValue).trim();


  // Beep
  playBeepSound();


  // Vibrate mobile
  if (navigator.vibrate) {

    try {

      navigator.vibrate([
        100,
        50,
        100
      ]);

    } catch (error) {}
  }


  // Save callback
  const callback =
    currentScanCallback;


  // Stop camera
  await stopCameraStream();


  // Close modal
  const modal =
    document.getElementById('scanner-modal');

  if (modal) {
    modal.classList.remove('active');
  }


  currentScanCallback = null;


  // Send RAW QR value back to app.js
  if (callback) {

    try {

      await callback(rawValue);

    } catch (error) {

      console.error(
        'QR callback error:',
        error
      );
    }
  }


  scanLocked = false;
}


/* ==========================================================================
   CAMERA STATUS
   ========================================================================== */

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
