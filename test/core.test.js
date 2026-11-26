// Checks the browser generator against the SolidCraft master (cad/aess_master.sc).
// Fixture volumes were measured in SolidCraft 0.49.1 on the master design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { readFileSync } from 'node:fs';
import { parse } from 'opentype.js/dist/opentype.mjs';
import { buildPart, resolveSpec, toMesh, STD } from '../web/aess-core.js';
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
