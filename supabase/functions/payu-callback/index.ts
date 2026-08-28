import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function sha512(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-512", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
}

const get = (p: URLSearchParams, key: string) => p.get(key) || "";

Deno.serve(async (req) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const PAYU_KEY = Deno.env.get("PAYU_KEY")!;
  const PAYU_SALT = Deno.env.get("PAYU_SALT")!;
  const SITE_URL = (Deno.env.get("SITE_URL") || "").replace(/\/+$/,"");

  const body = await req.text();
  const p = new URLSearchParams(body);

  const status = get(p,"status");
  const key = get(p,"key");
  const txnid = get(p,"txnid");
  const amount = get(p,"amount");
  const productinfo = get(p,"productinfo");
  const firstname = get(p,"firstname");
  const email = get(p,"email");
  const udf1 = get(p,"udf1"), udf2 = get(p,"udf2"), udf3 = get(p,"udf3"), udf4 = get(p,"udf4"), udf5 = get(p,"udf5");
  const receivedHash = get(p,"hash").toLowerCase();
  const additional = get(p,"additionalCharges") || get(p,"additional_charges");

  const reverseBase = `${PAYU_SALT}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  const reverseString = additional ? `${additional}|${reverseBase}` : reverseBase;
  const calculated = (await sha512(reverseString)).toLowerCase();
  const validHash = !!receivedHash && calculated === receivedHash && key === PAYU_KEY;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: payment } = await admin.from("payments").select("*").eq("id",udf1).eq("txnid",txnid).maybeSingle();

  let ok = false;
  if (validHash && payment && Number(payment.amount).toFixed(2) === Number(amount).toFixed(2)) {
    ok = status.toLowerCase() === "success";
    const raw: Record<string,string> = {};
    p.forEach((v,k)=>{ raw[k]=v; });
    await admin.from("payments").update({
      status: ok ? "paid" : ((get(p,"error_Message") || get(p,"error") || "").toLowerCase().includes("cancel") ? "cancelled" : "failed"),
      mihpayid:get(p,"mihpayid") || null,
      payment_mode:get(p,"mode") || null,
      error_message: ok ? null : (get(p,"error_Message") || get(p,"error") || "Payment failed"),
      raw_response:raw,
      updated_at:new Date().toISOString()
    }).eq("id",payment.id);
  } else if (payment) {
    await admin.from("payments").update({
      status:"failed",
      error_message: validHash ? "Payment amount mismatch" : "PayU response verification failed",
      updated_at:new Date().toISOString()
    }).eq("id",payment.id);
  }

  const target = SITE_URL
    ? `${SITE_URL}/dashboard.html?payment=${ok ? "success" : "failed"}`
    : "about:blank";
  return Response.redirect(target,303);
});
