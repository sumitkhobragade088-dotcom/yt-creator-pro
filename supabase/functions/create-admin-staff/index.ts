import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});

Deno.serve(async req=>{
  if(req.method==='OPTIONS') return new Response('ok',{headers:cors});
  try{
    const url=Deno.env.get('SUPABASE_URL')!, anon=Deno.env.get('SUPABASE_ANON_KEY')!, service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const auth=createClient(url,anon,{global:{headers:{Authorization:req.headers.get('Authorization')||''}}});
    const {data:{user},error:ue}=await auth.auth.getUser();
    if(ue||!user) return json({error:'Authentication required.'},401);

    const admin=createClient(url,service);
    const {data:me,error:meErr}=await admin.from('admin_users').select('id,email').eq('id',user.id).maybeSingle();
    if(meErr||!me) return json({error:'You are not an authorized admin.'},403);
    const {data:myRole}=await admin.from('admin_role_assignments').select('role').eq('admin_user_id',user.id).maybeSingle();
    if(myRole?.role!=='super_admin' && (user.email||'').toLowerCase()!=='sumitkhobragade088@gmail.com') return json({error:'Only Super Admin can create staff accounts.'},403);

    const body=await req.json();
    const name=String(body.name||'').trim();
    const email=String(body.email||'').trim().toLowerCase();
    const role=String(body.role||'operator');
    if(name.length<2) return json({error:'Valid staff name is required.'},400);
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({error:'Valid staff email is required.'},400);
    if(!['manager','operator','support'].includes(role)) return json({error:'Staff role must be Manager, Operator or Support.'},400);

    const {data:existing}=await admin.from('admin_users').select('id,email').ilike('email',email).maybeSingle();
    if(existing) return json({error:'This email is already an authorized admin/staff account.'},409);

    const {data:inv,error:ie}=await admin.auth.admin.inviteUserByEmail(email,{data:{full_name:name,staff_role:role}});
    if(ie||!inv?.user) return json({error:ie?.message||'Unable to create invitation.'},400);
    const uid=inv.user.id;

    const {error:ae}=await admin.from('admin_users').insert({id:uid,email});
    if(ae) return json({error:`Invitation created but admin authorization failed: ${ae.message}`},500);
    const {error:re}=await admin.from('admin_role_assignments').insert({admin_user_id:uid,role});
    if(re){ await admin.from('admin_users').delete().eq('id',uid); return json({error:`Invitation created but role assignment failed: ${re.message}`},500); }

    return json({ok:true,user_id:uid,email,role,name});
  }catch(e){ return json({error:e instanceof Error?e.message:'Unexpected server error.'},500); }
});
