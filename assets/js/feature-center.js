import { supabase } from "./supabase.js";

const ADMIN_EMAIL="sumitkhobragade088@gmail.com";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money=v=>`₹${Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:2})}`;
const dt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});};
const status=v=>String(v||"pending").replace(/_/g," ");
let sessionUser=null, customer=null, isAdmin=false, requests=[], payments=[];

async function getIdentity(){
  const {data}=await supabase.auth.getSession();
  sessionUser=data?.session?.user||null;
  if(!sessionUser)return;
  isAdmin=String(sessionUser.email||"").toLowerCase()===ADMIN_EMAIL;
  if(!isAdmin){
    const {data:c}=await supabase.from("customers").select("id,full_name,email").eq("user_id",sessionUser.id).maybeSingle();
    customer=c||null;
    if(customer){
      const {data:block}=await supabase.from("user_blocks").select("id,reason").eq("customer_id",customer.id).eq("is_blocked",true).maybeSingle();
      if(block){
        const overlay=document.createElement("div");
        overlay.className="yt-feature-blocked";
        overlay.innerHTML=`<div><h2>Account Temporarily Restricted</h2><p>${esc(block.reason||"Please contact support.")}</p><button id="fcBlockedLogout">Logout</button></div>`;
        document.body.appendChild(overlay);
        overlay.querySelector("#fcBlockedLogout").onclick=()=>supabase.auth.signOut().then(()=>location.href="login.html");
        return;
      }
    }
  }
}

async function logActivity(action,details={},targetType="",targetId=null){
  try{
    await supabase.from("activity_logs").insert({
      actor_type:isAdmin?"admin":"user",
      customer_id:customer?.id||null,
      action, target_type:targetType||null,target_id:targetId||null,
      details
    });
  }catch(_){}
}

async function loadBase(){
  if(isAdmin){
    const [{data:r},{data:p}]=await Promise.all([
      supabase.from("service_requests").select("id,customer_id,service_type,status,created_at").order("created_at",{ascending:false}),
      supabase.from("payments").select("id,customer_id,request_id,service_name,amount,status,txnid,mihpayid,created_at,updated_at").order("created_at",{ascending:false})
    ]);
    requests=r||[];payments=p||[];
  }else if(customer){
    const [{data:r},{data:p}]=await Promise.all([
      supabase.from("service_requests").select("id,customer_id,service_type,status,created_at").eq("customer_id",customer.id).order("created_at",{ascending:false}),
      supabase.from("payments").select("id,customer_id,request_id,service_name,amount,status,txnid,mihpayid,created_at,updated_at").eq("customer_id",customer.id).order("created_at",{ascending:false})
    ]);
    requests=r||[];payments=p||[];
  }
}

function fillRequestSelects(){
  const opts=requests.map(r=>`<option value="${esc(r.id)}">${esc(r.service_type)} • ${esc(status(r.status))}</option>`).join("");
  ["fcDocumentRequest","fcTimelineRequest","fcNoteRequest"].forEach(id=>{const el=$(id);if(el)el.innerHTML=opts||'<option value="">No request</option>';});
  const popts=payments.map(p=>`<option value="${esc(p.id)}">${esc(p.service_name)} • ${money(p.amount)} • ${esc(status(p.status))}</option>`).join("");
  const fp=$("fcRefundPayment");if(fp)fp.innerHTML=popts||'<option value="">No payment</option>';
}

async function loadTickets(){
  const q=supabase.from("support_tickets").select("*").order("created_at",{ascending:false});
  const {data}=isAdmin?await q:await q.eq("customer_id",customer.id);
  const rows=data||[];
  if($("fcOpenTickets"))$("fcOpenTickets").textContent=String(rows.filter(x=>!["closed","resolved"].includes(String(x.status).toLowerCase())).length);
  const target=isAdmin?$("fcAdminTickets"):$("fcUserTickets");
  if(!target)return;
  target.innerHTML=rows.length?rows.map(t=>`<div class="yt-feature-item"><div><b>${esc(t.subject)}</b><span>${esc(t.message)}</span><small>${dt(t.created_at)} • ${esc(status(t.status))}</small></div>${isAdmin?`<select data-ticket-status="${esc(t.id)}">${["open","in_progress","resolved","closed"].map(s=>`<option ${s===t.status?"selected":""} value="${s}">${status(s)}</option>`).join("")}</select>`:""}</div>`).join(""):'<div class="yt-feature-empty">No tickets.</div>';
  if(isAdmin)target.querySelectorAll("[data-ticket-status]").forEach(sel=>sel.onchange=async()=>{await supabase.from("support_tickets").update({status:sel.value,updated_at:new Date().toISOString()}).eq("id",sel.dataset.ticketStatus);await logActivity("ticket_status_update",{status:sel.value},"support_ticket",sel.dataset.ticketStatus);loadTickets();});
}

async function createTicket(){
  const subject=$("fcTicketSubject")?.value.trim(),message=$("fcTicketMessage")?.value.trim();
  if(!subject||!message||!customer)return alert("Subject aur message required.");
  const {error}=await supabase.from("support_tickets").insert({customer_id:customer.id,subject,message,status:"open"});
  if(error)return alert(error.message);
  $("fcTicketSubject").value="";$("fcTicketMessage").value="";
  await logActivity("support_ticket_created",{subject},"support_ticket");
  loadTickets();
}

async function loadNotes(){
  if(!isAdmin||!$("fcAdminNotes"))return;
  const {data}=await supabase.from("request_notes").select("*").order("created_at",{ascending:false}).limit(50);
  $("fcAdminNotes").innerHTML=(data||[]).map(n=>`<div class="yt-feature-item"><div><b>Request ${esc(String(n.request_id).slice(0,8))}</b><span>${esc(n.note)}</span><small>${dt(n.created_at)}</small></div></div>`).join("")||'<div class="yt-feature-empty">No notes.</div>';
}
async function addNote(){
  const request_id=$("fcNoteRequest")?.value,note=$("fcNoteText")?.value.trim();
  if(!request_id||!note)return;
  const {error}=await supabase.from("request_notes").insert({request_id,note,created_by:sessionUser.id});
  if(error)return alert(error.message);
  $("fcNoteText").value="";await logActivity("admin_note_added",{},"service_request",request_id);loadNotes();
}

async function loadDocuments(){
  if(isAdmin){
    const {data}=await supabase.from("request_documents").select("*").order("created_at",{ascending:false});
    const rows=data||[];
    if($("fcDocuments"))$("fcDocuments").textContent=String(rows.length);
    const target=$("fcAdminDocuments");if(!target)return;
    target.innerHTML=rows.length?rows.map(x=>`<div class="yt-feature-item"><div><b>${esc(x.file_name)}</b><span>Request ${esc(String(x.request_id).slice(0,8))}</span><small>${dt(x.created_at)}</small></div><div class="yt-feature-actions"><button type="button" data-doc-view="${esc(x.storage_path)}">View</button><button type="button" data-doc-delete="${esc(x.id)}" data-doc-path="${esc(x.storage_path)}">Delete</button></div></div>`).join(""):'<div class="yt-feature-empty">No documents.</div>';
    target.querySelectorAll("[data-doc-view]").forEach(b=>b.onclick=async()=>{const {data,error}=await supabase.storage.from("user-documents").createSignedUrl(b.dataset.docView,120);if(error)return alert(error.message);window.open(data.signedUrl,"_blank","noopener,noreferrer");});
    target.querySelectorAll("[data-doc-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this document?"))return;const rem=await supabase.storage.from("user-documents").remove([b.dataset.docPath]);if(rem.error)return alert(rem.error.message);const del=await supabase.from("request_documents").delete().eq("id",b.dataset.docDelete);if(del.error)return alert(del.error.message);await logActivity("document_deleted",{},"document",b.dataset.docDelete);loadDocuments();});
    return;
  }
  const {data}=await supabase.from("request_documents").select("*").eq("customer_id",customer.id).order("created_at",{ascending:false});
  const target=$("fcUserDocuments");if(!target)return;
  target.innerHTML=(data||[]).map(x=>`<div class="yt-feature-item"><div><b>${esc(x.file_name)}</b><small>${dt(x.created_at)}</small></div></div>`).join("")||'<div class="yt-feature-empty">No documents.</div>';
}
async function uploadDocument(){
  const file=$("fcDocumentFile")?.files?.[0],request_id=$("fcDocumentRequest")?.value;
  if(!file||!request_id||!customer)return alert("Request aur file select karein.");
  if(file.size>10*1024*1024)return alert("Maximum file size 10 MB.");
  const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`${customer.id}/${request_id}/${Date.now()}-${safe}`;
  const up=await supabase.storage.from("user-documents").upload(path,file,{upsert:false});
  if(up.error)return alert(up.error.message);
  const ins=await supabase.from("request_documents").insert({customer_id:customer.id,request_id,file_name:file.name,storage_path:path,mime_type:file.type||"",file_size:file.size});
  if(ins.error)return alert(ins.error.message);
  $("fcDocumentFile").value="";await logActivity("document_uploaded",{file:file.name},"service_request",request_id);loadDocuments();
}

async function loadTimeline(){
  if(isAdmin||!customer||!$("fcTimeline"))return;
  const request_id=$("fcTimelineRequest")?.value;
  if(!request_id){$("fcTimeline").innerHTML='<div class="yt-feature-empty">No request.</div>';return;}
  const {data}=await supabase.from("request_timeline").select("*").eq("request_id",request_id).order("created_at",{ascending:true});
  $("fcTimeline").innerHTML=(data||[]).map(x=>`<div class="yt-timeline-row"><i></i><div><b>${esc(status(x.status))}</b><span>${esc(x.message||"")}</span><small>${dt(x.created_at)}</small></div></div>`).join("")||'<div class="yt-feature-empty">Timeline starts when request status changes.</div>';
}

function receiptHtml(p){
  return `<!doctype html><html><head><title>Payment Receipt</title><style>body{font-family:Arial;padding:30px;color:#172033}.box{max-width:680px;margin:auto;border:1px solid #ddd;border-radius:14px;padding:24px}h1{margin:0 0 18px}table{width:100%;border-collapse:collapse}td{padding:10px;border-bottom:1px solid #eee}td:first-child{font-weight:700;width:40%}.paid{color:#0a8f4c;font-weight:800}</style></head><body><div class="box"><h1>YT Creator Pro</h1><h2>Payment Receipt</h2><table><tr><td>Service</td><td>${esc(p.service_name)}</td></tr><tr><td>Amount</td><td>${money(p.amount)}</td></tr><tr><td>Status</td><td class="paid">${esc(status(p.status))}</td></tr><tr><td>Transaction ID</td><td>${esc(p.txnid||"-")}</td></tr><tr><td>PayU ID</td><td>${esc(p.mihpayid||"-")}</td></tr><tr><td>Date</td><td>${dt(p.updated_at||p.created_at)}</td></tr></table><p>Generated from YT Creator Pro user dashboard.</p></div><script>window.print()</script></body></html>`;
}
function loadReceipts(){
  const target=$("fcReceipts");if(!target)return;
  const rows=payments.filter(p=>String(p.status).toLowerCase()==="paid");
  target.innerHTML=rows.length?rows.map(p=>`<div class="yt-feature-item"><div><b>${esc(p.service_name)}</b><span>${money(p.amount)} • ${esc(p.txnid||"Paid")}</span><small>${dt(p.updated_at||p.created_at)}</small></div><button type="button" data-receipt="${esc(p.id)}">Receipt</button></div>`).join(""):'<div class="yt-feature-empty">No paid receipts.</div>';
  target.querySelectorAll("[data-receipt]").forEach(b=>b.onclick=()=>{const p=payments.find(x=>x.id===b.dataset.receipt);if(!p)return;const w=window.open("","_blank","noopener,noreferrer");if(w){w.document.write(receiptHtml(p));w.document.close();}});
}

async function loadRefunds(){
  let q=supabase.from("refund_requests").select("*").order("created_at",{ascending:false});
  const {data}=isAdmin?await q:await q.eq("customer_id",customer.id);
  const rows=data||[];
  if($("fcRefunds"))$("fcRefunds").textContent=String(rows.filter(x=>String(x.status).toLowerCase()==="pending").length);
  const target=isAdmin?$("fcAdminRefunds"):$("fcUserRefunds");if(!target)return;
  target.innerHTML=rows.length?rows.map(r=>`<div class="yt-feature-item"><div><b>${esc(r.request_type==="cancel"?"Cancel":"Refund")} Request</b><span>${esc(r.reason||"")}</span><small>${dt(r.created_at)} • ${esc(status(r.status))}</small></div>${isAdmin?`<select data-refund-status="${esc(r.id)}">${["pending","approved","rejected","completed"].map(s=>`<option ${s===r.status?"selected":""} value="${s}">${status(s)}</option>`).join("")}</select>`:""}</div>`).join(""):'<div class="yt-feature-empty">No refund/cancel requests.</div>';
  if(isAdmin)target.querySelectorAll("[data-refund-status]").forEach(sel=>sel.onchange=async()=>{await supabase.from("refund_requests").update({status:sel.value,updated_at:new Date().toISOString()}).eq("id",sel.dataset.refundStatus);await logActivity("refund_status_update",{status:sel.value},"refund_request",sel.dataset.refundStatus);loadRefunds();});
}
async function createRefund(){
  const payment_id=$("fcRefundPayment")?.value,reason=$("fcRefundReason")?.value.trim();
  const p=payments.find(x=>x.id===payment_id);
  if(!p||!reason)return alert("Payment aur reason required.");
  const {error}=await supabase.from("refund_requests").insert({customer_id:customer.id,payment_id,request_id:p.request_id,reason,request_type:$("fcRefundType")?.value||"refund",status:"pending"});
  if(error)return alert(error.message);
  $("fcRefundReason").value="";await logActivity("refund_requested",{},"payment",payment_id);loadRefunds();
}

async function loadUsers(){
  if(!isAdmin||!$("fcAdminUsers"))return;
  const [{data:users},{data:blocks}]=await Promise.all([
    supabase.from("customers").select("id,full_name,email").order("created_at",{ascending:false}),
    supabase.from("user_blocks").select("*")
  ]);
  const bm=new Map((blocks||[]).map(x=>[x.customer_id,x]));
  $("fcAdminUsers").innerHTML=(users||[]).map(u=>{const b=bm.get(u.id);const blocked=!!b?.is_blocked;return `<div class="yt-feature-item"><div><b>${esc(u.full_name||u.email)}</b><span>${esc(u.email||"")}</span></div><button type="button" data-user-block="${esc(u.id)}" data-blocked="${blocked}">${blocked?"Unblock":"Block"}</button></div>`;}).join("")||'<div class="yt-feature-empty">No users.</div>';
  $("fcAdminUsers").querySelectorAll("[data-user-block]").forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.userBlock,blocked=btn.dataset.blocked==="true";
    if(blocked){await supabase.from("user_blocks").upsert({customer_id:id,is_blocked:false,reason:"",updated_at:new Date().toISOString()},{onConflict:"customer_id"});}
    else{const reason=prompt("Block reason:","Account temporarily restricted by admin.");if(reason===null)return;await supabase.from("user_blocks").upsert({customer_id:id,is_blocked:true,reason,updated_at:new Date().toISOString()},{onConflict:"customer_id"});}
    await logActivity(blocked?"user_unblocked":"user_blocked",{},"customer",id);loadUsers();
  });
}

async function loadAnnouncements(){
  if(!isAdmin||!$("fcAnnouncements"))return;
  const {data}=await supabase.from("announcements").select("*").order("created_at",{ascending:false}).limit(20);
  $("fcAnnouncements").innerHTML=(data||[]).map(x=>`<div class="yt-feature-item"><div><b>${esc(x.title)}</b><span>${esc(x.message)}</span><small>${esc(x.target)} • ${x.is_active?"Active":"Off"} • ${dt(x.created_at)}</small></div><div class="yt-feature-actions"><button type="button" data-ann-edit="${esc(x.id)}" data-title="${esc(x.title)}" data-message="${esc(x.message)}">Edit</button><button type="button" data-ann-toggle="${esc(x.id)}" data-active="${x.is_active}">${x.is_active?"Disable":"Enable"}</button><button type="button" data-ann-delete="${esc(x.id)}">Delete</button></div></div>`).join("")||'<div class="yt-feature-empty">No announcements.</div>';
  $("fcAnnouncements").querySelectorAll("[data-ann-toggle]").forEach(btn=>btn.onclick=async()=>{await supabase.from("announcements").update({is_active:btn.dataset.active!=="true",updated_at:new Date().toISOString()}).eq("id",btn.dataset.annToggle);loadAnnouncements();});
  $("fcAnnouncements").querySelectorAll("[data-ann-edit]").forEach(btn=>btn.onclick=async()=>{const title=prompt("Announcement title:",btn.dataset.title);if(title===null)return;const message=prompt("Announcement message:",btn.dataset.message);if(message===null)return;await supabase.from("announcements").update({title,message,updated_at:new Date().toISOString()}).eq("id",btn.dataset.annEdit);await logActivity("announcement_updated",{},"announcement",btn.dataset.annEdit);loadAnnouncements();});
  $("fcAnnouncements").querySelectorAll("[data-ann-delete]").forEach(btn=>btn.onclick=async()=>{if(!confirm("Delete announcement?"))return;await supabase.from("announcements").delete().eq("id",btn.dataset.annDelete);await logActivity("announcement_deleted",{},"announcement",btn.dataset.annDelete);loadAnnouncements();});
}
async function publishAnnouncement(){
  const title=$("fcAnnouncementTitle")?.value.trim(),message=$("fcAnnouncementMessage")?.value.trim(),target=$("fcAnnouncementTarget")?.value||"all",maintenance=!!$("fcAnnouncementMaintenance")?.checked;
  if(!title||!message)return;
  const {error}=await supabase.from("announcements").insert({title,message,target,is_maintenance:maintenance,is_active:true,created_by:sessionUser.id});
  if(error)return alert(error.message);
  $("fcAnnouncementTitle").value="";$("fcAnnouncementMessage").value="";await logActivity("announcement_published",{target,maintenance},"announcement");loadAnnouncements();
}

async function loadAnalytics(){
  if(!isAdmin||!$("fcAnalytics"))return;
  const [{count:uc},{count:rc},{count:tc},{data:paid}]=await Promise.all([
    supabase.from("customers").select("id",{count:"exact",head:true}),
    supabase.from("service_requests").select("id",{count:"exact",head:true}),
    supabase.from("support_tickets").select("id",{count:"exact",head:true}),
    supabase.from("payments").select("amount,status")
  ]);
  const revenue=(paid||[]).filter(x=>String(x.status).toLowerCase()==="paid").reduce((n,x)=>n+Number(x.amount||0),0);
  $("fcRevenue").textContent=money(revenue);
  $("fcAnalytics").innerHTML=`<div><b>${uc||0}</b><span>Users</span></div><div><b>${rc||0}</b><span>Requests</span></div><div><b>${tc||0}</b><span>Tickets</span></div><div><b>${money(revenue)}</b><span>Paid Revenue</span></div>`;
}

async function exportTable(table){
  const {data,error}=await supabase.from(table).select("*").limit(10000);
  if(error)return alert(error.message);
  if(!data?.length)return alert("No data.");
  const keys=[...new Set(data.flatMap(Object.keys))];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const csv=[keys.map(q).join(","),...data.map(r=>keys.map(k=>q(typeof r[k]==="object"?JSON.stringify(r[k]):r[k])).join(","))].join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=`${table}-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);
  await logActivity("data_export",{table},"export");
}

async function loadAudit(){
  const target=isAdmin?$("fcAuditLog"):$("fcUserActivity");if(!target)return;
  let q=supabase.from("activity_logs").select("*").order("created_at",{ascending:false}).limit(100);
  if(!isAdmin)q=q.eq("customer_id",customer.id);
  const {data}=await q;
  target.innerHTML=(data||[]).map(x=>`<div class="yt-feature-item"><div><b>${esc(status(x.action))}</b><span>${esc(x.target_type||"")}</span><small>${dt(x.created_at)}</small></div></div>`).join("")||'<div class="yt-feature-empty">No activity yet.</div>';
}

async function loadEmailQueue(){
  if(!isAdmin||!$("fcEmailQueue"))return;
  const {data}=await supabase.from("email_queue").select("*").order("created_at",{ascending:false}).limit(50);
  $("fcEmailQueue").innerHTML=(data||[]).map(x=>`<div class="yt-feature-item"><div><b>${esc(x.subject)}</b><span>${esc(x.to_email)}</span><small>${esc(status(x.status))} • ${dt(x.created_at)}</small></div></div>`).join("")||'<div class="yt-feature-empty">No queued emails.</div>';
}

const featureDefs=[
  ["support_tickets","Support Tickets"],["admin_notes","Admin Notes"],["documents","Document Upload"],["timeline","Application Timeline"],
  ["receipts","Payment Receipts"],["refunds","Refund / Cancel"],["notification_preferences","Notification Preferences"],
  ["activity_logs","Activity Log"],["user_blocking","User Block / Unblock"],["announcements","Announcements"],
  ["public_announcements","Public Announcement Banner"],["analytics","Advanced Analytics"],["exports","Database Export"],
  ["audit_log","Audit / Security Log"],["email_queue","Email Queue"]
];
async function loadFeatureSettings(){
  const {data}=await supabase.from("feature_settings").select("feature_key,is_enabled");
  const map=new Map((data||[]).map(x=>[x.feature_key,x.is_enabled]));
  document.querySelectorAll("[data-feature-toggle-grid]").forEach(grid=>{
    grid.innerHTML=featureDefs.map(([k,label])=>`<label><input type="checkbox" data-feature-key="${k}" ${map.get(k)!==false?"checked":""}> ${label}</label>`).join("");
  });
  document.querySelectorAll("[data-feature-module]").forEach(card=>{
    card.hidden=map.get(card.dataset.featureModule)===false;
  });
}
async function saveFeatureSettings(btn){
  const box=btn.closest("[data-feature-cms]"),rows=[...box.querySelectorAll("[data-feature-key]")].map(x=>({feature_key:x.dataset.featureKey,is_enabled:x.checked,updated_by:sessionUser.id,updated_at:new Date().toISOString()}));
  const {error}=await supabase.from("feature_settings").upsert(rows,{onConflict:"feature_key"});
  const msg=box.querySelector("[data-feature-settings-message]");
  if(error){if(msg)msg.textContent=error.message;return;}
  if(msg){msg.textContent=" Saved ✓";setTimeout(()=>msg.textContent="",1800);}
  await logActivity("feature_settings_updated",{count:rows.length},"cms");await loadFeatureSettings();
}
async function loadUserPrefs(){
  if(isAdmin||!customer)return;
  const {data}=await supabase.from("user_notification_preferences").select("*").eq("customer_id",customer.id).maybeSingle();
  if(!data)return;
  document.querySelectorAll("#fcUserPrefs [data-pref-key]").forEach(x=>{if(x.dataset.prefKey in data)x.checked=!!data[x.dataset.prefKey];});
}
async function saveUserPrefs(){
  const row={customer_id:customer.id,updated_at:new Date().toISOString()};
  document.querySelectorAll("#fcUserPrefs [data-pref-key]").forEach(x=>row[x.dataset.prefKey]=x.checked);
  const {error}=await supabase.from("user_notification_preferences").upsert(row,{onConflict:"customer_id"});
  if(error)return alert(error.message);
  alert("Notification preferences saved.");
}


async function loadDashboardAnnouncement(){
  if(isAdmin||!customer)return;
  const {data:pref}=await supabase.from("user_notification_preferences").select("announcements").eq("customer_id",customer.id).maybeSingle();
  if(pref?.announcements===false)return;
  const {data}=await supabase.from("announcements").select("title,message,is_maintenance").eq("is_active",true).in("target",["user","all"]).order("created_at",{ascending:false}).limit(1);
  if(!data?.[0])return;
  const main=document.querySelector(".yt-demo-user-main"),header=document.querySelector(".yt-demo-user-header");
  if(!main||document.getElementById("fcUserAnnouncement"))return;
  const bar=document.createElement("div");bar.id="fcUserAnnouncement";bar.className=`yt-dashboard-announcement ${data[0].is_maintenance?"maintenance":""}`;
  bar.innerHTML=`<b>${data[0].is_maintenance?"🛠":"📢"} ${esc(data[0].title)}</b><span>${esc(data[0].message)}</span><button type="button">×</button>`;
  header?.insertAdjacentElement("afterend",bar);bar.querySelector("button").onclick=()=>bar.remove();
}

async function loadAll(){
  await loadBase();fillRequestSelects();
  if(isAdmin){
    await Promise.all([loadTickets(),loadNotes(),loadDocuments(),loadRefunds(),loadUsers(),loadAnnouncements(),loadAnalytics(),loadAudit(),loadEmailQueue(),loadFeatureSettings()]);
  }else if(customer){
    await Promise.all([loadTickets(),loadDocuments(),loadRefunds(),loadUserPrefs(),loadAudit(),loadFeatureSettings(),loadDashboardAnnouncement()]);
    loadReceipts();loadTimeline();
  }
}

function bind(){
  $("fcCreateTicket")?.addEventListener("click",createTicket);
  $("fcAddNote")?.addEventListener("click",addNote);
  $("fcUploadDocument")?.addEventListener("click",uploadDocument);
  $("fcTimelineRequest")?.addEventListener("change",loadTimeline);
  $("fcCreateRefund")?.addEventListener("click",createRefund);
  $("fcPublishAnnouncement")?.addEventListener("click",publishAnnouncement);
  $("fcSaveUserPrefs")?.addEventListener("click",saveUserPrefs);
  document.querySelectorAll("[data-save-feature-settings]").forEach(b=>b.addEventListener("click",()=>saveFeatureSettings(b)));
  document.querySelectorAll("[data-fc-export]").forEach(b=>b.addEventListener("click",()=>exportTable(b.dataset.fcExport)));
  document.querySelectorAll("[data-fc-refresh]").forEach(b=>b.addEventListener("click",()=>({
    tickets:loadTickets,refunds:loadRefunds,documents:loadDocuments,analytics:loadAnalytics,audit:loadAudit,activity:loadAudit
  }[b.dataset.fcRefresh]?.())));
}

(async()=>{await getIdentity();if(!sessionUser)return;bind();await loadAll();await logActivity("dashboard_open",{page:isAdmin?"admin":"user"},"session");})();
