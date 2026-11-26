import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { resolveSpec, grams, metres, STD } from './aess-core.js';
import { make3MF, makeSTL, makeZip } from './aess-export.js';

const $ = (id) => document.getElementById(id);
const PREVIEW_SEGMENTS = 6;
const EXPORT_SEGMENTS = 16;

// ---------- state ----------
const DEFAULT = { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 'std', snap: 0.6, frontRatio: 0.4 };
const state = { ...DEFAULT, ...readHash() };
let plate = loadPlate();

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  const out = {};
  if (p.get('t')) out.type = p.get('t');
  for (const [k, key] of [['x', 'nx'], ['y', 'ny'], ['h', 'nh']]) if (p.get(k)) out[key] = Number(p.get(k));
  if (p.get('w')) out.wall = p.get('w');
  if (p.get('s')) out.snap = Number(p.get('s'));
  if (p.get('f')) out.frontRatio = Number(p.get('f'));
  return out;
}
function writeHash() {
  const p = new URLSearchParams({ t: state.type, x: state.nx, y: state.ny, h: state.nh, w: state.wall, s: state.snap, f: state.frontRatio });
  history.replaceState(null, '', `#${p}`);
}
function loadPlate() {
  try { return JSON.parse(localStorage.getItem('aess-plate') || '[]'); } catch { return []; }
}
function savePlate() {
  try { localStorage.setItem('aess-plate', JSON.stringify(plate)); } catch { /* storage blocked: plate lives for this visit */ }
}

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
worker.onerror = (e) => showStatus(`Geometry engine failed to load: ${e.message || 'network error'}`);
function build(spec, segments) {
  const id = ++reqId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, spec, segments });
  });
}

// ---------- three.js viewer ----------
const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;

scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8178, 1.6));
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-160, -220, 320);
scene.add(key);
const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
rimLight.position.set(200, 160, 120);
scene.add(rimLight);

const isDark = () => matchMedia('(prefers-color-scheme: dark)').matches;
const material = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.55, metalness: 0.02 });
const ghostMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6, transparent: true, opacity: 0.35 });
const partGroup = new THREE.Group();
scene.add(partGroup);
let grid;

function makeGrid(sp) {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); }
  const cells = 10;
  grid = new THREE.GridHelper(cells * STD.U, cells, isDark() ? 0x4a443e : 0xb9b2a8, isDark() ? 0x2e2a26 : 0xd3cdc4);
  grid.rotation.x = Math.PI / 2;
  grid.position.set(sp.nx % 2 ? STD.U / 2 : 0, sp.ny % 2 ? STD.U / 2 : 0, -0.01);
  scene.add(grid);
}

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas.parentElement;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(h, 1);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

let current = null; // last preview result
let framedFor = '';
function showPart(res) {
  current = res;
  partGroup.clear();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(res.positions.slice(), 3));
  geo.setIndex(new THREE.BufferAttribute(res.indices.slice(), 1));
  const flat = geo.toNonIndexed();
  geo.dispose();
  flat.computeVertexNormals();
  const sp = res.spec;
  const stack = $('stackToggle').checked ? 3 : 1;
  for (let i = 0; i < stack; i++) {
    const m = new THREE.Mesh(flat, i === 0 ? material : ghostMaterial);
    m.position.z = i * sp.nh * STD.hu;
    partGroup.add(m);
  }
  makeGrid(sp);
  const frameKey = `${sp.nx}x${sp.ny}x${sp.nh}x${stack}`;
  if (frameKey !== framedFor) { frame(sp, stack); framedFor = frameKey; }
}

function frame(sp, stack = 1) {
  const h = sp.H + (stack - 1) * sp.nh * STD.hu;
  const size = Math.max(sp.W, sp.D, h);
  const target = new THREE.Vector3(0, 0, h * 0.42);
  const dist = size * 2.6 + 60;
  camera.position.set(target.x - dist * 0.55, target.y - dist * 0.75, target.z + dist * 0.55);
  controls.target.copy(target);
  controls.update();
}

(function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
})();

// ---------- UI wiring ----------
const fpGrid = $('fpGrid');
for (let row = 5; row >= 0; row--) {
  for (let col = 0; col < 6; col++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'fp-cell';
    b.dataset.x = col + 1;
    b.dataset.y = row + 1;
    b.setAttribute('aria-label', `${col + 1} × ${row + 1}`);
    fpGrid.append(b);
  }
}
fpGrid.addEventListener('pointerover', (e) => {
  const c = e.target.closest('.fp-cell');
  if (!c) return;
  for (const cell of fpGrid.children) cell.classList.toggle('hover', +cell.dataset.x <= +c.dataset.x && +cell.dataset.y <= +c.dataset.y);
});
fpGrid.addEventListener('pointerleave', () => { for (const cell of fpGrid.children) cell.classList.remove('hover'); });
fpGrid.addEventListener('click', (e) => {
  const c = e.target.closest('.fp-cell');
  if (c) set({ nx: +c.dataset.x, ny: +c.dataset.y });
});
document.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
  const [k, d] = b.dataset.step.split(':');
  set({ [k]: state[k] + Number(d) });
}));

document.querySelectorAll('.typecard').forEach((b) => b.addEventListener('click', () => set({ type: b.dataset.type })));
document.querySelectorAll('#wallSeg button').forEach((b) => b.addEventListener('click', () => set({ wall: b.dataset.wall })));
document.querySelectorAll('#fitSeg button').forEach((b) => b.addEventListener('click', () => set({ snap: Number(b.dataset.fit) })));
$('nh').addEventListener('input', (e) => set({ nh: Number(e.target.value) }));
$('front').addEventListener('input', (e) => set({ frontRatio: Number(e.target.value) / 100 }));
$('stackToggle').addEventListener('change', () => current && showPart(current));
$('resetView').addEventListener('click', () => current && frame(current.spec, $('stackToggle').checked ? 3 : 1));

const H_CHIPS = [1, 3, 5, 7, 10, 14, 21];
for (const n of H_CHIPS) {
  const c = document.createElement('button');
  c.type = 'button';
  c.className = 'chip';
  c.dataset.nh = n;
  c.textContent = n === 1 ? '1' : `${n}`;
  c.addEventListener('click', () => set({ nh: n }));
  $('hChips').append(c);
}

function set(patch) {
  Object.assign(state, patch);
  const sp = resolveSpec(state);
  // Keep the state normalised (clamped sizes, lid height) without losing the user's height choice for bins.
  state.nx = sp.nx; state.ny = sp.ny;
  if (state.type !== 'lid') state.nh = sp.nh;
  renderControls(sp);
  writeHash();
  schedulePreview();
}

function renderControls(sp) {
  document.querySelectorAll('.typecard').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.type === sp.type)));
  document.querySelectorAll('#wallSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.wall === state.wall)));
  document.querySelectorAll('#fitSeg button').forEach((b) => b.setAttribute('aria-checked', String(Math.abs(Number(b.dataset.fit) - sp.snap) < 1e-9)));
  for (const cell of fpGrid.children) cell.classList.toggle('on', +cell.dataset.x <= sp.nx && +cell.dataset.y <= sp.ny);
  $('nxOut').textContent = sp.nx;
  $('nyOut').textContent = sp.ny;
  $('fpReadout').textContent = `${sp.nx} × ${sp.ny} · ${sp.W} × ${sp.D} mm`;
  const isLid = sp.type === 'lid';
  $('heightGroup').hidden = isLid;
  $('frontGroup').hidden = sp.type !== 'hopper';
  $('addLid').hidden = isLid;
  const nh = $('nh');
  nh.min = sp.type === 'hopper' ? 3 : 1;
  nh.value = sp.nh;
  $('hReadout').textContent = `${sp.nh} unit${sp.nh > 1 ? 's' : ''} · ${sp.H.toFixed(1)} mm`;
  document.querySelectorAll('#hChips .chip').forEach((c) => {
    c.setAttribute('aria-pressed', String(+c.dataset.nh === sp.nh));
    c.hidden = +c.dataset.nh < +nh.min;
  });
  $('front').value = Math.round(sp.frontRatio * 100);
  $('frontReadout').textContent = `${Math.round(sp.frontRatio * 100)}% · ${sp.frontH.toFixed(1)} mm`;
  $('hudName').textContent = sp.name;
  $('hudDims').textContent = `${sp.W} × ${sp.D} × ${sp.H.toFixed(1)} mm`;
}

let previewTimer;
let latestPreview = 0;
function schedulePreview() {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const mine = ++latestPreview;
    try {
      const res = await build({ ...state }, PREVIEW_SEGMENTS);
      if (mine !== latestPreview) return;
      hideStatus();
      showPart(res);
      $('statGrams').textContent = `${grams(res.volume).toFixed(0)} g`;
      $('statMetres').textContent = `${metres(res.volume).toFixed(1)} m`;
      $('statVol').textContent = `${(res.volume / 1000).toFixed(1)} cm³`;
    } catch (err) {
      showStatus(`Could not build this part: ${err.message}`);
    }
  }, 60);
}

// ---------- downloads ----------
function download(buf, filename, type) {
  const url = URL.createObjectURL(new Blob([buf], { type }));
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
const specOf = (s) => ({ type: s.type, nx: s.nx, ny: s.ny, nh: s.nh, wall: s.wall, snap: s.snap, frontRatio: s.frontRatio });
function addToPlate(spec, qty = 1) {
  const sp = resolveSpec(spec);
  const existing = plate.find((p) => resolveSpec(p.spec).name === sp.name && p.spec.frontRatio === spec.frontRatio);
  if (existing) existing.qty += qty;
  else plate.push({ spec: specOf({ ...spec, nh: sp.nh }), qty });
  savePlate();
  renderPlate();
}
$('addPlate').addEventListener('click', () => { addToPlate({ ...state }); toast(`Added ${resolveSpec(state).name}`); });
$('addLid').addEventListener('click', () => {
  const lid = { ...state, type: 'lid', nh: 1, frontRatio: 1 };
  addToPlate(lid);
  toast(`Added ${resolveSpec(lid).name}`);
});
$('clearPlate').addEventListener('click', () => { plate = []; savePlate(); renderPlate(); });

const PRESETS = {
  fit: [['box', 1, 1, 3], ['lid', 1, 1]],
  starter: [
    ['box', 1, 1, 3], ['lid', 1, 1], ['hopper', 1, 2, 7], ['hopper', 2, 2, 7], ['hopper', 2, 3, 7], ['hopper', 2, 3, 10, 'heavy'],
    ['box', 2, 2, 5], ['box', 2, 3, 7], ['lid', 2, 2], ['lid', 2, 3], ['box', 1, 5, 4], ['lid', 1, 5],
  ],
  screws: [['hopper', 1, 2, 7, 'std', 6]],
};
$('presetSel').addEventListener('change', (e) => {
  const set_ = PRESETS[e.target.value];
  e.target.value = '';
  if (!set_) return;
  for (const [type, nx, ny, nh = 1, wall = 'std', qty = 1] of set_) {
    addToPlate({ type, nx, ny, nh, wall, snap: state.snap, frontRatio: type === 'hopper' ? 0.4 : 1 }, qty);
  }
  toast('Preset added to the plate');
});

const gramCache = new Map();
function renderPlate() {
  const list = $('plateList');
  list.replaceChildren();
  let total = 0, count = 0, known = true;
  plate.forEach((item, i) => {
    const sp = resolveSpec(item.spec);
    const li = document.createElement('li');
    li.className = 'plate-item';
    const g = gramCache.get(sp.name);
    if (g == null) known = false; else total += g * item.qty;
    count += item.qty;
    li.innerHTML = `<span class="pi-name" title="Open in editor">${sp.name}</span>
      <span class="pi-g">${g == null ? '' : `${Math.round(g * item.qty)} g`}</span>
      <span class="stepper"><button type="button" aria-label="One less">−</button><output>${item.qty}</output><button type="button" aria-label="One more">+</button></span>`;
    const [minus, plus] = li.querySelectorAll('button');
    minus.onclick = () => { item.qty -= 1; if (item.qty < 1) plate.splice(i, 1); savePlate(); renderPlate(); };
    plus.onclick = () => { item.qty += 1; savePlate(); renderPlate(); };
    li.querySelector('.pi-name').onclick = () => set({ ...item.spec });
    list.append(li);
    if (g == null) estimate(sp.name, item.spec);
  });
  $('plateTotal').textContent = count ? `${count} part${count > 1 ? 's' : ''}${known ? ` · ${Math.round(total)} g` : ''}` : 'empty';
  $('dlPlate').disabled = !count;
  $('dlZip').disabled = !count;
}
const estimating = new Set();
async function estimate(name, spec) {
  if (estimating.has(name)) return;
  estimating.add(name);
  try {
    const res = await build(spec, PREVIEW_SEGMENTS);
    gramCache.set(name, grams(res.volume));
    renderPlate();
  } catch { /* shown when exporting */ } finally { estimating.delete(name); }
}

async function plateMeshes() {
  const out = [];
  for (const item of plate) {
    const res = await build(item.spec, EXPORT_SEGMENTS);
    for (let k = 0; k < item.qty; k++) out.push({ name: item.qty > 1 ? `${res.spec.name} (${k + 1})` : res.spec.name, mesh: res, base: res.spec.name });
  }
  return out;
}
$('dlPlate').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  const parts = await plateMeshes();
  download(make3MF(parts), `AESS-plate-${parts.length}-parts.3mf`, 'model/3mf');
}));
$('dlZip').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  const files = [];
  for (const item of plate) {
    const res = await build(item.spec, EXPORT_SEGMENTS);
    files.push([`${res.spec.name}${item.qty > 1 ? `_x${item.qty}` : ''}.stl`, makeSTL(res)]);
  }
  download(makeZip(files), 'AESS-parts-stl.zip', 'application/zip');
}));

// ---------- misc ----------
$('copyLink').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); toast('Link copied'); } catch { toast(location.href); }
});
$('aboutBtn').addEventListener('click', () => $('about').showModal());
(function repoLink() {
  const a = $('repoLink');
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  if (m && repo) a.href = `https://github.com/${m[1]}/${repo}`;
  else a.hidden = true;
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

showStatus('Loading geometry engine…');
set({});
renderPlate();
resize();
