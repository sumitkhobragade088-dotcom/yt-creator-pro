const cors={"Access-Control-Allow-Origin":"https://sumitkhobragade088-dotcom.github.io","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"};
const J=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const H=(token:string)=>({Authorization:`Bearer ${token}`});
async function gj(url:string,token:string,init:any={}){const r=await fetch(url,{...init,headers:{...(init.headers||{}),...H(token)}});const d=r.status===204?{}:await r.json();if(!r.ok)throw new Error(d?.error?.message||`YouTube HTTP ${r.status}`);return d}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,cid="699096777627-ch5ds0kau6qej3m91mfi0mk7dbdjgppe.apps.googleusercontent.com",secret=Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const auth=req.headers.get("Authorization");if(!auth)return J({error:"Login required"},401);
  const ur=await fetch(`${url}/auth/v1/user`,{headers:{Authorization:auth,apikey:anon}});if(!ur.ok)return J({error:"Invalid session"},401);const user=await ur.json();
  const adminFilter = user.email ? `or=(id.eq.${user.id},email.eq.${encodeURIComponent(user.email)})` : `id=eq.${user.id}`;
  const ar=await fetch(`${url}/rest/v1/admin_users?${adminFilter}&select=id,email&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
  const admins=await ar.json();if(!admins?.length)return J({error:"Admin access required",details:"Logged-in admin was not found in admin_users."},403);
  const b=await req.json();if(!b.customer_id)return J({error:"Customer missing"},400);
  const tr=await fetch(`${url}/rest/v1/youtube_oauth_tokens?customer_id=eq.${b.customer_id}&select=refresh_token&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});const ts=await tr.json();if(!ts?.length)return J({error:"YouTube token not found. Customer must reconnect."},404);
  const rr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cid,client_secret:secret,refresh_token:ts[0].refresh_token,grant_type:"refresh_token"})});const rt=await rr.json();if(!rr.ok)return J({error:"Google refresh failed",details:(rt.error_description||rt.error)+" — Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in Supabase Edge Function secrets; they must belong to the same Google OAuth Web Client used by the website."},400);const token=rt.access_token;


  if(b.action==="get_manager_access"){
    const ar=await fetch(`${url}/rest/v1/channel_access?customer_id=eq.${encodeURIComponent(b.customer_id)}&select=manager_access&limit=1`,{
      headers:{apikey:service,Authorization:`Bearer ${service}`}
    });
    const rows=await ar.json();
    if(!ar.ok)return J({error:"Manager access status read failed",details:rows},400);
    return J({success:true,manager_access:!!rows?.[0]?.manager_access});
  }

  if(b.action==="set_manager_access"){
    const value=!!b.manager_access;

    // Permanent upsert: create row if missing, update if it already exists.
    const ur=await fetch(`${url}/rest/v1/channel_access?on_conflict=customer_id`,{
      method:"POST",
      headers:{
        apikey:service,
        Authorization:`Bearer ${service}`,
        "Content-Type":"application/json",
        Prefer:"resolution=merge-duplicates,return=representation"
      },
      body:JSON.stringify({
        customer_id:b.customer_id,
        manager_access:value,
        updated_at:new Date().toISOString()
      })
    });

    const rows=await ur.json();
    if(!ur.ok)return J({error:"Manager access save failed",details:rows},400);
    return J({success:true,manager_access:value});
  }

  if(b.action==="dashboard"){
   const cd=await gj("https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,statistics,contentDetails&mine=true",token);const ch=cd.items?.[0];if(!ch)return J({error:"Channel not found"},404);
   const uploads=ch.contentDetails?.relatedPlaylists?.uploads;
   let ids:string[]=[];if(uploads){const pd=await gj(`https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=50`,token);ids=(pd.items||[]).map((x:any)=>x.contentDetails?.videoId).filter(Boolean)}
   let videos:any[]=[];if(ids.length){const vd=await gj(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics,contentDetails,liveStreamingDetails&id=${ids.join(",")}`,token);videos=(vd.items||[]).map((v:any)=>({id:v.id,title:v.snippet?.title||"",description:v.snippet?.description||"",tags:v.snippet?.tags||[],categoryId:v.snippet?.categoryId||"22",thumbnail:v.snippet?.thumbnails?.medium?.url||v.snippet?.thumbnails?.default?.url||"",privacyStatus:v.status?.privacyStatus||"",
liveBroadcastContent:v.snippet?.liveBroadcastContent||"none",
isLive:v.snippet?.liveBroadcastContent==="live",
hadLiveStream:!!v.liveStreamingDetails,
duration:v.contentDetails?.duration||"PT0S",
durationSeconds:(()=>{const m=String(v.contentDetails?.duration||"PT0S").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);return m?((Number(m[1]||0)*86400)+(Number(m[2]||0)*3600)+(Number(m[3]||0)*60)+Number(m[4]||0)):0})(),
status:{uploadStatus:v.status?.uploadStatus||"",license:v.status?.license||"",embeddable:v.status?.embeddable},
views:v.statistics?.viewCount||0,comments:v.statistics?.commentCount||0,publishedAt:v.snippet?.publishedAt||"",
restrictions:{regionBlocked:!!(v.contentDetails?.regionRestriction?.blocked?.length)}}))}
   const pl=await gj("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status,contentDetails&mine=true&maxResults=50",token);const playlists=(pl.items||[]).map((p:any)=>({id:p.id,title:p.snippet?.title||"",description:p.snippet?.description||"",privacyStatus:p.status?.privacyStatus||"",itemCount:p.contentDetails?.itemCount||0,thumbnail:p.snippet?.thumbnails?.medium?.url||p.snippet?.thumbnails?.default?.url||"",publishedAt:p.snippet?.publishedAt||""}));
   return J({channel:{channelId:ch.id,title:ch.snippet?.title||"",description:ch.snippet?.description||"",keywords:ch.brandingSettings?.channel?.keywords||"",bannerUrl:ch.brandingSettings?.image?.bannerExternalUrl||"",subscribers:ch.statistics?.subscriberCount||0,views:ch.statistics?.viewCount||0,videos:ch.statistics?.videoCount||0},videos,playlists,copyright_note:"Copyright claim details are not exposed by YouTube Data API; use YouTube Studio for exact claims."});
  }

  if(b.action==="set_channel_banner"){
    const bytes=Uint8Array.from(atob(b.data_base64||""),c=>c.charCodeAt(0));
    if(!bytes.length)return J({error:"Banner image missing"},400);
    const up=await fetch("https://www.googleapis.com/upload/youtube/v3/channelBanners/insert?uploadType=media",{
      method:"POST",
      headers:{...H(token),"Content-Type":b.mime_type||"image/jpeg"},
      body:bytes
    });
    const ud=await up.json();
    if(!up.ok)return J({error:"Banner upload failed",details:ud?.error?.message||up.status},400);
    const bannerUrl=ud?.url;
    if(!bannerUrl)return J({error:"YouTube banner URL missing"},500);

    const current=await gj("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&mine=true",token);
    const ch=current.items?.[0];
    if(!ch)return J({error:"Channel not found"},404);
    const branding=ch.brandingSettings||{};
    branding.image={...(branding.image||{}),bannerExternalUrl:bannerUrl};

    await gj("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings",token,{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({id:ch.id,brandingSettings:branding})
    });
    return J({success:true,banner_url:bannerUrl});
  }

  if(b.action==="update_channel"){const current=await gj("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings&mine=true",token);const ch=current.items?.[0];if(!ch)return J({error:"Channel not found"},404);const branding=ch.brandingSettings||{};branding.channel={...(branding.channel||{}),description:String(b.description||""),keywords:String(b.keywords||"")};await gj("https://www.googleapis.com/youtube/v3/channels?part=brandingSettings",token,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:ch.id,brandingSettings:branding})});return J({success:true})}
  if(b.action==="update_video"){const cur=await gj(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status&id=${encodeURIComponent(b.video_id)}`,token);const v=cur.items?.[0];if(!v)return J({error:"Video not found"},404);const snippet={...v.snippet,title:b.title,description:b.description??v.snippet.description,categoryId:b.category_id||v.snippet.categoryId};if(Array.isArray(b.tags))snippet.tags=b.tags;const status={...v.status,privacyStatus:b.privacy_status||v.status?.privacyStatus};await gj("https://www.googleapis.com/youtube/v3/videos?part=snippet,status",token,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:b.video_id,snippet,status})});return J({success:true})}
  if(b.action==="delete_video"){await gj(`https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(b.video_id)}`,token,{method:"DELETE"});return J({success:true})}
  if(b.action==="set_thumbnail"){const bytes=Uint8Array.from(atob(b.data_base64||""),c=>c.charCodeAt(0));const r=await fetch(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(b.video_id)}&uploadType=media`,{method:"POST",headers:{...H(token),"Content-Type":b.mime_type||"image/jpeg"},body:bytes});const d=await r.json();if(!r.ok)return J({error:"Thumbnail update failed",details:d?.error?.message||r.status},400);return J({success:true})}

  if(b.action==="delete_playlist"){
    if(!b.playlist_id)return J({error:"Playlist ID missing"},400);
    await gj(`https://www.googleapis.com/youtube/v3/playlists?id=${encodeURIComponent(b.playlist_id)}`,token,{method:"DELETE"});
    return J({success:true});
  }

  if(b.action==="create_playlist"){const d=await gj("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:b.title,description:b.description||""},status:{privacyStatus:b.privacy_status||"private"}})});return J({success:true,id:d.id})}
  if(b.action==="update_playlist"){const d=await gj(`https://www.googleapis.com/youtube/v3/playlists?part=snippet,status&id=${encodeURIComponent(b.playlist_id)}`,token);const p=d.items?.[0];if(!p)return J({error:"Playlist not found"},404);await gj("https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",token,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:b.playlist_id,snippet:{...p.snippet,title:b.title,description:b.description||""},status:{...p.status,privacyStatus:b.privacy_status||p.status?.privacyStatus}})});return J({success:true})}
  if(b.action==="start_upload"){const uploadTags=Array.isArray(b.tags)?b.tags:[];
const meta={snippet:{title:b.title,description:b.description||"",tags:uploadTags,categoryId:b.category_id||"22"},status:{privacyStatus:b.privacy_status||"private"}};const r=await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",{method:"POST",headers:{...H(token),"Content-Type":"application/json; charset=UTF-8","X-Upload-Content-Type":b.mime_type||"application/octet-stream","X-Upload-Content-Length":String(b.file_size||0)},body:JSON.stringify(meta)});if(!r.ok){const d=await r.json();return J({error:"Upload session failed",details:d?.error?.message||r.status},400)}const loc=r.headers.get("Location");if(!loc)return J({error:"Google upload URL missing"},500);return J({success:true,upload_url:loc})}
  return J({error:"Unknown action"},400);
 }catch(e){console.error(e);return J({error:"Server error",details:String(e)},500)}
});