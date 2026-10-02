import {initSupabaseClient,appConfig,saveSupabaseConfig} from "./config.js";
import {fetchAllPhones,fetchAllEmployees,fetchEmployeeByNumber,fetchTransactions,saveEmployee,deleteEmployee,issuePhone,returnPhone} from "./database.js";
import {openScannerModal,closeScannerModal} from "./scanner.js";
import {renderPhoneQRs,renderEmployeeQRs} from "./qr-generator.js";
import {filterTransactions,exportToCSV} from "./reports.js";

let phones=[],employees=[],transactions=[];

document.addEventListener("DOMContentLoaded",async()=>{
 initSupabaseClient();setupNav();setupEvents();updateBadge();await refresh();renderPhoneQRs();
});
window.refresh=refresh;

function setupNav(){document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showView(b.dataset.view))}
function showView(v){
 document.querySelectorAll(".view").forEach(x=>x.classList.remove("active"));document.getElementById("view-"+v)?.classList.add("active");
 document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.view===v));
 if(v==="phones-qr")renderPhoneQRs();if(v==="employees-qr")renderEmployeeQRs(employees);
}
function setupEvents(){
 document.getElementById("settingsBtn").onclick=()=>{document.getElementById("supabase-url").value=appConfig.supabaseUrl;document.getElementById("supabase-key").value=appConfig.supabaseKey;document.getElementById("settings").classList.add("open")};
 document.getElementById("closeSettings").onclick=()=>document.getElementById("settings").classList.remove("open");
 document.getElementById("saveSettings").onclick=()=>{saveSupabaseConfig(document.getElementById("supabase-url").value,document.getElementById("supabase-key").value);document.getElementById("settings").classList.remove("open");updateBadge();refresh()};
 document.getElementById("closeScanner").onclick=closeScannerModal;

 document.getElementById("employeeForm").onsubmit=async e=>{e.preventDefault();try{busy(true);await saveEmployee({employee_number:val("employee-id"),full_name:val("employee-name"),department:val("employee-department"),phone_number:val("employee-phone")},val("employee-old-id"));toast("Employee saved successfully. Employee QR is ready.","success");clearEmployeeForm();await refresh();showView("employees")}catch(x){toast(x.message,"error")}finally{busy(false)}};
 document.getElementById("employee-cancel").onclick=clearEmployeeForm;
 document.getElementById("employee-search").oninput=renderEmployees;

 document.getElementById("scanEmployeeBtn").onclick=()=>openScannerModal(id=>fillEmployee(id),{mode:"employee",quickOptions:employees});
 document.getElementById("scanIssuePhoneBtn").onclick=()=>openScannerModal(id=>setVal("issue-phone-id",id),{mode:"phone",quickOptions:phones});
 document.getElementById("scanReturnPhoneBtn").onclick=()=>openScannerModal(id=>{setVal("return-phone-id",id);showHolder(id)},{mode:"phone",quickOptions:phones});

 document.getElementById("issue-employee-id").onchange=()=>fillEmployee(val("issue-employee-id"));
 document.getElementById("return-phone-id").onchange=()=>showHolder(val("return-phone-id"));

 document.getElementById("issueForm").onsubmit=async e=>{e.preventDefault();try{busy(true);const id=val("issue-employee-id").toUpperCase(),p=val("issue-phone-id").toUpperCase();if(!await fetchEmployeeByNumber(id))throw new Error("Employee not found. Add the employee first.");await issuePhone({phoneId:p,employeeNumber:id,employeeName:val("issue-employee-name")});toast(`${p} issued successfully.`,"success");e.target.reset();setVal("issue-employee-name","");await refresh();showView("dashboard")}catch(x){toast(x.message,"error")}finally{busy(false)}};
 document.getElementById("returnForm").onsubmit=async e=>{e.preventDefault();try{busy(true);const r=await returnPhone({phoneId:val("return-phone-id"),condition:val("return-condition"),notes:val("return-notes")});toast(`${r.phoneId} returned successfully.`,"success");e.target.reset();document.getElementById("return-holder").innerHTML="";await refresh();showView("dashboard")}catch(x){toast(x.message,"error")}finally{busy(false)}};

 document.getElementById("report-search").oninput=renderReports;document.getElementById("report-action").onchange=renderReports;
 document.getElementById("exportBtn").onclick=()=>exportToCSV(filterTransactions(transactions,{search:val("report-search"),action:val("report-action")}));
}
async function refresh(){
 try{busy(true);phones=await fetchAllPhones();employees=await fetchAllEmployees();transactions=await fetchTransactions();renderDashboard();renderPhones();renderEmployees();renderReports();populateEmployees();renderEmployeeQRs(employees)}catch(e){toast(e.message,"error")}finally{busy(false)}
}
function renderDashboard(){
 document.getElementById("stat-total").textContent=phones.length;
 document.getElementById("stat-available").textContent=phones.filter(x=>x.status==="AVAILABLE").length;
 document.getElementById("stat-issued").textContent=phones.filter(x=>x.status==="ISSUED").length;
 const today=new Date().toISOString().slice(0,10);document.getElementById("stat-returned").textContent=transactions.filter(x=>x.action==="RETURN"&&String(x.timestamp).startsWith(today)).length;
 document.getElementById("stat-employees").textContent=employees.length;
 const list=phones.filter(x=>x.status==="ISSUED");document.getElementById("active-issued").innerHTML=list.length?`<div class="table-wrap"><table><tr><th>Phone</th><th>Employee</th><th>ID</th><th>Issued</th><th></th></tr>${list.map(p=>`<tr><td>${p.id}</td><td>${p.current_employee_name}</td><td>${p.current_employee_id}</td><td>${fmt(p.last_issue_time)}</td><td><button class="btn" onclick="quickReturn('${p.id}')">Return</button></td></tr>`).join("")}</table></div>`:`<p class="muted">No phones are currently issued.</p>`
}
window.quickReturn=id=>{showView("return");setVal("return-phone-id",id);showHolder(id)}
function renderPhones(){document.getElementById("phones-body").innerHTML=phones.map(p=>`<tr><td><b>${p.id}</b></td><td><span class="badge ${p.status==="ISSUED"?"issue":"live"}">${p.status}</span></td><td>${p.current_employee_id||"-"}</td><td>${p.current_employee_name||"-"}</td><td>${p.condition||"-"}</td><td>${fmt(p.last_issue_time)}</td><td>${fmt(p.last_return_time)}</td></tr>`).join("")}
function renderEmployees(){
 const q=val("employee-search").toLowerCase();const rows=employees.filter(e=>`${e.employee_number} ${e.full_name} ${e.department} ${e.phone_number}`.toLowerCase().includes(q));
 document.getElementById("employees-body").innerHTML=rows.length?rows.map(e=>`<tr><td><b>${e.employee_number}</b></td><td>${e.full_name}</td><td>${e.department||"-"}</td><td>${e.phone_number||"-"}</td><td><button class="btn small" onclick="showEmployeeQR('${e.employee_number}')">View QR</button></td><td><div class="row-actions"><button class="btn small" onclick="editEmployee('${e.employee_number}')">Edit</button><button class="btn danger small" onclick="removeEmployee('${e.employee_number}')">Remove</button></div></td></tr>`).join(""):`<tr><td colspan="6" class="muted">No employees found.</td></tr>`
}
window.editEmployee=id=>{const e=employees.find(x=>x.employee_number===id);if(!e)return;setVal("employee-old-id",e.employee_number);setVal("employee-id",e.employee_number);setVal("employee-name",e.full_name);setVal("employee-department",e.department);setVal("employee-phone",e.phone_number);showView("employees");window.scrollTo({top:0,behavior:"smooth"})}
window.removeEmployee=async id=>{if(!confirm(`Remove ${id}?`))return;try{busy(true);await deleteEmployee(id);toast("Employee removed.","success");await refresh()}catch(e){toast(e.message,"error")}finally{busy(false)}}
window.showEmployeeQR=id=>{showView("employees-qr");setTimeout(()=>document.getElementById("employee-qr-"+CSS.escape(id))?.scrollIntoView({behavior:"smooth"}),100)}
function clearEmployeeForm(){document.getElementById("employeeForm").reset();setVal("employee-old-id","");document.getElementById("employee-save").textContent="Save Employee"}
function renderReports(){const rows=filterTransactions(transactions,{search:val("report-search"),action:val("report-action")});document.getElementById("reports-body").innerHTML=rows.map(x=>`<tr><td>${fmt(x.timestamp)}</td><td>${x.action}</td><td>${x.phone_id}</td><td>${x.employee_number}</td><td>${x.employee_name}</td><td>${x.condition||"-"}</td><td>${x.notes||"-"}</td><td>${x.staff_email||"Staff"}</td></tr>`).join("")||`<tr><td colspan="8" class="muted">No transactions.</td></tr>`}
function populateEmployees(){document.getElementById("employee-options").innerHTML=employees.map(e=>`<option value="${e.employee_number}">${e.full_name} - ${e.department||"Staff"}</option>`).join("")}
async function fillEmployee(id){id=String(id||"").trim().toUpperCase();setVal("issue-employee-id",id);const e=await fetchEmployeeByNumber(id);if(!e){setVal("issue-employee-name","");toast("Employee not found. Add this employee first.","warn");return}setVal("issue-employee-name",e.full_name);toast(`Employee: ${e.full_name}`,"success")}
function showHolder(id){id=String(id||"").trim().toUpperCase();const p=phones.find(x=>x.id===id);document.getElementById("return-holder").innerHTML=!p?`<div class="holder">Phone not found.</div>`:p.status==="AVAILABLE"?`<div class="holder">This phone is currently available.</div>`:`<div class="holder"><b>Current Holder:</b><br>${p.current_employee_name}<br><span class="small">${p.current_employee_id}</span><br><span class="small">Issued: ${fmt(p.last_issue_time)}</span></div>`}
function updateBadge(){const b=document.getElementById("db-badge");b.className="badge "+(appConfig.isConfigured?"live":"issue");b.textContent=appConfig.isConfigured?"🟢 SUPABASE LIVE":"⚡ DEMO MODE"}
function showEmployeeQRTarget(){renderEmployeeQRs(employees)}
function toast(msg,type=""){const c=document.getElementById("toast");const d=document.createElement("div");d.className="toast "+type;d.textContent=msg;c.appendChild(d);setTimeout(()=>d.remove(),3500)}
function busy(on){document.getElementById("loader").style.display=on?"block":"none"}
function val(id){return document.getElementById(id)?.value||""}function setVal(id,v){const e=document.getElementById(id);if(e)e.value=v}
function fmt(v){return v?v==="-"?"-":new Date(v).toLocaleString():"-"}
