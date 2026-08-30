const CACHE='yt-user-app-v9-cms-deep';
const CORE=['./','index.html','login.html','register.html','dashboard.html','page.html','assets/css/style.css','assets/css/cms-control.css','assets/js/auth.js','assets/js/cms-engine.js','assets/js/cms-deep-catalog.js','assets/js/cms-deep.js','manifest.webmanifest'];

self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).catch(()=>{}));
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k.startsWith('yt-user-app-')&&k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));
});
