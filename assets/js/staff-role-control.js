const ROLE_CONTROL_PAGES={manager:"manager-control.html",operator:"operator-control.html",support:"support-control.html"};
document.querySelectorAll("[data-role-control]").forEach(btn=>{
  btn.addEventListener("click",e=>{
    e.preventDefault();
    e.stopImmediatePropagation();
    const page=ROLE_CONTROL_PAGES[btn.dataset.roleControl];
    if(page) window.location.href=page;
  },true);
});
const nav=document.querySelector(".yt-premium-nav");
if(nav){
  const enforce=()=>{
    nav.querySelectorAll(".yt-premium-nav-btn[data-fixed-top]").forEach(x=>x.style.setProperty("order","0","important"));
    nav.querySelectorAll(".yt-premium-nav-btn:not([data-fixed-top])").forEach(x=>x.style.setProperty("order","1","important"));
  };
  enforce();
  new MutationObserver(enforce).observe(nav,{childList:true,subtree:true});
}
