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
    card.setAttribute('data-phone-id', phoneId);

    const canvasId = `qr-canvas-${phoneId}`;
    
    card.innerHTML = `
      <div id="${canvasId}" class="qr-img"></div>
      <div class="phone-title">${phoneId}</div>
      <button class="btn btn-sm btn-glass no-print" style="margin-top: 8px;" onclick="window.downloadSingleQR('${phoneId}')">
        📥 Save QR
      </button>
    `;

    container.appendChild(card);

    // Generate QR using QRCode library or fallback google chart API
    setTimeout(() => {
      generateQRCodeCanvas(canvasId, phoneId);
    }, 50);
  }
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
    // Fallback image using standard QR API if library CDN fails
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(textPayload)}`;
    el.innerHTML = `<img src="${qrUrl}" alt="${textPayload}" style="width: 140px; height: 140px;" />`;
  }
}

// Global Single QR Download Helper
window.downloadSingleQR = function(phoneId) {
  const card = document.querySelector(`.qr-card[data-phone-id="${phoneId}"]`);
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
  link.download = `${phoneId}-QR.png`;
  link.href = imageUri;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
