const CACHE="zoo-journal-v15";
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))));
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["/","/manifest.webmanifest","/app-icon-192-v2.png","/app-icon-512-v2.png","/apple-touch-icon-v2.png"]))));
self.addEventListener("fetch",e=>{if(e.request.method==="GET")e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))})
