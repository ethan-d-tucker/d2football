// PWA SW for both pages
const CACHE_NAME = 'miaa-shell-v3';
const APP_SHELL = [
  './',
  './index.html',
  './standings.html',
  './assets/css/styles.css',
  './assets/js/scores.js',
  './assets/js/standings.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './manifest.webmanifest'
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  const isAPI = url.pathname.startsWith('/api/');
  if (isAPI) { e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))); return; }
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});