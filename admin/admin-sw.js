const CACHE='yt-admin-v13-control-suite';
const ASSETS=['./','index.html','login.html','manifest.webmanifest','../assets/css/style.css','../assets/js/admin-auth.js','../assets/js/supabase.js','../assets/js/cms-engine.js','../assets/js/cms-admin-ui.js','../assets/css/cms-control.css','../assets/css/cms-professional.css','../assets/js/cms-professional.js','../assets/js/admin-public-notifications.js','../assets/js/cms-deep-admin.js','../assets/js/cms-deep.js','../assets/js/cms-deep-catalog.js','../assets/js/cms-youtube-api-catalog.js','../assets/js/youtube-api-tools.js','../assets/css/youtube-api-tools.css','../assets/js/admin-control-suite.js'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('yt-admin-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
