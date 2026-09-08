import { supabase } from "./supabase.js";
const role=document.body.dataset.staffRole;
const label={manager:"Manager",operator:"Operator",support:"Support"}[role]||role;
const accent={manager:"#16a34a",operator:"#eab308",support:"#ec4899"}[role]||"#2563eb";
const $=id=>document.getElementById(id);
async function boot(){
  const {data}=await supabase.auth.getSession(); const user=data?.session?.user; if(!user)return location.href="admin/login.html";
  const {data:admin,error}=await supabase.from("admin_users").select("id,email,status").eq("id",user.id).maybeSingle();
  if(error||!admin)return location.href="admin/login.html";
  const status=String(admin.status||"active").toLowerCase();
  if(status!=="active"){await supabase.auth.signOut().catch(()=>{});return location.href=`admin/login.html?status=${encodeURIComponent(status)}`;}
  const {data:a,error:ae}=await supabase.from("admin_role_assignments").select("role").eq("admin_user_id",user.id).maybeSingle();
  if(ae||a?.role!==role)return location.href="admin/login.html";
  const {data:perms}=await supabase.from("admin_role_permissions").select("permission_key").eq("role",role);
  $("staffEmail").textContent=user.email||""; $("staffWelcome").textContent=`Welcome ${label}`; document.documentElement.style.setProperty("--staff-accent",accent);
  const map=[
    ["dashboard.view","🏠","Dashboard"],["applications.view","📋","Applications"],["applications.update","✏️","Application Updates"],["users","👥","Users"],["services.view","🧩","Services"],["payments","💳","Payments"],["revenue.view","💰","Revenue"],["youtube","▶️","YouTube"],["website_cms.view","🌐","Website CMS"],["audit.view","📝","Audit Log"],["trash.view","🗑️","Trash"],["system_health.view","🩺","System Health"],["global_search.use","🔎","Global Search"]
  ];
  const allowed=new Set((perms||[]).map(x=>x.permission_key)); const box=$("staffModules"); const visible=map.filter(x=>allowed.has(x[0])||allowed.has(x[0].split(".")[0]));
  box.innerHTML=visible.length?visible.map(x=>`<article class="staff-module"><span>${x[1]}</span><b>${x[2]}</b><small>Permission: ${x[0]}</small></article>`).join(""):"<div class=staff-empty>No permissions assigned. Ask Super Admin to enable access.</div>";
}
$("staffLogout")?.addEventListener("click",async()=>{await supabase.auth.signOut();location.href="admin/login.html";});
boot().catch(e=>{console.error(e);location.href="admin/login.html";});
