
(function(){
"use strict";
const LANGS={en:"English",hi:"हिन्दी",mr:"मराठी"};
const DICT={
hi:{
"Dashboard":"डैशबोर्ड","Services":"सेवाएँ","My Requests":"मेरे अनुरोध","Payments":"भुगतान","YouTube Channel":"यूट्यूब चैनल","Channel Access":"चैनल एक्सेस","Monetization":"मॉनेटाइजेशन","AdSense":"ऐडसेंस","My Profile":"मेरी प्रोफ़ाइल","Logout":"लॉगआउट","USER PORTAL":"यूज़र पोर्टल","USER DASHBOARD":"यूज़र डैशबोर्ड","Search Services":"सेवाएँ खोजें","FIND A SERVICE":"सेवा खोजें","Selected Service":"चुनी हुई सेवा","Submit Request":"अनुरोध भेजें","Install App":"ऐप इंस्टॉल करें","Home":"होम","Login":"लॉगिन","Register":"रजिस्टर","Service Required":"आवश्यक सेवा","Create Account & Submit":"अकाउंट बनाएँ और सबमिट करें","Email ID":"ईमेल आईडी","Password":"पासवर्ड","Website":"वेबसाइट","Refresh":"रिफ्रेश","Settings":"सेटिंग्स","Service Charge":"सेवा शुल्क","History":"इतिहास","Users / Customers":"यूज़र / ग्राहक","User Requests":"यूज़र अनुरोध","YouTube Channels":"यूट्यूब चैनल","Access Requests":"एक्सेस अनुरोध","Payments / PayU":"भुगतान / PayU","Admin Dashboard CMS":"एडमिन डैशबोर्ड CMS","Website CMS":"वेबसाइट CMS","Admin Editor":"एडमिन एडिटर","Total Services":"कुल सेवाएँ","Active Services":"सक्रिय सेवाएँ","Inactive Services":"निष्क्रिय सेवाएँ","All Services & Current Charge":"सभी सेवाएँ और वर्तमान शुल्क","New Service":"नई सेवा","Add New Service":"नई सेवा जोड़ें","Service":"सेवा","Description":"विवरण","Current Charge":"वर्तमान शुल्क","New Charge":"नया शुल्क","Status":"स्थिति","Action":"कार्रवाई","Active":"सक्रिय","Inactive":"निष्क्रिय","Edit":"संपादित करें","Delete":"हटाएँ","Update":"अपडेट","Dark Mode":"डार्क मोड","Language":"भाषा","Appearance & Language":"दिखावट और भाषा","Save":"सेव करें","Cancel":"रद्द करें","Channel Management":"चैनल मैनेजमेंट","Monetization Help":"मॉनेटाइजेशन सहायता","AdSense Assistance":"ऐडसेंस सहायता","YouTube Reporting Setup":"यूट्यूब रिपोर्टिंग सेटअप","YouTube Live Streaming Setup":"यूट्यूब लाइव स्ट्रीमिंग सेटअप","YouTube Live Chat Setup / Moderation":"यूट्यूब लाइव चैट सेटअप / मॉडरेशन","YouTube Embedded Player Setup":"यूट्यूब एम्बेडेड प्लेयर सेटअप","YouTube oEmbed Setup":"यूट्यूब oEmbed सेटअप"},
mr:{
"Dashboard":"डॅशबोर्ड","Services":"सेवा","My Requests":"माझ्या विनंत्या","Payments":"पेमेंट्स","YouTube Channel":"यूट्यूब चॅनेल","Channel Access":"चॅनेल प्रवेश","Monetization":"मॉनेटायझेशन","AdSense":"अॅडसेन्स","My Profile":"माझे प्रोफाइल","Logout":"लॉगआउट","USER PORTAL":"वापरकर्ता पोर्टल","USER DASHBOARD":"वापरकर्ता डॅशबोर्ड","Search Services":"सेवा शोधा","FIND A SERVICE":"सेवा शोधा","Selected Service":"निवडलेली सेवा","Submit Request":"विनंती पाठवा","Install App":"अॅप इंस्टॉल करा","Home":"होम","Login":"लॉगिन","Register":"नोंदणी","Service Required":"आवश्यक सेवा","Create Account & Submit":"खाते तयार करा आणि सबमिट करा","Email ID":"ईमेल आयडी","Password":"पासवर्ड","Website":"वेबसाइट","Refresh":"रिफ्रेश","Settings":"सेटिंग्ज","Service Charge":"सेवा शुल्क","History":"इतिहास","Users / Customers":"वापरकर्ते / ग्राहक","User Requests":"वापरकर्ता विनंत्या","YouTube Channels":"यूट्यूब चॅनेल","Access Requests":"प्रवेश विनंत्या","Payments / PayU":"पेमेंट्स / PayU","Admin Dashboard CMS":"अॅडमिन डॅशबोर्ड CMS","Website CMS":"वेबसाइट CMS","Admin Editor":"अॅडमिन एडिटर","Total Services":"एकूण सेवा","Active Services":"सक्रिय सेवा","Inactive Services":"निष्क्रिय सेवा","All Services & Current Charge":"सर्व सेवा आणि सध्याचे शुल्क","New Service":"नवीन सेवा","Add New Service":"नवीन सेवा जोडा","Service":"सेवा","Description":"वर्णन","Current Charge":"सध्याचे शुल्क","New Charge":"नवीन शुल्क","Status":"स्थिती","Action":"कृती","Active":"सक्रिय","Inactive":"निष्क्रिय","Edit":"संपादित करा","Delete":"हटवा","Update":"अपडेट","Dark Mode":"डार्क मोड","Language":"भाषा","Appearance & Language":"दिसणे आणि भाषा","Save":"जतन करा","Cancel":"रद्द करा","Channel Management":"चॅनेल व्यवस्थापन","Monetization Help":"मॉनेटायझेशन सहाय्य","AdSense Assistance":"अॅडसेन्स सहाय्य","YouTube Reporting Setup":"यूट्यूब रिपोर्टिंग सेटअप","YouTube Live Streaming Setup":"यूट्यूब लाईव्ह स्ट्रीमिंग सेटअप","YouTube Live Chat Setup / Moderation":"यूट्यूब लाईव्ह चॅट सेटअप / मॉडरेशन","YouTube Embedded Player Setup":"यूट्यूब एम्बेडेड प्लेयर सेटअप","YouTube oEmbed Setup":"यूट्यूब oEmbed सेटअप"}
}};
const key="yt_creator_language",themeKey="yt_creator_theme";
const clean=s=>(s||"").replace(/\s+/g," ").trim();
function translateString(s,lang){
 if(lang==="en")return s;
 const d=DICT[lang]||{};
 if(d[s])return d[s];
 let out=s;
 Object.keys(d).sort((a,b)=>b.length-a.length).forEach(k=>{
   const esc=k.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
   out=out.replace(new RegExp(`(^|\\s|[•:|/])(${esc})(?=$|\\s|[•:|/])`,"g"),(m,p)=>p+d[k]);
 });
 return out;
}
function rememberOriginal(el,attr,val){const k="i18n"+attr.replace(/[^a-z]/gi,"");if(!el.dataset[k])el.dataset[k]=val;return el.dataset[k];}
function applyLanguage(lang){
 if(!LANGS[lang])lang="en"; localStorage.setItem(key,lang); document.documentElement.lang=lang;
 document.querySelectorAll("option").forEach(el=>{const o=rememberOriginal(el,"option",clean(el.textContent)); el.textContent=translateString(o,lang);});
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode(n){
   if(!clean(n.nodeValue)||["SCRIPT","STYLE","TEXTAREA"].includes(n.parentElement?.tagName))return NodeFilter.FILTER_REJECT;
   return NodeFilter.FILTER_ACCEPT;}});
 let n; const nodes=[]; while(n=walker.nextNode())nodes.push(n);
 nodes.forEach(node=>{const p=node.parentElement;if(!p)return;const o=rememberOriginal(p,"text"+Array.prototype.indexOf.call(p.childNodes,node),node.nodeValue);node.nodeValue=translateString(o,lang);});
 document.querySelectorAll("[placeholder]").forEach(el=>{const o=rememberOriginal(el,"placeholder",el.getAttribute("placeholder"));el.setAttribute("placeholder",translateString(o,lang));});
 document.querySelectorAll(".yt-lang-select").forEach(s=>s.value=lang);
 window.dispatchEvent(new CustomEvent("yt-language-changed",{detail:{language:lang}}));
}
function applyTheme(theme){theme=theme==="dark"?"dark":"light";localStorage.setItem(themeKey,theme);document.documentElement.dataset.ytTheme=theme;document.body?.classList.toggle("yt-dark-mode",theme==="dark");document.querySelectorAll(".yt-theme-toggle").forEach(b=>{b.setAttribute("aria-pressed",theme==="dark");b.querySelector(".yt-theme-label")&&(b.querySelector(".yt-theme-label").textContent=theme==="dark"?"Light Mode":"Dark Mode");});}
function controls(){
 document.querySelectorAll("[data-yt-i18n-controls]").forEach(host=>{if(host.dataset.ready)return;host.dataset.ready="1";host.innerHTML=`<button type="button" class="yt-theme-toggle" title="Dark/Light Mode"><span>◐</span><span class="yt-theme-label">Dark Mode</span></button><label class="yt-lang-control" title="Language"><span>🌐</span><select class="yt-lang-select" aria-label="Language"><option value="en">English</option><option value="hi">हिन्दी</option><option value="mr">मराठी</option></select></label>`;});
 document.querySelectorAll(".yt-theme-toggle").forEach(b=>b.onclick=()=>applyTheme(document.documentElement.dataset.ytTheme==="dark"?"light":"dark"));
 document.querySelectorAll(".yt-lang-select").forEach(s=>s.onchange=()=>applyLanguage(s.value));
}
function init(){controls();applyTheme(localStorage.getItem(themeKey)||"light");applyLanguage(localStorage.getItem(key)||"en");}
new MutationObserver(()=>{clearTimeout(window.__ytI18nTimer);window.__ytI18nTimer=setTimeout(()=>{controls();applyLanguage(localStorage.getItem(key)||"en");},60)}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",init); if(document.readyState!=="loading")init();
window.YTCreatorPreferences={setLanguage:applyLanguage,setTheme:applyTheme,getLanguage:()=>localStorage.getItem(key)||"en",getTheme:()=>localStorage.getItem(themeKey)||"light"};
})();
