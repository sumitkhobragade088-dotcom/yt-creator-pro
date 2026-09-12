import { supabase } from './supabase.js';

const esc = (v='') => String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let modal, current;

function ensureModal(){
  if(modal) return modal;
  const style=document.createElement('style');
  style.textContent=`
  #customerActionsModal{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.58);display:flex;align-items:center;justify-content:center;padding:18px}
  #customerActionsModal[hidden]{display:none}
  .uca-card{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.25);padding:22px}
  .uca-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}.uca-head h3{margin:0;font-size:20px}.uca-close{border:0;background:#f2f4f7;border-radius:10px;width:38px;height:38px;cursor:pointer;font-size:20px}
  .uca-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.uca-field label{display:block;font-size:12px;font-weight:700;color:#667085;margin-bottom:5px}.uca-field input,.uca-field select{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:9px;padding:10px 11px;background:#fff}.uca-status{display:inline-flex;padding:5px 9px;border-radius:999px;background:#eef2ff;font-weight:700;font-size:12px}.uca-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:18px;padding-top:15px;border-top:1px solid #eaecf0}.uca-actions button{border:0;border-radius:9px;padding:10px 13px;cursor:pointer;font-weight:700}.uca-view{background:#eef2ff}.uca-reset{background:#fff7ed}.uca-toggle{background:#fef3c7}.uca-save{background:#dcfce7}.uca-delete{background:#fee2e2;color:#991b1b}.uca-msg{min-height:20px;margin-top:10px;font-size:13px;font-weight:600}.uca-danger{color:#b42318}.uca-ok{color:#027a48}
  @media(max-width:600px){.uca-grid{grid-template-columns:1fr}.uca-card{padding:16px}}
  `;
  document.head.appendChild(style);
  modal=document.createElement('div'); modal.id='customerActionsModal'; modal.hidden=true;
  modal.innerHTML=`<div class="uca-card" role="dialog" aria-modal="true" aria-labelledby="ucaTitle">
    <div class="uca-head"><h3 id="ucaTitle">User Actions</h3><button type="button" class="uca-close" id="ucaClose" aria-label="Close">×</button></div>
    <div class="uca-grid">
      <div class="uca-field"><label>Full Name</label><input id="ucaName"></div>
      <div class="uca-field"><label>Email</label><input id="ucaEmail" type="email" readonly></div>
      <div class="uca-field"><label>Mobile</label><input id="ucaMobile"></div>
      <div class="uca-field"><label>Channel</label><input id="ucaChannel"></div>
      <div class="uca-field"><label>Status</label><select id="ucaStatus"><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
      <div class="uca-field"><label>User ID</label><input id="ucaUserId" readonly></div>
    </div>
    <div id="ucaMsg" class="uca-msg"></div>
    <div class="uca-actions">
      <button type="button" class="uca-view" id="ucaView">👁️ View User</button>
      <button type="button" class="uca-reset" id="ucaReset">🔑 Reset Password</button>
      <button type="button" class="uca-toggle" id="ucaToggle">🚫 Enable / Disable</button>
      <button type="button" class="uca-save" id="ucaSave">💾 Save</button>
      <button type="button" class="uca-delete" id="ucaDelete">🗑️ Delete User</button>
    </div></div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
  document.getElementById('ucaClose').onclick=closeModal;
  document.getElementById('ucaView').onclick=viewUser;
  document.getElementById('ucaReset').onclick=resetPassword;
  document.getElementById('ucaToggle').onclick=toggleStatus;
  document.getElementById('ucaSave').onclick=saveUser;
  document.getElementById('ucaDelete').onclick=deleteUser;
  return modal;
}
function setMsg(text,ok=false){const e=document.getElementById('ucaMsg');if(e){e.textContent=text;e.className='uca-msg '+(ok?'uca-ok':'uca-danger');}}
function closeModal(){if(modal)modal.hidden=true;current=null;}
async function loadUser(id){
  const {data,error}=await supabase.from('customers').select('id,user_id,full_name,email,mobile,channel_name,created_at,account_status').eq('id',id).maybeSingle();
  if(error) throw error; if(!data) throw new Error('User not found.'); return data;
}
function fill(c){
  document.getElementById('ucaName').value=c.full_name||'';document.getElementById('ucaEmail').value=c.email||'';document.getElementById('ucaMobile').value=c.mobile||'';document.getElementById('ucaChannel').value=c.channel_name||'';document.getElementById('ucaStatus').value=String(c.account_status||'active').toLowerCase()==='disabled'?'disabled':'active';document.getElementById('ucaUserId').value=c.user_id||c.id||'';
  document.getElementById('ucaToggle').textContent=document.getElementById('ucaStatus').value==='disabled'?'🚫 Enable User':'🚫 Disable User';
}
async function openActions(id){
  ensureModal(); modal.hidden=false; setMsg('Loading user…',true);
  try{current=await loadUser(id);fill(current);setMsg('Ready.',true);}catch(e){setMsg(e.message||'Unable to load user.');}
}
function viewUser(){
  if(!current)return; const details=[`Name: ${current.full_name||'-'}`,`Email: ${current.email||'-'}`,`Mobile: ${current.mobile||'-'}`,`Channel: ${current.channel_name||'-'}`,`Status: ${current.account_status||'active'}`,`User ID: ${current.user_id||'-'}`,`Customer ID: ${current.id||'-'}`,`Joined: ${current.created_at?new Date(current.created_at).toLocaleString('en-IN'):'-'}`].join('\n'); alert(details);
}
async function resetPassword(){
  if(!current?.email)return setMsg('No email is available for password reset.');
  if(!confirm(`Send a secure password reset link to ${current.email}?`))return;
  setMsg('Sending reset link…',true);const redirectTo=new URL('../reset-password.html',location.href).href;
  const {error}=await supabase.auth.resetPasswordForEmail(current.email,{redirectTo}); if(error)return setMsg(error.message);setMsg('Password reset link sent successfully.',true);
}
async function updateStatus(status){
  const {error}=await supabase.from('customers').update({account_status:status}).eq('id',current.id);if(error)throw error;current.account_status=status;fill(current);
}
async function toggleStatus(){
  if(!current)return;const next=String(current.account_status||'active').toLowerCase()==='disabled'?'active':'disabled';if(!confirm(`Set this user to ${next === 'disabled' ? 'Disabled' : 'Active'}?`))return;setMsg('Updating status…',true);try{await updateStatus(next);setMsg(`User ${next==='disabled'?'disabled':'enabled'} successfully.`,true);refreshLists();}catch(e){setMsg(e.message||'Unable to update status.');}
}
async function saveUser(){
  if(!current)return;const payload={full_name:document.getElementById('ucaName').value.trim(),mobile:document.getElementById('ucaMobile').value.trim(),channel_name:document.getElementById('ucaChannel').value.trim(),account_status:document.getElementById('ucaStatus').value};if(!payload.full_name)return setMsg('Full Name is required.');setMsg('Saving…',true);const {data,error}=await supabase.from('customers').update(payload).eq('id',current.id).select('id,user_id,full_name,email,mobile,channel_name,created_at,account_status').maybeSingle();if(error)return setMsg(error.message);current=data||{...current,...payload};fill(current);setMsg('User saved successfully.',true);refreshLists();
}
async function deleteUser(){
  if(!current)return;if(!confirm(`Delete ${current.full_name||current.email||'this user'} permanently? This action cannot be undone.`))return;setMsg('Deleting user…',true);const {data,error}=await supabase.rpc('admin_delete_customer',{p_customer_id:current.id});if(error)return setMsg(error.message);if(!data)return setMsg('User was not found.');setMsg('User deleted successfully.',true);refreshLists();setTimeout(closeModal,500);
}
function refreshLists(){
  window.dispatchEvent(new CustomEvent('admin-customer-changed'));
  if(typeof window.__reloadAdminCustomers==='function')window.__reloadAdminCustomers();
  if(typeof window.__reloadFreeUsers==='function')window.__reloadFreeUsers();
}
document.addEventListener('click',e=>{const btn=e.target.closest('[data-customer-actions]');if(btn){e.preventDefault();openActions(btn.dataset.customerActions);}});
window.__openCustomerActions=openActions;
