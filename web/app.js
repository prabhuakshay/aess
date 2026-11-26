import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULTS, STD, SYSTEMS, TYPES, resolveSpec, grams, metres, printMinutes, placements, floorLoadKg, hostSpec, defaultQty, printSettings } from './aess-core.js';
import { make3MF, makeSTL, makeZip } from './aess-export.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const PREVIEW_SEGMENTS = 6;
const EXPORT_SEGMENTS = 16;
const IN = 25.4;

// ---------- persistence (browser storage is a convenience; everything works without it) ----------
const store = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } },
};
const prefs = { theme: 'auto', currency: '₹', price: 1200, density: 1.24, ...store.get('aess-prefs', {}) };
const savePrefs = () => store.set('aess-prefs', prefs);

// ---------- state ----------
const KEYS = Object.keys(DEFAULTS);
let state = { ...DEFAULTS, ...store.get('aess-last', {}), ...readHash() };
let plate = store.get('aess-plate', []);
const library = store.get('aess-library', []);

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const out = {};
  for (const k of KEYS) {
    if (!p.has(k)) continue;
    const raw = p.get(k);
    const d = DEFAULTS[k];
    out[k] = typeof d === 'number' ? Number(raw) : typeof d === 'boolean' ? raw === '1' : d === null ? (raw === '' ? null : Number(raw)) : raw;
  }
  return out;
}
function writeHash() {
  const p = new URLSearchParams();
  for (const k of KEYS) {
    const v = state[k];
    if (v === DEFAULTS[k]) continue;
    p.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : v ?? '');
  }
  history.replaceState(null, '', p.toString() ? `#${p}` : location.pathname);
  store.set('aess-last', state);
}

// undo / redo
const past = [], future = [];
let lastPush = 0;
function remember(prev) {
  const now = Date.now();
  if (now - lastPush > 600 || !past.length) past.push(prev);
  lastPush = now;
  if (past.length > 100) past.shift();
  future.length = 0;
}
function undo() { if (!past.length) return; future.push({ ...state }); state = past.pop(); lastPush = 0; refresh(); }
function redo() { if (!future.length) return; past.push({ ...state }); state = future.pop(); lastPush = 0; refresh(); }

function set(patch, { record = true } = {}) {
  const next = { ...state, ...patch };
  if (KEYS.every((k) => next[k] === state[k])) return;
  if (record) remember({ ...state });
  state = next;
  refresh();
}

// ---------- units ----------
const imperial = () => state.system === 'imperial';
const toU = (mm) => (imperial() ? mm / IN : mm);
const len = (mm, dp) => (imperial() ? `${+(mm / IN).toFixed(dp ?? 2)}″` : `${+mm.toFixed(dp ?? 1)} mm`);
const fracIn = (mm) => {
  const q = Math.round((mm / IN) * 4);
  const whole = Math.floor(q / 4), part = ['', '¼', '½', '¾'][q % 4];
  return Math.abs(mm / IN - q / 4) < 1e-6 ? `${whole || !part ? whole : ''}${part}″` : `${+(mm / IN).toFixed(3)}″`;
};
const dims = (sp) => {
  const f = (v) => (imperial() ? +(v / IN).toFixed(2) : +v.toFixed(1));
  return `${f(sp.W)} × ${f(sp.D)}${sp.type === 'lid' ? '' : ` × ${f(sp.H)}`} ${imperial() ? 'in' : 'mm'}`;
};

// ---------- worker ----------
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let reqId = 0;
const pending = new Map();
worker.onmessage = ({ data }) => {
  const cb = pending.get(data.id);
  if (!cb) return;
  pending.delete(data.id);
  data.ok ? cb.resolve(data) : cb.reject(new Error(data.error));
};
worker.onerror = (e) => showStatus(`Geometry engine failed to load (${e.message || 'network error'}). Check your connection and reload.`);
function build(spec, segments, orient = 'print') {
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, spec, segments, orient });
  });
}
const lidSpecOf = (s) => ({ ...s, type: 'lid' });

// ---------- three.js viewer ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.localClippingEnabled = true;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 8000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.autoRotateSpeed = 1.2;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8178, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-160, -220, 320);
scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.5);
fill.position.set(200, 160, 120);
scene.add(fill);

const clip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
const mat = (color, opacity = 1) => new THREE.MeshStandardMaterial({
  color, roughness: 0.55, metalness: 0.02, side: THREE.DoubleSide, transparent: opacity < 1, opacity,
});
const partMat = mat(0xf59e0b), ghostMat = mat(0xf59e0b, 0.32), lidMat = mat(0x78716c, 0.92), hostMat = mat(0xa8a29e, 0.22);
hostMat.depthWrite = false;
const group = new THREE.Group();
scene.add(group);
let grid;
const isDark = () => document.documentElement.dataset.theme === 'dark'
  || (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

function makeGrid(sp) {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  const U = sp.sizeMode === 'grid' ? sp.U : 10;
  const cells = Math.ceil(Math.max(sp.W, sp.D) / U) + 6;
  grid = new THREE.GridHelper(cells * U, cells, isDark() ? 0x4a443e : 0xb9b2a8, isDark() ? 0x2e2a26 : 0xd3cdc4);
  grid.rotation.x = Math.PI / 2;
  grid.position.set(sp.sizeMode === 'grid' && (sp.nx + cells) % 2 ? U / 2 : 0, sp.sizeMode === 'grid' && (sp.ny + cells) % 2 ? U / 2 : 0, -0.01);
  scene.add(grid);
}

function geometryOf(res) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(res.positions.slice(), 3));
  geo.setIndex(new THREE.BufferAttribute(res.indices.slice(), 1));
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  return flat;
}

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

let current = null, currentLid = null, currentHost = null, framedFor = '';
const isBin = (t) => t === 'hopper' || t === 'box';
const hosted = (t) => t === 'lid' || TYPES[t]?.group === 'insert';
function draw() {
  group.children.forEach((m) => m.geometry.dispose());
  group.clear();
  if (!current) return;
  const sp = current.spec;
  const stack = $('stackToggle').checked && (isBin(sp.type) || sp.type === 'cabinet') ? 3 : 1;
  const geo = geometryOf(current);
  const pitch = sp.H - STD.lip - STD.fit;
  const showLid = ((sp.type === 'box' && sp.rails) || sp.type === 'cabinet') && $('lidToggle').checked && currentLid;
  const lidGeo = showLid ? geometryOf(currentLid) : null;
  const showHost = hosted(sp.type) && $('lidToggle').checked && currentHost;
  const place = showHost ? placements(sp) : null;
  if (showHost) {
    // the insert or lid where it sits, inside a see-through box
    group.add(new THREE.Mesh(geometryOf(currentHost), hostMat));
    for (const [x, y, z] of place) {
      const m = new THREE.Mesh(geo, partMat);
      m.position.set(x, y, z);
      group.add(m);
    }
  } else {
    for (let k = 0; k < stack; k++) {
      const m = new THREE.Mesh(geo, k === 0 ? partMat : ghostMat);
      m.position.z = k * pitch;
      group.add(m);
      if (lidGeo) {
        for (const z of sp.type === 'cabinet' ? sp.ledges : [sp.zs]) {
          const l = new THREE.Mesh(lidGeo, k === 0 ? lidMat : ghostMat);
          l.position.z = k * pitch + z;
          group.add(l);
        }
      }
    }
  }
  applyClip();
  makeGrid(sp);
  const fk = `${sp.type}${showHost}x${sp.pW}x${sp.pD}x${sp.pH}x${stack}`;
  if (fk !== framedFor) { frame(sp, stack, showHost); framedFor = fk; }
}

function frame(sp, stack = 1, inHost = false) {
  const H = inHost ? sp.H : sp.pH, W = inHost ? sp.W : sp.pW, D = inHost ? sp.D : sp.pD;
  const h = H + (stack - 1) * (sp.H - STD.lip - STD.fit);
  const size = Math.max(W, D, h);
  const target = new THREE.Vector3(0, 0, h * 0.42);
  const dist = size * 2.6 + 60;
  camera.position.set(target.x - dist * 0.55, target.y - dist * 0.75, target.z + dist * 0.55);
  controls.target.copy(target);
  controls.update();
}

function applyClip() {
  const on = $('sectionToggle').checked;
  $('sectionPos').hidden = !on;
  const w = current ? current.spec.W : 100;
  clip.constant = (Number($('sectionPos').value) / 100) * (w / 2);
  for (const m of [partMat, ghostMat, lidMat, hostMat]) { m.clippingPlanes = on ? [clip] : []; m.needsUpdate = true; }
}

(function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();

// ---------- tooltips ----------
const tooltip = $('tooltip');
let tipTarget = null;
function showTip(el) {
  const text = el.dataset.tip;
  if (!text) return;
  tipTarget = el;
  tooltip.textContent = text;
  tooltip.hidden = false;
  const r = el.getBoundingClientRect();
  const tw = tooltip.offsetWidth, th = tooltip.offsetHeight;
  let x = r.left + r.width / 2 - tw / 2;
  x = Math.max(8, Math.min(innerWidth - tw - 8, x));
  let y = r.top - th - 8;
  if (y < 8) y = r.bottom + 8;
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}
function hideTip() { tooltip.hidden = true; tipTarget = null; }
document.addEventListener('pointerover', (e) => {
  const el = e.target.closest('[data-tip]');
  if (el && e.pointerType !== 'touch') showTip(el); else if (!el) hideTip();
});
document.addEventListener('focusin', (e) => { const el = e.target.closest('.tip'); if (el) showTip(el); });
document.addEventListener('focusout', hideTip);
document.addEventListener('click', (e) => {
  const tip = e.target.closest('.tip');
  if (tip) { e.preventDefault(); e.stopPropagation(); tipTarget === tip ? hideTip() : showTip(tip); }
  else if (tipTarget) hideTip();
}, true);
addEventListener('scroll', hideTip, true);

// ---------- controls ----------
const fpGrid = $('fpGrid');
for (let row = 5; row >= 0; row--) {
  for (let col = 0; col < 6; col++) {
    const b = Object.assign(document.createElement('button'), { type: 'button', className: 'fp-cell' });
    b.dataset.x = col + 1; b.dataset.y = row + 1;
    b.setAttribute('aria-label', `${col + 1} × ${row + 1}`);
    fpGrid.append(b);
  }
}
fpGrid.addEventListener('pointerover', (e) => {
  const c = e.target.closest('.fp-cell');
  if (c) for (const cell of fpGrid.children) cell.classList.toggle('hover', +cell.dataset.x <= +c.dataset.x && +cell.dataset.y <= +c.dataset.y);
});
fpGrid.addEventListener('pointerleave', () => { for (const cell of fpGrid.children) cell.classList.remove('hover'); });
fpGrid.addEventListener('click', (e) => { const c = e.target.closest('.fp-cell'); if (c) set({ nx: +c.dataset.x, ny: +c.dataset.y }); });
$$('[data-step]').forEach((b) => b.addEventListener('click', () => {
  const [k, d] = b.dataset.step.split(':');
  set({ [k]: Math.max(0, (Number(state[k]) || 0) + Number(d)) });
}));

const bindSeg = (sel, attr, key, cast = (v) => v) => $$(`${sel} button`).forEach((b) => b.addEventListener('click', () => set({ [key]: cast(b.dataset[attr]) })));
const pickType = (type) => set(type === 'tray' && !state.trayDepth ? { type, trayDepth: resolveSpec({ ...state, type }).trayDepth } : { type });
$$('.typecard').forEach((b) => b.addEventListener('click', () => pickType(b.dataset.type)));
bindSeg('#modeSeg', 'mode', 'sizeMode');
bindSeg('#wallSeg', 'wall', 'wall');
bindSeg('#patternSeg', 'pattern', 'pattern');
bindSeg('#lidPatternSeg', 'lidpattern', 'lidPattern');
bindSeg('#textSeg', 'text', 'textStyle');
bindSeg('#snapSeg', 'snap', 'lidSnap', Number);
bindSeg('#pullSeg', 'pull', 'lidPull');
bindSeg('#ribSeg', 'ribs', 'floorRibs');
bindSeg('#lidStyleSeg', 'lidstyle', 'lidStyle');
bindSeg('#tapeSeg', 'tape', 'labelTape', Number);
bindSeg('#holderSeg', 'holder', 'holderMode');
bindSeg('#padsSeg', 'pads', 'basePads');
bindSeg('#drawerPullSeg', 'dpull', 'drawerPull');
bindSeg('#spoutSeg', 'spout', 'spout');
$('countLines').addEventListener('change', (e) => set({ countLines: e.target.checked }));

const bindRange = (id, key, cast = Number) => $(id).addEventListener('input', (e) => set({ [key]: cast(e.target.value) }));
bindRange('nh', 'nh');
bindRange('floor', 'floor');
bindRange('hole', 'hole');
bindRange('bar', 'bar');
bindRange('scoop', 'scoop');
bindRange('front', 'frontRatio', (v) => Number(v) / 100);
bindRange('sideSlope', 'sideSlope', (v) => Number(v) / 100);
for (const k of ['ribH', 'gusset', 'trayDepth', 'dispHole', 'holderH', 'gridHole', 'gridPitch', 'caddyH', 'trayWall']) bindRange(k, k);
for (const k of ['grips', 'gauge', 'wallRibs']) $(k).addEventListener('change', (e) => set({ [k]: e.target.checked }));
$('chamfer').addEventListener('change', (e) => set({ chamfer: e.target.checked ? 0.4 : 0 }));
$('rails').addEventListener('change', (e) => set({ lidRails: e.target.checked }));
$('lidBrand').addEventListener('change', (e) => set({ lidBrand: e.target.checked }));
let textTimer;
for (const [id, key] of [['brandIn', 'brand'], ['labelIn', 'label']]) {
  $(id).addEventListener('input', (e) => { clearTimeout(textTimer); const v = e.target.value; textTimer = setTimeout(() => set({ [key]: v }), 250); });
}
// grid and height step: presets per system, or a custom value (1 mm or 1/4 in steps)
const snapLen = (v) => (imperial() ? (Math.round(v * 4) / 4) * IN : Math.round(v));
for (const [sel, custom, key] of [['gridSel', 'gridCustom', 'U'], ['huSel', 'huCustom', 'hu']]) {
  $(sel).addEventListener('change', (e) => {
    const v = e.target.value;
    $(custom).hidden = v !== 'custom';
    if (v !== 'custom') set({ [key]: Number(v) });
    else $(custom).focus();
  });
  $(custom).addEventListener('change', (e) => { const mm = snapLen(Number(e.target.value)); if (mm > 0) set({ [key]: mm }); });
}
for (const [id, key] of [['cW', 'W'], ['cD', 'D'], ['cH', 'H']]) {
  $(id).addEventListener('change', (e) => { const mm = snapLen(Number(e.target.value)); if (mm > 0) set({ [key]: mm }); });
}
// switching units switches the whole base-unit system; exact sizes are rounded to 1 mm or 1/4 in
$$('.unitswitch button').forEach((b) => b.addEventListener('click', () => {
  const system = b.dataset.units === 'in' ? 'imperial' : 'metric';
  if (system === state.system) return;
  const round = (mm) => (system === 'imperial' ? (Math.max(1, Math.round((mm / IN) * 4)) / 4) * IN : Math.round(mm));
  set({ system, U: SYSTEMS[system].U, hu: SYSTEMS[system].hu, W: round(state.W), D: round(state.D), H: round(state.H) });
  renderPlate();
}));

$('lidToggle').addEventListener('change', draw);
$('stackToggle').addEventListener('change', () => { framedFor = ''; draw(); });
$('sectionToggle').addEventListener('change', applyClip);
$('sectionPos').addEventListener('input', applyClip);
$('spinToggle').addEventListener('change', (e) => { controls.autoRotate = e.target.checked; });
$('resetView').addEventListener('click', () => current && frame(current.spec, $('stackToggle').checked ? 3 : 1));
$('shotBtn').addEventListener('click', () => {
  renderer.render(scene, camera);
  canvas.toBlob((b) => download(b, `${current?.spec.name ?? 'aess'}.png`, 'image/png'));
});
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('resetAll').addEventListener('click', () => set({ ...DEFAULTS }));

// theme
function applyTheme() {
  if (prefs.theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = prefs.theme;
}
$('themeBtn').addEventListener('click', () => {
  prefs.theme = isDark() ? 'light' : 'dark';
  savePrefs(); applyTheme(); if (current) makeGrid(current.spec);
});
applyTheme();

// settings dialog
$('settingsBtn').addEventListener('click', () => {
  $('setCurrency').value = prefs.currency; $('setPrice').value = prefs.price; $('setMaterial').value = String(prefs.density);
  $('settings').showModal();
});
$('settings').addEventListener('close', () => {
  prefs.currency = $('setCurrency').value || '₹';
  prefs.price = Number($('setPrice').value) || 0;
  prefs.density = Number($('setMaterial').value) || 1.24;
  savePrefs(); renderStats(); renderPlate();
});
$('aboutBtn').addEventListener('click', () => $('about').showModal());

// keyboard
document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName) && document.activeElement.type !== 'range' && document.activeElement.type !== 'checkbox';
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); $('dl3mf').click(); return; }
  if (typing || mod || e.altKey) return;
  const typeKeys = ['hopper', 'box', 'lid', 'cup', 'tray', 'holder', 'base', 'caddy', 'counter'];
  if (/^[1-9]$/.test(e.key)) pickType(typeKeys[Number(e.key) - 1]);
  else if (e.key.toLowerCase() === 'l') { $('lidToggle').checked = !$('lidToggle').checked; draw(); }
  else if (e.key.toLowerCase() === 'x') { $('sectionToggle').checked = !$('sectionToggle').checked; applyClip(); }
});

// ---------- render controls ----------
const checked = (sel, pred) => $$(sel).forEach((b) => b.setAttribute('aria-checked', String(pred(b))));
function refresh() {
  const sp = resolveSpec(state);
  // keep the state normalised without losing the user's other choices
  if (sp.sizeMode === 'grid') Object.assign(state, { nx: sp.nx, ny: sp.ny, ...(sp.type !== 'lid' ? { nh: sp.nh } : {}) });
  const t = sp.type, isLid = t === 'lid', isGrid = sp.sizeMode === 'grid';
  const bin = isBin(t), insert = TYPES[t].group === 'insert', noHeight = isLid || t === 'base' || t === 'caddy' || t === 'counter';
  const cab = t === 'cabinet' || t === 'drawer';
  const sec = (name, show) => { $('panel').querySelector(`[data-sec="${name}"]`).hidden = !show; };

  checked('.typecard', (b) => b.dataset.type === t);
  checked('#modeSeg button', (b) => b.dataset.mode === sp.sizeMode);
  checked('#wallSeg button', (b) => b.dataset.wall === state.wall);
  checked('#patternSeg button', (b) => b.dataset.pattern === sp.pattern);
  checked('#lidPatternSeg button', (b) => b.dataset.lidpattern === sp.lidPattern);
  checked('#textSeg button', (b) => b.dataset.text === sp.textStyle);
  checked('#snapSeg button', (b) => Math.abs(Number(b.dataset.snap) - sp.lidSnap) < 1e-9);
  checked('#pullSeg button', (b) => b.dataset.pull === sp.lidPull);
  checked('.unitswitch button', (b) => b.dataset.units === (imperial() ? 'in' : 'mm'));
  checked('#ribSeg button', (b) => b.dataset.ribs === sp.floorRibs);
  checked('#lidStyleSeg button', (b) => b.dataset.lidstyle === sp.lidStyle);
  checked('#tapeSeg button', (b) => Number(b.dataset.tape) === sp.labelTape);
  checked('#holderSeg button', (b) => b.dataset.holder === sp.holderMode);
  checked('#padsSeg button', (b) => b.dataset.pads === sp.basePads);
  checked('#drawerPullSeg button', (b) => b.dataset.dpull === sp.drawerPull);
  checked('#spoutSeg button', (b) => b.dataset.spout === sp.spout);

  $('gridBox').hidden = !isGrid;
  $('customBox').hidden = isGrid;
  for (const cell of fpGrid.children) cell.classList.toggle('on', isGrid && +cell.dataset.x <= sp.nx && +cell.dataset.y <= sp.ny);
  $('nxOut').textContent = sp.nx ?? '–';
  $('nyOut').textContent = sp.ny ?? '–';
  $('nhOut').textContent = sp.nh ?? '–';
  $('nhRow').hidden = noHeight;
  $('nhField').hidden = noHeight;
  $('huSel').closest('.field').hidden = noHeight;
  $('fpGrid').closest('.fp-wrap').hidden = t === 'caddy';
  const hostDesc = `${isGrid ? `${sp.nx}×${sp.ny}×${sp.nh}` : dims(sp)} box, ${state.wall === 'lite' ? 'Lite' : state.wall === 'heavy' ? 'Heavy' : typeof state.wall === 'number' ? `${state.wall} mm` : 'Standard'} walls`;
  const note = {
    lid: `Fits any box with this footprint. Print it with the same lid-snap setting as the box.`,
    cup: `Sized for the ${hostDesc} below, including its floor ribs and gussets. Print that box with the same settings.`,
    tray: `Rests on a ledge ${len(sp.trayDepth)} below the lid line of the ${hostDesc} below. The box needs that tray ledge: use “+ Add the box”.`,
    holder: `Sized for the ${hostDesc} below. Prints upside down (deck on the bed).`,
    base: `The footprint below is one stack; the base holds ${sp.baseCols * sp.baseRows}.`,
    caddy: `Wells take 1 × 1 bins of the grid below.`,
    drawer: `Sized for the ${isGrid ? `${sp.nx}×${sp.ny}×${sp.nh}` : dims(sp)} cabinet below with ${sp.cabRows} drawers. Print that cabinet with the same settings.`,
    counter: `The footprint below sets the tray's size; the spout adds 24 mm at the front.`,
  }[t];
  $('hostNote').hidden = !note;
  $('hostNote').textContent = note ?? '';
  const sys = SYSTEMS[sp.system];
  const fillSel = (sel, custom, values, cur, label) => {
    const el = $(sel);
    if (el.dataset.sys !== sp.system) {
      el.innerHTML = values.map((v) => `<option value="${v}">${label(v)}</option>`).join('') + '<option value="custom">Custom…</option>';
      el.dataset.sys = sp.system;
    }
    const hit = values.find((v) => Math.abs(v - cur) < 1e-6);
    el.value = hit != null ? String(hit) : 'custom';
    const c = $(custom);
    c.hidden = hit != null;
    c.step = imperial() ? '0.25' : '1';
    c.min = imperial() ? '0.25' : '1';
    if (hit == null && document.activeElement !== c) c.value = +toU(cur).toFixed(3);
  };
  fillSel('gridSel', 'gridCustom', sys.grids, sp.U, (v) => (imperial() ? fracIn(v) : `${v} mm${v === 42 ? ' (Gridfinity)' : ''}`));
  fillSel('huSel', 'huCustom', sys.steps, sp.hu, (v) => (imperial() ? fracIn(v) : `${v} mm${v === 7 ? ' (Gridfinity)' : ''}`));
  $('nh').max = Math.max(2, Math.floor((STD.bed - STD.lip - STD.fit) / sp.hu));
  $('nh').value = sp.nh ?? 7;
  $('hReadout').textContent = isGrid ? `${sp.nh} · ${len(sp.H)}` : '';
  $$('.dims .unit').forEach((u) => { u.textContent = imperial() ? 'in' : 'mm'; });
  for (const [id, key] of [['cW', 'W'], ['cD', 'D'], ['cH', 'H']]) {
    const el = $(id);
    el.step = imperial() ? '0.25' : '1';
    if (document.activeElement !== el) el.value = +toU(sp[key]).toFixed(imperial() ? 3 : 1);
  }
  $('cHRow').hidden = noHeight;
  $('sizeReadout').textContent = isGrid ? `${sp.nx} × ${sp.ny}${noHeight ? '' : ` × ${sp.nh}`} · ${dims(sp)}` : dims(sp);

  // walls / inside / front sections only matter for bins
  sec('walls', bin || insert || t === 'cabinet');
  sec('strength', bin || t === 'cup' || t === 'holder');
  sec('inside', bin || t === 'tray' || t === 'drawer');
  sec('front', bin || isLid || t === 'drawer');
  sec('cabinet', cab);
  sec('counter', t === 'counter');
  sec('cups', t === 'cup');
  sec('holder', t === 'holder');
  sec('base', t === 'base');
  sec('caddy', t === 'caddy');
  $('patternSeg').closest('.field').hidden = !bin;
  $('gripsRow').hidden = !bin;
  $('gaugeRow').hidden = !bin;
  $('grips').checked = sp.grips;
  $('gauge').checked = sp.gauge;
  $('scoop').closest('.field').hidden = !bin;
  $('trayField').hidden = t !== 'box';
  $('trayDepth').value = sp.trayDepth;
  $('trayReadout').textContent = sp.trayDepth ? len(sp.trayDepth) : 'none';
  $('ribH').value = sp.ribH;
  $('ribHField').hidden = sp.floorRibs === 'none';
  $('ribHReadout').textContent = len(sp.ribH);
  $('gusset').value = sp.gusset;
  $('gussetReadout').textContent = sp.gusset ? len(sp.gusset) : 'off';
  $('wallRibs').checked = !!state.wallRibs;
  $('wallRibs').disabled = sp.pattern !== 'none';
  $('strengthReadout').textContent = [sp.floorRibs !== 'none' ? `${sp.floorRibs} ribs` : '', sp.gusset ? 'gussets' : '', sp.wallRibs ? 'wall ribs' : ''].filter(Boolean).join(' · ');
  $('slopeField').hidden = t !== 'hopper';
  $('sideSlope').value = Math.round(sp.sideSlope * 100);
  $('slopeReadout').textContent = sp.sideSlope ? `${Math.round(sp.sideSlope * 100)}% of depth` : 'off';
  $('lidStyleField').hidden = !isLid;
  $('dispField').hidden = !(isLid && sp.lidStyle === 'dispenser');
  $('dispHole').value = sp.dispHole;
  $('dispReadout').textContent = len(sp.dispHole);
  $('tapeField').hidden = !(isLid && sp.lidStyle === 'label');
  $('cupsXOut').textContent = sp.cupsX;
  $('cupsYOut').textContent = sp.cupsY;
  $('cupsReadout').textContent = `${sp.cupsX * sp.cupsY} cups`;
  $('holderH').value = sp.holderH;
  $('holderHReadout').textContent = sp.holderH ? len(sp.holderH) : 'auto';
  $('gridHoleOpts').hidden = sp.holderMode !== 'grid';
  $('gridHole').value = sp.gridHole; $('gridHoleReadout').textContent = len(sp.gridHole);
  $('gridPitch').value = sp.gridPitch; $('gridPitchReadout').textContent = len(sp.gridPitch);
  $('holderReadout').textContent = { drill: 'drill index', hex: '¼″ hex bits', grid: 'tool grid' }[sp.holderMode];
  $('baseColsOut').textContent = sp.baseCols;
  $('baseRowsOut').textContent = sp.baseRows;
  $('baseReadout').textContent = `${sp.baseCols * sp.baseRows} stack${sp.baseCols * sp.baseRows > 1 ? 's' : ''}`;
  $('caddyColsOut').textContent = sp.caddyCols;
  $('caddyRowsOut').textContent = sp.caddyRows;
  $('caddyH').value = sp.caddyH; $('caddyHReadout').textContent = len(sp.caddyH);
  $('caddyReadout').textContent = `${sp.caddyCols * sp.caddyRows} wells`;
  $('cabRowsOut').textContent = sp.cabRows;
  $('cabReadout').textContent = cab ? `${sp.cabRows} × ${len(sp.drawerH)} tall` : '';
  $('cabHint').textContent = cab ? `Each drawer: ${len(sp.drawerW)} × ${len(sp.drawerD)} × ${len(sp.drawerH)} (outside).` : '';
  $('trayWall').value = sp.trayWall; $('trayWallReadout').textContent = len(sp.trayWall);
  $('countLines').checked = sp.countLines;
  $('statLoadBox').hidden = !bin;
  const ps = printSettings(state);
  const preset = !bin ? (t === 'base' ? 'Standard @BBL A1 (15% infill)' : 'AESS Lite') : ps.wall_loops <= 2 ? 'AESS Lite' : ps.wall_loops === 3 ? 'AESS Standard' : 'AESS Heavy';
  $('printHint').textContent = `Print with: ${preset} preset${t === 'holder' ? ', deck down (as exported)' : ''} · ${ps.wall_loops} walls, ${ps.sparse_infill_density} infill.`;
  $('floor').value = sp.floor;
  $('floorReadout').textContent = len(sp.floor, 2);
  $('wallsReadout').textContent = `${len(sp.wall, 2)}${sp.pattern !== 'none' ? ` · ${sp.pattern}` : ''}`;
  $('patternOpts').hidden = sp.pattern === 'none' && sp.lidPattern === 'none';
  $('hole').value = sp.hole; $('holeReadout').textContent = len(sp.hole);
  $('bar').value = sp.bar; $('barReadout').textContent = len(sp.bar);
  $('chamfer').checked = sp.chamfer > 0;
  $('divXOut').textContent = sp.divX;
  $('divYOut').textContent = sp.divY;
  $('scoop').value = sp.scoop;
  $('scoopReadout').textContent = sp.scoop ? len(sp.scoop) : 'off';
  $('insideReadout').textContent = [sp.divX || sp.divY ? `${(sp.divX + 1) * (sp.divY + 1)} compartments` : '', sp.scoop ? 'scoop' : ''].filter(Boolean).join(' · ');

  $('frontField').hidden = t !== 'hopper';
  $('front').value = Math.round(sp.frontRatio * 100);
  $('frontReadout').textContent = `${Math.round(sp.frontRatio * 100)}% · ${len(sp.frontH)}`;
  if (document.activeElement !== $('brandIn')) $('brandIn').value = state.brand;
  if (document.activeElement !== $('labelIn')) $('labelIn').value = state.label;

  $('lidSec').hidden = !(t === 'box' || isLid);
  $('railsRow').hidden = t !== 'box';
  $('rails').checked = state.lidRails !== false;
  $('lidPatternField').hidden = !isLid;
  $('lidPullField').hidden = t === 'hopper';
  $('lidBrandRow').hidden = !isLid;
  $('lidBrand').checked = sp.lidBrand;
  $('lidToggleWrap').hidden = !((t === 'box' && sp.rails) || hosted(t) || t === 'cabinet');
  $('lidToggleWrap').querySelector('span').textContent = t === 'drawer' ? 'Cabinet' : hosted(t) ? 'Box' : t === 'cabinet' ? 'Drawers' : 'Lid';
  $('lidToggleWrap').dataset.tip = hosted(t) ? 'Show the box this part fits, see-through.' : 'Show the slide lid in place on this box.';
  $('addLid').hidden = !((t === 'box' && sp.rails) || hosted(t) || t === 'cabinet');
  $('addLid').textContent = t === 'drawer' ? '+ Add the cabinet' : hosted(t) ? '+ Add the box' : t === 'cabinet' ? '+ Add its drawers' : '+ Add its lid';
  $('hudDims').title = '';
  $('undoBtn').disabled = !past.length;
  $('redoBtn').disabled = !future.length;

  $('hudName').textContent = sp.name;
  const forBox = `for a ${isGrid ? `${sp.nx}×${sp.ny}${isLid ? '' : `×${sp.nh}`}` : dims(sp)} ${t === 'drawer' ? 'cabinet' : 'box'}`;
  $('hudDims').textContent = bin ? dims(sp) : insert ? forBox : `${dims({ ...sp, W: sp.pW, D: sp.pD, H: sp.pH, type: 'x' })}${isLid ? ` · ${forBox}` : ''}`;
  $('hudWarn').replaceChildren(...sp.warnings.map((w) => Object.assign(document.createElement('li'), { textContent: w })));

  writeHash();
  schedulePreview();
}

// ---------- preview ----------
let previewTimer, latest = 0;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const mine = ++latest;
    const spec = { ...state };
    $('busy').hidden = false;
    try {
      const wantLid = (spec.type === 'box' && spec.lidRails !== false) || spec.type === 'cabinet';
      const wantHost = hosted(spec.type);
      const [res, lid, host] = await Promise.all([
        build(spec, PREVIEW_SEGMENTS, 'use'),
        wantLid ? (spec.type === 'cabinet' ? build({ ...spec, type: 'drawer' }, PREVIEW_SEGMENTS, 'use') : build(lidSpecOf(spec), PREVIEW_SEGMENTS)) : null,
        wantHost ? build(hostSpec(spec), PREVIEW_SEGMENTS) : null,
      ]);
      if (mine !== latest) return;
      hideStatus();
      if (res.font === false && (spec.brand || spec.label) && spec.textStyle !== 'off') showStatus('Lettering font could not load, so text is skipped.');
      current = res;
      currentLid = lid;
      currentHost = host;
      draw();
      renderStats();
    } catch (err) {
      if (mine === latest) showStatus(`Could not build this part: ${err.message}`);
    } finally {
      if (mine === latest) $('busy').hidden = true;
    }
  }, 80);
}

const fmtTime = (min) => (min < 60 ? `${Math.round(min)}m` : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`);
const money = (g) => `${prefs.currency}${((g / 1000) * prefs.price).toFixed(prefs.price * g / 1000 < 10 ? 1 : 0)}`;
function perPlate(sp) {
  const fit = (n) => Math.max(0, Math.floor((STD.bed + 4) / (n + 4)));
  return Math.max(fit(sp.pW) * fit(sp.pD), fit(sp.pD) * fit(sp.pW));
}
function renderStats() {
  if (!current) return;
  const g = grams(current.volume, prefs.density);
  $('statGrams').textContent = `${g.toFixed(0)} g`;
  $('statGrams').parentElement.dataset.tip = `${g.toFixed(1)} g · ${metres(current.volume).toFixed(1)} m of 1.75 mm filament (0% infill, as printed).`;
  $('statTime').textContent = fmtTime(printMinutes(current.volume));
  $('statCost').textContent = money(g);
  const n = perPlate(current.spec);
  $('statPlate').textContent = n ? `${n}` : 'too big';
  const kg = floorLoadKg(current.spec);
  $('statLoad').textContent = kg == null ? '—' : kg < 10 ? `${kg.toFixed(1)} kg` : `${Math.round(kg)} kg`;
}

// ---------- downloads ----------
function download(data, filename, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function withBusy(btn, fn) {
  btn.classList.add('busy');
  btn.disabled = true;
  try { await fn(); } catch (err) { toast(`Export failed: ${err.message}`); } finally {
    btn.classList.remove('busy');
    btn.disabled = false;
    renderPlate();
  }
}
$('dl3mf').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  const res = await build({ ...state }, EXPORT_SEGMENTS);
  download(make3MF([{ name: res.spec.name, mesh: res }]), `${res.spec.name}.3mf`, 'model/3mf');
}));
$('dlStl').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  const res = await build({ ...state }, EXPORT_SEGMENTS);
  download(makeSTL(res), `${res.spec.name}.stl`, 'model/stl');
}));

// ---------- plate ----------
const nameOf = (spec) => resolveSpec(spec).name;
const subtitle = (spec) => [spec.label, spec.pattern !== 'none' && spec.type !== 'lid' ? spec.pattern : '', spec.divX || spec.divY ? `${(spec.divX + 1) * (spec.divY + 1)} cells` : ''].filter(Boolean).join(' · ');
function addToPlate(spec, qty = 1) {
  const key = JSON.stringify(spec);
  const existing = plate.find((p) => JSON.stringify(p.spec) === key);
  if (existing) existing.qty += qty; else plate.push({ spec: { ...spec }, qty });
  store.set('aess-plate', plate);
  renderPlate();
}
$('addPlate').addEventListener('click', () => { const q = defaultQty(state); addToPlate({ ...state }, q); toast(`Added ${q > 1 ? `${q} × ` : ''}${nameOf(state)}`); });
$('addLid').addEventListener('click', () => {
  const extra = state.type === 'cabinet' ? { ...state, type: 'drawer' } : hosted(state.type) ? hostSpec(state) : lidSpecOf(state);
  const q = state.type === 'cabinet' ? defaultQty(extra) : 1;
  addToPlate(extra, q);
  toast(`Added ${q > 1 ? `${q} × ` : ''}${nameOf(extra)}`);
});
$('clearPlate').addEventListener('click', () => { plate = []; store.set('aess-plate', plate); renderPlate(); });

const PRESETS = {
  fit: [{ type: 'box', nx: 1, ny: 1, nh: 3 }, { type: 'lid', nx: 1, ny: 1 }],
  starter: [
    { type: 'box', nx: 1, ny: 1, nh: 3 }, { type: 'lid', nx: 1, ny: 1 },
    { type: 'hopper', nx: 1, ny: 2, nh: 7 }, { type: 'hopper', nx: 2, ny: 2, nh: 7 }, { type: 'hopper', nx: 2, ny: 3, nh: 7 },
    { type: 'hopper', nx: 2, ny: 3, nh: 10, wall: 'heavy' }, { type: 'box', nx: 2, ny: 2, nh: 5 }, { type: 'lid', nx: 2, ny: 2 },
    { type: 'box', nx: 2, ny: 3, nh: 7 }, { type: 'lid', nx: 2, ny: 3 }, { type: 'box', nx: 1, ny: 5, nh: 4 }, { type: 'lid', nx: 1, ny: 5 },
  ],
  screws: [{ type: 'hopper', nx: 1, ny: 2, nh: 7, qty: 6 }],
  nuts: [{ type: 'box', nx: 2, ny: 2, nh: 4, divX: 2, divY: 2 }, { type: 'lid', nx: 2, ny: 2 }],
  nutcups: [{ type: 'box', nx: 2, ny: 2, nh: 4, gusset: 2 }, { type: 'cup', nx: 2, ny: 2, nh: 4, gusset: 2, cupsX: 3, cupsY: 3, qty: 9 }, { type: 'lid', nx: 2, ny: 2 }],
  drill: [{ type: 'box', nx: 2, ny: 3, nh: 6, label: 'Drill bits' }, { type: 'holder', nx: 2, ny: 3, nh: 6, holderMode: 'drill' }, { type: 'lid', nx: 2, ny: 3 }],
  bits: [{ type: 'box', nx: 2, ny: 2, nh: 5, label: 'Hex bits' }, { type: 'holder', nx: 2, ny: 2, nh: 5, holderMode: 'hex' }, { type: 'lid', nx: 2, ny: 2 }],
  tools: [{ type: 'box', nx: 2, ny: 2, nh: 18, lidRails: false, floorRibs: 'cross' }, { type: 'holder', nx: 2, ny: 2, nh: 18, lidRails: false, floorRibs: 'cross', holderMode: 'grid', gridHole: 12, gridPitch: 18, holderH: 40 }],
  toolbox: [{ type: 'box', nx: 3, ny: 2, nh: 10, trayDepth: 22, grips: true, floorRibs: 'cross' }, { type: 'tray', nx: 3, ny: 2, nh: 10, trayDepth: 22, divX: 2 }, { type: 'lid', nx: 3, ny: 2 }],
  riser: [3, 6, 9].map((nh) => ({ type: 'box', nx: 2, ny: 3, nh, lidRails: false, wall: 'lite', pattern: 'hex', hole: 10, textStyle: 'off', wallRibs: false })),
  sorter: [{ type: 'box', nx: 2, ny: 3, nh: 8, lidRails: false, divY: 12, label: 'Discs & sheets' }],
  dispenser: [{ type: 'box', nx: 2, ny: 2, nh: 6, label: 'Wire' }, { type: 'lid', nx: 2, ny: 2, lidStyle: 'dispenser', dispHole: 12 }],
  cabinet: [{ type: 'cabinet', nx: 2, ny: 3, nh: 10, cabRows: 3 }, { type: 'drawer', nx: 2, ny: 3, nh: 10, cabRows: 3, qty: 3 }],
  counter: [{ type: 'counter', nx: 3, ny: 2 }],
};
$('presetSel').addEventListener('change', (e) => {
  const items = PRESETS[e.target.value];
  e.target.value = '';
  if (!items) return;
  const keep = { brand: state.brand, textStyle: state.textStyle, lidSnap: state.lidSnap, U: state.U, hu: state.hu, chamfer: state.chamfer };
  for (const { qty = 1, ...p } of items) addToPlate({ ...DEFAULTS, ...keep, label: '', ...p }, qty);
  toast('Preset added to the plate');
});

const gramCache = new Map();
const estimating = new Set();
async function estimate(key, spec) {
  if (estimating.has(key)) return;
  estimating.add(key);
  try { gramCache.set(key, (await build(spec, PREVIEW_SEGMENTS)).volume); renderPlate(); } catch { /* reported on export */ } finally { estimating.delete(key); }
}
function renderPlate() {
  const list = $('plateList');
  list.replaceChildren();
  let total = 0, count = 0, known = true;
  plate.forEach((item, i) => {
    const key = JSON.stringify(item.spec);
    const vol = gramCache.get(key);
    const g = vol == null ? null : grams(vol, prefs.density);
    if (g == null) { known = false; estimate(key, item.spec); } else total += g * item.qty;
    count += item.qty;
    const li = document.createElement('li');
    li.className = 'plate-item';
    const name = document.createElement('span');
    name.className = 'pi-name';
    name.title = 'Open in the editor';
    name.textContent = nameOf(item.spec);
    const sub = subtitle(item.spec);
    if (sub) name.append(Object.assign(document.createElement('small'), { textContent: sub }));
    name.onclick = () => set({ ...item.spec });
    const gEl = Object.assign(document.createElement('span'), { className: 'pi-g', textContent: g == null ? '' : `${Math.round(g * item.qty)} g` });
    const step = document.createElement('span');
    step.className = 'stepper';
    step.innerHTML = '<button type="button" aria-label="One less">−</button><output></output><button type="button" aria-label="One more">+</button>';
    step.querySelector('output').textContent = item.qty;
    const [minus, plus] = step.querySelectorAll('button');
    minus.onclick = () => { item.qty -= 1; if (item.qty < 1) plate.splice(i, 1); store.set('aess-plate', plate); renderPlate(); };
    plus.onclick = () => { item.qty += 1; store.set('aess-plate', plate); renderPlate(); };
    li.append(name, gEl, step);
    list.append(li);
  });
  $('plateTotal').textContent = count ? `${count} part${count > 1 ? 's' : ''}${known ? ` · ${Math.round(total)} g · ${money(total)}` : ''}` : 'empty';
  for (const id of ['dlPlate', 'dlZip', 'printLabels']) $(id).disabled = !count;
}

$('dlPlate').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  const parts = [];
  for (const item of plate) {
    const res = await build(item.spec, EXPORT_SEGMENTS);
    for (let k = 0; k < item.qty; k++) parts.push({ name: item.qty > 1 ? `${res.spec.name} (${k + 1})` : res.spec.name, mesh: res });
  }
  download(make3MF(parts), `AESS-plate-${parts.length}-parts.3mf`, 'model/3mf');
}));
$('dlZip').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  const files = [];
  const seen = new Map();
  for (const item of plate) {
    const res = await build(item.spec, EXPORT_SEGMENTS);
    let base = res.spec.name;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    if (n > 1) base += `-${n}`;
    files.push([`${base}${item.qty > 1 ? `_x${item.qty}` : ''}.stl`, makeSTL(res)]);
  }
  download(makeZip(files), 'AESS-parts-stl.zip', 'application/zip');
}));

// printable paper labels for the plate
$('printLabels').addEventListener('click', () => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const cards = plate.flatMap((item) => Array.from({ length: item.qty }, () => {
    const sp = resolveSpec(item.spec);
    return `<div class="l"><b>${esc(sp.label || TYPES_LABEL[sp.type])}</b><span>${esc(sp.brand)}</span><small>${esc(sp.name)}</small></div>`;
  })).join('');
  const w = open('', '_blank');
  if (!w) { toast('Allow pop-ups to print labels'); return; }
  w.document.write(`<!doctype html><title>AESS labels</title><style>
    body{font:14px system-ui,sans-serif;margin:12mm}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}
    .l{border:1px dashed #999;border-radius:2mm;padding:4mm;display:flex;flex-direction:column;gap:1mm;break-inside:avoid}
    .l b{font-size:18px}.l span{color:#444}.l small{font-family:monospace;color:#777;font-size:10px}
    @media print{body{margin:8mm}}</style><div class="g">${cards}</div>`);
  w.document.close();
  w.focus();
  w.print();
});
const TYPES_LABEL = { hopper: 'Hopper', box: 'Box', lid: 'Lid' };

// ---------- library ----------
function renderLibrary() {
  const list = $('libList');
  list.replaceChildren();
  library.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'lib-item';
    const name = Object.assign(document.createElement('span'), { className: 'pi-name', textContent: nameOf(entry.spec) });
    const sub = subtitle(entry.spec);
    if (sub) name.append(Object.assign(document.createElement('small'), { textContent: sub }));
    name.onclick = () => { set({ ...entry.spec }); $('library').close(); };
    const add = Object.assign(document.createElement('button'), { type: 'button', className: 'btn small ghost', textContent: '+ Plate' });
    add.onclick = () => { addToPlate({ ...entry.spec }); toast('Added to the plate'); };
    const del = Object.assign(document.createElement('button'), { type: 'button', className: 'x', textContent: '×', title: 'Remove' });
    del.onclick = () => { library.splice(i, 1); store.set('aess-library', library); renderLibrary(); };
    li.append(name, add, del);
    list.append(li);
  });
}
$('saveLib').addEventListener('click', () => {
  if (!library.some((e) => JSON.stringify(e.spec) === JSON.stringify(state))) library.unshift({ spec: { ...state } });
  store.set('aess-library', library);
  toast(`Saved ${nameOf(state)} to the library`);
});
$('libraryBtn').addEventListener('click', () => { renderLibrary(); $('library').showModal(); });

// ---------- misc ----------
$('copyLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch { toast(location.href); }
});
(function repoLink() {
  const a = $('repoLink');
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  a.href = m && repo ? `https://github.com/${m[1]}/${repo}` : 'https://github.com/prabhuakshay/aess';
})();

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}
function showStatus(msg) { const s = $('status'); s.textContent = msg; s.hidden = false; }
function hideStatus() { $('status').hidden = true; }

// offline support (https or localhost only)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// a pasted or edited link (or back/forward) loads that part
addEventListener('hashchange', () => set({ ...DEFAULTS, ...readHash() }));

showStatus('Loading geometry engine…');
refresh();
renderPlate();
resize();
