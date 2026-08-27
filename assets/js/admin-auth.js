import { supabase } from "./supabase.js";

const ADMIN_EMAIL = "sumitkhobragade088@gmail.com";
const $ = (id) => document.getElementById(id);

function esc(v=""){
  return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
function fmt(n){ return Number(n||0).toLocaleString("en-IN"); }
function dateText(v){
  if(!v) return "-";
  const d=new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
}
function setText(id,value){ if($(id)) $(id).textContent=value; }

function showMessage(text, ok=false) {
  const el = $("adminMessage");
  if (!el) return;
  el.textContent = text;
  el.className = ok ? "message ok" : "message";
}

async function isAdmin(user) {
  if (!user || String(user.email||"").toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false;
  const { data, error } = await supabase
    .from("admin_users")
    .select("id,email")
    .eq("id", user.id)
    .maybeSingle();
  return !error && !!data;
}

const form = $("adminLoginForm");
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    showMessage("Checking admin account...");
    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return showMessage(error.message);
    if (!(await isAdmin(data.user))) {
      await supabase.auth.signOut();
      return showMessage("This account is not authorized as admin.");
    }
    showMessage("Admin login successful.", true);
    setTimeout(() => location.href = "index.html", 400);
  });
}

let dashboardCache={customers:[],access:[],requests:[]};

async function loadAdminDashboard(){
  if (!document.body.dataset.adminProtected) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdmin(user))) {
    location.href = "login.html";
    return;
  }
  setText("adminEmailView", user.email || "");

  const [cRes,aRes,rRes] = await Promise.all([
    supabase.from("customers").select("id,full_name,email,mobile,channel_name,channel_url,created_at").order("created_at",{ascending:false}),
    supabase.from("channel_access").select("*").order("updated_at",{ascending:false}),
    supabase.from("service_requests").select("*").order("created_at",{ascending:false})
  ]);

  const customers=cRes.data||[];
  const access=aRes.data||[];
  const requests=rRes.data||[];
  dashboardCache={customers,access,requests};

  const customerMap=new Map(customers.map(c=>[c.id,c]));
  const connected=access.filter(a=>a.google_connected);
  const pendingAccess=access.filter(a=>!a.manager_access);
  const granted=access.filter(a=>a.manager_access);
  const monetizationCases=access.filter(a=>String(a.monetization_status||"").trim()!=="");
  const approved=access.filter(a=>["approved","monetized","active","completed","complete","done"].includes(String(a.monetization_status||"").toLowerCase()));
  const adsenseLinked=access.filter(a=>a.adsense_access);
  const pendingReq=requests.filter(r=>String(r.status||"").toLowerCase()==="pending");
  const completedReq=requests.filter(r=>["completed","complete","done","approved"].includes(String(r.status||"").toLowerCase()));
  const totalViews=access.reduce((sum,a)=>sum+Number(a.views||0),0);

  setText("totalCustomers",customers.length);
  setText("totalChannels",connected.length);
  setText("totalAccessRequests",access.length);
  setText("pendingAccess",pendingAccess.length);
  setText("totalMonetizationCases",monetizationCases.length);
  setText("totalAdsenseLinked",adsenseLinked.length);
  setText("totalRequests",requests.length);
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
  setText("servicesSectionCount",requests.length);

  renderCustomers(customers);
  renderChannels(customers,access);
  renderAccess(customerMap,access);
  renderMonetization(customerMap,access);
  renderAdsense(customerMap,access);
  renderServices(requests);
  renderHistory(customers,access,requests,customerMap);
}

function renderCustomers(rows){
  const body=$("customersBody"); if(!body) return;
  body.innerHTML=rows.length?rows.map(c=>`
    <tr>
      <td><b>${esc(c.full_name||"-")}</b></td>
      <td>${esc(c.email||"-")}</td>
      <td>${esc(c.mobile||"-")}</td>
      <td>${esc(c.channel_name||"-")}</td>
      <td>${dateText(c.created_at)}</td>
    </tr>`).join(""):'<tr><td colspan="5">No customers yet.</td></tr>';
}

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
      <td><a class="btn primary" href="manage-channel.html?customer=${encodeURIComponent(c.id)}">${a.manager_access?"Manage Channel":"Access Setup"}</a></td>
    </tr>`).join(""):'<tr><td colspan="9">No connected channels.</td></tr>';
}

function renderAccess(customerMap,rows){
  const body=$("accessRequestsBody"); if(!body) return;
  body.innerHTML=rows.length?rows.map(a=>{
    const c=customerMap.get(a.customer_id)||{};
    return `<tr>
      <td>${esc(c.full_name||c.email||"-")}</td>
      <td>${esc(a.channel_name||c.channel_name||"-")}</td>
      <td>${a.google_connected?'<span class="yt-status-chip good">Connected</span>':'<span class="yt-status-chip bad">Not Connected</span>'}</td>
      <td>${a.manager_access?'<span class="yt-status-chip good">Granted</span>':'<span class="yt-status-chip pending">Pending</span>'}</td>
      <td>${dateText(a.updated_at)}</td>
      <td><a class="btn" href="manage-channel.html?customer=${encodeURIComponent(a.customer_id)}">Open</a></td>
    </tr>`;
  }).join(""):'<tr><td colspan="6">No access records.</td></tr>';
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
      <td><a class="btn primary" href="manage-channel.html?customer=${encodeURIComponent(a.customer_id)}">Manage</a></td>
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

window.adminLogout = async () => {
  await supabase.auth.signOut();
  location.href = "login.html";
};

if($("refreshAdminDashboard")) $("refreshAdminDashboard").onclick=loadAdminDashboard;
if($("settingsRefreshAdmin")) $("settingsRefreshAdmin").onclick=loadAdminDashboard;
if($("sidebarLogout")) $("sidebarLogout").onclick=window.adminLogout;
if($("ytSidebarToggle")) $("ytSidebarToggle").onclick=()=>document.body.classList.toggle("yt-sidebar-open");
document.querySelectorAll(".yt-sidebar-nav a").forEach(a=>a.onclick=()=>{if(innerWidth<980)document.body.classList.remove("yt-sidebar-open")});

loadAdminDashboard();


const viewTitles={
  dashboard:"Dashboard",
  customers:"Users / Customers",
  channels:"YouTube Channels",
  access:"Access Requests",
  monetization:"Monetization Cases",
  adsense:"AdSense",
  services:"Services",
  history:"History",
  settings:"Settings"
};

function showAdminView(name){
  document.querySelectorAll(".yt-ref-view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".yt-ref-nav-btn").forEach(b=>b.classList.remove("active"));
  const view=document.getElementById(`view-${name}`);
  const btn=document.querySelector(`.yt-ref-nav-btn[data-view="${name}"]`);
  if(view)view.classList.add("active");
  if(btn)btn.classList.add("active");
  if($("adminPageTitle")) $("adminPageTitle").textContent=viewTitles[name]||"Dashboard";
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".yt-ref-nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>showAdminView(btn.dataset.view));
});

if($("adminSidebarLogout")) $("adminSidebarLogout").onclick=window.adminLogout;
