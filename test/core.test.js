// Checks the browser generator against the SolidCraft master (cad/aess_master.sc).
// Fixture volumes were measured in SolidCraft 0.49.1 on the master design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { readFileSync } from 'node:fs';
import { parse } from 'opentype.js/dist/opentype.mjs';
import { buildPart, resolveSpec, toMesh, STD, placements, floorLoadKg, printSettings } from '../web/aess-core.js';
import { make3MF, makeSTL } from '../web/aess-export.js';

const M = await Module();
M.setup();
const fontBuf = readFileSync(new URL('../web/fonts/BarlowCondensed-Bold.ttf', import.meta.url));
const font = parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
const make = (spec, segments = 8) => buildPart(M, spec, { segments, font });
const vol = (spec) => { const p = make(spec); const v = p.volume(); p.delete(); return v; };

// Bin bodies only (no chamfer, rails, text or patterns), as the SolidCraft master builds them.
const BASE = { chamfer: 0, lidRails: false, textStyle: 'off' };
const SOLIDCRAFT = [
  { spec: { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 'std' }, mm3: 34655.2 },
  { spec: { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 'lite' }, mm3: 23983.1 },
  { spec: { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 1.4 }, mm3: 39925.8 },
  { spec: { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 'heavy' }, mm3: 45153.0 },
  { spec: { type: 'box', nx: 2, ny: 3, nh: 7, wall: 'std' }, mm3: 37552.6 },
  { spec: { type: 'box', nx: 2, ny: 3, nh: 1, wall: 'std' }, mm3: 17021.5 },
  { spec: { type: 'box', nx: 2, ny: 3, nh: 1, wall: 'lite' }, mm3: 12345.1 },
  { spec: { type: 'hopper', nx: 1, ny: 1, nh: 3, wall: 'std' }, mm3: 5724.5 },
  { spec: { type: 'box', nx: 1, ny: 1, nh: 3, wall: 'std' }, mm3: 6334.7 },
  { spec: { type: 'box', nx: 1, ny: 5, nh: 4, wall: 'std' }, mm3: 28191.4 },
  { spec: { type: 'hopper', nx: 6, ny: 6, nh: 30, wall: 'std' }, mm3: 291755.0 },
].map((f) => ({ ...f, spec: { ...BASE, ...f.spec } }));

for (const { spec, mm3 } of SOLIDCRAFT) {
  const sp = resolveSpec(spec);
  test(`${sp.name} matches SolidCraft volume and size`, () => {
    const part = buildPart(M, spec, { segments: 16 });
    try {
      assert.equal(part.status(), 'NoError');
      assert.equal(part.genus(), 0, 'one closed shell with no handles');
      const vol = part.volume();
      const err = Math.abs(vol - mm3) / mm3;
      assert.ok(err < 0.005, `volume ${vol.toFixed(1)} vs SolidCraft ${mm3} (${(err * 100).toFixed(2)} %)`);
      const bb = part.boundingBox();
      assert.ok(Math.abs(bb.max[0] - sp.W / 2) < 0.01 && Math.abs(bb.max[1] - sp.D / 2) < 0.01);
      assert.ok(Math.abs(bb.min[2]) < 1e-6 && Math.abs(bb.max[2] - sp.H) < 1e-6);
    } finally {
      part.delete();
    }
  });
}

test('the standard: stack pitch is nh * 7 mm', () => {
  for (const nh of [2, 3, 7, 35]) {
    const sp = resolveSpec({ type: 'box', nx: 1, ny: 1, nh });
    assert.equal(+(sp.H - 4.3).toFixed(6), nh * 7);
  }
  assert.ok(resolveSpec({ type: 'box', nx: 6, ny: 6, nh: 35 }).H <= 256);
});

test('exports are valid STL and 3MF', () => {
  const part = buildPart(M, { type: 'box', nx: 1, ny: 1, nh: 2 });
  const mesh = toMesh(part);
  part.delete();
  const stl = makeSTL(mesh);
  assert.equal(stl.byteLength, 84 + 50 * (mesh.indices.length / 3));
  const zip = make3MF([{ name: 'test', mesh }]);
  const bytes = new Uint8Array(zip);
  assert.deepEqual([...bytes.slice(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'zip header');
});

test('every feature builds a valid closed solid', () => {
  const cases = [
    { type: 'hopper', nx: 2, ny: 3, nh: 7, label: 'M6 x 30' },
    { type: 'hopper', nx: 1, ny: 1, nh: 2 },
    { type: 'hopper', nx: 2, ny: 3, nh: 7, pattern: 'slots', textStyle: 'raise', scoop: 12 },
    { type: 'box', nx: 2, ny: 3, nh: 7, pattern: 'hex', divX: 2, divY: 1 },
    { type: 'box', nx: 2, ny: 2, nh: 4, pattern: 'diamond', wall: 'lite', floor: 2 },
    { type: 'box', nx: 1, ny: 1, nh: 2 },
    { type: 'box', nx: 3, ny: 2, nh: 5, U: 25.4 },
    { type: 'box', sizeMode: 'custom', W: 100, D: 60, H: 40, wall: 'heavy' },
    { type: 'lid', nx: 2, ny: 3 },
    { type: 'lid', nx: 1, ny: 1, lidPattern: 'hex' },
    { type: 'lid', sizeMode: 'custom', W: 100, D: 60 },
  ];
  for (const spec of cases) {
    const p = make(spec);
    try {
      assert.equal(p.status(), 'NoError', resolveSpec(spec).name);
      assert.ok(p.volume() > 1000, resolveSpec(spec).name);
    } finally { p.delete(); }
  }
});

test('wall patterns and lid patterns save filament; dividers and scoops add it', () => {
  const base = { type: 'box', nx: 2, ny: 3, nh: 7, textStyle: 'off' };
  const solid = vol(base);
  for (const pattern of ['diamond', 'hex', 'slots']) assert.ok(vol({ ...base, pattern }) < solid * 0.97, pattern);
  assert.ok(vol({ ...base, divX: 1 }) > solid);
  assert.ok(vol({ ...base, scoop: 10 }) > solid);
  assert.ok(vol({ type: 'lid', nx: 2, ny: 3, lidPattern: 'hex' }) < vol({ type: 'lid', nx: 2, ny: 3 }) * 0.9);
});

test('text is engraved into or raised from the front', () => {
  const base = { type: 'hopper', nx: 2, ny: 3, nh: 7 };
  const plain = vol({ ...base, textStyle: 'off' });
  assert.ok(vol({ ...base, textStyle: 'engrave' }) < plain - 20);
  assert.ok(vol({ ...base, textStyle: 'raise' }) > plain + 20);
});

test('the slide lid sits in its box without colliding, and adds no stack height', () => {
  for (const [nx, ny, nh] of [[2, 3, 7], [1, 1, 3], [3, 2, 2]]) {
    const boxSpec = { type: 'box', nx, ny, nh };
    const sp = resolveSpec(boxSpec);
    assert.ok(sp.rails);
    const box = make(boxSpec);
    const lid = make({ ...boxSpec, type: 'lid' }).translate([0, 0, sp.zs]);
    const clash = M.Manifold.intersection(box, lid);
    assert.ok(clash.volume() < 0.5, `lid clashes with box by ${clash.volume().toFixed(2)} mm3 (${sp.name})`);
    assert.ok(lid.boundingBox().max[2] <= sp.H + 1e-6, 'lid stays below the rim top');
    // the next bin's foot reaches lip + fit below the rim: it must clear the lid
    const upper = make({ type: 'box', nx, ny, nh: 3 }).translate([0, 0, sp.H - STD.lip - STD.fit]);
    const clash2 = M.Manifold.intersection(upper, lid);
    assert.ok(clash2.volume() < 1e-3, `stacked bin hits the lid by ${clash2.volume().toFixed(3)} mm3`);
    const clash3 = M.Manifold.intersection(upper, box);
    assert.ok(clash3.volume() < 1e-3, `stacked bin hits the box by ${clash3.volume().toFixed(3)} mm3`);
    [box, lid, upper, clash, clash2, clash3].forEach((m) => m.delete());
  }
});

test('bins stack: a bin seated on another never overlaps it', () => {
  for (const type of ['hopper', 'box']) {
    for (const wall of ['lite', 'heavy']) {
      const lower = make({ type, nx: 2, ny: 2, nh: 5, wall, lidRails: false });
      const sp = resolveSpec({ type, nx: 2, ny: 2, nh: 5 });
      const upper = make({ type: 'box', nx: 2, ny: 2, nh: 3, wall: 'heavy' }).translate([0, 0, sp.H - STD.lip - STD.fit]);
      const clash = M.Manifold.intersection(lower, upper);
      assert.ok(clash.volume() < 1e-3, `${type}/${wall}: ${clash.volume().toFixed(3)} mm3`);
      [lower, upper, clash].forEach((m) => m.delete());
    }
  }
});

test('sizes: grid units, other grids and exact sizes', () => {
  assert.equal(resolveSpec({ nx: 2, ny: 3 }).W, 83.5);
  assert.equal(resolveSpec({ U: 25.4, nx: 4, ny: 2 }).W, 4 * 25.4 - 0.5);
  const c = resolveSpec({ type: 'box', sizeMode: 'custom', W: 100, D: 60, H: 40 });
  assert.deepEqual([c.W, c.D, c.H], [100, 60, 40]);
  assert.match(c.name, /^AESS-BOX-100x60x40MM-STD$/);
  assert.match(resolveSpec({ type: 'lid', nx: 2, ny: 3 }).name, /^AESS-LID-2x3$/);
  assert.ok(resolveSpec({ type: 'box', nx: 7, ny: 1 }).warnings.length > 0, 'warns when bigger than the bed');
});

// ---------- v0.3: strength, variants, inserts, structure ----------

const clashVol = (a, b) => { const c = M.Manifold.intersection(a, b); const v = c.volume(); c.delete(); return v; };
const inBox = (spec, orient = 'use') => {
  const box = make({ ...spec, type: 'box' });
  const parts = (placements(spec) ?? [[0, 0, 0]]).map((p) => buildPart(M, spec, { segments: 8, font, orient }).translate(p));
  return { box, parts, done: () => [box, ...parts].forEach((m) => m.delete()) };
};

test('new options and part types build valid closed solids', () => {
  const cases = [
    { type: 'box', nx: 2, ny: 3, nh: 7, floorRibs: 'cross', wallRibs: true, gusset: 4 },
    { type: 'hopper', nx: 2, ny: 3, nh: 7, floorRibs: 'long', sideSlope: 0.35, gauge: true, grips: true },
    { type: 'box', nx: 2, ny: 3, nh: 10, trayDepth: 20, grips: true, divX: 2 },
    { type: 'lid', nx: 2, ny: 3, lidStyle: 'window' },
    { type: 'lid', nx: 2, ny: 3, lidStyle: 'label' },
    { type: 'lid', nx: 2, ny: 2, lidStyle: 'dispenser', dispHole: 14 },
    { type: 'cup', nx: 2, ny: 2, nh: 5, cupsX: 3, cupsY: 3 },
    { type: 'tray', nx: 2, ny: 3, nh: 10, divX: 1 },
    { type: 'holder', nx: 2, ny: 3, nh: 10, holderMode: 'drill' },
    { type: 'holder', nx: 2, ny: 2, nh: 4, holderMode: 'hex' },
    { type: 'holder', nx: 2, ny: 2, nh: 20, holderMode: 'grid', system: 'imperial', U: 50.8, hu: 6.35 },
    { type: 'base', nx: 2, ny: 2, baseCols: 2, baseRows: 1, basePads: 'magnet' },
    { type: 'caddy', caddyCols: 4, caddyRows: 2 },
  ];
  for (const spec of cases) {
    const p = make(spec);
    try {
      assert.equal(p.status(), 'NoError', resolveSpec(spec).name);
      assert.ok(p.volume() > 500, resolveSpec(spec).name);
      assert.ok(p.boundingBox().min[2] > -1e-6, `${resolveSpec(spec).name} sits on the bed`);
    } finally { p.delete(); }
  }
});

test('ribs and gussets stiffen the floor for little filament', () => {
  const base = { type: 'box', nx: 2, ny: 3, nh: 7, textStyle: 'off' };
  const flat = floorLoadKg(base), cross = floorLoadKg({ ...base, floorRibs: 'cross', ribH: 4 });
  assert.ok(flat > 0.2 && flat < 5, `flat floor ${flat}`);
  assert.ok(cross > flat * 4, `cross ribs ${cross} vs ${flat}`);
  assert.ok(vol({ ...base, floorRibs: 'cross', ribH: 4 }) < vol({ ...base, floor: 2.4 }), 'ribs use less plastic than a doubled floor');
  assert.ok(vol({ ...base, gusset: 4 }) > vol(base));
  assert.ok(vol({ ...base, wallRibs: true }) > vol(base));
});

test('inserts fit inside their box without touching it', () => {
  for (const spec of [
    { type: 'cup', nx: 2, ny: 2, nh: 5, cupsX: 3, cupsY: 2 },
    { type: 'cup', nx: 2, ny: 3, nh: 6, cupsX: 2, cupsY: 3, floorRibs: 'cross', gusset: 3 },
    { type: 'holder', nx: 2, ny: 3, nh: 10, holderMode: 'drill' },
    { type: 'holder', nx: 2, ny: 2, nh: 5, holderMode: 'hex', wall: 'heavy' },
    { type: 'tray', nx: 2, ny: 3, nh: 10 },
    { type: 'tray', nx: 3, ny: 2, nh: 8, wall: 'lite', trayDepth: 15 },
  ]) {
    const spt = resolveSpec(spec);
    const host = { ...spec, trayDepth: spt.trayDepth };
    const { box, parts, done } = inBox(host);
    try {
      for (const p of parts) assert.ok(clashVol(box, p) < 0.05, `${spt.name} touches its box by ${clashVol(box, p).toFixed(3)} mm3`);
      for (let i = 0; i < parts.length; i++) for (let j = i + 1; j < parts.length; j++) assert.ok(clashVol(parts[i], parts[j]) < 1e-3, 'cups overlap');
      if (spec.type === 'tray') {
        const lid = make({ ...host, type: 'lid' }).translate([0, 0, spt.zs]);
        assert.ok(clashVol(lid, parts[0]) < 1e-3, 'tray clears the lid');
        lid.delete();
        // the tray rests on its ledge: lowered 0.5 mm it must hit the box
        const lower = make(host).translate([0, 0, spt.trayZ - 0.5]);
        assert.ok(clashVol(box, lower) > 1, 'tray sits on the ledge');
        lower.delete();
      }
    } finally { done(); }
  }
});

test('lid variants still fit their box', () => {
  for (const lidStyle of ['window', 'label', 'dispenser']) {
    const spec = { type: 'box', nx: 2, ny: 3, nh: 6 };
    const sp = resolveSpec(spec);
    const box = make(spec);
    const lid = make({ ...spec, type: 'lid', lidStyle }).translate([0, 0, sp.zs]);
    const upper = make({ type: 'box', nx: 2, ny: 3, nh: 3 }).translate([0, 0, sp.H - STD.lip - STD.fit]);
    assert.ok(clashVol(box, lid) < 0.5, lidStyle);
    assert.ok(clashVol(upper, lid) < 1e-3, `${lidStyle}: stacked bin clears the lid`);
    [box, lid, upper].forEach((m) => m.delete());
  }
});

test('a bin seated in a base plate or caddy does not collide with it', () => {
  const base = make({ type: 'base', nx: 2, ny: 2, baseCols: 2, baseRows: 1 });
  const bsp = resolveSpec({ type: 'base', nx: 2, ny: 2, baseCols: 2, baseRows: 1 });
  for (const sx of [-1, 1]) {
    const bin = make({ type: 'box', nx: 2, ny: 2, nh: 3, lidRails: false }).translate([sx * (bsp.W + 0.5) / 2, 0, bsp.pH - STD.lip - STD.fit]);
    assert.ok(clashVol(base, bin) < 1e-3, 'bin in base');
    bin.delete();
  }
  base.delete();
  const caddy = make({ type: 'caddy', caddyCols: 2, caddyRows: 2 });
  const csp = resolveSpec({ type: 'caddy', caddyCols: 2, caddyRows: 2 });
  const cx = -csp.pW / 2 + 1.6 + csp.cell / 2, cy = -csp.pD / 2 + 1.6 + csp.cell / 2;
  const bin = make({ type: 'hopper', nx: 1, ny: 1, nh: 4 }).translate([cx, cy, 1.6]);
  assert.ok(clashVol(caddy, bin) < 1e-3, 'bin in caddy well');
  [caddy, bin].forEach((m) => m.delete());
});

test('print settings follow the wall class', () => {
  assert.equal(printSettings({ wall: 'lite' }).wall_loops, 2);
  assert.equal(printSettings({ wall: 'std' }).wall_loops, 3);
  assert.equal(printSettings({ wall: 'heavy' }).wall_loops, 4);
  assert.equal(printSettings({}).sparse_infill_density, '0%');
});
