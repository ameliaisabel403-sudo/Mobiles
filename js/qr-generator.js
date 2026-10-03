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
    // Attempt to load from demo storage or defaults
    try {
      const dbStr = localStorage.getItem('company_phone_tracker_demo_db_v2');
      if (dbStr) {
        const parsed = JSON.parse(dbStr);
        if (parsed.employees && parsed.employees.length > 0) {
          employees = parsed.employees;
        }
      }
    } catch (e) {}

    if (!employees || employees.length === 0) {
      employees = [
        { employee_number: 'EMP-1001', full_name: 'Alex Mercer', department: 'Logistics' },
        { employee_number: 'EMP-1002', full_name: 'Sarah Jenkins', department: 'Field Operations' },
        { employee_number: 'EMP-1003', full_name: 'Michael Chen', department: 'Warehouse' },
        { employee_number: 'EMP-1004', full_name: 'Emily Rodriguez', department: 'Quality Control' },
        { employee_number: 'EMP-1005', full_name: 'David Kim', department: 'Technical Support' },
        { employee_number: 'EMP-1006', full_name: 'Jessica Taylor', department: 'Fleet Management' },
        { employee_number: 'EMP-1007', full_name: 'James Wilson', department: 'Security' },
        { employee_number: 'EMP-1008', full_name: 'Amanda Martinez', department: 'Inventory' },
        { employee_number: 'EMP-1009', full_name: 'Robert Patel', department: 'Delivery Ops' },
        { employee_number: 'EMP-1010', full_name: 'Lisa Anderson', department: 'Site Inspection' }
      ];
    }
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

  el.innerHTML = '';
  let generated = false;

  if (window.QRCode) {
    try {
      new window.QRCode(el, {
        text: textPayload,
        width: 140,
        height: 140,
        colorDark: "#090d16",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H
      });
      generated = true;
    } catch (e) {
      console.warn('Local QRCode generator error, falling back to image:', e);
      generated = false;
    }
  }

  if (!generated) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(textPayload)}`;
    el.innerHTML = `<img src="${qrUrl}" alt="${textPayload}" style="width: 140px; height: 140px; display: block; margin: 0 auto;" />`;
  }
}

// Expose on window for direct access across views
window.renderQRMatrix = renderQRMatrix;
window.renderEmployeeQRMatrix = renderEmployeeQRMatrix;

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
