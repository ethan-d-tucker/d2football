
const CACHE='miaa-v10';
const SHELL=['./','./index.html','./standings.html','./rankings.html','./assets/css/styles.css','./assets/js/scores.js?v=10','./assets/js/standings.js?v=10','./assets/js/rankings.js?v=10'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))); self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))); self.clients.claim();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url); if(u.pathname.startsWith('/api/')){e.respondWith(fetch(e.request)); return;} e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});
