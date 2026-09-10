import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const esc = (v="") => String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const dateText = (v) => { if(!v) return "-"; const d=new Date(v); return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}); };
const label = (v) => String(v||"").replace(/[_-]+/g," ").replace(/\b\w/g,m=>m.toUpperCase());
let historyRows=[];

function detailsText(row){
  const d=row?.details;
  if(!d || typeof d!=="object") return "-";
  const parts=[];
  for(const [k,v] of Object.entries(d)){
    if(v===null || v===undefined || v==="") continue;
    parts.push(`${label(k)}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  }
  return parts.join(" · ") || "-";
}

function statusFor(row){
  const action=String(row?.action||"").toLowerCase();
  if(action.includes("fail") || action.includes("reject") || action.includes("error")) return '<span class="yt-history-badge bad">Attention</span>';
  if(action.includes("delete") || action.includes("disable")) return '<span class="yt-history-badge warn">Changed</span>';
  return '<span class="yt-history-badge good">Recorded</span>';
}

function render(){
  const body=$("adminHistoryBody"), count=$("adminHistoryCount"), empty=$("adminHistoryEmpty");
  if(!body) return;
  const q=String($("adminHistorySearch")?.value||"").trim().toLowerCase();
  const action=String($("adminHistoryAction")?.value||"").trim().toLowerCase();
  const rows=historyRows.filter(r=>{
    const hay=[r.action,r.actor_type,r.target_type,r.actor_id,r.target_id,r.customer_id,detailsText(r)].join(" ").toLowerCase();
    return (!q || hay.includes(q)) && (!action || String(r.action||"").toLowerCase()===action);
  });
  if(count) count.textContent=String(rows.length);
  if(empty) empty.hidden=rows.length>0;
  body.innerHTML=rows.length ? rows.map(r=>`
    <tr>
      <td><b>${esc(dateText(r.created_at))}</b></td>
      <td><span class="yt-history-type">${esc(label(r.target_type||r.actor_type||"Activity"))}</span></td>
      <td><b>${esc(label(r.action))}</b></td>
      <td>${esc(r.customer_name||r.actor_email||r.actor_id||"System")}</td>
      <td class="yt-history-details">${esc(detailsText(r))}</td>
      <td>${statusFor(r)}</td>
      <td class="yt-history-actions">
        <button class="btn" type="button" data-history-view="${esc(r.id)}">View</button>
        <button class="btn danger" type="button" data-history-delete="${esc(r.id)}">Delete</button>
      </td>
    </tr>`).join("") : `<tr><td colspan="7" class="yt-history-no-results">No matching history found.</td></tr>`;
  body.querySelectorAll("[data-history-view]").forEach(b=>b.addEventListener("click",()=>viewDetails(b.dataset.historyView)));
  body.querySelectorAll("[data-history-delete]").forEach(b=>b.addEventListener("click",()=>deleteOne(b.dataset.historyDelete)));
}

function viewDetails(id){
  const row=historyRows.find(x=>x.id===id); if(!row) return;
  let modal=$("adminHistoryDetailModal");
  if(!modal){
    modal=document.createElement("div"); modal.id="adminHistoryDetailModal"; modal.className="yt-history-modal"; modal.innerHTML=`<div class="yt-history-modal-card" role="dialog" aria-modal="true" aria-labelledby="adminHistoryDetailTitle"><div class="yt-history-modal-head"><div><span>HISTORY DETAILS</span><h3 id="adminHistoryDetailTitle">Activity Details</h3></div><button type="button" class="btn" data-history-close>Close</button></div><div id="adminHistoryDetailBody" class="yt-history-detail-grid"></div></div>`; document.body.appendChild(modal);
    modal.addEventListener("click",e=>{if(e.target===modal || e.target.closest("[data-history-close]")) modal.remove();});
  }
  const body=$("adminHistoryDetailBody");
  body.innerHTML=[
    ["Date & Time",dateText(row.created_at)],
    ["Action",label(row.action)],
    ["Type",label(row.target_type||row.actor_type||"Activity")],
    ["Actor",row.actor_email||row.actor_id||"System"],
    ["Customer ID",row.customer_id||"-"],
    ["Target ID",row.target_id||"-"],
    ["Details",detailsText(row)]
  ].map(([k,v])=>`<div><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join("");
}

async function load(){
  const body=$("adminHistoryBody"); if(!body) return;
  body.innerHTML='<tr><td colspan="7" class="yt-history-loading">Loading history…</td></tr>';
  try{
    const {data,error}=await supabase.rpc("admin_list_history",{p_limit:500});
    if(error) throw error;
    historyRows=Array.isArray(data)?data:[];
    const select=$("adminHistoryAction");
    if(select){
      const current=select.value;
      const actions=[...new Set(historyRows.map(r=>String(r.action||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
      select.innerHTML='<option value="">All Actions</option>'+actions.map(a=>`<option value="${esc(a)}">${esc(label(a))}</option>`).join("");
      select.value=actions.includes(current)?current:"";
    }
    render();
  }catch(e){
    console.error("Admin history load",e);
    historyRows=[];
    body.innerHTML=`<tr><td colspan="7" class="yt-history-no-results">History setup is not available. Run ADMIN-HISTORY-SETUP.sql in Supabase.</td></tr>`;
    if($("adminHistoryCount")) $("adminHistoryCount").textContent="0";
  }
}

async function deleteOne(id){
  if(!id || !confirm("Delete this history record? This does not delete the original user, application, payment, or audit record.")) return;
  try{
    const {error}=await supabase.rpc("admin_delete_history",{p_id:id});
    if(error) throw error;
    historyRows=historyRows.filter(r=>r.id!==id); render();
  }catch(e){alert(e?.message||"History delete failed.");}
}

async function deleteAll(){
  if(!historyRows.length) return;
  if(!confirm("Delete ALL History records?\n\nThis only clears Admin History. Original users, applications, payments and Audit Log records remain unchanged.")) return;
  const btn=$("adminHistoryDeleteAll"); if(btn) btn.disabled=true;
  try{
    const {error}=await supabase.rpc("admin_delete_all_history");
    if(error) throw error;
    historyRows=[]; render();
  }catch(e){alert(e?.message||"Delete All History failed.");}
  finally{if(btn) btn.disabled=false;}
}

window.loadAdminHistory=load;
window.initAdminHistory=()=>{
  $("adminHistoryRefresh")?.addEventListener("click",load);
  $("adminHistoryDeleteAll")?.addEventListener("click",deleteAll);
  $("adminHistorySearch")?.addEventListener("input",render);
  $("adminHistoryAction")?.addEventListener("change",render);
  load();
};

window.initAdminHistory();
