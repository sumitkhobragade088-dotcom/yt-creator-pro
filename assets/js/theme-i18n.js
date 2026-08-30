(function(){
"use strict";
const LANG_KEY="yt_creator_language", THEME_KEY="yt_creator_theme";
const LANGS=["en","hi","mr"];
const T={
hi:{
"Dashboard":"डैशबोर्ड","Services":"सेवाएँ","My Requests":"मेरे अनुरोध","Payments":"भुगतान","YouTube Channel":"यूट्यूब चैनल","Channel Access":"चैनल एक्सेस","Monetization":"मॉनेटाइजेशन","AdSense":"ऐडसेंस","My Profile":"मेरी प्रोफ़ाइल","Logout":"लॉगआउट","USER PORTAL":"यूज़र पोर्टल","USER DASHBOARD":"यूज़र डैशबोर्ड","Search Services":"सेवाएँ खोजें","FIND A SERVICE":"सेवा खोजें","Install App":"ऐप इंस्टॉल करें","Website":"वेबसाइट","Refresh":"रिफ्रेश","Settings":"सेटिंग्स","Service Charge":"सेवा शुल्क","History":"इतिहास","Users / Customers":"यूज़र / ग्राहक","User Requests":"यूज़र अनुरोध","YouTube Channels":"यूट्यूब चैनल","Access Requests":"एक्सेस अनुरोध","Payments / PayU":"भुगतान / PayU","Admin Dashboard CMS":"एडमिन डैशबोर्ड CMS","Website CMS":"वेबसाइट CMS","Admin Editor":"एडमिन एडिटर","Total Services":"कुल सेवाएँ","Active Services":"सक्रिय सेवाएँ","Inactive Services":"निष्क्रिय सेवाएँ","All Services & Current Charge":"सभी सेवाएँ और वर्तमान शुल्क","New Service":"नई सेवा","Add New Service":"नई सेवा जोड़ें","Service":"सेवा","Description":"विवरण","Current Charge":"वर्तमान शुल्क","New Charge":"नया शुल्क","Status":"स्थिति","Action":"कार्रवाई","Active":"सक्रिय","Inactive":"निष्क्रिय","Edit":"संपादित करें","Delete":"हटाएँ","Update":"अपडेट","Dark":"डार्क","Light":"लाइट"},
mr:{
"Dashboard":"डॅशबोर्ड","Services":"सेवा","My Requests":"माझ्या विनंत्या","Payments":"पेमेंट्स","YouTube Channel":"यूट्यूब चॅनेल","Channel Access":"चॅनेल प्रवेश","Monetization":"मॉनेटायझेशन","AdSense":"अॅडसेन्स","My Profile":"माझे प्रोफाइल","Logout":"लॉगआउट","USER PORTAL":"वापरकर्ता पोर्टल","USER DASHBOARD":"वापरकर्ता डॅशबोर्ड","Search Services":"सेवा शोधा","FIND A SERVICE":"सेवा शोधा","Install App":"अॅप इंस्टॉल करा","Website":"वेबसाइट","Refresh":"रिफ्रेश","Settings":"सेटिंग्ज","Service Charge":"सेवा शुल्क","History":"इतिहास","Users / Customers":"वापरकर्ते / ग्राहक","User Requests":"वापरकर्ता विनंत्या","YouTube Channels":"यूट्यूब चॅनेल","Access Requests":"प्रवेश विनंत्या","Payments / PayU":"पेमेंट्स / PayU","Admin Dashboard CMS":"अॅडमिन डॅशबोर्ड CMS","Website CMS":"वेबसाइट CMS","Admin Editor":"अॅडमिन एडिटर","Total Services":"एकूण सेवा","Active Services":"सक्रिय सेवा","Inactive Services":"निष्क्रिय सेवा","All Services & Current Charge":"सर्व सेवा आणि सध्याचे शुल्क","New Service":"नवीन सेवा","Add New Service":"नवीन सेवा जोडा","Service":"सेवा","Description":"वर्णन","Current Charge":"सध्याचे शुल्क","New Charge":"नवीन शुल्क","Status":"स्थिती","Action":"कृती","Active":"सक्रिय","Inactive":"निष्क्रिय","Edit":"संपादित करा","Delete":"हटवा","Update":"अपडेट","Dark":"डार्क","Light":"लाईट"}
};
const originals=new WeakMap();
function clean(s){return String(s||"").replace(/\s+/g," ").trim();}
function tr(s,lang){if(lang==="en")return s; return (T[lang]&&T[lang][s])||s;}
function applyTheme(theme){
 theme=theme==="dark"?"dark":"light";
 localStorage.setItem(THEME_KEY,theme);
 document.documentElement.setAttribute("data-yt-theme",theme);
 document.querySelectorAll(".yt-theme-toggle").forEach(b=>{
   const text=b.querySelector(".yt-theme-text"), icon=b.querySelector(".yt-theme-icon");
   if(text)text.textContent=theme==="dark"?"Light":"Dark";
   if(icon)icon.textContent=theme==="dark"?"☀️":"🌙";
   b.setAttribute("aria-pressed",String(theme==="dark"));
 });
}
function applyLanguage(lang){
 if(!LANGS.includes(lang))lang="en";
 localStorage.setItem(LANG_KEY,lang); document.documentElement.lang=lang;
 document.querySelectorAll(".yt-lang-select").forEach(s=>s.value=lang);
 const root=document.body;if(!root)return;
 const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(n){
   const p=n.parentElement;
   if(!p||p.closest("[data-no-translate]")||["SCRIPT","STYLE","TEXTAREA"].includes(p.tagName)||!clean(n.nodeValue))return NodeFilter.FILTER_REJECT;
   return NodeFilter.FILTER_ACCEPT;
 }});
 const nodes=[];let n;while((n=w.nextNode()))nodes.push(n);
 nodes.forEach(node=>{
   if(!originals.has(node))originals.set(node,node.nodeValue);
   const raw=originals.get(node), key=clean(raw);
   if(T.hi[key]||T.mr[key])node.nodeValue=raw.replace(key,tr(key,lang));
 });
}
function bind(){
 document.querySelectorAll(".yt-theme-toggle").forEach(b=>{if(b.dataset.ytBound)return;b.dataset.ytBound="1";b.addEventListener("click",()=>applyTheme(document.documentElement.getAttribute("data-yt-theme")==="dark"?"light":"dark"));});
 document.querySelectorAll(".yt-lang-select").forEach(s=>{if(s.dataset.ytBound)return;s.dataset.ytBound="1";s.addEventListener("change",()=>applyLanguage(s.value));});
 document.querySelectorAll("[data-save-prefs]").forEach(btn=>{if(btn.dataset.ytBound)return;btn.dataset.ytBound="1";btn.addEventListener("click",()=>{
   const box=btn.closest(".yt-cms-pref-box"),lang=box.querySelector('[data-pref="language"]').value,theme=box.querySelector('[data-pref="theme"]').value;
   applyLanguage(lang);applyTheme(theme);
   document.querySelectorAll('[data-pref="language"]').forEach(x=>x.value=lang);
   document.querySelectorAll('[data-pref="theme"]').forEach(x=>x.value=theme);
   const msg=box.querySelector(".yt-cms-pref-msg");if(msg){msg.textContent=" Saved ✓";setTimeout(()=>msg.textContent="",1800);}
 });});
}
function syncCms(){
 const lang=localStorage.getItem(LANG_KEY)||"en",theme=localStorage.getItem(THEME_KEY)||"light";
 document.querySelectorAll('[data-pref="language"]').forEach(x=>x.value=lang);
 document.querySelectorAll('[data-pref="theme"]').forEach(x=>x.value=theme);
}
function init(){bind();syncCms();applyTheme(localStorage.getItem(THEME_KEY)||"light");applyLanguage(localStorage.getItem(LANG_KEY)||"en");}
document.addEventListener("DOMContentLoaded",init);if(document.readyState!=="loading")init();
const mo=new MutationObserver(()=>{bind();applyLanguage(localStorage.getItem(LANG_KEY)||"en");});
document.addEventListener("DOMContentLoaded",()=>mo.observe(document.body,{childList:true,subtree:true}));
})();