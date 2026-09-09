import { supabase } from './supabase.js';

const ROLE=document.body.dataset.controlRole;
const META={
 manager:{label:'Manager',icon:'🟢',color:'#16a34a',desc:'Manager Control Center — manage Manager staff, access, status and permissions.'},
 operator:{label:'Operator',icon:'🟡',color:'#eab308',desc:'Operator Control Center — manage Operator staff, access, status and permissions.'},
 support:{label:'Support',icon:'🩷',color:'#ec4899',desc:'Support Control Center — manage Support staff, access, status and permissions.'}
};
const meta=META[ROLE];
const SUPER_ADMIN_EMAIL='sumitkhobragade088@gmail.com';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const PERMS=[
['dashboard.view','Dashboard — View'],['applications','Applications — Access'],['applications.view','Applications — View'],['applications.create','Applications — Create'],['applications.update','Applications — Update'],['applications.delete','Applications — Delete'],['applications.delete_all','Applications — Delete All'],
['users','Users — Access'],['users.view','Users — View'],['users.manage','Users — Manage'],['services','Services — Access'],['services.view','Services — View'],['services.manage','Services — Manage'],
['payments','Payments — Access'],['payments.view','Payments — View'],['payments.manage','Payments — Manage'],['revenue','Revenue — Access'],['revenue.view','Revenue — View'],['revenue.delete','Revenue — Delete'],['revenue.delete_all','Revenue — Delete All'],
['youtube','YouTube — Access'],['youtube.reporting','YouTube Reporting'],['youtube.live_streaming','YouTube Live Streaming'],['youtube.live_chat','YouTube Live Chat'],['youtube.embedded_player','YouTube Embedded Player'],['youtube.oembed','YouTube oEmbed'],
['website_cms.view','Website CMS — View'],['website_cms.manage','Website CMS — Manage'],['cms','Admin Dashboard CMS'],['audit','Audit Log — Access'],['audit.view','Audit Log — View'],['audit.delete','Audit Log — Delete'],['audit.delete_all','Audit Log — Delete All'],
['trash','Trash — Access'],['trash.view','Trash — View'],['trash.restore','Trash — Restore'],['trash.permanent_delete','Trash — Permanent Delete'],['trash.empty','Trash — Empty'],['global_search.use','Global Search'],['search','Search'],['system_health.view','System Health'],['health','Health'],
['notifications.view','Notifications — View'],['notifications.manage','Notifications — Manage'],['profile.view','Profile — View'],['settings','Settings'],['export','Export / Download']
];
let existing=new Set();
function msg(t,ok=false){const e=$('message');if(e){e.textContent=t;e.className='sa-message '+(ok?'ok':'bad')}}
async function getSuperAdmin(){
 const {data:{session}}=await supabase.auth.getSession(); const user=session?.user;
 if(!user) throw new Error('Admin session not found. Please sign in again.');
 const {data:admin,error}=await supabase.from('admin_users').select('id,email,status').eq('id',user.id).maybeSingle();
 if(error) throw new Error('Unable to verify Admin access: '+error.message);
 if(!admin) throw new Error('This account is not authorized as an Admin.');
 if(String(admin.status||'active').toLowerCase()!=='active') throw new Error('Admin account is not active.');
 const email=String(admin.email||user.email||'').toLowerCase();
 if(email!==SUPER_ADMIN_EMAIL.toLowerCase() && sessionStorage.getItem('yt_admin_role')!=='super_admin') throw new Error('Only Super Admin can manage staff roles.');
 return {user,admin};
}
function wireSidebar(){
 document.querySelectorAll('[data-admin-nav]').forEach(b=>b.addEventListener('click',()=>location.href='index.html'));
 document.querySelector('[data-role-current]')?.addEventListener('click',e=>e.stopPropagation());
 $('logout')?.addEventListener('click',async()=>{await supabase.auth.signOut();location.href='login.html'});
 $('refresh')?.addEventListener('click',()=>load().catch(e=>msg(e.message)));
 $('backAdmin')?.addEventListener('click',()=>location.href='index.html');
 $('staffDashboard')?.addEventListener('click',()=>location.href=`../staff-${ROLE}.html`);
}
async function load(){
 if(!meta) throw new Error('Invalid staff control role.');
 const {admin}=await getSuperAdmin();
 $('adminEmail').textContent=admin.email||'';
 $('roleTitle').textContent=`${meta.icon} ${meta.label} Control Center`;
 $('roleDesc').textContent=meta.desc;
 document.documentElement.style.setProperty('--sa-primary',meta.color);
 const [{data:roles,error:re},{data:perms,error:pe},{data:users,error:ue},{data:rp,error:rpe}]=await Promise.all([
  supabase.from('admin_staff_roles').select('admin_id,role,status,created_at,updated_at').eq('role',ROLE).order('created_at',{ascending:false}),
  supabase.from('admin_permissions').select('permission_key,label').order('permission_key'),
  supabase.from('admin_users').select('id,email,status,created_at').order('email'),
  supabase.from('admin_role_permissions').select('permission_key').eq('role',ROLE)
 ]);
 if(re) throw new Error('Unable to load staff: '+re.message); if(ue) throw new Error('Unable to load staff accounts: '+ue.message); if(rpe) throw new Error('Unable to load permissions: '+rpe.message);
 const map=new Map((users||[]).map(u=>[u.id,u])); const rows=(roles||[]).map(r=>({...r,user:map.get(r.admin_id)||{}}));
 $('staffCount').textContent=rows.length; $('activeCount').textContent=rows.filter(r=>String(r.status||'').toLowerCase()==='active').length;
 existing=new Set((rp||[]).map(x=>x.permission_key));
 const catalog=new Map(PERMS); (perms||[]).forEach(p=>catalog.set(p.permission_key,p.label||p.permission_key));
 $('permCount').textContent=[...existing].filter(k=>catalog.has(k)).length;
 renderStaff(rows); renderPerms([...catalog.entries()]);
}
function renderStaff(rows){
 const body=$('staffBody'); body.innerHTML=rows.length?rows.map(r=>`<tr><td><b>${esc(r.user.email||r.admin_id)}</b></td><td><span class="sa-status ${esc(String(r.status||'active').toLowerCase())}">${esc(String(r.status||'active').toUpperCase())}</span></td><td>${r.created_at?new Date(r.created_at).toLocaleString('en-IN'):'—'}</td><td><select class="sa-input" style="min-height:34px;width:auto" data-status="${esc(r.admin_id)}"><option value="active" ${r.status==='active'?'selected':''}>Active</option><option value="inactive" ${r.status==='inactive'?'selected':''}>Inactive</option><option value="suspended" ${r.status==='suspended'?'selected':''}>Suspended</option></select> <button class="sa-btn primary" data-save="${esc(r.admin_id)}">Save</button></td></tr>`).join(''):'<tr><td colspan="4" class="sa-loading">No '+meta.label+' staff assigned.</td></tr>';
 body.querySelectorAll('[data-save]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.save;const status=body.querySelector(`[data-status="${CSS.escape(id)}"]`).value;if(!confirm(`WARNING: Set this ${meta.label} staff account to ${status.toUpperCase()}?`))return;btn.disabled=true;const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:ROLE,p_status:status});btn.disabled=false;if(error)return msg(error.message);msg(`${meta.label} staff status updated.`,true);await load();});
}
function renderPerms(items){
 const box=$('permissionGrid'); box.innerHTML=items.map(([k,l])=>`<label class="sa-perm" data-key="${esc(k)}"><input type="checkbox" data-perm="${esc(k)}" ${existing.has(k)?'checked':''}><span><b>${esc(l)}</b><small>${esc(k)}</small></span></label>`).join('');
 box.querySelectorAll('[data-perm]').forEach(ch=>ch.onchange=async()=>{const key=ch.dataset.perm;ch.disabled=true;const q=ch.checked?supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:key}):supabase.from('admin_role_permissions').delete().eq('role',ROLE).eq('permission_key',key);const {error}=await q;ch.disabled=false;if(error){ch.checked=!ch.checked;return msg(error.message)}existing[ch.checked?'add':'delete'](key);updatePermCount();msg(`${meta.label} permission updated.`,true)});
 updatePermCount();
}
function updatePermCount(){ $('permCount').textContent=document.querySelectorAll('[data-perm]:checked').length; }
async function createStaff(){
 const name=$('staffName').value.trim(),email=$('staffEmail').value.trim(),password=$('staffPassword').value; if(!name||!email||password.length<8)return msg('Name, email and password (minimum 8 characters) are required.');
 const b=$('createStaff');b.disabled=true;msg(`Creating ${meta.label} staff…`);try{const {data,error}=await supabase.functions.invoke('create-admin-staff',{body:{name,email,role:ROLE,password}});if(error)throw error;if(data?.error)throw new Error(data.error);$('staffName').value='';$('staffEmail').value='';$('staffPassword').value='';msg(`${meta.label} staff created successfully.`,true);await load()}catch(e){msg(e.message||'Staff creation failed.')}finally{b.disabled=false}
}
$('createStaff')?.addEventListener('click',createStaff);
$('selectAll')?.addEventListener('click',async()=>{const boxes=[...document.querySelectorAll('[data-perm]:not(:checked)')];if(!boxes.length)return;for(const c of boxes){const {error}=await supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:c.dataset.perm});if(error)return msg(error.message);c.checked=true}updatePermCount();msg(`All available ${meta.label} permissions enabled.`,true)});
$('clearAll')?.addEventListener('click',async()=>{if(!confirm(`WARNING: Remove ALL ${meta.label} permissions?`))return;const {error}=await supabase.from('admin_role_permissions').delete().eq('role',ROLE);if(error)return msg(error.message);document.querySelectorAll('[data-perm]').forEach(c=>c.checked=false);updatePermCount();msg(`All ${meta.label} permissions cleared.`,true)});
$('search')?.addEventListener('input',e=>{const q=e.target.value.toLowerCase().trim();document.querySelectorAll('.sa-perm').forEach(x=>x.hidden=!x.textContent.toLowerCase().includes(q))});
wireSidebar();
load().then(()=>{$('app')?.removeAttribute('hidden')}).catch(e=>{console.error(e);$('app')?.setAttribute('hidden','');$('denied')?.removeAttribute('hidden');$('deniedMessage').textContent=e.message||'Access denied'});
