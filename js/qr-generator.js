/* ==========================================================================
   COMPANY PHONE TRACKER - QR CODE GENERATOR & PRINT MANAGER
   ========================================================================== */

// Render QR Matrix for PHONE-001 to PHONE-020
export function renderQRMatrix(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  for (let i = 1; i <= 20; i++) {
    const phoneId = `PHONE-${String(i).padStart(3, '0')}`;
    
    const card = document.createElement('div');
    card.className = 'qr-card';
    card.setAttribute('data-qr-id', phoneId);

    const canvasId = `qr-canvas-${phoneId}`;
    
    card.innerHTML = `
      <div id="${canvasId}" class="qr-img"></div>
      <div class="phone-title">${phoneId}</div>
      <button class="btn btn-sm btn-glass no-print" style="margin-top: 8px;" onclick="window.downloadSingleQR('${phoneId}', 'phone')">
        📥 Save QR
      </button>
    `;

    container.appendChild(card);

    setTimeout(() => {
      generateQRCodeCanvas(canvasId, phoneId);
    }, 50);
  }
}

// Render QR Matrix for Employees
export function renderEmployeeQRMatrix(containerId, employees) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';

  if (!employees || employees.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--text-dim); grid-column: 1/-1;">
        <p>No employees found. Add employees first via the Supabase database or demo mode.</p>
      </div>
    `;
    return;
  }

  employees.forEach((emp, index) => {
    const empId = emp.employee_number;
    const empName = emp.full_name || 'Unknown';
    const dept = emp.department || 'Staff';

    const card = document.createElement('div');
    card.className = 'qr-card emp-qr-card';
    card.setAttribute('data-qr-id', empId);

    const canvasId = `qr-emp-canvas-${empId.replace(/[^a-z0-9]/gi, '-')}`;

    card.innerHTML = `
      <div id="${canvasId}" class="qr-img"></div>
      <div class="phone-title" style="font-size: 0.9rem; margin-top: 0.5rem;">${empId}</div>
      <div style="font-size: 0.78rem; color: #1e293b; font-weight: 600; margin-top: 3px;">${empName}</div>
      <div style="font-size: 0.7rem; color: #475569; margin-top: 2px;">${dept}</div>
      <button class="btn btn-sm btn-glass no-print" style="margin-top: 8px;" onclick="window.downloadSingleQR('${empId}', 'employee')">
        📥 Save QR
      </button>
    `;

    container.appendChild(card);

    setTimeout(() => {
      generateQRCodeCanvas(canvasId, empId);
    }, index * 30);
  });
}

// Generate QR Code onto Canvas / Div
function generateQRCodeCanvas(elementId, textPayload) {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (window.QRCode) {
    el.innerHTML = '';
    new window.QRCode(el, {
      text: textPayload,
      width: 140,
      height: 140,
      colorDark: "#090d16",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.H
    });
  } else {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(textPayload)}`;
    el.innerHTML = `<img src="${qrUrl}" alt="${textPayload}" style="width: 140px; height: 140px;" />`;
  }
}

// Global Single QR Download Helper (works for both phones and employees)
window.downloadSingleQR = function(id, type = 'phone') {
  const card = document.querySelector(`.qr-card[data-qr-id="${id}"]`);
  if (!card) return;

  const img = card.querySelector('img') || card.querySelector('canvas');
  if (!img) return;

  let imageUri = '';
  if (img.tagName.toLowerCase() === 'canvas') {
    imageUri = img.toDataURL("image/png");
  } else {
    imageUri = img.src;
  }

  const link = document.createElement('a');
  link.download = `${id}-QR.png`;
  link.href = imageUri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
