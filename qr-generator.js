function makeQR(el,text){el.innerHTML="";if(window.QRCode)new QRCode(el,{text,width:150,height:150,colorDark:"#111827",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M})}
export function renderPhoneQRs(containerId="phone-qr-grid"){
 const c=document.getElementById(containerId);if(!c)return;c.innerHTML="";
 for(let i=1;i<=20;i++){const id=`PHONE-${String(i).padStart(3,"0")}`;const card=document.createElement("div");card.className="qr-card";card.innerHTML=`<b>${id}</b><div class="qr"></div><div class="small">Company Phone</div>`;c.appendChild(card);makeQR(card.querySelector(".qr"),id)}
}
export function renderEmployeeQRs(employees,containerId="employee-qr-grid"){
 const c=document.getElementById(containerId);if(!c)return;c.innerHTML="";
 if(!employees.length){c.innerHTML='<div class="card"><p class="muted">No employees saved yet. Add an employee first.</p></div>';return}
 employees.forEach(e=>{const id=String(e.employee_number).toUpperCase();const card=document.createElement("div");card.className="qr-card";card.innerHTML=`<b>${id}</b><div class="qr"></div><strong>${e.full_name}</strong><div class="small">${e.department||"Staff"}</div>`;c.appendChild(card);makeQR(card.querySelector(".qr"),id)})
}
