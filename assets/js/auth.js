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
  if (!$("creatorDashboard")) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return location.href = "login.html";

  $("userEmail").textContent = user.email || "";

  const { data: customer } = await supabase
    .from("customers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (customer) {
    $("userName").textContent = customer.full_name || "Creator";
    $("channelNameView").textContent = customer.channel_name || "Not added";
    $("channelUrlView").textContent = customer.channel_url || "Not added";

    const { data: reqs } = await supabase
      .from("service_requests")
      .select("service_type,status,created_at")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false });

    const list = $("requestList");
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

window.logoutCreator = async () => {
  await supabase.auth.signOut();
  location.href = "login.html";
};

window.copyManager = async () => {
  await navigator.clipboard.writeText("sumitkhobragade088@gmail.com");
  alert("Manager email copied");
};

loadDashboard();