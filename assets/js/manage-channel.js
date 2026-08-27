import { supabase } from "./supabase.js";
const FUNCTION_URL="https://ncxexmekzlrliicaqfcl.supabase.co/functions/v1/youtube-manage";
const customerId=new URLSearchParams(location.search).get("customer");
let videos=[],playlists=[];
const $=id=>document.getElementById(id);
async function session(){const {data:{session}}=await supabase.auth.getSession();if(!session){location.href="login.html";throw new Error("Login required")}return session}
async function api(action,payload={}){const s=await session();const r=await fetch(FUNCTION_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+s.access_token},body:JSON.stringify({action,customer_id:customerId,...payload})});const d=await r.json();if(!r.ok)throw new Error(d.details||d.error||"Request failed");return d}
const esc=(x="")=>String(x).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const fmt=n=>Number(n||0).toLocaleString("en-IN");
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
function openPlaylist(i){const p=playlists[i];$("playlistId").value=p.id;$("playlistTitle").value=p.title||"";$("playlistDescription").value=p.description||"";$("playlistPrivacy").value=p.privacyStatus||"private";$("playlistMessage").textContent="";$("playlistModal").hidden=false}
$("refreshAll").onclick=loadAll;$("refreshVideos").onclick=loadAll;
const studioPermissions="https://studio.youtube.com/";
const studioCustomization="https://studio.youtube.com/";
function openStudio(url,msg){$("accessMessage").textContent=msg;window.open(url,"_blank","noopener,noreferrer")}
$("openPermissions").onclick=()=>openStudio(studioPermissions,"YouTube Studio khul raha hai → Settings → Permissions → INVITE.");
$("openManagerAccess").onclick=()=>openStudio(studioPermissions,"INVITE → admin Google email → Access: Manager → DONE. Invite owner/authorized manager ko approve/send karna hoga.");
$("openCustomization").onclick=()=>openStudio(studioCustomization,"YouTube Studio Branding khul raha hai. Yahan channel name/profile picture jaise Studio-supported changes karein.");
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

function fileData(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(",")[1]);r.onerror=rej;r.readAsDataURL(file)})}
$("setThumbnail").onclick=async()=>{const f=$("thumbnailFile").files[0];if(!f)return $("editMessage").textContent="Thumbnail file choose karo.";if(f.size>2*1024*1024)return $("editMessage").textContent="Thumbnail max 2 MB rakho.";try{$("editMessage").textContent="Uploading thumbnail…";await api("set_thumbnail",{video_id:$("editVideoId").value,mime_type:f.type,data_base64:await fileData(f)});$("editMessage").textContent="Thumbnail updated ✅";await loadAll()}catch(e){$("editMessage").textContent=e.message}};
$("newPlaylistBtn").onclick=()=>{$("playlistId").value="";$("playlistTitle").value="";$("playlistDescription").value="";$("playlistPrivacy").value="private";$("playlistModal").hidden=false};
$("savePlaylist").onclick=async()=>{try{const id=$("playlistId").value;await api(id?"update_playlist":"create_playlist",{playlist_id:id,title:$("playlistTitle").value.trim(),description:$("playlistDescription").value,privacy_status:$("playlistPrivacy").value});$("playlistModal").hidden=true;await loadAll()}catch(e){$("playlistMessage").textContent=e.message}};
$("uploadVideo").onclick=async()=>{const f=$("uploadFile").files[0];if(!f)return $("uploadMessage").textContent="Video file choose karo.";try{$("uploadVideo").disabled=true;$("uploadMessage").textContent="Preparing secure upload…";const d=await api("start_upload",{title:$("uploadTitle").value.trim()||f.name,description:$("uploadDescription").value,tags:$("uploadTags").value.split(",").map(x=>x.trim()).filter(Boolean),category_id:$("uploadCategory").value||"22",privacy_status:$("uploadPrivacy").value,mime_type:f.type||"video/*",file_size:f.size});const x=new XMLHttpRequest();x.open("PUT",d.upload_url);x.setRequestHeader("Content-Type",f.type||"application/octet-stream");x.upload.onprogress=e=>{if(e.lengthComputable){$("uploadProgress").hidden=false;$("uploadProgress").value=e.loaded/e.total*100;$("uploadMessage").textContent=`Uploading ${Math.round(e.loaded/e.total*100)}%…`}};x.onload=async()=>{if(x.status>=200&&x.status<300){$("uploadMessage").textContent="Video uploaded ✅";$("uploadProgress").value=100;await loadAll()}else $("uploadMessage").textContent="Upload failed: "+x.status;$("uploadVideo").disabled=false};x.onerror=()=>{$("uploadMessage").textContent="Upload network error";$("uploadVideo").disabled=false};x.send(f)}catch(e){$("uploadMessage").textContent=e.message;$("uploadVideo").disabled=false}};


$("channelBannerFile").onchange=async()=>{
  const f=$("channelBannerFile").files[0];
  if(!f)return;
  try{
    $("bannerMessage").textContent="Preview bana raha hai…";
    const blob=await makeYoutubeBanner(f);
    const bp=$("channelBannerPreview"),be=$("noBannerPreview");
    if(bp.dataset.previewUrl) URL.revokeObjectURL(bp.dataset.previewUrl);
    const u=URL.createObjectURL(blob);
    bp.dataset.previewUrl=u;
    bp.src=u;
    bp.style.display="block";
    be.style.display="none";
    $("bannerMessage").textContent=`Auto-fit preview ready ✅ 2560×1440 · ${(blob.size/1024/1024).toFixed(2)} MB`;
  }catch(e){
    $("bannerMessage").textContent=e.message;
  }
};

$("openBannerStudio").onclick=()=>openStudio(studioCustomization,"YouTube Studio Branding khul raha hai. Banner ko yahan manage/remove kar sakte hain.");
$("removeChannelBanner").onclick=()=>openStudio(studioCustomization,"Banner remove karne ke liye YouTube Studio → Customization → Branding use karein.");
$("editNameLogoStudio").onclick=()=>openStudio(studioCustomization,"Channel name aur profile logo YouTube Studio me edit karein.");

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

loadAll();
