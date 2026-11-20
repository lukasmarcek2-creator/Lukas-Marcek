/* All Document Reader – úprava PDF: prepisovanie textu priamo na strane, pridávanie textu a uloženie.
 *
 * Princíp: pôvodný riadok textu sa na strane prekryje farbou pozadia a na rovnaké miesto sa vpíše nový
 * text písmom s rovnakými rozmermi ako originál (Arimo ≈ Arial/Helvetica, Tinos ≈ Times, Cousine ≈ Courier).
 * Výsledok sa uloží pomocou knižnice pdf-lib ako nový PDF súbor.
 */
'use strict';

const PdfEdit = (() => {
  const FONT_FILES = { sans: 'Arimo', serif: 'Tinos', mono: 'Cousine' };
  const CSS_FAMILY = { sans: "'ADR Arimo', Arial, sans-serif", serif: "'ADR Tinos', 'Times New Roman', serif", mono: "'ADR Cousine', 'Courier New', monospace" };
  const fontUrl = (fam, b, i) => `vendor/fonts/${FONT_FILES[fam]}_${b ? '700Bold' : '400Regular'}${i ? '_Italic' : ''}.ttf`;

  const bar = document.getElementById('pdfEditBar');
  const editBtn = document.getElementById('pdfEditBtn');
  const q = id => document.getElementById(id);

  let ctx = null;          // { doc, pdf, bytes, pages }
  let on = false;
  let mode = 'edit';       // 'edit' | 'add'
  let edits = [];          // všetky upravené / pridané texty
  let current = null;      // práve upravovaný text
  let nextId = 1;
  const layers = new Map(); // číslo strany -> { layer, page, vp, lines }

  // ------------------------------------------------------------------ pripojenie k prehliadaču PDF
  function attach(info) {
    detach();
    ctx = info;
    editBtn.classList.remove('hidden');
  }
  function detach() {
    if (on) setOn(false);
    ctx = null; edits = []; current = null;
    layers.forEach(l => l.layer.remove());
    layers.clear();
    editBtn.classList.add('hidden');
    editBtn.classList.remove('active');
  }
  function hasChanges() { return edits.some(isChanged); }

  // Volá prehliadač po každom vykreslení strany (aj po zmene priblíženia).
  function pageDrawn(n) {
    if (!ctx) return;
    const l = layers.get(n);
    if (l) { ctx.pages[n - 1].appendChild(l.layer); refreshColors(n); }
    else if (on) buildLayer(n);
  }

  function setOn(value) {
    if (!ctx) return;
    on = value;
    document.body.classList.toggle('pdf-editing', on);
    bar.classList.toggle('hidden', !on);
    editBtn.classList.toggle('active', on);
    if (on) {
      setMode('edit');
      ctx.pages.forEach((p, i) => { if (p.querySelector('canvas')) buildLayer(i + 1); });
      toast('Ťukni na text v dokumente a prepíš ho');
    } else {
      deactivate();
    }
  }

  function setMode(m) {
    mode = m;
    q('peModeEdit').classList.toggle('active', m === 'edit');
    q('peModeAdd').classList.toggle('active', m === 'add');
    document.body.classList.toggle('pdf-adding', m === 'add');
  }

  // ------------------------------------------------------------------ rozpoznanie riadkov textu
  async function buildLayer(n) {
    if (layers.has(n) || !ctx) return;
    const myCtx = ctx;
    const page = await ctx.pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const layer = document.createElement('div');
    layer.className = 'pe-layer';
    const info = { layer, page, vp, lines: [] };
    layers.set(n, info);
    ctx.pages[n - 1].appendChild(layer);
    layer.addEventListener('click', e => onLayerClick(e, n));

    if (((page.rotate % 360) + 360) % 360 !== 0) { info.rotated = true; return; }
    const tc = await page.getTextContent();
    if (ctx !== myCtx) return;
    const items = tc.items.filter(it => it.str && it.transform &&
      Math.abs(it.transform[1]) < 1e-3 && Math.abs(it.transform[2]) < 1e-3 && it.transform[0] > 0 && it.transform[3] > 0);
    items.sort((a, b) => (Math.round(b.transform[5]) - Math.round(a.transform[5])) || (a.transform[4] - b.transform[4]));

    const lines = [];
    for (const it of items) {
      const size = it.transform[3], x = it.transform[4], y = it.transform[5], w = it.width;
      const last = lines[lines.length - 1];
      const gap = last ? x - last.x1 : 0;
      if (last && last.fontName === it.fontName && Math.abs(last.y - y) < size * 0.3 && gap < size * 1.2 && gap > -size * 0.5) {
        if (gap > size * 0.15 && !/\s$/.test(last.text) && !/^\s/.test(it.str)) last.text += ' ';
        last.text += it.str;
        last.x1 = Math.max(last.x1, x + w);
      } else {
        lines.push({ fontName: it.fontName, size, x, y, x1: x + w, text: it.str });
      }
    }
    for (const ln of lines) {
      ln.text = ln.text.replace(/\s+$/, '');
      if (!ln.text.trim()) continue;
      Object.assign(ln, fontInfo(page, ln.fontName, tc.styles));
      ln.n = n;
      ln.box = makeBox(info, ln.x, ln.y, ln.x1, ln.size);
      ln.box.classList.add('pe-line');
      ln.box.addEventListener('click', e => { e.stopPropagation(); if (mode === 'edit') activateLine(ln); else onLayerClick(e, n); });
      info.lines.push(ln);
    }
  }

  function fontInfo(page, fontName, styles) {
    let name = '', bold = false, italic = false, family = 'sans';
    try {
      const f = page.commonObjs.get(fontName);
      name = f.name || '';
      bold = !!(f.bold || f.black);
      italic = !!f.italic;
      if (f.isMonospace) family = 'mono'; else if (f.isSerifFont) family = 'serif';
    } catch (e) { /* písmo ešte nie je načítané */ }
    const generic = (styles[fontName] && styles[fontName].fontFamily) || '';
    const s = (name + ' ' + generic).toLowerCase();
    if (/mono|courier|consol/.test(s)) family = 'mono';
    else if (generic === 'serif' || /times|roman|georgia|garamond|cambria|minion|palatino|book antiqua|serif(?!-)/.test(name.toLowerCase())) family = 'serif';
    if (/bold|black|heavy|semibold|demi/.test(name.toLowerCase())) bold = true;
    if (/italic|oblique/.test(name.toLowerCase())) italic = true;
    return { family, bold, italic };
  }

  // Box umiestnený v percentách strany – pri priblížení sa posúva sám.
  function makeBox(info, x, y, x1, size) {
    const { vp, layer } = info;
    const [vx, vy] = vp.convertToViewportPoint(x, y);
    const [vx1] = vp.convertToViewportPoint(x1, y);
    const box = document.createElement('div');
    box.className = 'pe-box';
    box.style.left = (vx / vp.width * 100) + '%';
    box.style.top = ((vy - size * 0.97) / vp.height * 100) + '%';
    box.style.minWidth = (Math.max(4, vx1 - vx) / vp.width * 100) + '%';
    box.style.height = (size * 1.25 / vp.height * 100) + '%';
    box.style.setProperty('--fs', size);
    layer.appendChild(box);
    return box;
  }

  // ------------------------------------------------------------------ farby (pozadie a text) z vykreslenej strany
  function sampleColors(n, x, y, x1, size) {
    const info = layers.get(n);
    const canvas = ctx.pages[n - 1].querySelector('canvas');
    const res = { bg: [1, 1, 1], fg: [0, 0, 0] };
    if (!info || !canvas) return res;
    try {
      const { vp } = info;
      const s = canvas.width / vp.width;
      const [ax, ay] = vp.convertToViewportPoint(x, y + size * 0.95);
      const [bx, by] = vp.convertToViewportPoint(x1, y - size * 0.3);
      const X0 = Math.max(0, Math.floor(Math.min(ax, bx) * s) - 3), Y0 = Math.max(0, Math.floor(Math.min(ay, by) * s) - 3);
      const X1 = Math.min(canvas.width, Math.ceil(Math.max(ax, bx) * s) + 3), Y1 = Math.min(canvas.height, Math.ceil(Math.max(ay, by) * s) + 3);
      const W = X1 - X0, H = Y1 - Y0;
      if (W < 2 || H < 2) return res;
      const d = canvas.getContext('2d').getImageData(X0, Y0, W, H).data;
      const px = (i, j) => { const k = (j * W + i) * 4; return [d[k], d[k + 1], d[k + 2]]; };
      const counts = new Map();
      const add = c => { const key = c.map(v => v >> 3).join(','); const e = counts.get(key) || { n: 0, sum: [0, 0, 0] }; e.n++; e.sum[0] += c[0]; e.sum[1] += c[1]; e.sum[2] += c[2]; counts.set(key, e); };
      for (let i = 0; i < W; i++) { add(px(i, 0)); add(px(i, H - 1)); }
      for (let j = 0; j < H; j++) { add(px(0, j)); add(px(W - 1, j)); }
      let best = null;
      counts.forEach(e => { if (!best || e.n > best.n) best = e; });
      const bg = best.sum.map(v => v / best.n);
      let fg = null, far = 0;
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        const c = px(i, j); const dist = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
        if (dist > far) { far = dist; fg = c; }
      }
      res.bg = bg.map(v => v / 255);
      res.fg = fg && far > 90 ? fg.map(v => v / 255) : ((bg[0] + bg[1] + bg[2]) / 3 > 128 ? [0, 0, 0] : [1, 1, 1]);
    } catch (e) { /* ponechať predvolené farby */ }
    return res;
  }
  const css = c => `rgb(${c.map(v => Math.round(v * 255)).join(',')})`;
  const hex = c => '#' + c.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');

  function refreshColors(n) {
    edits.filter(e => e.n === n && e.kind === 'line' && !e.colorsFromCanvas).forEach(e => {
      if (!ctx.pages[n - 1].querySelector('canvas')) return;
      const c = sampleColors(n, e.x, e.y, e.x1, e.osize);
      e.bg = c.bg; if (!e.colorTouched) e.color = c.fg; e.colorsFromCanvas = true; paint(e);
    });
  }

  // ------------------------------------------------------------------ úpravy
  function activateLine(ln) {
    let e = edits.find(x => x.line === ln);
    if (!e) {
      const c = sampleColors(ln.n, ln.x, ln.y, ln.x1, ln.size);
      e = {
        id: nextId++, kind: 'line', line: ln, n: ln.n, box: ln.box,
        x: ln.x, y: ln.y, x1: ln.x1, osize: ln.size, size: ln.size,
        orig: ln.text, text: ln.text,
        family: ln.family, bold: ln.bold, italic: ln.italic,
        ofamily: ln.family, obold: ln.bold, oitalic: ln.italic,
        bg: c.bg, color: c.fg, ocolor: c.fg, colorsFromCanvas: !!ctx.pages[ln.n - 1].querySelector('canvas'),
      };
      edits.push(e);
    }
    activate(e);
  }

  function onLayerClick(ev, n) {
    if (mode !== 'add') return;
    const info = layers.get(n);
    if (!info || info.rotated) return toast('Na otočenú stranu zatiaľ nie je možné pridať text');
    const r = info.layer.getBoundingClientRect();
    const vx = (ev.clientX - r.left) / r.width * info.vp.width;
    const vy = (ev.clientY - r.top) / r.height * info.vp.height;
    const [x, y] = info.vp.convertToPdfPoint(vx, vy);
    const size = 12;
    const e = {
      id: nextId++, kind: 'new', n, x, y: y - size * 0.3, x1: x + size * 4, osize: size, size, orig: '', text: '',
      family: 'sans', bold: false, italic: false, bg: null, color: [0, 0, 0], colorTouched: true,
    };
    e.box = makeBox(info, e.x, e.y, e.x1, size);
    e.box.classList.add('pe-new');
    e.box.addEventListener('click', ev2 => { ev2.stopPropagation(); activate(e); });
    edits.push(e);
    setMode('edit');
    activate(e);
  }

  function activate(e) {
    if (current && current !== e) deactivate();
    current = e;
    const b = e.box;
    b.classList.add('pe-active');
    b.textContent = e.text;
    b.contentEditable = 'true';
    try { b.contentEditable = 'plaintext-only'; } catch (err) { /* staršie prehliadače */ }
    b.spellcheck = false;
    b.oninput = () => { e.text = b.innerText.replace(/\n/g, ' '); };
    b.onkeydown = ev => { if (ev.key === 'Enter') { ev.preventDefault(); deactivate(); } if (ev.key === 'Escape') { ev.preventDefault(); deactivate(); } };
    paint(e);
    b.focus();
    const range = document.createRange(); range.selectNodeContents(b); range.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    syncBar();
  }

  function deactivate() {
    const e = current;
    current = null;
    if (!e) return syncBar();
    e.box.contentEditable = 'false';
    e.box.classList.remove('pe-active');
    e.box.oninput = e.box.onkeydown = null;
    if (e.kind === 'new' && !e.text.trim()) {
      e.box.remove(); edits = edits.filter(x => x !== e);
    } else if (!isChanged(e)) {
      e.box.textContent = ''; e.box.classList.remove('pe-changed'); e.box.style.background = ''; e.box.style.color = '';
      edits = edits.filter(x => x !== e);
    } else paint(e);
    syncBar();
  }

  function isChanged(e) {
    if (e.kind === 'new') return !!e.text.trim();
    return e.text !== e.orig || e.size !== e.osize || e.family !== e.ofamily || e.bold !== e.obold || e.italic !== e.oitalic || (e.colorTouched && hex(e.color) !== hex(e.ocolor));
  }

  function paint(e) {
    const b = e.box;
    if (b !== document.activeElement || !b.isContentEditable) b.textContent = e.text;
    b.style.fontFamily = CSS_FAMILY[e.family];
    b.style.fontWeight = e.bold ? '700' : '400';
    b.style.fontStyle = e.italic ? 'italic' : 'normal';
    b.style.setProperty('--fs', e.size);
    b.style.color = css(e.color);
    b.style.background = e.bg ? css(e.bg) : 'transparent';
    b.classList.toggle('pe-changed', true);
  }

  function syncBar() {
    const e = current;
    ['peSmaller', 'peBigger', 'peBold', 'peItalic', 'peFamily', 'peColor', 'peDelete', 'peRevert'].forEach(id => (q(id).disabled = !e));
    q('peBold').classList.toggle('active', !!(e && e.bold));
    q('peItalic').classList.toggle('active', !!(e && e.italic));
    if (e) { q('peFamily').value = e.family; q('peColor').value = hex(e.color); q('peSizeLabel').textContent = Math.round(e.size * 10) / 10 + ' pt'; }
    else q('peSizeLabel').textContent = '';
    const count = edits.filter(isChanged).length;
    q('peSave').textContent = count ? `Uložiť (${count})` : 'Uložiť';
    q('peSave').disabled = !count && !current;
  }

  function change(fn) {
    if (!current) return;
    fn(current); paint(current); syncBar();
    current.box.focus();
  }

  // ------------------------------------------------------------------ uloženie
  async function buildPdf() {
    const { PDFDocument, rgb } = window.PDFLib;
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(ctx.bytes.slice(0), { updateMetadata: false });
    } catch (e) {
      if (/encrypt/i.test(e.message || '')) throw new Error('PDF je chránený heslom alebo zašifrovaný, preto ho nie je možné upraviť.');
      throw e;
    }
    pdfDoc.registerFontkit(window.fontkit);
    const fonts = {};
    const font = (f, b, i) => {
      const k = f + b + i;
      if (!fonts[k]) fonts[k] = fetch(fontUrl(f, b, i)).then(r => { if (!r.ok) throw new Error('Chýba písmo ' + fontUrl(f, b, i)); return r.arrayBuffer(); })
        .then(buf => pdfDoc.embedFont(buf, { subset: false }));
      return fonts[k];
    };
    for (const e of edits.filter(isChanged)) {
      const page = pdfDoc.getPage(e.n - 1);
      if (e.kind === 'line') {
        page.drawRectangle({ x: e.x - 1, y: e.y - e.osize * 0.28, width: (e.x1 - e.x) + 2, height: e.osize * 1.24, color: rgb(...e.bg), borderWidth: 0 });
      }
      const text = e.text.replace(/\s+$/, '');
      if (text) page.drawText(text, { x: e.x, y: e.y, size: e.size, font: await font(e.family, e.bold, e.italic), color: rgb(...e.color) });
    }
    return pdfDoc.save();
  }

  async function save() {
    if (current) deactivate();
    if (!hasChanges()) return toast('Zatiaľ nie sú žiadne zmeny');
    const doc = ctx.doc;
    const canOverwrite = !!(doc.handle && doc.handle.createWritable);
    q('peOverwrite').classList.toggle('hidden', !canOverwrite);
    const dlg = q('pdfSaveDialog');
    q('peSaveName').value = doc.name.replace(/\.pdf$/i, '') + ' (upravené).pdf';
    dlg.showModal();
    const choice = await new Promise(res => { dlg.onclose = () => res(dlg.returnValue); });
    if (choice !== 'copy' && choice !== 'overwrite') return;

    toast('Ukladám upravený PDF…', 10000);
    let bytes;
    try { bytes = await buildPdf(); } catch (e) { console.error(e); return toast('Uloženie zlyhalo: ' + (e.message || e), 6000); }
    const blob = new Blob([bytes], { type: 'application/pdf' });

    if (choice === 'overwrite') {
      try {
        if (!(await ensureWrite(doc.handle))) return toast('Bez povolenia zápisu nie je možné prepísať súbor');
        const w = await doc.handle.createWritable(); await w.write(blob); await w.close();
        const file = await doc.handle.getFile();
        Object.assign(doc, { file, size: file.size, modified: file.lastModified });
        edits = [];
        toast('Pôvodný súbor bol prepísaný');
        openDoc(doc);
      } catch (e) { console.error(e); toast('Prepísanie zlyhalo: ' + (e.message || e), 6000); }
      return;
    }

    let name = (q('peSaveName').value || 'upravené.pdf').trim().replace(/[\\/:*?"<>|]/g, '_');
    if (!/\.pdf$/i.test(name)) name += '.pdf';
    const file = new File([blob], name, { type: 'application/pdf', lastModified: Date.now() });
    const result = await saveFile(file);
    if (!result) return;
    const newDoc = makeDoc(file, result.path || name, result.handle || null);
    edits = [];
    addDocs([newDoc]);
    toast(result.message || 'Upravený PDF bol uložený', 5000);
    openDoc(newDoc);
  }

  return { attach, detach, pageDrawn, hasChanges, setOn: v => setOn(v), isOn: () => on, setMode, change, save, deactivate, revert, remove: removeCurrent };

  function revert() {
    if (!current) return;
    const e = current;
    Object.assign(e, { text: e.orig, size: e.osize, family: e.ofamily || e.family, bold: !!e.obold, italic: !!e.oitalic, colorTouched: false, color: e.ocolor || e.color });
    if (e.kind === 'new') { e.text = ''; }
    deactivate();
  }
  function removeCurrent() {
    if (!current) return;
    current.text = '';
    current.box.textContent = '';
    deactivate();
  }
})();

window.PdfEdit = PdfEdit;

// ---------------------------------------------------------------------------- uloženie súboru (web, počítač aj Android aplikácia)
async function saveFile(file) {
  const cap = window.Capacitor;
  if (cap && typeof cap.nativePromise === 'function' && (!cap.isNativePlatform || cap.isNativePlatform())) {
    const data = await blobToBase64(file);
    let uri, message;
    try {
      uri = (await cap.nativePromise('Filesystem', 'writeFile', { path: 'All Document Reader/' + file.name, data, directory: 'DOCUMENTS', recursive: true })).uri;
      message = 'Uložené do Dokumenty › All Document Reader';
    } catch (e) {
      uri = (await cap.nativePromise('Filesystem', 'writeFile', { path: file.name, data, directory: 'CACHE' })).uri;
      message = 'Upravený PDF je pripravený – ulož ho cez ponuku Zdieľať';
    }
    try { await cap.nativePromise('Share', 'share', { title: file.name, files: [uri], dialogTitle: 'Uložiť alebo poslať PDF' }); } catch (e) { /* zrušené */ }
    return { message, path: 'Dokumenty/All Document Reader/' + file.name };
  }
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: file.name, types: [{ description: 'PDF dokument', accept: { 'application/pdf': ['.pdf'] } }] });
      const w = await handle.createWritable(); await w.write(file); await w.close();
      return { handle, message: 'Upravený PDF bol uložený' };
    } catch (e) {
      if (e.name === 'AbortError') return null;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file); a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return { message: 'Upravený PDF bol stiahnutý do priečinka Stiahnuté súbory' };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

// ---------------------------------------------------------------------------- ovládacie prvky
document.getElementById('pdfEditBtn').onclick = () => PdfEdit.setOn(!PdfEdit.isOn());
document.getElementById('peModeEdit').onclick = () => PdfEdit.setMode('edit');
document.getElementById('peModeAdd').onclick = () => { PdfEdit.deactivate(); PdfEdit.setMode('add'); toast('Ťukni na miesto v dokumente, kam chceš pridať text'); };
document.getElementById('peDone').onclick = () => PdfEdit.setOn(false);
document.getElementById('peSave').onclick = () => PdfEdit.save();
document.getElementById('peRevert').onclick = () => PdfEdit.revert();
document.getElementById('peDelete').onclick = () => PdfEdit.remove();
document.getElementById('peSmaller').onclick = () => PdfEdit.change(e => (e.size = Math.max(4, Math.round((e.size - 0.5) * 10) / 10)));
document.getElementById('peBigger').onclick = () => PdfEdit.change(e => (e.size = Math.min(144, Math.round((e.size + 0.5) * 10) / 10)));
document.getElementById('peBold').onclick = () => PdfEdit.change(e => (e.bold = !e.bold));
document.getElementById('peItalic').onclick = () => PdfEdit.change(e => (e.italic = !e.italic));
document.getElementById('peFamily').onchange = ev => PdfEdit.change(e => (e.family = ev.target.value));
document.getElementById('peColor').oninput = ev => PdfEdit.change(e => { e.color = [1, 3, 5].map(i => parseInt(ev.target.value.slice(i, i + 2), 16) / 255); e.colorTouched = true; });
// Tlačidlá v lište nesmú zobrať fokus upravovanému textu.
document.querySelectorAll('#pdfEditBar button').forEach(b => b.addEventListener('mousedown', ev => ev.preventDefault()));
