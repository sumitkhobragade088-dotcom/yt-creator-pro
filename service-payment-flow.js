import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const money = (n) => `₹${Number(n || 0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
const esc = (v="") => String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const statusKey = (v) => String(v || "pending").toLowerCase();

async function currentCustomer(){
  const { data:{ user } } = await supabase.auth.getUser();
  if(!user) return null;
  const { data } = await supabase.from("customers").select("id").eq("user_id",user.id).maybeSingle();
  return data || null;
}

async function openPayU(paymentId, button){
  const old = button?.textContent || "";
  if(button){ button.disabled=true; button.textContent="Opening PayU..."; }
  try{
    const { data, error } = await supabase.functions.invoke("payu-initiate",{body:{payment_id:paymentId}});
    if(error) throw error;
    if(!data?.endpoint || !data?.fields) throw new Error(data?.error || "Payment gateway response invalid.");
    const form=document.createElement("form");
    form.method="POST"; form.action=data.endpoint; form.style.display="none";
    Object.entries(data.fields).forEach(([name,value])=>{
      const input=document.createElement("input");
      input.type="hidden"; input.name=name; input.value=value ?? "";
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }catch(e){
    alert(e?.message || "PayU payment start nahi hua.");
    if(button){ button.disabled=false; button.textContent=old; }
  }
}

async function waitForPayment(requestId, customerId){
  for(let i=0;i<12;i++){
    const {data,error}=await supabase.from("payments")
      .select("id,status,amount")
      .eq("request_id",requestId).eq("customer_id",customerId).maybeSingle();
    if(!error && data) return data;
    await new Promise(r=>setTimeout(r,250));
  }
  return null;
}

async function submitAndPay(){
  const btn=$("submitPaidServiceRequest");
  const select=$("userServiceType");
  const msg=$("userServiceRequestMessage");
  const service=select?.value || "";
  if(!service){ if(msg) msg.textContent="Please select a service."; return; }

  const customer=await currentCustomer();
  if(!customer){ if(msg) msg.textContent="Customer profile not found."; return; }

  btn.disabled=true;
  if(msg) msg.textContent="Creating payment...";
  try{
    const {data:req,error}=await supabase.from("service_requests")
      .insert({customer_id:customer.id,service_type:service,status:"pending"})
      .select("id").single();
    if(error) throw error;

    const payment=await waitForPayment(req.id,customer.id);
    if(!payment){
      // Keep the request hidden from My Requests; admin paid-request queue also hides it.
      throw new Error("Payment record create nahi hua. Service Charge check karein.");
    }
    await openPayU(payment.id,btn);
  }catch(e){
    if(msg) msg.textContent=e?.message || "Request/payment start failed.";
    btn.disabled=false;
  }
}

function paymentActionLabel(status){
  if(status==="failed") return "Retry Payment";
  if(status==="cancelled" || status==="canceled") return "Pay Again";
  return "Pay Now";
}

async function loadPaidRequestsAndPayments(){
  const customer=await currentCustomer();
  if(!customer) return;

  const [{data:reqs,error:rErr},{data:payments,error:pErr}] = await Promise.all([
    supabase.from("service_requests").select("id,service_type,status,created_at").eq("customer_id",customer.id).order("created_at",{ascending:false}),
    supabase.from("payments").select("id,request_id,service_name,amount,currency,status,txnid,mihpayid,error_message,created_at,updated_at").eq("customer_id",customer.id).order("created_at",{ascending:false})
  ]);
  if(rErr) console.error("Requests:",rErr);
  if(pErr) console.error("Payments:",pErr);

  const paidIds=new Set((payments||[]).filter(p=>statusKey(p.status)==="paid").map(p=>p.request_id));
  const paidRequests=(reqs||[]).filter(r=>paidIds.has(r.id));

  const requestBox=$("paidRequestList");
  if(requestBox){
    requestBox.innerHTML=paidRequests.length ? paidRequests.map(r=>`
      <div class="request-row">
        <div><b>${esc(r.service_type||"Service")}</b><small>${new Date(r.created_at).toLocaleString("en-IN")}</small></div>
        <span class="yt-request-status ${esc(statusKey(r.status))}">${esc(r.status||"pending")}</span>
      </div>`).join("") : "<p>No paid service requests yet.</p>";
  }

  const paymentBox=$("userPaymentsList");
  if(paymentBox){
    paymentBox.innerHTML=(payments||[]).length ? (payments||[]).map(p=>{
      const st=statusKey(p.status);
      const canPay=st!=="paid";
      return `<div class="request-row yt-request-payment-row">
        <div>
          <b>${esc(p.service_name||"Service")}</b>
          <small>${money(p.amount)} · ${esc(p.txnid||"Transaction not started")}</small>
        </div>
        <div class="yt-payment-actions">
          <span class="yt-pay-chip ${st==="paid"?"paid":st==="failed"?"failed":"pending"}">${esc(st.toUpperCase())}</span>
          ${canPay?`<button type="button" class="yt-user-red-btn" data-retry-payment="${esc(p.id)}">${paymentActionLabel(st)}</button>`:""}
        </div>
      </div>`;
    }).join("") : "<p>No payment records yet.</p>";

    paymentBox.querySelectorAll("[data-retry-payment]").forEach(b=>{
      b.addEventListener("click",()=>openPayU(b.dataset.retryPayment,b));
    });
  }

  // PayU callback result: success -> My Requests, otherwise Payments.
  const params=new URLSearchParams(location.search);
  const result=params.get("payment");
  if(result){
    const success=result==="success";
    const target=success?"requests":"payments";
    sessionStorage.setItem("yt_user_view",target);
    if(typeof window.openUserView==="function") window.openUserView(target);
    const box=$("userPaymentResultNew");
    if(box){
      box.hidden=false;
      box.className=`yt-payment-result ${success?"success":"failed"}`;
      box.textContent=success?"Payment successful ✅ Request My Requests me add ho gaya.":"Payment complete nahi hua. Yahan se Retry / Pay Again karein.";
    }
    history.replaceState({},"","dashboard.html");
  }
}

$("submitPaidServiceRequest")?.addEventListener("click",submitAndPay);
loadPaidRequestsAndPayments();
