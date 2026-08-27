const CACHE='yt-admin-v1';
const ASSETS=['./','index.html','login.html','manifest.webmanifest','../assets/css/style.css','../assets/js/admin-auth.js','../assets/js/supabase.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{})));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
