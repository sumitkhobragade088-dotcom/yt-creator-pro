import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const esc = (v="") => String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dt = (v) => { if(!v) return "-"; const d=new Date(v); return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
let customers=[], channels=[], services=[];

function msg(t,ok=false){const e=$("freeServiceMessage");if(e){e.textContent=t;e.className=ok?"message ok":"message";}}
function selectedServiceNames(){return [...($('freeServiceType')?.selectedOptions||[])].map(o=>o.value).filter(Boolean);}
function syncServiceUI(){
  const sel=$("freeServiceType"),box=$("freeServiceOptions"),all=$("selectAllFreeServices"),clear=$("clearAllFreeServices"),summary=$("freeServiceSelectedSummary");
  if(!sel||!box)return;
  const values=new Set(selectedServiceNames());
  box.querySelectorAll('input[data-service-value]').forEach(i=>{i.checked=values.has(i.value);});
  if(summary) summary.textContent=`${values.size} selected`;
  const enabled=!!$("freeServiceChannel")?.value&&services.length>0;
  if(all)all.disabled=!enabled;
  if(clear)clear.disabled=!enabled||values.size===0;
  const btn=$("grantFreeService");if(btn)btn.disabled=!($("freeServiceCustomer")?.value&&$("freeServiceChannel")?.value&&values.size);
}
async function isAdmin(){const {data:{user}}=await supabase.auth.getUser();return !!user;}
async function loadCustomers(){
  if(!(await isAdmin()))return;
  const {data,error}=await supabase.from("customers").select("id,full_name,email").order("full_name",{ascending:true});
  if(error){msg(`Customer list load failed: ${error.message}`);return;}
  customers=data||[];
  const sel=$("freeServiceCustomer");if(!sel)return;
  sel.innerHTML='<option value="">Select customer…</option>'+customers.map(c=>`<option value="${esc(c.id)}">${esc(c.full_name||c.email||c.id)}${c.email?` • ${esc(c.email)}`:""}</option>`).join("");
}
async function loadChannels(customerId){
  const csel=$("freeServiceChannel"),ssel=$("freeServiceType"),btn=$("grantFreeService");
  if(!csel||!ssel)return;
  channels=[];csel.disabled=true;ssel.disabled=true;if(btn)btn.disabled=true;
  csel.innerHTML='<option value="">Loading channels…</option>';ssel.innerHTML="";renderServiceOptions();
  if(!customerId){csel.innerHTML='<option value="">Select customer first…</option>';renderServiceOptions();return;}
  const {data,error}=await supabase.from("channel_access").select("id,customer_id,channel_name,channel_id,google_connected,manager_access").eq("customer_id",customerId).order("updated_at",{ascending:false});
  if(error){msg(`Channel list load failed: ${error.message}`);return;}
  channels=(data||[]).filter(x=>x.google_connected||x.manager_access||x.channel_name);
  csel.innerHTML='<option value="">Select channel…</option>'+channels.map(c=>`<option value="${esc(c.id)}">${esc(c.channel_name||c.channel_id||"YouTube Channel")}${c.manager_access?" • Manager Access":c.google_connected?" • Connected":""}</option>`).join("");
  csel.disabled=!channels.length;if(!channels.length)csel.innerHTML='<option value="">No connected channel found</option>';
  renderServiceOptions();syncServiceUI();
}
async function loadServices(){
  const {data,error}=await supabase.from("service_charges").select("service_name,description,is_active,sort_order,amount,charge").eq("is_active",true).order("sort_order",{ascending:true}).order("service_name",{ascending:true});
  if(error){msg(`Service list load failed: ${error.message}`);return;}
  services=data||[];renderServiceOptions();
}
function renderServiceOptions(){
  const sel=$("freeServiceType"),box=$("freeServiceOptions");if(!sel||!box)return;
  const previous=new Set(selectedServiceNames());
  if(!services.length){sel.innerHTML="";box.innerHTML="<small>No active services available.</small>";syncServiceUI();return;}
  sel.innerHTML=services.map(s=>`<option value="${esc(s.service_name)}" ${previous.has(s.service_name)?"selected":""}>${esc(s.service_name)}</option>`).join("");
  if($("freeServiceChannel")?.value){
    sel.disabled=false;
    box.innerHTML=services.map(s=>`<label class="free-service-check"><input type="checkbox" data-service-value value="${esc(s.service_name)}" ${previous.has(s.service_name)?"checked":""}><span>${esc(s.service_name)}</span><small>₹${Number(s.amount??s.charge??0).toLocaleString("en-IN")}</small></label>`).join("");
    box.querySelectorAll('input[data-service-value]').forEach(i=>i.addEventListener("change",()=>{const o=[...sel.options].find(x=>x.value===i.value);if(o)o.selected=i.checked;syncServiceUI();}));
  }else{sel.disabled=true;box.innerHTML="<small>Select customer and channel first…</small>";}
  syncServiceUI();
}
async function grant(){
  const customer_id=$("freeServiceCustomer")?.value,channel_access_id=$("freeServiceChannel")?.value,ssel=$("freeServiceType"),duration=$("freeServiceDuration")?.value||"unlimited",btn=$("grantFreeService");
  const service_types=selectedServiceNames();
  if(!customer_id||!channel_access_id||!service_types.length){syncServiceUI();return;}
  btn.disabled=true;msg(`Granting ${service_types.length} free service${service_types.length>1?"s":""}…`);
  const channel=channels.find(x=>x.id===channel_access_id);let expires_at=null;
  if(duration!=="unlimited"){const d=new Date();d.setDate(d.getDate()+Number(duration));expires_at=d.toISOString();}
  const {data:{user}}=await supabase.auth.getUser();
  const rows=service_types.map(service_type=>({customer_id,channel_access_id,service_type,status:"active",expires_at,granted_by:user.id}));
  const {data,error}=await supabase.from("free_service_grants").insert(rows).select("id,service_type");
  if(error){msg(error.message);btn.disabled=false;return;}
  await Promise.all((data||[]).map(r=>supabase.from("activity_logs").insert({actor_type:"admin",customer_id,action:"free_service_granted",target_type:"free_service_grant",target_id:r.id||null,details:{service_type:r.service_type,channel_name:channel?.channel_name||"",expires_at}})));
  msg(`${(data||[]).length} free service${(data||[]).length>1?"s":""} granted successfully.`,true);
  [...ssel.options].forEach(o=>o.selected=false);renderServiceOptions();await loadFreeUserManager();
}
async function loadFreeUserManager(){
  const sel=$("freeUserManageCustomer"),list=$("freeUserChannelList"),summary=$("freeUserManageSummary");if(!sel||!list)return;
  const {data,error}=await supabase.from("free_service_grants").select("customer_id,channel_access_id,service_type,status,expires_at,created_at,customers(full_name,email)").order("created_at",{ascending:false}).limit(500);
  if(error){list.innerHTML=`<div class="yt-service-empty">${esc(error.message)}</div>`;return;}
  const rows=data||[];
  if($("freeUserServiceCount"))$("freeUserServiceCount").textContent=String(rows.length);
  const byCustomer=new Map();
  rows.forEach(r=>{if(!byCustomer.has(r.customer_id))byCustomer.set(r.customer_id,r);});
  const previous=sel.value;
  sel.innerHTML='<option value="">Select free user…</option>'+[...byCustomer.values()].map(r=>`<option value="${esc(r.customer_id)}">${esc(r.customers?.full_name||r.customers?.email||r.customer_id)}${r.customers?.email?` • ${esc(r.customers.email)}`:""}</option>`).join("");
  if(previous&&byCustomer.has(previous))sel.value=previous;
  else if(byCustomer.size===1)sel.value=[...byCustomer.keys()][0];
  await renderFreeUserChannels(sel.value,rows,summary,list);
}
async function renderFreeUserChannels(customerId,grantRows,summary,list){
  if(!customerId){if(summary)summary.textContent="Select a free user to load channels.";if(list)list.innerHTML='<div class="yt-service-empty">Select a free user to manage channels.</div>';return;}
  const {data,error}=await supabase.from("channel_access").select("id,channel_name,channel_id,google_connected,manager_access,updated_at").eq("customer_id",customerId).order("updated_at",{ascending:false});
  if(error){if(list)list.innerHTML=`<div class="yt-service-empty">${esc(error.message)}</div>`;return;}
  const grants=grantRows.filter(r=>r.customer_id===customerId);const grouped=new Map();
  grants.forEach(g=>{if(!grouped.has(g.channel_access_id))grouped.set(g.channel_access_id,[]);grouped.get(g.channel_access_id).push(g);});
  if(summary)summary.textContent=`${data?.length||0} connected channel${(data?.length||0)!==1?"s":""} • ${grants.length} free grant${grants.length!==1?"s":""}`;
  if(!data?.length){list.innerHTML='<div class="yt-service-empty">No connected YouTube channels found for this free user.</div>';return;}
  list.innerHTML=data.map(c=>{
    const gs=grouped.get(c.id)||[];const active=gs.filter(g=>g.status==="active"&&(!g.expires_at||new Date(g.expires_at)>new Date()));
    const servicesText=active.length?active.map(g=>esc(g.service_type)).join(" • "):"No active free service";
    const canManage=!!c.manager_access;
    return `<div class="free-user-channel-card"><div><b>${esc(c.channel_name||c.channel_id||"YouTube Channel")}</b><small>${c.google_connected?"Connected":"Saved"} • Free: ${servicesText}</small></div>${canManage?`<button type="button" class="btn primary" data-manage-customer="${esc(customerId)}" data-manage-target="channel">Manage Channel</button>`:`<span class="yt-status-chip pending">Manager Access required</span>`}</div>`;
  }).join("");
}
function bind(){
  $("freeServiceCustomer")?.addEventListener("change",async e=>{msg("");await loadChannels(e.target.value);renderServiceOptions();});
  $("freeServiceChannel")?.addEventListener("change",renderServiceOptions);
  $("freeServiceType")?.addEventListener("change",syncServiceUI);
  $("grantFreeService")?.addEventListener("click",grant);
  $("selectAllFreeServices")?.addEventListener("click",()=>{const s=$("freeServiceType");if(!s||s.disabled)return;[...s.options].forEach(o=>o.selected=true);syncServiceUI();});
  $("clearAllFreeServices")?.addEventListener("click",()=>{const s=$("freeServiceType");if(s)[...s.options].forEach(o=>o.selected=false);syncServiceUI();});
  $("clearFreeService")?.addEventListener("click",()=>{["freeServiceCustomer","freeServiceChannel","freeServiceType"].forEach(id=>{const e=$(id);if(e){if(e.multiple)[...e.options].forEach(o=>o.selected=false);else e.value="";}});const c=$("freeServiceChannel");if(c){c.innerHTML='<option value="">Select customer first…</option>';c.disabled=true;}renderServiceOptions();syncServiceUI();msg("");});
  $("refreshFreeServiceGrants")?.addEventListener("click",async()=>{await loadFreeUserManager();});
  $("freeUserManageCustomer")?.addEventListener("change",async e=>{
    const {data}=await supabase.from("free_service_grants").select("customer_id,channel_access_id,service_type,status,expires_at,created_at,customers(full_name,email)").eq("customer_id",e.target.value).order("created_at",{ascending:false}).limit(500);
    await renderFreeUserChannels(e.target.value,data||[],$("freeUserManageSummary"),$("freeUserChannelList"));
  });
}
async function init(){bind();await loadCustomers();await loadServices();await loadFreeUserManager();}
init();
