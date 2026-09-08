const ROLE_LABELS={manager:'Manager',operator:'Operator',support:'Support'};

function openRoleControl(role){
  const safe=ROLE_LABELS[role]?role:'manager';
  window.location.href=`${location.origin}${location.pathname.replace(/\/admin\/index\.html$/,'')}/admin/${safe}-control.html`;
}

document.querySelectorAll('[data-role-control]').forEach(btn=>{
  btn.addEventListener('click',e=>{
    e.preventDefault();
    e.stopPropagation();
    openRoleControl(btn.dataset.roleControl);
  });
});

// Keep the first five Admin controls physically at the top.  This is DOM order,
// not only CSS order, so later CMS/sidebar rendering cannot push them down.
(function lockPrimaryAdminNav(){
  const nav=document.querySelector('.yt-premium-nav');
  if(!nav)return;
  let running=false;
  const enforce=()=>{
    if(running)return;
    const dashboard=nav.querySelector('[data-view="dashboard"]');
    const suite=nav.querySelector('[data-fixed-order="2"]');
    const manager=nav.querySelector('[data-fixed-order="3"]');
    const operator=nav.querySelector('[data-fixed-order="4"]');
    const support=nav.querySelector('[data-fixed-order="5"]');
    if(!dashboard||!suite||!manager||!operator||!support)return;
    running=true;
    [suite,manager,operator,support].forEach((el,i)=>{
      el.style.order=String(i+1);
    });
    dashboard.style.order='0';
    let cursor=dashboard.nextElementSibling;
    [suite,manager,operator,support].forEach(el=>{
      if(el!==cursor){nav.insertBefore(el,cursor||null);}
      cursor=el.nextElementSibling;
    });
    running=false;
  };
  enforce();
  new MutationObserver(enforce).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','hidden']});
  setTimeout(enforce,100);
  setTimeout(enforce,500);
  setTimeout(enforce,1500);
})();
