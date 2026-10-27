// App-shell cache only. Price API responses are NOT cached here (the Worker caches them).
const CACHE='nzgrocery-v12'; // v1.7.0 (uniform search grid + equal store price rows)
const SHELL=['./','index.html','app.js','i18n.js','search-i18n.js','search.js','manifest.webmanifest','data/stores.json','data/places.json','data/aliases.json','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&!k.startsWith('nzgrocery-photo-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return; // API & external links: straight to network
  if(/\/photo\/.*\.(bin|wasm)$/.test(u.pathname))return; // big model files: photo.js keeps them in its own cache
  // network first, fall back to cache (so updates show up, and it still opens offline)
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
