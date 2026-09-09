import { supabase } from './supabase.js';

const ROLE = document.body.dataset.role;
const META = {
  manager:{label:'Manager',color:'#16a34a',icon:'🟢',desc:'Manage Manager staff access, status and the permissions available to Manager users.'},
  operator:{label:'Operator',color:'#eab308',icon:'🟡',desc:'Manage Operator staff access, status and the permissions available to Operator users.'},
  support:{label:'Support',color:'#ec4899',icon:'🩷',desc:'Manage Support staff access, status and the permissions available to Support users.'}
};
const meta=META[ROLE];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let currentUser=null, permissions=[];

function msg(text,good=false){const e=$('sacMessage');if(e){e.textContent=text;e.className='sac-message '+(good?'good':'bad')}}
function statusChip(s){const x=String(s||'inactive').toLowerCase();return `<span class="sac-status ${esc(x)}">${esc(x)}</span>`}
function dateText(v){return v?new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}):'-'}
function setStats(total,active,enabled){$('staffCount').textContent=total;$('activeCount').textContent=active;$('permCount').textContent=enabled;$('roleTitle').textContent=`${meta.label} Control Center`;$('roleDesc').textContent=meta.desc;document.documentElement.style.setProperty('--sac-primary',meta.color)}

async function requireSuperAdmin(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user) throw new Error('Admin session not found.');
  const [{data:u,error:ue},{data:r,error:re}]=await Promise.all([
    supabase.from('admin_users').select('id,email,status').eq('id',session.user.id).maybeSingle(),
    supabase.from('admin_staff_roles').select('role,status').eq('admin_id',session.user.id).maybeSingle()
  ]);
  if(ue||!u) throw new Error('Admin account could not be verified.');
  if(String(u.status||'active').toLowerCase()!=='active') throw new Error('Admin account is not active.');
  if(re||r?.role!=='super_admin'||String(r?.status||'').toLowerCase()!=='active') throw new Error('Only Super Admin can open this control center.');
  currentUser=session.user;
}

async function load(){
  const [{data:roles,error:re},{data:users,error:ue},{data:perms,error:pe},{data:rp,error:rpe}]=await Promise.all([
    supabase.from('admin_staff_roles').select('admin_id,role,status,created_at,updated_at').eq('role',ROLE).order('created_at',{ascending:false}),
    supabase.from('admin_users').select('id,email,status,created_at').order('email'),
    supabase.from('admin_permissions').select('permission_key,label').order('permission_key'),
    supabase.from('admin_role_permissions').select('role,permission_key').eq('role',ROLE)
  ]);
  if(re||ue||pe||rpe) throw new Error((re||ue||pe||rpe)?.message||'Control data could not be loaded.');
  permissions=perms||[];
  const map=new Map((users||[]).map(x=>[x.id,x]));
  const rows=roles||[]; const active=rows.filter(x=>String(x.status||'').toLowerCase()==='active').length;
  setStats(rows.length,active,(rp||[]).length);
  $('staffRows').innerHTML=rows.length?rows.map(r=>{const u=map.get(r.admin_id)||{};return `<tr><td><b>${esc(u.email||r.admin_id)}</b></td><td>${statusChip(r.status)}</td><td>${dateText(r.updated_at||r.created_at)}</td><td><div class="sac-toolbar"><select class="sac-select" style="width:auto" data-status="${esc(r.admin_id)}"><option value="active" ${r.status==='active'?'selected':''}>Active</option><option value="inactive" ${r.status==='inactive'?'selected':''}>Inactive</option><option value="suspended" ${r.status==='suspended'?'selected':''}>Suspended</option></select><button class="sac-btn primary" data-save="${esc(r.admin_id)}">Save</button><button class="sac-btn danger" data-delete="${esc(r.admin_id)}">Delete</button></div></td></tr>`}).join(''):`<tr><td colspan="4"><div class="sac-empty">No ${meta.label} staff accounts found. Create the first ${meta.label} account below.</div></td></tr>`;
  $('staffRows').querySelectorAll('[data-save]').forEach(b=>b.onclick=async()=>{const id=b.dataset.save;if(id===currentUser.id)return msg('Your Super Admin account is protected.');const status=$(`[data-status="${CSS.escape(id)}"]`).value;b.disabled=true;const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:ROLE,p_status:status});b.disabled=false;if(error)return msg(error.message);msg(`${meta.label} status updated successfully.`,true);await load();});
  $('staffRows').querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const id=b.dataset.delete;if(id===currentUser.id)return msg('Your Super Admin account is protected.');if(!confirm(`Delete ${meta.label} staff access? This removes the admin staff record.`))return;b.disabled=true;const {error}=await supabase.rpc('admin_remove_staff',{p_admin_id:id});b.disabled=false;if(error)return msg(error.message);msg(`${meta.label} staff access deleted.`,true);await load();});
  const existing=new Set((rp||[]).map(x=>x.permission_key));
  $('permissionGrid').innerHTML=permissions.map(p=>`<label class="sac-perm" data-key="${esc(p.permission_key)}"><input type="checkbox" data-perm="${esc(p.permission_key)}" ${existing.has(p.permission_key)?'checked':''}><span><b>${esc(p.label||p.permission_key)}</b><small>${esc(p.permission_key)}</small></span></label>`).join('')||'<div class="sac-empty">Permission catalog is empty.</div>';
  $('permissionGrid').querySelectorAll('[data-perm]').forEach(ch=>ch.onchange=async()=>{const key=ch.dataset.perm;ch.disabled=true;const q=ch.checked?supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:key}):supabase.from('admin_role_permissions').delete().eq('role',ROLE).eq('permission_key',key);const {error}=await q;ch.disabled=false;if(error){ch.checked=!ch.checked;return msg(error.message)}msg(`${meta.label} permission updated.`,true);$('permCount').textContent=$('permissionGrid').querySelectorAll('input:checked').length;});
  $('selectAll').onclick=async()=>{const boxes=[...$('permissionGrid').querySelectorAll('input[data-perm]:not(:checked)')];if(!boxes.length)return;for(const ch of boxes){ch.checked=true;const {error}=await supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:ch.dataset.perm});if(error){ch.checked=false;msg(error.message);break}}msg(`${meta.label}: all available permissions enabled.`,true);await load();};
  $('clearAll').onclick=async()=>{if(!confirm(`Clear every ${meta.label} permission?`))return;const {error}=await supabase.from('admin_role_permissions').delete().eq('role',ROLE);if(error)return msg(error.message);msg(`${meta.label}: all permissions cleared.`,true);await load();};
  $('permSearch').oninput=e=>{const q=e.target.value.toLowerCase().trim();$('permissionGrid').querySelectorAll('[data-key]').forEach(x=>x.hidden=!x.dataset.key.toLowerCase().includes(q));};
}

$('createStaff').onclick=async()=>{
  const name=$('staffName').value.trim(),email=$('staffEmail').value.trim(),password=$('staffPassword').value;
  if(!name||!email||password.length<8)return msg('Name, email and password (minimum 8 characters) are required.');
  const b=$('createStaff');b.disabled=true;msg(`Creating ${meta.label} staff…`);
  try{const {data,error}=await supabase.functions.invoke('create-admin-staff',{body:{name,email,role:ROLE,password}});if(error)throw error;if(data?.error)throw new Error(data.error);$('staffName').value='';$('staffEmail').value='';$('staffPassword').value='';msg(`${meta.label} staff created successfully.`,true);await load();}catch(e){msg(e?.message||'Staff creation failed.')}finally{b.disabled=false;}
};
$('refresh').onclick=async()=>{try{await load();msg('Control center refreshed.',true)}catch(e){msg(e.message)}};
$('dashboardBtn').onclick=()=>location.href=`staff-${ROLE}.html`;
$('adminBtn').onclick=()=>location.href='index.html';
$('logout').onclick=async()=>{await supabase.auth.signOut();location.href='login.html'};

(async()=>{try{await requireSuperAdmin();await load();$('page').hidden=false}catch(e){document.getElementById('bootError').textContent=e?.message||'Access denied';document.getElementById('bootErrorBox').hidden=false}})();
