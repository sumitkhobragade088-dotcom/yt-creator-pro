import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    if(!service) return json({error:'SUPABASE_SERVICE_ROLE_KEY is not configured.'},500);
    const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
    const {data:{user},error:ue}=await auth.auth.getUser();
    if(ue||!user) return json({error:'Authentication required.'},401);
    const admin=createClient(url,service);

    const {data:caller}=await admin.from('admin_users').select('id,email').eq('id',user.id).maybeSingle();
    if(!caller) return json({error:'Only Super Admin can create staff accounts.'},403);
    const {data:callerRole}=await admin.from('admin_staff_roles').select('role,status').eq('admin_id',user.id).maybeSingle();
    if(callerRole?.role!=='super_admin' || callerRole?.status!=='active') return json({error:'Only an active Super Admin can create staff accounts.'},403);

    const body=await req.json();
    const name=String(body.name||'').trim();
    const email=String(body.email||'').trim().toLowerCase();
    const role=String(body.role||'operator');
    const password=String(body.password||'');
    if(name.length<2) return json({error:'Valid staff name is required.'},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Valid staff email is required.'},400);
    if(!['manager','operator','support'].includes(role)) return json({error:'Only Manager, Operator or Support can be created as staff.'},400);
    if(password.length<8) return json({error:'Temporary password must be at least 8 characters.'},400);

    const {data:existing,error:existingError}=await admin.auth.admin.listUsers({page:1,perPage:1000});
    if(existingError) return json({error:`Unable to check existing accounts: ${existingError.message}`},502);
    const duplicate=(existing?.users||[]).find(u=>(u.email||'').toLowerCase()===email);
    if(duplicate) return json({error:'An account with this email already exists. Create Staff requires a new email, or use Assign Role for an existing authorized account.'},409);

    const {data:created,error:ce}=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name:name,staff_role:role}});
    if(ce||!created?.user) return json({error:`Unable to create staff Auth account: ${ce?.message||'Unknown Auth error.'}`},400);
    const uid=created.user.id;

    const {error:ae}=await admin.from('admin_users').upsert({id:uid,email},{onConflict:'id'});
    if(ae){ await admin.auth.admin.deleteUser(uid); return json({error:`Staff authorization failed: ${ae.message}`},500); }
    const {error:re}=await admin.from('admin_staff_roles').upsert({admin_id:uid,role,status:'active',updated_at:new Date().toISOString()},{onConflict:'admin_id'});
    if(re){ await admin.from('admin_users').delete().eq('id',uid); await admin.auth.admin.deleteUser(uid); return json({error:`Role assignment failed: ${re.message}`},500); }
    const {error:pe}=await admin.from('admin_staff_profiles').upsert({admin_id:uid,full_name:name,invited_email:email,invite_status:'active',updated_at:new Date().toISOString()},{onConflict:'admin_id'});
    if(pe){ /* Keep account authorized even if optional profile metadata fails. */ }

    return json({ok:true,user_id:uid,email,role});
  }catch(e){ return json({error:e instanceof Error?e.message:'Unexpected server error.'},500); }
});
