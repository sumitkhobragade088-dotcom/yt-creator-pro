import { supabase } from "./supabase.js";
const FUNCTION_URL="https://ncxexmekzlrliicaqfcl.supabase.co/functions/v1/youtube-manage";
const customerId=new URLSearchParams(location.search).get("customer");
let videos=[],playlists=[];
let currentChannel={};
let activeContentTab="video";
let uploadBusy=false;
let managerAccessGranted=false;
const $=id=>document.getElementById(id);
async function session(){const {data:{session}}=await supabase.auth.getSession();if(!session){location.href="login.html";throw new Error("Login required")}return session}
async function api(action,payload={}){const s=await session();const r=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+s.access_token},body:JSON.stringify({action,customer_id:customerId,...payload})});const d=await r.json();if(!r.ok)throw new Error(d.details||d.error||"Request failed");return d}
const esc=(x="")=>String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=n=>Number(n||0).toLocaleString("en-IN");


function managerGateStorageKey(){return `yt_manager_access_${customerId||"unknown"}`;}

function applyManagerGate(granted){
  managerAccessGranted=!!granted;
  try{localStorage.setItem(managerGateStorageKey(),managerAccessGranted?"1":"0")}catch(_){}
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
  // Show saved local status immediately so refresh does not jump back to Pending.
  try{
    if(localStorage.getItem(managerGateStorageKey())==="1") applyManagerGate(true);
  }catch(_){}

  try{
    const d=await api("get_manager_access");
    applyManagerGate(!!d.manager_access);
  }catch(e){
    console.error(e);
    // Keep local granted state if backend is temporarily unavailable.
    let localGranted=false;
    try{localGranted=localStorage.getItem(managerGateStorageKey())==="1"}catch(_){}
    applyManagerGate(localGranted);
    if(!localGranted) $("managerGateText").textContent="Manager access status load failed: "+e.message;
  }
}
async function setManagerGate(granted){
  // Persist UI immediately, then save permanently to backend.
  applyManagerGate(!!granted);
  const d=await api("set_manager_access",{manager_access:!!granted});
  applyManagerGate(!!d.manager_access);
}

async function loadAll(){
 try{
  $("manageMessage").textContent="Syncing YouTube…";
  const d=await api("dashboard");
  const c=d.channel||{}; currentChannel=c; videos=d.videos||[]; playlists=d.playlists||[];
  $("channelTitle").textContent="Manage: "+(c.title||"YouTube Channel");
  $("channelName").value=c.title||"";$("channelDescription").value=c.description||"";$("channelKeywords").value=c.keywords||"";
  const bp=$("channelBannerPreview"), be=$("noBannerPreview");
  if(c.bannerUrl){bp.src=c.bannerUrl;bp.style.display="block";be.style.display="none"}else{bp.removeAttribute("src");bp.style.display="none";be.style.display="grid"}
  $("channelStats").innerHTML=`<div><b>${fmt(c.subscribers)}</b><span>Subscribers</span></div><div><b>${fmt(c.views)}</b><span>Views</span></div><div><b>${fmt(c.videos)}</b><span>Videos</span></div><div><b>${esc(c.channelId||"-")}</b><span>Channel ID</span></div>`;
  $("manageMessage").textContent="Connected channel loaded ✅"; renderVideos();renderPlaylists();renderAnalytics();renderCopyright();
 }catch(e){
    $("manageMessage").textContent=e.message;
    if($("contentTableBody")) $("contentTableBody").innerHTML='<tr><td colspan="6">Could not load content.</td></tr>';
  }
}

function isoDurationSeconds(iso="PT0S"){
  const m=String(iso).match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if(!m)return 0;
  return (Number(m[1]||0)*86400)+(Number(m[2]||0)*3600)+(Number(m[3]||0)*60)+Number(m[4]||0);
}
function contentType(v){
  if(v.isLive || v.liveBroadcastContent==="live" || v.liveBroadcastContent==="upcoming" || v.hadLiveStream) return "live";
  const sec=Number(v.durationSeconds || isoDurationSeconds(v.duration || "PT0S"));
  if(sec>0 && sec<=180) return "short";
  return "video";
}

function copyrightLabel(v){
 if(v.restrictions?.regionBlocked) return "⚠️ Region restriction";
 if(v.status?.uploadStatus && v.status.uploadStatus!=="processed") return "⚠️ "+v.status.uploadStatus;
 return "Claims: check Studio";
}
function renderVideos(){
  const counts={
    video:(videos||[]).filter(v=>contentType(v)==="video").length,
    short:(videos||[]).filter(v=>contentType(v)==="short").length,
    live:(videos||[]).filter(v=>contentType(v)==="live").length,
    playlist:(playlists||[]).length
  };
  $("videosCount").textContent=counts.video;
  $("shortsCount").textContent=counts.short;
  $("liveCount").textContent=counts.live;
  $("playlistsCount").textContent=counts.playlist;

  renderContentTable();
}

function formatDate(v){
  const raw=v.publishedAt||v.createdAt||v.updatedAt||"";
  if(!raw)return "-";
  const d=new Date(raw);
  return Number.isNaN(d.getTime())?"-":d.toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"});
}
function contentRows(){
  const q=String($("contentSearch")?.value||"").trim().toLowerCase();

  if(activeContentTab==="playlist"){
    return (playlists||[])
      .filter(p=>!q || `${p.title||""} ${p.description||""}`.toLowerCase().includes(q))
      .map(p=>({
        kind:"playlist",
        id:p.id,
        title:p.title||"",
        description:p.description||"",
        thumbnail:p.thumbnail||"",
        privacyStatus:p.privacyStatus||"-",
        date:p.publishedAt||"",
        views:"-",
        comments:"-",
        object:p
      }));
  }

  return (videos||[])
    .filter(v=>contentType(v)===activeContentTab)
    .filter(v=>!q || `${v.title||""} ${v.description||""}`.toLowerCase().includes(q))
    .map(v=>({
      kind:"video",
      id:v.id,
      title:v.title||"",
      description:v.description||"",
      thumbnail:v.thumbnail||"",
      privacyStatus:v.privacyStatus||"-",
      date:v.publishedAt||"",
      views:v.views||0,
      comments:v.comments||0,
      object:v
    }));
}

function renderContentTable(){
  const body=$("contentTableBody");
  if(!body)return;
  const rows=contentRows();

  if(!rows.length){
    const label=activeContentTab==="video"?"videos":activeContentTab==="short"?"shorts":activeContentTab==="live"?"live streams":"playlists";
    body.innerHTML=`<tr><td colspan="6" class="yt-table-empty">No ${label} found.</td></tr>`;
    return;
  }

  body.innerHTML=rows.map((r,idx)=>`
    <tr>
      <td>
        <div class="yt-table-content-cell">
          <img src="${esc(r.thumbnail||"")}" alt="">
          <div>
            <b>${esc(r.title)}</b>
            <small>${esc(r.description||"").slice(0,80)}</small>
          </div>
        </div>
      </td>
      <td><span class="yt-visibility-chip">${esc(r.privacyStatus||"-")}</span></td>
      <td>${formatDate(r.object)}</td>
      <td>${r.views==="-"?"-":fmt(r.views)}</td>
      <td>${r.comments==="-"?"-":fmt(r.comments)}</td>
      <td>
        <div class="yt-row-actions">
          <button class="btn primary" data-content-edit="${idx}">${r.kind==="playlist"?"Edit / Update":"Edit / Manage"}</button>
          ${r.kind==="playlist"?`<button class="btn danger" data-playlist-delete="${idx}">Delete</button>`:""}
        </div>
      </td>
    </tr>`).join("");

  document.querySelectorAll("[data-content-edit]").forEach(btn=>{
    btn.onclick=()=>{
      const row=rows[Number(btn.dataset.contentEdit)];
      if(row.kind==="playlist"){
        const i=playlists.indexOf(row.object);
        openPlaylist(i);
      }else{
        const i=videos.indexOf(row.object);
        openEdit(i);
      }
    };
  });
  document.querySelectorAll("[data-playlist-delete]").forEach(btn=>{
    btn.onclick=async()=>{
      const row=rows[Number(btn.dataset.playlistDelete)];
      if(!row || row.kind!=="playlist") return;
      if(!confirm(`Playlist "${row.title}" permanently delete karna hai?`)) return;
      try{
        btn.disabled=true;
        btn.textContent="Deleting…";
        await api("delete_playlist",{playlist_id:row.id});
        await loadAll();
      }catch(e){
        alert(e.message);
        btn.disabled=false;
        btn.textContent="Delete";
      }
    };
  });
}

function openEdit(i){const v=videos[i];$("editVideoId").value=v.id;$("editTitle").value=v.title||"";$("editDescription").value=v.description||"";$("editTags").value=(v.tags||[]).join(", ");$("editCategory").value=v.categoryId||"22";$("editPrivacy").value=v.privacyStatus||"private";$("editMessage").textContent=`Copyright claims: YouTube Data API me available nahi. API restrictions: ${v.restrictions?.regionBlocked?"Region blocked":"none reported"}`;$("editModal").hidden=false}

function renderAnalytics(){
  if(!$("analyticsSubscribers")) return;
  $("analyticsSubscribers").textContent=fmt(currentChannel.subscribers||0);
  $("analyticsViews").textContent=fmt(currentChannel.views||0);
  $("analyticsVideos").textContent=fmt(currentChannel.videos||0);

  const recent=(videos||[]).slice().sort((a,b)=>new Date(b.publishedAt||0)-new Date(a.publishedAt||0)).slice(0,20);
  const recentViews=recent.reduce((sum,v)=>sum+Number(v.views||0),0);
  $("analyticsRecentViews").textContent=fmt(recentViews);

  const body=$("analyticsTableBody");
  if(!recent.length){
    body.innerHTML='<tr><td colspan="6" class="yt-table-empty">No recent videos found.</td></tr>';
    return;
  }
  body.innerHTML=recent.map(v=>`
    <tr>
      <td><div class="yt-table-content-cell"><img src="${esc(v.thumbnail||"")}" alt=""><div><b>${esc(v.title||"")}</b><small>${esc(v.id||"")}</small></div></div></td>
      <td>${contentType(v)==="short"?"Short":contentType(v)==="live"?"Live":"Video"}</td>
      <td>${esc(v.privacyStatus||"-")}</td>
      <td>${fmt(v.views||0)}</td>
      <td>${fmt(v.comments||0)}</td>
      <td>${formatDate(v)}</td>
    </tr>`).join("");
}

function renderCopyright(){
  if(!$("copyrightChecked")) return;
  const list=(videos||[]);
  const restricted=list.filter(v=>v.restrictions?.regionBlocked);
  const issues=list.filter(v=>v.status?.uploadStatus && v.status.uploadStatus!=="processed");

  $("copyrightChecked").textContent=list.length;
  $("copyrightRestricted").textContent=restricted.length;
  $("copyrightIssues").textContent=issues.length;

  const box=$("copyrightList");
  if(!list.length){
    box.innerHTML='<p class="yt-table-empty">No videos found.</p>';
    return;
  }

  box.innerHTML=list.map(v=>{
    const restriction=v.restrictions?.regionBlocked?"Region restriction":"No API-visible region restriction";
    const uploadIssue=(v.status?.uploadStatus && v.status.uploadStatus!=="processed")?v.status.uploadStatus:"Processed";
    return `<div class="yt-copyright-row">
      <div class="yt-copyright-main">
        <img src="${esc(v.thumbnail||"")}" alt="">
        <div><b>${esc(v.title||"")}</b><small>${esc(v.id||"")}</small></div>
      </div>
      <span class="${v.restrictions?.regionBlocked?"bad":"ok"}">${restriction}</span>
      <span class="${uploadIssue==="Processed"?"ok":"warn"}">${esc(uploadIssue)}</span>
      <span class="studio-only">Exact claims: Studio</span>
    </div>`;
  }).join("");
}

function renderPlaylists(){
  if($("playlistsCount")) $("playlistsCount").textContent=(playlists||[]).length;
  if(activeContentTab==="playlist") renderContentTable();
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


document.querySelectorAll(".yt-content-tab").forEach(btn=>{
  btn.onclick=()=>{
    document.querySelectorAll(".yt-content-tab").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    activeContentTab=btn.dataset.contentTab;
    if($("newPlaylistBtn")) $("newPlaylistBtn").hidden=activeContentTab!=="playlist";
    renderContentTable();
  };
});
if($("contentSearch")) $("contentSearch").oninput=renderContentTable;


if($("refreshAnalytics")) $("refreshAnalytics").onclick=loadAll;
if($("settingsRefreshAll")) $("settingsRefreshAll").onclick=loadAll;
if($("openCopyrightStudio")) $("openCopyrightStudio").onclick=()=>window.open("https://studio.youtube.com/","_blank","noopener,noreferrer");
if($("settingsOpenStudio")) $("settingsOpenStudio").onclick=()=>window.open("https://studio.youtube.com/","_blank","noopener,noreferrer");
if($("sidebarLogout")) $("sidebarLogout").onclick=async()=>{await supabase.auth.signOut();location.href="login.html"};
if($("ytSidebarToggle")) $("ytSidebarToggle").onclick=()=>document.body.classList.toggle("yt-sidebar-open");
document.querySelectorAll(".yt-sidebar-nav a").forEach(a=>{
  a.onclick=()=>{ if(innerWidth<980) document.body.classList.remove("yt-sidebar-open"); };
});

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
  await loadAll();
 }catch(e){
  $("bannerMessage").textContent=e.message;
 }finally{
  $("uploadChannelBanner").disabled=false;
 }
};


async function startManagePage(){
  await loadManagerGate();
  await loadAll();
}
startManagePage();
