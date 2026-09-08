import { supabase } from './supabase.js';

const ROLE = document.body.dataset.role;
const META = {
  manager: {label:'Manager',icon:'🟢',accent:'#16a34a',desc:'Management-level control. Super Admin decides every module and action available to Managers.'},
  operator:{label:'Operator',icon:'🟡',accent:'#ca8a04',desc:'Operational control. Super Admin decides every module and action available to Operators.'},
  support:{label:'Support',icon:'🩷',accent:'#db2777',desc:'Customer/support control. Super Admin decides every module and action available to Support staff.'}
};
const meta=META[ROLE];
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

async function requireSuperAdmin(){
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user){location.href='login.html';return null;}
  const {data:u,error}=await supabase.from('admin_users').select('id,email,status').eq('id',session.user.id).maybeSingle();
  if(error||!u||String(u.status||'active').toLowerCase()!=='active'){location.href='login.html';return null;}
  const {data:s}=await supabase.from('admin_staff_roles').select('role,status').eq('admin_id',session.user.id).maybeSingle();
  if(s?.role!=='super_admin'||String(s?.status||'').toLowerCase()!=='active'){location.href='index.html';return null;}
  return u;
}

function setStatus(text,ok=true){const e=$('saveStatus');if(e){e.textContent=text;e.className=ok?'ok':'bad';}}
function groupName(k){const p=String(k).split('.')[0];return ({applications:'Applications',users:'Users',services:'Services',payments:'Payments',revenue:'Revenue',youtube:'YouTube',website_cms:'Website CMS',audit:'Audit Log',trash:'Trash',system_health:'System Health',global_search:'Global Search',dashboard:'Dashboard',health:'Health',search:'Search',cms:'Admin CMS',roles:'Roles',staff:'Staff'}[p]||p.replace(/_/g,' ')).replace(/\b\w/g,c=>c.toUpperCase());}

async function load(){
  const me=await requireSuperAdmin(); if(!me)return;
  document.documentElement.style.setProperty('--role-accent',meta.accent);
  $('roleIcon').textContent=meta.icon; $('roleName').textContent=meta.label; $('roleTitle').textContent=`${meta.label} Control`; $('roleDescription').textContent=meta.desc;
  $('adminEmail').textContent=me.email||'';

  const [pr,rr,ur]=await Promise.all([
    supabase.from('admin_permissions').select('permission_key,label').order('permission_key'),
    supabase.from('admin_role_permissions').select('permission_key').eq('role',ROLE),
    supabase.from('admin_staff_roles').select('admin_id,role,status,created_at').eq('role',ROLE).order('created_at',{ascending:false})
  ]);
  if(pr.error||rr.error||ur.error){setStatus('Permission data could not be loaded. Check the staff permission SQL/RLS.',false);return;}
  const perms=pr.data||[]; const current=new Set((rr.data||[]).map(x=>x.permission_key));
  const groups={}; perms.forEach(p=>(groups[groupName(p.permission_key)]??=[]).push(p));
  const matrix=$('permissionMatrix');
  matrix.innerHTML=Object.entries(groups).map(([g,list])=>`<section class="perm-group"><div class="perm-group-head"><div><span>${meta.icon}</span><h3>${esc(g)}</h3></div><div class="perm-group-actions"><button type="button" data-group-all="${esc(g)}">All</button><button type="button" data-group-none="${esc(g)}">None</button></div></div><div class="perm-grid">${list.map(p=>`<label class="perm-item" data-key="${esc(p.permission_key)}"><input type="checkbox" data-permission="${esc(p.permission_key)}" ${current.has(p.permission_key)?'checked':''}><span><b>${esc(p.label||p.permission_key)}</b><small>${esc(p.permission_key)}</small></span></label>`).join('')}</div></section>`).join('')||'<div class="empty">No permissions found.</div>';

  matrix.querySelectorAll('input[data-permission]').forEach(ch=>ch.addEventListener('change',async()=>{
    const key=ch.dataset.permission; ch.disabled=true;
    const q=ch.checked ? supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:key}) : supabase.from('admin_role_permissions').delete().eq('role',ROLE).eq('permission_key',key);
    const {error}=await q; ch.disabled=false;
    if(error){ch.checked=!ch.checked;setStatus(error.message,false);return;}
    setStatus(`${meta.label}: ${ch.checked?'permission enabled':'permission disabled'} ✅`);
    updateCount();
  }));

  matrix.querySelectorAll('[data-group-all]').forEach(b=>b.onclick=()=>bulkGroup(b.dataset.groupAll,true));
  matrix.querySelectorAll('[data-group-none]').forEach(b=>b.onclick=()=>bulkGroup(b.dataset.groupNone,false));
  $('selectAll').onclick=()=>bulkAll(true); $('clearAll').onclick=()=>bulkAll(false);
  $('searchPermissions').oninput=e=>{const q=e.target.value.toLowerCase();matrix.querySelectorAll('.perm-item').forEach(x=>x.hidden=!((x.dataset.key||'').toLowerCase().includes(q)||x.textContent.toLowerCase().includes(q)));};
  $('staffCount').textContent=String((ur.data||[]).length);
  $('assignedStaff').innerHTML=(ur.data||[]).map(x=>`<div class="staff-row"><div><b>${esc(x.admin_id)}</b><small>Role: ${esc(x.role)} · Created: ${new Date(x.created_at).toLocaleDateString('en-IN')}</small></div><span class="status ${String(x.status).toLowerCase()==='active'?'active':String(x.status).toLowerCase()==='suspended'?'suspended':'inactive'}">${esc(String(x.status||'active').toUpperCase())}</span></div>`).join('')||'<div class="empty">No staff assigned to this role.</div>';
  updateCount();
}
function updateCount(){const a=[...document.querySelectorAll('input[data-permission]')];const n=a.filter(x=>x.checked).length;if($('permissionCount'))$('permissionCount').textContent=`${n} / ${a.length} enabled`;}
async function bulkAll(on){
  const checks=[...document.querySelectorAll('input[data-permission]')];
  for(const ch of checks){if(ch.checked!==on){const key=ch.dataset.permission;const q=on?supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:key}):supabase.from('admin_role_permissions').delete().eq('role',ROLE).eq('permission_key',key);const {error}=await q;if(error){setStatus(error.message,false);await load();return;}ch.checked=on;}}
  setStatus(`${meta.label}: all permissions ${on?'enabled':'cleared'} ✅`);updateCount();
}
async function bulkGroup(group,on){
  const checks=[...document.querySelectorAll('.perm-group')].find(x=>x.querySelector('h3')?.textContent===group)?.querySelectorAll('input[data-permission]')||[];
  for(const ch of checks){if(ch.checked!==on){const key=ch.dataset.permission;const q=on?supabase.from('admin_role_permissions').upsert({role:ROLE,permission_key:key}):supabase.from('admin_role_permissions').delete().eq('role',ROLE).eq('permission_key',key);const {error}=await q;if(error){setStatus(error.message,false);return;}ch.checked=on;}}
  setStatus(`${group}: ${on?'all enabled':'all cleared'} ✅`);updateCount();
}
$('backAdmin').onclick=()=>{sessionStorage.setItem('yt_staff_admin_role_focus',ROLE);location.href='index.html';};
$('logoutAdmin').onclick=async()=>{await supabase.auth.signOut();location.href='login.html';};
load().catch(e=>{console.error(e);setStatus('Unexpected error while loading role control.',false);});
