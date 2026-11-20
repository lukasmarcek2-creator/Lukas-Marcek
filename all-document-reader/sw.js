/* Service worker: offline režim + príjem zdieľaných súborov (Web Share Target). */
const VERSION = 'adr-v2';
const SHARED = 'adr-shared';
const ASSETS = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'vendor/pdf.min.js', 'vendor/pdf.worker.min.js', 'vendor/mammoth.browser.min.js',
  'vendor/jszip.min.js', 'vendor/xlsx.full.min.js', 'pdf-editor.js', 'vendor/pdf-lib.min.js', 'vendor/fontkit.umd.min.js',
  ...['Arimo', 'Tinos', 'Cousine'].flatMap(f => ['400Regular', '700Bold', '400Regular_Italic', '700Bold_Italic'].map(s => `vendor/fonts/${f}_${s}.ttf`)),
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png',
  'icons/apple-touch-icon.png', 'icons/favicon-32.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION && k !== SHARED).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // Súbory zdieľané z inej aplikácie (Android: „Zdieľať“ → Doc Reader)
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      const form = await e.request.formData();
      const files = form.getAll('files').filter(f => f && f.name);
      const cache = await caches.open(SHARED);
      await Promise.all(files.map((f, i) => cache.put(
        `shared/${Date.now()}-${i}`,
        new Response(f, { headers: { 'X-Name': encodeURIComponent(f.name), 'Content-Type': f.type || 'application/octet-stream', 'X-Modified': String(f.lastModified || Date.now()) } }),
      )));
      return Response.redirect(new URL('./?shared=1', self.registration.scope).href, 303);
    })());
    return;
  }

  if (e.request.method !== 'GET') return;

  // Navigácia: vždy aplikácia z cache (funguje offline aj s parametrami v URL)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put('index.html', copy));
        return res;
      }).catch(() => caches.match('index.html')),
    );
    return;
  }

  // Ostatné súbory: cache-first, na pozadí aktualizácia
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      const net = fetch(e.request).then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
        return res;
      }).catch(() => hit);
      return hit || net;
    }),
  );
});
