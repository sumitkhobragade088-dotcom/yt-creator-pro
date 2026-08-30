import { supabase } from "./supabase.js";
const host=document.getElementById("ytPublicAnnouncementHost");
if(host){
  const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const [{data:settings},{data:rows}]=await Promise.all([
    supabase.from("feature_settings").select("feature_key,is_enabled").eq("feature_key","public_announcements").maybeSingle(),
    supabase.from("announcements").select("id,title,message,is_maintenance,created_at").eq("is_active",true).in("target",["public","all"]).order("created_at",{ascending:false}).limit(1)
  ]);
  if(settings?.is_enabled!==false && rows?.[0]){
    const a=rows[0];
    host.innerHTML=`<div class="yt-public-announcement ${a.is_maintenance?"maintenance":""}"><b>${a.is_maintenance?"🛠 ":"📢 "}${esc(a.title)}</b><span>${esc(a.message)}</span><button type="button" aria-label="Close">×</button></div>`;
    host.querySelector("button")?.addEventListener("click",()=>host.remove());
  }
}
