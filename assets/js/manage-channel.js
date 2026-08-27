import { supabase } from "./supabase.js";
const FUNCTION_URL="https://ncxexmekzlrliicaqfcl.supabase.co/functions/v1/youtube-manage";
const customerId=new URLSearchParams(location.search).get("customer");
let videos=[],playlists=[];
let uploadBusy=false;
let managerAccessGranted=false;
const $=id=>document.getElementById(id);
async function session(){const {data:{session}}=await supabase.auth.getSession();if(!session){location.href="login.html";throw new Error("Login required")}return session}
async function api(action,payload={}){const s=await session();const r=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+s.access_token},body:JSON.stringify({action,customer_id:customerId,...payload})});const d=await r.json();if(!r.ok)throw new Error(d.details||d.error||"Request failed");return d}
const esc=(x="")=>String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=n=>Number(n||0).toLocaleString("en-IN");

function applyManagerGate(granted){
  managerAccessGranted=!!granted;
  const badge=$("managerGateBadge");
  const text=$("managerGateText");
  const area=$("managerUnlockedArea");
  if(granted){
    badge.textContent="GRANTED ✅";
    badge.className="yt-gate-badge granted";
    text.textContent="Manager access granted. Full admin YouTube management unlocked.";
    area.classList.remove("yt-manager-locked");
    area.classList.add("yt-manager-unlocked");
  }else{
    badge.textContent="PENDING 🟡";
    badge.className="yt-gate-badge pending";
    text.textContent="Manager invite/acceptance pending. Full Studio management locked.";
    area.classList.add("yt-manager-locked");
    area.classList.remove("yt-manager-unlocked");
  }
}
async function loadManagerGate(){
  try{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session) return;
    const {data:customer}=await supabase.from("customers").select("id").eq("id",customerId).maybeSingle();
    if(!customer) return applyManagerGate(false);
    const {data:access,error}=await supabase.from("channel_access").select("manager_access").eq("customer_id",customerId).maybeSingle();
    if(error) console.error(error);
    applyManagerGate(!!access?.manager_access);
  }catch(e){console.error(e);applyManagerGate(false)}
}
async function setManagerGate(granted){
  const {data,error}=await supabase.from("channel_access").update({manager_access:granted,updated_at:new Date().toISOString()}).eq("customer_id",customerId).select("manager_access").maybeSingle();
  if(error) throw error;
  applyManagerGate(!!data?.manager_access);
}

async function loadAll(){
 try{
  $("manageMessage").textContent="Syncing YouTube…";
  const d=await api("dashboard");
  const c=d.channel||{}; videos=d.videos||[]; playlists=d.playlists||[];
  $("channelTitle").textContent="Manage: "+(c.title||"YouTube Channel");
  $("channelName").value=c.title||"";$("channelDescription").value=c.description||"";$("channelKeywords").value=c.keywords||"";
  const bp=$("channelBannerPreview"), be=$("noBannerPreview");
  if(c.bannerUrl){bp.src=c.bannerUrl;bp.style.display="block";be.style.display="none"}else{bp.removeAttribute("src");bp.style.display="none";be.style.display="grid"}
  $("channelStats").innerHTML=`<div><b>${fmt(c.subscribers)}</b><span>Subscribers</span></div><div><b>${fmt(c.views)}</b><span>Views</span></div><div><b>${fmt(c.videos)}</b><span>Videos</span></div><div><b>${esc(c.channelId||"-")}</b><span>Channel ID</span></div>`;
  $("manageMessage").textContent="Connected channel loaded ✅"; renderVideos();renderPlaylists();
 }catch(e){$("manageMessage").textContent=e.message;$("videoList").textContent="Could not load videos."}
}
function copyrightLabel(v){
 if(v.restrictions?.regionBlocked) return "⚠️ Region restriction";
 if(v.status?.uploadStatus && v.status.uploadStatus!=="processed") return "⚠️ "+v.status.uploadStatus;
 return "Claims: check Studio";
}
function renderVideos(){
 const box=$("videoList");if(!videos.length){box.innerHTML="<p>No videos found.</p>";return}
 box.innerHTML=videos.map((v,i)=>`<article class="yt-video-card"><img src="${esc(v.thumbnail||"")}" alt=""><div class="yt-video-copy"><b>${esc(v.title)}</b><small>${esc(v.id)}</small><div class="yt-chip-row"><span>${esc(v.privacyStatus||"-")}</span><span>${copyrightLabel(v)}</span><span>${fmt(v.views)} views</span></div></div><button class="btn primary" data-edit="${i}">Edit / Manage</button></article>`).join("");
 document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(+b.dataset.edit));
}
function openEdit(i){const v=videos[i];$("editVideoId").value=v.id;$("editTitle").value=v.title||"";$("editDescription").value=v.description||"";$("editTags").value=(v.tags||[]).join(", ");$("editCategory").value=v.categoryId||"22";$("editPrivacy").value=v.privacyStatus||"private";$("editMessage").textContent=`Copyright claims: YouTube Data API me available nahi. API restrictions: ${v.restrictions?.regionBlocked?"Region blocked":"none reported"}`;$("editModal").hidden=false}
function renderPlaylists(){const box=$("playlistList");if(!playlists.length){box.innerHTML="<p>No playlists found.</p>";return}box.innerHTML=playlists.map((p,i)=>`<div class="yt-playlist-row"><div><b>${esc(p.title)}</b><small>${p.itemCount||0} videos · ${esc(p.privacyStatus||"-")}</small></div><button class="btn" data-pl="${i}">Edit</button></div>`).join("");document.querySelectorAll("[data-pl]").forEach(b=>b.onclick=()=>openPlaylist(+b.dataset.pl))}
function openPlaylist(i){
 const p=playlists[i];
 $("playlistId").value=p.id;
 $("playlistTitle").value=p.title||"";
 $("playlistDescription").value=p.description||"";
 $("playlistPrivacy").value=p.privacyStatus||"private";
 $("playlistMessage").textContent="";
 const box=$("playlistThumbBox"),img=$("playlistThumbPreview");
 if(p.thumbnail){img.src=p.thumbnail;box.hidden=false}else{img.removeAttribute("src");box.hidden=true}
 $("deletePlaylist").hidden=false;
 $("openPlaylistStudio").hidden=false;
 $("playlistModal").hidden=false
}

$("markManagerGranted").onclick=async()=>{
  try{
    $("managerGateText").textContent="Saving…";
    await setManagerGate(true);
  }catch(e){$("managerGateText").textContent=e.message}
};
$("markManagerPending").onclick=async()=>{
  try{
    $("managerGateText").textContent="Saving…";
    await setManagerGate(false);
  }catch(e){$("managerGateText").textContent=e.message}
};

$("refreshAll").onclick=loadAll;$("refreshVideos").onclick=loadAll;
const studioPermissions="https://studio.youtube.com/";
const studioCustomization="https://studio.youtube.com/";
function openStudio(url,msg){
  if($("accessMessage")) $("accessMessage").textContent=msg;
  window.open(url,"_blank","noopener,noreferrer");
}

let accessFlowMode="permissions";
function showAccessFlow(mode){
  accessFlowMode=mode;
  const isManager=mode==="manager";
  $("accessFlowIcon").textContent=isManager?"👤":"🔐";
  $("accessFlowTitle").textContent=isManager?"Give Manager Access":"Open Channel Permissions";
  $("accessFlowIntro").textContent=isManager
    ?"Manager invite ka official YouTube Studio flow khulega. Password share nahi hoga."
    :"Channel owner ke YouTube Studio me official Permissions section use karna hai.";
  $("managerEmailBox").hidden=!isManager;
  $("continueAccessFlow").textContent=isManager?"Open Studio & Invite Manager":"Open Studio Permissions";
  $("permissionSteps").innerHTML=isManager
    ? `<div><b>1</b><span>YouTube Studio kholkar <strong>Settings</strong> par jao.</span></div>
       <div><b>2</b><span><strong>Permissions → INVITE</strong> dabao.</span></div>
       <div><b>3</b><span>Manager ka Google email paste karo.</span></div>
       <div><b>4</b><span>Role me <strong>Manager</strong> select karke <strong>DONE</strong> karo.</span></div>`
    : `<div><b>1</b><span>YouTube Studio kholkar <strong>Settings</strong> par jao.</span></div>
       <div><b>2</b><span><strong>Permissions</strong> kholo.</span></div>
       <div><b>3</b><span>Yahin se current access dekho, role change karo, invite ya remove karo.</span></div>`;
  $("managerEmailMessage").textContent="";
  $("accessFlowModal").hidden=false;
}
$("openPermissions").onclick=()=>showAccessFlow("permissions");
$("openManagerAccess").onclick=()=>showAccessFlow("manager");
$("openCustomization").onclick=()=>openStudio(studioCustomization,"YouTube Studio khul raha hai. Manager access granted account se login rahna chahiye.");
$("editChannelNameStudio").onclick=()=>openStudio(studioCustomization,"YouTube Studio khul raha hai. Channel name change karke wapas Refresh / Sync dabao.");


$("closeAccessFlow").onclick=()=>$("accessFlowModal").hidden=true;
$("cancelAccessFlow").onclick=()=>$("accessFlowModal").hidden=true;
$("copyManagerEmail").onclick=async()=>{
  const email=$("managerEmail").value.trim();
  if(!email || !email.includes("@")){
    $("managerEmailMessage").textContent="Valid manager Google email dalo.";
    return;
  }
  try{
    await navigator.clipboard.writeText(email);
    $("managerEmailMessage").textContent="Email copied ✅";
  }catch(_){
    $("managerEmail").select();
    document.execCommand("copy");
    $("managerEmailMessage").textContent="Email copied ✅";
  }
};
$("continueAccessFlow").onclick=async()=>{
  if(accessFlowMode==="manager"){
    const email=$("managerEmail").value.trim();
    if(email && email.includes("@")){
      try{ await navigator.clipboard.writeText(email); }catch(_){}
      $("accessMessage").textContent="Manager email copied. Studio → Settings → Permissions → INVITE → paste email → Manager → DONE.";
    }else{
      $("accessMessage").textContent="Studio → Settings → Permissions → INVITE → manager email → Manager → DONE.";
    }
  }else{
    $("accessMessage").textContent="Studio → Settings → Permissions kholkar channel access manage karein.";
  }
  $("accessFlowModal").hidden=true;
  window.open(studioPermissions,"_blank","noopener,noreferrer");
};
$("closeModal").onclick=()=>$("editModal").hidden=true;$("closePlaylistModal").onclick=()=>$("playlistModal").hidden=true;
$("saveChannel").onclick=async()=>{try{$("channelMessage").textContent="Updating…";await api("update_channel",{description:$("channelDescription").value,keywords:$("channelKeywords").value});$("channelMessage").textContent="Channel updated ✅";await loadAll()}catch(e){$("channelMessage").textContent=e.message}};
$("saveVideo").onclick=async()=>{try{$("editMessage").textContent="Updating…";await api("update_video",{video_id:$("editVideoId").value,title:$("editTitle").value.trim(),description:$("editDescription").value,tags:$("editTags").value.split(",").map(x=>x.trim()).filter(Boolean),category_id:$("editCategory").value.trim()||"22",privacy_status:$("editPrivacy").value});$("editMessage").textContent="Updated on YouTube ✅";await loadAll()}catch(e){$("editMessage").textContent=e.message}};
$("deleteVideo").onclick=async()=>{if(!confirm("Is video ko permanently delete karna hai?"))return;try{await api("delete_video",{video_id:$("editVideoId").value});$("editModal").hidden=true;await loadAll()}catch(e){$("editMessage").textContent=e.message}};

function loadImageFile(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Image read failed"))};
    img.src=url;
  });
}
async function makeYoutubeBanner(file){
  const img=await loadImageFile(file);
  const W=2560,H=1440;
  const canvas=document.createElement("canvas");
  canvas.width=W; canvas.height=H;
  const ctx=canvas.getContext("2d");
  ctx.fillStyle="#000"; ctx.fillRect(0,0,W,H);

  // COVER mode: koi bhi aspect ratio automatically crop karke 16:9 banner banega.
  const scale=Math.max(W/img.width,H/img.height);
  const sw=W/scale, sh=H/scale;
  const sx=(img.width-sw)/2, sy=(img.height-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,0,0,W,H);

  let blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",0.92));
  if(!blob) throw new Error("Banner conversion failed");

  // Keep safely below YouTube's file-size limit by reducing quality if needed.
  let q=0.88;
  while(blob.size>5.5*1024*1024 && q>=0.55){
    blob=await new Promise(r=>canvas.toBlob(r,"image/jpeg",q));
    q-=0.08;
  }
  return blob;
}


function getVideoMeta(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);
    const v=document.createElement("video");
    v.preload="metadata";
    v.onloadedmetadata=()=>{
      const meta={duration:Number(v.duration||0),width:Number(v.videoWidth||0),height:Number(v.videoHeight||0)};
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    v.onerror=()=>{URL.revokeObjectURL(url);reject(new Error("Video metadata read failed"))};
    v.src=url;
  });
}
function uploadTypeMessage(type,meta){
  if(type==="short"){
    if(meta && meta.width>meta.height) return "⚠️ Short selected, lekin video horizontal hai. YouTube ise normal video classify kar sakta hai.";
    return "Short selected ✅ YouTube final Shorts classification apne rules se karta hai.";
  }
  if(meta && meta.height>=meta.width && meta.duration && meta.duration<=180){
    return "⚠️ Normal Video selected, lekin ye vertical/square aur 3 min ya kam hai. YouTube ise Short classify kar sakta hai.";
  }
  return "Normal Video selected ✅";
}
async function confirmUploadedVideo(title,tries=6){
  for(let i=0;i<tries;i++){
    try{
      await new Promise(r=>setTimeout(r,1800));
      const d=await api("dashboard");
      const found=(d.videos||[]).find(v=>String(v.title||"").trim()===String(title||"").trim());
      if(found) return found;
    }catch(_){}
  }
  return null;
}

function fileData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(file)})}
$("setThumbnail").onclick=async()=>{const f=$("thumbnailFile").files[0];if(!f)return $("editMessage").textContent="Thumbnail file choose karo.";if(f.size>2*1024*1024)return $("editMessage").textContent="Thumbnail max 2 MB rakho.";try{$("editMessage").textContent="Uploading thumbnail…";await api("set_thumbnail",{video_id:$("editVideoId").value,mime_type:f.type,data_base64:await fileData(f)});$("editMessage").textContent="Thumbnail updated ✅";await loadAll()}catch(e){$("editMessage").textContent=e.message}};
$("newPlaylistBtn").onclick=()=>{$("playlistId").value="";$("playlistTitle").value="";$("playlistDescription").value="";$("playlistPrivacy").value="private";$("playlistThumbBox").hidden=true;$("deletePlaylist").hidden=true;$("openPlaylistStudio").hidden=true;$("playlistMessage").textContent="";$("playlistModal").hidden=false};

$("deletePlaylist").onclick=async()=>{
 const id=$("playlistId").value;
 if(!id)return;
 if(!confirm("Is playlist ko permanently delete karna hai?"))return;
 try{
   $("playlistMessage").textContent="Deleting playlist…";
   await api("delete_playlist",{playlist_id:id});
   $("playlistModal").hidden=true;
   await loadAll();
 }catch(e){$("playlistMessage").textContent=e.message}
};
$("openPlaylistStudio").onclick=()=>{
 const id=$("playlistId").value;
 if(!id)return;
 window.open(`https://www.youtube.com/playlist?list=${encodeURIComponent(id)}`,"_blank","noopener,noreferrer");
};

$("savePlaylist").onclick=async()=>{try{const id=$("playlistId").value;await api(id?"update_playlist":"create_playlist",{playlist_id:id,title:$("playlistTitle").value.trim(),description:$("playlistDescription").value,privacy_status:$("playlistPrivacy").value});$("playlistModal").hidden=true;await loadAll()}catch(e){$("playlistMessage").textContent=e.message}};

$("uploadType").onchange=async()=>{
  const type=$("uploadType").value;
  const f=$("uploadFile").files[0];
  let meta=null;
  if(f){try{meta=await getVideoMeta(f)}catch(_){}}
  $("uploadTypeHelp").textContent=uploadTypeMessage(type,meta);
};
$("uploadFile").onchange=async()=>{
  const f=$("uploadFile").files[0];
  if(!f)return;
  try{
    const meta=await getVideoMeta(f);
    $("uploadTypeHelp").textContent=uploadTypeMessage($("uploadType").value,meta);
  }catch(_){}
};

$("uploadVideo").onclick=async()=>{
  if(uploadBusy) return;
  const f=$("uploadFile").files[0];
  if(!f)return $("uploadMessage").textContent="Video file choose karo.";

  const type=$("uploadType").value;
  let meta=null;
  try{meta=await getVideoMeta(f)}catch(_){}
  $("uploadTypeHelp").textContent=uploadTypeMessage(type,meta);

  try{
    uploadBusy=true;
    $("uploadVideo").disabled=true;
    $("uploadResult").hidden=true;
    $("uploadProgress").hidden=false;
    $("uploadProgress").value=0;
    $("uploadMessage").textContent="Secure upload session bana raha hai…";

    const title=$("uploadTitle").value.trim()||f.name;
    const d=await api("start_upload",{
      title,
      description:$("uploadDescription").value,
      tags:$("uploadTags").value.split(",").map(x=>x.trim()).filter(Boolean),
      category_id:$("uploadCategory").value||"22",
      privacy_status:$("uploadPrivacy").value,
      mime_type:f.type||"video/*",
      file_size:f.size,
      requested_type:type
    });

    const x=new XMLHttpRequest();
    x.open("PUT",d.upload_url);
    x.setRequestHeader("Content-Type",f.type||"application/octet-stream");

    x.upload.onprogress=e=>{
      if(e.lengthComputable){
        const pct=Math.round(e.loaded/e.total*100);
        $("uploadProgress").value=pct;
        $("uploadMessage").textContent=`Uploading ${pct}%…`;
      }
    };

    const finishSuccess=async(videoData=null)=>{
      $("uploadProgress").value=100;
      $("uploadMessage").textContent="Video uploaded successfully ✅";
      $("uploadResult").hidden=false;
      $("uploadResult").innerHTML=`<b>${type==="short"?"Short":"Video"} upload complete ✅</b>${videoData?.id?`<small>Video ID: ${videoData.id}</small>`:""}<small>YouTube final Short/Video classification content format ke hisab se karta hai.</small>`;
      await loadAll();
    };

    x.onload=async()=>{
      if(x.status>=200&&x.status<300){
        let videoData=null;
        try{videoData=JSON.parse(x.responseText||"{}")}catch(_){}
        await finishSuccess(videoData);
      }else{
        // Google may complete the upload even if the browser cannot read the final response.
        $("uploadMessage").textContent="Upload response verify ho raha hai…";
        const found=await confirmUploadedVideo(title);
        if(found){
          await finishSuccess(found);
        }else{
          $("uploadMessage").textContent=`Upload failed (HTTP ${x.status}).`;
        }
      }
      uploadBusy=false;
      $("uploadVideo").disabled=false;
    };

    x.onerror=async()=>{
      // Important: do NOT instantly say "network error"; verify on YouTube first.
      $("uploadMessage").textContent="Upload verify ho raha hai…";
      const found=await confirmUploadedVideo(title);
      if(found){
        await finishSuccess(found);
      }else{
        $("uploadMessage").textContent="Upload connection failed. YouTube par video nahi mila; retry kar sakte ho.";
      }
      uploadBusy=false;
      $("uploadVideo").disabled=false;
    };

    x.onabort=()=>{
      $("uploadMessage").textContent="Upload cancelled.";
      uploadBusy=false;
      $("uploadVideo").disabled=false;
    };

    x.send(f);
  }catch(e){
    $("uploadMessage").textContent=e.message;
    uploadBusy=false;
    $("uploadVideo").disabled=false;
  }
};

$("openBannerStudio").onclick=()=>openStudio(studioCustomization,"YouTube Studio Branding khul raha hai. Banner ko yahan manage/remove kar sakte hain.");
$("removeChannelBanner").onclick=()=>openStudio(studioCustomization,"Banner remove karne ke liye YouTube Studio → Customization → Branding use karein.");

$("uploadChannelBanner").onclick=async()=>{
 const f=$("channelBannerFile").files[0];
 if(!f)return $("bannerMessage").textContent="Banner image choose karo.";
 try{
  $("uploadChannelBanner").disabled=true;
  $("bannerMessage").textContent="Image auto-fit + upload ho raha hai…";
  const blob=await makeYoutubeBanner(f);
  const base64=await fileData(blob);
  await api("set_channel_banner",{mime_type:"image/jpeg",data_base64:base64});
  $("bannerMessage").textContent="Channel banner updated ✅";
  await loadManagerGate();
loadAll();
 }catch(e){
  $("bannerMessage").textContent=e.message;
 }finally{
  $("uploadChannelBanner").disabled=false;
 }
};

loadAll();
