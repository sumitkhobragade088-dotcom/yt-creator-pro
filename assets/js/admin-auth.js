import { supabase } from "./supabase.js";

const ADMIN_EMAIL = "sumitkhobragade088@gmail.com";
const $ = (id) => document.getElementById(id);

function showMessage(text, ok=false) {
  const el = $("adminMessage");
  if (!el) return;
  el.textContent = text;
  el.className = ok ? "message ok" : "message";
}

async function isAdmin(user) {
  if (!user || user.email !== ADMIN_EMAIL) return false;
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

async function protectAdminPage() {
  if (!document.body.dataset.adminProtected) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isAdmin(user))) {
    location.href = "login.html";
    return;
  }

  if ($("adminEmailView")) $("adminEmailView").textContent = user.email;

  const { data: customers } = await supabase
    .from("customers")
    .select("id,full_name,email,mobile,channel_name,channel_url,created_at")
    .order("created_at", { ascending: false });

  const { data: requests } = await supabase
    .from("service_requests")
    .select("id,service_type,status,created_at");

  if ($("totalCustomers")) $("totalCustomers").textContent = (customers || []).length;
  if ($("totalRequests")) $("totalRequests").textContent = (requests || []).length;
  if ($("pendingRequests")) $("pendingRequests").textContent =
    (requests || []).filter(r => (r.status || "").toLowerCase() === "pending").length;

  const tbody = $("customersBody");
  if (tbody) {
    tbody.innerHTML = "";
    (customers || []).forEach(c => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${c.full_name || "-"}</td>
        <td>${c.email || "-"}</td>
        <td>${c.mobile || "-"}</td>
        <td>${c.channel_name || "-"}</td>
      `;
      tbody.appendChild(tr);
    });
    if (!customers || customers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4">No customers yet.</td></tr>`;
    }
  }
}

window.adminLogout = async () => {
  await supabase.auth.signOut();
  location.href = "login.html";
};

protectAdminPage();
async function loadYouTubeAdminData() {
  const body = document.getElementById("youtubeChannelsBody");
  if (!body) return;
  const { data: customers, error: ce } = await supabase.from("customers").select("id,full_name,email,channel_name");
  const { data: rows, error: ae } = await supabase.from("channel_access").select("*");
  if (ce || ae) {
    body.innerHTML = `<tr><td colspan="8">${(ce || ae).message}</td></tr>`;
    return;
  }
  const map = new Map((rows || []).map(a => [a.customer_id,a]));
  body.innerHTML = "";
  (customers || []).forEach(c => {
    const a=map.get(c.id);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${c.full_name||"-"}</td><td>${c.email||"-"}</td><td>${a?.channel_name||c.channel_name||"-"}</td><td>${a?.google_connected?"Connected ✅":"Not Connected"}</td><td>${Number(a?.subscribers||0).toLocaleString("en-IN")}</td><td>${Number(a?.views||0).toLocaleString("en-IN")}</td><td>${Number(a?.videos||0).toLocaleString("en-IN")}</td><td>${a?.monetization_status||"pending"}</td>`;
    body.appendChild(tr);
  });
  if (!(customers||[]).length) body.innerHTML='<tr><td colspan="8">No customers yet.</td></tr>';
}
loadYouTubeAdminData();
