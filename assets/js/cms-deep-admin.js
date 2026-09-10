// Deep A-Z controls are intentionally integrated into cms-professional.js.
// This compatibility layer only removes the legacy repeated “Page Inside A-Z” panels.
const removeLegacyDeepPanels=()=>{
  document.getElementById('ytDeepAdminPanel')?.remove();
  document.getElementById('ytDeepSitePanel')?.remove();
  document.querySelectorAll('.yt-cms-card').forEach(card=>{
    const h=card.querySelector('h3');
    if(h&&/Page Inside A.?Z|Last Level/i.test(h.textContent||'')) card.remove();
  });
};
const mo=new MutationObserver(()=>{clearTimeout(window.__ytLegacyDeepRemove);window.__ytLegacyDeepRemove=setTimeout(removeLegacyDeepPanels,50)});
mo.observe(document.body,{childList:true,subtree:true});
removeLegacyDeepPanels();
