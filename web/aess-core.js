// AESS geometry core: builds every AESS part with the Manifold kernel.
// The source of truth for the standard is cad/aess_master.sc (SolidCraft).
// This file rebuilds the same shapes from the same numbers, and
// test/core.test.js checks its volumes against SolidCraft's.

export const STD = Object.freeze({
  U: 42,        // grid pitch (mm)
  gap: 0.5,     // clearance between neighbours: outer = n*U - gap
  hu: 7,        // height unit (mm): each bin adds nh*hu to a stack
  lip: 4,       // foot depth
  fit: 0.3,     // radial play of the foot inside the rim
  r: 4,         // outer corner radius
  rim: 1.2,     // rim thickness in the snap zone (fixed for every wall class)
  zb: 2.4,      // height of the snap bead's crest on the foot
  bedMax: 256,  // Bambu A1 build volume
});

export const WALLS = Object.freeze({ lite: 0.8, std: 1.2, heavy: 1.4 });
export const FITS = Object.freeze({ loose: 0.5, standard: 0.6, tight: 0.7 });
export const TYPES = Object.freeze({
  hopper: { code: 'HOP', label: 'Hopper', minNh: 3 },
  box: { code: 'BOX', label: 'Box', minNh: 1 },
  lid: { code: 'LID', label: 'Lid', minNh: 1 },
});

/** Normalise and validate a part spec; returns a full spec with derived sizes. */
export function resolveSpec(input) {
  const type = TYPES[input.type] ? input.type : 'hopper';
  const clampInt = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v) || lo)));
  const nx = clampInt(input.nx, 1, 6);
  const ny = clampInt(input.ny, 1, 6);
  const nh = type === 'lid' ? 1 : clampInt(input.nh, TYPES[type].minNh, 35);
  const wall = typeof input.wall === 'number'
    ? Math.min(1.4, Math.max(0.8, input.wall))
    : (WALLS[input.wall] ?? WALLS.std);
  const snap = Math.min(0.8, Math.max(0.4, Number(input.snap ?? FITS.standard)));
  const frontRatio = type === 'hopper'
    ? Math.min(0.9, Math.max(0.15, Number(input.frontRatio ?? 0.4)))
    : 1;

  const { U, gap, hu, lip, fit, rim } = STD;
  const W = nx * U - gap;
  const D = ny * U - gap;
  const H = nh * hu + lip + fit;
  const wallTag = Object.entries(WALLS).find(([, v]) => Math.abs(v - wall) < 1e-9)?.[0].toUpperCase()
    ?? `${wall}MM`;
  const snapTag = Math.abs(snap - FITS.standard) < 1e-9 ? '' : `-S${snap}`;
  const name = `AESS-${TYPES[type].code}-${nx}x${ny}${type === 'lid' ? '' : `x${nh}`}-${wallTag}${snapTag}`;
  return {
    type, nx, ny, nh, wall, snap, frontRatio, W, D, H, name,
    s: rim + fit,
    groove: snap - fit + 0.1,
    zr: H - lip - fit - 1,
    zg: H - lip - fit + STD.zb,
    frontH: H * frontRatio,
  };
}

/** Points of a rounded rectangle inset `inset` from the W x D outline, at height z. */
function slice(sp, inset, z, seg) {
  const a = sp.W / 2 - inset;
  const b = sp.D / 2 - inset;
  const rr = Math.max(STD.r - inset, 0.05);
  const pts = [];
  const corners = [[a - rr, b - rr, 0], [-(a - rr), b - rr, 90], [-(a - rr), -(b - rr), 180], [a - rr, -(b - rr), 270]];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= seg; i++) {
      const t = ((start + (90 * i) / seg) * Math.PI) / 180;
      pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t), z]);
    }
  }
  return pts;
}

/** A solid made of frustums between consecutive (z, inset) breakpoints. */
function loft(M, sp, profile, seg) {
  const parts = [];
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, f0] = profile[i];
    const [z1, f1] = profile[i + 1];
    if (z1 - z0 < 1e-6) continue;
    parts.push(M.Manifold.hull([...slice(sp, f0, z0, seg), ...slice(sp, f1, z1, seg)]));
  }
  const out = M.Manifold.union(parts);
  parts.forEach((p) => p.delete());
  return out;
}

/** Outer inset profile f(z) of every AESS part: foot, snap bead, 45 deg flare, wall. */
function outerProfile(sp) {
  const { lip, zb } = STD;
  const { s, snap, H } = sp;
  return [
    [0, s], [zb - snap, s], [zb, s - snap], [zb + snap, s], [lip, s], [lip + s, 0], [H, 0],
  ];
}

function insetAt(profile, z) {
  if (z <= profile[0][0]) return profile[0][1];
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, f0] = profile[i];
    const [z1, f1] = profile[i + 1];
    if (z <= z1) return z1 - z0 < 1e-9 ? f1 : f0 + ((f1 - f0) * (z - z0)) / (z1 - z0);
  }
  return profile[profile.length - 1][1];
}

/** Cavity inset: the outer profile eroded by a ball of radius `wall` (what a CAD shell does). */
function erodedInset(profile, z, w) {
  let best = -Infinity;
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const dz = -w + (2 * w * i) / n;
    best = Math.max(best, insetAt(profile, z + dz) + Math.sqrt(Math.max(0, w * w - dz * dz)));
  }
  return best;
}

function cavityProfile(sp) {
  const { lip, rim } = STD;
  const { wall: w, s, zr, zg, groove, H } = sp;
  const outer = outerProfile(sp);
  const prof = [];
  const zTop = Math.min(zr, lip + s + w); // above this the eroded wall is straight
  const step = 0.1;
  for (let z = w; z < zTop - 1e-9; z += step) prof.push([z, erodedInset(outer, z, w)]);
  prof.push([zTop, erodedInset(outer, zTop, w)]);
  if (zr > zTop + 1e-9) prof.push([zr, w]);
  // Rim zone: fixed rim thickness, with the snap groove.
  prof.push([zr, rim], [zg - groove, rim], [zg, rim - groove], [zg + groove, rim], [H + 1, rim]);
  return prof;
}

/**
 * Build one part. `M` is the initialised manifold-3d module (after setup()).
 * Returns the Manifold; the caller owns it and must call delete().
 */
export function buildPart(M, input, { segments = 10 } = {}) {
  const sp = resolveSpec(input);
  const outer = loft(M, sp, outerProfile(sp), segments);
  const cavity = loft(M, sp, cavityProfile(sp), segments);
  let part = M.Manifold.difference(outer, cavity);
  outer.delete();
  cavity.delete();

  if (sp.type === 'hopper') {
    const { r, rim } = STD;
    const depth = Math.max(sp.wall, rim) + 2;
    const yc = -sp.D / 2 + rim / 2;
    const cut = M.Manifold.cube([sp.W - 2 * r, depth, sp.H + 1 - sp.frontH])
      .translate([-(sp.W / 2 - r), yc - depth / 2, sp.frontH]);
    const opened = M.Manifold.difference(part, cut);
    part.delete();
    cut.delete();
    part = opened;
  }
  return part;
}

/** Plain-array mesh of a Manifold: { positions: Float32Array, indices: Uint32Array }. */
export function toMesh(manifold) {
  const mesh = manifold.getMesh();
  const { numProp, vertProperties, triVerts } = mesh;
  const nv = vertProperties.length / numProp;
  const positions = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    positions[i * 3] = vertProperties[i * numProp];
    positions[i * 3 + 1] = vertProperties[i * numProp + 1];
    positions[i * 3 + 2] = vertProperties[i * numProp + 2];
  }
  return { positions, indices: new Uint32Array(triVerts) };
}

/** Grams of filament for a volume in mm3 (PLA 1.24 g/cm3 by default). */
export const grams = (mm3, density = 1.24) => (mm3 / 1000) * density;
/** Metres of 1.75 mm filament for a volume in mm3. */
export const metres = (mm3) => mm3 / (Math.PI * 0.875 * 0.875) / 1000;
