const CACHE='yt-user-app-v11-contact';
const CORE=['./','index.html','contact.html','login.html','register.html','dashboard.html','page.html','assets/css/style.css','assets/css/cms-control.css','assets/js/auth.js','assets/js/cms-engine.js','assets/js/cms-deep-catalog.js','assets/js/cms-deep.js','manifest.webmanifest','icon-192.png','icon-512.png'];

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
