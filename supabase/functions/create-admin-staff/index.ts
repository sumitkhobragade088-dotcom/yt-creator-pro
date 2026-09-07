import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
    const {data:{user},error:ue}=await auth.auth.getUser();
    if(ue||!user) return json({error:'Authentication required.'},401);
    const admin=createClient(url,service);
    const {data:sa}=await admin.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
    if(!sa || (user.email||'').toLowerCase()!=='sumitkhobragade088@gmail.com') return json({error:'Only Super Admin can create staff accounts.'},403);
    const body=await req.json(); const name=String(body.name||'').trim(); const email=String(body.email||'').trim().toLowerCase(); const role=String(body.role||'operator');
    if(name.length<2) return json({error:'Valid staff name is required.'},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Valid staff email is required.'},400);
    if(!['super_admin','manager','operator','support'].includes(role)) return json({error:'Invalid role.'},400);
    if(role==='super_admin' && email!=='sumitkhobragade088@gmail.com') return json({error:'Super Admin invitation is restricted to the primary Super Admin account.'},403);
    const {data:inv,error:ie}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:name,staff_role:role}});
    if(ie) return json({error:ie.message},400);
    const uid=inv.user.id;
    const {error:ae}=await admin.from('admin_users').upsert({user_id:uid},{onConflict:'user_id'});
    if(ae) return json({error:`Auth invite created but admin authorization failed: ${ae.message}`},500);
    const {error:pe}=await admin.from('admin_staff_profiles').upsert({user_id:uid,full_name:name,invited_email:email,invite_status:'invited',updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if(pe) return json({error:`Auth invite created but staff profile failed: ${pe.message}`},500);
    const {error:re}=await admin.from('admin_role_assignments').upsert({admin_user_id:uid,role,updated_at:new Date().toISOString()},{onConflict:'admin_user_id'});
    if(re) return json({error:`Auth invite created but role assignment failed: ${re.message}`},500);
    return json({ok:true,user_id:uid,email,role});
  }catch(e){ return json({error:e?.message||'Unexpected server error.'},500); }
});
