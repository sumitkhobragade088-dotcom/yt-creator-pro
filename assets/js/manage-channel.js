import { supabase } from "./supabase.js";

const FUNCTION_URL = "https://ncxexmekzlrliicaqfcl.supabase.co/functions/v1/youtube-manage";
const customerId = new URLSearchParams(location.search).get("customer");
const list = document.getElementById("videoList");
const msg = document.getElementById("manageMessage");
let videos = [];

async function adminSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) location.href = "login.html";
  return session;
}

async function callManage(action, payload={}) {
  const session = await adminSession();
  const r = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type":"application/json",
      "Authorization":"Bearer "+session.access_token
    },
    body: JSON.stringify({action, customer_id:customerId, ...payload})
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.details || data.error || "Request failed");
  return data;
}

function render() {
  if (!videos.length) { list.innerHTML="<p>No videos found.</p>"; return; }
  list.innerHTML = videos.map((v,i)=>`
    <div class="yt-video-row">
      <img src="${v.thumbnail||""}" alt="">
      <div class="yt-video-info"><b>${escapeHtml(v.title)}</b><small>${v.id}</small></div>
      <button class="btn primary" data-edit="${i}">Edit / Update</button>
    </div>`).join("");
  document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEdit(Number(b.dataset.edit)));
}
function escapeHtml(x=""){return x.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}

async function load() {
  try {
    msg.textContent="Loading videos…";
    const data=await callManage("list_videos");
    videos=data.videos||[];
    document.getElementById("channelTitle").textContent=data.channel_name ? "Manage: "+data.channel_name : "Manage Channel";
    msg.textContent="Connected channel loaded ✅";
    render();
  } catch(e) { msg.textContent=e.message; list.textContent="Could not load videos."; }
}
function openEdit(i){
  const v=videos[i];
  editVideoId.value=v.id; editTitle.value=v.title||""; editDescription.value=v.description||"";
  editTags.value=(v.tags||[]).join(", "); editCategory.value=v.categoryId||"22";
  editMessage.textContent=""; editModal.hidden=false;
}
closeModal.onclick=()=>editModal.hidden=true;
refreshVideos.onclick=load;
saveVideo.onclick=async()=>{
  try{
    saveVideo.disabled=true; editMessage.textContent="Updating…";
    await callManage("update_video",{
      video_id:editVideoId.value,
      title:editTitle.value.trim(),
      description:editDescription.value,
      tags:editTags.value.split(",").map(x=>x.trim()).filter(Boolean),
      category_id:editCategory.value.trim()||"22"
    });
    editMessage.textContent="Updated on YouTube ✅";
    await load();
  }catch(e){editMessage.textContent=e.message}
  finally{saveVideo.disabled=false}
};
load();
