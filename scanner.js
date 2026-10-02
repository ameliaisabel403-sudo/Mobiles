let scanner=null,callback=null,mode="phone";
export function openScannerModal(onScan,{mode:scanMode="phone",quickOptions=[]}={}){
 callback=onScan;mode=scanMode;
 document.getElementById("scanner-title").textContent=mode==="employee"?"👤 Scan Employee QR":"📷 Scan Phone QR";
 document.getElementById("scanner").classList.add("open");
 const qa=document.getElementById("quick-area");qa.innerHTML="";
 if(quickOptions.length){qa.innerHTML=`<p class="muted">Desktop testing:</p><div class="quick">${quickOptions.map(x=>`<button class="btn" data-q="${x.id}">${x.id}</button>`).join("")}</div>`;qa.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>finish(b.dataset.q))}
 setTimeout(start,150)
}
async function start(){
 const status=document.getElementById("scanner-status");status.textContent="Starting camera...";
 try{
  if(!window.Html5Qrcode)throw new Error("QR camera library did not load.");
  if(scanner)await stop();
  scanner=new Html5Qrcode("qr-reader");
  const cameras=await Html5Qrcode.getCameras();
  if(!cameras.length)throw new Error("No camera found.");
  const cam=cameras.find(c=>/back|rear|environment|world/i.test(c.label))||cameras[cameras.length-1];
  await scanner.start(cam.id,{fps:12,qrbox:(w,h)=>{const s=Math.floor(Math.min(w,h)*.72);return{width:s,height:s}}},text=>finish(text),()=>{});
  status.textContent="🟢 Camera active. Point at the QR code.";
 }catch(e){status.textContent="⚠️ "+(e.message||"Camera could not start.")+" Use Quick Select below if needed."}
}
function finish(raw){
 if(!raw)return;
 let s=String(raw).trim();
 if(s.includes("/"))s=s.split("/").filter(Boolean).pop();
 s=s.toUpperCase();
 if(mode==="phone"){const m=s.match(/(?:PHONE[-_ ]*)?0*(\d{1,2})$/);if(m&&+m[1]>=1&&+m[1]<=20)s=`PHONE-${String(+m[1]).padStart(3,"0")}`}
 if(mode==="employee"){const m=s.match(/(?:EMPLOYEE[-_ ]*|EMP[-_ ]*)?(\d{1,10})$/);if(m&&s.startsWith("EMP"))s=`EMP-${m[1]}`}
 const cb=callback;callback=null;stop();document.getElementById("scanner").classList.remove("open");if(cb)cb(s)
}
export async function stop(){if(scanner){try{await scanner.stop();scanner.clear()}catch{}scanner=null}}
export function closeScannerModal(){callback=null;stop();document.getElementById("scanner").classList.remove("open")}
