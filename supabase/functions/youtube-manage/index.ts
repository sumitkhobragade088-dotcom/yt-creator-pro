const allowedOrigins=new Set(["https://khobragade.online","https://www.khobragade.online","https://sumitkhobragade088-dotcom.github.io"]);
const corsFor=(req:Request)=>{const o=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":allowedOrigins.has(o)?o:"https://khobragade.online","Vary":"Origin","Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info","Access-Control-Allow-Methods":"POST, OPTIONS"}};
let cors:Record<string,string>={};

const J=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,"Content-Type":"application/json"}});
const H=(token:string)=>({Authorization:`Bearer ${token}`});
async function gj(url:string,token:string,init:any={}){const r=await fetch(url,{...init,headers:{...(init.headers||{}),...H(token)}});const d=r.status===204?{}:await r.json();if(!r.ok)throw new Error(d?.error?.message||`YouTube HTTP ${r.status}`);return d}
Deno.serve(async req=>{
 cors=corsFor(req);
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 try{
  const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,cid="699096777627-ch5ds0kau6qej3m91mfi0mk7dbdjgppe.apps.googleusercontent.com",secret=Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const auth=req.headers.get("Authorization");if(!auth)return J({error:"Login required"},401);
  const ur=await fetch(`${url}/auth/v1/user`,{headers:{Authorization:auth,apikey:anon}});if(!ur.ok)return J({error:"Invalid session"},401);const user=await ur.json();
  const canonicalAdminEmail="sumitkhobragade088@gmail.com";
  const isCanonicalAdmin=String(user.email||"").toLowerCase()===canonicalAdminEmail;
  if(!isCanonicalAdmin){
    const adminFilter = user.email ? `or=(id.eq.${user.id},email.eq.${encodeURIComponent(user.email)})` : `id=eq.${user.id}`;
    const ar=await fetch(`${url}/rest/v1/admin_users?${adminFilter}&select=id,email&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});
    const admins=await ar.json();
    if(!admins?.length)return J({error:"Admin access required",details:"Logged-in account is not authorized for channel management."},403);
  }
  const b=await req.json();

  // Public YouTube oEmbed metadata, still protected by Admin login above. No channel token is required.
  if(b.action==="oembed_fetch"){
    const raw=String(b.url||"").trim();if(!raw)return J({error:"YouTube URL required"},400);
    let u:URL;try{u=new URL(raw)}catch(_){return J({error:"Invalid YouTube URL"},400)}
    const host=u.hostname.toLowerCase().replace(/^www\./,"");
    const allowed=host==="youtube.com"||host==="youtu.be"||host==="music.youtube.com"||host==="m.youtube.com";
    if(!allowed)return J({error:"Only YouTube URLs are allowed"},400);
    const oe=new URL("https://www.youtube.com/oembed");oe.searchParams.set("url",raw);oe.searchParams.set("format","json");
    const rr=await fetch(oe.toString(),{headers:{Accept:"application/json"}});let d:any={};try{d=await rr.json()}catch{}
    if(!rr.ok)return J({error:"YouTube oEmbed request failed",details:d?.error||d?.message||`HTTP ${rr.status}`},400);
    return J({success:true,oembed:d,fetchedAt:new Date().toISOString()});
  }

  if(!b.customer_id)return J({error:"Customer missing"},400);

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

  const tr=await fetch(`${url}/rest/v1/youtube_oauth_tokens?customer_id=eq.${b.customer_id}&select=refresh_token&limit=1`,{headers:{apikey:service,Authorization:`Bearer ${service}`}});const ts=await tr.json();if(!ts?.length)return J({error:"YouTube token not found. Customer must reconnect."},404);
  const rr=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:cid,client_secret:secret,refresh_token:ts[0].refresh_token,grant_type:"refresh_token"})});const rt=await rr.json();if(!rr.ok)return J({error:"Google refresh failed",details:(rt.error_description||rt.error)+" — Check GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET in Supabase Edge Function secrets; they must belong to the same Google OAuth Web Client used by the website."},400);const token=rt.access_token;


  // ---------- YouTube Reporting API ----------
  if(b.action==="reporting_types"){
    const d=await gj("https://youtubereporting.googleapis.com/v1/reportTypes?includeSystemManaged=true",token);
    return J({success:true,reportTypes:(d.reportTypes||[]).map((x:any)=>({id:x.id,name:x.name||x.id,systemManaged:!!x.systemManaged}))});
  }
  if(b.action==="reporting_list"){
    const d=await gj("https://youtubereporting.googleapis.com/v1/jobs?pageSize=100",token);
    return J({success:true,jobs:(d.jobs||[]).map((x:any)=>({id:x.id,name:x.name,reportTypeId:x.reportTypeId,createTime:x.createTime,expireTime:x.expireTime}))});
  }
  if(b.action==="reporting_create"){
    if(!b.report_type_id||!b.name)return J({error:"Report type and job name required"},400);
    const d=await gj("https://youtubereporting.googleapis.com/v1/jobs",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reportTypeId:String(b.report_type_id),name:String(b.name)})});
    return J({success:true,job:d});
  }
  if(b.action==="reporting_delete"){
    if(!b.job_id)return J({error:"Reporting job ID missing"},400);
    await gj(`https://youtubereporting.googleapis.com/v1/jobs/${encodeURIComponent(b.job_id)}`,token,{method:"DELETE"});
    return J({success:true});
  }
  if(b.action==="reporting_reports"){
    if(!b.job_id)return J({error:"Reporting job ID missing"},400);
    const d=await gj(`https://youtubereporting.googleapis.com/v1/jobs/${encodeURIComponent(b.job_id)}/reports?pageSize=100`,token);
    return J({success:true,reports:(d.reports||[]).map((x:any)=>({id:x.id,jobId:x.jobId,startTime:x.startTime,endTime:x.endTime,createTime:x.createTime,downloadUrl:x.downloadUrl}))});
  }
  if(b.action==="reporting_preview"){
    const raw=String(b.download_url||"");
    let u:URL;try{u=new URL(raw)}catch(_){return J({error:"Invalid report URL"},400)}
    if(!["youtubereporting.googleapis.com","www.googleapis.com"].includes(u.hostname) && !u.hostname.endsWith(".googleapis.com"))return J({error:"Report URL not allowed"},400);
    const r=await fetch(raw,{headers:H(token)});if(!r.ok)return J({error:"Report download failed",details:`HTTP ${r.status}`},400);
    const text=await r.text();return J({success:true,text:text.slice(0,100000),truncated:text.length>100000});
  }

  // ---------- YouTube Live Streaming ----------
  if(b.action==="live_list"){
    const bd=await gj("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status,contentDetails&broadcastStatus=all&mine=true&maxResults=50",token);
    const sd=await gj("https://www.googleapis.com/youtube/v3/liveStreams?part=id,snippet,status,cdn&mine=true&maxResults=50",token);
    return J({success:true,
      broadcasts:(bd.items||[]).map((x:any)=>({id:x.id,title:x.snippet?.title||"",description:x.snippet?.description||"",scheduledStartTime:x.snippet?.scheduledStartTime||"",actualStartTime:x.snippet?.actualStartTime||"",actualEndTime:x.snippet?.actualEndTime||"",lifeCycleStatus:x.status?.lifeCycleStatus||"",privacyStatus:x.status?.privacyStatus||"",recordingStatus:x.status?.recordingStatus||"",liveChatId:x.snippet?.liveChatId||"",boundStreamId:x.contentDetails?.boundStreamId||"",enableAutoStart:!!x.contentDetails?.enableAutoStart,enableAutoStop:!!x.contentDetails?.enableAutoStop})),
      streams:(sd.items||[]).map((x:any)=>({id:x.id,title:x.snippet?.title||"",description:x.snippet?.description||"",status:x.status?.streamStatus||"",healthStatus:x.status?.healthStatus?.status||"",resolution:x.cdn?.resolution||"variable",frameRate:x.cdn?.frameRate||"variable",ingestionType:x.cdn?.ingestionType||"rtmp",ingestionAddress:x.cdn?.ingestionInfo?.ingestionAddress||"",backupIngestionAddress:x.cdn?.ingestionInfo?.backupIngestionAddress||"",streamName:x.cdn?.ingestionInfo?.streamName||""}))});
  }
  if(b.action==="live_create_broadcast"){
    if(!b.title||!b.scheduled_start_time)return J({error:"Title and scheduled start time required"},400);
    const d=await gj("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:String(b.title),description:String(b.description||""),scheduledStartTime:String(b.scheduled_start_time)},status:{privacyStatus:String(b.privacy_status||"private")},contentDetails:{enableAutoStart:!!b.enable_auto_start,enableAutoStop:!!b.enable_auto_stop}})});
    return J({success:true,broadcast:d});
  }
  if(b.action==="live_update_broadcast"){
    if(!b.broadcast_id)return J({error:"Broadcast ID missing"},400);
    const cur=await gj(`https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails&id=${encodeURIComponent(b.broadcast_id)}`,token);const x=cur.items?.[0];if(!x)return J({error:"Broadcast not found"},404);
    const body={id:x.id,snippet:{...x.snippet,title:String(b.title||x.snippet?.title||""),description:String(b.description??x.snippet?.description??""),scheduledStartTime:String(b.scheduled_start_time||x.snippet?.scheduledStartTime||"")},status:{...x.status,privacyStatus:String(b.privacy_status||x.status?.privacyStatus||"private")},contentDetails:{...x.contentDetails,enableAutoStart:!!b.enable_auto_start,enableAutoStop:!!b.enable_auto_stop}};
    const d=await gj("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails",token,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return J({success:true,broadcast:d});
  }
  if(b.action==="live_delete_broadcast"){
    if(!b.broadcast_id)return J({error:"Broadcast ID missing"},400);await gj(`https://www.googleapis.com/youtube/v3/liveBroadcasts?id=${encodeURIComponent(b.broadcast_id)}`,token,{method:"DELETE"});return J({success:true});
  }
  if(b.action==="live_transition"){
    if(!b.broadcast_id||!["testing","live","complete"].includes(String(b.status)))return J({error:"Broadcast ID/status invalid"},400);
    const d=await gj(`https://www.googleapis.com/youtube/v3/liveBroadcasts/transition?broadcastStatus=${encodeURIComponent(b.status)}&id=${encodeURIComponent(b.broadcast_id)}&part=status`,token,{method:"POST"});return J({success:true,broadcast:d});
  }
  if(b.action==="live_create_stream"){
    if(!b.title)return J({error:"Stream title required"},400);
    const d=await gj("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,status",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snippet:{title:String(b.title),description:String(b.description||"")},cdn:{frameRate:String(b.frame_rate||"variable"),ingestionType:String(b.ingestion_type||"rtmp"),resolution:String(b.resolution||"variable")}})});return J({success:true,stream:d});
  }
  if(b.action==="live_update_stream"){
    if(!b.stream_id)return J({error:"Stream ID missing"},400);
    const cur=await gj(`https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn&id=${encodeURIComponent(b.stream_id)}`,token);const x=cur.items?.[0];if(!x)return J({error:"Stream not found"},404);
    const body={id:x.id,snippet:{...x.snippet,title:String(b.title||x.snippet?.title||""),description:String(b.description??x.snippet?.description??"")},cdn:{...x.cdn,frameRate:String(b.frame_rate||x.cdn?.frameRate||"variable"),ingestionType:String(x.cdn?.ingestionType||"rtmp"),resolution:String(b.resolution||x.cdn?.resolution||"variable")}};
    const d=await gj("https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn",token,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});return J({success:true,stream:d});
  }
  if(b.action==="live_delete_stream"){
    if(!b.stream_id)return J({error:"Stream ID missing"},400);await gj(`https://www.googleapis.com/youtube/v3/liveStreams?id=${encodeURIComponent(b.stream_id)}`,token,{method:"DELETE"});return J({success:true});
  }
  if(b.action==="live_bind"){
    if(!b.broadcast_id||!b.stream_id)return J({error:"Broadcast and stream IDs required"},400);
    const d=await gj(`https://www.googleapis.com/youtube/v3/liveBroadcasts/bind?id=${encodeURIComponent(b.broadcast_id)}&part=id,contentDetails&streamId=${encodeURIComponent(b.stream_id)}`,token,{method:"POST"});return J({success:true,broadcast:d});
  }

  // ---------- YouTube Live Chat ----------
  if(b.action==="chat_broadcasts"){
    const d=await gj("https://www.googleapis.com/youtube/v3/liveBroadcasts?part=id,snippet,status&broadcastStatus=all&mine=true&maxResults=50",token);
    return J({success:true,broadcasts:(d.items||[]).map((x:any)=>({id:x.id,title:x.snippet?.title||"",lifeCycleStatus:x.status?.lifeCycleStatus||"",scheduledStartTime:x.snippet?.scheduledStartTime||"",liveChatId:x.snippet?.liveChatId||""}))});
  }
  if(b.action==="chat_messages"){
    if(!b.live_chat_id)return J({error:"Live chat ID missing"},400);
    const u=new URL("https://www.googleapis.com/youtube/v3/liveChat/messages");u.searchParams.set("part","id,snippet,authorDetails");u.searchParams.set("liveChatId",String(b.live_chat_id));u.searchParams.set("maxResults","200");if(b.page_token)u.searchParams.set("pageToken",String(b.page_token));
    const d=await gj(u.toString(),token);return J({success:true,nextPageToken:d.nextPageToken||"",pollingIntervalMillis:d.pollingIntervalMillis||5000,messages:(d.items||[]).map((x:any)=>({id:x.id,type:x.snippet?.type||"",text:x.snippet?.displayMessage||x.snippet?.textMessageDetails?.messageText||"",publishedAt:x.snippet?.publishedAt||"",authorName:x.authorDetails?.displayName||"",authorChannelId:x.authorDetails?.channelId||"",isChatOwner:!!x.authorDetails?.isChatOwner,isChatModerator:!!x.authorDetails?.isChatModerator,canDelete:true}))});
  }
  if(b.action==="chat_send"){
    if(!b.live_chat_id||!b.text)return J({error:"Live chat ID and message required"},400);
    const d=await gj("https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snippet:{liveChatId:String(b.live_chat_id),type:"textMessageEvent",textMessageDetails:{messageText:String(b.text).slice(0,200)}}})});return J({success:true,message:d});
  }
  if(b.action==="chat_delete_message"){
    if(!b.message_id)return J({error:"Message ID missing"},400);await gj(`https://www.googleapis.com/youtube/v3/liveChat/messages?id=${encodeURIComponent(b.message_id)}`,token,{method:"DELETE"});return J({success:true});
  }
  if(b.action==="chat_moderators"){
    if(!b.live_chat_id)return J({error:"Live chat ID missing"},400);
    const d=await gj(`https://www.googleapis.com/youtube/v3/liveChat/moderators?part=id,snippet&liveChatId=${encodeURIComponent(b.live_chat_id)}&maxResults=50`,token);return J({success:true,moderators:(d.items||[]).map((x:any)=>({id:x.id,channelId:x.snippet?.moderatorDetails?.channelId||"",displayName:x.snippet?.moderatorDetails?.displayName||""}))});
  }
  if(b.action==="chat_add_moderator"){
    if(!b.live_chat_id||!b.channel_id)return J({error:"Live chat and moderator channel IDs required"},400);
    const d=await gj("https://www.googleapis.com/youtube/v3/liveChat/moderators?part=snippet",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snippet:{liveChatId:String(b.live_chat_id),moderatorDetails:{channelId:String(b.channel_id)}}})});return J({success:true,moderator:d});
  }
  if(b.action==="chat_delete_moderator"){
    if(!b.moderator_id)return J({error:"Moderator ID missing"},400);await gj(`https://www.googleapis.com/youtube/v3/liveChat/moderators?id=${encodeURIComponent(b.moderator_id)}`,token,{method:"DELETE"});return J({success:true});
  }
  if(b.action==="chat_ban"){
    if(!b.live_chat_id||!b.channel_id)return J({error:"Live chat and user channel IDs required"},400);const secs=Number(b.duration_seconds||0);const banType=secs>0?"temporary":"permanent";
    const details:any={type:banType,bannedUserDetails:{channelId:String(b.channel_id)}};if(secs>0)details.banDurationSeconds=Math.max(1,Math.floor(secs));
    const d=await gj("https://www.googleapis.com/youtube/v3/liveChat/bans?part=snippet",token,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({snippet:{liveChatId:String(b.live_chat_id),banDetails:details}})});return J({success:true,ban:d});
  }
  if(b.action==="chat_unban"){
    if(!b.ban_id)return J({error:"Ban ID missing"},400);await gj(`https://www.googleapis.com/youtube/v3/liveChat/bans?id=${encodeURIComponent(b.ban_id)}`,token,{method:"DELETE"});return J({success:true});
  }

  if(b.action==="monetization_analytics"){
    const now=new Date();
    const end=new Date(now.getTime()-86400000);
    const start=new Date(end.getTime()-27*86400000);
    const ds=(d:Date)=>d.toISOString().slice(0,10);
    const base=`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel%3D%3DMINE&startDate=${ds(start)}&endDate=${ds(end)}`;
    let core:any={};let money:any={};let moneyError="";
    try{
      const d=await gj(`${base}&metrics=views,estimatedMinutesWatched,averageViewDuration`,token);
      const r=d.rows?.[0]||[];core={views:Number(r[0]||0),watchMinutes:Number(r[1]||0),averageViewDuration:Number(r[2]||0)};
    }catch(e){core={error:String(e)}}
    try{
      const d=await gj(`${base}&metrics=estimatedRevenue,estimatedAdRevenue,playbackBasedCpm`,token);
      const r=d.rows?.[0]||[];money={estimatedRevenue:Number(r[0]||0),estimatedAdRevenue:Number(r[1]||0),playbackBasedCpm:Number(r[2]||0)};
    }catch(e){moneyError=String(e)}
    const rpm=core.views>0?((Number(money.estimatedRevenue||0)/core.views)*1000):0;
    const chd=await gj("https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true",token);
    const subscribers=Number(chd.items?.[0]?.statistics?.subscriberCount||0);
    const since90=new Date(now.getTime()-90*86400000);
    let uploadsLast90:number|null=null;
    try{
      const cd=await gj("https://www.googleapis.com/youtube/v3/channels?part=contentDetails&mine=true",token);const uploads=cd.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if(uploads){let pageToken="",count=0,guard=0;do{const u=new URL("https://www.googleapis.com/youtube/v3/playlistItems");u.searchParams.set("part","snippet");u.searchParams.set("playlistId",uploads);u.searchParams.set("maxResults","50");if(pageToken)u.searchParams.set("pageToken",pageToken);const pd=await gj(u.toString(),token);for(const it of (pd.items||[])){const d=new Date(it.snippet?.publishedAt||0);if(d>=since90)count++;}pageToken=pd.nextPageToken||"";guard++;}while(pageToken&&guard<20);uploadsLast90=count;}
    }catch(_){uploadsLast90=null}
    return J({success:true,period:{start:ds(start),end:ds(end),days:28},...core,...money,rpm,moneyAvailable:!moneyError,moneyError,eligibility:{asOf:ds(end),subscribers,uploadsLast90,qualifiedWatchHours:null,qualifiedShortsViews:null,officialEligibilityCountersAvailable:false}});
  }

  if(b.action==="dashboard"){
   const cd=await gj("https://www.googleapis.com/youtube/v3/channels?part=snippet,brandingSettings,statistics,contentDetails&mine=true",token);const ch=cd.items?.[0];if(!ch)return J({error:"Channel not found"},404);
   const uploads=ch.contentDetails?.relatedPlaylists?.uploads;
   const ids:string[]=[];let contentTruncated=false;const contentLimit=1000;
   if(uploads){
     let pageToken="",guard=0;
     do{
       const u=new URL("https://www.googleapis.com/youtube/v3/playlistItems");u.searchParams.set("part","contentDetails");u.searchParams.set("playlistId",uploads);u.searchParams.set("maxResults","50");if(pageToken)u.searchParams.set("pageToken",pageToken);
       const pd=await gj(u.toString(),token);for(const x of (pd.items||[])){const id=x.contentDetails?.videoId;if(id)ids.push(id);if(ids.length>=contentLimit)break}
       pageToken=pd.nextPageToken||"";guard++;if(ids.length>=contentLimit){contentTruncated=!!pageToken;break}
     }while(pageToken&&guard<25);
   }
   let videos:any[]=[];
   for(let i=0;i<ids.length;i+=50){
     const batch=ids.slice(i,i+50);const vd=await gj(`https://www.googleapis.com/youtube/v3/videos?part=snippet,status,statistics,contentDetails,liveStreamingDetails&id=${batch.join(",")}`,token);
     videos.push(...(vd.items||[]).map((v:any)=>({id:v.id,title:v.snippet?.title||"",description:v.snippet?.description||"",tags:v.snippet?.tags||[],categoryId:v.snippet?.categoryId||"22",thumbnail:v.snippet?.thumbnails?.medium?.url||v.snippet?.thumbnails?.default?.url||"",privacyStatus:v.status?.privacyStatus||"",liveBroadcastContent:v.snippet?.liveBroadcastContent||"none",isLive:v.snippet?.liveBroadcastContent==="live",hadLiveStream:!!v.liveStreamingDetails,duration:v.contentDetails?.duration||"PT0S",durationSeconds:(()=>{const m=String(v.contentDetails?.duration||"PT0S").match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);return m?((Number(m[1]||0)*86400)+(Number(m[2]||0)*3600)+(Number(m[3]||0)*60)+Number(m[4]||0)):0})(),status:{uploadStatus:v.status?.uploadStatus||"",license:v.status?.license||"",embeddable:v.status?.embeddable},views:v.statistics?.viewCount||0,comments:v.statistics?.commentCount||0,likes:v.statistics?.likeCount||0,publishedAt:v.snippet?.publishedAt||"",restrictions:{regionBlocked:!!(v.contentDetails?.regionRestriction?.blocked?.length)}})));
   }
   const order=new Map(ids.map((id,i)=>[id,i]));videos.sort((a:any,b:any)=>(order.get(a.id)??999999)-(order.get(b.id)??999999));
   const playlists:any[]=[];let plToken="",plGuard=0;do{const u=new URL("https://www.googleapis.com/youtube/v3/playlists");u.searchParams.set("part","snippet,status,contentDetails");u.searchParams.set("mine","true");u.searchParams.set("maxResults","50");if(plToken)u.searchParams.set("pageToken",plToken);const pd=await gj(u.toString(),token);playlists.push(...(pd.items||[]).map((p:any)=>({id:p.id,title:p.snippet?.title||"",description:p.snippet?.description||"",privacyStatus:p.status?.privacyStatus||"",itemCount:p.contentDetails?.itemCount||0,thumbnail:p.snippet?.thumbnails?.medium?.url||p.snippet?.thumbnails?.default?.url||"",publishedAt:p.snippet?.publishedAt||""})));plToken=pd.nextPageToken||"";plGuard++;}while(plToken&&plGuard<20);
   return J({channel:{channelId:ch.id,title:ch.snippet?.title||"",description:ch.snippet?.description||"",keywords:ch.brandingSettings?.channel?.keywords||"",bannerUrl:ch.brandingSettings?.image?.bannerExternalUrl||"",subscribers:ch.statistics?.subscriberCount||0,views:ch.statistics?.viewCount||0,videos:ch.statistics?.videoCount||0},videos,playlists,contentTruncated,contentLimit,copyright_note:"Copyright claim details are not exposed by YouTube Data API; use YouTube Studio for exact claims."});
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