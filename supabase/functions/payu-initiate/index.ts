import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha512(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PAYU_KEY = Deno.env.get("PAYU_KEY")!;
    const PAYU_SALT = Deno.env.get("PAYU_SALT")!;
    const PAYU_MODE = (Deno.env.get("PAYU_MODE") || "production").toLowerCase();

    if (!PAYU_KEY || !PAYU_SALT) throw new Error("PayU secrets are not configured.");

    const authHeader = req.headers.get("Authorization") || "";
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const jwt = authHeader.replace(/^Bearer\s+/i,"");
    const { data: { user }, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !user) return new Response(JSON.stringify({error:"Unauthorized"}), {status:401,headers:{...cors,"Content-Type":"application/json"}});

    const { payment_id } = await req.json();
    if (!payment_id) throw new Error("payment_id required.");

    const { data: customer, error: cErr } = await admin
      .from("customers").select("id,full_name,email,mobile").eq("user_id", user.id).single();
    if (cErr || !customer) throw new Error("Customer not found.");

    const { data: payment, error: pErr } = await admin
      .from("payments").select("*").eq("id", payment_id).eq("customer_id", customer.id).single();
    if (pErr || !payment) throw new Error("Payment not found.");
    if (String(payment.status).toLowerCase() === "paid") throw new Error("Payment already completed.");

    const amount = Number(payment.amount).toFixed(2);
    if (!(Number(amount) > 0)) throw new Error("Invalid payment amount.");

    const txnid = `YTCP${Date.now()}${crypto.randomUUID().replaceAll("-","").slice(0,8)}`;
    const productinfo = String(payment.service_name || "YT Creator Pro Service").slice(0,100);
    const firstname = String(customer.full_name || "Creator").trim().split(/\s+/)[0].slice(0,60) || "Creator";
    const email = customer.email || user.email || "";
    const phone = String(customer.mobile || "").replace(/\D/g,"").slice(-10);
    const udf1 = payment.id;
    const udf2 = payment.request_id;
    const udf3 = "", udf4 = "", udf5 = "";

    const callback = `${SUPABASE_URL}/functions/v1/payu-callback`;
    const hashString = `${PAYU_KEY}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${PAYU_SALT}`;
    const hash = await sha512(hashString);

    const { error: uErr } = await admin.from("payments").update({
      txnid, status:"initiated", updated_at:new Date().toISOString(), error_message:null
    }).eq("id", payment.id);
    if (uErr) throw uErr;

    const endpoint = PAYU_MODE === "test" ? "https://test.payu.in/_payment" : "https://secure.payu.in/_payment";
    const fields = {
      key:PAYU_KEY, txnid, amount, productinfo, firstname, email, phone,
      surl:callback, furl:callback, hash, udf1, udf2, udf3, udf4, udf5
    };

    return new Response(JSON.stringify({endpoint,fields}), {headers:{...cors,"Content-Type":"application/json"}});
  } catch (e) {
    return new Response(JSON.stringify({error:e?.message || "Payment initiation failed"}), {status:400,headers:{...cors,"Content-Type":"application/json"}});
  }
});
