import { supabase } from "./supabase.js";

const ROLE = document.body.dataset.controlRole;
const ROLE_LABEL = {manager:"Manager", operator:"Operator", support:"Support"}[ROLE] || "Staff";
const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const msg = (t,ok=false)=>{const e=$("message"); if(e){e.textContent=t;e.className=ok?"msg ok":"msg";}};

async function requireSuperAdmin(){
  const {data:{session}} = await supabase.auth.getSession();
  const user=session?.user;
  if(!user){ location.href="login.html"; return null; }
  const {data:admin,error} = await supabase.from("admin_users").select("id,email,status").eq("id",user.id).maybeSingle();
  if(error || !admin || String(admin.status||"active").toLowerCase()!=="active"){
    await supabase.auth.signOut().catch(()=>{});
    location.href="login.html"; return null;
  }
  const {data:staff} = await supabase.from("admin_staff_roles").select("role,status").eq("admin_id",user.id).maybeSingle();
  if(staff?.role!=="super_admin" || String(staff?.status||"").toLowerCase()!=="active"){
    location.href="index.html"; return null;
  }
  return user;
}

async function load(){
  const user=await requireSuperAdmin(); if(!user)return;
  $("roleTitle").textContent=`${ROLE_LABEL} Control`;
  $("roleSub").textContent=`Complete ${ROLE_LABEL} dashboard, staff status and A–Z permission control.`;
  const [staffRes, permRes, rpRes] = await Promise.all([
    supabase.from("admin_staff_roles").select("admin_id,role,status,created_at,updated_at").eq("role",ROLE).order("created_at",{ascending:false}),
    supabase.from("admin_permissions").select("permission_key,label").order("permission_key"),
    supabase.from("admin_role_permissions").select("role,permission_key").eq("role",ROLE)
  ]);
  if(staffRes.error || permRes.error || rpRes.error){
    msg([staffRes.error,permRes.error,rpRes.error].find(Boolean)?.message || "Unable to load control data.");
    return;
  }
  const ids=(staffRes.data||[]).map(x=>x.admin_id);
  let users=[];
  if(ids.length){
    const u=await supabase.from("admin_users").select("id,email,status,created_at").in("id",ids);
    if(u.error){msg(u.error.message);return;}
    users=u.data||[];
  }
  const um=new Map(users.map(x=>[x.id,x]));
  const body=$("staffBody");
  body.innerHTML=(staffRes.data||[]).map(r=>{
    const u=um.get(r.admin_id)||{};
    const st=String(r.status||"active").toLowerCase();
    return `<tr><td><b>${esc(u.email||r.admin_id)}</b></td><td><span class="chip ${st}">${esc(st.toUpperCase())}</span></td><td>${r.updated_at?new Date(r.updated_at).toLocaleString():"-"}</td><td>
      <select data-status="${esc(r.admin_id)}"><option value="active" ${st==="active"?"selected":""}>Active</option><option value="inactive" ${st==="inactive"?"selected":""}>Inactive</option><option value="suspended" ${st==="suspended"?"selected":""}>Suspended</option></select>
      <button class="btn save" data-save="${esc(r.admin_id)}">Save</button>
      <button class="btn danger" data-delete="${esc(r.admin_id)}">Delete Access</button></td></tr>`;
  }).join("") || `<tr><td colspan="4">No ${ROLE_LABEL} staff accounts.</td></tr>`;

  body.querySelectorAll("[data-save]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.save, status=body.querySelector(`[data-status="${CSS.escape(id)}"]`).value;
    if(!confirm(`Change ${ROLE_LABEL} staff status to ${status.toUpperCase()}?`))return;
    const {error}=await supabase.rpc("admin_update_staff",{p_admin_id:id,p_role:ROLE,p_status:status});
    if(error)return msg(error.message);
    msg(`${ROLE_LABEL} staff status updated successfully.`,true); await load();
  });
  body.querySelectorAll("[data-delete]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.delete;
    if(!confirm(`WARNING: Remove this ${ROLE_LABEL} staff access? This cannot be undone from this page.`))return;
    const {error}=await supabase.rpc("admin_remove_staff",{p_admin_id:id});
    if(error)return msg(error.message);
    msg(`${ROLE_LABEL} access removed.`,true); await load();
  });

  const existing=new Set((rpRes.data||[]).map(x=>x.permission_key));
  const grid=$("permissionGrid");
  grid.innerHTML=(permRes.data||[]).map(p=>`<label class="perm" data-key="${esc(p.permission_key)}"><input type="checkbox" data-perm="${esc(p.permission_key)}" ${existing.has(p.permission_key)?"checked":""}><span><b>${esc(p.label||p.permission_key)}</b><small>${esc(p.permission_key)}</small></span></label>`).join("") || "<p>No permissions found.";
  $("count").textContent=String((permRes.data||[]).length);
  grid.querySelectorAll("[data-perm]").forEach(ch=>ch.addEventListener("change",async()=>{
    const key=ch.dataset.perm;
    const q=ch.checked
      ? supabase.from("admin_role_permissions").upsert({role:ROLE,permission_key:key})
      : supabase.from("admin_role_permissions").delete().eq("role",ROLE).eq("permission_key",key);
    const {error}=await q;
    if(error){ch.checked=!ch.checked;msg(error.message);return;}
    msg(`${ROLE_LABEL}: permission updated.`,true);
  }));
  $("selectAll").onclick=()=>grid.querySelectorAll("[data-perm]").forEach(x=>{if(!x.checked){x.checked=true;x.dispatchEvent(new Event("change"));}});
  $("clearAll").onclick=()=>{if(!confirm(`Clear ALL ${ROLE_LABEL} permissions?`))return;grid.querySelectorAll("[data-perm]").forEach(x=>{if(x.checked){x.checked=false;x.dispatchEvent(new Event("change"));}})};
  $("search").oninput=()=>{const q=$("search").value.toLowerCase();grid.querySelectorAll(".perm").forEach(x=>x.hidden=!x.dataset.key.toLowerCase().includes(q));};
}
$("back").onclick=()=>location.href="index.html";
$("logout").onclick=async()=>{await supabase.auth.signOut();location.href="login.html";};
load().catch(e=>{console.error(e);msg(e?.message||"Control page error.");});
