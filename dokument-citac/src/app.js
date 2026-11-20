/* Čítačka dokumentov — offline viewer for PDF, Word, Excel, PowerPoint, text and images. */
(function () {
  'use strict';

  const $ = (sel, el = document) => el.querySelector(sel);
  const main = $('#main');
  const title = $('#title');
  const backBtn = $('#back');
  const zoomTools = $('#zoom-tools');
  const zoomLabel = $('#zoom-label');
  const fileInput = $('#file');

  const KINDS = {
    pdf: { label: 'PDF', color: 'var(--pdf)', exts: ['pdf'] },
    doc: { label: 'DOC', color: 'var(--doc)', exts: ['docx', 'doc', 'odt', 'rtf'] },
    xls: { label: 'XLS', color: 'var(--xls)', exts: ['xlsx', 'xls', 'xlsm', 'xlsb', 'ods', 'csv', 'tsv'] },
    ppt: { label: 'PPT', color: 'var(--ppt)', exts: ['pptx', 'ppt', 'odp'] },
    img: { label: 'IMG', color: 'var(--img)', exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'heic'] },
    txt: { label: 'TXT', color: 'var(--txt)', exts: ['txt', 'md', 'json', 'xml', 'html', 'htm', 'log', 'ini', 'yaml', 'yml',
      'js', 'ts', 'css', 'py', 'java', 'c', 'cpp', 'h', 'sh', 'sql', 'kt', 'dart', 'srt', 'vtt'] },
  };
  const extOf = (name) => (name.split('.').pop() || '').toLowerCase();
  const kindOf = (name) => {
    const e = extOf(name);
    for (const k in KINDS) if (KINDS[k].exts.includes(e)) return k;
    return 'txt';
  };
  const fmtSize = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(0) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
  const fmtDate = (t) => new Date(t).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const el = (tag, attrs = {}, kids = []) => {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (const c of [].concat(kids)) if (c) n.append(c);
    return n;
  };

  /* ---------- PDF.js worker (bundled, offline) ---------- */
  if (window.pdfjsLib && window.__PDF_WORKER__) {
    const blob = new Blob([window.__PDF_WORKER__], { type: 'text/javascript' });
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  }

  /* ---------- Recent files (IndexedDB, best effort) ---------- */
  const DB_NAME = 'citac-dokumentov', STORE = 'files', MAX_RECENT = 12, MAX_STORE_BYTES = 40 * 1048576;
  let dbPromise = null;
  function db() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve) => {
        try {
          const req = indexedDB.open(DB_NAME, 1);
          req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    }
    return dbPromise;
  }
  async function tx(mode, fn) {
    const d = await db();
    if (!d) return null;
    return new Promise((resolve) => {
      try {
        const t = d.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(r && r.result);
        t.onerror = () => resolve(null);
      } catch (e) { resolve(null); }
    });
  }
  const listRecent = async () => ((await tx('readonly', (s) => s.getAll())) || []).sort((a, b) => b.date - a.date);
  async function saveRecent(file) {
    if (file.size > MAX_STORE_BYTES) return;
    const id = file.name + '|' + file.size;
    await tx('readwrite', (s) => s.put({ id, name: file.name, size: file.size, type: file.type, date: Date.now(), blob: file }));
    const all = await listRecent();
    for (const old of all.slice(MAX_RECENT)) await tx('readwrite', (s) => s.delete(old.id));
  }
  const removeRecent = (id) => tx('readwrite', (s) => s.delete(id));

  /* ---------- Home screen ---------- */
  async function showHome() {
    cleanup();
    title.textContent = 'Čítačka dokumentov';
    backBtn.hidden = true;
    zoomTools.hidden = true;
    const chips = el('div', { class: 'formats' }, ['PDF', 'DOCX', 'XLSX', 'CSV', 'PPTX', 'TXT', 'JSON', 'JPG', 'PNG'].map((f) => {
      const k = kindOf('x.' + f.toLowerCase());
      const c = el('span', { class: 'chip', text: f });
      c.style.background = KINDS[k].color;
      return c;
    }));
    const openBtn = el('button', { class: 'primary', type: 'button', id: 'open-main' }, [iconSvg('folder'), 'Otvoriť súbor']);
    openBtn.addEventListener('click', () => fileInput.click());
    const drop = el('div', { class: 'drop', id: 'drop' }, [
      openBtn,
      el('p', { text: 'Vyber dokument z telefónu alebo ho sem pretiahni. Všetko sa otvára priamo v zariadení, nič sa nikam neodosiela.' }),
      chips,
    ]);
    const list = el('ul', { class: 'recent', id: 'recent' });
    const home = el('div', { class: 'home' }, [drop, el('h2', { class: 'section-title', text: 'Naposledy otvorené' }), list]);
    main.replaceChildren(home);
    main.scrollTop = 0;

    const items = await listRecent();
    if (!items.length) {
      list.append(el('li', {}, el('p', { class: 'empty', text: 'Zatiaľ žiadne súbory. Otvorené dokumenty sa tu uložia pre rýchly prístup.' })));
      return;
    }
    for (const it of items) {
      const k = kindOf(it.name);
      const badge = el('span', { class: 'badge', text: KINDS[k].label });
      badge.style.background = KINDS[k].color;
      const open = el('button', { class: 'open-recent', type: 'button' }, [badge,
        el('span', { class: 'meta' }, [el('span', { class: 'name', text: it.name }),
          el('span', { class: 'sub', text: fmtSize(it.size) + ' · ' + fmtDate(it.date) })])]);
      open.addEventListener('click', () => openFile(new File([it.blob], it.name, { type: it.type })));
      const del = el('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Odstrániť zo zoznamu ' + it.name }, iconSvg('x'));
      del.addEventListener('click', async () => { await removeRecent(it.id); showHome(); });
      list.append(el('li', { class: 'row' }, [open, del]));
    }
  }

  /* ---------- Viewer state ---------- */
  let zoom = 1, rerender = null, cleanupFns = [], inViewer = false;
  function cleanup() { cleanupFns.forEach((f) => { try { f(); } catch (e) {} }); cleanupFns = []; rerender = null; zoom = 1; }
  function setZoom(z) {
    zoom = Math.min(4, Math.max(0.5, Math.round(z * 100) / 100));
    zoomLabel.textContent = Math.round(zoom * 100) + ' %';
    if (rerender) rerender();
  }
  $('#zoom-in').addEventListener('click', () => setZoom(zoom + 0.25));
  $('#zoom-out').addEventListener('click', () => setZoom(zoom - 0.25));

  function status(msg, isError) {
    main.replaceChildren(el('div', { class: 'status' }, [isError ? null : el('div', { class: 'spinner' }),
      el('p', { class: isError ? 'error' : '', text: msg })]));
  }

  async function openFile(file) {
    cleanup();
    title.textContent = file.name;
    backBtn.hidden = false;
    zoomTools.hidden = false;
    zoomLabel.textContent = '100 %';
    if (!inViewer) { try { history.pushState({ viewer: true }, ''); } catch (e) {} inViewer = true; }
    status('Otváram dokument…');
    saveRecent(file);
    const kind = kindOf(file.name), ext = extOf(file.name);
    try {
      if (kind === 'pdf') await renderPdf(file);
      else if (kind === 'doc') await renderWord(file, ext);
      else if (kind === 'xls') await renderSheet(file);
      else if (kind === 'ppt') await renderSlides(file, ext);
      else if (kind === 'img') renderImage(file);
      else await renderText(file, ext);
    } catch (err) {
      console.error(err);
      status('Tento súbor sa nepodarilo otvoriť. Môže byť poškodený, chránený heslom alebo v nepodporovanom formáte. (' + (err && err.message || err) + ')', true);
    }
  }

  /* ---------- PDF ---------- */
  async function renderPdf(file) {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data, isEvalSupported: false }).promise;
    cleanupFns.push(() => pdf.destroy());
    const stage = el('div', { class: 'stage' });
    const pages = el('div', { class: 'pages' });
    stage.append(pages);
    main.replaceChildren(stage);
    const first = await pdf.getPage(1);
    const baseVp = first.getViewport({ scale: 1 });
    const slots = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const box = el('div', { class: 'page', 'data-n': String(i) });
      pages.append(box, el('div', { class: 'page-num', text: i + ' / ' + pdf.numPages }));
      slots.push(box);
    }
    const rendered = new Map();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    function fitScale() {
      const avail = Math.max(200, stage.clientWidth - 24);
      return Math.min(avail / baseVp.width, 1.6) * zoom;
    }
    function layout() {
      const s = fitScale();
      slots.forEach((box) => {
        box.style.width = Math.floor(baseVp.width * s) + 'px';
        box.style.height = Math.floor(baseVp.height * s) + 'px';
      });
    }
    async function draw(box) {
      const n = +box.dataset.n, s = fitScale();
      if (rendered.get(n) === s) return;
      rendered.set(n, s);
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: s * dpr });
      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
      box.style.width = Math.floor(vp.width / dpr) + 'px';
      box.style.height = Math.floor(vp.height / dpr) + 'px';
      await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
      if (rendered.get(n) === s) box.replaceChildren(canvas);
    }
    layout();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) draw(e.target); });
    }, { root: main, rootMargin: '800px 0px' });
    slots.forEach((b) => io.observe(b));
    cleanupFns.push(() => io.disconnect());
    rerender = () => {
      rendered.clear(); layout();
      slots.forEach((b) => { io.unobserve(b); io.observe(b); });
    };
    const onResize = () => rerender && rerender();
    window.addEventListener('resize', onResize);
    cleanupFns.push(() => window.removeEventListener('resize', onResize));
  }

  /* ---------- Word ---------- */
  async function renderWord(file, ext) {
    if (ext !== 'docx') {
      const txt = await file.text();
      if (ext === 'rtf') return showText(rtfToText(txt));
      throw new Error('Formát .' + ext + ' nie je podporovaný. Ulož dokument ako .docx alebo .pdf.');
    }
    const result = await window.mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    const paper = el('div', { class: 'paper' });
    paper.innerHTML = result.value || '<p><em>Dokument je prázdny.</em></p>';
    paper.querySelectorAll('a[href]').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    showZoomable(paper);
  }
  function rtfToText(rtf) {
    return rtf.replace(/\\par[d]?/g, '\n').replace(/\{\*?\\[^{}]+\}|[{}]|\\[A-Za-z]+-?\d* ?/g, '').trim();
  }

  /* ---------- Excel / CSV ---------- */
  async function renderSheet(file) {
    const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const stage = el('div', { class: 'stage' });
    const tabs = el('div', { class: 'sheet-tabs', role: 'tablist' });
    const wrap = el('div', { class: 'sheet-wrap' });
    stage.append(tabs, wrap);
    main.replaceChildren(stage);
    let current = wb.SheetNames[0];
    function show(name) {
      current = name;
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.name === name)));
      const ws = wb.Sheets[name];
      wrap.innerHTML = ws && ws['!ref'] ? window.XLSX.utils.sheet_to_html(ws, { header: '', footer: '' }) : '<p style="padding:16px">Hárok je prázdny.</p>';
      wrap.style.zoom = zoom;
    }
    wb.SheetNames.forEach((name) => {
      const b = el('button', { class: 'sheet-tab', type: 'button', role: 'tab', text: name });
      b.dataset.name = name;
      b.addEventListener('click', () => show(name));
      tabs.append(b);
    });
    tabs.hidden = wb.SheetNames.length < 2;
    show(current);
    rerender = () => { wrap.style.zoom = zoom; };
  }

  /* ---------- PowerPoint ---------- */
  async function renderSlides(file, ext) {
    if (ext !== 'pptx') throw new Error('Formát .' + ext + ' nie je podporovaný. Ulož prezentáciu ako .pptx alebo .pdf.');
    const zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    const slideFiles = Object.keys(zip.files).filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
      .sort((a, b) => +a.match(/(\d+)\.xml$/)[1] - +b.match(/(\d+)\.xml$/)[1]);
    const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
    const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
    const parser = new DOMParser();
    const container = el('div', { class: 'slides' });
    const urls = [];
    for (let i = 0; i < slideFiles.length; i++) {
      const path = slideFiles[i];
      const doc = parser.parseFromString(await zip.file(path).async('string'), 'application/xml');
      const slide = el('div', { class: 'slide' });
      for (const sp of Array.from(doc.getElementsByTagNameNS(P, 'sp'))) {
        const ph = sp.getElementsByTagNameNS(P, 'ph')[0];
        const isTitle = ph && /title/i.test(ph.getAttribute('type') || '');
        for (const para of Array.from(sp.getElementsByTagNameNS(A, 'p'))) {
          const text = Array.from(para.getElementsByTagNameNS(A, 't')).map((t) => t.textContent).join('');
          if (!text.trim()) continue;
          slide.append(el(isTitle ? 'h2' : 'p', { text }));
        }
      }
      const relsPath = path.replace('slides/', 'slides/_rels/') + '.rels';
      const imgs = el('div', { class: 'slide-imgs' });
      if (zip.file(relsPath)) {
        const rels = parser.parseFromString(await zip.file(relsPath).async('string'), 'application/xml');
        for (const r of Array.from(rels.getElementsByTagName('Relationship'))) {
          if (!/\/image$/.test(r.getAttribute('Type') || '')) continue;
          const target = 'ppt/' + (r.getAttribute('Target') || '').replace(/^\.\.\//, '');
          const f = zip.file(target);
          if (!f || /\.(emf|wmf)$/i.test(target)) continue;
          const blob = new Blob([await f.async('uint8array')], { type: mimeFor(target) });
          const u = URL.createObjectURL(blob); urls.push(u);
          imgs.append(el('img', { src: u, alt: 'Obrázok zo snímky ' + (i + 1) }));
        }
      }
      if (imgs.children.length) slide.append(imgs);
      if (!slide.children.length) slide.append(el('p', { text: '(prázdna snímka)' }));
      container.append(slide, el('div', { class: 'page-num', text: 'Snímka ' + (i + 1) + ' / ' + slideFiles.length }));
    }
    cleanupFns.push(() => urls.forEach((u) => URL.revokeObjectURL(u)));
    if (!slideFiles.length) throw new Error('V prezentácii sa nenašli žiadne snímky.');
    showZoomable(container);
  }
  function mimeFor(p) {
    const e = extOf(p);
    return { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp' }[e] || 'application/octet-stream';
  }

  /* ---------- Images ---------- */
  function renderImage(file) {
    const u = URL.createObjectURL(file);
    cleanupFns.push(() => URL.revokeObjectURL(u));
    const img = el('img', { src: u, alt: file.name });
    img.onerror = () => status('Tento typ obrázka zariadenie nevie zobraziť.', true);
    const box = el('div', { class: 'stage img-view' }, img);
    main.replaceChildren(box);
    const apply = () => { img.style.width = zoom === 1 ? '' : Math.round(zoom * 100) + '%'; img.style.maxWidth = zoom > 1 ? 'none' : '100%'; };
    rerender = apply;
  }

  /* ---------- Text ---------- */
  async function renderText(file, ext) {
    let txt = await file.text();
    if (ext === 'json') { try { txt = JSON.stringify(JSON.parse(txt), null, 2); } catch (e) {} }
    showText(txt);
  }
  function showText(txt) {
    const pre = el('pre', { class: 'text-view', text: txt || '(prázdny súbor)' });
    showZoomable(pre);
  }

  function showZoomable(node) {
    const stage = el('div', { class: 'stage' }, node);
    main.replaceChildren(stage);
    main.scrollTop = 0;
    rerender = () => { node.style.zoom = zoom; };
  }

  /* ---------- Wiring ---------- */
  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (f) openFile(f);
    fileInput.value = '';
  });
  backBtn.addEventListener('click', () => {
    if (inViewer) { try { history.back(); return; } catch (e) {} }
    inViewer = false; showHome();
  });
  window.addEventListener('popstate', () => { if (inViewer) { inViewer = false; showHome(); } });
  $('#open-top').addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach((t) => document.addEventListener(t, (e) => {
    e.preventDefault(); const d = $('#drop'); if (d) d.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((t) => document.addEventListener(t, (e) => {
    e.preventDefault(); const d = $('#drop'); if (d) d.classList.remove('over');
  }));
  document.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) openFile(f);
  });

  function iconSvg(name) {
    const paths = {
      folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      x: '<path d="M18 6 6 18M6 6l12 12"/>',
    };
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    s.setAttribute('width', '20'); s.setAttribute('height', '20');
    s.style.cssText = 'stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round';
    s.innerHTML = paths[name];
    return s;
  }

  showHome();
})();
