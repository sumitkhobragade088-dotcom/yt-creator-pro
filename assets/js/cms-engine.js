import { supabase } from './supabase.js';
const ADMIN_EMAIL='sumitkhobragade088@gmail.com';
const DEFAULTS={
 admin_cms:{title:'Admin Dashboard',subtitle:'Live overview of users, channels, access, monetization, AdSense and service activity.',nav:{},hidden:[],custom:[]},
 admin_theme:{primary:'#ff0000',sidebar:'#101522',surface:'#ffffff',text:'#172033',radius:16},
 website_cms:{brand:'YT Creator Pro',heroTitle:'Build Your Channel. Grow With Confidence.',heroText:'Professional support for channel management, monetization and AdSense through secure Google-authorized access — without sharing your Gmail password.',nav:{},hidden:[],hiddenSections:[],customSections:[],customButtons:[]},
 website_theme:{primary:'#ff0000',surface:'#ffffff',text:'#172033',radius:16},
 maintenance:{enabled:false,title:'We’re upgrading YT Creator Pro',message:'A professional update is in progress. Please check back shortly.',reopen:''},
 seo:{title:'YT Creator Pro | YouTube Creator Support',description:'Professional YouTube creator support for channel management, monetization guidance, AdSense assistance and secure Google-authorized access.',keywords:'YT Creator Pro, YouTube creator support, channel management, monetization help, AdSense assistance'}
};
const cache={};
const clone=o=>JSON.parse(JSON.stringify(o));
async function read(key){
 try{const {data,error}=await supabase.from('yt_cms_settings').select('value').eq('key',key).maybeSingle(); if(!error&&data?.value){cache[key]=data.value;localStorage.setItem('ytcms_'+key,JSON.stringify(data.value));return data.value;}}catch(e){}
 try{const v=JSON.parse(localStorage.getItem('ytcms_'+key)||'null');if(v)return v;}catch(e){}
 return clone(DEFAULTS[key]||{});
}
async function write(key,value){
 const {data:{user}}=await supabase.auth.getUser();
 if(String(user?.email||'').toLowerCase()!==ADMIN_EMAIL) throw new Error('Admin authorization required');
 const {error}=await supabase.from('yt_cms_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'});
 if(error) throw error; cache[key]=value; localStorage.setItem('ytcms_'+key,JSON.stringify(value)); return value;
}
function cssVars(t){document.documentElement.style.setProperty('--cms-primary',t.primary||'#ff0000');document.documentElement.style.setProperty('--cms-surface',t.surface||'#fff');document.documentElement.style.setProperty('--cms-text',t.text||'#172033');document.documentElement.style.setProperty('--cms-radius',(Number(t.radius)||16)+'px');if(t.sidebar)document.documentElement.style.setProperty('--cms-sidebar',t.sidebar);}
async function applyAdmin(){
 const c=await read('admin_cms'),t=await read('admin_theme');cssVars(t);document.body?.classList.add('cms-admin-active');
 const h=document.querySelector('#view-dashboard .yt-premium-hero h2'),p=document.querySelector('#view-dashboard .yt-premium-hero p');if(h)h.textContent=c.title||DEFAULTS.admin_cms.title;if(p)p.textContent=c.subtitle||DEFAULTS.admin_cms.subtitle;
 const nav=document.querySelector('.yt-premium-nav');if(nav){[...nav.querySelectorAll('[data-view]')].forEach(b=>{const k=b.dataset.view;if(c.nav?.[k])b.querySelector('span').textContent=c.nav[k];b.hidden=(c.hidden||[]).includes(k)});(c.custom||[]).forEach(x=>{if(nav.querySelector(`[data-cms-custom="${x.id}"]`))return;const b=document.createElement('button');b.className='yt-premium-nav-btn';b.dataset.cmsCustom=x.id;b.innerHTML=`🧩 <span>${esc(x.label)}</span>`;const main=document.querySelector('.yt-premium-main');let sec=document.querySelector(`[data-cms-admin-page="${x.id}"]`);if(main&&!sec){sec=document.createElement('section');sec.className='yt-premium-view';sec.dataset.cmsAdminPage=x.id;sec.innerHTML=`<div class="yt-premium-section-head"><div><span>CUSTOM PAGE</span><h2>${esc(x.label)}</h2><p>${esc(x.content||'')}</p></div></div><div class="panel yt-premium-panel"><p>${esc(x.content||'')}</p></div>`;main.appendChild(sec)}b.onclick=()=>{document.querySelectorAll('.yt-premium-view').forEach(v=>v.classList.remove('active'));document.querySelectorAll('.yt-premium-nav-btn').forEach(v=>v.classList.remove('active'));sec?.classList.add('active');b.classList.add('active');const title=document.getElementById('adminPageTitle');if(title)title.textContent=x.label;sessionStorage.setItem('yt_admin_view','dashboard')};nav.appendChild(b);});}
 }
async function applyWebsite(){
 const c=await read('website_cms'),t=await read('website_theme'),s=await read('seo');cssVars(t);document.body?.classList.add('cms-site-active');
 if(location.pathname.endsWith('/')||location.pathname.endsWith('/index.html')){const brand=document.querySelector('.yt-user-public-brand b');if(brand)brand.textContent=c.brand||'YT Creator Pro';const h=document.querySelector('.yt-user-home-copy h1');if(h)h.textContent=c.heroTitle||DEFAULTS.website_cms.heroTitle;const p=document.querySelector('.yt-user-home-copy>p');if(p)p.textContent=c.heroText||DEFAULTS.website_cms.heroText;const nav=document.querySelector('.yt-user-public-nav');if(nav){[...nav.querySelectorAll('a')].forEach((a,i)=>{const k=a.getAttribute('href')||String(i);if(c.nav?.[k])a.textContent=c.nav[k];a.hidden=(c.hidden||[]).includes(k)});(c.customButtons||[]).forEach(x=>{if(nav.querySelector(`[data-cms-btn="${x.id}"]`))return;const a=document.createElement('a');a.dataset.cmsBtn=x.id;a.href=x.href||'#';a.textContent=x.label||'New';nav.appendChild(a)});}['services','monetization'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=(c.hiddenSections||[]).includes(id)});const main=document.querySelector('.yt-user-public-main');(c.customSections||[]).forEach(x=>{if(!main||main.querySelector(`[data-cms-section="${x.id}"]`))return;const s=document.createElement('section');s.className='yt-user-public-section';s.dataset.cmsSection=x.id;s.innerHTML=`<div class="yt-user-section-title"><span>CUSTOM</span><h2>${esc(x.title)}</h2><p>${esc(x.content)}</p></div>`;main.appendChild(s)});}
 if(s.title)document.title=s.title;setMeta('description',s.description);setMeta('keywords',s.keywords);
}
function setMeta(name,content){if(!content)return;let m=document.querySelector(`meta[name="${name}"]`);if(!m){m=document.createElement('meta');m.name=name;document.head.appendChild(m)}m.content=content}
function esc(v=''){return String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
async function maintenanceGuard(){if(location.pathname.includes('/admin/'))return;const m=await read('maintenance');if(!m.enabled)return;document.body.innerHTML=`<main class="cms-maint"><div class="cms-maint-card"><div class="cms-maint-icon">🛠️</div><div class="cms-maint-kicker">YT CREATOR PRO • SYSTEM UPDATE</div><h1>${esc(m.title)}</h1><p>${esc(m.message)}</p>${m.reopen?`<div class="cms-maint-time">Expected reopening: <b>${esc(m.reopen)}</b></div>`:''}<div class="cms-maint-pulse">● UPDATE IN PROGRESS</div></div></main>`;document.body.className='cms-maint-body'}
window.YTCMS={read,write,applyAdmin,applyWebsite,maintenanceGuard,defaults:DEFAULTS};
if(location.pathname.includes('/admin/')) applyAdmin(); else {await maintenanceGuard();await applyWebsite();}
