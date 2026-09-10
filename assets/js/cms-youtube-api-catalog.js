(function(){
  const CAT=window.YTCMS_DEEP_CATALOG;if(!CAT||!Array.isArray(CAT['admin:index']))return;
  const esc=s=>String(s||'').replace(/"/g,'\\"');
  function path(el,root){
    if(el.id)return '#'+CSS.escape(el.id);
    const parts=[];let n=el;
    while(n&&n!==root&&n.nodeType===1){
      if(n.id){parts.unshift('#'+CSS.escape(n.id));break}
      const tag=n.tagName.toLowerCase();let ix=1,p=n.previousElementSibling;while(p){if(p.tagName===n.tagName)ix++;p=p.previousElementSibling}parts.unshift(`${tag}:nth-of-type(${ix})`);n=n.parentElement;
    }
    return parts.join(' > ');
  }
  for(const view of ['reporting','live-streaming','live-chat','embedded-player','oembed']){
    const sec=document.getElementById('view-'+view);if(!sec)continue;
    const els=[sec,...sec.querySelectorAll('*')].filter(e=>!['SCRIPT','STYLE','OPTION'].includes(e.tagName));
    for(const e of els){
      const selector=path(e,sec.parentElement);if(!selector)continue;
      if(CAT['admin:index'].some(x=>x.selector===selector))continue;
      CAT['admin:index'].push({selector,tag:e.tagName.toLowerCase(),text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,240),view,id:e.id||'',class:e.className&&typeof e.className==='string'?e.className:''});
    }
  }
})();
