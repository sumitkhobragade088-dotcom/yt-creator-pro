const ROLE_LABELS={manager:'Manager',operator:'Operator',support:'Support'};

function openRoleControl(role){
  const safe=ROLE_LABELS[role] ? role : null;
  if(!safe) return;
  const target=new URL(`./${safe}-control.html`,window.location.href);
  window.location.assign(target.href);
}

function bindRoleControls(){
  document.querySelectorAll('[data-role-control]').forEach(btn=>{
    if(btn.dataset.roleControlBound==='1') return;
    btn.dataset.roleControlBound='1';
    btn.addEventListener('click',e=>{
      e.preventDefault();
      e.stopPropagation();
      openRoleControl(btn.dataset.roleControl);
    },true);
  });
}

function lockPrimaryAdminNav(){
  const nav=document.querySelector('.yt-premium-nav');
  if(!nav) return;
  const fixed=[
    nav.querySelector('[data-view="dashboard"]'),
    nav.querySelector('[data-fixed-order="2"]'),
    nav.querySelector('[data-fixed-order="3"]'),
    nav.querySelector('[data-fixed-order="4"]'),
    nav.querySelector('[data-fixed-order="5"]')
  ].filter(Boolean);
  const fixedSet=new Set(fixed);
  fixed.forEach((el,i)=>{
    el.hidden=false;
    el.style.order=String(i);
  });
  [...nav.children].forEach((el,i)=>{
    if(!fixedSet.has(el) && el.classList.contains('yt-premium-nav-btn')){
      el.style.order=String(10+i);
    }
  });
}

function enforceAdminNav(){
  bindRoleControls();
  lockPrimaryAdminNav();
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',enforceAdminNav,{once:true});
}else{
  enforceAdminNav();
}
setTimeout(enforceAdminNav,50);
setTimeout(enforceAdminNav,300);
setTimeout(enforceAdminNav,1000);

const nav=document.querySelector('.yt-premium-nav');
if(nav){
  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued) return;
    queued=true;
    requestAnimationFrame(()=>{
      queued=false;
      enforceAdminNav();
    });
  });
  observer.observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden']});
}
