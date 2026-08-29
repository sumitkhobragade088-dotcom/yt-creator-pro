import { supabase } from './supabase.js';
const ADMIN_EMAIL='sumitkhobragade088@gmail.com';
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const DEFAULTS={
 admin_cms:{nav:{},hidden:[],pages:{},buttons:{},customPages:[],customButtons:[]},
 admin_theme:{enabled:false,sidebar:'',primary:'',surface:'',text:'',radius:''},
 website_cms:{nav:{},hidden:[],sections:{},buttons:{},customPages:[],customButtons:[],customSections:[],brand:'',footer:''},
 website_theme:{enabled:false,primary:'',surface:'',text:'',radius:''},
 maintenance:{enabled:false,title:'YT Creator Pro is being updated',message:'New improvements are being added. Please check back shortly.',reopen:''},
 seo:{title:'YT Creator Pro | Secure • Professional • Creator-Focused',description:'Professional YouTube creator support for channel management, monetization guidance, AdSense assistance and secure Google-authorized access.',keywords:'YT Creator Pro, YouTube creator support, channel management, monetization help, AdSense assistance',googleVerification:''}
};
async function read(key){
 try{const {data,error}=await supabase.from('yt_cms_settings').select('value').eq('key',key).maybeSingle();if(!error&&data?.value){localStorage.setItem('ytcms_'+key,JSON.stringify(data.value));return {...clone(DEFAULTS[key]||{}),...data.value};}}catch(_){ }
 try{const v=JSON.parse(localStorage.getItem('ytcms_'+key)||'null');if(v)return {...clone(DEFAULTS[key]||{}),...v};}catch(_){ }
 return clone(DEFAULTS[key]||{});
}
async function write(key,value){
 const {data:{user}}=await supabase.auth.getUser();
 if(String(user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Admin authorization required');
 const {error}=await supabase.from('yt_cms_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(error) throw error;localStorage.setItem('ytcms_'+key,JSON.stringify(value));return value;
}
function applyThemeVars(theme,isAdmin){
 if(!theme?.enabled)return;
 const r=document.documentElement.style;
 if(theme.primary)r.setProperty('--yt-cms-primary',theme.primary);
 if(theme.surface)r.setProperty('--yt-cms-surface',theme.surface);
 if(theme.text)r.setProperty('--yt-cms-text',theme.text);
 if(theme.radius!==''&&theme.radius!=null)r.setProperty('--yt-cms-radius',`${Number(theme.radius)||0}px`);
 if(isAdmin&&theme.sidebar)r.setProperty('--yt-cms-sidebar',theme.sidebar);
 document.body.classList.add(isAdmin?'yt-cms-admin-theme-enabled':'yt-cms-site-theme-enabled');
 injectThemeStyle(isAdmin);
}
function injectThemeStyle(isAdmin){
 if(document.getElementById('ytCmsThemeStyle'))return;
 const st=document.createElement('style');st.id='ytCmsThemeStyle';
 st.textContent=isAdmin?`
 .yt-cms-admin-theme-enabled .yt-premium-sidebar{background:var(--yt-cms-sidebar)!important}
 .yt-cms-admin-theme-enabled .yt-premium-top-btn.primary,.yt-cms-admin-theme-enabled .btn.primary{background:var(--yt-cms-primary)!important}
 .yt-cms-admin-theme-enabled .yt-premium-panel{background:var(--yt-cms-surface)!important;color:var(--yt-cms-text)!important;border-radius:var(--yt-cms-radius)!important}`:`
 .yt-cms-site-theme-enabled .yt-user-red-btn{background:var(--yt-cms-primary)!important}
 .yt-cms-site-theme-enabled article{background:var(--yt-cms-surface)!important;color:var(--yt-cms-text)!important;border-radius:var(--yt-cms-radius)!important}`;
 document.head.appendChild(st);
}
function currentPage(){const n=location.pathname.split('/').pop();return n||'index.html'}
async function applyAdmin(){
 const c=await read('admin_cms'),t=await read('admin_theme');applyThemeVars(t,true);
 const nav=document.querySelector('.yt-premium-nav');
 if(nav){
  [...nav.querySelectorAll('[data-view]')].forEach(b=>{const k=b.dataset.view;const sp=b.querySelector('span');if(c.nav?.[k]&&sp)sp.textContent=c.nav[k];b.hidden=(c.hidden||[]).includes(k)});
  for(const x of c.customPages||[]){if(nav.querySelector(`[data-cms-custom-page="${x.id}"]`))continue;const b=document.createElement('button');b.className='yt-premium-nav-btn';b.dataset.cmsCustomPage=x.id;b.innerHTML=`🧩 <span>${esc(x.label)}</span>`;nav.appendChild(b);let sec=document.querySelector(`[data-cms-admin-page="${x.id}"]`);if(!sec){sec=document.createElement('section');sec.className='yt-premium-view';sec.dataset.cmsAdminPage=x.id;sec.innerHTML=`<div class="yt-premium-section-head"><div><span>CUSTOM PAGE</span><h2>${esc(x.label)}</h2><p>${esc(x.subtitle||'')}</p></div></div><div class="panel yt-premium-panel"><div>${esc(x.content||'').replace(/\n/g,'<br>')}</div></div>`;document.querySelector('.yt-premium-main')?.appendChild(sec)}b.addEventListener('click',()=>{document.querySelectorAll('.yt-premium-view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.yt-premium-nav-btn').forEach(v=>v.classList.remove('active'));sec.classList.add('active');b.classList.add('active');document.getElementById('adminPageTitle').textContent=x.label;sessionStorage.setItem('yt_admin_view','dashboard')})}
 }
 for(const [view,v] of Object.entries(c.pages||{})){const sec=document.getElementById('view-'+view);if(!sec)continue;if(v.title){const h=sec.querySelector('.yt-premium-section-head h2');if(h)h.textContent=v.title}if(v.subtitle){const p=sec.querySelector('.yt-premium-section-head p');if(p)p.textContent=v.subtitle}}
 for(const [id,v] of Object.entries(c.buttons||{})){const el=document.getElementById(id);if(!el)continue;if(v.label)el.textContent=v.label;el.hidden=!!v.hidden;if(v.href&&el.tagName==='A')el.href=v.href}
 for(const x of c.customButtons||[]){if(document.querySelector(`[data-cms-admin-btn="${x.id}"]`))continue;const host=document.querySelector(x.host||'.yt-premium-top-actions');if(!host)continue;const a=document.createElement(x.href?'a':'button');a.className='yt-premium-top-btn';a.dataset.cmsAdminBtn=x.id;a.textContent=x.label||'New Button';if(x.href){a.href=x.href;a.target=x.newTab?'_blank':'_self';a.rel='noopener noreferrer'}host.appendChild(a)}
}
async function applyWebsite(){
 const c=await read('website_cms'),t=await read('website_theme'),seo=await read('seo');applyThemeVars(t,false);
 const page=currentPage();
 if(page==='index.html'){
  const brand=document.querySelector('.yt-user-public-brand b');if(brand&&c.brand)brand.textContent=c.brand;
  const footer=document.querySelector('.yt-user-public-footer');if(footer&&c.footer)footer.textContent=c.footer;
  const nav=document.querySelector('.yt-user-public-nav');if(nav){[...nav.querySelectorAll('a')].forEach(a=>{const k=a.getAttribute('href');if(c.nav?.[k])a.textContent=c.nav[k];a.hidden=(c.hidden||[]).includes(k)});for(const x of c.customButtons||[]){if(nav.querySelector(`[data-cms-site-btn="${x.id}"]`))continue;const a=document.createElement('a');a.dataset.cmsSiteBtn=x.id;a.href=x.href||'#';a.textContent=x.label||'New';if(x.newTab){a.target='_blank';a.rel='noopener noreferrer'}nav.appendChild(a)}}
  for(const [id,v] of Object.entries(c.sections||{})){const sec=document.getElementById(id);if(!sec)continue;sec.hidden=!!v.hidden;const h=sec.querySelector('h2'),p=sec.querySelector('.yt-user-section-title p');if(h&&v.title)h.textContent=v.title;if(p&&v.text)p.textContent=v.text}
  const main=document.querySelector('.yt-user-public-main');for(const x of c.customSections||[]){if(!main||main.querySelector(`[data-cms-section="${x.id}"]`))continue;const sec=document.createElement('section');sec.className='yt-user-public-section';sec.dataset.cmsSection=x.id;sec.innerHTML=`<div class="yt-user-section-title"><span>${esc(x.kicker||'NEW')}</span><h2>${esc(x.title)}</h2><p>${esc(x.content||'')}</p></div>`;main.appendChild(sec)}
 }
 for(const [id,v] of Object.entries(c.buttons||{})){const el=document.getElementById(id);if(!el)continue;if(v.label)el.textContent=v.label;el.hidden=!!v.hidden;if(v.href&&el.tagName==='A')el.href=v.href}
 if(seo.title)document.title=seo.title;setMeta('description',seo.description);setMeta('keywords',seo.keywords);if(seo.googleVerification)setMeta('google-site-verification',seo.googleVerification);
}
function setMeta(name,content){if(!content)return;let m=document.querySelector(`meta[name="${name}"]`);if(!m){m=document.createElement('meta');m.name=name;document.head.appendChild(m)}m.content=content}
async function maintenanceGuard(){if(location.pathname.includes('/admin/'))return false;const m=await read('maintenance');if(!m.enabled)return false;document.documentElement.classList.remove('yt-user-boot','yt-user-view-restoring');document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at top,#202b42,#070b13 72%);font-family:Arial,sans-serif"><section style="width:min(720px,94vw);background:#fff;border-radius:26px;padding:42px 26px;text-align:center;box-shadow:0 30px 90px rgba(0,0,0,.35)"><div style="font-size:54px">🛠️</div><div style="font-size:12px;font-weight:900;letter-spacing:.12em;color:#dc2626;margin:12px 0">YT CREATOR PRO • SYSTEM UPDATE</div><h1 style="font-size:clamp(30px,6vw,50px);margin:0;color:#111827">${esc(m.title)}</h1><p style="font-size:17px;line-height:1.7;color:#64748b">${esc(m.message)}</p>${m.reopen?`<div style="padding:12px;background:#f8fafc;border-radius:12px">Expected reopening: <b>${esc(m.reopen)}</b></div>`:''}<div style="margin-top:20px;color:#15803d;font-weight:900">● UPDATE IN PROGRESS</div></section></main>`;return true}
window.YTCMS={read,write,applyAdmin,applyWebsite,maintenanceGuard,defaults:DEFAULTS};
if(location.pathname.includes('/admin/')) await applyAdmin(); else {const stopped=await maintenanceGuard();if(!stopped)await applyWebsite();}
