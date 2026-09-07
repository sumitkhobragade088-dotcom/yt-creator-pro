import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const esc = (v="") => String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dt = (v) => { if(!v) return "-"; const d=new Date(v); return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
let customers=[], channels=[], services=[];

async function isAdmin(){
  const {data:{user}}=await supabase.auth.getUser();
  if(!user) return false;
  const {data}=await supabase.from("admin_users").select("id").eq("id",user.id).maybeSingle();
  return !!data;
}
function msg(t,ok=false){const e=$("freeServiceMessage");if(e){e.textContent=t;e.className=ok?"message ok":"message";}}
async function loadCustomers(){
  const ok=await isAdmin(); if(!ok)return;
  const {data,error}=await supabase.from("customers").select("id,full_name,email").order("full_name",{ascending:true});
  if(error){msg(error.message);return;} customers=data||[];
  const sel=$("freeServiceCustomer"); if(!sel)return;
  sel.innerHTML='<option value="">Select customer…</option>'+customers.map(c=>`<option value="${esc(c.id)}">${esc(c.full_name||c.email||c.id)}${c.email?` • ${esc(c.email)}`:""}</option>`).join("");
}
async function loadChannels(customerId){
  const csel=$("freeServiceChannel"),ssel=$("freeServiceType"),btn=$("grantFreeService");
  if(!csel||!ssel)return;
  channels=[]; csel.disabled=true; ssel.disabled=true; btn.disabled=true;
  csel.innerHTML='<option value="">Loading channels…</option>'; ssel.innerHTML='<option value="">Select channel first…</option>';
  if(!customerId)return;
  const {data,error}=await supabase.from("channel_access").select("id,customer_id,channel_name,channel_id,google_connected,manager_access").eq("customer_id",customerId).order("updated_at",{ascending:false});
  if(error){msg(error.message);return;}
  channels=(data||[]).filter(x=>x.google_connected || x.manager_access || x.channel_name);
  csel.innerHTML='<option value="">Select channel…</option>'+channels.map(c=>`<option value="${esc(c.id)}">${esc(c.channel_name||c.channel_id||"YouTube Channel")}${c.manager_access?" • Manager Access":c.google_connected?" • Connected":""}</option>`).join("");
  csel.disabled=!channels.length;
  if(!channels.length)csel.innerHTML='<option value="">No connected channel found</option>';
}
async function loadServices(){
  const {data,error}=await supabase.from("service_charges").select("service_name,description,is_active,sort_order").eq("is_active",true).order("sort_order",{ascending:true}).order("service_name",{ascending:true});
  if(error){msg(error.message);return;} services=data||[];
}
function fillServices(){
  const ssel=$("freeServiceType"),csel=$("freeServiceChannel"),btn=$("grantFreeService");
  if(!ssel)return;
  ssel.innerHTML='<option value="">Select service…</option>'+services.map(s=>`<option value="${esc(s.service_name)}">${esc(s.service_name)} — FREE</option>`).join("");
  ssel.disabled=!csel?.value;
  btn.disabled=!(csel?.value&&ssel.value&&$("freeServiceCustomer")?.value);
}
async function grant(){
  const customer_id=$("freeServiceCustomer")?.value,channel_access_id=$("freeServiceChannel")?.value,service_type=$("freeServiceType")?.value,duration=$("freeServiceDuration")?.value||"unlimited",btn=$("grantFreeService");
  if(!customer_id||!channel_access_id||!service_type)return;
  btn.disabled=true; msg("Granting free service…");
  const channel=channels.find(x=>x.id===channel_access_id);
  let expires_at=null;
  if(duration!=="unlimited"){const d=new Date();d.setDate(d.getDate()+Number(duration));expires_at=d.toISOString();}
  const {data:{user}}=await supabase.auth.getUser();
  const {data,error}=await supabase.from("free_service_grants").insert({customer_id,channel_access_id,service_type,status:"active",expires_at,granted_by:user.id}).select("id").single();
  if(error){msg(error.message);btn.disabled=false;return;}
  await supabase.from("activity_logs").insert({actor_type:"admin",customer_id,action:"free_service_granted",target_type:"free_service_grant",target_id:data?.id||null,details:{service_type,channel_name:channel?.channel_name||"",expires_at}});
  msg("Free service granted successfully.",true); await loadGrants();
  $("freeServiceType").value=""; btn.disabled=false;
}
async function loadGrants(){
  const body=$("freeServiceGrantsBody");if(!body)return;
  const {data,error}=await supabase.from("free_service_grants").select("id,customer_id,channel_access_id,service_type,status,expires_at,created_at,customers(full_name,email),channel_access(channel_name)").order("created_at",{ascending:false}).limit(100);
  if(error){body.innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;return;}
  const rows=data||[]; $("freeUserServiceCount").textContent=String(rows.length);
  body.innerHTML=rows.length?rows.map(r=>`<tr><td><b>${esc(r.customers?.full_name||r.customers?.email||r.customer_id)}</b><br><small>${esc(r.customers?.email||"")}</small></td><td>${esc(r.channel_access?.channel_name||"-")}</td><td>${esc(r.service_type)}</td><td><span class="yt-status-chip ${r.status==="active"?"good":"pending"}">${esc(r.status)}</span></td><td>${r.expires_at?dt(r.expires_at):"No expiry"}</td><td>${dt(r.created_at)}</td></tr>`).join(""):'<tr><td colspan="6">No free service grants yet.</td></tr>';
}
function bind(){
  $("freeServiceCustomer")?.addEventListener("change",async e=>{msg("");await loadChannels(e.target.value);fillServices();});
  $("freeServiceChannel")?.addEventListener("change",fillServices);
  $("freeServiceType")?.addEventListener("change",fillServices);
  $("grantFreeService")?.addEventListener("click",grant);
  $("clearFreeService")?.addEventListener("click",()=>{["freeServiceCustomer","freeServiceChannel","freeServiceType"].forEach(id=>{const e=$(id);if(e)e.value="";});const c=$("freeServiceChannel"),s=$("freeServiceType"),b=$("grantFreeService");if(c){c.innerHTML='<option value="">Select customer first…</option>';c.disabled=true;}if(s){s.innerHTML='<option value="">Select channel first…</option>';s.disabled=true;}if(b)b.disabled=true;msg("");});
  $("refreshFreeServiceGrants")?.addEventListener("click",loadGrants);
}
async function init(){bind();await loadCustomers();await loadServices();await loadGrants();}
init();
