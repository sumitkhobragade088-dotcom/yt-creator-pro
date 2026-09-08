import { supabase } from './supabase.js';

const ROLE=document.body.dataset.controlRole;
const LABEL={manager:'Manager',operator:'Operator',support:'Support'}[ROLE]||'Staff';
const ICON={manager:'🟢',operator:'🟡',support:'🩷'}[ROLE]||'👤';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const PERMISSIONS=[
 ['dashboard.view','Dashboard'],['applications','Applications'],['applications.view','Applications — View'],['applications.create','Applications — Create'],['applications.update','Applications — Update'],['applications.delete','Applications — Delete'],['applications.delete_all','Applications — Delete All'],
 ['users','Users'],['users.view','Users — View'],['users.manage','Users — Manage'],['services','Services'],['services.view','Services — View'],['services.manage','Services — Manage'],
 ['payments','Payments'],['payments.view','Payments — View'],['payments.manage','Payments — Manage'],['revenue','Revenue'],['revenue.view','Revenue — View'],['revenue.delete','Revenue — Delete'],['revenue.delete_all','Revenue — Delete All'],
 ['youtube','YouTube'],['youtube.reporting','YouTube Reporting'],['youtube.live_streaming','YouTube Live Streaming'],['youtube.live_chat','YouTube Live Chat'],['youtube.embedded_player','YouTube Embedded Player'],['youtube.oembed','YouTube oEmbed'],
 ['website_cms.view','Website CMS — View'],['website_cms.manage','Website CMS — Manage'],['cms','Admin Dashboard CMS'],['audit','Audit Log'],['audit.view','Audit Log — View'],['audit.delete','Audit Log — Delete'],['audit.delete_all','Audit Log — Delete All'],
 ['trash','Trash'],['trash.view','Trash — View'],['trash.restore','Trash — Restore'],['trash.permanent_delete','Trash — Permanent Delete'],['trash.empty','Trash — Empty'],['global_search.use','Global Search'],['search','Search'],['system_health.view','System Health'],['health','Health'],
 ['notifications.view','Notifications'],['notifications.manage','Notifications — Manage'],['profile.view','Profile'],['settings','Settings'],['export','Export / Download']
];

let existing=new Set();

async function requireSuperAdmin(){
  const {data:{session}}=await supabase.auth.getSession();
  const user=session?.user;
  if(!user){
    show('Admin session not found. Please sign in again.');
    return null;
  }

  const {data:admin,error}=await supabase
    .from('admin_users')
    .select('id,email,status')
    .eq('id',user.id)
    .maybeSingle();

  if(error){
    console.error('Admin authorization query failed:',error);
    show('Unable to verify Admin access: '+error.message);
    return null;
  }

  if(!admin){
    show('This account is not authorized as an Admin.');
    return null;
  }

  const adminStatus=String(admin.status||'active').trim().toLowerCase();
  if(adminStatus!=='active'){
    show(`Admin account is ${adminStatus.toUpperCase()}. Access is blocked.`);
    return null;
  }

  // The same Super Admin identity used by the existing Admin Login is allowed.
  // If a role record exists, it must explicitly be super_admin.
  const {data:staff,error:staffError}=await supabase
    .from('admin_staff_roles')
    .select('role,status')
    .eq('admin_id',user.id)
    .maybeSingle();

  if(staffError){
    console.warn('Optional staff-role lookup failed:',staffError.message);
  }

  const role=String(staff?.role||'').toLowerCase();
  if(role && role!=='super_admin'){
    show('Only Super Admin can manage staff roles.');
    return null;
  }

  const isKnownSuperAdmin=String(admin.email||'').toLowerCase()==='sumitkhobragade088@gmail.com'
    || role==='super_admin'
    || sessionStorage.getItem('yt_admin_role')==='super_admin';

  if(!isKnownSuperAdmin){
    show('Only Super Admin can manage staff roles.');
    return null;
  }

  $('adminEmail').textContent=admin.email||user.email||'';
  return user;
}

async function load(){
 const user=await requireSuperAdmin(); if(!user)return;
 $('pageTitle').textContent=`${ICON} ${LABEL} Control`;
 $('pageSubtitle').textContent=`Complete ${LABEL} staff control. Configure exactly what ${LABEL} staff can access.`;
 const [{data:roles,error:re},{data:perms,error:pe}]=await Promise.all([
   supabase.from('admin_staff_roles').select('admin_id,role,status,created_at,updated_at').eq('role',ROLE).order('created_at'),
   supabase.from('admin_permissions').select('permission_key,label').order('permission_key')
 ]);
 if(re){show('Unable to load staff roles: '+re.message);return;}
 const {data:users}=await supabase.from('admin_users').select('id,email,status,created_at').order('email');
 const map=new Map((users||[]).map(x=>[x.id,x]));
 const staff=(roles||[]).map(r=>({...r,user:map.get(r.admin_id)||{}}));
 $('staffCount').textContent=staff.length;
 $('activeCount').textContent=staff.filter(x=>String(x.status||'').toLowerCase()==='active').length;
 renderStaff(staff);
 const catalog=(perms&&perms.length?perms.map(x=>[x.permission_key,x.label||x.permission_key]):PERMISSIONS);
 const available=new Map(catalog);
 PERMISSIONS.forEach(([k,l])=>{if(!available.has(k))available.set(k,l);});
 const {data:rp}=await supabase.from('admin_role_permissions').select('permission_key').eq('role',ROLE);
 existing=new Set((rp||[]).map(x=>x.permission_key));
 renderPerms([...available.entries()]);
}

function renderStaff(staff){
 const body=$('staffBody');
 body.innerHTML=staff.length?staff.map(x=>`<tr><td><b>${esc(x.user.email||x.admin_id)}</b></td><td><span class="status ${String(x.status).toLowerCase()}">${esc(String(x.status||'active').toUpperCase())}</span></td><td>${x.created_at?new Date(x.created_at).toLocaleString('en-IN'): '-'}</td><td><select data-status="${esc(x.admin_id)}"><option value="active" ${x.status==='active'?'selected':''}>Active</option><option value="inactive" ${x.status==='inactive'?'selected':''}>Inactive</option><option value="suspended" ${x.status==='suspended'?'selected':''}>Suspended</option></select><button class="save" data-save="${esc(x.admin_id)}">Save</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">No '+LABEL+' staff assigned.</td></tr>';
 body.querySelectorAll('[data-save]').forEach(btn=>btn.onclick=async()=>{
   const id=btn.dataset.save,status=body.querySelector(`[data-status="${CSS.escape(id)}"]`).value;
   if(!confirm(`Change ${LABEL} staff status to ${status.toUpperCase()}?`))return;
   const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:ROLE,p_status:status});
   if(error){alert(error.message);return;}
   await load();
 });
}

function renderPerms(items){
 const box=$('permissionGrid');
 box.innerHTML=items.map(([key,label])=>`<label class="perm" data-key="${esc(key)}"><input type="checkbox" data-perm="${esc(key)}" ${existing.has(key)?'checked':''}><span>${esc(label)}</span><small>${esc(key)}</small></label>`).join('');
 box.querySelectorAll('[data-perm]').forEach(ch=>ch.onchange=async()=>{
   const key=ch.dataset.perm;
   const q=ch.checked?supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:key}):supabase.from('admin_role_permissions').delete().eq('role',ROLE).eq('permission_key',key);
   const {error}=await q;
   if(error){ch.checked=!ch.checked;alert(error.message);return;}
   existing[ ch.checked?'add':'delete'](key);
   updateCount();
 });
 updateCount();
}
function updateCount(){ $('permCount').textContent=document.querySelectorAll('[data-perm]:checked').length; }
function show(msg){$('message').textContent=msg;$('message').classList.add('show');}

$('search')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase();document.querySelectorAll('.perm').forEach(x=>x.hidden=!x.dataset.key.toLowerCase().includes(q)||!x.textContent.toLowerCase().includes(q));});
$('selectAll')?.addEventListener('click',()=>{document.querySelectorAll('[data-perm]').forEach(x=>{if(!x.checked){x.click();}});});
$('clearAll')?.addEventListener('click',()=>{if(!confirm(`WARNING: Remove every ${LABEL} permission?`))return;document.querySelectorAll('[data-perm]:checked').forEach(x=>x.click());});
$('backAdmin')?.addEventListener('click',()=>{location.href='index.html';});
$('refresh')?.addEventListener('click',load);
load().catch(e=>{console.error(e);show(e.message||'Unable to load control panel.');});
