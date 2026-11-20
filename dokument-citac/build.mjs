// Builds a fully offline single-file app: dist/index.html (+ PWA manifest, service worker, icons)
import fs from 'fs';
const nm = (p) => fs.readFileSync('node_modules/' + p, 'utf8');
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
const libs = [
  'pdfjs-dist/build/pdf.min.js',
  'mammoth/mammoth.browser.min.js',
  'xlsx/dist/xlsx.full.min.js',
  'jszip/dist/jszip.min.js',
].map((p) => `<script>${esc(nm(p))}</script>`).join('\n');
const worker = `<script>window.__PDF_WORKER__=${esc(JSON.stringify(nm('pdfjs-dist/build/pdf.worker.min.js')))};</script>`;
const css = fs.readFileSync('src/style.css', 'utf8');
const app = esc(fs.readFileSync('src/app.js', 'utf8'));
const icon = 'data:image/svg+xml;base64,' + Buffer.from(fs.readFileSync('src/icon.svg')).toString('base64');

const body = `<title>Čítačka dokumentov</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div class="app">
  <header class="bar">
    <button class="icon-btn" id="back" type="button" aria-label="Späť" hidden><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg></button>
    <h1 id="title">Čítačka dokumentov</h1>
    <div class="tools" id="zoom-tools" hidden>
      <button class="icon-btn" id="zoom-out" type="button" aria-label="Zmenšiť"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
      <span class="zoom-label" id="zoom-label">100 %</span>
      <button class="icon-btn" id="zoom-in" type="button" aria-label="Zväčšiť"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
    </div>
    <button class="icon-btn" id="open-top" type="button" aria-label="Otvoriť súbor"><svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></button>
    <input type="file" id="file" hidden>
  </header>
  <main id="main"></main>
</div>
${libs}
${worker}
<script>${app}</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', body.replace(/\uFFFD/g, '\\ufffd'));
const full = `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1f6feb">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="${icon}">
<link rel="apple-touch-icon" href="icon-512.png">
<meta name="apple-mobile-web-app-capable" content="yes">
</head>
<body>
${body}
<script>if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function(){});</script>
</body>
</html>`;
fs.writeFileSync('dist/index.html', full);
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify({
  name: 'Čítačka dokumentov', short_name: 'Dokumenty', start_url: './', display: 'standalone',
  background_color: '#eef1f4', theme_color: '#1f6feb', lang: 'sk',
  icons: [{ src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' }],
}, null, 2));
fs.writeFileSync('dist/sw.js', `const C='citac-v1';const F=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(F)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));`);
for (const s of [192, 512]) if (fs.existsSync(`src/icon-${s}.png`)) fs.copyFileSync(`src/icon-${s}.png`, `dist/icon-${s}.png`);
console.log('dist/index.html', (full.length / 1048576).toFixed(2), 'MB');
