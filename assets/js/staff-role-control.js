const ROLE_LABELS={manager:'Manager',operator:'Operator',support:'Support'};

function openRoleControl(role){
  const page={manager:'manager-control.html',operator:'operator-control.html',support:'support-control.html'}[role];
  if(!page)return;
  sessionStorage.setItem('yt_staff_admin_role_focus',role);
  window.location.href=page;
}

document.querySelectorAll('[data-role-control]').forEach(btn=>{
  btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openRoleControl(btn.dataset.roleControl);});
});

/* Keep the first five Admin sidebar items permanently pinned.
   CMS may append/reorder other items later, so all remaining items are
   assigned a higher CSS order and the first five are re-applied. */
const nav=document.querySelector('.yt-premium-nav');
if(nav){
  const enforce=()=>{
    const all=[...nav.querySelectorAll('.yt-premium-nav-btn')];
    const pinned=[
      nav.querySelector('[data-view="dashboard"]'),
      nav.querySelector('[data-view="control-suite"]'),
      nav.querySelector('[data-role-control="manager"]'),
      nav.querySelector('[data-role-control="operator"]'),
      nav.querySelector('[data-role-control="support"]')
    ].filter(Boolean);
    const pinnedSet=new Set(pinned);
    pinned.forEach((el,i)=>{if(el.style.order!==String(i))el.style.order=String(i);});
    let n=5;
    all.forEach(el=>{
      if(pinnedSet.has(el))return;
      if(el.style.order!==String(n))el.style.order=String(n);
      n++;
    });
  };
  enforce();
  new MutationObserver(enforce).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});
}
