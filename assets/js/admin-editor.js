/* Admin Editor: isolated, local-only editor. It never changes routes, data, Auth or Supabase. */
(function(){
  "use strict";
  const KEY="yt_admin_editor_v1";
  const defaults={
    dashboard:true,sidebar:true,
    cards:{customers:"Total Users / Customers",channels:"Total YouTube Channels",access:"Access Requests",pending:"Pending Access",monetization:"Monetization Cases",adsense:"AdSense Linked",services:"Service Requests"},
    sidebar:{dashboard:"Dashboard",customers:"Users / Customers","user-requests":"User Requests","free-user-service":"Free User Service",channels:"YouTube Channels",manage:"Manage Channel",analytics:"Analytics / Stats",monetization:"Monetization Cases",adsense:"AdSense",reporting:"YouTube Reporting","live-streaming":"Live Streaming","live-chat":"Live Chat","embedded-player":"Embedded Player",oembed:"YouTube oEmbed",copyright:"Copyright / Restrictions",access:"Access Requests",services:"Services",payments:"Payments / PayU","service-charge":"Service Charge",history:"History",operations:"Operations Center","public-notifications":"Notifications","control-suite":"Admin Control Suite",cms:"Admin Dashboard CMS","website-cms":"Website CMS",editor:"Admin Editor",settings:"Settings"}
  };
  const icons={dashboard:"🏠",customers:"👥","user-requests":"📋","free-user-service":"🎁",channels:"📺",manage:"🎛️",analytics:"📊",monetization:"💰",adsense:"₹",reporting:"📑","live-streaming":"🔴","live-chat":"💬","embedded-player":"▶️",oembed:"🔗",copyright:"©️",access:"🔐",services:"🧰",payments:"💳","service-charge":"₹",history:"🕘",operations:"🧭","public-notifications":"🔔","control-suite":"🛡️",cms:"🧩","website-cms":"🌐",editor:"✏️",settings:"⚙️"};
  const order=Object.keys(defaults.sidebar);
  const $=id=>document.getElementById(id);
  function clone(o){return JSON.parse(JSON.stringify(o));}
  function load(){try{const x=JSON.parse(localStorage.getItem(KEY)||"null");return x&&x.cards&&x.sidebar?Object.assign(clone(defaults),x,{cards:Object.assign(clone(defaults.cards),x.cards),sidebar:Object.assign(clone(defaults.sidebar),x.sidebar)}):clone(defaults);}catch(_){return clone(defaults);}}
  function fill(d){
    const map={customers:"aeCustomersLabel",channels:"aeChannelsLabel",access:"aeAccessLabel",pending:"aePendingLabel",monetization:"aeMonetizationLabel",adsense:"aeAdsenseLabel",services:"aeServicesLabel"};
    Object.keys(map).forEach(k=>$(map[k])&&($(map[k]).value=d.cards[k]));
    const box=$("aeSidebarFields"); if(box){box.innerHTML=order.map(k=>`<div class="ae-side-field"><span class="ae-icon">${icons[k]||"•"}</span><input data-ae-sidebar="${k}" maxlength="60" value="${esc(d.sidebar[k]||defaults.sidebar[k])}"></div>`).join("");}
    $("aeDashboardLive").checked=d.dashboard!==false; $("aeSidebarLive").checked=d.sidebar!==false;
  }
  function esc(v){return String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}
  function collect(){
    const d=clone(defaults); d.dashboard=$("aeDashboardLive").checked; d.sidebar=$("aeSidebarLive").checked;
    const map={customers:"aeCustomersLabel",channels:"aeChannelsLabel",access:"aeAccessLabel",pending:"aePendingLabel",monetization:"aeMonetizationLabel",adsense:"aeAdsenseLabel",services:"aeServicesLabel"};
    Object.keys(map).forEach(k=>d.cards[k]=$(map[k]).value.trim()||defaults.cards[k]);
    document.querySelectorAll("[data-ae-sidebar]").forEach(i=>d.sidebar[i.dataset.aeSidebar]=i.value.trim()||defaults.sidebar[i.dataset.aeSidebar]);
    return d;
  }
  function apply(d){
    if(d.dashboard){const cards=document.querySelectorAll("#view-dashboard .yt-premium-stat-card"); const labels=[d.cards.customers,d.cards.channels,d.cards.access,d.cards.pending,d.cards.monetization,d.cards.adsense,d.cards.services]; cards.forEach((c,i)=>{const l=c.querySelector(".stat-label");if(l&&labels[i])l.textContent=labels[i];});}
    if(d.sidebar){document.querySelectorAll(".yt-premium-nav-btn[data-view]").forEach(b=>{const k=b.dataset.view,sp=b.querySelector("span");if(sp&&d.sidebar[k])sp.textContent=d.sidebar[k];});}
  }
  function msg(t,good=true){const m=$("adminEditorMessage");if(m)m.textContent=t; const s=$("adminEditorStatus");if(s){s.textContent=good?"● Saved":"● Ready";s.style.color=good?"#15803d":"";}}
  function init(){
    if(!$("view-editor"))return; let data=load(); fill(data);
    // Keep legacy editor storage compatible with existing dashboard renderer.
    function save(){data=collect();localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem("yt_admin_dashboard_labels",JSON.stringify({customers:data.cards.customers,channels:data.cards.channels,access:data.cards.access,monetization:data.cards.monetization}));apply(data);msg("Admin Editor changes saved successfully ✅");}
    $("aeSave")?.addEventListener("click",save);
    $("aePreview")?.addEventListener("click",()=>{apply(collect());msg("Preview applied. Click Save Changes to keep it. ⚡",false);});
    $("aeReset")?.addEventListener("click",()=>{if(!confirm("Reset Admin Editor settings to default?"))return;localStorage.removeItem(KEY);localStorage.removeItem("yt_admin_dashboard_labels");data=clone(defaults);fill(data);apply(data);msg("Admin Editor reset to default ✅");});
    apply(data);
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
})();