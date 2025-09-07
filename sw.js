// Simple SW
const CACHE='miaa-v4'; const SHELL=['./','./index.html','./standings.html','./rankings.html','./assets/css/styles.css','./assets/js/scores.js','./assets/js/standings.js','./assets/js/rankings.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))); self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url); if(u.pathname.startsWith('/api/')){e.respondWith(fetch(e.request)); return;} e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});