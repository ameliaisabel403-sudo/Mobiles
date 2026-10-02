import {getSupabase,appConfig} from "./config.js";

const PHONE_KEY="phone_tracker_phones_v2", EMP_KEY="phone_tracker_employees_v2", TX_KEY="phone_tracker_transactions_v2";
const seedPhones=Array.from({length:20},(_,i)=>({id:`PHONE-${String(i+1).padStart(3,"0")}`,status:"AVAILABLE",current_employee_id:null,current_employee_name:null,last_issue_time:null,last_return_time:null,condition:"Good"}));

function read(k,f){try{return JSON.parse(localStorage.getItem(k)||"null")||f}catch{return f}}
function write(k,v){localStorage.setItem(k,JSON.stringify(v))}
function demoInit(){if(!localStorage.getItem(PHONE_KEY))write(PHONE_KEY,seedPhones);if(!localStorage.getItem(EMP_KEY))write(EMP_KEY,[]);if(!localStorage.getItem(TX_KEY))write(TX_KEY,[])}
function err(msg){throw new Error(msg)}
async function query(table,op,payload){
  const sb=getSupabase(); if(!sb) return null;
  if(op==="select") return sb.from(table).select("*").order(payload.order||"created_at",{ascending:payload.asc??true});
  if(op==="one") return sb.from(table).select("*").eq(payload.field,payload.value).maybeSingle();
  if(op==="insert") return sb.from(table).insert(payload.data).select().single();
  if(op==="upsert") return sb.from(table).upsert(payload.data,{onConflict:payload.onConflict}).select().single();
  if(op==="update") return sb.from(table).update(payload.data).eq(payload.field,payload.value).select().single();
  if(op==="delete") return sb.from(table).delete().eq(payload.field,payload.value);
}
export async function fetchAllPhones(){demoInit();if(appConfig.isConfigured){const r=await query("phones","select",{order:"id",asc:true});if(r.error)throw r.error;return r.data||[]}return read(PHONE_KEY,seedPhones)}
export async function fetchAllEmployees(){demoInit();if(appConfig.isConfigured){const r=await query("employees","select",{order:"employee_number",asc:true});if(r.error)throw r.error;return r.data||[]}return read(EMP_KEY,[])}
export async function fetchEmployeeByNumber(id){id=String(id||"").trim().toUpperCase();if(!id)return null;if(appConfig.isConfigured){const r=await query("employees","one",{field:"employee_number",value:id});if(r.error)throw r.error;return r.data}return read(EMP_KEY,[]).find(e=>e.employee_number===id)||null}
export async function fetchTransactions(){demoInit();if(appConfig.isConfigured){const r=await query("transactions","select",{order:"timestamp",asc:false});if(r.error)throw r.error;return r.data||[]}return read(TX_KEY,[])}
export async function saveEmployee(data,oldId=""){
  const id=data.employee_number.trim().toUpperCase(); const clean={employee_number:id,full_name:data.full_name.trim(),department:(data.department||"Operations").trim(),phone_number:(data.phone_number||"").trim()};
  if(!id||!clean.full_name)err("Employee ID and name are required.");
  const existing=await fetchEmployeeByNumber(id);
  if(existing && id!==oldId)err("That Employee ID already exists.");
  if(appConfig.isConfigured){
    if(oldId && oldId!==id){const d=await query("employees","delete",{field:"employee_number",value:oldId});if(d.error)throw d.error}
    const r=await query("employees","upsert",{data:clean,onConflict:"employee_number"});if(r.error)throw r.error;return r.data;
  }
  const list=read(EMP_KEY,[]); const idx=list.findIndex(e=>e.employee_number===oldId);
  if(idx>=0)list[idx]=clean;else list.push(clean);write(EMP_KEY,list);return clean;
}
export async function deleteEmployee(id){
  id=String(id).trim().toUpperCase();
  const phones=await fetchAllPhones(); if(phones.some(p=>p.current_employee_id===id))err("Cannot delete an employee who currently has a phone issued.");
  if(appConfig.isConfigured){const r=await query("employees","delete",{field:"employee_number",value:id});if(r.error)throw r.error;return}
  write(EMP_KEY,read(EMP_KEY,[]).filter(e=>e.employee_number!==id))
}
export async function issuePhone({phoneId,employeeNumber,employeeName,staffEmail="staff@company.com"}){
  phoneId=String(phoneId).trim().toUpperCase(); employeeNumber=String(employeeNumber).trim().toUpperCase();
  const emp=await fetchEmployeeByNumber(employeeNumber);if(!emp)err("Employee not found. Add the employee first.");
  const phones=await fetchAllPhones();const p=phones.find(x=>x.id===phoneId);if(!p)err("Phone not found.");if(p.status==="ISSUED")err("Phone is already issued.");
  const now=new Date().toISOString();const tx={timestamp:now,action:"ISSUE",phone_id:phoneId,employee_number:employeeNumber,employee_name:emp.full_name,condition:p.condition||"Good",notes:"",staff_email:staffEmail};
  if(appConfig.isConfigured){
    const u=await query("phones","update",{field:"id",value:phoneId,data:{status:"ISSUED",current_employee_id:employeeNumber,current_employee_name:emp.full_name,last_issue_time:now}});
    if(u.error)throw u.error;const t=await query("transactions","insert",{data:tx});if(t.error)throw t.error;
  }else{p.status="ISSUED";p.current_employee_id=employeeNumber;p.current_employee_name=emp.full_name;p.last_issue_time=now;write(PHONE_KEY,phones);const list=read(TX_KEY,[]);list.unshift({id:crypto.randomUUID(),...tx});write(TX_KEY,list)}
  return {phoneId,employeeName:emp.full_name}
}
export async function returnPhone({phoneId,condition,notes,staffEmail="staff@company.com"}){
  phoneId=String(phoneId).trim().toUpperCase();const phones=await fetchAllPhones();const p=phones.find(x=>x.id===phoneId);if(!p)err("Phone not found.");if(p.status!=="ISSUED")err("This phone is not currently issued.");
  const now=new Date().toISOString();const tx={timestamp:now,action:"RETURN",phone_id:phoneId,employee_number:p.current_employee_id,employee_name:p.current_employee_name,condition,notes:notes||"",staff_email:staffEmail};
  if(appConfig.isConfigured){
    const u=await query("phones","update",{field:"id",value:phoneId,data:{status:"AVAILABLE",current_employee_id:null,current_employee_name:null,last_return_time:now,condition}});
    if(u.error)throw u.error;const t=await query("transactions","insert",{data:tx});if(t.error)throw t.error;
  }else{p.status="AVAILABLE";p.current_employee_id=null;p.current_employee_name=null;p.last_return_time=now;p.condition=condition;write(PHONE_KEY,phones);const list=read(TX_KEY,[]);list.unshift({id:crypto.randomUUID(),...tx});write(TX_KEY,list)}
  return {phoneId,condition}
}
