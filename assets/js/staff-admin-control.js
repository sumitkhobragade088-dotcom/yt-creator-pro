import { supabase } from './supabase.js';

const ROLE = String(document.body.dataset.role || '').toLowerCase();
const META = {
  manager:{label:'Manager',color:'#16a34a',icon:'🟢'},
  operator:{label:'Operator',color:'#eab308',icon:'🟡'},
  support:{label:'Support',color:'#ec4899',icon:'🩷'}
};
const meta = META[ROLE];
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let currentUser = null;
let allPermissions = [];
let staffCache = new Map();

function setMessage(text, good=false){
  const e=$('sacMessage');
  if(e){e.textContent=text;e.className=`sac-message ${good?'good':'bad'}`;}
}
function dateText(v){return v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'-';}
function statusChip(v){const s=String(v||'inactive').toLowerCase();return `<span class="sac-status ${esc(s)}">${esc(s)}</span>`;}

async function isSuperAdmin(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user) return false;
  currentUser=session.user;
  const {data,error}=await supabase.rpc('yt_is_super_admin');
  if(!error && data===true) return true;
  const {data:u,error:ue}=await supabase.from('admin_users').select('id,email,status').eq('id',session.user.id).maybeSingle();
  if(ue||!u) return false;
  return String(u.status||'active').toLowerCase()==='active' && String(u.email||'').toLowerCase()==='sumitkhobragade088@gmail.com';
}

function renderStats(total,active,enabled){
  $('staffCount').textContent=total;
  $('activeCount').textContent=active;
  $('permCount').textContent=enabled;
  document.documentElement.style.setProperty('--sac-primary',meta.color);
}

function openUserModal(id){
  const r=staffCache.get(id); if(!r) return;
  const u=r.user||{}, p=r.profile||{};
  $('sacUserModalBody').innerHTML=`
    <div class="sac-detail-grid">
      <div><small>Full Name</small><b>${esc(p.full_name||u.user_metadata?.full_name||'Not set')}</b></div>
      <div><small>Email</small><b>${esc(u.email||r.email||'-')}</b></div>
      <div><small>Role</small><b>${esc(r.role||ROLE)}</b></div>
      <div><small>Status</small><b>${statusChip(r.status)}</b></div>
      <div><small>Auth User ID</small><b>${esc(r.admin_id)}</b></div>
      <div><small>Created</small><b>${dateText(r.created_at||u.created_at)}</b></div>
      <div><small>Updated</small><b>${dateText(r.updated_at)}</b></div>
      <div><small>Invite Status</small><b>${esc(p.invite_status||'active')}</b></div>
    </div>`;
  $('sacUserModal').hidden=false;
}
function closeUserModal(){if($('sacUserModal'))$('sacUserModal').hidden=true;}

async function resetStaffPassword(id){
  const r=staffCache.get(id); if(!r) return;
  const email=String(r.user?.email||r.email||'').trim();
  if(!email) return setMessage('This staff account has no email address.');
  const redirectTo=new URL('../reset-password.html',location.href).href;
  if(!confirm(`Send a secure password reset link to ${email}?`)) return;
  const btn=document.querySelector(`[data-reset="${CSS.escape(id)}"]`); if(btn)btn.disabled=true;
  try{
    const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo});
    if(error) throw error;
    setMessage(`Secure reset link sent to ${email}.`,true);
  }catch(e){setMessage(e?.message||'Password reset link could not be sent.');}
  finally{if(btn)btn.disabled=false;}
}

async function quickStatus(id,status){
  if(id===currentUser?.id) return setMessage('Your Super Admin account is protected.');
  const btn=document.querySelector(`[data-quick-status="${CSS.escape(id)}-${status}"]`); if(btn)btn.disabled=true;
  const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:ROLE,p_status:status});
  if(error){if(btn)btn.disabled=false;return setMessage(error.message);}
  setMessage(`${meta.label} staff ${status==='active'?'enabled':'disabled'} successfully.`,true);
  await loadData();
}

async function deleteStaff(id){
  if(id===currentUser?.id) return setMessage('Your Super Admin account is protected.');
  const r=staffCache.get(id); if(!r) return;
  const email=r.user?.email||r.email||id;
  if(!confirm(`DELETE ${meta.label} staff user ${email}?\n\nThis permanently removes the staff Auth account and its Admin/Staff access. Continue?`)) return;
  const btn=document.querySelector(`[data-delete="${CSS.escape(id)}"]`); if(btn)btn.disabled=true;
  try{
    const {data,error}=await supabase.functions.invoke('delete-admin-staff',{body:{admin_id:id}});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    setMessage(`${meta.label} staff user deleted successfully.`,true);
    await loadData();
  }catch(e){
    // Fallback keeps the existing access-delete RPC working when the optional Auth-delete function is not deployed.
    const {error:rpcError}=await supabase.rpc('admin_remove_staff',{p_admin_id:id});
    if(rpcError){setMessage(e?.message||rpcError.message);}
    else{setMessage(`${meta.label} staff access deleted. Auth account was not removed because the Auth-delete function is not deployed.`,true);await loadData();}
  }finally{if(btn)btn.disabled=false;}
}

async function saveStaff(id){
  if(id===currentUser?.id) return setMessage('Your Super Admin account is protected.');
  const role=$(`[data-role="${CSS.escape(id)}"]`)?.value||ROLE;
  const status=$(`[data-status="${CSS.escape(id)}"]`)?.value||'active';
  const btn=document.querySelector(`[data-save="${CSS.escape(id)}"]`); if(btn)btn.disabled=true;
  const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:role,p_status:status});
  if(btn)btn.disabled=false;
  if(error) return setMessage(error.message);
  setMessage(`${meta.label} staff changes saved successfully.`,true);
  await loadData();
}

async function loadData(){
  const [rolesQ,usersQ,permsQ,rpQ,profilesQ] = await Promise.all([
    supabase.from('admin_staff_roles').select('admin_id,role,status,created_at,updated_at').eq('role',ROLE).order('created_at',{ascending:false}),
    supabase.from('admin_users').select('id,email,status,created_at').order('email'),
    supabase.from('admin_permissions').select('permission_key,label').order('permission_key'),
    supabase.from('admin_role_permissions').select('permission_key').eq('role',ROLE),
    supabase.from('admin_staff_profiles').select('admin_id,full_name,invited_email,invite_status,invited_at,updated_at')
  ]);
  const firstError=rolesQ.error||usersQ.error||permsQ.error||rpQ.error;
  if(firstError) throw new Error(firstError.message);

  const roles=rolesQ.data||[];
  const users=new Map((usersQ.data||[]).map(x=>[x.id,x]));
  const profiles=new Map((profilesQ.data||[]).map(x=>[x.admin_id,x]));
  allPermissions=permsQ.data||[];
  const enabled=new Set((rpQ.data||[]).map(x=>x.permission_key));
  renderStats(roles.length,roles.filter(x=>String(x.status||'').toLowerCase()==='active').length,enabled.size);
  staffCache=new Map();
  roles.forEach(r=>staffCache.set(r.admin_id,{...r,user:users.get(r.admin_id)||{},profile:profiles.get(r.admin_id)||{}}));

  $('staffRows').innerHTML=roles.length ? roles.map(r=>{
    const u=users.get(r.admin_id)||{}, p=profiles.get(r.admin_id)||{};
    const status=String(r.status||'inactive').toLowerCase();
    return `<tr>
      <td><b>${esc(p.full_name||u.user_metadata?.full_name||u.email||r.admin_id)}</b><small style="display:block;color:#667085">${esc(u.email||p.invited_email||'')}</small></td>
      <td>${statusChip(status)}</td>
      <td>${dateText(r.updated_at||r.created_at)}</td>
      <td><div class="sac-toolbar">
        <button class="sac-btn" data-view="${esc(r.admin_id)}">👁️ View User</button>
        <button class="sac-btn" data-reset="${esc(r.admin_id)}">🔑 Reset Password</button>
        <button class="sac-btn" data-quick-status="${esc(r.admin_id)}-${status==='active'?'inactive':'active'}">${status==='active'?'🚫 Disable':'✅ Enable'}</button>
        <select class="sac-select" style="width:auto" data-status="${esc(r.admin_id)}"><option value="active" ${status==='active'?'selected':''}>Active</option><option value="inactive" ${status==='inactive'?'selected':''}>Inactive</option><option value="suspended" ${status==='suspended'?'selected':''}>Suspended</option></select>
        <select class="sac-select" style="width:auto" data-role="${esc(r.admin_id)}"><option value="manager" ${r.role==='manager'?'selected':''}>Manager</option><option value="operator" ${r.role==='operator'?'selected':''}>Operator</option><option value="support" ${r.role==='support'?'selected':''}>Support</option></select>
        <button class="sac-btn primary" data-save="${esc(r.admin_id)}">💾 Save</button>
        <button class="sac-btn danger" data-delete="${esc(r.admin_id)}">🗑️ Delete User</button>
      </div></td></tr>`;
  }).join('') : `<tr><td colspan="4"><div class="sac-empty">No ${esc(meta.label)} staff accounts found. Create the first ${esc(meta.label)} account below.</div></td></tr>`;

  $('staffRows').querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>openUserModal(b.dataset.view));
  $('staffRows').querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>resetStaffPassword(b.dataset.reset));
  $('staffRows').querySelectorAll('[data-quick-status]').forEach(b=>{const [id,status]=b.dataset.quickStatus.split(/-(?=[^-]+$)/);b.onclick=()=>quickStatus(id,status);});
  $('staffRows').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>saveStaff(b.dataset.save));
  $('staffRows').querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteStaff(b.dataset.delete));

  $('permissionGrid').innerHTML=allPermissions.length ? allPermissions.map(p=>`<label class="sac-perm" data-key="${esc(p.permission_key)}"><input type="checkbox" data-perm="${esc(p.permission_key)}" ${enabled.has(p.permission_key)?'checked':''}><span><b>${esc(p.label||p.permission_key)}</b><small>${esc(p.permission_key)}</small></span></label>`).join('') : '<div class="sac-empty">Permission catalog is empty.</div>';
  $('permissionGrid').querySelectorAll('[data-perm]').forEach(ch=>ch.onchange=async()=>{
    const key=ch.dataset.perm; ch.disabled=true;
    const result=ch.checked ? await supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:key}) : await supabase.from('admin_role_permissions').delete().eq('role',ROLE).eq('permission_key',key);
    ch.disabled=false;
    if(result.error){ch.checked=!ch.checked;return setMessage(result.error.message);}
    $('permCount').textContent=$('permissionGrid').querySelectorAll('input:checked').length;
    setMessage(`${meta.label} permission updated.`,true);
  });
  $('selectAll').onclick=async()=>{
    const boxes=[...$('permissionGrid').querySelectorAll('input[data-perm]:not(:checked)')];
    for(const ch of boxes){const {error}=await supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:ch.dataset.perm});if(error)return setMessage(error.message);}
    setMessage(`${meta.label}: all available permissions enabled.`,true); await loadData();
  };
  $('clearAll').onclick=async()=>{
    if(!confirm(`Clear every ${meta.label} permission?`)) return;
    const {error}=await supabase.from('admin_role_permissions').delete().eq('role',ROLE);
    if(error) return setMessage(error.message);
    setMessage(`${meta.label}: all permissions cleared.`,true); await loadData();
  };
  $('permSearch').oninput=e=>{const q=e.target.value.toLowerCase().trim();$('permissionGrid').querySelectorAll('[data-key]').forEach(x=>x.hidden=!x.dataset.key.toLowerCase().includes(q));};
}

$('createStaff').onclick=async()=>{
  const name=$('staffName').value.trim(),email=$('staffEmail').value.trim(),password=$('staffPassword').value;
  if(!name||!email||password.length<8)return setMessage('Name, email and password (minimum 8 characters) are required.');
  const btn=$('createStaff');btn.disabled=true;setMessage(`Creating ${meta.label} staff…`);
  try{
    const {data,error}=await supabase.functions.invoke('create-admin-staff',{body:{name,email,role:ROLE,password}});
    if(error)throw error;if(data?.error)throw new Error(data.error);
    $('staffName').value='';$('staffEmail').value='';$('staffPassword').value='';setMessage(`${meta.label} staff created successfully.`,true);await loadData();
  }catch(e){setMessage(e?.message||'Staff creation failed. Make sure the create-admin-staff Edge Function is deployed.')}finally{btn.disabled=false;}
};
$('refresh').onclick=async()=>{try{await loadData();setMessage('Control center refreshed.',true);}catch(e){setMessage(e.message);}};
$('adminBtn').onclick=()=>location.href='index.html';
$('logout').onclick=async()=>{await supabase.auth.signOut();location.href='login.html';};
$('sacUserModalClose')?.addEventListener('click',closeUserModal);
$('sacUserModal')?.addEventListener('click',e=>{if(e.target.id==='sacUserModal')closeUserModal();});

document.addEventListener('DOMContentLoaded',async()=>{
  try{
    if(!meta) throw new Error('Invalid staff role.');
    if(!(await isSuperAdmin())) throw new Error('Only Super Admin can open this control center.');
    await loadData();
  }catch(e){
    const box=$('bootErrorBox'); const msgEl=$('bootError');
    if(msgEl)msgEl.textContent=e?.message||'Unable to load control center.';
    if(box)box.hidden=false;
  }
});
