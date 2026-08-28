import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const msg = (text, ok=false) => {
  const el = $("message");
  if (!el) return;
  el.textContent = text;
  el.className = ok ? "message ok" : "message";
};

async function ensureCustomerProfile(user) {
  const meta = user.user_metadata || {};

  const { data: existing, error: findError } = await supabase
    .from("customers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (findError) throw findError;
  if (existing) return existing.id;

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      user_id: user.id,
      full_name: meta.full_name || "",
      email: user.email || "",
      mobile: meta.mobile || "",
      channel_name: meta.channel_name || "",
      channel_url: meta.channel_url || ""
    })
    .select("id")
    .single();

  if (error) throw error;

  if (meta.service_type) {
    await supabase.from("service_requests").insert({
      customer_id: customer.id,
      service_type: meta.service_type,
      status: "pending"
    });
  }
  return customer.id;
}

const registerForm = $("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("Creating account...");

    const full_name = $("fullName").value.trim();
    const email = $("email").value.trim();
    const password = $("password").value;
    const mobile = $("mobile").value.trim();
    const channel_name = $("channelName").value.trim();
    const channel_url = $("channelUrl").value.trim();
    const service_type = $("serviceType").value;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name, mobile, channel_name, channel_url, service_type }
      }
    });

    if (error) return msg(error.message);

    if (data.session && data.user) {
      try {
        await ensureCustomerProfile(data.user);
        msg("Account created successfully. Redirecting...", true);
        sessionStorage.setItem("yt_user_view","dashboard");
        setTimeout(() => location.href = "dashboard.html", 700);
      } catch (err) {
        msg(err.message);
      }
    } else {
      msg("Account created. Please verify your email, then login.", true);
    }
  });
}

const loginForm = $("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("Signing in...");
    const email = $("email").value.trim();
    const password = $("password").value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return msg(error.message);

    try {
      await ensureCustomerProfile(data.user);
      msg("Login successful.", true);
      sessionStorage.setItem("yt_user_view","dashboard");
      setTimeout(() => location.href = "dashboard.html", 500);
    } catch (err) {
      msg(err.message);
    }
  });
}


async function loadDashboard() {
  if (!document.getElementById("creatorDashboard")) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return location.href = "login.html";

  document.getElementById("userEmail").textContent = user.email || "";

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (customerError) {
    console.error(customerError);
    return;
  }

  if (customer) {
    document.getElementById("userName").textContent = customer.full_name || "Creator";
    const topName=document.getElementById("userNameTop"); if(topName) topName.textContent=customer.full_name||"Creator";
    const pName=document.getElementById("userNameProfile"); if(pName)pName.textContent=customer.full_name||"Creator";
    const pEmail=document.getElementById("userEmailProfile"); if(pEmail)pEmail.textContent=user.email||"-";
    const pChannel=document.getElementById("userChannelProfile"); if(pChannel)pChannel.textContent=customer.channel_name||"-";
    document.getElementById("channelNameView").textContent = customer.channel_name || "Not connected";
    document.getElementById("channelUrlView").textContent = customer.channel_url || "Not added";

    const { data: access, error: accessError } = await supabase
      .from("channel_access")
      .select("*")
      .eq("customer_id", customer.id)
      .maybeSingle();

    if (accessError) console.error(accessError);

    const statusEl = document.getElementById("youtubeConnectStatus");
    const connectBtn = document.getElementById("connectYouTubeBtn");

    if (access) {
      const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = (value === null || value === undefined || value === "") ? "-" : String(value);
      };
      const fmt = (value) => {
        const n = Number(value);
        return Number.isFinite(n) ? n.toLocaleString("en-IN") : (value || "0");
      };

      setText("ytChannelName", access.channel_name || customer?.channel_name || "YouTube Channel");
      setText("ytChannelId", access.channel_id || "-");
      setText("ytSubscribers", fmt(access.subscribers));
      setText("ytViews", fmt(access.views));
      setText("ytVideos", fmt(access.videos));
      setText("ytSubscribersChannel", fmt(access.subscribers));
      setText("ytViewsChannel", fmt(access.views));
      setText("ytVideosChannel", fmt(access.videos));

      const img = document.getElementById("ytChannelLogo");
      if (img) {
        if (access.channel_thumbnail) {
          img.src = access.channel_thumbnail;
          img.style.display = "block";
          img.onerror = () => { img.style.display = "none"; };
        } else {
          img.style.display = "none";
        }
      }
    }

    if (access?.google_connected) {
      if (statusEl) {
        statusEl.textContent = "YouTube Connected ✅";
        statusEl.className = "status-badge connected";
      }
      if (connectBtn) connectBtn.textContent = "Reconnect YouTube";
    } else {
      if (statusEl) {
        statusEl.textContent = "Not Connected";
        statusEl.className = "status-badge";
      }
    }

    const { data: reqs } = await supabase
      .from("service_requests")
      .select("id,service_type,status,created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const { data: activeServices, error: activeServicesError } = await supabase
      .from("service_charges")
      .select("id,service_name,description,charge,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("service_name", { ascending: true });

    if (activeServicesError) console.error("Services:", activeServicesError);

    const catalog = document.getElementById("userServiceCatalog");
    const serviceSelect = document.getElementById("userServiceType");
    const serviceMoney = (n) => `₹${Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

    if (catalog && serviceSelect) {
      const rows = activeServices || [];
      serviceSelect.innerHTML = '<option value="">Select Service</option>' + rows.map(s =>
        `<option value="${String(s.service_name||"").replaceAll('"',"&quot;")}">${s.service_name} — ${serviceMoney(s.charge)}</option>`
      ).join("");

      catalog.innerHTML = rows.length ? rows.map(s => `
        <button type="button" data-service-pick="${String(s.service_name||"").replaceAll('"',"&quot;")}">
          <span>▶️</span>
          <b>${s.service_name || "Service"}</b>
          <small>${s.description || "Creator service"} · <strong>${serviceMoney(s.charge)}</strong></small>
        </button>
      `).join("") : '<div class="yt-service-loading">No active services available.</div>';

      catalog.querySelectorAll("[data-service-pick]").forEach(btn => {
        btn.addEventListener("click", () => {
          serviceSelect.value = btn.dataset.servicePick || "";
          catalog.querySelectorAll("[data-service-pick]").forEach(x => x.classList.remove("selected"));
          btn.classList.add("selected");
        });
      });
    }

    const { data: payments, error: paymentsError } = await supabase
      .from("payments")
      .select("id,request_id,amount,currency,status,txnid,mihpayid,created_at,updated_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });
    if (paymentsError) console.error(paymentsError);

    const paymentByRequest = new Map((payments || []).map(p => [p.request_id, p]));
    const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;

    const list = document.getElementById("requestList");
    if (list) {
      list.innerHTML = "";
      (reqs || []).forEach(r => {
        const pay = paymentByRequest.get(r.id);
        const div = document.createElement("div");
        div.className = "request-row yt-request-payment-row";
        const paymentUi = !pay
          ? `<span class="yt-pay-chip waiting">Payment not assigned</span>`
          : String(pay.status || "").toLowerCase() === "paid"
            ? `<span class="yt-pay-chip paid">Paid ✅ ${money(pay.amount)}</span>`
            : `<span class="yt-pay-chip pending">${money(pay.amount)} · ${pay.status || "pending"}</span>
               <button type="button" class="yt-user-red-btn yt-pay-now-btn" data-payment-id="${pay.id}">Pay Now</button>`;
        div.innerHTML = `<div><b>${r.service_type || "Service"}</b><small>${r.status || "pending"}</small></div><div class="yt-payment-actions">${paymentUi}</div>`;
        list.appendChild(div);
      });
      if (!reqs || reqs.length === 0) list.innerHTML = "<p>No service requests yet.</p>";

      list.querySelectorAll("[data-payment-id]").forEach(btn => {
        btn.addEventListener("click", async () => {
          const paymentId = btn.dataset.paymentId;
          btn.disabled = true;
          const oldText = btn.textContent;
          btn.textContent = "Opening PayU...";
          try {
            const { data, error } = await supabase.functions.invoke("payu-initiate", {
              body: { payment_id: paymentId }
            });
            if (error) throw error;
            if (!data?.endpoint || !data?.fields) throw new Error("Payment gateway response invalid.");

            const form = document.createElement("form");
            form.method = "POST";
            form.action = data.endpoint;
            form.style.display = "none";
            Object.entries(data.fields).forEach(([name, value]) => {
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = name;
              input.value = value ?? "";
              form.appendChild(input);
            });
            document.body.appendChild(form);
            form.submit();
          } catch (err) {
            alert(err?.message || "PayU payment start nahi hua.");
            btn.disabled = false;
            btn.textContent = oldText;
          }
        });
      });
    }

    const params = new URLSearchParams(location.search);
    const paymentResult = params.get("payment");
    if (paymentResult) {
      const box = document.getElementById("userPaymentResult");
      if (box) {
        box.hidden = false;
        box.className = `yt-payment-result ${paymentResult === "success" ? "success" : "failed"}`;
        box.textContent = paymentResult === "success"
          ? "Payment successful ✅"
          : "Payment failed / cancelled. Aap dobara Pay Now kar sakte hain.";
      }
      sessionStorage.setItem("yt_user_view","requests");
      if (typeof openUserView === "function") openUserView("requests");
      history.replaceState({}, "", "dashboard.html");
    }

    const renderFilteredRequests = (targetId, matchText) => {
      const target = document.getElementById(targetId);
      if (!target) return;
      const filtered = (reqs || []).filter(r => String(r.service_type || "").toLowerCase().includes(matchText));
      target.innerHTML = filtered.length
        ? filtered.map(r => `<div class="request-row"><b>${r.service_type || "Service"}</b><span>${r.status || "pending"}</span></div>`).join("")
        : "<p>No matching requests yet.</p>";
    };
    renderFilteredRequests("userMonetizationRequests", "monetization");
    renderFilteredRequests("userAdsenseRequests", "adsense");

    const setDashText = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (value === null || value === undefined || value === "") ? "-" : String(value);
    };
    setDashText("userMonetizationStatus", access?.monetization_status || "Pending");
    setDashText("userMonetizationSubscribers", Number(access?.subscribers || 0).toLocaleString("en-IN"));
    setDashText("userMonetizationVideos", Number(access?.videos || 0).toLocaleString("en-IN"));
    setDashText("userAdsenseStatus", access?.adsense_access ? "Linked / Access ✅" : "Not Linked");
    setDashText("userAdsenseMonetizationStatus", access?.monetization_status || "Pending");

    const submitServiceBtn = document.getElementById("submitUserServiceRequest");
    if (submitServiceBtn && !submitServiceBtn.dataset.bound) {
      submitServiceBtn.dataset.bound = "1";
      submitServiceBtn.addEventListener("click", async () => {
        const select = document.getElementById("userServiceType");
        const message = document.getElementById("userServiceRequestMessage");
        const service_type = select?.value || "";
        if (!service_type) return;
        submitServiceBtn.disabled = true;
        if (message) message.textContent = "Submitting...";
        const { error } = await supabase.from("service_requests").insert({
          customer_id: customer.id,
          service_type,
          status: "pending"
        });
        if (error) {
          if (message) message.textContent = error.message;
        } else {
          if (message) message.textContent = "Request submitted successfully ✅";
          setTimeout(() => location.reload(), 700);
        }
        submitServiceBtn.disabled = false;
      });
    }
  }
}

window.logoutCreator = async () => {
  await supabase.auth.signOut();
  location.href = "login.html";
};

window.copyManager = async () => {
  await navigator.clipboard.writeText("sumitkhobragade088@gmail.com");
  alert("Manager email copied");
};

loadDashboard();