import { supabase } from "./supabase.js";

const STORAGE="yt_admin_editor_state_v2";
const DEFAULTS={navigation:[],dashboard:[],sections:[],tables:{},roles:[],text:{}};
const EXCLUDED_VIEWS=new Set(["editor","cms","website-cms"]);
const safe=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const $=id=>document.getElementById(id);
let state=loadLocal();
let previewState=null;

function clone(v){return JSON.parse(JSON.stringify(v));}
function loadLocal(){try{return {...clone(DEFAULTS),...JSON.parse(localStorage.getItem(STORAGE)||"{}")};}catch{return clone(DEFAULTS);}}
function saveLocal(){localStorage.setItem(STORAGE,JSON.stringify(state));}
function setStatus(msg,ok=false){const el=$("adminEditorStatus");if(el){el.textContent=msg;el.dataset.ok=ok?"1":"0";}}
function defaultLabel(el){return (el?.textContent||"").trim();}
function viewLabel(view){return view.querySelector(".yt-premium-section-head h2")?.textContent?.trim()||view.id.replace(/^view-/,'');}

function discover(){
  const nav=[...document.querySelectorAll("#ytPremiumSidebar .yt-premium-nav-btn")]
    .filter(b=>!EXCLUDED_VIEWS.has(b.dataset.view||"") && !b.dataset.view?.startsWith("cms"))
    .map((b,i)=>({key:b.dataset.view||`nav-${i}`,label:b.querySelector("span")?.textContent?.trim()||defaultLabel(b),visible:true,order:i,role:b.dataset.roleControl||null}));
  const cards=[...document.querySelectorAll("#view-dashboard .yt-premium-stat-card")].map((c,i)=>({key:c.querySelector("[id]")?.id||`card-${i}`,label:c.querySelector(".stat-label")?.textContent?.trim()||`Card ${i+1}`,visible:true,order:i}));
  const sections=[...document.querySelectorAll(".yt-premium-view")].filter(v=>!EXCLUDED_VIEWS.has(v.id.replace("view-",""))).map((v,i)=>({key:v.id.replace("view-",""),label:viewLabel(v),visible:true,order:i}));
  const tables={};
  document.querySelectorAll(".data-table").forEach((t,i)=>{
    const view=t.closest(".yt-premium-view")?.id?.replace("view-","")||`table-${i}`;
    const key=view+`#${i}`;
    t.dataset.editorTableKey=key;
    tables[key]=[...t.querySelectorAll("thead th")].map((th,j)=>({key:String(j),label:th.textContent.trim()||`Column ${j+1}`,visible:true}));
  });
  const roles=[...document.querySelectorAll("#ytPremiumSidebar [data-role-control]")].map((b,i)=>({key:b.dataset.roleControl,label:b.querySelector("span")?.textContent?.trim()||defaultLabel(b),visible:true,order:i}));
  const text={};
  document.querySelectorAll(".yt-premium-view:not(#view-editor):not(#view-cms):not(#view-website-cms) .yt-premium-section-head h2").forEach((el,i)=>{text[`heading:${el.closest(".yt-premium-view")?.id||i}`]=defaultLabel(el);});
  document.querySelectorAll(".yt-premium-view:not(#view-editor):not(#view-cms):not(#view-website-cms) .yt-premium-section-head p").forEach((el,i)=>{text[`desc:${el.closest(".yt-premium-view")?.id||i}`]=defaultLabel(el);});
  const buttons={};
  document.querySelectorAll(".yt-premium-view:not(#view-editor):not(#view-cms):not(#view-website-cms) button[id]").forEach((b,i)=>{if(i<80)buttons[b.id]=defaultLabel(b);});
  text.__buttons=buttons;
  return {nav,cards,sections,tables,roles,text};
}

function ensureDefaults(){
  const d=discover();
  if(!state.navigation?.length) state.navigation=d.nav;
  if(!state.dashboard?.length) state.dashboard=d.cards;
  if(!state.sections?.length) state.sections=d.sections;
  if(!state.roles?.length) state.roles=d.roles;
  if(!state.tables || !Object.keys(state.tables).length) state.tables=d.tables;
  if(!state.text || !Object.keys(state.text).length) state.text=d.text;
  // Merge newly discovered items without overwriting saved values.
  for(const group of ["navigation","dashboard","sections","roles"]){const map=new Map((state[group]||[]).map(x=>[x.key,x]));for(const x of d[group])if(!map.has(x.key))map.set(x.key,x);state[group]=[...map.values()];}
  for(const [k,cols] of Object.entries(d.tables)){if(!state.tables[k])state.tables[k]=cols;else{const m=new Map(state.tables[k].map(x=>[x.key,x]));for(const c of cols)if(!m.has(c.key))m.set(c.key,c);state.tables[k]=[...m.values()];}}
  state.text=Object.assign({},d.text,state.text||{});
  if(!state.text.__buttons)state.text.__buttons=d.text.__buttons||{}; else state.text.__buttons=Object.assign({},d.text.__buttons,state.text.__buttons);
}

function current(){return previewState||state;}
function normalizeOrder(arr){arr.forEach((x,i)=>x.order=i);return arr;}

function renderNav(){
 const root=$("editorNavigationList");if(!root)return; const items=[...current().navigation].sort((a,b)=>a.order-b.order); root.innerHTML=items.map((x,i)=>`<div class="yt-editor-row" data-key="${safe(x.key)}"><div class="yt-editor-drag">☷</div><div><div class="yt-editor-title">${safe(x.label)}</div><div class="yt-editor-meta">Route: ${safe(x.key)}</div></div><input class="yt-editor-input" data-field="label" value="${safe(x.label)}" aria-label="Navigation label"><label class="yt-editor-check"><input type="checkbox" data-field="visible" ${x.visible!==false?'checked':''}> Show</label><div class="yt-editor-actions"><button class="yt-editor-move" data-move="up" ${i?'':'disabled'}>↑</button><button class="yt-editor-move" data-move="down" ${i<items.length-1?'':'disabled'}>↓</button></div></div>`).join("");bindList(root,current().navigation);}
function renderCards(){const root=$("editorDashboardList");if(!root)return;const items=[...current().dashboard].sort((a,b)=>a.order-b.order);root.innerHTML=items.map((x,i)=>`<div class="yt-editor-row" data-key="${safe(x.key)}"><div class="yt-editor-drag">☷</div><div><div class="yt-editor-title">${safe(x.label)}</div><div class="yt-editor-meta">Card ID: ${safe(x.key)}</div></div><input class="yt-editor-input" data-field="label" value="${safe(x.label)}"><label class="yt-editor-check"><input type="checkbox" data-field="visible" ${x.visible!==false?'checked':''}> Show</label><div class="yt-editor-actions"><button class="yt-editor-move" data-move="up" ${i?'':'disabled'}>↑</button><button class="yt-editor-move" data-move="down" ${i<items.length-1?'':'disabled'}>↓</button></div></div>`).join("");bindList(root,current().dashboard);}
function renderSections(){const root=$("editorSectionList");if(!root)return;const items=[...current().sections].sort((a,b)=>a.order-b.order);root.innerHTML=items.map(x=>`<div class="yt-editor-row" data-key="${safe(x.key)}"><div class="yt-editor-badge">VIEW</div><div><div class="yt-editor-title">${safe(x.label)}</div><div class="yt-editor-meta">view-${safe(x.key)}</div></div><span class="yt-editor-meta">Existing section</span><label class="yt-editor-check"><input type="checkbox" data-field="visible" ${x.visible!==false?'checked':''}> Show</label></div>`).join("");bindList(root,current().sections);}
function renderTables(){const root=$("editorTableList");if(!root)return;let html="";for(const [key,cols] of Object.entries(current().tables)){html+=`<div class="yt-editor-field"><label>${safe(key.split('#')[0])}</label>${cols.map(c=>`<label class="yt-editor-check"><input type="checkbox" data-table="${safe(key)}" data-col="${safe(c.key)}" ${c.visible!==false?'checked':''}> ${safe(c.label)}</label>`).join("")}</div>`;}root.innerHTML=html||'<div class="yt-editor-empty">No editable tables found.</div>';root.querySelectorAll("input[data-table]").forEach(el=>el.addEventListener("change",()=>{const cols=current().tables[el.dataset.table];const c=cols?.find(x=>x.key===el.dataset.col);if(c)c.visible=el.checked;markPreview();}));}
function renderRoles(){const root=$("editorRoleList");if(!root)return;root.innerHTML=current().roles.map(x=>`<div class="yt-editor-row" data-key="${safe(x.key)}"><div class="yt-editor-badge">ROLE</div><div><div class="yt-editor-title">${safe(x.label)}</div><div class="yt-editor-meta">${safe(x.key)}</div></div><span class="yt-editor-warning">Visibility only — permissions stay protected.</span><label class="yt-editor-check"><input type="checkbox" data-field="visible" ${x.visible!==false?'checked':''}> Show</label></div>`).join("");bindList(root,current().roles);}
function renderText(){const root=$("editorTextList");if(!root)return;let html="<div class='yt-editor-field-grid'>";for(const [k,v] of Object.entries(current().text||{})){if(k==='__buttons')continue;html+=`<div class="yt-editor-field"><label>${safe(k.startsWith('heading:')?'Section Heading':'Section Description')}</label><input class="yt-editor-input" data-text-key="${safe(k)}" value="${safe(v)}"><small>${safe(k)}</small></div>`;}html+='</div><div class="yt-editor-field" style="margin-top:10px"><label>Existing Admin Buttons</label><div class="yt-editor-field-grid">';for(const [k,v] of Object.entries(current().text?.__buttons||{})){html+=`<div><label>${safe(k)}</label><input class="yt-editor-input" data-button-key="${safe(k)}" value="${safe(v)}"></div>`;}html+='</div><small>Only button text is changed; click handlers, IDs and actions remain untouched.</small></div>';root.innerHTML=html;root.querySelectorAll("[data-text-key]").forEach(el=>el.addEventListener("input",()=>{current().text[el.dataset.textKey]=el.value;markPreview();}));root.querySelectorAll("[data-button-key]").forEach(el=>el.addEventListener("input",()=>{current().text.__buttons[el.dataset.buttonKey]=el.value;markPreview();}));}
function renderHistory(rows=[]){const root=$("editorHistoryList");if(!root)return;root.innerHTML=rows.length?rows.map(r=>`<div class="yt-editor-history-item"><b>${safe(r.action||'Saved')}</b><small>${safe(r.created_at?new Date(r.created_at).toLocaleString('en-IN'): '—')}</small><div class="yt-editor-meta">${safe(r.summary||'Admin Editor configuration updated.')}</div></div>`).join(""):'<div class="yt-editor-empty">No saved editor changes yet.</div>';}

function bindList(root,arr){root.querySelectorAll(".yt-editor-row").forEach(row=>{const key=row.dataset.key;const item=arr.find(x=>x.key===key);if(!item)return;row.querySelector('[data-field="label"]')?.addEventListener("input",e=>{item.label=e.target.value;markPreview();});row.querySelector('[data-field="visible"]')?.addEventListener("change",e=>{item.visible=e.target.checked;markPreview();});row.querySelector('[data-move="up"]')?.addEventListener("click",()=>moveItem(arr,key,-1));row.querySelector('[data-move="down"]')?.addEventListener("click",()=>moveItem(arr,key,1));});}
function moveItem(arr,key,delta){const ordered=[...arr].sort((a,b)=>a.order-b.order),i=ordered.findIndex(x=>x.key===key),j=i+delta;if(i<0||j<0||j>=ordered.length)return;[ordered[i],ordered[j]]=[ordered[j],ordered[i]];normalizeOrder(ordered);arr.splice(0,arr.length,...ordered);renderAll();markPreview();}
function markPreview(){apply(current());setStatus("Preview updated — Save Changes to make it global.");}

function apply(cfg){
 const nav=[...document.querySelectorAll("#ytPremiumSidebar .yt-premium-nav-btn")];const nmap=new Map((cfg.navigation||[]).map(x=>[x.key,x]));
 const parent=nav[0]?.parentElement; if(parent){[...nav].filter(b=>{const k=b.dataset.view||b.dataset.roleControl;return k&&nmap.has(k)}).sort((a,b)=>(nmap.get(a.dataset.view||a.dataset.roleControl)?.order||0)-(nmap.get(b.dataset.view||b.dataset.roleControl)?.order||0)).forEach(b=>parent.appendChild(b));}
 nav.forEach(b=>{const k=b.dataset.view||b.dataset.roleControl,x=nmap.get(k);if(!x)return;b.querySelector("span")?.replaceChildren(document.createTextNode(x.label));b.hidden=x.visible===false;});
 const roleMap=new Map((cfg.roles||[]).map(x=>[x.key,x]));document.querySelectorAll("#ytPremiumSidebar [data-role-control]").forEach(b=>{const x=roleMap.get(b.dataset.roleControl);if(x)b.hidden=x.visible===false;});
 const cards=[...document.querySelectorAll("#view-dashboard .yt-premium-stat-card")];const cmap=new Map((cfg.dashboard||[]).map(x=>[x.key,x]));const grid=cards[0]?.parentElement;if(grid){cards.filter(c=>cmap.has(c.querySelector("[id]")?.id)).sort((a,b)=>(cmap.get(a.querySelector("[id]")?.id)?.order||0)-(cmap.get(b.querySelector("[id]")?.id)?.order||0)).forEach(c=>grid.appendChild(c));}cards.forEach(c=>{const k=c.querySelector("[id]")?.id,x=cmap.get(k);if(x){c.querySelector(".stat-label")?.replaceChildren(document.createTextNode(x.label));c.hidden=x.visible===false;}});
 const smap=new Map((cfg.sections||[]).map(x=>[x.key,x]));document.querySelectorAll(".yt-premium-view").forEach(v=>{const k=v.id.replace(/^view-/,'');const x=smap.get(k);if(x)v.hidden=x.visible===false;});
 const tableCss=[];for(const [key,cols] of Object.entries(cfg.tables||{})){const [view,idx]=key.split('#');const table=document.querySelector(`#view-${CSS.escape(view)} .data-table:nth-of-type(${Number(idx)+1})`);if(!table)continue;table.dataset.editorTableKey=key;cols.forEach(c=>{if(c.visible===false){const n=Number(c.key)+1;tableCss.push(`#${CSS.escape(table.closest('.yt-premium-view')?.id||'')} table.data-table[data-editor-table-key="${CSS.escape(key)}"] tr > :nth-child(${n}){display:none!important}`);}});}
 let style=document.getElementById("adminEditorDynamicStyle");if(!style){style=document.createElement("style");style.id="adminEditorDynamicStyle";document.head.appendChild(style);}style.textContent=tableCss.join("\n");
 for(const [k,v] of Object.entries(cfg.text||{})){if(k==='__buttons')continue;const [type,id]=k.split(':');const el=document.querySelector(`#${CSS.escape(id)} .yt-premium-section-head ${type==='heading'?'h2':'p'}`);if(el&&v)el.textContent=v;}
 for(const [id,v] of Object.entries(cfg.text?.__buttons||{})){const el=document.getElementById(id);if(el&&v)el.textContent=v;}
}

async function saveGlobal(){
 normalizeOrder(state.navigation);normalizeOrder(state.dashboard);normalizeOrder(state.sections);normalizeOrder(state.roles);saveLocal();apply(state);setStatus("Saving globally…");
 let remote=false;
 try{const {data:session}=await supabase.auth.getSession();if(!session?.session?.user)throw new Error("No admin session");const {error}=await supabase.from("admin_editor_settings").upsert({id:1,settings:state,updated_by:session.session.user.id,updated_at:new Date().toISOString()},{onConflict:"id"});if(error)throw error;await supabase.from("admin_editor_history").insert({admin_id:session.session.user.id,action:"save",summary:"Admin Editor configuration saved globally."});remote=true;}catch(e){console.warn("Admin Editor global save fallback:",e);}
 if(remote)setStatus("Global settings saved successfully ✅",true);else setStatus("Saved locally. Run ADMIN-EDITOR-SETUP.sql in Supabase for global saving.");
 await loadHistory();
}
async function loadGlobal(){try{const {data,error}=await supabase.from("admin_editor_settings").select("settings").eq("id",1).maybeSingle();if(!error&&data?.settings){state={...clone(DEFAULTS),...data.settings};saveLocal();return true;}}catch(e){console.warn(e);}return false;}
async function resetAll(){if(!confirm("Reset Admin Editor to defaults? This only resets Editor settings."))return;state=clone(DEFAULTS);ensureDefaults();saveLocal();apply(state);await saveGlobal();setStatus("Admin Editor reset to defaults ✅",true);renderAll();}
async function loadHistory(){try{const {data,error}=await supabase.from("admin_editor_history").select("action,summary,created_at").order("created_at",{ascending:false}).limit(30);if(!error)renderHistory(data||[]);else renderHistory([]);}catch{renderHistory([]);}}
function renderAll(){renderNav();renderCards();renderSections();renderTables();renderRoles();renderText();}

function init(){
 ensureDefaults();saveLocal();
 document.querySelectorAll("[data-editor-tab]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-editor-tab]").forEach(x=>x.classList.toggle("active",x===btn));document.querySelectorAll("[data-editor-panel]").forEach(x=>x.classList.toggle("active",x.dataset.editorPanel===btn.dataset.editorTab));if(btn.dataset.editorTab==='history')loadHistory();}));
 $("adminEditorPreview")?.addEventListener("click",()=>{previewState=clone(state);apply(previewState);setStatus("Preview active — not saved globally.");});
 $("adminEditorSave")?.addEventListener("click",()=>{previewState=null;saveGlobal();});
 $("adminEditorReset")?.addEventListener("click",resetAll);
 $("adminEditorRefreshHistory")?.addEventListener("click",loadHistory);
 renderAll();
 loadGlobal().then(ok=>{ensureDefaults();renderAll();apply(state);setStatus(ok?"Global settings loaded. Ready.":"Ready — changes are preview-only until Save Changes.");loadHistory();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
