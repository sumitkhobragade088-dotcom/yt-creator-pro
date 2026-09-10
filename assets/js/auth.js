import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const TIMEOUT = 8000;
let dashboardCustomer = null;
let dashboardAccess = null;
let cachedServices = null;
let serviceChargeMap = new Map();

const msg = (text, ok=false) => {
  const el = $("message");
  if (!el) return;
  el.textContent = text;
  el.className = ok ? "message ok" : "message";
};

function timeout(promise, ms=TIMEOUT, label="Request") {
  return Promise.race([
    Promise.resolve(promise),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout. Please try again.`)), ms))
  ]);
}

async function safeQuery(query, fallback=null, label="Data") {
  try {
    const res = await timeout(query, TIMEOUT, label);
    if (res?.error) throw res.error;
    return res?.data ?? fallback;
  } catch (e) {
    console.error(label, e);
    return fallback;
  }
}

function money(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
}
function esc(v="") {
  return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

async function ensureCustomerProfile(user) {
  const meta = user?.user_metadata || {};
  const existing = await safeQuery(
    supabase.from("customers").select("id").eq("user_id", user.id).maybeSingle(),
    null, "Customer profile"
  );
  if (existing?.id) return existing.id;

  const created = await safeQuery(
    supabase.from("customers").insert({
      user_id: user.id,
      full_name: meta.full_name || "",
      email: user.email || "",
      mobile: meta.mobile || "",
      channel_name: meta.channel_name || "",
      channel_url: meta.channel_url || ""
    }).select("id").single(),
    null, "Create customer profile"
  );
  return created?.id || null;
}

const registerForm = $("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("Creating account...");
    const btn = registerForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const full_name = $("fullName").value.trim();
      const email = $("email").value.trim();
      const password = $("password").value;
      const mobile = $("mobile").value.trim();
      const channel_name = $("channelName").value.trim();
      const channel_url = $("channelUrl").value.trim();
      const service_type = $("serviceType").value;

      const { data, error } = await timeout(supabase.auth.signUp({
        email, password,
        options: { data: { full_name, mobile, channel_name, channel_url, service_type } }
      }), 10000, "Registration");
      if (error) throw error;

      if (data.session && data.user) {
        ensureCustomerProfile(data.user).catch(console.error);
        msg("Account created successfully. Redirecting...", true);
        sessionStorage.setItem("yt_user_view","dashboard");
        setTimeout(() => location.href = "dashboard.html", 200);
      } else {
        msg("Account created. Please verify your email, then login.", true);
      }
    } catch (e) {
      msg(e?.message || "Registration failed.");
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}

const loginForm = $("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("Signing in...");
    const btn = loginForm.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;
    try {
      const email = $("email").value.trim();
      const password = $("password").value;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data?.user) throw new Error("Login response invalid.");

      // Admin/Staff accounts must use the Admin/Staff login, not the normal user portal.
      // This installation uses public.admin_users(id,email).
      const {data:adminRow}=await supabase.from("admin_users").select("id,status").eq("id",data.user.id).maybeSingle();
      const {data:staffRow}=await supabase.from("admin_staff_roles").select("role,status").eq("admin_id",data.user.id).maybeSingle();
      if(adminRow || staffRow){
        await supabase.auth.signOut();
        throw new Error("Admin/Staff account detected. Please use the Admin/Staff Login.");
      }

      const {data:customerRow}=await supabase.from("customers").select("account_status").eq("user_id",data.user.id).maybeSingle();
      if(String(customerRow?.account_status||"active").toLowerCase()==="disabled"){
        await supabase.auth.signOut();
        throw new Error("Your account is disabled. Please contact support.");
      }

      // Do not block login on profile/table queries.
      ensureCustomerProfile(data.user).catch(console.error);
      msg("Login successful.", true);
      sessionStorage.setItem("yt_user_view","dashboard");
      setTimeout(() => location.href = "dashboard.html", 120);
    } catch (e) {
      msg(e?.message || "Login failed.");
      if (btn) btn.disabled = false;
    }
  });
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = (value === null || value === undefined || value === "") ? "-" : String(value);
}

function renderAccess(customer, access) {
  dashboardAccess = access || null;
  setText("channelNameView", access?.channel_name || customer?.channel_name || "Not connected");
  setText("ytChannelName", access?.channel_name || customer?.channel_name || "YouTube Channel");
  setText("ytChannelId", access?.channel_id || "-");
  setText("ytSubscribers", Number(access?.subscribers || 0).toLocaleString("en-IN"));
  setText("ytViews", Number(access?.views || 0).toLocaleString("en-IN"));
  setText("ytVideos", Number(access?.videos || 0).toLocaleString("en-IN"));
  setText("ytSubscribersChannel", Number(access?.subscribers || 0).toLocaleString("en-IN"));
  setText("ytViewsChannel", Number(access?.views || 0).toLocaleString("en-IN"));
  setText("ytVideosChannel", Number(access?.videos || 0).toLocaleString("en-IN"));
  setText("userMonetizationStatus", access?.monetization_status || "Pending");
  setText("userMonetizationSubscribers", Number(access?.subscribers || 0).toLocaleString("en-IN"));
  setText("userMonetizationVideos", Number(access?.videos || 0).toLocaleString("en-IN"));
  setText("userAdsenseStatus", access?.adsense_access ? "Linked / Access ✅" : "Not Linked");
  setText("userAdsenseMonetizationStatus", access?.monetization_status || "Pending");

  const statusEl = $("youtubeConnectStatus");
  const connectBtn = $("connectYouTubeBtn");
  const updateBtn = $("updateChannelAccessBtn");
  const deleteBtn = $("deleteChannelAccessBtn");
  if (access?.google_connected) {
    if (statusEl) { statusEl.textContent = "YouTube Connected ✅"; statusEl.className = "status-badge connected"; }
    if (connectBtn) connectBtn.textContent = "Reconnect YouTube";
    if (updateBtn) updateBtn.style.display = "";
    if (deleteBtn) deleteBtn.style.display = "";
    setText("userChannelStatusProfile","Connected ✅");
  } else {
    if (statusEl) { statusEl.textContent = "Not Connected"; statusEl.className = "status-badge"; }
    if (connectBtn) connectBtn.textContent = "Connect YouTube Channel";
    if (updateBtn) updateBtn.style.display = "none";
    if (deleteBtn) deleteBtn.style.display = "none";
    setText("userChannelStatusProfile","Not connected");
  }

  const img = $("ytChannelLogo");
  if (img) {
    if (access?.channel_thumbnail) {
      img.src = access.channel_thumbnail;
      img.style.display = "block";
      img.onerror = () => { img.style.display = "none"; };
    } else img.style.display = "none";
  }
}

async function loadDashboard() {
  if (!$("creatorDashboard")) return;

  // Read the already-persisted Supabase session locally.
  // Do NOT call getUser() here: it makes another network request and was
  // causing a valid fresh login to be sent back to login when that request was slow.
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user || null;
  if (!user) return location.href = "login.html";

  setText("userEmail", user.email || "");
  setText("userEmailProfile", user.email || "-");

  let customer = await safeQuery(
    supabase.from("customers").select("*").eq("user_id", user.id).maybeSingle(),
    null, "Customer"
  );
  if (!customer) {
    await ensureCustomerProfile(user);
    customer = await safeQuery(
      supabase.from("customers").select("*").eq("user_id", user.id).maybeSingle(),
      null, "Customer retry"
    );
  }
  dashboardCustomer = customer;

  if (!customer) {
    setText("userName","Creator");
    setText("userNameTop","Creator");
    return;
  }

  setText("userName", customer.full_name || "Creator");
  setText("userNameTop", customer.full_name || "Creator");
  const nameProfileInput=$("userNameProfileInput");
  const mobileProfileInput=$("userMobileProfileInput");
  if(nameProfileInput) nameProfileInput.value=customer.full_name || "";
  if(mobileProfileInput) mobileProfileInput.value=customer.mobile || "";
  setText("userJoinedProfile", customer.created_at ? new Date(customer.created_at).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "-");
  setText("userChannelProfile", customer.channel_name || "-");
  setText("channelUrlView", customer.channel_url || "Not added");
  setText("channelNameView", customer.channel_name || "Not connected");

  // Only one lightweight channel query on dashboard startup.
  const access = await safeQuery(
    supabase.from("channel_access").select("*").eq("customer_id", customer.id).maybeSingle(),
    null, "Channel access"
  );
  renderAccess(customer, access);
}

async function loadServices() {
  const catalog = $("userServiceCatalog");
  const optionsBox = $("userServiceOptions");
  const select = $("userServiceType");
  if (!catalog || !optionsBox || !select) return;
  if (!dashboardCustomer) {
    optionsBox.innerHTML = '<div class="yt-service-empty">Customer profile unavailable.</div>';
    return;
  }

  if (!cachedServices) {
    cachedServices = await safeQuery(
      supabase.from("service_charges").select("*"),
      [], "Services"
    );
    cachedServices = (cachedServices || []).filter(s => s.is_active !== false).sort((a,b)=>(Number(a.sort_order ?? 999999)-Number(b.sort_order ?? 999999))||String(a.service_name||a.name||"").localeCompare(String(b.service_name||b.name||"")));
    serviceChargeMap = new Map((cachedServices || []).map(s => [s.service_name || s.name, Number(s.charge ?? s.amount ?? s.price ?? s.service_charge ?? 0)]));
  }

  const rows = cachedServices || [];
  select.innerHTML = rows.map(s =>
    `<option value="${esc(s.service_name || s.name || "Service")}">${esc(s.service_name || s.name || "Service")}</option>`
  ).join("");

  optionsBox.innerHTML = rows.length ? rows.map(s => `
    <label class="yt-user-service-check">
      <input type="checkbox" data-user-service-value="${esc(s.service_name || s.name || "Service")}">
      <span class="svc-main">
        <span class="svc-name">${esc(s.service_name || s.name || "Service")}</span>
        <span class="svc-desc">${esc(s.description || "Creator service")}</span>
      </span>
      <span class="svc-price">${money(s.charge ?? s.amount ?? s.price ?? s.service_charge)}</span>
    </label>`).join("") : '<div class="yt-service-empty">No active services available.</div>';

  optionsBox.querySelectorAll("[data-user-service-value]").forEach(box => {
    box.addEventListener("change", () => {
      const name = box.dataset.userServiceValue || "";
      const opt = [...select.options].find(o => o.value === name);
      if (opt) opt.selected = box.checked;
      updateUserServiceTotal();
    });
  });

  const dropdown = $("userServiceDropdown");
  const toggle = $("userServiceDropdownToggle");
  toggle?.addEventListener("click", () => dropdown?.classList.toggle("open"));

  $("selectAllUserServices")?.addEventListener("click", () => {
    [...select.options].forEach(o => o.selected = true);
    optionsBox.querySelectorAll("[data-user-service-value]").forEach(x => x.checked = true);
    updateUserServiceTotal();
  });

  $("clearAllUserServices")?.addEventListener("click", () => {
    [...select.options].forEach(o => o.selected = false);
    optionsBox.querySelectorAll("[data-user-service-value]").forEach(x => x.checked = false);
    updateUserServiceTotal();
  });

  catalog.innerHTML = rows.length ? rows.map(s => `
    <button type="button" data-service-pick="${esc(s.service_name || s.name || "Service")}">
      <span>▶️</span><b>${esc(s.service_name || s.name || "Service")}</b>
      <small>${esc(s.description || "Creator service")} · <strong>${money(s.charge ?? s.amount ?? s.price ?? s.service_charge)}</strong></small>
    </button>`).join("") : '<div class="yt-service-loading">No active services available.</div>';

  catalog.querySelectorAll("[data-service-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.servicePick || "";
      const opt = [...select.options].find(o => o.value === name);
      if (!opt) return;
      opt.selected = !opt.selected;
      const check = optionsBox.querySelector(`[data-user-service-value="${CSS.escape(name)}"]`);
      if (check) check.checked = opt.selected;
      btn.classList.toggle("selected", opt.selected);
      updateUserServiceTotal();
    });
  });
}

function updateUserServiceTotal(){
  const select=$("userServiceType");
  if(!select) return;
  const selected=[...select.selectedOptions].map(o=>o.value).filter(Boolean);
  const total=selected.reduce((sum,name)=>sum+Number(serviceChargeMap.get(name)||0),0);
  const totalEl=$("userServiceTotalAmount"); if(totalEl) totalEl.textContent=money(total);
  const countEl=$("userServiceSelectedCount"); if(countEl) countEl.textContent=`${selected.length} selected`;
  const toggle=$("userServiceDropdownToggle"); if(toggle) toggle.textContent=selected.length ? `${selected.length} service${selected.length>1?"s":""} selected` : "Select services…";
}

document.addEventListener("click",e=>{
  const dd=$("userServiceDropdown");
  if(dd&&!dd.contains(e.target))dd.classList.remove("open");
});

async function startPayU(paymentId, btn=null) {
  const old = btn?.textContent || "";
  if (btn) { btn.disabled = true; btn.textContent = "Opening PayU..."; }
  try {
    const { data, error } = await timeout(
      supabase.functions.invoke("payu-initiate",{body:{payment_id:paymentId}}),
      12000, "PayU"
    );
    if (error) throw error;
    if (!data?.endpoint || !data?.fields) throw new Error(data?.error || "Payment gateway response invalid.");
    const form = document.createElement("form");
    form.method = "POST"; form.action = data.endpoint; form.style.display = "none";
    Object.entries(data.fields).forEach(([name,value]) => {
      const input = document.createElement("input");
      input.type = "hidden"; input.name = name; input.value = value ?? "";
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  } catch(e) {
    alert(e?.message || "PayU payment start nahi hua.");
    if (btn) { btn.disabled = false; btn.textContent = old; }
  }
}

async function waitForPayment(requestId) {
  for (let i=0;i<6;i++) {
    const p = await safeQuery(
      supabase.from("payments").select("id,status,amount").eq("request_id",requestId).maybeSingle(),
      null, "Payment invoice"
    );
    if (p?.id) return p;
    await new Promise(r=>setTimeout(r,350));
  }
  return null;
}

async function submitServiceAndPay() {
  const btn = $("submitUserServiceRequest");
  const select = $("userServiceType");
  const message = $("userServiceRequestMessage");
  const selected = select ? [...select.selectedOptions].map(o => o.value).filter(Boolean) : [];
  if (!selected.length || !dashboardCustomer) {
    if (message) message.textContent = "Please select at least one service.";
    return;
  }

  const missing = selected.filter(name => Number(serviceChargeMap.get(name) || 0) <= 0);
  if (missing.length) {
    if (message) message.textContent = `Charge not configured for: ${missing.join(", ")}`;
    return;
  }

  btn.disabled = true;
  if (message) message.textContent = `Preparing payment for ${selected.length} service${selected.length > 1 ? "s" : ""}...`;
  try {
    // One request contains the selected services; the DB trigger creates one invoice for their combined charge.
    const service_type = selected.join(" | ");
    const res = await timeout(
      supabase.from("service_requests").insert({
        customer_id: dashboardCustomer.id,
        service_type,
        status: "payment_pending"
      }).select("id").single(),
      8000, "Create request"
    );
    if (res?.error) throw res.error;
    const requestId = res?.data?.id;
    if (!requestId) throw new Error("Request create failed.");

    const payment = await waitForPayment(requestId);
    if (!payment) throw new Error("Payment invoice create nahi hua. Service Charge setup check karein.");
    await startPayU(payment.id, btn);
  } catch(e) {
    if (message) message.textContent = e?.message || "Payment start failed.";
    btn.disabled = false;
  }
}

function payStatus(p) {
  return String(p?.status || "pending").toLowerCase();
}

async function loadRequestsAndPayments() {
  if (!dashboardCustomer) return;
  const [reqs, requestNotes, requestDocuments, payments] = await Promise.all([
    safeQuery(
      supabase.from("service_requests").select("id,service_type,status,created_at").eq("customer_id",dashboardCustomer.id).order("created_at",{ascending:false}),
      [], "Requests"
    ),
    safeQuery(
      supabase.from("request_notes").select("id,request_id,note,created_at").order("created_at",{ascending:false}),
      [], "Request updates"
    ),
    safeQuery(
      supabase.from("request_documents").select("id,request_id,file_name,storage_path,mime_type,created_at").order("created_at",{ascending:false}),
      [], "Request screenshots"
    ),
    safeQuery(
      supabase.from("payments").select("id,request_id,service_name,amount,currency,status,txnid,mihpayid,error_message,created_at,updated_at").eq("customer_id",dashboardCustomer.id).order("created_at",{ascending:false}),
      [], "Payments"
    )
  ]);

  const pMap = new Map((payments||[]).map(p=>[p.request_id,p]));
  const paidRequests = (reqs||[]).filter(r => payStatus(pMap.get(r.id)) === "paid");

  const prettyStatus=(value)=>{
    const st=String(value||"pending").toLowerCase();
    const map={payment_pending:"Payment Pending",pending:"Pending",processing:"Processing",on_hold:"On Hold",completed:"Completed",complete:"Completed",rejected:"Rejected",failed:"Failed"};
    return map[st]||st.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
  };
  const statusClass=(value)=>{
    const st=String(value||"pending").toLowerCase();
    if(["completed","complete"].includes(st))return "completed";
    if(["rejected","failed"].includes(st))return "rejected";
    if(st==="processing")return "processing";
    if(st==="on_hold")return "on_hold";
    return "pending";
  };
  const dateText=(value)=>{
    if(!value)return "-";
    const d=new Date(value);
    return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  };

  // My Requests: show every request for this customer, with both request and payment status.
  const list = $("requestList");
  if (list) {
    list.innerHTML = (reqs||[]).length ? (reqs||[]).map(r => {
      const p=pMap.get(r.id);
      const pst=payStatus(p);
      const payLabel=pst==="paid"?"Paid":pst==="failed"?"Failed":(pst==="cancelled"||pst==="canceled")?"Cancelled":"Pending";
      const payClass=pst==="paid"?"paid":pst==="failed"?"failed":(pst==="cancelled"||pst==="canceled")?"cancelled":"pending";
      const notes=(requestNotes||[]).filter(n=>n.request_id===r.id);
      const docs=(requestDocuments||[]).filter(d=>d.request_id===r.id && String(d.storage_path||"").includes("/admin-updates/"));
      return `<div class="yt-user-request-card">
        <div class="yt-user-request-main">
          <b>${esc(r.service_type||"Service")}</b>
          <div class="yt-user-request-meta">
            <span>Request: ${esc(String(r.id||"").slice(0,8).toUpperCase())}</span>
            <span>${esc(dateText(r.created_at))}</span>
          </div>
          ${notes.length?`<div class="yt-user-request-updates"><strong>Admin Update</strong>${notes.map(n=>`<div class="yt-user-request-note"><span>${esc(n.note)}</span><time>${esc(dateText(n.created_at))}</time></div>`).join("")}</div>`:""}
          ${docs.length?`<div class="yt-user-request-screenshots"><strong>Screenshot</strong>${docs.map(d=>`<button type="button" class="yt-user-request-file" data-admin-request-file="${esc(d.storage_path)}">📷 ${esc(d.file_name||"View screenshot")}</button>`).join("")}</div>`:""}
        </div>
        <div class="yt-user-status-stack">
          <span class="yt-user-status-chip ${statusClass(r.status)}">${esc(prettyStatus(r.status))}</span>
          <span class="yt-user-status-chip ${payClass}">Payment: ${esc(payLabel)}</span>
        </div>
      </div>`;
    }).join("") : '<div class="yt-user-empty-state">No service requests yet.</div>';
    list.querySelectorAll("[data-admin-request-file]").forEach(btn=>btn.addEventListener("click",async()=>{
      btn.disabled=true;
      try{
        const {data,error}=await supabase.storage.from("user-documents").createSignedUrl(btn.dataset.adminRequestFile,300);
        if(error)throw error;
        if(!data?.signedUrl)throw new Error("Screenshot URL unavailable.");
        window.open(data.signedUrl,"_blank","noopener,noreferrer");
      }catch(e){alert(e?.message||"Unable to open screenshot.");}
      finally{btn.disabled=false;}
    }));
  }

  // Payments: show Paid / Pending / Failed / Cancelled clearly with retry actions.
  const payBox = $("userPaymentsList");
  if (payBox) {
    payBox.innerHTML = (payments||[]).length ? (payments||[]).map(p => {
      const st = payStatus(p);
      const label = st==="paid" ? "Paid" : st==="failed" ? "Failed" : (st==="cancelled"||st==="canceled") ? "Cancelled" : "Pending";
      const cls = st==="paid"?"paid":st==="failed"?"failed":(st==="cancelled"||st==="canceled")?"cancelled":"pending";
      const action = st==="paid" ? "" : `<button type="button" class="yt-user-red-btn" data-retry-payment="${esc(p.id)}">${st==="failed"?"Retry Payment":(st==="cancelled"||st==="canceled")?"Pay Again":"Pay Now"}</button>`;
      return `<div class="yt-user-payment-card">
        <div class="yt-user-payment-main">
          <b>${esc(p.service_name||"Service")}</b>
          <div class="yt-user-payment-meta">
            <span>${money(p.amount)}</span>
            <span>${esc(p.txnid||"Transaction not started")}</span>
            <span>${esc(dateText(p.updated_at||p.created_at))}</span>
          </div>
        </div>
        <div class="yt-user-status-stack">
          <span class="yt-user-status-chip ${cls}">${esc(label)}</span>
          ${action}
        </div>
      </div>`;
    }).join("") : '<div class="yt-user-empty-state">No payments yet.</div>';
    payBox.querySelectorAll("[data-retry-payment]").forEach(b => b.addEventListener("click",()=>startPayU(b.dataset.retryPayment,b)));
  }

  const filtered = (word) => paidRequests.filter(r=>String(r.service_type||"").toLowerCase().includes(word));
  const monet = $("userMonetizationRequests");
  if (monet) {
    const rows=filtered("monetization");
    monet.innerHTML=rows.length?rows.map(r=>`<div class="request-row"><b>${esc(r.service_type)}</b><span>${esc(r.status==="payment_pending"?"pending":r.status)}</span></div>`).join(""):"<p>No monetization requests yet.</p>";
  }
  const ads = $("userAdsenseRequests");
  if (ads) {
    const rows=filtered("adsense");
    ads.innerHTML=rows.length?rows.map(r=>`<div class="request-row"><b>${esc(r.service_type)}</b><span>${esc(r.status==="payment_pending"?"pending":r.status)}</span></div>`).join(""):"<p>No AdSense requests yet.</p>";
  }
}

function loadUserViewData(name) {
  if (name === "services") loadServices();
  if (["requests","payments","monetization","adsense"].includes(name)) loadRequestsAndPayments();
}

document.getElementById("userServiceType")?.addEventListener("change",updateUserServiceTotal);
document.addEventListener("click",(e)=>{
  const b=e.target.closest?.("[data-user-view]");
  if (b) loadUserViewData(b.dataset.userView);
});

const submitBtn = $("submitUserServiceRequest");
if (submitBtn) submitBtn.addEventListener("click", submitServiceAndPay);


function setProfileEditing(enabled){
  const name=$("userNameProfileInput");
  const mobile=$("userMobileProfileInput");
  const edit=$("editUserProfileBtn");
  const save=$("saveUserProfileBtn");
  if(name)name.disabled=!enabled;
  if(mobile)mobile.disabled=!enabled;
  if(edit)edit.hidden=enabled;
  if(save)save.hidden=!enabled;
  if(enabled)name?.focus();
}

$("editUserProfileBtn")?.addEventListener("click",()=>setProfileEditing(true));

$("saveUserProfileBtn")?.addEventListener("click",async()=>{
  if(!dashboardCustomer)return;
  const btn=$("saveUserProfileBtn");
  const msgEl=$("userProfileMessage");
  const full_name=$("userNameProfileInput")?.value.trim()||"";
  const mobile=$("userMobileProfileInput")?.value.trim()||"";

  if(!full_name){
    if(msgEl){msgEl.textContent="Customer name is required.";msgEl.className="yt-channel-access-message bad";}
    return;
  }

  if(btn)btn.disabled=true;
  if(msgEl){msgEl.textContent="Updating profile...";msgEl.className="yt-channel-access-message";}

  try{
    const {data,error}=await supabase
      .from("customers")
      .update({full_name,mobile})
      .eq("id",dashboardCustomer.id)
      .select("*")
      .single();

    if(error)throw error;
    dashboardCustomer=data||{...dashboardCustomer,full_name,mobile};

    setText("userName",dashboardCustomer.full_name||"Creator");
    setText("userNameTop",dashboardCustomer.full_name||"Creator");
    if(msgEl){msgEl.textContent="Profile updated successfully.";msgEl.className="yt-channel-access-message ok";}
    setProfileEditing(false);
  }catch(e){
    if(msgEl){msgEl.textContent=e?.message||"Profile update failed.";msgEl.className="yt-channel-access-message bad";}
  }finally{
    if(btn)btn.disabled=false;
  }
});


document.addEventListener("DOMContentLoaded",()=>{
  const params = new URLSearchParams(location.search);
  const paymentResult = params.get("payment");
  if (paymentResult) {
    const success = paymentResult === "success";
    if (success) {
      history.replaceState({}, "", "dashboard.html");
      const overlay=$("paymentSuccessOverlay");
      const countdown=$("paymentSuccessCountdown");
      const goBtn=$("paymentSuccessMyRequestsBtn");
      let left=12;
      if(overlay)overlay.hidden=false;
      if(countdown)countdown.textContent=String(left);

      const goRequests=()=>{
        sessionStorage.setItem("yt_user_view","requests");
        location.replace("dashboard.html");
      };
      if(goBtn)goBtn.onclick=goRequests;

      const timer=setInterval(()=>{
        left-=1;
        if(countdown)countdown.textContent=String(Math.max(left,0));
        if(left<=0){
          clearInterval(timer);
          goRequests();
        }
      },1000);
    } else {
      sessionStorage.setItem("yt_user_view","payments");
      if (typeof window.openUserView === "function") window.openUserView("payments");
      const box = $("userPaymentResultNew") || $("userPaymentResult");
      if (box) {
        box.hidden=false;
        box.className="yt-payment-result failed";
        box.textContent="Payment failed / cancelled. Payments se Retry / Pay Again karein.";
      }
      history.replaceState({}, "", "dashboard.html");
      setTimeout(loadRequestsAndPayments,50);
    }
  }
});

window.logoutCreator = async () => {
  try { await timeout(supabase.auth.signOut(), 5000, "Logout"); } catch(_) {}
  location.href = "login.html";
};

window.copyManager = async () => {
  await navigator.clipboard.writeText("sumitkhobragade088@gmail.com");
  alert("Manager email copied");
};

loadDashboard().then(()=>{
  const saved=sessionStorage.getItem("yt_user_view")||"dashboard";
  loadUserViewData(saved);
}).catch(console.error);
