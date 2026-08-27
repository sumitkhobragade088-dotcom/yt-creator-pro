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
      .select("service_type,status,created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const list = document.getElementById("requestList");
    if (list) {
      list.innerHTML = "";
      (reqs || []).forEach(r => {
        const div = document.createElement("div");
        div.className = "request-row";
        div.innerHTML = `<b>${r.service_type || "Service"}</b><span>${r.status || "pending"}</span>`;
        list.appendChild(div);
      });
      if (!reqs || reqs.length === 0) list.innerHTML = "<p>No service requests yet.</p>";
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