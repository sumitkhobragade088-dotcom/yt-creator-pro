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

async function loadData(){
  const [rolesQ,usersQ,permsQ,rpQ] = await Promise.all([
    supabase.from('admin_staff_roles').select('admin_id,role,status,created_at,updated_at').eq('role',ROLE).order('created_at',{ascending:false}),
    supabase.from('admin_users').select('id,email,status,created_at').order('email'),
    supabase.from('admin_permissions').select('permission_key,label').order('permission_key'),
    supabase.from('admin_role_permissions').select('permission_key').eq('role',ROLE)
  ]);
  const firstError=rolesQ.error||usersQ.error||permsQ.error||rpQ.error;
  if(firstError) throw new Error(firstError.message);

  const roles=rolesQ.data||[];
  const users=new Map((usersQ.data||[]).map(x=>[x.id,x]));
  allPermissions=permsQ.data||[];
  const enabled=new Set((rpQ.data||[]).map(x=>x.permission_key));
  renderStats(roles.length,roles.filter(x=>String(x.status||'').toLowerCase()==='active').length,enabled.size);

  $('staffRows').innerHTML=roles.length ? roles.map(r=>{
    const u=users.get(r.admin_id)||{};
    return `<tr><td><b>${esc(u.email||r.admin_id)}</b></td><td>${statusChip(r.status)}</td><td>${dateText(r.updated_at||r.created_at)}</td><td><div class="sac-toolbar"><select class="sac-select" style="width:auto" data-status="${esc(r.admin_id)}"><option value="active" ${String(r.status).toLowerCase()==='active'?'selected':''}>Active</option><option value="inactive" ${String(r.status).toLowerCase()==='inactive'?'selected':''}>Inactive</option><option value="suspended" ${String(r.status).toLowerCase()==='suspended'?'selected':''}>Suspended</option></select><button class="sac-btn primary" data-save="${esc(r.admin_id)}">Save</button><button class="sac-btn danger" data-delete="${esc(r.admin_id)}">Delete</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="4"><div class="sac-empty">No ${esc(meta.label)} staff accounts found. Create the first ${esc(meta.label)} account below.</div></td></tr>`;

  $('staffRows').querySelectorAll('[data-save]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.save;
    if(id===currentUser?.id) return setMessage('Your Super Admin account is protected.');
    const status=$(`[data-status="${CSS.escape(id)}"]`).value;
    btn.disabled=true;
    const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:ROLE,p_status:status});
    btn.disabled=false;
    if(error) return setMessage(error.message);
    setMessage(`${meta.label} status updated successfully.`,true);
    await loadData();
  });

  $('staffRows').querySelectorAll('[data-delete]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.delete;
    if(id===currentUser?.id) return setMessage('Your Super Admin account is protected.');
    if(!confirm(`Delete ${meta.label} staff access? This removes the staff record.`)) return;
    btn.disabled=true;
    const {error}=await supabase.rpc('admin_remove_staff',{p_admin_id:id});
    btn.disabled=false;
    if(error) return setMessage(error.message);
    setMessage(`${meta.label} staff access deleted.`,true);
    await loadData();
  });

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
  }catch(e){setMessage(e?.message||'Staff creation failed.')}finally{btn.disabled=false;}
};
$('refresh').onclick=async()=>{try{await loadData();setMessage('Control center refreshed.',true);}catch(e){setMessage(e.message);}};
$('adminBtn').onclick=()=>location.href='index.html';
$('logout').onclick=async()=>{await supabase.auth.signOut();location.href='login.html';};

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
