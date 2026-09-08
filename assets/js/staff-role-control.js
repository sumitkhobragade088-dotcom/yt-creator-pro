const ROLE_LABELS={manager:'Manager',operator:'Operator',support:'Support'};
function openRoleControl(role){
  const nav=document.querySelector('.yt-premium-nav-btn[data-view="control-suite"]');
  if(typeof window.showPremiumAdminView==='function') window.showPremiumAdminView('control-suite');
  else nav?.click();
  sessionStorage.setItem('yt_acs_role_focus',role);
  const go=()=>{const tab=document.querySelector('[data-acs-tab="roles"]');if(tab)tab.click();const card=document.querySelector(`[data-role-card="${role}"]`);if(card){card.click();return true}return false};
  let n=0; const timer=setInterval(()=>{if(go()||++n>30)clearInterval(timer)},100);
}
document.querySelectorAll('[data-role-control]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();openRoleControl(btn.dataset.roleControl)}));
const nav=document.querySelector('.yt-premium-nav');
if(nav){const enforce=()=>{const wanted=['[data-view="dashboard"]','[data-fixed-order="2"]','[data-fixed-order="3"]','[data-fixed-order="4"]','[data-fixed-order="5"]'];wanted.forEach((sel,i)=>{const el=nav.querySelector(sel);if(el)el.style.order=String(i)});};enforce();new MutationObserver(enforce).observe(nav,{childList:true,subtree:true,attributes:true,attributeFilter:['style','hidden']});}
