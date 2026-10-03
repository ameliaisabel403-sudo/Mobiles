let scanner = null;
let callback = null;
let scanMode = "phone";
let starting = false;

export function openScannerModal(onScan, { mode = "phone", quickOptions = [] } = {}) {
  callback = onScan;
  scanMode = mode;

  const modal = document.getElementById("scanner-modal");
  const title = document.getElementById("scanner-modal-title");
  const status = document.getElementById("camera-status-msg");
  const select = document.getElementById("scanner-quick-select");

  if (title) title.textContent = mode === "employee" ? "👤 Scan Employee QR" : "📷 Scan Phone QR";
  if (status) status.textContent = "Starting camera...";

  if (select && quickOptions.length) {
    const isEmp = mode === "employee";
    select.innerHTML =
      `<option value="">-- Quick Select (No Camera Fallback) --</option>` +
      quickOptions.map(x => {
        const id = isEmp ? x.employee_number : x.id;
        const label = isEmp ? `${x.employee_number} (${x.full_name || "Employee"})` : x.id;
        return `<option value="${esc(id)}">${esc(label)}</option>`;
      }).join("");
  }

  window._scannerQuickSelect = value => finish(value);

  modal?.classList.add("active");
  setTimeout(start, 200);
}

async function start() {
  if (starting) return;
  starting = true;
  const status = document.getElementById("camera-status-msg");

  await stop();

  try {
    if (!window.isSecureContext && location.hostname !== "localhost") {
      throw new Error("Camera requires HTTPS. Make sure you're on the Vercel HTTPS URL.");
    }

    if (!window.Html5Qrcode) {
      throw new Error("QR camera library not loaded. Check your internet connection.");
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This browser doesn't support camera access.");
    }

    scanner = new window.Html5Qrcode("qr-reader");

    let cameras = [];
    try {
      cameras = await window.Html5Qrcode.getCameras();
    } catch (e) {
      // Permission may only be granted during start() on some mobile browsers
    }

    const config = {
      fps: 10,
      qrbox: (w, h) => {
        const size = Math.max(200, Math.floor(Math.min(w, h) * 0.75));
        return { width: Math.min(size, w - 20), height: Math.min(size, h - 20) };
      },
      aspectRatio: 1.0,
      disableFlip: false
    };

    if (cameras && cameras.length > 0) {
      const cam =
        cameras.find(c => /back|rear|environment|world/i.test(c.label)) ||
        cameras[cameras.length - 1];
      await scanner.start(cam.id, config, text => finish(text), () => {});
    } else {
      await scanner.start({ facingMode: { ideal: "environment" } }, config, text => finish(text), () => {});
    }

    if (status) status.textContent = "🟢 Camera active. Point at the QR code.";

  } catch (err) {
    console.error("QR scanner error:", err);
    let msg = err.message || "Camera could not start.";

    if (msg.includes("Permission") || msg.includes("NotAllowed")) {
      msg = "Camera permission denied. Please allow camera access in your browser settings, then try again.";
    } else if (msg.includes("NotFound") || msg.includes("DevicesNotFound")) {
      msg = "No camera found on this device.";
    } else if (msg.includes("NotReadable") || msg.includes("TrackStartError")) {
      msg = "Camera is in use by another app. Close it and try again.";
    }

    if (status) {
      status.textContent = `⚠️ ${msg} Use Quick Select below instead.`;
    }
    scanner = null;
  } finally {
    starting = false;
  }
}

function finish(raw) {
  if (!raw || !callback) return;

  let s = String(raw).trim();
  if (s.includes("/")) s = s.split("/").filter(Boolean).pop();
  s = s.toUpperCase();

  if (scanMode === "phone") {
    const m = s.match(/(?:PHONE[-_ ]*)?0*(\d{1,2})$/);
    if (m && +m[1] >= 1 && +m[1] <= 20) {
      s = `PHONE-${String(+m[1]).padStart(3, "0")}`;
    }
  } else {
    const m = s.match(/(?:EMPLOYEE[-_ ]*|EMP[-_ ]*)?(\d{1,10})$/);
    if (m && !s.startsWith("EMP-")) s = `EMP-${m[1]}`;
  }

  const cb = callback;
  callback = null;
  closeAndStop();
  Promise.resolve(cb(s)).catch(err => console.error("Scan callback error:", err));
}

export async function stop() {
  if (!scanner) return;
  const s = scanner;
  scanner = null;
  try { await s.stop(); } catch {}
  try { s.clear(); } catch {}
}

function closeAndStop() {
  document.getElementById("scanner-modal")?.classList.remove("active");
  stop();
}

export function closeScannerModal() {
  callback = null;
  closeAndStop();
}

window.closeScannerModal = closeScannerModal;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}