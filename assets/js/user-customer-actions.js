import { supabase } from "./supabase.js";

const $=(id)=>document.getElementById(id);
const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dt=(v)=>{if(!v)return "-";const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});};
let current=null;

function ensureStyle(){
 if($("customerActionsStyle"))return;
 const st=document.createElement("style");st.id="customerActionsStyle";st.textContent=`
 .customer-actions-modal{position:fixed;inset:0;background:rgba(15,23,42,.62);display:flex;align-items:center;justify-content:center;padding:20px;z-index:100000}
 .customer-actions-card{width:min(720px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 70px rgba(0,0,0,.28);padding:22px}
 .customer-actions-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;border-bottom:1px solid #e5e7eb;padding-bottom:14px;margin-bottom:16px}
 .customer-actions-head h3{margin:0;font-size:20px}.customer-actions-head small{color:#667085}.customer-actions-close{border:0;background:#f2f4f7;border-radius:10px;padding:8px 11px;cursor:pointer;font-size:18px}
 .customer-actions-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.customer-actions-grid label{font-size:13px;font-weight:700;color:#344054}.customer-actions-grid input{width:100%;box-sizing:border-box;margin-top:6px;padding:10px 11px;border:1px solid #d0d5dd;border-radius:9px;font:inherit}
 .customer-actions-status{display:inline-flex;padding:5px 10px;border-radius:999px;background:#ecfdf3;color:#027a48;font-size:12px;font-weight:700}.customer-actions-status.disabled{background:#fef3f2;color:#b42318}
 .customer-actions-buttons{display:flex;flex-wrap:wrap;gap:9px;margin-top:18px;padding-top:16px;border-top:1px solid #e5e7eb}.customer-actions-buttons button{cursor:pointer}.customer-actions-view{background:#f8fafc;border:1px solid #d0d5dd;border-radius:9px;padding:9px 12px}.customer-actions-save{background:#2563eb;color:#fff;border:0;border-radius:9px;padding:9px 14px}.customer-actions-reset{background:#7c3aed;color:#fff;border:0;border-radius:9px;padding:9px 14px}.customer-actions-toggle{background:#f59e0b;color:#111827;border:0;border-radius:9px;padding:9px 14px}.customer-actions-delete{background:#dc2626;color:#fff;border:0;border-radius:9px;padding:9px 14px}.customer-actions-msg{margin-top:12px;min-height:20px;font-size:13px;font-weight:600}.customer-actions-viewbox{background:#f8fafc;border:1px solid #e4e7ec;border-radius:12px;padding:14px;margin-top:12px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.customer-actions-viewbox div{padding:8px;background:#fff;border-radius:8px}.customer-actions-viewbox b{display:block;font-size:11px;color:#667085;margin-bottom:3px}
 @media(max-width:600px){.customer-actions-grid,.customer-actions-viewbox{grid-template-columns:1fr}.customer-actions-card{padding:16px}}
 `;document.head.appendChild(st);
}
function close(){ $("customerActionsModal")?.remove(); current=null; }
function modal(c){
 ensureStyle();close();current=c;
 const disabled=String(c.account_status||"active").toLowerCase()==="disabled";
 const m=document.createElement("div");m.id="customerActionsModal";m.className="customer-actions-modal";m.innerHTML=`<div class="customer-actions-card" role="dialog" aria-modal="true" aria-label="Customer Actions">
  <div class="customer-actions-head"><div><h3>👤 Customer Actions</h3><small>${esc(c.full_name||c.email||c.id)}</small></div><button type="button" class="customer-actions-close" data-ca-close>×</button></div>
  <div class="customer-actions-grid">
   <label>Name<input id="caName" value="${esc(c.full_name||"")}"></label>
   <label>Email<input id="caEmail" type="email" value="${esc(c.email||"")}"></label>
   <label>Mobile<input id="caMobile" value="${esc(c.mobile||"")}"></label>
   <label>Channel<input id="caChannel" value="${esc(c.channel_name||"")}"></label>
  </div>
  <div style="margin-top:12px">Status: <span id="caStatus" class="customer-actions-status ${disabled?'disabled':''}">${disabled?'Disabled':'Active'}</span></div>
  <div class="customer-actions-viewbox">
   <div><b>Customer ID</b>${esc(c.id)}</div><div><b>User ID</b>${esc(c.user_id||"-")}</div><div><b>Joined</b>${dt(c.created_at)}</div><div><b>Account Status</b>${disabled?'Disabled':'Active'}</div>
  </div>
  <div class="customer-actions-buttons">
   <button type="button" class="customer-actions-view" data-ca-view>👁️ View User</button>
   <button type="button" class="customer-actions-reset" data-ca-reset>🔑 Reset Password</button>
   <button type="button" class="customer-actions-toggle" data-ca-toggle>${disabled?'🚫 Enable User':'🚫 Disable User'}</button>
   <button type="button" class="customer-actions-save" data-ca-save>💾 Save</button>
   <button type="button" class="customer-actions-delete" data-ca-delete>🗑️ Delete User</button>
  </div><div id="caMsg" class="customer-actions-msg"></div>
 </div>`;
 document.body.appendChild(m);
 m.addEventListener("click",async e=>{if(e.target===m||e.target.closest("[data-ca-close]")){close();return}const b=e.target.closest("button");if(!b)return;
  if(b.matches("[data-ca-view]")){showDetails();return;}
  if(b.matches("[data-ca-save]")){await save();return;}
  if(b.matches("[data-ca-reset]")){await resetPassword();return;}
  if(b.matches("[data-ca-toggle]")){await toggleStatus();return;}
  if(b.matches("[data-ca-delete]")){await deleteUser();return;}
 });
}
function message(t,ok=false){const e=$("caMsg");if(e){e.textContent=t;e.style.color=ok?"#027a48":"#b42318";}}
function showDetails(){const c=current;if(!c)return;alert(`User Details\n\nName: ${c.full_name||'-'}\nEmail: ${c.email||'-'}\nMobile: ${c.mobile||'-'}\nChannel: ${c.channel_name||'-'}\nJoined: ${dt(c.created_at)}\nStatus: ${c.account_status||'active'}\nCustomer ID: ${c.id}`);}
async function save(){if(!current)return;const payload={full_name:$("caName")?.value.trim()||null,email:$("caEmail")?.value.trim()||null,mobile:$("caMobile")?.value.trim()||null,channel_name:$("caChannel")?.value.trim()||null};const b=document.querySelector("[data-ca-save]");if(b)b.disabled=true;message("Saving…");try{const {data,error}=await supabase.from("customers").update(payload).eq("id",current.id).select("id,user_id,full_name,email,mobile,channel_name,created_at,account_status").single();if(error)throw error;current=data;message("Saved successfully.",true);document.dispatchEvent(new CustomEvent("customer-actions-changed",{detail:data}));}catch(e){message(e?.message||"Save failed.");}finally{if(b)b.disabled=false;}}
async function resetPassword(){if(!current?.email){message("Customer email is missing.");return}if(!confirm(`Send a secure password reset link to ${current.email}?`))return;const b=document.querySelector("[data-ca-reset]");if(b)b.disabled=true;message("Sending reset link…");try{const {error}=await supabase.auth.resetPasswordForEmail(current.email,{redirectTo:new URL("../reset-password.html",location.href).href});if(error)throw error;message("Secure reset link sent.",true);}catch(e){message(e?.message||"Reset password failed.");}finally{if(b)b.disabled=false;}}
async function toggleStatus(){if(!current)return;const next=String(current.account_status||"active").toLowerCase()==="disabled"?"active":"disabled";if(!confirm(`${next==='disabled'?'Disable':'Enable'} this user?`))return;const b=document.querySelector("[data-ca-toggle]");if(b)b.disabled=true;message("Updating status…");try{const {data,error}=await supabase.from("customers").update({account_status:next}).eq("id",current.id).select("id,user_id,full_name,email,mobile,channel_name,created_at,account_status").single();if(error)throw error;current=data;message(`User ${next==='disabled'?'disabled':'enabled'} successfully.`,true);modal(current);document.dispatchEvent(new CustomEvent("customer-actions-changed",{detail:data}));}catch(e){message(e?.message||"Status update failed.");}finally{if(b)b.disabled=false;}}
async function deleteUser(){if(!current)return;if(!confirm(`Permanently delete ${current.full_name||current.email||'this user'}? This cannot be undone.`))return;const b=document.querySelector("[data-ca-delete]");if(b)b.disabled=true;message("Deleting…");try{const {data,error}=await supabase.rpc("admin_delete_customer",{p_customer_id:current.id});if(error)throw error;if(data===false)throw new Error("Delete was not completed.");close();document.dispatchEvent(new CustomEvent("customer-actions-changed",{detail:{id:current.id,deleted:true}}));location.reload();}catch(e){message(e?.message||"Delete failed.");if(b)b.disabled=false;}}
async function openFor(id){try{const {data,error}=await supabase.from("customers").select("id,user_id,full_name,email,mobile,channel_name,created_at,account_status").eq("id",id).single();if(error)throw error;modal(data);}catch(e){alert(e?.message||"Unable to load customer.");}}
document.addEventListener("click",e=>{const b=e.target.closest("[data-customer-actions]");if(b){e.preventDefault();openFor(b.dataset.customerActions);}});
document.addEventListener("customer-actions-changed",()=>{document.getElementById("refreshFreeServiceUsers")?.click();});
