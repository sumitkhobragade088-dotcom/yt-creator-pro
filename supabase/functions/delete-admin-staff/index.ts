import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
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
    const {data:caller}=await admin.from('admin_users').select('id,email,status').eq('id',user.id).maybeSingle();
    if(!caller || String(caller.status||'active').toLowerCase()!=='active' || String(caller.email||'').toLowerCase()!=='sumitkhobragade088@gmail.com') return json({error:'Only the active Super Admin can delete staff users.'},403);
    const body=await req.json();
    const adminId=String(body.admin_id||'').trim();
    if(!adminId) return json({error:'Staff user ID is required.'},400);
    if(adminId===user.id) return json({error:'Your Super Admin account is protected.'},403);
    const {data:staff}=await admin.from('admin_staff_roles').select('admin_id,role').eq('admin_id',adminId).maybeSingle();
    if(!staff || !['manager','operator','support'].includes(String(staff.role||''))) return json({error:'Only Manager, Operator or Support staff can be deleted here.'},404);
    const {error:profileError}=await admin.from('admin_staff_profiles').delete().eq('admin_id',adminId);
    if(profileError) return json({error:`Staff profile deletion failed: ${profileError.message}`},500);
    const {error:roleError}=await admin.from('admin_staff_roles').delete().eq('admin_id',adminId);
    if(roleError) return json({error:`Staff role deletion failed: ${roleError.message}`},500);
    const {error:adminError}=await admin.from('admin_users').delete().eq('id',adminId);
    if(adminError) return json({error:`Admin authorization deletion failed: ${adminError.message}`},500);
    const {error:authError}=await admin.auth.admin.deleteUser(adminId);
    if(authError) return json({error:`Auth account deletion failed: ${authError.message}`},500);
    return json({ok:true,user_id:adminId,role:staff.role});
  }catch(e){return json({error:e instanceof Error?e.message:'Unexpected server error.'},500);}
});
