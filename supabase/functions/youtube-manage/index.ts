const cors={
"Access-Control-Allow-Origin":"https://sumitkhobragade088-dotcom.github.io",
"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info",
"Access-Control-Allow-Methods":"POST, OPTIONS"};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response(null,{status:204,headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!, anon=Deno.env.get("SUPABASE_ANON_KEY")!, service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cid=Deno.env.get("GOOGLE_CLIENT_ID")!, secret=Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const auth=req.headers.get("Authorization"); if(!auth)return json({error:"Login required"},401);
  const ur=await fetch(`${url}/auth/v1/user`,{headers:{Authorization:auth,apikey:anon}});
  if(!ur.ok)return json({error:"Invalid session"},401);
  const user=await ur.json();
  const ar=await fetch(`${url}/rest/v1/admin_users?user_id=eq.${user.id}&select=user_id&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
  const admins=await ar.json(); if(!admins?.length)return json({error:"Admin access required"},403);
  const b=await req.json(); if(!b.customer_id)return json({error:"Customer missing"},400);
  const tr=await fetch(`${url}/rest/v1/youtube_oauth_tokens?customer_id=eq.${b.customer_id}&select=refresh_token&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
  const ts=await tr.json(); if(!ts?.length)return json({error:"YouTube token not found. Customer must reconnect."},404);
  const rr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cid,client_secret:secret,refresh_token:ts[0].refresh_token,grant_type:"refresh_token"})});
  const rt=await rr.json(); if(!rr.ok)return json({error:"Google refresh failed",details:rt.error_description||rt.error},400);
  const token=rt.access_token;
  if(b.action==="list_videos"){
   const cr=await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true",{headers:{Authorization:`Bearer ${token}`}});
   const cd=await cr.json(); const ch=cd.items?.[0]; if(!ch)return json({error:"Channel not found"},404);
   const uploads=ch.contentDetails?.relatedPlaylists?.uploads;
   const pr=await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50`,{headers:{Authorization:`Bearer ${token}`}});
   const pd=await pr.json(); const ids=(pd.items||[]).map((x:any)=>x.contentDetails.videoId).join(",");
   if(!ids)return json({channel_name:ch.snippet.title,videos:[]});
   const vr=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids}`,{headers:{Authorization:`Bearer ${token}`}});
   const vd=await vr.json();
   return json({channel_name:ch.snippet.title,videos:(vd.items||[]).map((v:any)=>({id:v.id,title:v.snippet.title,description:v.snippet.description,tags:v.snippet.tags||[],categoryId:v.snippet.categoryId,thumbnail:v.snippet.thumbnails?.medium?.url||v.snippet.thumbnails?.default?.url||""}))});
  }
  if(b.action==="update_video"){
   if(!b.video_id||!b.title)return json({error:"Video ID and title required"},400);
   const current=await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${encodeURIComponent(b.video_id)}`,{headers:{Authorization:`Bearer ${token}`}});
   const cd=await current.json(); const v=cd.items?.[0]; if(!v)return json({error:"Video not found"},404);
   const payload={id:b.video_id,snippet:{...v.snippet,title:b.title,description:b.description??v.snippet.description,tags:Array.isArray(b.tags)?b.tags:v.snippet.tags,categoryId:b.category_id||v.snippet.categoryId}};
   const up=await fetch("https://www.googleapis.com/youtube/v3/videos?part=snippet",{method:"PUT",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const ud=await up.json(); if(!up.ok)return json({error:"YouTube update failed",details:ud.error?.message||"Unknown error"},400);
   return json({success:true,video_id:ud.id,title:ud.snippet?.title});
  }
  return json({error:"Unknown action"},400);
 }catch(e){return json({error:"Server error",details:String(e)},500)}
});