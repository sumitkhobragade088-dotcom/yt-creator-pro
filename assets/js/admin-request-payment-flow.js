import { supabase } from "./supabase.js";
const $=id=>document.getElementById(id);
const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const money=n=>`₹${Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const dateText=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"-":d.toLocaleString("en-IN");};
const key=v=>String(v||"pending").toLowerCase();

async function loadAdminRequestPaymentFlow(){
  const [{data:customers},{data:reqs},{data:payments},{data:services}] = await Promise.all([
    supabase.from("customers").select("id,full_name,email"),
    supabase.from("service_requests").select("id,customer_id,service_type,status,created_at").order("created_at",{ascending:false}),
    supabase.from("payments").select("id,customer_id,request_id,service_name,amount,status,txnid,mihpayid,payment_mode,error_message,created_at,updated_at").order("created_at",{ascending:false}),
    supabase.from("service_charges").select("id,service_name,description,charge,is_active,sort_order").order("sort_order",{ascending:true}).order("service_name",{ascending:true})
  ]);

  const customerMap=new Map((customers||[]).map(c=>[c.id,c]));
  const paymentMap=new Map((payments||[]).map(p=>[p.request_id,p]));

  // Services = service list only.
  if($("adminServicesCatalogBody")){
    $("servicesCatalogCount").textContent=String((services||[]).length);
    $("adminServicesCatalogBody").innerHTML=(services||[]).length?(services||[]).map(s=>`
      <tr><td>${esc(s.service_name)}</td><td>${money(s.charge)}</td><td>${s.is_active?'<span class="yt-status-chip good">Active</span>':'<span class="yt-status-chip bad">Inactive</span>'}</td></tr>
    `).join(""):'<tr><td colspan="3">No services.</td></tr>';
  }

  // User Requests = paid requests only.
  const paidRequests=(reqs||[]).filter(r=>key(paymentMap.get(r.id)?.status)==="paid");
  if($("adminUserRequestsBody")){
    $("userRequestsCount").textContent=String(paidRequests.length);
    $("adminUserRequestsBody").innerHTML=paidRequests.length?paidRequests.map(r=>{
      const c=customerMap.get(r.customer_id)||{};
      const p=paymentMap.get(r.id)||{};
      return `<tr>
        <td>${esc(c.full_name||c.email||"-")}</td>
        <td>${esc(r.service_type||"Service")}</td>
        <td><span class="yt-status-chip good">Paid ${money(p.amount)}</span></td>
        <td><span class="yt-status-chip">${esc(r.status||"pending")}</span></td>
        <td>${dateText(r.created_at)}</td>
        <td>
          <select data-request-status="${esc(r.id)}">
            ${["pending","processing","on_hold","completed","rejected"].map(s=>`<option value="${s}" ${key(r.status)===s?"selected":""}>${s==="on_hold"?"On Hold":s[0].toUpperCase()+s.slice(1)}</option>`).join("")}
          </select>
          <button type="button" class="yt-mini-action" data-save-request="${esc(r.id)}">Update</button>
        </td>
      </tr>`;
    }).join(""):'<tr><td colspan="6">No paid user requests.</td></tr>';

    $("adminUserRequestsBody").querySelectorAll("[data-save-request]").forEach(btn=>{
      btn.addEventListener("click",async()=>{
        const id=btn.dataset.saveRequest;
        const select=$("adminUserRequestsBody").querySelector(`[data-request-status="${CSS.escape(id)}"]`);
        btn.disabled=true; const old=btn.textContent; btn.textContent="Saving...";
        const {error}=await supabase.from("service_requests").update({status:select.value}).eq("id",id);
        if(error) alert(error.message); else { btn.textContent="Updated ✓"; setTimeout(()=>loadAdminRequestPaymentFlow(),500); return; }
        btn.disabled=false; btn.textContent=old;
      });
    });
  }

  // Payments / PayU = payment state only.
  const total=(payments||[]).reduce((s,p)=>s+(key(p.status)==="paid"?Number(p.amount||0):0),0);
  const paid=(payments||[]).filter(p=>key(p.status)==="paid").length;
  const pending=(payments||[]).filter(p=>["pending","initiated"].includes(key(p.status))).length;
  const failed=(payments||[]).filter(p=>["failed","cancelled","canceled"].includes(key(p.status))).length;
  if($("paymentTotalCollection")) $("paymentTotalCollection").textContent=money(total);
  if($("paymentSuccessCount")) $("paymentSuccessCount").textContent=String(paid);
  if($("paymentPendingCount")) $("paymentPendingCount").textContent=String(pending);
  if($("paymentFailedCount")) $("paymentFailedCount").textContent=String(failed);
  if($("paymentsSectionCount")) $("paymentsSectionCount").textContent=String((payments||[]).length);
  if($("paymentsBody")){
    $("paymentsBody").innerHTML=(payments||[]).length?(payments||[]).map(p=>{
      const c=customerMap.get(p.customer_id)||{};
      return `<tr>
        <td>${esc(c.full_name||c.email||"-")}</td><td>${esc(p.service_name||"Service")}</td>
        <td>${money(p.amount)}</td><td>${esc(p.txnid||"-")}</td>
        <td><span class="yt-status-chip ${key(p.status)==="paid"?"good":key(p.status)==="failed"?"bad":"pending"}">${esc(p.status||"pending")}</span></td>
        <td>${esc(p.payment_mode||"-")}</td><td>${dateText(p.updated_at||p.created_at)}</td>
      </tr>`;
    }).join(""):'<tr><td colspan="7">No payments.</td></tr>';
  }
}
window.loadAdminRequestPaymentFlow=loadAdminRequestPaymentFlow;
loadAdminRequestPaymentFlow();
