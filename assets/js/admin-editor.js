import { supabase } from "./supabase.js";

/* Admin Editor — global settings with local fallback.
   Only editor settings are touched; routes, data, Auth and existing dashboard logic stay unchanged. */
(function(){
  "use strict";
  const KEY="yt_admin_editor_v1";
  const REMOTE_TIMEOUT=8000;
  const defaults={
    dashboard:true,sidebar:true,
    cards:{customers:"Total Users / Customers",channels:"Total YouTube Channels",access:"Access Requests",pending:"Pending Access",monetization:"Monetization Cases",adsense:"AdSense Linked",services:"Service Requests"},
    sidebar:{dashboard:"Dashboard",customers:"Users / Customers","user-requests":"User Requests","free-user-service":"Free User Service",channels:"YouTube Channels",manage:"Manage Channel",analytics:"Analytics / Stats",monetization:"Monetization Cases",adsense:"AdSense",reporting:"YouTube Reporting","live-streaming":"Live Streaming","live-chat":"Live Chat","embedded-player":"Embedded Player",oembed:"YouTube oEmbed",copyright:"Copyright / Restrictions",access:"Access Requests",services:"Services",payments:"Payments / PayU","service-charge":"Service Charge",history:"History",operations:"Operations Center","public-notifications":"Notifications","control-suite":"Admin Control Suite",cms:"Admin Dashboard CMS","website-cms":"Website CMS",editor:"Admin Editor",settings:"Settings"}
  };
  const icons={dashboard:"🏠",customers:"👥","user-requests":"📋","free-user-service":"🎁",channels:"📺",manage:"🎛️",analytics:"📊",monetization:"💰",adsense:"₹",reporting:"📑","live-streaming":"🔴","live-chat":"💬", "embedded-player":"▶️",oembed:"🔗",copyright:"©️",access:"🔐",services:"🧰",payments:"💳","service-charge":"₹",history:"🕘",operations:"🧭","public-notifications":"🔔","control-suite":"🛡️",cms:"🧩","website-cms":"🌐",editor:"✏️",settings:"⚙️"};
  const order=Object.keys(defaults.sidebar);
  const $=id=>document.getElementById(id);
  const clone=o=>JSON.parse(JSON.stringify(o));
  const esc=v=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
  function merge(saved){
    if(!saved||typeof saved!=="object") return clone(defaults);
    return {dashboard:saved.dashboard!==false,sidebar:saved.sidebar!==false,cards:Object.assign(clone(defaults.cards),saved.cards||{}),sidebarLabels:Object.assign(clone(defaults.sidebar),saved.sidebarLabels||saved.sidebar||{})};
  }
  function toStored(d){return {dashboard:d.dashboard,sidebar:d.sidebar,cards:clone(d.cards),sidebarLabels:clone(d.sidebarLabels||d.sidebar)};}
  function loadLocal(){try{return merge(JSON.parse(localStorage.getItem(KEY)||"null"));}catch(_){return clone(defaults);}}
  function saveLocal(d){try{localStorage.setItem(KEY,JSON.stringify(toStored(d)));localStorage.setItem("yt_admin_dashboard_labels",JSON.stringify({customers:d.cards.customers,channels:d.cards.channels,access:d.cards.access,monetization:d.cards.monetization}));}catch(_){} }
  function fill(d){
    const map={customers:"aeCustomersLabel",channels:"aeChannelsLabel",access:"aeAccessLabel",pending:"aePendingLabel",monetization:"aeMonetizationLabel",adsense:"aeAdsenseLabel",services:"aeServicesLabel"};
    Object.keys(map).forEach(k=>$(map[k])&&($(map[k]).value=d.cards[k]));
    const box=$("aeSidebarFields"); if(box) box.innerHTML=order.map(k=>`<div class="ae-side-field"><span class="ae-icon">${icons[k]||"•"}</span><input data-ae-sidebar="${k}" maxlength="60" value="${esc(d.sidebarLabels[k]||defaults.sidebar[k])}"></div>`).join("");
    if($("aeDashboardLive")) $("aeDashboardLive").checked=d.dashboard!==false;
    if($("aeSidebarLive")) $("aeSidebarLive").checked=d.sidebar!==false;
  }
  function collect(){
    const d=clone(defaults); d.dashboard=$("aeDashboardLive").checked; d.sidebar=$("aeSidebarLive").checked; d.sidebarLabels={};
    const map={customers:"aeCustomersLabel",channels:"aeChannelsLabel",access:"aeAccessLabel",pending:"aePendingLabel",monetization:"aeMonetizationLabel",adsense:"aeAdsenseLabel",services:"aeServicesLabel"};
    Object.keys(map).forEach(k=>d.cards[k]=$(map[k]).value.trim()||defaults.cards[k]);
    document.querySelectorAll("[data-ae-sidebar]").forEach(i=>d.sidebarLabels[i.dataset.aeSidebar]=i.value.trim()||defaults.sidebar[i.dataset.aeSidebar]);
    return d;
  }
  function apply(d){
    if(d.dashboard){const cards=document.querySelectorAll("#view-dashboard .yt-premium-stat-card");const labels=[d.cards.customers,d.cards.channels,d.cards.access,d.cards.pending,d.cards.monetization,d.cards.adsense,d.cards.services];cards.forEach((c,i)=>{const l=c.querySelector(".stat-label");if(l&&labels[i])l.textContent=labels[i];});}
    if(d.sidebar){document.querySelectorAll(".yt-premium-nav-btn[data-view]").forEach(b=>{const k=b.dataset.view,sp=b.querySelector("span");if(sp&&d.sidebarLabels[k])sp.textContent=d.sidebarLabels[k];});}
  }
  function status(text,good){const m=$("adminEditorMessage");if(m)m.textContent=text;const s=$("adminEditorStatus");if(s){s.textContent=good?"● Saved":"● Ready";s.style.color=good?"#15803d":"";}}
  async function remoteGet(){
    const p=supabase.rpc("admin_editor_get");
    const r=await Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("Remote settings timeout")),REMOTE_TIMEOUT))]);
    if(r.error)throw r.error;
    return r.data?.settings?merge(r.data.settings):null;
  }
  async function remoteSave(d){
    const p=supabase.rpc("admin_editor_save",{p_settings:toStored(d)});
    const r=await Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("Save timeout")),REMOTE_TIMEOUT))]);
    if(r.error)throw r.error;
  }
  async function remoteReset(){
    const p=supabase.rpc("admin_editor_reset");
    const r=await Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("Reset timeout")),REMOTE_TIMEOUT))]);
    if(r.error)throw r.error;
  }
  async function init(){
    if(!$("view-editor"))return;
    let data=loadLocal(); fill(data); apply(data);
    try{const remote=await remoteGet();if(remote){data=remote;saveLocal(data);fill(data);apply(data);status("Global Admin Editor settings loaded ✅",true);}}
    catch(e){console.warn("Admin Editor remote load unavailable; local settings retained.",e);status("Ready — local fallback active",false);}
    $("aePreview")?.addEventListener("click",()=>{apply(collect());status("Preview applied. Click Save Changes to keep it. ⚡",false);});
    $("aeSave")?.addEventListener("click",async()=>{
      const btn=$("aeSave");if(btn)btn.disabled=true;const next=collect();apply(next);status("Saving globally…",false);
      try{await remoteSave(next);saveLocal(next);data=next;status("Saved globally for authorized Admins ✅",true);}
      catch(e){saveLocal(next);data=next;status(`Global save failed: ${e?.message||"Please try again."}`,false);}
      finally{if(btn)btn.disabled=false;}
    });
    $("aeReset")?.addEventListener("click",async()=>{
      if(!confirm("Reset Admin Editor settings to default for all authorized Admins?"))return;
      const btn=$("aeReset");if(btn)btn.disabled=true;status("Resetting globally…",false);
      try{await remoteReset();localStorage.removeItem(KEY);localStorage.removeItem("yt_admin_dashboard_labels");data=clone(defaults);fill(data);apply(data);status("Global settings reset to default ✅",true);}
      catch(e){status(`Global reset failed: ${e?.message||"Please try again."}`,false);}
      finally{if(btn)btn.disabled=false;}
    });
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();
