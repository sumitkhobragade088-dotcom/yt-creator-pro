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
  if (access?.google_connected) {
    if (statusEl) { statusEl.textContent = "YouTube Connected ✅"; statusEl.className = "status-badge connected"; }
    if (connectBtn) connectBtn.textContent = "Reconnect YouTube";
  } else {
    if (statusEl) { statusEl.textContent = "Not Connected"; statusEl.className = "status-badge"; }
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

  let user;
  try {
    const result = await timeout(supabase.auth.getUser(), 8000, "Session");
    user = result?.data?.user;
  } catch (e) {
    console.error(e);
    return location.href = "login.html";
  }
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
  setText("userNameProfile", customer.full_name || "Creator");
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
  const select = $("userServiceType");
  if (!catalog || !select) return;
  if (!dashboardCustomer) {
    catalog.innerHTML = '<div class="yt-service-loading">Customer profile unavailable.</div>';
    return;
  }

  if (!cachedServices) {
    cachedServices = await safeQuery(
      supabase.from("service_charges")
        .select("id,service_name,description,charge,is_active,sort_order")
        .eq("is_active", true)
        .order("sort_order",{ascending:true})
        .order("service_name",{ascending:true}),
      [], "Services"
    );
    serviceChargeMap = new Map((cachedServices || []).map(s => [s.service_name, Number(s.charge || 0)]));
  }

  const rows = cachedServices || [];
  select.innerHTML = '<option value="">Select Service</option>' + rows.map(s =>
    `<option value="${esc(s.service_name)}">${esc(s.service_name)} — ${money(s.charge)}</option>`
  ).join("");
  catalog.innerHTML = rows.length ? rows.map(s => `
    <button type="button" data-service-pick="${esc(s.service_name)}">
      <span>▶️</span><b>${esc(s.service_name)}</b>
      <small>${esc(s.description || "Creator service")} · <strong>${money(s.charge)}</strong></small>
    </button>`).join("") : '<div class="yt-service-loading">No active services available.</div>';

  catalog.querySelectorAll("[data-service-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
      select.value = btn.dataset.servicePick || "";
      catalog.querySelectorAll("[data-service-pick]").forEach(x => x.classList.remove("selected"));
      btn.classList.add("selected");
    });
  });
}

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
  const service_type = select?.value || "";
  if (!service_type || !dashboardCustomer) return;

  const charge = Number(serviceChargeMap.get(service_type) || 0);
  if (charge <= 0) {
    if (message) message.textContent = "Admin ne is service ka payment charge set nahi kiya.";
    return;
  }

  btn.disabled = true;
  if (message) message.textContent = "Preparing payment...";
  try {
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
  const [reqs, payments] = await Promise.all([
    safeQuery(
      supabase.from("service_requests").select("id,service_type,status,created_at").eq("customer_id",dashboardCustomer.id).order("created_at",{ascending:false}),
      [], "Requests"
    ),
    safeQuery(
      supabase.from("payments").select("id,request_id,service_name,amount,currency,status,txnid,mihpayid,error_message,created_at,updated_at").eq("customer_id",dashboardCustomer.id).order("created_at",{ascending:false}),
      [], "Payments"
    )
  ]);

  const pMap = new Map((payments||[]).map(p=>[p.request_id,p]));
  const paidRequests = (reqs||[]).filter(r => payStatus(pMap.get(r.id)) === "paid");

  const list = $("requestList");
  if (list) {
    list.innerHTML = paidRequests.length ? paidRequests.map(r => {
      const status = String(r.status || "pending") === "payment_pending" ? "pending" : String(r.status || "pending");
      return `<div class="request-row"><div><b>${esc(r.service_type||"Service")}</b><small>${esc(status)}</small></div><span class="yt-pay-chip paid">Paid ✅</span></div>`;
    }).join("") : "<p>No paid service requests yet.</p>";
  }

  const payBox = $("userPaymentsList");
  if (payBox) {
    payBox.innerHTML = (payments||[]).length ? (payments||[]).map(p => {
      const st = payStatus(p);
      const label = st==="paid" ? "Success" : st==="failed" ? "Failed" : (st==="cancelled"||st==="canceled") ? "Cancelled" : "Pending";
      const action = st==="paid" ? "" : `<button type="button" class="yt-user-red-btn" data-retry-payment="${esc(p.id)}">${st==="failed"?"Retry Payment":(st==="cancelled"||st==="canceled")?"Pay Again":"Pay Now"}</button>`;
      return `<div class="request-row yt-request-payment-row">
        <div><b>${esc(p.service_name||"Service")}</b><small>${money(p.amount)} · ${esc(p.txnid||"Transaction not started")}</small></div>
        <div class="yt-payment-actions"><span class="yt-pay-chip ${st==="paid"?"paid":"pending"}">${label}</span>${action}</div>
      </div>`;
    }).join("") : "<p>No payments yet.</p>";
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

document.addEventListener("click",(e)=>{
  const b=e.target.closest?.("[data-user-view]");
  if (b) loadUserViewData(b.dataset.userView);
});

const submitBtn = $("submitUserServiceRequest");
if (submitBtn) submitBtn.addEventListener("click", submitServiceAndPay);

document.addEventListener("DOMContentLoaded",()=>{
  const saved=sessionStorage.getItem("yt_user_view")||"dashboard";
  setTimeout(()=>loadUserViewData(saved),0);

  const params = new URLSearchParams(location.search);
  const paymentResult = params.get("payment");
  if (paymentResult) {
    const success = paymentResult === "success";
    const target = success ? "requests" : "payments";
    sessionStorage.setItem("yt_user_view",target);
    if (typeof window.openUserView === "function") window.openUserView(target);
    const box = $("userPaymentResultNew") || $("userPaymentResult");
    if (box) {
      box.hidden=false;
      box.className=`yt-payment-result ${success?"success":"failed"}`;
      box.textContent=success
        ? "Payment successful ✅ Request My Requests me add ho gaya."
        : "Payment failed / cancelled. Payments se Retry / Pay Again karein.";
    }
    history.replaceState({}, "", "dashboard.html");
    setTimeout(loadRequestsAndPayments,50);
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

loadDashboard();
