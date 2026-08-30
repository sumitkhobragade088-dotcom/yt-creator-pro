import { supabase } from './supabase.js';

const ADMIN_EMAIL='sumitkhobragade088@gmail.com';
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const slugify=v=>String(v||'page').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||('page-'+Date.now());

const DEFAULTS={
  preferences:{defaultLanguage:'en',defaultTheme:'light',showAdmin:true,showUser:true,showPublic:true,showAuth:true},
  admin_cms:{nav:{},hidden:[],order:[],pages:{},buttons:{},blocks:{},customPages:[],customButtons:[]},
  admin_theme:{enabled:false,activeThemeId:'',themes:[],sidebar:'',primary:'',surface:'',text:'',radius:''},
  website_cms:{nav:{},hidden:[],order:[],sections:{},cards:{},buttons:{},customPages:[],customButtons:[],customSections:[],brand:{name:'',tagline:''},footer:'',media:{logoUrl:'',heroImageUrl:''}},
  website_theme:{enabled:false,activeThemeId:'',themes:[],primary:'',surface:'',text:'',radius:''},
  maintenance:{enabled:false,title:'YT Creator Pro is being updated',message:'New improvements are being added. Please check back shortly.',reopen:'',status:'UPDATE IN PROGRESS'},
  seo:{title:'YT Creator Pro | Secure • Professional • Creator-Focused',description:'Professional YouTube creator support for channel management, monetization guidance, AdSense assistance and secure Google-authorized access.',keywords:'YT Creator Pro, YouTube creator support, channel management, monetization help, AdSense assistance',googleVerification:'',pages:{}}
};

function mergeDeep(base,extra){
  if(Array.isArray(base)) return Array.isArray(extra)?extra:base;
  if(!base||typeof base!=='object') return extra===undefined?base:extra;
  const out={...base};
  if(extra&&typeof extra==='object') for(const [k,v] of Object.entries(extra)) out[k]=(k in base)?mergeDeep(base[k],v):v;
  return out;
}
async function read(key){
  try{
    const {data,error}=await supabase.from('yt_cms_settings').select('value').eq('key',key).maybeSingle();
    if(!error&&data?.value){localStorage.setItem('ytcms_'+key,JSON.stringify(data.value));return mergeDeep(clone(DEFAULTS[key]||{}),data.value)}
  }catch(_){ }
  try{const v=JSON.parse(localStorage.getItem('ytcms_'+key)||'null');if(v)return mergeDeep(clone(DEFAULTS[key]||{}),v)}catch(_){ }
  return clone(DEFAULTS[key]||{});
}
async function write(key,value){
  const {data:{user}}=await supabase.auth.getUser();
  if(String(user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Admin authorization required');
  const {error}=await supabase.from('yt_cms_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'});
  if(error) throw error;
  localStorage.setItem('ytcms_'+key,JSON.stringify(value));
  return value;
}
async function uploadMedia(file){
  if(!file) throw new Error('Choose an image first');
  const {data:{user}}=await supabase.auth.getUser();
  if(String(user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Admin authorization required');
  const ext=(file.name.split('.').pop()||'png').toLowerCase().replace(/[^a-z0-9]/g,'');
  const path=`cms/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
  const {error}=await supabase.storage.from('yt-cms-media').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
  if(error) throw error;
  const {data}=supabase.storage.from('yt-cms-media').getPublicUrl(path);
  if(!data?.publicUrl) throw new Error('Unable to create public media URL');
  return data.publicUrl;
}
function themeValue(theme,name,fallback=''){
  if(theme?.activeThemeId&&Array.isArray(theme.themes)){
    const x=theme.themes.find(v=>v.id===theme.activeThemeId);if(x&&x[name]!==undefined)return x[name];
  }
  return theme?.[name]??fallback;
}
function clearThemeVars(isAdmin){
  const r=document.documentElement.style;['--yt-cms-primary','--yt-cms-surface','--yt-cms-text','--yt-cms-radius','--yt-cms-sidebar'].forEach(k=>r.removeProperty(k));
  document.body?.classList.remove(isAdmin?'yt-cms-admin-theme-enabled':'yt-cms-site-theme-enabled');
}
function applyThemeVars(theme,isAdmin){
  clearThemeVars(isAdmin);if(!theme?.enabled)return;
  const r=document.documentElement.style,primary=themeValue(theme,'primary'),surface=themeValue(theme,'surface'),text=themeValue(theme,'text'),radius=themeValue(theme,'radius'),sidebar=themeValue(theme,'sidebar');
  if(primary)r.setProperty('--yt-cms-primary',primary);if(surface)r.setProperty('--yt-cms-surface',surface);if(text)r.setProperty('--yt-cms-text',text);if(radius!==''&&radius!=null)r.setProperty('--yt-cms-radius',`${Number(radius)||0}px`);if(isAdmin&&sidebar)r.setProperty('--yt-cms-sidebar',sidebar);
  document.body?.classList.add(isAdmin?'yt-cms-admin-theme-enabled':'yt-cms-site-theme-enabled');injectThemeStyle(isAdmin);
}
function injectThemeStyle(isAdmin){
  const id=isAdmin?'ytCmsAdminThemeStyle':'ytCmsSiteThemeStyle';if(document.getElementById(id))return;
  const st=document.createElement('style');st.id=id;
  st.textContent=isAdmin?`
  .yt-cms-admin-theme-enabled .yt-premium-sidebar{background:var(--yt-cms-sidebar)!important}
  .yt-cms-admin-theme-enabled .yt-premium-top-btn.primary,.yt-cms-admin-theme-enabled .btn.primary{background:var(--yt-cms-primary)!important}
  .yt-cms-admin-theme-enabled .yt-premium-panel,.yt-cms-admin-theme-enabled .yt-premium-stat-card{border-radius:var(--yt-cms-radius)!important}
  .yt-cms-admin-theme-enabled .yt-premium-panel{background:var(--yt-cms-surface)!important;color:var(--yt-cms-text)!important}`:`
  .yt-cms-site-theme-enabled .yt-user-red-btn,.yt-cms-site-theme-enabled .register{background:var(--yt-cms-primary)!important}
  .yt-cms-site-theme-enabled article,.yt-cms-site-theme-enabled .yt-user-public-section{border-radius:var(--yt-cms-radius)!important}
  .yt-cms-site-theme-enabled article{background:var(--yt-cms-surface)!important;color:var(--yt-cms-text)!important}`;
  document.head.appendChild(st);
}

function applyAdvancedTheme(theme,isAdmin){if(!theme?.enabled||!theme?.advanced)return;const a=theme.advanced,st=document.createElement('style');st.id=isAdmin?'ytCmsAdminAdvanced':'ytCmsSiteAdvanced';const q=[];if(a.fontFamily)q.push(`body{font-family:${a.fontFamily}!important}`);if(a.fontSize)q.push(`body{font-size:${a.fontSize}!important}`);if(a.cardPadding)q.push(isAdmin?`.yt-premium-panel,.yt-premium-stat-card{padding:${a.cardPadding}!important}`:`article,.yt-user-public-section{padding:${a.cardPadding}!important}`);if(a.shadow)q.push(isAdmin?`.yt-premium-panel,.yt-premium-stat-card{box-shadow:${a.shadow}!important}`:`article,.yt-user-public-section{box-shadow:${a.shadow}!important}`);if(a.borderWidth)q.push(isAdmin?`.yt-premium-panel,.yt-premium-stat-card{border-width:${a.borderWidth}!important}`:`article,.yt-user-public-section{border-width:${a.borderWidth}!important}`);if(a.buttonRadius)q.push(`button,.btn,a.yt-cms-btn,.yt-user-red-btn,.yt-user-outline-btn{border-radius:${a.buttonRadius}!important}`);if(a.headerBg)q.push(isAdmin?`.yt-premium-header{background:${a.headerBg}!important}`:`.yt-user-public-header,.yt-user-auth-header{background:${a.headerBg}!important}`);if(a.footerBg&&!isAdmin)q.push(`.yt-user-public-footer{background:${a.footerBg}!important}`);if(a.sidebarWidth&&isAdmin)q.push(`.yt-premium-sidebar{width:${a.sidebarWidth}!important}`);if(a.contentWidth)q.push(isAdmin?`.yt-premium-main{max-width:${a.contentWidth}!important}`:`.yt-user-public-main{max-width:${a.contentWidth}!important;margin-inline:auto}`);st.textContent=q.join('\n');document.getElementById(st.id)?.remove();document.head.appendChild(st)}
function currentPage(){const n=location.pathname.split('/').pop();return n||'index.html'}
function setMeta(name,content,attr='name'){if(!content)return;let m=document.querySelector(`meta[${attr}="${name}"]`);if(!m){m=document.createElement('meta');m.setAttribute(attr,name);document.head.appendChild(m)}m.content=content}
function sortByOrder(nodes,order,keyFn){if(!Array.isArray(order)||!order.length)return;const map=new Map(order.map((k,i)=>[k,i]));nodes.forEach((el,i)=>el.style.order=String(map.has(keyFn(el))?map.get(keyFn(el)):1000+i))}
function adminNavConfig(c,key){const legacyHidden=(c.hidden||[]).includes(key),v=c.nav?.[key];return typeof v==='string'?{label:v,hidden:legacyHidden}:{label:'',icon:'',hidden:legacyHidden,...(v||{})}}

async function applyAdmin(){
  const c=await read('admin_cms'),t=await read('admin_theme');applyThemeVars(t,true);applyAdvancedTheme(t,true);
  const nav=document.querySelector('.yt-premium-nav');
  if(nav){
    const existing=[...nav.querySelectorAll('[data-view]')];
    existing.forEach(b=>{const k=b.dataset.view,v=adminNavConfig(c,k),sp=b.querySelector('span');if(v.label&&sp)sp.textContent=v.label;if(v.icon){const txt=[...b.childNodes].find(n=>n.nodeType===3);if(txt)txt.nodeValue=v.icon+' '}b.hidden=!!v.hidden});
    sortByOrder(existing,c.order||[],el=>el.dataset.view);
    for(const x of (c.customPages||[]).filter(v=>!v.hidden).sort((a,b)=>(a.order??999)-(b.order??999))){
      if(nav.querySelector(`[data-cms-custom-page="${x.id}"]`))continue;
      const b=document.createElement('button');b.className='yt-premium-nav-btn';b.dataset.cmsCustomPage=x.id;b.style.order=String(x.order??999);b.innerHTML=`${esc(x.icon||'🧩')} <span>${esc(x.label)}</span>`;nav.appendChild(b);
      let sec=document.querySelector(`[data-cms-admin-page="${x.id}"]`);if(!sec){sec=document.createElement('section');sec.className='yt-premium-view';sec.dataset.cmsAdminPage=x.id;sec.innerHTML=`<div class="yt-premium-section-head"><div><span>${esc(x.kicker||'CUSTOM PAGE')}</span><h2>${esc(x.label)}</h2><p>${esc(x.subtitle||'')}</p></div></div><div class="panel yt-premium-panel"><div>${esc(x.content||'').replace(/\n/g,'<br>')}</div></div>`;document.querySelector('.yt-premium-main')?.appendChild(sec)}
      b.addEventListener('click',()=>{document.querySelectorAll('.yt-premium-view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.yt-premium-nav-btn').forEach(v=>v.classList.remove('active'));sec.classList.add('active');b.classList.add('active');const title=document.getElementById('adminPageTitle');if(title)title.textContent=x.label;sessionStorage.setItem('yt_admin_view','cms-custom:'+x.id)});
    }
  }
  for(const [view,v] of Object.entries(c.pages||{})){const sec=document.getElementById('view-'+view);if(!sec)continue;sec.hidden=!!v.hidden;if(v.title){const h=sec.querySelector('.yt-premium-section-head h2,.yt-premium-hero h2');if(h)h.textContent=v.title}if(v.subtitle){const p=sec.querySelector('.yt-premium-section-head p,.yt-premium-hero p');if(p)p.textContent=v.subtitle}}
  for(const [id,v] of Object.entries(c.buttons||{})){const el=document.getElementById(id);if(!el)continue;if(v.label)el.textContent=v.label;el.hidden=!!v.hidden;if(v.href&&el.tagName==='A')el.href=v.href;if(el.tagName==='A'&&v.newTab!==undefined){el.target=v.newTab?'_blank':'_self';if(v.newTab)el.rel='noopener noreferrer'}}
  for(const [key,v] of Object.entries(c.blocks||{})){const el=document.querySelector(`[data-cms-block-key="${CSS.escape(key)}"]`);if(el){el.hidden=!!v.hidden;if(v.order!==undefined)el.style.order=String(v.order)}}
  for(const x of (c.customButtons||[]).filter(v=>!v.hidden).sort((a,b)=>(a.order??999)-(b.order??999))){if(document.querySelector(`[data-cms-admin-btn="${x.id}"]`))continue;const host=document.querySelector(x.host||'.yt-premium-header-actions')||document.querySelector('.yt-premium-header-actions');if(!host)continue;const a=document.createElement(x.href?'a':'button');a.className='yt-premium-top-btn';a.dataset.cmsAdminBtn=x.id;a.textContent=x.label||'New Button';a.style.order=String(x.order??999);if(x.href){a.href=x.href;a.target=x.newTab?'_blank':'_self';if(x.newTab)a.rel='noopener noreferrer'}host.appendChild(a)}
  const saved=sessionStorage.getItem('yt_admin_view')||'';if(saved.startsWith('cms-custom:')){const id=saved.slice(11),sec=document.querySelector(`[data-cms-admin-page="${CSS.escape(id)}"]`),b=document.querySelector(`[data-cms-custom-page="${CSS.escape(id)}"]`);if(sec&&b){document.querySelectorAll('.yt-premium-view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.yt-premium-nav-btn').forEach(v=>v.classList.remove('active'));sec.classList.add('active');b.classList.add('active');const x=(c.customPages||[]).find(v=>v.id===id),title=document.getElementById('adminPageTitle');if(title&&x)title.textContent=x.label}}
}
function siteNavConfig(c,key){const legacyHidden=(c.hidden||[]).includes(key),v=c.nav?.[key];return typeof v==='string'?{label:v,hidden:legacyHidden}:{label:'',hidden:legacyHidden,...(v||{})}}
function renderVirtualPage(c,slug){
  const x=(c.customPages||[]).find(v=>v.slug===slug&&!v.hidden);if(!x)return false;
  const main=document.querySelector('.yt-user-public-main');if(!main)return false;
  main.innerHTML=`<section class="yt-user-public-section" data-cms-virtual-page="${esc(x.id)}"><div class="yt-user-section-title"><span>${esc(x.kicker||'YT CREATOR PRO')}</span><h2>${esc(x.title||x.label||'Page')}</h2><p>${esc(x.subtitle||'')}</p></div><div class="yt-cms-public-page-content">${esc(x.content||'').replace(/\n/g,'<br>')}</div></section>`;
  document.title=x.seoTitle||x.title||x.label||document.title;return true;
}
async function applyWebsite(){
  const c=await read('website_cms'),t=await read('website_theme'),seo=await read('seo');applyThemeVars(t,false);applyAdvancedTheme(t,false);
  const page=currentPage(),params=new URLSearchParams(location.search),virtualSlug=params.get('slug')||params.get('page');
  if(page==='index.html'||page===''||page==='page.html'){
    const brandB=document.querySelector('.yt-user-public-brand b'),brandSmall=document.querySelector('.yt-user-public-brand small');if(brandB&&c.brand?.name)brandB.textContent=c.brand.name;if(brandSmall&&c.brand?.tagline)brandSmall.textContent=c.brand.tagline;
    const footer=document.querySelector('.yt-user-public-footer');if(footer&&c.footer)footer.textContent=c.footer;
    if(c.media?.logoUrl){const logo=document.querySelector('.yt-user-play-logo');if(logo){logo.textContent='';logo.style.backgroundImage=`url(\"${String(c.media.logoUrl).replace(/\"/g,'')}\")`;logo.style.backgroundSize='cover';logo.style.backgroundPosition='center'}}
    if(c.media?.heroImageUrl){const hero=document.querySelector('.yt-user-computer-screen');if(hero){hero.style.backgroundImage=`linear-gradient(rgba(8,15,30,.36),rgba(8,15,30,.36)),url(\"${String(c.media.heroImageUrl).replace(/\"/g,'')}\")`;hero.style.backgroundSize='cover';hero.style.backgroundPosition='center'}}
    const nav=document.querySelector('.yt-user-public-nav');if(nav){const links=[...nav.querySelectorAll('a:not([data-cms-site-btn])')];links.forEach(a=>{const k=a.getAttribute('href'),v=siteNavConfig(c,k);if(v.label)a.textContent=v.label;a.hidden=!!v.hidden;if(v.href)a.href=v.href});sortByOrder(links,c.order||[],a=>a.getAttribute('href'));for(const x of (c.customButtons||[]).filter(v=>!v.hidden&&(!v.placement||v.placement==='nav')).sort((a,b)=>(a.order??999)-(b.order??999))){if(nav.querySelector(`[data-cms-site-btn="${x.id}"]`))continue;const a=document.createElement('a');a.dataset.cmsSiteBtn=x.id;a.href=x.href||'#';a.textContent=x.label||'New';a.style.order=String(x.order??999);if(x.newTab){a.target='_blank';a.rel='noopener noreferrer'}nav.appendChild(a)}for(const p of (c.customPages||[]).filter(v=>!v.hidden&&v.showInMenu!==false).sort((a,b)=>(a.order??999)-(b.order??999))){if(nav.querySelector(`[data-cms-page-link="${p.id}"]`))continue;const a=document.createElement('a');a.dataset.cmsPageLink=p.id;a.href=`page.html?slug=${encodeURIComponent(p.slug)}`;a.textContent=p.menuLabel||p.title||p.label||'Page';a.style.order=String(p.order??999);nav.appendChild(a)}}
    for(const x of (c.customButtons||[]).filter(v=>!v.hidden&&v.placement&&v.placement!=='nav').sort((a,b)=>(a.order??999)-(b.order??999))){if(document.querySelector(`[data-cms-site-btn="${x.id}"]`))continue;const host=x.placement==='hero'?document.querySelector('.yt-user-home-actions'):x.placement==='footer'?document.querySelector('.yt-user-public-footer'):null;if(!host)continue;const a=document.createElement('a');a.dataset.cmsSiteBtn=x.id;a.href=x.href||'#';a.textContent=x.label||'New';a.className=x.placement==='hero'?'yt-user-outline-btn':'yt-cms-footer-link';if(x.newTab){a.target='_blank';a.rel='noopener noreferrer'}host.appendChild(a)}
    if(virtualSlug)renderVirtualPage(c,virtualSlug);else{
      for(const [id,v] of Object.entries(c.sections||{})){const sec=document.getElementById(id);if(!sec)continue;sec.hidden=!!v.hidden;if(v.order!==undefined)sec.style.order=String(v.order);const h=sec.querySelector('h2'),p=sec.querySelector('.yt-user-section-title p'),k=sec.querySelector('.yt-user-section-title span');if(h&&v.title)h.textContent=v.title;if(p&&v.text)p.textContent=v.text;if(k&&v.kicker)k.textContent=v.kicker}
      for(const [key,v] of Object.entries(c.cards||{})){const el=document.querySelector(`[data-cms-site-card="${CSS.escape(key)}"]`);if(!el)continue;el.hidden=!!v.hidden;if(v.order!==undefined)el.style.order=String(v.order);const h=el.querySelector('h3'),p=el.querySelector('p'),b=el.querySelector('b');if(h&&v.title)h.textContent=v.title;if(p&&v.text)p.textContent=v.text;if(b&&v.icon)b.textContent=v.icon}
      const main=document.querySelector('.yt-user-public-main');for(const x of (c.customSections||[]).filter(v=>!v.hidden).sort((a,b)=>(a.order??999)-(b.order??999))){if(!main||main.querySelector(`[data-cms-section="${x.id}"]`))continue;const sec=document.createElement('section');sec.className='yt-user-public-section';sec.dataset.cmsSection=x.id;sec.style.order=String(x.order??999);sec.innerHTML=`<div class="yt-user-section-title"><span>${esc(x.kicker||'NEW')}</span><h2>${esc(x.title)}</h2><p>${esc(x.content||'')}</p></div>`;main.appendChild(sec)}
    }
  }
  for(const [id,v] of Object.entries(c.buttons||{})){const el=document.getElementById(id);if(!el)continue;if(v.label)el.textContent=v.label;el.hidden=!!v.hidden;if(v.href&&el.tagName==='A')el.href=v.href;if(el.tagName==='A'&&v.newTab!==undefined){el.target=v.newTab?'_blank':'_self';if(v.newTab)el.rel='noopener noreferrer'}}
  const pageSeo=seo.pages?.[virtualSlug||page]||{};document.title=pageSeo.title||seo.title||document.title;const desc=pageSeo.description||seo.description;setMeta('description',desc);setMeta('keywords',pageSeo.keywords||seo.keywords);if(seo.googleVerification)setMeta('google-site-verification',seo.googleVerification);setMeta('og:title',document.title,'property');setMeta('og:description',desc,'property');setMeta('og:type','website','property');let canonical=document.querySelector('link[rel=\"canonical\"]');if(!canonical){canonical=document.createElement('link');canonical.rel='canonical';document.head.appendChild(canonical)}canonical.href=location.href.split('#')[0];
}
async function maintenanceGuard(){
  if(location.pathname.includes('/admin/')||location.pathname.endsWith('/google-callback.html')||location.pathname.endsWith('google-callback.html'))return false;const m=await read('maintenance'),preview=new URLSearchParams(location.search).get('maintenance_preview')==='1';if(!m.enabled&&!preview)return false;
  document.documentElement.classList.remove('yt-user-boot','yt-user-view-restoring');
  document.body.innerHTML=`<main class="yt-maintenance-screen"><section class="yt-maintenance-card"><div class="yt-maintenance-icon">🛠️</div><div class="yt-maintenance-kicker">YT CREATOR PRO • SYSTEM UPDATE</div><h1>${esc(m.title)}</h1><p>${esc(m.message)}</p>${m.reopen?`<div class="yt-maintenance-reopen">Expected reopening: <b>${esc(m.reopen)}</b></div>`:''}<div class="yt-maintenance-status"><i></i>${esc(m.status||'UPDATE IN PROGRESS')}</div></section></main>`;
  if(!document.getElementById('ytMaintenanceStyle')){const st=document.createElement('style');st.id='ytMaintenanceStyle';st.textContent=`.yt-maintenance-screen{min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at top,#202b42,#070b13 72%);font-family:Arial,sans-serif}.yt-maintenance-card{width:min(720px,94vw);background:#fff;border-radius:26px;padding:42px 26px;text-align:center;box-shadow:0 30px 90px rgba(0,0,0,.35)}.yt-maintenance-icon{font-size:54px}.yt-maintenance-kicker{font-size:12px;font-weight:900;letter-spacing:.12em;color:#dc2626;margin:12px 0}.yt-maintenance-card h1{font-size:clamp(30px,6vw,50px);margin:0;color:#111827}.yt-maintenance-card p{font-size:17px;line-height:1.7;color:#64748b}.yt-maintenance-reopen{padding:12px;background:#f8fafc;border-radius:12px}.yt-maintenance-status{margin-top:20px;color:#15803d;font-weight:900;display:flex;gap:8px;justify-content:center;align-items:center}.yt-maintenance-status i{width:9px;height:9px;background:#22c55e;border-radius:50%;box-shadow:0 0 0 5px rgba(34,197,94,.12)}`;document.head.appendChild(st)}
  return true;
}
function inventoryAdminBlocks(){
  const out=[];document.querySelectorAll('.yt-premium-view').forEach(view=>{const vk=(view.id||'').replace('view-','')||view.dataset.cmsAdminPage;if(!vk)return;[...view.children].forEach((el,i)=>{if(el.id==='adminCmsFull'||el.id==='websiteCmsFull')return;const key=`${vk}:${el.id||el.classList[0]||el.tagName.toLowerCase()}:${i}`;el.dataset.cmsBlockKey=key;out.push({key,view:vk,label:el.querySelector('h2,h3')?.textContent?.trim()||el.id||el.classList[0]||el.tagName})})});return out;
}
function inventoryWebsite(){
  return {sections:[...document.querySelectorAll('.yt-user-public-main > section[id]')].map((el,i)=>({id:el.id,label:el.querySelector('h2')?.textContent?.trim()||el.id,order:i})),cards:[...document.querySelectorAll('#services article')].map((el,i)=>{const key='service-'+i;el.dataset.cmsSiteCard=key;return {key,label:el.querySelector('h3')?.textContent?.trim()||key,order:i}})};
}
window.YTCMS={read,write,uploadMedia,applyAdmin,applyWebsite,maintenanceGuard,defaults:DEFAULTS,slugify,inventoryAdminBlocks,inventoryWebsite};
if(location.pathname.includes('/admin/')){inventoryAdminBlocks();await applyAdmin()}else{inventoryWebsite();const stopped=await maintenanceGuard();if(!stopped)await applyWebsite()}
