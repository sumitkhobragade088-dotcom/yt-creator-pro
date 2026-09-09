/* Minimal Admin sidebar bridge. Does not reorder the sidebar or intercept Dashboard view buttons on index.html. */
(()=>{
  const routes={manager:"manager-control.html",operator:"operator-control.html",support:"support-control.html"};
  const nav=document.querySelector(".yt-premium-nav");
  if(!nav)return;
  const path=location.pathname.split("/").pop().toLowerCase();
  const role=Object.keys(routes).find(r=>routes[r].toLowerCase()===path)||null;
  if(role){
    nav.querySelectorAll(".yt-premium-nav-btn").forEach(b=>{
      const active=b.dataset.roleControl===role;
      b.classList.toggle("active",active);
      if(active)b.setAttribute("aria-current","page"); else b.removeAttribute("aria-current");
    });
  }
  nav.querySelectorAll("[data-role-control]").forEach(b=>{
    b.addEventListener("click",()=>{
      const r=b.dataset.roleControl;
      if(routes[r])location.href=routes[r];
    });
  });
  if(path!=="index.html")nav.querySelectorAll("[data-view]").forEach(b=>{
    b.addEventListener("click",()=>{
      try{sessionStorage.setItem("yt_admin_view",b.dataset.view||"dashboard");}catch(_){}
      location.href="index.html";
    });
  });
  const t=document.getElementById("ytPremiumSidebarToggle");
  if(t)t.addEventListener("click",()=>document.getElementById("ytPremiumSidebar")?.classList.toggle("open"));
})();
