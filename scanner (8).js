let scanner = null;
let callback = null;
let scanMode = "phone";
let starting = false;

export function openScannerModal(onScan, { mode = "phone", quickOptions = [] } = {}) {
  callback = onScan;
  scanMode = mode;

  const modal = document.getElementById("scanner-modal");
  const title = modal?.querySelector(".card-title");
  const status = document.getElementById("camera-status-msg");
  const select = document.getElementById("scanner-quick-select");

  if (title) title.textContent = mode === "employee" ? "👤 Scan Employee QR" : "📷 Scan Phone QR";
  if (status) status.textContent = "Starting camera...";
  if (select) {
    select.value = "";
    select.disabled = false;
    // Keep existing options, but make them reflect current database records.
    if (quickOptions.length) {
      const employees = mode === "employee";
      select.innerHTML =
        `<option value="">-- Quick Select for Testing / Fallback --</option>` +
        quickOptions.map(x => {
          const id = employees ? x.employee_number : x.id;
          const label = employees ? `${x.employee_number} (${x.full_name || "Employee"})` : x.id;
          return `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`;
        }).join("");
    }
    window._scannerQuickSelect = value => finish(value);
  }

  modal?.classList.add("active");
  setTimeout(start, 150);
}

async function start() {
  if (starting) return;
  starting = true;
  const status = document.getElementById("camera-status-msg");

  try {
    if (!window.isSecureContext && location.hostname !== "localhost") {
      throw new Error("Camera requires HTTPS. Open the Vercel HTTPS URL.");
    }
    if (!window.Html5Qrcode) throw new Error("QR camera library did not load.");
    if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser does not allow camera access.");

    await stop();
    scanner = new window.Html5Qrcode("qr-reader");

    let cameras = [];
    try {
      cameras = await window.Html5Qrcode.getCameras();
    } catch {
      // On some mobile browsers camera permission is only requested by start().
    }

    if (cameras.length) {
      const cam = cameras.find(c => /back|rear|environment|world/i.test(c.label)) || cameras[0];
      await scanner.start(
        cam.id,
        scanConfig(),
        text => finish(text),
        () => {}
      );
    } else {
      await scanner.start(
        { facingMode: "environment" },
        scanConfig(),
        text => finish(text),
        () => {}
      );
    }

    if (status) status.textContent = "🟢 Camera active. Point at the QR code.";
  } catch (err) {
    console.error("QR scanner error:", err);
    if (status) {
      status.textContent = `⚠️ ${err.message || "Camera could not start."} You can use Quick Select below.`;
    }
  } finally {
    starting = false;
  }
}

function scanConfig() {
  return {
    fps: 10,
    qrbox: (w, h) => {
      const size = Math.max(180, Math.floor(Math.min(w, h) * 0.72));
      return { width: Math.min(size, w), height: Math.min(size, h) };
    },
    aspectRatio: 1
  };
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
  closeModalAndStop();
  Promise.resolve(cb(s)).catch(err => console.error("Scan callback error:", err));
}

export async function stop() {
  if (!scanner) return;
  const current = scanner;
  scanner = null;
  try { await current.stop(); } catch {}
  try { current.clear(); } catch {}
}

function closeModalAndStop() {
  const modal = document.getElementById("scanner-modal");
  modal?.classList.remove("active");
  stop();
}

export function closeScannerModal() {
  callback = null;
  closeModalAndStop();
}
window.closeScannerModal = closeScannerModal;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
