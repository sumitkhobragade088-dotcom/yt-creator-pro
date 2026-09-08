import { supabase } from './supabase.js';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money = v => `₹${Number(v || 0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateText = v => v ? new Date(v).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '-';

async function isAdmin(){
  const {data:{session}} = await supabase.auth.getSession();
  if(!session?.user) return false;
  const {data,error}=await supabase.from('admin_users').select('id,status').eq('id',session.user.id).maybeSingle();
  return !error && !!data && String(data.status||'active').toLowerCase()==='active';
}

async function log(action,targetType,targetId,details={}){
  try{ await supabase.from('activity_logs').insert({actor_type:'admin',action,target_type:targetType||null,target_id:targetId||null,details}); }catch(_){ }
}

function setMsg(id,msg,good=false){ const e=$(id); if(e){e.textContent=msg;e.className=good?'good-text':'error-text';} }

async function loadRoles(){
  const [roles,perms,users]=await Promise.all([
    supabase.from('admin_staff_roles').select('admin_id,role,status,created_at,updated_at').order('created_at'),
    supabase.from('admin_permissions').select('permission_key,label').order('permission_key'),
    supabase.from('admin_users').select('id,email,status,created_at').order('email')
  ]);
  const body=$('acsRolesBody'); if(!body)return;
  if(roles.error||perms.error||users.error){body.innerHTML='<tr><td colspan="5">Role/permission data could not be loaded. Run STAFF-DASHBOARDS-TOTAL-LOCK.sql once.</td></tr>';return;}
  const userMap=new Map((users.data||[]).map(u=>[u.id,u]));
  const roleRows=roles.data||[];
  const roleMeta={
    manager:{icon:'🟢',title:'Manager',desc:'Management-level access controlled entirely by Super Admin.'},
    operator:{icon:'🟡',title:'Operator',desc:'Operational access controlled entirely by Super Admin.'},
    support:{icon:'🩷',title:'Support',desc:'Support/customer-help access controlled entirely by Super Admin.'},
    super_admin:{icon:'👑',title:'Super Admin',desc:'Full protected administrator control.'}
  };
  const cards=$('acsRoleCards');
  if(cards){
    cards.innerHTML=['manager','operator','support'].map(r=>`<button type="button" class="acs-role-card" data-role-card="${r}"><b>${roleMeta[r].icon} ${roleMeta[r].title}</b><small>${esc(roleMeta[r].desc)}</small></button>`).join('');
    cards.querySelectorAll('[data-role-card]').forEach(b=>b.addEventListener('click',()=>focusRole(b.dataset.roleCard)));
  }
  window.focusRole=focusRole;
  function focusRole(role){
    const m=roleMeta[role]||roleMeta.operator;
    cards?.querySelectorAll('[data-role-card]').forEach(b=>b.classList.toggle('active',b.dataset.roleCard===role));
    const info=$('acsRoleInfo'); if(info)info.innerHTML=`<b>${m.icon} ${m.title}</b><span>${esc(m.desc)}</span><small>Use the Permission Matrix below to grant or remove A–Z permissions.</small>`;
    const editor=$('acsPermissionEditor');
    editor?.querySelectorAll('.acs-role-perm').forEach(x=>x.hidden=x.dataset.rpRole!==role);
  }
  body.innerHTML=roleRows.map(r=>{
    const u=userMap.get(r.admin_id)||{};
    const status=String(r.status||'active').toLowerCase();
    return `<tr><td><b>${esc(u.email||r.admin_id)}</b></td><td>${esc(r.role)}</td><td><span class="yt-status-chip ${status==='active'?'good':'bad'}">${esc(status.toUpperCase())}</span></td><td>${dateText(r.updated_at||r.created_at)}</td><td><select data-staff-role="${r.admin_id}"><option value="manager" ${r.role==='manager'?'selected':''}>Manager</option><option value="operator" ${r.role==='operator'?'selected':''}>Operator</option><option value="support" ${r.role==='support'?'selected':''}>Support</option></select> <select data-staff-status="${r.admin_id}"><option value="active" ${status==='active'?'selected':''}>Active</option><option value="inactive" ${status==='inactive'?'selected':''}>Inactive</option><option value="suspended" ${status==='suspended'?'selected':''}>Suspended</option></select> <button class="btn primary" data-save-staff="${r.admin_id}">Save</button> <button class="btn danger" data-delete-staff="${r.admin_id}">Delete</button></td></tr>`;
  }).join('')||'<tr><td colspan="5">No staff accounts found.</td></tr>';
  body.querySelectorAll('[data-save-staff]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.saveStaff, role=body.querySelector(`[data-staff-role="${id}"]`).value, status=body.querySelector(`[data-staff-status="${id}"]`).value;
    if(id=== (await supabase.auth.getUser()).data.user?.id) return alert('Your Super Admin account is protected.');
    const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:role,p_status:status});
    if(error)return alert(error.message); await log('staff_updated','admin_staff_roles',id,{role,status}); await loadRoles();
  });
  body.querySelectorAll('[data-delete-staff]').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.deleteStaff; if(!confirm('WARNING: Delete this staff access? The Supabase Auth account will NOT be deleted. Continue?'))return;
    const {error}=await supabase.rpc('admin_remove_staff',{p_admin_id:id}); if(error)return alert(error.message); await log('staff_access_deleted','admin_staff_roles',id); await loadRoles();
  });
  const select=$('acsAdminUserSelect'); if(select){select.innerHTML='<option value="">Select admin/staff account…</option>'+ (users.data||[]).map(u=>`<option value="${u.id}">${esc(u.email)}${u.status&&String(u.status).toLowerCase()!=='active'?' — '+esc(u.status):''}</option>`).join('');}
  const pe=$('acsPermissionEditor');
  if(pe){
    const allPerms=(perms.data||[]).map(x=>x.permission_key); const rolesList=['manager','operator','support'];
    const rpRes=await supabase.from('admin_role_permissions').select('role,permission_key');
    const existing=new Set((rpRes.data||[]).map(x=>x.role+'|'+x.permission_key));
    pe.innerHTML=rolesList.map(role=>`<div class="acs-role-perm" data-rp-role="${role}"><h4>${roleMeta[role].icon} ${roleMeta[role].title} Permissions</h4><div class="acs-perm-tools"><button type="button" class="btn" data-perm-all="${role}">Select All</button><button type="button" class="btn" data-perm-none="${role}">Clear All</button><input type="search" placeholder="Search permissions…" data-perm-search="${role}"></div><div class="acs-perm-grid">${allPerms.map(k=>`<label data-perm-item="${role}" data-perm-key="${esc(k)}"><input type="checkbox" data-rp-role="${role}" data-rp-key="${esc(k)}" ${existing.has(role+'|'+k)?'checked':''}> ${esc((perms.data||[]).find(x=>x.permission_key===k)?.label||k)}</label>`).join('')}</div></div>`).join('');
    pe.querySelectorAll('[data-rp-role][data-rp-key]').forEach(ch=>ch.addEventListener('change',async()=>{const role=ch.dataset.rpRole,key=ch.dataset.rpKey;const q=ch.checked?supabase.from('admin_role_permissions').upsert({role,permission_key:key}):supabase.from('admin_role_permissions').delete().eq('role',role).eq('permission_key',key);const {error}=await q;if(error){ch.checked=!ch.checked;alert(error.message);}}));
    pe.querySelectorAll('[data-perm-all]').forEach(b=>b.onclick=()=>pe.querySelectorAll(`[data-rp-role="${b.dataset.permAll}"][data-rp-key]`).forEach(x=>{x.checked=true;x.dispatchEvent(new Event('change'))}));
    pe.querySelectorAll('[data-perm-none]').forEach(b=>b.onclick=()=>pe.querySelectorAll(`[data-rp-role="${b.dataset.permNone}"][data-rp-key]`).forEach(x=>{x.checked=false;x.dispatchEvent(new Event('change'))}));
    pe.querySelectorAll('[data-perm-search]').forEach(inp=>inp.oninput=()=>{const q=inp.value.toLowerCase();pe.querySelectorAll(`[data-perm-item="${inp.dataset.permSearch}"]`).forEach(x=>x.hidden=!x.dataset.permKey.toLowerCase().includes(q));});
    focusRole(sessionStorage.getItem('yt_acs_role_focus')||'manager'); sessionStorage.removeItem('yt_acs_role_focus');
  }
  const create=$('acsCreateStaff');
  if(create && create.dataset.bound!=='1'){
    create.dataset.bound='1'; create.onclick=async()=>{
      const name=$('acsStaffName')?.value.trim(),email=$('acsStaffEmail')?.value.trim(),role=$('acsStaffRole')?.value,password=$('acsStaffPassword')?.value;
      if(!name||!email||!password)return setMsg('acsStaffMsg','Name, email and temporary password are required.');
      create.disabled=true; setMsg('acsStaffMsg','Creating staff…');
      try{const {data,error}=await supabase.functions.invoke('create-admin-staff',{body:{name,email,role,password}});if(error)throw error;if(data?.error)throw new Error(data.error);setMsg('acsStaffMsg','Staff created successfully ✅',true);['acsStaffName','acsStaffEmail','acsStaffPassword'].forEach(id=>{const e=$(id);if(e)e.value='';});await loadRoles();}catch(e){setMsg('acsStaffMsg',e?.message||'Staff creation failed.');}finally{create.disabled=false;}
    };
  }
  const assign=$('acsAssignRole');
  if(assign && assign.dataset.bound!=='1'){
    assign.dataset.bound='1'; assign.onclick=async()=>{const id=$('acsAdminUserSelect')?.value,role=$('acsNewRole')?.value;if(!id)return setMsg('acsRoleMsg','Select an admin/staff account.');const {error}=await supabase.rpc('admin_update_staff',{p_admin_id:id,p_role:role,p_status:'active'});if(error)return setMsg('acsRoleMsg',error.message);setMsg('acsRoleMsg','Role assigned successfully ✅',true);await loadRoles();};
  }
}

async function loadApplications(){
  const body=$('acsApplicationsBody'); if(!body)return;
  const {data,error}=await supabase.from('service_requests').select('*').order('created_at',{ascending:false}).limit(100);
  if(error){body.innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;return;}
  body.innerHTML=(data||[]).map(r=>`<tr><td>${esc(r.id).slice(0,8)}…</td><td>${esc(r.service_type||r.service_name||'-')}</td><td><select data-status="${r.id}">${['pending','under_review','documents_required','approved','rejected','completed','payment_pending'].map(s=>`<option value="${s}" ${String(r.status||'').toLowerCase()===s?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select></td><td>${dateText(r.created_at)}</td><td><input data-note="${r.id}" placeholder="Admin note"></td><td><button class="btn primary" data-save-app="${r.id}">Save</button> <button class="btn" data-history-app="${r.id}">History</button> <button class="btn danger" data-trash-app="${r.id}">Trash</button></td></tr>`).join('')||'<tr><td colspan="6">No applications.</td></tr>';
  body.querySelectorAll('[data-history-app]').forEach(btn=>btn.onclick=async()=>{const {data,error}=await supabase.from('application_status_history').select('old_status,new_status,note,changed_at').eq('request_id',btn.dataset.historyApp).order('changed_at',{ascending:false});if(error)return alert(error.message);alert((data||[]).map(x=>`${dateText(x.changed_at)} — ${x.old_status||'NEW'} → ${x.new_status}${x.note?' — '+x.note:''}`).join('\n')||'No status history.');});
  body.querySelectorAll('[data-trash-app]').forEach(btn=>btn.onclick=async()=>{if(!confirm('Move this application to Trash?'))return;const {error}=await supabase.rpc('admin_soft_delete_record',{p_table:'service_requests',p_id:btn.dataset.trashApp});if(error)return alert(error.message);await log('application_trashed','service_requests',btn.dataset.trashApp);await loadApplications();loadTrash();});
  body.querySelectorAll('[data-save-app]').forEach(btn=>btn.onclick=async()=>{const id=btn.dataset.saveApp;const status=body.querySelector(`[data-status="${id}"]`).value;const note=body.querySelector(`[data-note="${id}"]`).value.trim();const {error}=await supabase.from('service_requests').update({status}).eq('id',id);if(error)return alert(error.message);if(note)await supabase.from('request_notes').insert({request_id:id,note});await log('application_status_updated','service_requests',id,{status,note});await loadApplications();});
}

async function loadRevenue(){
  const from=$('acsRevenueFrom')?.value; const to=$('acsRevenueTo')?.value;
  let q=supabase.from('payments').select('id,service_name,amount,status,created_at,payment_mode').order('created_at',{ascending:false}).limit(500);
  if(from)q=q.gte('created_at',`${from}T00:00:00`); if(to)q=q.lt('created_at',`${to}T23:59:59`);
  const {data,error}=await q; if(error){setMsg('acsRevenueMsg',error.message);return;}
  const rows=data||[]; const success=rows.filter(x=>['success','successful','paid','completed'].includes(String(x.status).toLowerCase()));
  const total=success.reduce((n,x)=>n+Number(x.amount||0),0);
  $('acsRevenueTotal').textContent=money(total); $('acsRevenueCount').textContent=success.length; $('acsRevenueFailed').textContent=rows.filter(x=>['failed','failure','cancelled'].includes(String(x.status).toLowerCase())).length;
  const body=$('acsRevenueBody'); if(body)body.innerHTML=rows.map(x=>`<tr><td>${esc(x.service_name)}</td><td>${money(x.amount)}</td><td>${esc(x.status)}</td><td>${esc(x.payment_mode||'-')}</td><td>${dateText(x.created_at)}</td></tr>`).join('')||'<tr><td colspan="5">No payments.</td></tr>';
}

async function globalSearch(){
  const term=$('acsSearchInput')?.value.trim(); if(!term)return;
  const body=$('acsSearchBody'); body.innerHTML='<tr><td colspan="4">Searching…</td></tr>';
  const {data,error}=await supabase.rpc('admin_global_search',{p_term:term,p_limit:50});
  if(error){body.innerHTML=`<tr><td colspan="4">${esc(error.message)}</td></tr>`;return;}
  body.innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.record_type)}</td><td>${esc(x.record_id)}</td><td>${esc(x.title)}</td><td>${esc(x.detail||'')}</td></tr>`).join('')||'<tr><td colspan="4">No results.</td></tr>';
}

async function loadAudit(){
  const body=$('acsAuditBody'); if(!body)return;
  const {data,error}=await supabase.from('activity_logs').select('id,actor_type,action,target_type,target_id,details,created_at').order('created_at',{ascending:false}).limit(200);
  if(error){body.innerHTML=`<tr><td colspan="6">${esc(error.message)}</td></tr>`;return;}
  body.innerHTML=(data||[]).map(x=>`<tr><td>${dateText(x.created_at)}</td><td>${esc(x.actor_type)}</td><td>${esc(x.action)}</td><td>${esc(x.target_type||'-')}</td><td>${esc(x.target_id||'-')}</td><td><code>${esc(JSON.stringify(x.details||{}))}</code></td></tr>`).join('')||'<tr><td colspan="6">No audit records.</td></tr>';
}

async function loadTrash(){
  const body=$('acsTrashBody'); if(!body)return;
  const {data,error}=await supabase.from('admin_trash').select('*').order('deleted_at',{ascending:false}).limit(100);
  if(error){body.innerHTML=`<tr><td colspan="5">${esc(error.message)}</td></tr>`;return;}
  body.innerHTML=(data||[]).map(x=>`<tr><td>${esc(x.table_name)}</td><td>${esc(x.record_id)}</td><td>${esc(x.summary||'-')}</td><td>${dateText(x.deleted_at)}</td><td><button class="btn primary" data-restore="${x.id}">Restore</button></td></tr>`).join('')||'<tr><td colspan="5">Trash is empty.</td></tr>';
  body.querySelectorAll('[data-restore]').forEach(b=>b.onclick=async()=>{if(!confirm('Restore this record?'))return;const {error}=await supabase.rpc('admin_restore_record',{p_trash_id:b.dataset.restore});if(error)return alert(error.message);await log('record_restored','admin_trash',b.dataset.restore);loadTrash();});
}

async function healthCheck(){
  const body=$('acsHealthBody'); if(!body)return;
  const checks=[];
  const t=async(name,fn)=>{const s=performance.now();try{await fn();checks.push([name,'HEALTHY',Math.round(performance.now()-s)]);}catch(e){checks.push([name,'ERROR',e.message||'Failed']);}};
  await t('Supabase Database',async()=>{const {error}=await supabase.from('admin_users').select('id').limit(1);if(error)throw error;});
  await t('Admin Session',async()=>{const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('No active session');});
  await t('Storage',async()=>{const {error}=await supabase.storage.listBuckets();if(error)throw error;});
  await t('Application Workflow',async()=>{const {error}=await supabase.from('application_status_history').select('id').limit(1);if(error)throw error;});
  await t('Audit Logs',async()=>{const {error}=await supabase.from('activity_logs').select('id').limit(1);if(error)throw error;});
  await t('Trash',async()=>{const {error}=await supabase.from('admin_trash').select('id').limit(1);if(error)throw error;});
  body.innerHTML=checks.map(x=>`<tr><td>${esc(x[0])}</td><td class="${x[1]==='HEALTHY'?'good-text':'error-text'}"><b>${x[1]}</b></td><td>${esc(x[2])}</td></tr>`).join('');
}

async function downloadCsv(){
  const {data,error}=await supabase.from('payments').select('id,service_name,amount,status,payment_mode,created_at').order('created_at',{ascending:false}).limit(2000); if(error)return alert(error.message);
  const lines=[['id','service_name','amount','status','payment_mode','created_at'],...(data||[]).map(r=>[r.id,r.service_name,r.amount,r.status,r.payment_mode,r.created_at])];
  const csv=lines.map(a=>a.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='payments-report.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

export async function initAdminControlSuite(){
  // The parent Admin Dashboard already performs authentication/protection.
  // Do NOT gate initialization on a second admin_users lookup: that lookup can
  // be blocked by RLS or use a different admin schema, which previously caused
  // the entire suite to return early and left every tab/button dead.
  if(!document.body.classList.contains('yt-premium-admin-page')) return;

  const bind = (el, event, fn) => {
    if(!el || el.dataset.acsBound === '1') return;
    el.dataset.acsBound = '1';
    el.addEventListener(event, async (e) => {
      try { await fn(e); }
      catch (err) { console.error('[Admin Control Suite]', err); alert(err?.message || 'Admin Control Suite error'); }
    });
  };

  bind($('acsRefresh'),'click',()=>Promise.allSettled([loadApplications(),loadRoles(),loadRevenue(),loadAudit(),loadTrash(),healthCheck()]));
  bind($('acsSearchBtn'),'click',globalSearch);
  bind($('acsSearchInput'),'keydown',e=>{ if(e.key==='Enter') return globalSearch(); });
  bind($('acsRevenueRefresh'),'click',loadRevenue);
  bind($('acsRevenueCsv'),'click',downloadCsv);
  bind($('acsHealthRefresh'),'click',healthCheck);

  document.querySelectorAll('[data-acs-tab]').forEach(b=>{
    if(b.dataset.acsBound==='1') return;
    b.dataset.acsBound='1';
    b.addEventListener('click',()=>{
      const tab=b.dataset.acsTab;
      document.querySelectorAll('[data-acs-panel]').forEach(p=>p.hidden=p.dataset.acsPanel!==tab);
      document.querySelectorAll('[data-acs-tab]').forEach(x=>x.classList.toggle('active',x===b));
    });
  });
  loadApplications();loadRoles();loadRevenue();loadAudit();loadTrash();healthCheck();
}
window.initAdminControlSuite=initAdminControlSuite;
