import { supabase } from "./supabase.js";

const ADMIN_EMAIL = "sumitkhobragade088@gmail.com";
const $ = (id) => document.getElementById(id);
const ADMIN_TIMEOUT = 8000;
function withTimeout(promise, ms=ADMIN_TIMEOUT, label="Request"){
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(`${label} timeout. Please try again.`)),ms))
  ]);
}
async function safeAdminQuery(query,fallback=null,label="Data"){
  try{
    const res=await withTimeout(query,ADMIN_TIMEOUT,label);
    if(res?.error)throw res.error;
    return res?.data ?? fallback;
  }catch(e){
    console.error(label,e);
    return fallback;
  }
}
function setText(id,value){const el=$(id);if(el)el.textContent=value==null?"":String(value);}
function esc(v=""){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
function dateText(value){if(!value)return "-";const d=new Date(value);return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});}
function fmt(value){const n=Number(value);return Number.isFinite(n)?n.toLocaleString("en-IN"):"0";}
function showMessage(text, ok=false){const el=$("adminMessage");if(el){el.textContent=text;el.className=ok?"message ok":"message";}}

async function getAccess(user){
  if(!user?.id) return {authorized:false,status:"unauthorized",role:null};
  const {data:admin,error}=await supabase.from("admin_users").select("id,email,status").eq("id",user.id).maybeSingle();
  if(error || !admin) return {authorized:false,status:"unauthorized",role:null};
  const status=String(admin.status||"active").trim().toLowerCase();
  const {data:staff,error:staffError}=await supabase.from("admin_staff_roles").select("role,status").eq("admin_id",user.id).maybeSingle();
  const role=staff?.role || (String(admin.email||"").toLowerCase()===ADMIN_EMAIL.toLowerCase()?"super_admin":null);
  const effectiveStatus=staff?.status ? String(staff.status).toLowerCase() : status;
  if(effectiveStatus==="inactive") return {authorized:false,status:"inactive",role};
  if(effectiveStatus==="suspended") return {authorized:false,status:"suspended",role};
  if(effectiveStatus!=="active") return {authorized:false,status:"unauthorized",role};
  if(!role) return {authorized:false,status:"unauthorized",role:null};
  return {authorized:true,status:"active",role};
}

const form=$("adminLoginForm");
if(form){form.addEventListener("submit",async e=>{
  e.preventDefault(); const btn=form.querySelector('button[type="submit"]'); if(btn)btn.disabled=true; showMessage("Signing in...");
  try{
    const email=$("adminEmail")?.value.trim(); const password=$("adminPassword")?.value||"";
    const {data,error}=await supabase.auth.signInWithPassword({email,password}); if(error)throw error;
    const access=await getAccess(data?.user);
    if(!access.authorized){await supabase.auth.signOut().catch(()=>{});
      if(access.status==="inactive"){showMessage("Staff account is INACTIVE. Login is blocked.");return;}
      if(access.status==="suspended"){showMessage("Staff account is SUSPENDED. Login is blocked.");return;}
      showMessage("This account is not authorized as admin/staff.");return;
    }
    sessionStorage.setItem("yt_admin_role",access.role||"super_admin");
    sessionStorage.setItem("yt_admin_fresh_login","1");
    showMessage(`Login successful — ${access.role||"admin"}.`,true);
    const target=access.role==="manager"?"../staff-manager.html":access.role==="operator"?"../staff-operator.html":access.role==="support"?"../staff-support.html":"index.html";
    setTimeout(()=>location.href=target,150);
  }catch(err){showMessage(err?.message||"Login failed.");}finally{if(btn)btn.disabled=false;}
});}

async function isAdmin(user){const a=await getAccess(user);return a.authorized;}

let dashboardCache={customers:[],access:[],requests:[]};

async function loadAdminDashboard(){
  if (!document.body.dataset.adminProtected) return;

  // Use the persisted local session after login.
  // Avoid getUser() here because its extra network round-trip could time out
  // and incorrectly throw a freshly authenticated admin back to login.
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user || null;
  if (!(await isAdmin(user))) {
    location.href = "login.html";
    return;
  }
  setText("adminEmailView", user.email || "");

  const [customers,access,requests] = await Promise.all([
    safeAdminQuery(supabase.from("customers").select("id,user_id,full_name,email,mobile,channel_name,channel_url,created_at,account_status").order("created_at",{ascending:false}),[],"Customers"),
    safeAdminQuery(supabase.from("channel_access").select("*").order("updated_at",{ascending:false}),[],"Channel access"),
    safeAdminQuery(supabase.from("service_requests").select("*").order("created_at",{ascending:false}),[],"Service requests")
  ]);

  dashboardCache={customers,access,requests};

  const customerMap=new Map(customers.map(c=>[c.id,c]));
  const connected=access.filter(a=>a.google_connected);
  const pendingAccess=access.filter(a=>!a.manager_access);
  const granted=access.filter(a=>a.manager_access);
  const monetizationCases=access.filter(a=>String(a.monetization_status||"").trim()!=="");
  const approved=access.filter(a=>["approved","monetized","active","completed","complete","done"].includes(String(a.monetization_status||"").toLowerCase()));
  const adsenseLinked=access.filter(a=>a.adsense_access);
  const validRequests=requests.filter(r=>String(r.status||"").toLowerCase()!=="payment_pending");
  const pendingReq=validRequests.filter(r=>String(r.status||"").toLowerCase()==="pending");
  const completedReq=validRequests.filter(r=>["completed","complete","done","approved"].includes(String(r.status||"").toLowerCase()));
  const totalViews=access.reduce((sum,a)=>sum+Number(a.views||0),0);

  setText("totalCustomers",customers.length);
  setText("totalChannels",connected.length);
  setText("totalAccessRequests",access.length);
  setText("pendingAccess",pendingAccess.length);
  setText("totalMonetizationCases",monetizationCases.length);
  setText("totalAdsenseLinked",adsenseLinked.length);
  setText("totalRequests",validRequests.length);
  setText("completedRequests",completedReq.length);
  setText("pendingRequests",pendingReq.length);
  setText("grantedAccess",granted.length);
  setText("approvedMonetization",approved.length);
  setText("allChannelViews",fmt(totalViews));

  setText("customersSectionCount",customers.length);
  setText("channelsSectionCount",connected.length);
  setText("accessSectionCount",access.length);
  setText("monetizationSectionCount",monetizationCases.length);
  setText("adsenseSectionCount",adsenseLinked.length);

  renderCustomers(customers);
  renderChannels(customers,access);
  renderAccess(customerMap,access);
  renderMonetization(customerMap,access);
  renderAdsense(customerMap,access);
  renderHistory(customers,access,validRequests,customerMap);
  renderAdminManage(customerMap,access);
  renderAdminAnalytics(customerMap,access);
  renderAdminCopyright(customerMap,access);
  applyAdminCmsAndEditor();
}

function renderCustomers(rows){
  const body=$("customersBody"); if(!body) return;
  body.innerHTML=rows.length?rows.map(c=>{
    const status=String(c.account_status||"active").toLowerCase()==="disabled"?"disabled":"active";
    return `<tr>
      <td><b>${esc(c.full_name||"-")}</b></td>
      <td>${esc(c.email||"-")}</td>
      <td>${esc(c.mobile||"-")}</td>
      <td>${esc(c.channel_name||"-")}</td>
      <td>${dateText(c.created_at)}</td>
      <td><span class="yt-status-chip ${status==='active'?'good':'bad'}">${status==='active'?'Active':'Disabled'}</span></td>
      <td><button type="button" class="btn" data-customer-actions="${esc(c.id)}">Actions</button></td>
    </tr>`;
  }).join(""):'<tr><td colspan="7">No customers yet.</td></tr>';
}

function getCustomerById(id){return (dashboardCache.customers||[]).find(c=>String(c.id)===String(id))||null;}
function openCustomerActions(id){
  const c=getCustomerById(id); if(!c) return;
  const modal=$("customerActionsModal"), form=$("customerActionsForm"); if(!modal||!form)return;
  form.dataset.customerId=c.id;
  $("customerActionName").textContent=c.full_name||c.email||"Customer";
  $("customerActionEmail").textContent=c.email||"-";
  $("customerActionStatus").value=String(c.account_status||"active").toLowerCase()==="disabled"?"disabled":"active";
  $("customerActionDelete").checked=false;
  modal.hidden=false;
}
function closeCustomerActions(){const m=$("customerActionsModal");if(m)m.hidden=true;}
async function saveCustomerActions(){
  const form=$("customerActionsForm"); const id=form?.dataset.customerId; const c=getCustomerById(id); if(!c)return;
  const status=$("customerActionStatus")?.value||"active";
  const del=$("customerActionDelete")?.checked;
  const btn=$("customerActionsSave"); if(btn)btn.disabled=true;
  try{
    if(del){
      if(!confirm(`Delete ${c.full_name||c.email||"this user"}? This removes the customer profile and related visible customer record.`))return;
      const {data:deleted,error}=await withTimeout(supabase.rpc("admin_delete_customer",{p_customer_id:c.id}),ADMIN_TIMEOUT,"Delete user");
      if(deleted===false) throw new Error("User was not found.");
      if(error)throw error;
      showMessage("User deleted successfully.",true); closeCustomerActions(); await loadAdminDashboard(); return;
    }
    if(status!==String(c.account_status||"active").toLowerCase()){
      const {error}=await withTimeout(supabase.from("customers").update({account_status:status}).eq("id",c.id),ADMIN_TIMEOUT,"Update user status");
      if(error)throw error;
    }
    if($("customerActionReset")?.checked){
      if(!c.email)throw new Error("This user has no email address for password reset.");
      const redirectTo=new URL("reset-password.html",location.href.replace(/admin\/[^/]*$/,"")).href;
      const {error}=await withTimeout(supabase.auth.resetPasswordForEmail(c.email,{redirectTo}),ADMIN_TIMEOUT,"Send reset email");
      if(error)throw error;
    }
    showMessage($("customerActionReset")?.checked?"User changes saved. Password reset link sent.":"User changes saved.",true);
    closeCustomerActions(); await loadAdminDashboard();
  }catch(e){showMessage(e?.message||"Unable to save user changes.");}finally{if(btn)btn.disabled=false;}
}

document.addEventListener("click",e=>{
  const b=e.target.closest("[data-customer-actions]"); if(b){e.preventDefault();openCustomerActions(b.dataset.customerActions);}
  if(e.target.closest("[data-customer-actions-close]"))closeCustomerActions();
});
document.getElementById("customerActionsForm")?.addEventListener("submit",e=>{e.preventDefault();saveCustomerActions();});

function renderChannels(customers,access){
  const body=$("youtubeChannelsBody"); if(!body) return;
  const map=new Map(access.map(a=>[a.customer_id,a]));
  const rows=customers.map(c=>({c,a:map.get(c.id)})).filter(x=>x.a?.google_connected);
  body.innerHTML=rows.length?rows.map(({c,a})=>`
    <tr>
      <td><b>${esc(c.full_name||"-")}</b></td>
      <td>${esc(c.email||"-")}</td>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td><span class="yt-status-chip good">Connected ✅</span></td>
      <td>${fmt(a.subscribers)}</td>
      <td>${fmt(a.views)}</td>
      <td>${fmt(a.videos)}</td>
      <td>${a.manager_access?'<span class="yt-status-chip good">GRANTED ✅</span>':'<span class="yt-status-chip pending">PENDING 🟡</span>'}</td>
    </tr>`).join(""):'<tr><td colspan="8">No connected channels.</td></tr>';
}

function renderAccess(customerMap,rows){
  const body=$("accessRequestsBody"); if(!body) return;
  body.innerHTML=rows.length?rows.map(a=>{
    const c=customerMap.get(a.customer_id)||{};
    return `<tr>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td>${a.google_connected?'<span class="yt-status-chip good">Connected ✅</span>':'<span class="yt-status-chip bad">Not Connected</span>'}</td>
      <td>${a.manager_access?'<span class="yt-status-chip good">Granted ✅</span>':'<span class="yt-status-chip pending">Pending 🟡</span>'}</td>
      <td>${dateText(a.updated_at)}</td>
      <td>${a.manager_access
        ? '<button class="btn" type="button" disabled>Granted ✅</button>'
        : `<button class="btn primary" type="button" data-grant-manager-access="${esc(a.customer_id)}">Mark Access Granted</button>`}
      </td>
    </tr>`;
  }).join(""):'<tr><td colspan="6">No access records.</td></tr>';

  body.querySelectorAll("[data-grant-manager-access]").forEach(btn=>{
    btn.addEventListener("click",async()=>{
      const customerId=btn.dataset.grantManagerAccess;
      if(!customerId)return;
      const oldText=btn.textContent;
      btn.disabled=true;
      btn.textContent="Saving...";
      try{
        const updatedAt=new Date().toISOString();
        const res=await withTimeout(
          supabase.from("channel_access")
            .update({manager_access:true,updated_at:updatedAt})
            .eq("customer_id",customerId)
            .select("customer_id,manager_access,updated_at")
            .maybeSingle(),
          8000,"Grant manager access"
        );
        if(res?.error)throw res.error;
        if(!res?.data?.manager_access)throw new Error("Manager access could not be saved. Check Supabase admin update policy.");
        btn.textContent="Granted ✅";
        await loadAdminDashboard();
      }catch(e){
        console.error("Grant manager access",e);
        alert(e?.message||"Manager access update failed.");
        btn.disabled=false;
        btn.textContent=oldText;
      }
    });
  });
}

function renderMonetization(customerMap,rows){
  const body=$("monetizationBody"); if(!body) return;
  const cases=rows.filter(a=>String(a.monetization_status||"").trim()!=="");
  body.innerHTML=cases.length?cases.map(a=>{
    const c=customerMap.get(a.customer_id)||{};
    return `<tr>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td><span class="yt-status-chip">${esc(a.monetization_status||"pending")}</span></td>
      <td>${fmt(a.subscribers)}</td><td>${fmt(a.views)}</td><td>${fmt(a.videos)}</td>
      <td>${a.google_connected&&a.manager_access?`<button class="btn primary" type="button" data-manage-customer="${esc(a.customer_id)}" data-manage-target="monetization">Open Revenue</button>`:'<span class="yt-status-chip pending">Access required</span>'}</td>
    </tr>`;
  }).join(""):'<tr><td colspan="7">No monetization cases.</td></tr>';
}

function renderAdsense(customerMap,rows){
  const body=$("adsenseBody"); if(!body) return;
  body.innerHTML=rows.length?rows.map(a=>{
    const c=customerMap.get(a.customer_id)||{};
    return `<tr>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td>${a.adsense_access?'<span class="yt-status-chip good">Linked / Access ✅</span>':'<span class="yt-status-chip pending">Not Linked</span>'}</td>
      <td>${esc(a.monetization_status||"pending")}</td>
      <td>${dateText(a.updated_at)}</td>
    </tr>`;
  }).join(""):'<tr><td colspan="5">No AdSense records.</td></tr>';
}

function renderServices(rows){
  const body=$("serviceRequestsBody"); if(!body) return;
  body.innerHTML=rows.length?rows.map(r=>`
    <tr><td>${esc(r.service_type||"Service")}</td><td>${esc(r.status||"pending")}</td><td>${dateText(r.created_at)}</td></tr>
  `).join(""):'<tr><td colspan="3">No service requests.</td></tr>';
}

function renderHistory(customers,access,requests,customerMap){
  const box=$("adminHistoryList"); if(!box) return;
  const items=[];
  customers.forEach(c=>items.push({date:c.created_at,icon:"👤",title:"Customer Registered",text:`${c.full_name||c.email||"Customer"} joined.`}));
  access.forEach(a=>{
    const c=customerMap.get(a.customer_id)||{};
    items.push({date:a.updated_at,icon:a.manager_access?"✅":"🔐",title:a.manager_access?"Manager Access Granted":"Channel Access Updated",text:`${a.channel_name||c.channel_name||c.full_name||"Channel"} · ${a.google_connected?"Google Connected":"Not Connected"}`});
  });
  requests.forEach(r=>items.push({date:r.created_at,icon:"🧰",title:"Service Request",text:`${r.service_type||"Service"} · ${r.status||"pending"}`}));

  items.sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
  box.innerHTML=items.length?items.slice(0,50).map(x=>`
    <div class="yt-history-item">
      <div class="yt-history-icon">${x.icon}</div>
      <div><b>${esc(x.title)}</b><p>${esc(x.text)}</p></div>
      <time>${dateText(x.date)}</time>
    </div>`).join(""):'<div class="yt-history-empty">No activity history yet.</div>';
}


function adminMoney(n){return `₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;}
function adminStatus(v){return String(v||"pending").toLowerCase();}

async function loadAdminServicesCatalog(){
  const rows=await safeAdminQuery(
    supabase.from("service_charges").select("id,service_name,description,charge,is_active,sort_order").order("sort_order",{ascending:true}).order("service_name",{ascending:true}),
    [],"Service catalog"
  );
  setText("servicesSectionCount",rows.length);
  const body=$("serviceRequestsBody"); if(!body)return;
  body.innerHTML=rows.length?rows.map(r=>`<tr>
    <td><b>${esc(r.service_name||"Service")}</b></td>
    <td>${esc(r.description||"-")}</td>
    <td>${adminMoney(r.charge)}</td>
    <td>${r.is_active?'<span class="yt-status-chip good">Active</span>':'<span class="yt-status-chip bad">Inactive</span>'}</td>
  </tr>`).join(""):'<tr><td colspan="4">No services yet.</td></tr>';
}

async function loadAdminPayments(){
  const [payments,customers]=await Promise.all([
    safeAdminQuery(supabase.from("payments").select("*").order("created_at",{ascending:false}),[],"Payments"),
    safeAdminQuery(supabase.from("customers").select("id,full_name,email"),[],"Payment customers")
  ]);
  const cm=new Map(customers.map(c=>[c.id,c]));
  const paid=payments.filter(p=>adminStatus(p.status)==="paid");
  const pending=payments.filter(p=>["pending","initiated"].includes(adminStatus(p.status)));
  const failed=payments.filter(p=>["failed","cancelled","canceled"].includes(adminStatus(p.status)));
  setText("paymentsSectionCount",payments.length);
  setText("payTotalCollection",adminMoney(paid.reduce((n,p)=>n+Number(p.amount||0),0)));
  setText("paySuccessCount",paid.length);
  setText("payPendingCount",pending.length);
  setText("payFailedCount",failed.length);
  const body=$("paymentsBody"); if(!body)return;
  body.innerHTML=payments.length?payments.map(p=>{
    const c=cm.get(p.customer_id)||{};
    return `<tr>
      <td>${esc(p.txnid||p.id||"-")}</td>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(p.service_name||"Service")}</td>
      <td>${adminMoney(p.amount)}</td>
      <td><span class="yt-status-chip ${adminStatus(p.status)==="paid"?"good":adminStatus(p.status)==="failed"?"bad":"pending"}">${esc(p.status||"pending")}</span></td>
      <td>${esc(p.payment_mode||"-")}</td>
      <td>${dateText(p.updated_at||p.created_at)}</td>
    </tr>`;
  }).join(""):'<tr><td colspan="7">No payments yet.</td></tr>';
}

function requestUpdateModal(){
  let modal=$("adminRequestUpdateModal");
  if(modal)return modal;
  modal=document.createElement("div");
  modal.id="adminRequestUpdateModal";
  modal.innerHTML=`<div class="yt-req-modal-backdrop" data-close-request-modal></div>
  <div class="yt-req-modal" role="dialog" aria-modal="true" aria-labelledby="adminRequestUpdateTitle">
    <div class="yt-req-modal-head"><div><span>USER REQUEST</span><h3 id="adminRequestUpdateTitle">Update Request</h3><p id="adminRequestUpdateMeta"></p></div><button type="button" class="yt-req-modal-x" data-close-request-modal aria-label="Close">×</button></div>
    <div class="yt-req-modal-body">
      <label>Status</label>
      <select id="adminRequestUpdateStatus"><option value="pending">Pending</option><option value="processing">Processing</option><option value="on_hold">On Hold</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select>
      <label>Description / Note</label>
      <textarea id="adminRequestUpdateNote" rows="5" placeholder="Write an update for the user…"></textarea>
      <label>Screenshot (optional)</label>
      <input id="adminRequestUpdateFile" type="file" accept="image/jpeg,image/png">
      <small>JPG/PNG only, maximum 10 MB. The uploaded screenshot will be visible only in this user's My Requests.</small>
      <div id="adminRequestUpdateFileName" class="yt-req-file-name"></div>
      <div id="adminRequestUpdateMessage" class="yt-req-modal-message"></div>
    </div>
    <div class="yt-req-modal-foot"><button type="button" class="btn" data-close-request-modal>Cancel</button><button type="button" class="btn primary" id="adminRequestUpdateSave">Save Update</button></div>
  </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-close-request-modal]").forEach(x=>x.addEventListener("click",()=>closeRequestUpdateModal()));
  modal.querySelector("#adminRequestUpdateFile")?.addEventListener("change",()=>{
    const f=modal.querySelector("#adminRequestUpdateFile")?.files?.[0];
    setText("adminRequestUpdateFileName",f?`Selected: ${f.name}`:"");
  });
  return modal;
}

let activeRequestUpdate=null;
function closeRequestUpdateModal(){
  const modal=$("adminRequestUpdateModal");
  if(modal)modal.remove();
  activeRequestUpdate=null;
}

function openRequestUpdateModal(request,customer){
  const modal=requestUpdateModal();
  activeRequestUpdate={request,customer};
  setText("adminRequestUpdateTitle",`Update: ${request.service_type||"Service"}`);
  setText("adminRequestUpdateMeta",`${customer?.full_name||customer?.email||"Customer"} · Request ${String(request.id||"").slice(0,8).toUpperCase()}`);
  const status=$("adminRequestUpdateStatus"); if(status)status.value=adminStatus(request.status)==="payment_pending"?"pending":adminStatus(request.status);
  if($("adminRequestUpdateNote"))$("adminRequestUpdateNote").value="";
  if($("adminRequestUpdateFile"))$("adminRequestUpdateFile").value="";
  setText("adminRequestUpdateFileName","");
  setText("adminRequestUpdateMessage","");
  requestUpdateModal().querySelector("#adminRequestUpdateSave").onclick=saveRequestUpdate;
}

async function saveRequestUpdate(){
  const modal=$("adminRequestUpdateModal"), ctx=activeRequestUpdate;
  if(!modal||!ctx)return;
  const save=$("adminRequestUpdateSave"), status=$("adminRequestUpdateStatus")?.value||"pending", note=$("adminRequestUpdateNote")?.value.trim()||"", file=$("adminRequestUpdateFile")?.files?.[0]||null;
  if(file && (!/^image\/(jpeg|png)$/.test(file.type) || file.size>10*1024*1024)){
    setText("adminRequestUpdateMessage","Only JPG/PNG images up to 10 MB are allowed.");
    return;
  }
  save.disabled=true; save.textContent="Saving…"; setText("adminRequestUpdateMessage","Saving update…");
  try{
    const {data:sessionData}=await supabase.auth.getSession();
    const session=sessionData?.session;
    if(!session?.user?.id)throw new Error("Admin session expired. Please login again.");
    const requestId=ctx.request.id, customerId=ctx.request.customer_id;
    if(file){
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
      const path=`${customerId}/admin-updates/${requestId}/${Date.now()}-${safe}`;
      const up=await supabase.storage.from("user-documents").upload(path,file,{upsert:false,contentType:file.type});
      if(up.error)throw up.error;
      const doc=await supabase.from("request_documents").insert({customer_id:customerId,request_id:requestId,file_name:`Admin Update - ${file.name}`,storage_path:path,mime_type:file.type,file_size:file.size});
      if(doc.error)throw doc.error;
    }
    const upd=await supabase.from("service_requests").update({status}).eq("id",requestId);
    if(upd.error)throw upd.error;
    if(note){
      const ins=await supabase.from("request_notes").insert({request_id:requestId,note,created_by:session.user.id});
      if(ins.error)throw ins.error;
    }
    if(!note && !file){
      const ins=await supabase.from("request_notes").insert({request_id:requestId,note:`Status updated to ${status.replaceAll("_"," ")}.`,created_by:session.user.id});
      if(ins.error)throw ins.error;
    }
    setText("adminRequestUpdateMessage","Update saved successfully ✓");
    setTimeout(()=>{closeRequestUpdateModal();loadAdminUserRequests();},350);
  }catch(e){
    console.error("Admin request update",e);
    setText("adminRequestUpdateMessage",e?.message||"Update failed. Please try again.");
    save.disabled=false; save.textContent="Save Update";
  }
}

function injectRequestUpdateStyles(){
  if($("adminRequestUpdateStyles"))return;
  const style=document.createElement("style"); style.id="adminRequestUpdateStyles";
  style.textContent=`#adminRequestUpdateModal{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px}#adminRequestUpdateModal .yt-req-modal-backdrop{position:absolute;inset:0;background:rgba(15,23,42,.52)}#adminRequestUpdateModal .yt-req-modal{position:relative;width:min(620px,96vw);max-height:92vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.25);border:1px solid #e3e8f2}#adminRequestUpdateModal .yt-req-modal-head,#adminRequestUpdateModal .yt-req-modal-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid #edf1f7}#adminRequestUpdateModal .yt-req-modal-foot{border-top:1px solid #edf1f7;border-bottom:0;justify-content:flex-end}#adminRequestUpdateModal .yt-req-modal-head span{font-size:11px;font-weight:800;letter-spacing:.08em;color:#d64b5b}#adminRequestUpdateModal h3{margin:4px 0 3px;font-size:22px;color:#172033}#adminRequestUpdateModal p{margin:0;color:#718096;font-size:12px}#adminRequestUpdateModal .yt-req-modal-body{padding:20px}#adminRequestUpdateModal label{display:block;margin:0 0 7px;font-size:12px;font-weight:800;color:#26344d}#adminRequestUpdateModal label:not(:first-child){margin-top:16px}#adminRequestUpdateModal select,#adminRequestUpdateModal textarea,#adminRequestUpdateModal input[type=file]{width:100%;box-sizing:border-box;border:1px solid #d8e0ec;border-radius:10px;background:#fff;padding:10px 12px;color:#172033}#adminRequestUpdateModal textarea{resize:vertical;min-height:120px}#adminRequestUpdateModal small{display:block;margin-top:7px;color:#718096;line-height:1.4}#adminRequestUpdateModal .yt-req-file-name{margin-top:8px;font-size:12px;color:#2563eb;word-break:break-word}#adminRequestUpdateModal .yt-req-modal-message{min-height:20px;margin-top:12px;font-size:13px;font-weight:700;color:#b42318}#adminRequestUpdateModal .yt-req-modal-x{border:0;background:transparent;font-size:28px;line-height:1;color:#64748b;cursor:pointer;padding:2px 8px}`;
  document.head.appendChild(style);
}

async function loadAdminUserRequests(){
  injectRequestUpdateStyles();
  const [requests,payments,customers]=await Promise.all([
    safeAdminQuery(supabase.from("service_requests").select("id,customer_id,service_type,status,created_at").order("created_at",{ascending:false}),[],"User requests"),
    safeAdminQuery(supabase.from("payments").select("request_id,status,amount").order("created_at",{ascending:false}),[],"Request payments"),
    safeAdminQuery(supabase.from("customers").select("id,full_name,email"),[],"Request customers")
  ]);
  const pm=new Map(payments.map(p=>[p.request_id,p]));
  const cm=new Map(customers.map(c=>[c.id,c]));
  const rows=requests.filter(r=>adminStatus(pm.get(r.id)?.status)==="paid");
  setText("userRequestsSectionCount",rows.length);
  const body=$("userRequestsBody"); if(!body)return;
  body.innerHTML=rows.length?rows.map(r=>{
    const p=pm.get(r.id)||{},c=cm.get(r.customer_id)||{};
    const current=adminStatus(r.status)==="payment_pending"?"pending":adminStatus(r.status);
    return `<tr>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(r.service_type||"Service")}</td>
      <td><span class="yt-status-chip good">Paid ${adminMoney(p.amount)}</span></td>
      <td><span class="yt-status-chip">${esc(current)}</span></td>
      <td>${dateText(r.created_at)}</td>
      <td>
        <select data-request-status="${esc(r.id)}">
          ${["pending","processing","on_hold","completed","rejected"].map(st=>`<option value="${st}" ${current===st?"selected":""}>${st==="on_hold"?"On Hold":st[0].toUpperCase()+st.slice(1)}</option>`).join("")}
        </select>
        <button class="btn" type="button" data-save-request="${esc(r.id)}">Update</button>
      </td>
    </tr>`;
  }).join(""):'<tr><td colspan="6">No paid user requests yet.</td></tr>';
  body.querySelectorAll("[data-save-request]").forEach(btn=>{
    btn.addEventListener("click",()=>{
      const id=btn.dataset.saveRequest;
      const req=rows.find(x=>x.id===id); if(!req)return;
      const select=body.querySelector(`[data-request-status="${CSS.escape(id)}"]`); if(select)req.status=select.value;
      openRequestUpdateModal(req,cm.get(req.customer_id)||{});
    });
  });
}

let serviceChargeRows=[];
function resetServiceChargeForm(){
  setText("chargeFormTitle","New Service");
  if($("chargeServiceId"))$("chargeServiceId").value="";
  if($("chargeServiceName"))$("chargeServiceName").value="";
  if($("chargeServiceDescription"))$("chargeServiceDescription").value="";
  if($("chargeServiceAmount"))$("chargeServiceAmount").value="";
  if($("chargeServiceActive"))$("chargeServiceActive").checked=true;
  if($("saveServiceCharge"))$("saveServiceCharge").textContent="Add New Service";
  if($("serviceChargeMessage"))$("serviceChargeMessage").textContent="";
}
async function loadServiceCharges(){
  serviceChargeRows=await safeAdminQuery(
    supabase.from("service_charges").select("*").order("sort_order",{ascending:true}).order("service_name",{ascending:true}),
    [],"Service charges"
  );
  const active=serviceChargeRows.filter(x=>x.is_active).length;
  setText("serviceChargeCount",serviceChargeRows.length);
  setText("chargeTotalServices",serviceChargeRows.length);
  setText("chargeActiveServices",active);
  setText("chargeInactiveServices",serviceChargeRows.length-active);
  const body=$("serviceChargeBody"); if(!body)return;
  body.innerHTML=serviceChargeRows.length?serviceChargeRows.map(r=>`<tr data-charge-row="${esc(r.id)}">
    <td><b>${esc(r.service_name)}</b></td>
    <td>${esc(r.description||"-")}</td>
    <td><b class="yt-current-charge">${adminMoney(r.charge)}</b></td>
    <td><input class="yt-charge-inline-input" data-new-charge="${esc(r.id)}" type="number" min="0" step="0.01" value="${Number(r.charge||0)}" aria-label="New charge for ${esc(r.service_name)}"></td>
    <td><select class="yt-charge-inline-status" data-charge-status="${esc(r.id)}" aria-label="Status for ${esc(r.service_name)}"><option value="true" ${r.is_active?'selected':''}>Active</option><option value="false" ${!r.is_active?'selected':''}>Inactive</option></select></td>
    <td><div class="yt-charge-table-actions"><button class="btn yt-charge-edit" data-edit-charge="${esc(r.id)}">Edit</button><button class="btn danger yt-charge-delete" data-delete-charge="${esc(r.id)}">Delete</button><button class="btn primary yt-charge-update" data-update-charge="${esc(r.id)}">Update</button></div></td>
  </tr>`).join(""):'<tr><td colspan="6">No services yet.</td></tr>';

  body.querySelectorAll("[data-edit-charge]").forEach(btn=>btn.addEventListener("click",()=>{
    const r=serviceChargeRows.find(x=>x.id===btn.dataset.editCharge); if(!r)return;
    setText("chargeFormTitle","Edit Service");
    $("chargeServiceId").value=r.id;$("chargeServiceName").value=r.service_name||"";
    $("chargeServiceDescription").value=r.description||"";$("chargeServiceAmount").value=Number(r.charge||0);
    $("chargeServiceActive").checked=!!r.is_active;$("saveServiceCharge").textContent="Update Service";
    const inline=body.querySelector(`[data-new-charge="${CSS.escape(r.id)}"]`);
    if(inline){inline.focus();inline.select();}
  }));
  body.querySelectorAll("[data-update-charge]").forEach(btn=>btn.addEventListener("click",async()=>{
    const id=btn.dataset.updateCharge;
    const amountInput=body.querySelector(`[data-new-charge="${CSS.escape(id)}"]`);
    const statusInput=body.querySelector(`[data-charge-status="${CSS.escape(id)}"]`);
    const amount=Number(amountInput?.value||0);
    if(!Number.isFinite(amount)||amount<0){alert("Please enter a valid new charge.");return;}
    const oldText=btn.textContent;btn.disabled=true;btn.textContent="Updating...";
    try{
      const res=await withTimeout(
        supabase.from("service_charges").update({charge:amount,is_active:statusInput?.value==="true",updated_at:new Date().toISOString()}).eq("id",id).select("id,charge,is_active"),
        8000,"Update service charge"
      );
      if(res?.error)throw res.error;
      if(!Array.isArray(res?.data)||res.data.length===0)throw new Error("Service update was blocked by database permission.");
      btn.textContent="Updated ✓";
      await loadServiceCharges();
    }catch(e){alert(e?.message||"Update failed.");btn.disabled=false;btn.textContent=oldText;}
  }));
  body.querySelectorAll("[data-delete-charge]").forEach(btn=>btn.addEventListener("click",async()=>{
    if(!confirm("Delete this service?"))return;
    try{
      const res=await withTimeout(supabase.from("service_charges").delete().eq("id",btn.dataset.deleteCharge),8000,"Delete service");
      if(res?.error)throw res.error;
      await loadServiceCharges();
    }catch(e){alert(e?.message||"Delete failed.");}
  }));
}

if($("saveServiceCharge")) $("saveServiceCharge").addEventListener("click",async()=>{
  const id=$("chargeServiceId").value;
  const row={
    service_name:$("chargeServiceName").value.trim(),
    description:$("chargeServiceDescription").value.trim(),
    charge:Number($("chargeServiceAmount").value||0),
    is_active:$("chargeServiceActive").checked
  };
  if(!row.service_name)return $("serviceChargeMessage").textContent="Service name required.";
  if(row.charge<0)return $("serviceChargeMessage").textContent="Charge invalid.";
  $("saveServiceCharge").disabled=true;
  try{
    const q=id
      ? supabase.from("service_charges").update({...row,updated_at:new Date().toISOString()}).eq("id",id).select("id,service_name,charge,is_active")
      : supabase.from("service_charges").insert(row).select("id,service_name,charge,is_active");
    const res=await withTimeout(q,8000,id?"Update service":"Add service");
    if(res?.error)throw res.error;
    if(id && (!Array.isArray(res?.data) || res.data.length===0)){
      throw new Error("Service update was blocked by database permission. Run SERVICE-CHARGE-UPDATE-FIX.sql in Supabase SQL Editor.");
    }
    await loadServiceCharges();
    resetServiceChargeForm();
    $("serviceChargeMessage").textContent=id?"Service updated ✅":"Service added ✅";
  }catch(e){$("serviceChargeMessage").textContent=e?.message||"Save failed.";}
  finally{$("saveServiceCharge").disabled=false;}
});
if($("cancelServiceChargeEdit")) $("cancelServiceChargeEdit").addEventListener("click",resetServiceChargeForm);

function loadPremiumSectionData(name){
  if(name==="services") loadAdminServicesCatalog();
  if(name==="payments") loadAdminPayments();
  if(name==="service-charge") loadServiceCharges();
  if(name==="user-requests") loadAdminUserRequests();
}

window.adminLogout = async () => {
  try{await withTimeout(supabase.auth.signOut(),5000,"Logout");}catch(_){}
  location.href = "login.html";
};

if($("refreshAdminDashboard")) $("refreshAdminDashboard").onclick=()=>{loadAdminDashboard();loadPremiumSectionData(sessionStorage.getItem("yt_admin_view")||"dashboard");};
if($("settingsRefreshAdmin")) $("settingsRefreshAdmin").onclick=loadAdminDashboard;
if($("sidebarLogout")) $("sidebarLogout").onclick=window.adminLogout;
if($("ytSidebarToggle")) $("ytSidebarToggle").onclick=()=>document.body.classList.toggle("yt-sidebar-open");
document.querySelectorAll(".yt-sidebar-nav a").forEach(a=>a.onclick=()=>{if(innerWidth<980)document.body.classList.remove("yt-sidebar-open")});

loadAdminDashboard();



if($("adminSidebarLogout")) $("adminSidebarLogout").onclick=window.adminLogout;


const premiumViewTitles={
  dashboard:"Dashboard",
  customers:"Users / Customers",
  "free-user-service":"🎁 Free User Service",
  "user-requests":"User Requests",
  channels:"YouTube Channels",
  manage:"Manage Channel",
  access:"Access Requests",
  monetization:"Monetization Cases",
  adsense:"AdSense",
  analytics:"Analytics / Stats",
  reporting:"YouTube Reporting",
  "live-streaming":"Live Streaming",
  "live-chat":"Live Chat",
  "embedded-player":"YouTube Embedded Player",
  oembed:"YouTube oEmbed",
  copyright:"Copyright / Restrictions",
  services:"Services",
  payments:"Payments / PayU",
  "service-charge":"Service Charge",
  history:"History",
  operations:"Operations Center",
  "public-notifications":"Notifications",
  cms:"Admin Dashboard CMS",
  "website-cms":"Website CMS",
  editor:"Admin Editor",
  settings:"Settings"
};
function showPremiumAdminView(name){
  document.querySelectorAll(".yt-premium-view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".yt-premium-nav-btn").forEach(b=>b.classList.remove("active"));
  const view=document.getElementById(`view-${name}`);
  const btn=document.querySelector(`.yt-premium-nav-btn[data-view="${name}"]`);
  if(view)view.classList.add("active");
  if(btn)btn.classList.add("active");
  if($("adminPageTitle")) $("adminPageTitle").textContent=premiumViewTitles[name]||"Dashboard";
  if(innerWidth<900) document.body.classList.remove("yt-premium-sidebar-open");
  window.scrollTo({top:0,behavior:"smooth"});
  sessionStorage.setItem("yt_admin_view",name);
  loadPremiumSectionData(name);
}
document.querySelectorAll(".yt-premium-nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>{
    if(btn.dataset.roleControl) return;
    if(btn.dataset.view) showPremiumAdminView(btn.dataset.view);
  });
});

if($("ytPremiumSidebarToggle")){
  $("ytPremiumSidebarToggle").onclick=()=>document.body.classList.toggle("yt-premium-sidebar-open");
}
if($("adminSidebarLogout")) $("adminSidebarLogout").onclick=window.adminLogout;

let deferredAdminInstallPrompt=null;
window.addEventListener("beforeinstallprompt",(event)=>{
  event.preventDefault();
  deferredAdminInstallPrompt=event;
  const btn=$("installAdminApp");
  if(btn){btn.disabled=false;btn.textContent="📱 Install Admin App";}
});
if($("installAdminApp")){
  $("installAdminApp").onclick=async()=>{
    if(deferredAdminInstallPrompt){
      deferredAdminInstallPrompt.prompt();
      await deferredAdminInstallPrompt.userChoice;
      deferredAdminInstallPrompt=null;
      return;
    }
    alert("Install option browser menu me available ho sakta hai: Chrome menu → Add to Home screen / Install app.");
  };
}
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("admin-sw.js").catch(console.error));
}


function renderAdminManage(customerMap, rows){
  const body=$("manageChannelsBody"); if(!body)return;
  // Only channels with confirmed manager access can be opened in the management workspace.
  const connected=(rows||[]).filter(a=>a.google_connected && a.manager_access);
  setText("manageSectionCount",connected.length);
  body.innerHTML=connected.length?connected.map(a=>{
    const c=customerMap.get(a.customer_id)||{};
    return `<tr>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td><span class="yt-status-chip good">GRANTED ✅</span></td>
      <td><button class="btn primary" type="button" data-manage-customer="${esc(a.customer_id)}" data-manage-target="channel">Manage Channel</button></td>
    </tr>`;
  }).join(""):'<tr><td colspan="4">No channel with Manager Access Granted yet.</td></tr>';
}
function renderAdminAnalytics(customerMap, rows){
  const connected=(rows||[]).filter(a=>a.google_connected);
  const subs=connected.reduce((n,a)=>n+Number(a.subscribers||0),0);
  const views=connected.reduce((n,a)=>n+Number(a.views||0),0);
  const videos=connected.reduce((n,a)=>n+Number(a.videos||0),0);
  setText("adminTotalSubscribers",fmt(subs));
  setText("adminTotalViews",fmt(views));
  setText("adminTotalVideos",fmt(videos));
  setText("adminConnectedChannels",connected.length);
  const body=$("adminAnalyticsBody"); if(!body)return;
  body.innerHTML=connected.length?connected.map(a=>{
    const c=customerMap.get(a.customer_id)||{};
    return `<tr>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td>${fmt(a.subscribers)}</td><td>${fmt(a.views)}</td><td>${fmt(a.videos)}</td>
      <td><button class="btn" type="button" data-manage-customer="${esc(a.customer_id)}" data-manage-target="analytics">Open</button></td>
    </tr>`;
  }).join(""):'<tr><td colspan="5">No connected channels.</td></tr>';
}
function renderAdminCopyright(customerMap, rows){
  const connected=(rows||[]).filter(a=>a.google_connected && a.manager_access);
  const body=$("adminCopyrightBody"); if(!body)return;
  body.innerHTML=connected.length?connected.map(a=>{
    const c=customerMap.get(a.customer_id)||{};
    return `<tr>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td><span class="yt-status-chip good">Manager Access Granted ✅</span></td>
      <td><button class="btn primary" type="button" data-manage-customer="${esc(a.customer_id)}" data-manage-target="copyright">Check Restrictions</button></td>
    </tr>`;
  }).join(""):'<tr><td colspan="4">No Manager Access Granted channel.</td></tr>';
}

function applyAdminCmsAndEditor(){
  const cms=JSON.parse(localStorage.getItem("yt_admin_dashboard_cms")||"{}");
  const labels=JSON.parse(localStorage.getItem("yt_admin_dashboard_labels")||"{}");
  const hero=document.querySelector("#view-dashboard .yt-premium-hero h2");
  const sub=document.querySelector("#view-dashboard .yt-premium-hero p");
  if(hero && cms.heading) hero.textContent=cms.heading;
  if(sub && cms.subtitle) sub.textContent=cms.subtitle;
  if($("cmsDashboardHeading") && cms.heading) $("cmsDashboardHeading").value=cms.heading;
  if($("cmsDashboardSubtitle") && cms.subtitle) $("cmsDashboardSubtitle").value=cms.subtitle;

  const cardLabels=document.querySelectorAll("#view-dashboard .stat-label");
  const defaults=["Total Users / Customers","Total YouTube Channels","Access Requests","Pending Access","Monetization Cases","AdSense Linked","Service Requests","Completed Requests"];
  const vals=[labels.customers,labels.channels,labels.access,null,labels.monetization];
  if(cardLabels[0]) cardLabels[0].textContent=labels.customers||defaults[0];
  if(cardLabels[1]) cardLabels[1].textContent=labels.channels||defaults[1];
  if(cardLabels[2]) cardLabels[2].textContent=labels.access||defaults[2];
  if(cardLabels[4]) cardLabels[4].textContent=labels.monetization||defaults[4];

  if($("editLabelCustomers")) $("editLabelCustomers").value=labels.customers||defaults[0];
  if($("editLabelChannels")) $("editLabelChannels").value=labels.channels||defaults[1];
  if($("editLabelAccess")) $("editLabelAccess").value=labels.access||defaults[2];
  if($("editLabelMonetization")) $("editLabelMonetization").value=labels.monetization||defaults[4];
}


if($("saveAdminCms")) $("saveAdminCms").onclick=()=>{
  const data={heading:$("cmsDashboardHeading").value.trim(),subtitle:$("cmsDashboardSubtitle").value.trim()};
  localStorage.setItem("yt_admin_dashboard_cms",JSON.stringify(data));
  applyAdminCmsAndEditor();
  $("adminCmsMessage").textContent="Dashboard CMS saved ✅";
};
if($("saveAdminEditor")) $("saveAdminEditor").onclick=()=>{
  const data={
    customers:$("editLabelCustomers").value.trim(),
    channels:$("editLabelChannels").value.trim(),
    access:$("editLabelAccess").value.trim(),
    monetization:$("editLabelMonetization").value.trim()
  };
  localStorage.setItem("yt_admin_dashboard_labels",JSON.stringify(data));
  applyAdminCmsAndEditor();
  $("adminEditorMessage").textContent="Card labels saved ✅";
};
if($("resetAdminEditor")) $("resetAdminEditor").onclick=()=>{
  localStorage.removeItem("yt_admin_dashboard_labels");
  applyAdminCmsAndEditor();
  $("adminEditorMessage").textContent="Labels reset ✅";
};


function openInlineChannelManager(customerId,target="channel",clickEvent=null,channelAccessId=""){
  const fromFreeUser=!!clickEvent?.target?.closest?.("#freeUserChannelList");
  const accessRow=(dashboardCache.access||[]).find(a=>String(a.customer_id)===String(customerId));
  if(!fromFreeUser && !accessRow?.manager_access){
    alert("Manager Access is not granted for this channel yet.");
    showPremiumAdminView("access");
    return;
  }
  const workspace=$("manageWorkspace");
  const listPanel=$("manageChannelListPanel");
  const freeHost=$("freeUserInlineManageHost");

  if(fromFreeUser && workspace && freeHost){
    // Keep the admin on Free User Service and open the existing channel
    // management workspace directly below the selected free user's channels.
    showPremiumAdminView("free-user-service");
    freeHost.appendChild(workspace);
    workspace.hidden=false;
    if(listPanel) listPanel.classList.remove("yt-manage-list-compact");
  }else{
    showPremiumAdminView("manage");
    if(workspace) workspace.hidden=false;
    if(listPanel) listPanel.classList.add("yt-manage-list-compact");
  }

  if(typeof window.ytManageSelectCustomer==="function"){
    window.ytManageSelectCustomer(customerId,target);
  }else{
    alert("Channel manager loading. Please click again.");
  }
}
document.addEventListener("click",(event)=>{
  const btn=event.target.closest("[data-manage-customer]");
  if(!btn)return;
  event.preventDefault();
  openInlineChannelManager(btn.dataset.manageCustomer,btn.dataset.manageTarget||"channel",event,btn.dataset.manageChannel||"");
});
if($("closeManageWorkspace")) $("closeManageWorkspace").onclick=()=>{
  const workspace=$("manageWorkspace");
  const listPanel=$("manageChannelListPanel");
  const manageView=$("view-manage");
  if(workspace && manageView && workspace.parentElement!==manageView) manageView.appendChild(workspace);
  if(workspace)workspace.hidden=true;
  if(listPanel)listPanel.classList.remove("yt-manage-list-compact");
};

document.addEventListener("DOMContentLoaded",()=>{
  const saved=sessionStorage.getItem("yt_admin_view")||"dashboard";
  if(document.getElementById(`view-${saved}`)) showPremiumAdminView(saved);
  document.documentElement.classList.remove("yt-admin-view-restoring");
});
