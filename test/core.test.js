// Checks the browser generator against the SolidCraft master (cad/aess_master.sc).
// Fixture volumes were measured in SolidCraft 0.49.1 on the master design.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'manifold-3d';
import { buildPart, resolveSpec, toMesh } from '../web/aess-core.js';
import { make3MF, makeSTL } from '../web/aess-export.js';

const M = await Module();
M.setup();

const SOLIDCRAFT = [
  { spec: { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 'std' }, mm3: 34743.5 },
  { spec: { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 'lite' }, mm3: 24046.9 },
  { spec: { type: 'hopper', nx: 2, ny: 3, nh: 7, wall: 'heavy' }, mm3: 40018.1 },
  { spec: { type: 'box', nx: 2, ny: 3, nh: 7, wall: 'std' }, mm3: 37628.8 },
  { spec: { type: 'lid', nx: 2, ny: 3, wall: 'std' }, mm3: 17097.7 },
  { spec: { type: 'lid', nx: 2, ny: 3, wall: 'lite' }, mm3: 12396.8 },
  { spec: { type: 'hopper', nx: 1, ny: 1, nh: 3, wall: 'std' }, mm3: 5758.3 },
  { spec: { type: 'box', nx: 1, ny: 1, nh: 3, wall: 'std' }, mm3: 6363 },
  { spec: { type: 'box', nx: 1, ny: 5, nh: 4, wall: 'std' }, mm3: 28283.5 },
  { spec: { type: 'hopper', nx: 6, ny: 6, nh: 30, wall: 'std' }, mm3: 291981.5 },
];

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
  for (const nh of [1, 3, 7, 35]) {
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
