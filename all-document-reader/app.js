/* All Document Reader – prehliadač dokumentov v prehliadači (bez servera). */
'use strict';

// ---------------------------------------------------------------------------
// Konfigurácia formátov
// ---------------------------------------------------------------------------
const TYPES = {
  pdf:   { label: 'PDF',        color: 'var(--pdf)',    exts: ['pdf'] },
  word:  { label: 'Word',       color: 'var(--word)',   exts: ['docx', 'doc', 'odt', 'rtf'] },
  excel: { label: 'Excel',      color: 'var(--excel)',  exts: ['xlsx', 'xls', 'ods'] },
  ppt:   { label: 'PowerPoint', color: 'var(--ppt)',    exts: ['pptx', 'ppt'] },
  text:  { label: 'Text',       color: 'var(--text-c)', exts: ['txt', 'md', 'log', 'json', 'xml'] },
  csv:   { label: 'CSV',        color: 'var(--csv)',    exts: ['csv', 'tsv'] },
};
const EXT_TO_TYPE = {};
for (const [t, cfg] of Object.entries(TYPES)) cfg.exts.forEach(e => (EXT_TO_TYPE[e] = t));
const SKIP_DIRS = new Set(['node_modules', '.git', '$RECYCLE.BIN', 'System Volume Information']);

if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

// ---------------------------------------------------------------------------
// Stav aplikácie
// ---------------------------------------------------------------------------
const state = {
  docs: [],            // { id, file, name, ext, type, size, modified, path, handle, parent }
  category: 'all',
  filter: '',
  sort: 'name',
  current: null,       // otvorený dokument
  ctrl: null,          // ovládač aktuálneho prehliadača
  zoom: 1,
  dialogDoc: null,
};
let nextId = 1;

const $ = id => document.getElementById(id);
const el = {
  categoryList: $('categoryList'), fileList: $('fileList'), emptyState: $('emptyState'),
  filterInput: $('filterInput'), sortSelect: $('sortSelect'), sourceInfo: $('sourceInfo'),
  viewer: $('viewer'), viewerTitle: $('viewerTitle'), docScroll: $('docScroll'), docContent: $('docContent'),
  docSearchInput: $('docSearchInput'), searchCount: $('searchCount'),
  pageNav: $('pageNav'), pageInput: $('pageInput'), pageTotal: $('pageTotal'),
  zoomLabel: $('zoomLabel'), bookmarksPanel: $('bookmarksPanel'), bookmarkList: $('bookmarkList'),
  layout: document.querySelector('.layout'), sidebar: $('sidebar'),
  dialog: $('detailsDialog'), toast: $('toast'), dropOverlay: $('dropOverlay'),
};

// ---------------------------------------------------------------------------
// Pomocné funkcie
// ---------------------------------------------------------------------------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const extOf = name => (name.includes('.') ? name.split('.').pop().toLowerCase() : '');
const docKey = d => `${d.path}|${d.size}|${d.modified}`;

function formatSize(b) {
  if (b < 1024) return `${b} B`;
  const u = ['KB', 'MB', 'GB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(b < 10 ? 1 : 0)} ${u[i]}`;
}
const formatDate = ts => new Date(ts).toLocaleString('sk-SK', { dateStyle: 'medium', timeStyle: 'short' });

let toastTimer;
function toast(msg, ms = 3000) {
  el.toast.textContent = msg;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), ms);
}

const store = {
  get(k, def) { try { return JSON.parse(localStorage.getItem('adr.' + k)) ?? def; } catch { return def; } },
  set(k, v) { try { localStorage.setItem('adr.' + k, JSON.stringify(v)); } catch { /* ignorovať */ } },
};

// ---------------------------------------------------------------------------
// Načítanie súborov
// ---------------------------------------------------------------------------
function makeDoc(file, path, handle = null, parent = null) {
  const ext = extOf(file.name);
  const type = EXT_TO_TYPE[ext];
  if (!type) return null;
  return {
    id: nextId++, file, name: file.name, ext, type, size: file.size,
    modified: file.lastModified, path: path || file.name, handle, parent,
  };
}

function addDocs(list, { replace = false } = {}) {
  const valid = list.filter(Boolean);
  if (replace) state.docs = valid;
  else {
    const keys = new Set(state.docs.map(docKey));
    valid.forEach(d => { if (!keys.has(docKey(d))) state.docs.push(d); });
  }
  render();
  return valid.length;
}

async function scanDirectory(dirHandle, prefix = '', out = []) {
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue;
    const path = prefix ? `${prefix}/${name}` : name;
    if (handle.kind === 'directory') {
      if (!SKIP_DIRS.has(name)) await scanDirectory(handle, path, out);
    } else if (EXT_TO_TYPE[extOf(name)]) {
      try { out.push(makeDoc(await handle.getFile(), path, handle, dirHandle)); } catch { /* nečitateľný */ }
    }
  }
  return out;
}

async function openFolder() {
  if (window.showDirectoryPicker) {
    try {
      const dir = await window.showDirectoryPicker({ id: 'adr', mode: 'read' });
      el.sourceInfo.textContent = `Skenujem „${dir.name}“…`;
      const docs = await scanDirectory(dir, dir.name);
      const n = addDocs(docs, { replace: true });
      el.sourceInfo.innerHTML = `Priečinok: <strong>${esc(dir.name)}</strong><br>${n} dokumentov`;
      toast(`Nájdených ${n} dokumentov`);
    } catch (e) {
      if (e.name !== 'AbortError') toast('Priečinok sa nepodarilo načítať: ' + e.message);
    }
  } else {
    $('folderInput').click(); // záložné riešenie (Firefox, Safari)
  }
}

$('folderInput').addEventListener('change', e => {
  const files = [...e.target.files];
  const n = addDocs(files.map(f => makeDoc(f, f.webkitRelativePath || f.name)), { replace: true });
  const root = files[0]?.webkitRelativePath?.split('/')[0] || '';
  el.sourceInfo.innerHTML = `Priečinok: <strong>${esc(root)}</strong><br>${n} dokumentov<br><em>Premenovanie a mazanie ovplyvní len zoznam (prehliadač nemá prístup na zápis).</em>`;
  toast(`Nájdených ${n} dokumentov`);
  e.target.value = '';
});

$('fileInput').addEventListener('change', e => {
  const docs = [...e.target.files].map(f => makeDoc(f, f.name));
  const n = addDocs(docs);
  if (n === 1) openDoc(docs.find(Boolean));
  else toast(n ? `Pridaných ${n} dokumentov` : 'Nepodporovaný formát');
  e.target.value = '';
});

async function openFiles() {
  if (window.showOpenFilePicker) {
    try {
      const handles = await window.showOpenFilePicker({
        multiple: true, id: 'adr-files',
        types: [{ description: 'Dokumenty', accept: { 'application/octet-stream': Object.keys(EXT_TO_TYPE).map(e => '.' + e) } }],
      });
      const docs = await Promise.all(handles.map(async h => makeDoc(await h.getFile(), h.name, h)));
      const n = addDocs(docs);
      if (n === 1) openDoc(docs.find(Boolean));
      else if (n) toast(`Pridaných ${n} dokumentov`);
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  $('fileInput').click();
}

// Drag & drop (aj s priečinkami)
let dragDepth = 0;
window.addEventListener('dragenter', e => { e.preventDefault(); dragDepth++; el.dropOverlay.classList.remove('hidden'); });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; el.dropOverlay.classList.add('hidden'); } });
window.addEventListener('dragover', e => e.preventDefault());
window.addEventListener('drop', async e => {
  e.preventDefault(); dragDepth = 0; el.dropOverlay.classList.add('hidden');
  const entries = [...e.dataTransfer.items].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
  let docs = [];
  if (entries.length) {
    for (const entry of entries) docs.push(...await readEntry(entry));
  } else {
    docs = [...e.dataTransfer.files].map(f => makeDoc(f, f.name));
  }
  const n = addDocs(docs);
  if (n === 1) openDoc(docs.find(Boolean));
  else toast(n ? `Pridaných ${n} dokumentov` : 'Žiadne podporované dokumenty');
});

function readEntry(entry, prefix = '') {
  const path = prefix ? `${prefix}/${entry.name}` : entry.name;
  if (entry.isFile) {
    return new Promise(res => entry.file(f => res([makeDoc(f, path)]), () => res([])));
  }
  if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) return Promise.resolve([]);
  return new Promise(res => {
    const reader = entry.createReader(); const all = [];
    const next = () => reader.readEntries(async batch => {
      if (!batch.length) {
        const nested = await Promise.all(all.map(en => readEntry(en, path)));
        res(nested.flat());
      } else { all.push(...batch); next(); }
    }, () => res([]));
    next();
  });
}

// ---------------------------------------------------------------------------
// Knižnica: kategórie a zoznam
// ---------------------------------------------------------------------------
function bookmarksAll() { return store.get('bookmarks', {}); }
function recentKeys() { return store.get('recent', []); }

function docsForCategory(cat) {
  if (cat === 'all') return state.docs;
  if (cat === 'recent') {
    const order = recentKeys();
    return state.docs.filter(d => order.includes(docKey(d)))
      .sort((a, b) => order.indexOf(docKey(a)) - order.indexOf(docKey(b)));
  }
  if (cat === 'bookmarked') {
    const bm = bookmarksAll();
    return state.docs.filter(d => bm[docKey(d)]?.length);
  }
  return state.docs.filter(d => d.type === cat);
}

function renderCategories() {
  const cats = [
    ['all', '📚 Všetky dokumenty', null],
    ...Object.entries(TYPES).map(([k, t]) => [k, t.label, t.color]),
    ['sep'],
    ['recent', '🕘 Nedávne', null],
    ['bookmarked', '🔖 So záložkami', null],
  ];
  el.categoryList.innerHTML = cats.map(([k, label, color]) => {
    if (k === 'sep') return '<div class="cat-sep"></div>';
    const n = docsForCategory(k).length;
    const dot = color ? `<span class="dot" style="background:${color}"></span>` : '';
    return `<button class="cat ${state.category === k ? 'active' : ''}" data-cat="${k}">${dot}<span>${label}</span><span class="count">${n}</span></button>`;
  }).join('');
}

function sortedFiltered() {
  const q = state.filter.trim().toLowerCase();
  let list = docsForCategory(state.category);
  if (q) list = list.filter(d => d.path.toLowerCase().includes(q));
  if (state.category === 'recent' && state.sort === 'name') return list;
  const cmp = {
    name: (a, b) => a.name.localeCompare(b.name, 'sk', { numeric: true }),
    date: (a, b) => b.modified - a.modified,
    size: (a, b) => b.size - a.size,
    type: (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, 'sk'),
  }[state.sort];
  return [...list].sort(cmp);
}

function renderList() {
  const list = sortedFiltered();
  el.fileList.innerHTML = list.map(d => `
    <li class="file-item" data-id="${d.id}">
      <div class="badge" style="background:${TYPES[d.type].color}">${esc(d.ext.toUpperCase())}</div>
      <div class="file-meta">
        <div class="file-name" title="${esc(d.name)}">${esc(d.name)}</div>
        <div class="file-sub">${formatSize(d.size)} · ${formatDate(d.modified)} · ${esc(d.path)}</div>
      </div>
      <div class="file-actions">
        <button class="icon-btn" data-act="details" title="Detaily">ⓘ</button>
        <button class="icon-btn" data-act="share" title="Zdieľať">⤴</button>
        <button class="icon-btn" data-act="rename" title="Premenovať">✎</button>
        <button class="icon-btn" data-act="delete" title="Odstrániť">🗑</button>
      </div>
    </li>`).join('');
  el.emptyState.classList.toggle('hidden', state.docs.length > 0);
  if (state.docs.length && !list.length) {
    el.fileList.innerHTML = '<li class="empty">V tejto kategórii nie sú žiadne dokumenty.</li>';
  }
}

function render() { renderCategories(); renderList(); }

el.categoryList.addEventListener('click', e => {
  const b = e.target.closest('[data-cat]'); if (!b) return;
  state.category = b.dataset.cat;
  el.sidebar.classList.remove('open');
  render();
});
el.filterInput.addEventListener('input', e => { state.filter = e.target.value; renderList(); });
el.sortSelect.addEventListener('change', e => { state.sort = e.target.value; renderList(); });

el.fileList.addEventListener('click', e => {
  const item = e.target.closest('.file-item'); if (!item) return;
  const doc = state.docs.find(d => d.id === +item.dataset.id); if (!doc) return;
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'details') showDetails(doc);
  else if (act === 'share') shareDoc(doc);
  else if (act === 'rename') renameDoc(doc);
  else if (act === 'delete') deleteDoc(doc);
  else openDoc(doc);
});
el.fileList.addEventListener('contextmenu', e => {
  const item = e.target.closest('.file-item'); if (!item) return;
  e.preventDefault();
  showDetails(state.docs.find(d => d.id === +item.dataset.id));
});

// ---------------------------------------------------------------------------
// Správa súborov: detaily, premenovanie, mazanie, zdieľanie
// ---------------------------------------------------------------------------
function showDetails(doc) {
  state.dialogDoc = doc;
  $('detailsName').textContent = doc.name;
  const rows = [
    ['Typ', `${TYPES[doc.type].label} (.${doc.ext})`],
    ['Veľkosť', `${formatSize(doc.size)} (${doc.size.toLocaleString('sk-SK')} B)`],
    ['Cesta', doc.path],
    ['Zmenené', formatDate(doc.modified)],
    ['MIME', doc.file.type || '—'],
    ['Záložky', String(bookmarksAll()[docKey(doc)]?.length || 0)],
    ['Prístup na zápis', doc.handle ? 'Áno (po povolení)' : 'Nie – zmeny len v zozname'],
  ];
  $('detailsList').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  el.dialog.showModal();
}
$('dlgOpen').onclick = () => { el.dialog.close(); openDoc(state.dialogDoc); };
$('dlgRename').onclick = () => { el.dialog.close(); renameDoc(state.dialogDoc); };
$('dlgShare').onclick = () => { shareDoc(state.dialogDoc); };
$('dlgDelete').onclick = () => { el.dialog.close(); deleteDoc(state.dialogDoc); };

async function ensureWrite(handle) {
  if (!handle?.queryPermission) return false;
  const opts = { mode: 'readwrite' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

function moveBookmarks(oldKey, newKey) {
  const bm = bookmarksAll();
  if (bm[oldKey]) { bm[newKey] = bm[oldKey]; delete bm[oldKey]; store.set('bookmarks', bm); }
  store.set('recent', recentKeys().map(k => (k === oldKey ? newKey : k)));
}

async function renameDoc(doc) {
  const newName = prompt('Nový názov súboru:', doc.name);
  if (!newName || newName === doc.name) return;
  if (/[\\/:*?"<>|]/.test(newName)) return toast('Názov obsahuje nepovolené znaky');
  if (extOf(newName) !== doc.ext && !confirm('Meníte príponu súboru. Pokračovať?')) return;
  const oldKey = docKey(doc);
  let onDisk = false;
  try {
    if (doc.handle?.move && await ensureWrite(doc.parent || doc.handle)) {
      await doc.handle.move(newName);
      onDisk = true;
    } else if (doc.parent && await ensureWrite(doc.parent)) {
      // Záložné riešenie: skopírovať obsah do nového súboru a starý odstrániť
      const nh = await doc.parent.getFileHandle(newName, { create: true });
      const w = await nh.createWritable();
      await w.write(await doc.file.arrayBuffer()); await w.close();
      await doc.parent.removeEntry(doc.name);
      doc.handle = nh; onDisk = true;
    }
    if (onDisk) doc.file = await doc.handle.getFile();
  } catch (e) {
    return toast('Premenovanie zlyhalo: ' + e.message);
  }
  doc.path = doc.path.slice(0, doc.path.length - doc.name.length) + newName;
  doc.name = newName; doc.ext = extOf(newName);
  doc.type = EXT_TO_TYPE[doc.ext] || doc.type;
  if (onDisk) doc.modified = doc.file.lastModified;
  moveBookmarks(oldKey, docKey(doc));
  render();
  if (state.current === doc) el.viewerTitle.textContent = doc.name;
  toast(onDisk ? 'Súbor bol premenovaný' : 'Premenované len v aplikácii (bez prístupu na zápis)');
}

async function deleteDoc(doc) {
  const canDisk = !!doc.parent;
  const msg = canDisk
    ? `Naozaj natrvalo odstrániť „${doc.name}“ z disku?`
    : `Odstrániť „${doc.name}“ zo zoznamu? (Súbor na disku zostane.)`;
  if (!confirm(msg)) return;
  try {
    if (canDisk) {
      if (!await ensureWrite(doc.parent)) return toast('Prístup na zápis bol zamietnutý');
      await doc.parent.removeEntry(doc.name);
    }
  } catch (e) { return toast('Odstránenie zlyhalo: ' + e.message); }
  state.docs = state.docs.filter(d => d !== doc);
  if (state.current === doc) closeViewer();
  render();
  toast(canDisk ? 'Súbor bol odstránený' : 'Odstránené zo zoznamu');
}

async function shareDoc(doc) {
  const file = new File([doc.file], doc.name, { type: doc.file.type });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: doc.name });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  // Záložné riešenie: stiahnutie kópie
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = doc.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast('Zdieľanie nie je dostupné – súbor bol stiahnutý');
}

// ---------------------------------------------------------------------------
// Prehliadač
// ---------------------------------------------------------------------------
async function openDoc(doc) {
  if (!doc) return;
  state.ctrl?.destroy?.();
  state.current = doc; state.ctrl = null; state.zoom = 1;
  const recent = [docKey(doc), ...recentKeys().filter(k => k !== docKey(doc))].slice(0, 30);
  store.set('recent', recent);
  renderCategories();

  el.viewer.classList.remove('hidden');
  el.layout.classList.add('viewing');
  el.viewerTitle.textContent = doc.name;
  el.docSearchInput.value = ''; el.searchCount.textContent = '';
  el.docContent.innerHTML = '<div class="loading">Načítavam…</div>';
  el.docContent.style.zoom = '';
  el.docScroll.scrollTop = 0;
  updateZoomLabel();

  const renderers = { pdf: renderPdf, word: renderWord, excel: renderSheet, csv: renderSheet, ppt: renderPpt, text: renderText };
  try {
    const ctrl = await renderers[doc.type](doc);
    if (state.current !== doc) return ctrl?.destroy?.(); // medzitým otvorený iný dokument
    state.ctrl = ctrl;
  } catch (e) {
    console.error(e);
    el.docContent.innerHTML = `<div class="notice">Dokument sa nepodarilo otvoriť: ${esc(e.message || e)}</div>`;
    state.ctrl = genericCtrl();
  }
  setupPageNav();
  renderBookmarks();
}

function closeViewer() {
  state.ctrl?.destroy?.();
  state.current = null; state.ctrl = null;
  el.viewer.classList.add('hidden');
  el.layout.classList.remove('viewing');
  el.docContent.innerHTML = '';
}

/* Spoločný ovládač pre dokumenty vykreslené ako HTML (vyhľadávanie, strany, pozícia). */
function genericCtrl({ pages = [], extra = {} } = {}) {
  let marks = [], idx = -1;
  const ctrl = {
    pages,
    search(q) {
      clearMarks(el.docContent);
      marks = q ? highlight(el.docContent, q) : [];
      idx = -1;
      if (marks.length) ctrl.step(1);
      return { total: marks.length, index: idx };
    },
    step(dir) {
      if (!marks.length) return { total: 0, index: -1 };
      marks[idx]?.classList.remove('active');
      idx = (idx + dir + marks.length) % marks.length;
      marks[idx].classList.add('active');
      marks[idx].scrollIntoView({ block: 'center', inline: 'nearest' });
      return { total: marks.length, index: idx };
    },
    currentPage() { return currentVisible(pages); },
    gotoPage(n) { pages[n - 1]?.scrollIntoView({ block: 'start' }); },
    getPos() {
      if (pages.length) return { page: ctrl.currentPage() };
      const s = el.docScroll;
      return { ratio: s.scrollTop / Math.max(1, s.scrollHeight - s.clientHeight) };
    },
    setPos(p) {
      if (p.page) return ctrl.gotoPage(p.page);
      const s = el.docScroll;
      s.scrollTop = p.ratio * (s.scrollHeight - s.clientHeight);
    },
    describePos(p) { return p.page ? `${pages.length && state.current?.type === 'ppt' ? 'Snímka' : 'Strana'} ${p.page}` : `Pozícia ${Math.round(p.ratio * 100)} %`; },
    setZoom(z) { el.docContent.style.zoom = z; },
    ...extra,
  };
  return ctrl;
}

function currentVisible(pages) {
  if (!pages.length) return 1;
  const top = el.docScroll.getBoundingClientRect().top + 40;
  let cur = 1;
  pages.forEach((p, i) => { if (p.getBoundingClientRect().top <= top) cur = i + 1; });
  return cur;
}

function clearMarks(root) {
  root.querySelectorAll('mark.hl').forEach(m => {
    const parent = m.parentNode;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  });
}

function highlight(root, query) {
  const q = query.toLowerCase();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.nodeValue.toLowerCase().includes(q) && !n.parentElement.closest('script,style'))
      ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  const marks = [];
  for (const node of nodes) {
    const text = node.nodeValue, lower = text.toLowerCase();
    const frag = document.createDocumentFragment();
    let pos = 0, i;
    while ((i = lower.indexOf(q, pos)) !== -1) {
      if (i > pos) frag.appendChild(document.createTextNode(text.slice(pos, i)));
      const m = document.createElement('mark');
      m.className = 'hl'; m.textContent = text.slice(i, i + q.length);
      frag.appendChild(m); marks.push(m);
      pos = i + q.length;
    }
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    node.parentNode.replaceChild(frag, node);
  }
  return marks;
}

// ---- PDF -------------------------------------------------------------------
async function renderPdf(doc) {
  const pdf = await pdfjsLib.getDocument({ data: await doc.file.arrayBuffer() }).promise;
  el.docContent.innerHTML = '';
  const results = document.createElement('div');
  results.className = 'pdf-results hidden';
  el.docContent.appendChild(results);

  const baseWidth = () => Math.min(el.docScroll.clientWidth - 40, 900);
  const first = await pdf.getPage(1);
  const vp1 = first.getViewport({ scale: 1 });
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const div = document.createElement('div');
    div.className = 'page-sheet pdf-page';
    div.dataset.page = i;
    div.innerHTML = `<span class="page-label">${i}</span>`;
    el.docContent.appendChild(div);
    pages.push(div);
  }
  let zoom = 1, ratio = vp1.height / vp1.width;
  const sizes = {};
  const layout = () => pages.forEach((p, i) => {
    const w = baseWidth() * zoom;
    p.style.width = w + 'px';
    p.style.height = w * (sizes[i + 1] || ratio) + 'px';
  });
  layout();

  const rendered = new Map(); // strana -> šírka, pri ktorej bola vykreslená
  async function draw(n) {
    const div = pages[n - 1];
    const w = baseWidth() * zoom;
    if (rendered.get(n) === w) return;
    rendered.set(n, w);
    const page = await pdf.getPage(n);
    const vp0 = page.getViewport({ scale: 1 });
    sizes[n] = vp0.height / vp0.width;
    div.style.height = w * sizes[n] + 'px';
    const dpr = window.devicePixelRatio || 1;
    const vp = page.getViewport({ scale: (w / vp0.width) * dpr });
    const canvas = document.createElement('canvas');
    canvas.width = vp.width; canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    if (rendered.get(n) !== w) return; // medzitým zmenený zoom
    div.querySelector('canvas')?.remove();
    div.prepend(canvas);
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) draw(+en.target.dataset.page); });
  }, { root: el.docScroll, rootMargin: '600px 0px' });
  pages.forEach(p => io.observe(p));

  // Vyhľadávanie v texte PDF
  const texts = [];
  async function pageText(n) {
    if (texts[n] === undefined) {
      const tc = await (await pdf.getPage(n)).getTextContent();
      texts[n] = tc.items.map(it => it.str + (it.hasEOL ? '\n' : '')).join('');
    }
    return texts[n];
  }
  let hits = [], idx = -1, searchToken = 0;
  function showHit() {
    pages.forEach(p => p.classList.remove('hit'));
    [...results.children].forEach((c, i) => c.classList.toggle('active', i === idx));
    const h = hits[idx]; if (!h) return;
    pages[h.page - 1].classList.add('hit');
    pages[h.page - 1].scrollIntoView({ block: 'start' });
    results.children[idx]?.scrollIntoView({ block: 'nearest' });
  }

  const ctrl = genericCtrl({ pages });
  Object.assign(ctrl, {
    async search(q) {
      const token = ++searchToken;
      hits = []; idx = -1; results.innerHTML = ''; results.classList.add('hidden');
      pages.forEach(p => p.classList.remove('hit'));
      if (!q) return { total: 0, index: -1 };
      const lq = q.toLowerCase();
      for (let n = 1; n <= pdf.numPages; n++) {
        const t = await pageText(n);
        if (token !== searchToken) return null; // zastarané hľadanie
        const lt = t.toLowerCase(); let i = lt.indexOf(lq);
        while (i !== -1) {
          const snip = t.slice(Math.max(0, i - 40), i + lq.length + 40).replace(/\s+/g, ' ');
          hits.push({ page: n, snip, at: i - Math.max(0, i - 40) });
          i = lt.indexOf(lq, i + lq.length);
        }
      }
      results.innerHTML = hits.slice(0, 500).map(h => {
        const s = esc(h.snip);
        return `<div><strong>Str. ${h.page}:</strong> …${s}…</div>`;
      }).join('');
      results.querySelectorAll('div').forEach((d, i) => (d.onclick = () => { idx = i; showHit(); updateSearchCount({ total: hits.length, index: idx }); }));
      results.classList.toggle('hidden', !hits.length);
      if (hits.length) { idx = 0; showHit(); }
      return { total: hits.length, index: idx };
    },
    step(dir) {
      if (!hits.length) return { total: 0, index: -1 };
      idx = (idx + dir + hits.length) % hits.length; showHit();
      return { total: hits.length, index: idx };
    },
    setZoom(z) {
      const p = ctrl.currentPage();
      zoom = z; layout(); ctrl.gotoPage(p);
      pages.forEach((pg, i) => { const r = pg.getBoundingClientRect(); const s = el.docScroll.getBoundingClientRect();
        if (r.bottom > s.top - 600 && r.top < s.bottom + 600) draw(i + 1); });
    },
    destroy() { io.disconnect(); pdf.destroy(); },
  });
  return ctrl;
}

// ---- Word (DOCX / DOC / ODT / RTF) ----------------------------------------
async function renderWord(doc) {
  const page = document.createElement('div');
  page.className = 'page-sheet docx-page';
  let notice = '';
  if (doc.ext === 'docx') {
    const res = await mammoth.convertToHtml({ arrayBuffer: await doc.file.arrayBuffer() });
    page.innerHTML = sanitize(res.value) || '<p><em>(prázdny dokument)</em></p>';
  } else if (doc.ext === 'odt') {
    const zip = await JSZip.loadAsync(await doc.file.arrayBuffer());
    const xml = new DOMParser().parseFromString(await zip.file('content.xml').async('string'), 'application/xml');
    const body = xml.getElementsByTagNameNS('*', 'text')[0] || xml.documentElement;
    page.innerHTML = [...body.getElementsByTagNameNS('*', '*')]
      .filter(n => n.localName === 'p' || n.localName === 'h')
      .map(n => `<${n.localName === 'h' ? 'h2' : 'p'}>${esc(n.textContent)}</${n.localName === 'h' ? 'h2' : 'p'}>`).join('');
    notice = 'ODT: zobrazený je len text bez formátovania.';
  } else if (doc.ext === 'rtf') {
    page.innerHTML = textToParas(rtfToText(await doc.file.text()));
    notice = 'RTF: zobrazený je len text bez formátovania.';
  } else {
    page.innerHTML = textToParas(extractLegacyText(await doc.file.arrayBuffer()));
    notice = 'Starý binárny formát .doc má obmedzenú podporu – zobrazený je len extrahovaný text. Pre plné zobrazenie uložte súbor ako .docx.';
  }
  el.docContent.innerHTML = notice ? `<div class="notice">${notice}</div>` : '';
  el.docContent.appendChild(page);
  return genericCtrl();
}

function sanitize(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  t.content.querySelectorAll('script,iframe,object,embed,style,link').forEach(n => n.remove());
  t.content.querySelectorAll('*').forEach(n => {
    [...n.attributes].forEach(a => {
      if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) n.removeAttribute(a.name);
    });
    if (n.tagName === 'A') { n.target = '_blank'; n.rel = 'noopener noreferrer'; }
  });
  const d = document.createElement('div'); d.appendChild(t.content); return d.innerHTML;
}

const textToParas = t => t.split(/\n{1,}/).map(s => s.trim()).filter(Boolean).map(s => `<p>${esc(s)}</p>`).join('') || '<p><em>Text sa nepodarilo extrahovať.</em></p>';

function rtfToText(rtf) {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_, h) => new TextDecoder('windows-1250').decode(new Uint8Array([parseInt(h, 16)])))
    .replace(/\\u(-?\d+)\??/g, (_, n) => String.fromCharCode(n < 0 ? 65536 + +n : +n))
    .replace(/\{\\(\*|fonttbl|colortbl|stylesheet|info)[^{}]*(\{[^{}]*\}[^{}]*)*\}/g, '')
    .replace(/\\par[d]?\b/g, '\n')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '');
}

/* Heuristická extrakcia textu zo starých binárnych formátov (.doc, .ppt). */
function extractLegacyText(buf) {
  const bytes = new Uint8Array(buf);
  const runs = [];
  // UTF-16LE
  const u16 = new TextDecoder('utf-16le').decode(bytes.length % 2 ? bytes.slice(0, -1) : bytes);
  const re16 = /[\p{L}\p{N}\p{P}\p{Zs}\r\n\t]{12,}/gu;
  for (const m of u16.matchAll(re16)) if (/\p{L}{3}/u.test(m[0]) && /\s/.test(m[0])) runs.push(m[0]);
  // 8-bit (cp1250)
  const s8 = new TextDecoder('windows-1250').decode(bytes);
  for (const m of s8.matchAll(/[A-Za-z0-9À-ſ.,;:!?()\-"'%\s]{30,}/g)) if (/[a-z]{3}/i.test(m[0]) && /\s\S+\s/.test(m[0])) runs.push(m[0]);
  const seen = new Set();
  return runs.map(r => r.replace(/\r/g, '\n').replace(/[ \t]+/g, ' ').trim())
    .filter(r => r && !seen.has(r) && seen.add(r)).join('\n');
}

// ---- Excel / CSV -----------------------------------------------------------
const MAX_ROWS = 3000;
async function renderSheet(doc) {
  let wb;
  if (doc.type === 'csv') {
    let text = await doc.file.text();
    if (text.includes('�')) text = new TextDecoder('windows-1250').decode(await doc.file.arrayBuffer());
    const delim = doc.ext === 'tsv' ? '\t' : guessDelimiter(text);
    wb = XLSX.read(text, { type: 'string', FS: delim, raw: true });
  } else {
    wb = XLSX.read(await doc.file.arrayBuffer(), { type: 'array', cellDates: true });
  }
  el.docContent.innerHTML = '';
  const tabs = document.createElement('div'); tabs.className = 'sheet-tabs';
  const holder = document.createElement('div');
  el.docContent.append(tabs, holder);
  const ctrl = genericCtrl();

  function show(i) {
    [...tabs.children].forEach((b, j) => b.classList.toggle('active', i === j));
    const ws = wb.Sheets[wb.SheetNames[i]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: true });
    const cols = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const shown = rows.slice(0, MAX_ROWS);
    let html = '<div class="table-wrap"><table class="data-table"><thead><tr><th class="rownum"></th>';
    for (let c = 0; c < cols; c++) html += `<th>${XLSX.utils.encode_col(c)}</th>`;
    html += '</tr></thead><tbody>';
    shown.forEach((r, ri) => {
      html += `<tr><td class="rownum">${ri + 1}</td>`;
      for (let c = 0; c < cols; c++) { const v = r[c] ?? ''; html += `<td title="${esc(v)}">${esc(v)}</td>`; }
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    if (rows.length > MAX_ROWS) html = `<div class="notice">Zobrazených prvých ${MAX_ROWS} z ${rows.length} riadkov.</div>` + html;
    if (!rows.length) html = '<div class="notice">Hárok je prázdny.</div>';
    holder.innerHTML = html;
    if (el.docSearchInput.value) updateSearchCount(ctrl.search(el.docSearchInput.value));
  }
  tabs.innerHTML = wb.SheetNames.map(n => `<button>${esc(n)}</button>`).join('');
  [...tabs.children].forEach((b, i) => (b.onclick = () => show(i)));
  if (wb.SheetNames.length < 2) tabs.classList.add('hidden');
  show(0);
  return ctrl;
}

function guessDelimiter(text) {
  const line = text.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = [',', ';', '\t', '|'].map(d => [d, line.split(d).length]);
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

// ---- PowerPoint (PPTX / PPT) ----------------------------------------------
const EMU_PER_PT = 12700;
async function renderPpt(doc) {
  if (doc.ext === 'ppt') {
    el.docContent.innerHTML = '<div class="notice">Starý binárny formát .ppt má obmedzenú podporu – zobrazený je len extrahovaný text. Pre plné zobrazenie uložte prezentáciu ako .pptx.</div>';
    const page = document.createElement('div');
    page.className = 'page-sheet docx-page';
    page.innerHTML = textToParas(extractLegacyText(await doc.file.arrayBuffer()));
    el.docContent.appendChild(page);
    return genericCtrl();
  }
  const zip = await JSZip.loadAsync(await doc.file.arrayBuffer());
  const parse = async p => { const f = zip.file(p); return f ? new DOMParser().parseFromString(await f.async('string'), 'application/xml') : null; };
  const byName = (root, name) => [...root.getElementsByTagNameNS('*', name)];
  const child = (node, name) => node && [...node.children].find(c => c.localName === name);
  const attr = (node, name) => node?.getAttribute(name);
  const relsOf = async path => {
    const dir = path.slice(0, path.lastIndexOf('/'));
    const relPath = `${dir}/_rels/${path.split('/').pop()}.rels`;
    const x = await parse(relPath); const map = {};
    if (x) byName(x, 'Relationship').forEach(r => (map[r.getAttribute('Id')] = resolvePath(dir, r.getAttribute('Target'))));
    return map;
  };

  const pres = await parse('ppt/presentation.xml');
  const sz = pres && byName(pres, 'sldSz')[0];
  const cx = +(attr(sz, 'cx') || 12192000), cy = +(attr(sz, 'cy') || 6858000);
  const presRels = await relsOf('ppt/presentation.xml');
  let slidePaths = pres ? byName(pres, 'sldId').map(s => presRels[s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')]).filter(Boolean) : [];
  if (!slidePaths.length) {
    slidePaths = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  }

  const urls = [];
  const pct = (v, total) => `${(v / total) * 100}%`;
  const fontCqw = pt => `${((pt * EMU_PER_PT) / cx) * 100}cqw`;
  const color = n => { const c = n && byName(n, 'srgbClr')[0]; return c ? '#' + c.getAttribute('val') : null; };

  el.docContent.innerHTML = '';
  const pages = [];
  for (let si = 0; si < slidePaths.length; si++) {
    const path = slidePaths[si];
    const xml = await parse(path); if (!xml) continue;
    const rels = await relsOf(path);
    const slide = document.createElement('div');
    slide.className = 'page-sheet slide';
    slide.style.aspectRatio = `${cx} / ${cy}`;
    const bg = byName(xml, 'bg')[0];
    if (color(bg)) slide.style.background = color(bg);

    const tree = byName(xml, 'spTree')[0];
    let flowY = 0.05; // náhradné umiestnenie pre tvary bez pozície
    const place = (node, isTitle) => {
      const xfrm = byName(node, 'xfrm')[0];
      const off = child(xfrm, 'off'), ext = child(xfrm, 'ext');
      if (off && ext) return { x: +attr(off, 'x'), y: +attr(off, 'y'), w: +attr(ext, 'cx'), h: +attr(ext, 'cy') };
      const h = isTitle ? 0.16 : 0.6; const y = isTitle ? 0.05 : Math.max(flowY, 0.25);
      flowY = y + h + 0.02;
      return { x: cx * 0.06, y: cy * y, w: cx * 0.88, h: cy * h };
    };
    const box = (r) => {
      const d = document.createElement('div'); d.className = 'shape';
      Object.assign(d.style, { left: pct(r.x, cx), top: pct(r.y, cy), width: pct(r.w, cx), height: pct(r.h, cy) });
      return d;
    };

    const walk = async parent => {
      for (const node of [...parent.children]) {
        const ln = node.localName;
        if (ln === 'grpSp') { await walk(node); continue; }
        if (ln === 'sp') {
          const ph = byName(node, 'ph')[0];
          const phType = attr(ph, 'type') || '';
          const isTitle = /title/i.test(phType);
          const tx = child(node, 'txBody');
          const fill = color(child(node, 'spPr') && child(child(node, 'spPr'), 'solidFill'));
          if (!tx && !fill) continue;
          const d = box(place(node, isTitle));
          if (fill) d.style.background = fill;
          if (tx) {
            const anchor = attr(child(tx, 'bodyPr'), 'anchor');
            d.style.display = 'flex'; d.style.flexDirection = 'column';
            d.style.justifyContent = anchor === 'ctr' ? 'center' : anchor === 'b' ? 'flex-end' : 'flex-start';
            d.style.padding = '0.6cqw 1cqw';
            for (const p of byName(tx, 'p')) {
              const pEl = document.createElement('p');
              const pPr = child(p, 'pPr');
              const algn = attr(pPr, 'algn');
              if (algn) pEl.style.textAlign = { ctr: 'center', r: 'right', just: 'justify' }[algn] || 'left';
              const bu = child(pPr, 'buChar');
              let html = bu ? `${esc(bu.getAttribute('char'))} ` : '';
              let size = isTitle ? 32 : 18;
              for (const r of [...p.children]) {
                if (r.localName === 'br') { html += '<br>'; continue; }
                if (r.localName !== 'r' && r.localName !== 'fld') continue;
                const rPr = child(r, 'rPr');
                if (attr(rPr, 'sz')) size = +attr(rPr, 'sz') / 100;
                const t = esc(child(r, 't')?.textContent || '');
                const st = [];
                if (attr(rPr, 'b') === '1') st.push('font-weight:700');
                if (attr(rPr, 'i') === '1') st.push('font-style:italic');
                if (attr(rPr, 'u') && attr(rPr, 'u') !== 'none') st.push('text-decoration:underline');
                const c = color(child(rPr, 'solidFill')); if (c) st.push(`color:${c}`);
                html += st.length ? `<span style="${st.join(';')}">${t}</span>` : t;
              }
              const endSz = attr(child(p, 'endParaRPr'), 'sz');
              if (!html && endSz) size = +endSz / 100;
              pEl.style.fontSize = fontCqw(size);
              pEl.style.fontWeight = isTitle ? '700' : '';
              pEl.innerHTML = html || '&nbsp;';
              d.appendChild(pEl);
            }
          }
          slide.appendChild(d);
        } else if (ln === 'pic') {
          const blip = byName(node, 'blip')[0];
          const rid = blip && (blip.getAttribute('r:embed') || blip.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'embed'));
          const target = rels[rid];
          if (!target || !zip.file(target) || /\.(emf|wmf)$/i.test(target)) continue;
          const blob = await zip.file(target).async('blob');
          const url = URL.createObjectURL(new Blob([blob], { type: mimeOf(target) })); urls.push(url);
          const d = box(place(node, false));
          d.innerHTML = `<img src="${url}" alt="">`;
          slide.appendChild(d);
        } else if (ln === 'graphicFrame') {
          const tbl = byName(node, 'tbl')[0]; if (!tbl) continue;
          const d = box(place(node, false));
          d.style.overflow = 'auto';
          d.innerHTML = '<table class="data-table" style="font-size:1.4cqw;width:100%;white-space:normal">' +
            byName(tbl, 'tr').map(tr => '<tr>' + [...tr.children].filter(c => c.localName === 'tc')
              .map(tc => `<td style="white-space:normal">${esc(tc.textContent)}</td>`).join('') + '</tr>').join('') + '</table>';
          slide.appendChild(d);
        }
      }
    };
    if (tree) await walk(tree);
    el.docContent.appendChild(slide);
    const num = document.createElement('div'); num.className = 'slide-num'; num.dataset.label = `Snímka ${si + 1} / ${slidePaths.length}`; // cez CSS, aby ho nenašlo vyhľadávanie
    el.docContent.appendChild(num);
    pages.push(slide);
  }
  if (!pages.length) el.docContent.innerHTML = '<div class="notice">Prezentácia neobsahuje žiadne snímky.</div>';
  const ctrl = genericCtrl({ pages });
  ctrl.destroy = () => urls.forEach(u => URL.revokeObjectURL(u));
  return ctrl;
}

function resolvePath(dir, target) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = dir.split('/');
  for (const seg of target.split('/')) {
    if (seg === '..') parts.pop(); else if (seg !== '.') parts.push(seg);
  }
  return parts.join('/');
}
const mimeOf = p => ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', bmp: 'image/bmp', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff' }[extOf(p)] || 'application/octet-stream');

// ---- Text ------------------------------------------------------------------
async function renderText(doc) {
  let text = await doc.file.text();
  if (text.includes('�')) text = new TextDecoder('windows-1250').decode(await doc.file.arrayBuffer());
  if (doc.ext === 'json') { try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* ponechať */ } }
  const page = document.createElement('div');
  page.className = 'page-sheet text-page';
  page.textContent = text || '(prázdny súbor)';
  el.docContent.innerHTML = '';
  el.docContent.appendChild(page);
  return genericCtrl();
}

// ---------------------------------------------------------------------------
// Ovládacie prvky prehliadača
// ---------------------------------------------------------------------------
function updateSearchCount(r) {
  if (!r) return;
  el.searchCount.textContent = el.docSearchInput.value ? (r.total ? `${r.index + 1}/${r.total}` : '0') : '';
}
let searchTimer;
el.docSearchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(async () => {
    const q = el.docSearchInput.value.trim();
    if (q.length === 1) return;
    updateSearchCount(await state.ctrl?.search(q));
  }, 250);
});
el.docSearchInput.addEventListener('keydown', async e => {
  if (e.key === 'Enter') { e.preventDefault(); updateSearchCount(state.ctrl?.step(e.shiftKey ? -1 : 1)); }
});
$('searchNext').onclick = () => updateSearchCount(state.ctrl?.step(1));
$('searchPrev').onclick = () => updateSearchCount(state.ctrl?.step(-1));

function setupPageNav() {
  const n = state.ctrl?.pages?.length || 0;
  el.pageNav.classList.toggle('hidden', n < 1);
  el.pageTotal.textContent = `/ ${n}`;
  el.pageInput.max = n; el.pageInput.value = 1;
}
el.docScroll.addEventListener('scroll', () => {
  if (state.ctrl?.pages?.length && document.activeElement !== el.pageInput) el.pageInput.value = state.ctrl.currentPage();
}, { passive: true });
el.pageInput.addEventListener('change', () => state.ctrl?.gotoPage(Math.max(1, Math.min(+el.pageInput.value, state.ctrl.pages.length))));
$('pagePrev').onclick = () => state.ctrl && state.ctrl.gotoPage(Math.max(1, state.ctrl.currentPage() - 1));
$('pageNext').onclick = () => state.ctrl && state.ctrl.gotoPage(Math.min(state.ctrl.pages.length, state.ctrl.currentPage() + 1));

const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
function setZoom(dir) {
  const i = ZOOMS.findIndex(z => z >= state.zoom);
  state.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 4 : i) + dir))];
  state.ctrl?.setZoom(state.zoom);
  updateZoomLabel();
}
const updateZoomLabel = () => (el.zoomLabel.textContent = Math.round(state.zoom * 100) + '%');
$('zoomIn').onclick = () => setZoom(1);
$('zoomOut').onclick = () => setZoom(-1);

$('closeViewerBtn').onclick = closeViewer;
$('viewerInfoBtn').onclick = () => state.current && showDetails(state.current);

// ---- Záložky ---------------------------------------------------------------
function renderBookmarks() {
  const list = state.current ? (bookmarksAll()[docKey(state.current)] || []) : [];
  el.bookmarkList.innerHTML = list.length
    ? list.map((b, i) => `<li data-i="${i}"><span title="${esc(b.label)}">🔖 ${esc(b.label)}</span><button class="icon-btn sm" data-del="${i}" title="Odstrániť">✕</button></li>`).join('')
    : '<li class="none">Žiadne záložky. Pridajte ich tlačidlom 🔖.</li>';
  $('bookmarksToggle').textContent = list.length ? '★' : '☆';
}
$('bookmarkBtn').onclick = () => {
  if (!state.current || !state.ctrl) return;
  const pos = state.ctrl.getPos();
  const label = prompt('Názov záložky:', state.ctrl.describePos(pos));
  if (label === null) return;
  const bm = bookmarksAll(); const k = docKey(state.current);
  (bm[k] = bm[k] || []).push({ label: label || state.ctrl.describePos(pos), pos, created: Date.now() });
  store.set('bookmarks', bm);
  renderBookmarks(); renderCategories();
  el.bookmarksPanel.classList.remove('hidden');
  toast('Záložka pridaná');
};
$('bookmarksToggle').onclick = () => el.bookmarksPanel.classList.toggle('hidden');
el.bookmarkList.addEventListener('click', e => {
  const k = state.current && docKey(state.current); if (!k) return;
  const bm = bookmarksAll();
  const del = e.target.closest('[data-del]');
  if (del) {
    bm[k].splice(+del.dataset.del, 1);
    if (!bm[k].length) delete bm[k];
    store.set('bookmarks', bm); renderBookmarks(); renderCategories();
    return;
  }
  const li = e.target.closest('li[data-i]');
  if (li) state.ctrl?.setPos(bm[k][+li.dataset.i].pos);
});

// ---------------------------------------------------------------------------
// Všeobecné ovládanie
// ---------------------------------------------------------------------------
$('openFilesBtn').onclick = openFiles;
$('openFolderBtn').onclick = openFolder;
$('menuBtn').onclick = () => el.sidebar.classList.toggle('open');
$('themeBtn').onclick = () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme = dark ? 'light' : 'dark';
  store.set('theme', document.documentElement.dataset.theme);
};
const savedTheme = store.get('theme', null);
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

document.addEventListener('keydown', e => {
  if (!state.current) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); el.docSearchInput.focus(); el.docSearchInput.select(); }
  else if (e.key === 'Escape' && !el.dialog.open && document.activeElement !== el.docSearchInput) closeViewer();
  else if ((e.ctrlKey || e.metaKey) && (e.key === '+' || e.key === '=')) { e.preventDefault(); setZoom(1); }
  else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); setZoom(-1); }
});

render();

// ---------------------------------------------------------------------------
// PWA: service worker, inštalácia, otváranie a zdieľanie súborov
// ---------------------------------------------------------------------------
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const offer = w => {
      if (!w || !navigator.serviceWorker.controller) return; // prvá inštalácia – netreba ponúkať
      $('updateBar').classList.remove('hidden');
      $('updateBtn').onclick = () => w.postMessage('skipWaiting');
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
  }).catch(e => console.warn('Service worker sa nepodarilo zaregistrovať', e));
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (navigator.serviceWorker.controller && !reloading && !$('updateBar').classList.contains('hidden')) {
      reloading = true; location.reload();
    }
  });
}

const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installEvent = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installEvent = e;
  $('installBtn').classList.remove('hidden');
});
window.addEventListener('appinstalled', () => {
  installEvent = null;
  $('installBtn').classList.add('hidden');
  toast('Aplikácia bola nainštalovaná');
});
if (isIos && !isStandalone()) $('installBtn').classList.remove('hidden');

$('installBtn').onclick = async () => {
  if (installEvent) {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') $('installBtn').classList.add('hidden');
    installEvent = null;
  } else if (isIos) {
    $('iosDialog').showModal();
  }
};

// Otvorenie súboru cez „Otvoriť pomocou…“ (nainštalovaná aplikácia – File Handling API)
const fileHandlingSupported = 'launchQueue' in window && 'files' in (window.LaunchParams?.prototype || {});
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async params => {
    if (!params.files?.length) return;
    const docs = (await Promise.all(params.files.map(async h => {
      try { return makeDoc(await h.getFile(), h.name, h); } catch { return null; }
    }))).filter(Boolean);
    const n = addDocs(docs);
    if (n) openDoc(docs[0]);
    else toast('Tento typ súboru nie je podporovaný');
  });
}
// Odkazy z manifestu (?open=file po spustení súborom, ?action=pdf zo skratky na ikone)
{
  const params = new URLSearchParams(location.search);
  if (params.get('action') === 'pdf') { history.replaceState(null, '', location.pathname); state.category = 'pdf'; render(); }
  else if (params.get('open') === 'file') history.replaceState(null, '', location.pathname);
}

$('pdfDefaultBtn').onclick = () => {
  const st = $('pdfDefaultStatus');
  if (isStandalone() && fileHandlingSupported) st.textContent = '✅ Aplikácia je nainštalovaná a tento prehliadač podporuje otváranie súborov. Stačí vybrať Doc Reader pri otvorení PDF.';
  else if (isStandalone()) st.textContent = 'Aplikácia je nainštalovaná. Ak sa v ponuke „Otvoriť pomocou“ nezobrazí, aktualizujte Chrome – vždy však funguje „Zdieľať → Doc Reader“.';
  else st.textContent = 'Najprv aplikáciu nainštalujte – až potom ju systém ponúkne na otváranie PDF.';
  $('pdfDefaultDialog').showModal();
  el.sidebar.classList.remove('open');
};

// Súbory zdieľané z inej aplikácie (Web Share Target – service worker ich uloží do cache)
async function receiveSharedFiles() {
  const params = new URLSearchParams(location.search);
  if (!params.has('shared') || !('caches' in window)) return;
  history.replaceState(null, '', location.pathname);
  const cache = await caches.open('adr-shared');
  const reqs = await cache.keys();
  const docs = [];
  for (const req of reqs) {
    const res = await cache.match(req);
    const name = decodeURIComponent(res.headers.get('X-Name') || 'subor');
    const blob = await res.blob();
    docs.push(makeDoc(new File([blob], name, { type: blob.type, lastModified: +res.headers.get('X-Modified') || Date.now() }), name));
    await cache.delete(req);
  }
  const n = addDocs(docs);
  if (n === 1) openDoc(docs.find(Boolean));
  else toast(n ? `Prijatých ${n} dokumentov` : 'Zdieľaný súbor nie je podporovaný');
}
receiveSharedFiles();

