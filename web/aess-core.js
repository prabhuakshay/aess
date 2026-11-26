// AESS geometry core: builds every AESS part with the Manifold kernel.
// The bin body (foot, flare, walls, fixed rim, hopper opening) mirrors cad/aess_master.sc,
// and test/core.test.js checks the volumes against SolidCraft. Slide-lid rails, lids, text,
// wall patterns, dividers and scoops are defined here (see docs/STANDARD.md).

export const STD = Object.freeze({
  U: 42,        // default grid pitch (mm); a spec may override it
  hu: 7,        // default height unit (mm)
  gap: 0.5,     // clearance between neighbours: outer = n*U - gap
  lip: 4,       // foot depth
  fit: 0.3,     // radial play of the foot inside the rim
  r: 4,         // outer corner radius
  rim: 1.2,     // rim thickness in the stacking zone (fixed for every wall class)
  bed: 256,     // Bambu A1 build volume
  // slide lid
  lidT: 1.2,    // lid plate thickness
  railE: 1.0,   // how far the ledge and lip stick out of the wall
  lidCv: 0.3,   // vertical play of the lid in its channel
  lidCh: 0.4,   // side play of the lid in its channel
  lidZ: 7.1,    // the lid's bottom sits this far below the rim top (clear of the next bin's foot)
});

export const WALLS = Object.freeze({ lite: 0.8, std: 1.2, heavy: 1.6 });
export const LID_FITS = Object.freeze({ loose: 0.6, standard: 0.7, tight: 0.8 });
export const TYPES = Object.freeze({
  hopper: { code: 'HOP', label: 'Hopper' },
  box: { code: 'BOX', label: 'Box' },
  lid: { code: 'LID', label: 'Slide lid' },
});
export const PATTERNS = Object.freeze(['none', 'diamond', 'hex', 'slots']);

/** Base-unit systems. Metric uses the Gridfinity grid (42 x 7 mm); imperial uses inches with 1/4 in heights. */
export const SYSTEMS = Object.freeze({
  metric: { U: 42, hu: 7, grids: [42, 50, 40], steps: [7, 5, 10] },
  imperial: { U: 38.1, hu: 6.35, grids: [25.4, 38.1, 50.8], steps: [6.35, 12.7, 25.4] },
});

export const DEFAULTS = Object.freeze({
  type: 'hopper', system: 'metric', sizeMode: 'grid', U: 42, hu: 7, nx: 2, ny: 3, nh: 7, W: 84, D: 126, H: 53,
  wall: 'std', floor: null, chamfer: 0.4, frontRatio: 0.4,
  pattern: 'none', hole: 6, bar: 2.4, lidPattern: 'none',
  divX: 0, divY: 0, scoop: 0,
  brand: 'Akshay Enterprises', label: '', textStyle: 'engrave', lidBrand: true,
  lidRails: true, lidSnap: LID_FITS.standard, lidPull: 'tab',
});

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (v) => String(+v.toFixed(2));

/** Normalise and validate a part spec; returns a full spec with every derived size. */
export function resolveSpec(input = {}) {
  const i = { ...DEFAULTS, ...input };
  const type = TYPES[i.type] ? i.type : 'hopper';
  const { lip, fit, rim, gap, lidZ, railE, lidT, lidCv } = STD;
  const warnings = [];

  const wall = clamp(typeof i.wall === 'number' ? i.wall : (WALLS[i.wall] ?? WALLS.std), 0.8, 1.6);
  const floor = clamp(num(i.floor, wall), 0.8, 3);
  const chamfer = clamp(num(i.chamfer, 0), 0, 0.8);

  let W, D, H, nx = null, ny = null, nh = null;
  const system = SYSTEMS[i.system] ? i.system : 'metric';
  const sys = SYSTEMS[system];
  const U = clamp(num(i.U, sys.U), 20, 128);
  const hu = clamp(num(i.hu, sys.hu), 3, 50);
  const sizeMode = i.sizeMode === 'custom' ? 'custom' : 'grid';
  if (sizeMode === 'grid') {
    nx = Math.round(clamp(num(i.nx, 2), 1, 20));
    ny = Math.round(clamp(num(i.ny, 3), 1, 20));
    nh = Math.round(clamp(num(i.nh, 7), type === 'hopper' ? 2 : 1, 60));
    W = nx * U - gap;
    D = ny * U - gap;
    H = nh * hu + lip + fit;
  } else {
    W = clamp(num(i.W, 84), 24, 400);
    D = clamp(num(i.D, 126), 24, 400);
    H = clamp(num(i.H, 53), 11, 400);
  }
  const minH = type === 'hopper' ? 18 : 11;
  if (type !== 'lid' && H < minH) { H = minH; if (sizeMode === 'custom') warnings.push(`Raised to the ${minH} mm minimum height.`); }
  if (type === 'lid') H = lidZ; // the lid's own height: plate plus front cap

  const s = rim + fit;
  const rails = type === 'box' && i.lidRails !== false && H >= 18;
  if (type === 'box' && i.lidRails !== false && !rails) warnings.push('Slide-lid rails need a box at least 18 mm tall.');
  const zs = H - lidZ;                       // lid bottom / ledge top
  const lipTop = zs + lidT + lidCv + railE;  // = H - 4.6, below the next bin's foot
  const zr = rails ? Math.min(H - lip - fit - 1, zs - railE - 1) : H - lip - fit - 1;
  const frontRatio = type === 'hopper' ? clamp(num(i.frontRatio, 0.4), 0.15, 0.9) : 1;
  const frontH = H * frontRatio;

  const wallTag = Object.entries(WALLS).find(([, v]) => Math.abs(v - wall) < 1e-9)?.[0].toUpperCase() ?? `${fmt(wall)}MM`;
  const imp = system === 'imperial';
  const gridTag = imp
    ? `-G${fmt(U / 25.4)}IN${Math.abs(hu - sys.hu) > 1e-9 ? `-H${fmt(hu / 25.4)}IN` : ''}`
    : `${Math.abs(U - sys.U) > 1e-9 ? `-G${fmt(U)}` : ''}${Math.abs(hu - sys.hu) > 1e-9 ? `-H${fmt(hu)}` : ''}`;
  const sizeTag = sizeMode === 'grid'
    ? `${nx}x${ny}${type === 'lid' ? '' : `x${nh}`}${gridTag}`
    : imp
      ? `${fmt(W / 25.4)}x${fmt(D / 25.4)}${type === 'lid' ? '' : `x${fmt(H / 25.4)}`}IN`
      : `${fmt(W)}x${fmt(D)}${type === 'lid' ? '' : `x${fmt(H)}`}MM`;
  const lidSnap = clamp(num(i.lidSnap, LID_FITS.standard), 0.5, 0.9);
  let name = `AESS-${TYPES[type].code}-${sizeTag}`;
  if (type === 'lid') name += Math.abs(lidSnap - LID_FITS.standard) > 1e-9 ? `-S${fmt(lidSnap)}` : '';
  else name += `-${wallTag}${type === 'box' && !rails ? '-OPEN' : ''}`;

  const sp = {
    type, system, sizeMode, U, hu, nx, ny, nh, W, D, H, wall, floor, chamfer, frontRatio, frontH, s, rails, zs, lipTop, zr, lidSnap, name,
    pattern: PATTERNS.includes(i.pattern) ? i.pattern : 'none',
    lidPattern: PATTERNS.includes(i.lidPattern) && i.lidPattern !== 'slots' ? i.lidPattern : 'none',
    hole: clamp(num(i.hole, 6), 3, 20),
    bar: clamp(num(i.bar, 2.4), 1.2, 8),
    divX: Math.round(clamp(num(i.divX, 0), 0, 9)),
    divY: Math.round(clamp(num(i.divY, 0), 0, 9)),
    scoop: clamp(num(i.scoop, 0), 0, 30),
    brand: String(i.brand ?? '').slice(0, 40),
    label: String(i.label ?? '').slice(0, 40),
    textStyle: ['engrave', 'raise', 'off'].includes(i.textStyle) ? i.textStyle : 'engrave',
    lidBrand: i.lidBrand !== false,
    lidPull: ['tab', 'notch'].includes(i.lidPull) ? i.lidPull : 'tab',
    lidRailsRequested: i.lidRails !== false,
    warnings,
  };
  if (W > STD.bed || D > STD.bed || H > STD.bed) warnings.push(`Larger than the ${STD.bed} mm A1 bed.`);
  return sp;
}

// ---------- 2D/3D helpers ----------

/** Points of a rounded rectangle inset `inset` from the W x D outline, at height z. */
function slice(sp, inset, z, seg) {
  const a = sp.W / 2 - inset;
  const b = sp.D / 2 - inset;
  const rr = Math.max(STD.r - inset, 0.05);
  const pts = [];
  const corners = [[a - rr, b - rr, 0], [-(a - rr), b - rr, 90], [-(a - rr), -(b - rr), 180], [a - rr, -(b - rr), 270]];
  for (const [cx, cy, start] of corners) {
    for (let k = 0; k <= seg; k++) {
      const t = ((start + (90 * k) / seg) * Math.PI) / 180;
      pts.push([cx + rr * Math.cos(t), cy + rr * Math.sin(t), z]);
    }
  }
  return pts;
}

/** A solid made of frustums between consecutive (z, inset) breakpoints. */
function loft(M, sp, profile, seg) {
  const parts = [];
  for (let k = 0; k < profile.length - 1; k++) {
    const [z0, f0] = profile[k];
    const [z1, f1] = profile[k + 1];
    if (z1 - z0 < 1e-6) continue;
    parts.push(M.Manifold.hull([...slice(sp, f0, z0, seg), ...slice(sp, f1, z1, seg)]));
  }
  return unionAll(M, parts);
}

function unionAll(M, parts) {
  if (!parts.length) return null;
  const out = M.Manifold.union(parts);
  parts.forEach((p) => p.delete());
  return out;
}
function op(M, kind, a, b) {
  if (!b) return a;
  const out = M.Manifold[kind](a, b);
  a.delete();
  b.delete();
  return out;
}
const box = (M, x0, x1, y0, y1, z0, z1) => M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);

/** Outer inset profile f(z): chamfered foot, 45 deg flare, straight wall. */
function outerProfile(sp) {
  const { lip } = STD;
  const { s, H, chamfer } = sp;
  const prof = chamfer > 0 ? [[0, s + chamfer], [chamfer, s]] : [[0, s]];
  return [...prof, [lip, s], [lip + s, 0], [H, 0]];
}

function insetAt(profile, z) {
  if (z <= profile[0][0]) return profile[0][1];
  for (let k = 0; k < profile.length - 1; k++) {
    const [z0, f0] = profile[k];
    const [z1, f1] = profile[k + 1];
    if (z <= z1) return z1 - z0 < 1e-9 ? f1 : f0 + ((f1 - f0) * (z - z0)) / (z1 - z0);
  }
  return profile[profile.length - 1][1];
}

/** Inner wall inset at z: the outer profile eroded by a ball of radius `w` (what a CAD shell does). */
function erodedInset(profile, z, w) {
  let best = -Infinity;
  const n = 48;
  const lo = Math.max(-w, -z);
  for (let k = 0; k <= n; k++) {
    const dz = lo + ((w - lo) * k) / n;
    best = Math.max(best, insetAt(profile, z + dz) + Math.sqrt(Math.max(0, w * w - dz * dz)));
  }
  return best;
}

function cavityProfile(sp) {
  const { lip, rim } = STD;
  const { wall: w, floor, s, zr, H } = sp;
  const outer = outerProfile(sp);
  const prof = [];
  const zTop = Math.min(zr, lip + s + w);
  for (let z = floor; z < zTop - 1e-9; z += 0.1) prof.push([z, erodedInset(outer, z, w)]);
  prof.push([zTop, erodedInset(outer, zTop, w)]);
  if (zr > zTop + 1e-9) prof.push([zr, w]);
  prof.push([zr, rim], [H + 1, rim]);
  return prof;
}

// ---------- text ----------

/** Flatten an opentype.js path into closed contours ([x, y] with y up). */
function pathContours(path, curveSteps = 6) {
  const contours = [];
  let cur = [];
  let px = 0, py = 0;
  for (const c of path.commands) {
    if (c.type === 'M') { if (cur.length > 2) contours.push(cur); cur = [[c.x, -c.y]]; px = c.x; py = c.y; }
    else if (c.type === 'L') { cur.push([c.x, -c.y]); px = c.x; py = c.y; }
    else if (c.type === 'Q') {
      for (let k = 1; k <= curveSteps; k++) {
        const t = k / curveSteps, u = 1 - t;
        cur.push([u * u * px + 2 * u * t * c.x1 + t * t * c.x, -(u * u * py + 2 * u * t * c.y1 + t * t * c.y)]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'C') {
      for (let k = 1; k <= curveSteps; k++) {
        const t = k / curveSteps, u = 1 - t;
        cur.push([
          u * u * u * px + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          -(u * u * u * py + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y),
        ]);
      }
      px = c.x; py = c.y;
    } else if (c.type === 'Z') { if (cur.length > 2) contours.push(cur); cur = []; }
  }
  if (cur.length > 2) contours.push(cur);
  return contours;
}

/**
 * Lay out up to two lines of text centred in a w x h box (mm). The first line gets `split` of the height.
 * Returns contours in mm centred on (0, 0), or null.
 */
function layoutText(font, lines, w, h, { split = 0.58, maxLine = 14, gapRatio = 0.18 } = {}) {
  lines = lines.map((t) => t.trim()).filter(Boolean);
  if (!font || !lines.length || w < 4 || h < 2) return null;
  const shares = lines.length === 1 ? [1] : [split, 1 - split];
  const gap = lines.length > 1 ? h * gapRatio : 0;
  const avail = h - gap;
  const placed = [];
  for (let k = 0; k < lines.length; k++) {
    const path = font.getPath(lines[k], 0, 0, 100);
    const bb = path.getBoundingBox();
    const bw = bb.x2 - bb.x1, bh = bb.y2 - bb.y1;
    if (bw <= 0 || bh <= 0) continue;
    const scale = Math.min((avail * shares[k]) / bh, maxLine / bh, w / bw);
    placed.push({ path, bb, scale, height: bh * scale });
  }
  if (!placed.length) return null;
  const total = placed.reduce((n, p) => n + p.height, 0) + gap * (placed.length - 1);
  let top = total / 2;
  const out = [];
  for (const p of placed) {
    const cx = (p.bb.x1 + p.bb.x2) / 2, cyTop = -p.bb.y1; // y up: top of glyph box
    for (const c of pathContours(p.path)) {
      out.push(c.map(([x, y]) => [(x - cx) * p.scale, top + (y - cyTop) * p.scale]));
    }
    top -= p.height + gap;
  }
  return out;
}

function textSolid(M, contours, depth) {
  const cs = new M.CrossSection(contours, 'NonZero');
  const solid = cs.extrude(depth);
  cs.delete();
  return solid;
}

/** Text on the front face (y = -D/2), centred at (0, zc): engraved or raised. */
function frontText(M, sp, font, zLo, zHi) {
  if (sp.textStyle === 'off' || !font) return null;
  const w = sp.W - 2 * STD.r - 3;
  const h = zHi - zLo;
  const contours = layoutText(font, [sp.label, sp.brand].filter(Boolean).length === 2 ? [sp.label, sp.brand] : [sp.brand || sp.label], w, h,
    { split: 0.6, maxLine: 14 });
  if (!contours) return null;
  const zc = (zLo + zHi) / 2;
  if (sp.textStyle === 'engrave') {
    const depth = Math.min(0.6, sp.wall - 0.4);
    const t = textSolid(M, contours, depth + 0.3).rotate([90, 0, 0]);
    return { kind: 'difference', solid: t.translate([0, -sp.D / 2 + depth, zc]) };
  }
  const t = textSolid(M, contours, 0.6 + 0.1).rotate([90, 0, 0]);
  return { kind: 'union', solid: t.translate([0, -sp.D / 2 + 0.1, zc]) };
}

// ---------- wall patterns ----------

/** 2D hole polygons (u, v) filling a u0..u1 x v0..v1 region. All roofs are 45 deg or steeper. */
function holeLayout(kind, size, bar, u0, u1, v0, v1) {
  const holes = [];
  const w = u1 - u0, h = v1 - v0;
  if (w < size || h < size) return holes;
  if (kind === 'slots') {
    const sw = Math.max(2, size * 0.5);
    const pitch = sw + bar;
    const n = Math.floor((w + bar) / pitch);
    const start = u0 + (w - (n * pitch - bar)) / 2 + sw / 2;
    for (let k = 0; k < n; k++) {
      const c = start + k * pitch;
      holes.push([[c - sw / 2, v0 + sw / 2], [c, v0], [c + sw / 2, v0 + sw / 2], [c + sw / 2, v1 - sw / 2], [c, v1], [c - sw / 2, v1 - sw / 2]]);
    }
    return holes;
  }
  // diamond: half-diagonal a; hex: vertical hexagon with 45 deg roofs
  const a = size / 2;
  const b = kind === 'hex' ? size * 0.42 : a;          // half width
  const c = kind === 'hex' ? a - b : 0;                // half height of the vertical sides
  const pu = 2 * b + bar * Math.SQRT2;                  // column pitch
  const pv = kind === 'hex' ? a + c + bar : a + bar * Math.SQRT2 / 2; // row pitch (staggered rows)
  const cols = Math.floor((w - 2 * b) / pu) + 1;
  const rows = Math.floor((h - 2 * a) / pv) + 1;
  if (cols < 1 || rows < 1) return holes;
  const uStart = u0 + (w - ((cols - 1) * pu + 2 * b)) / 2 + b;
  const vStart = v0 + (h - ((rows - 1) * pv + 2 * a)) / 2 + a;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? pu / 2 : 0;
    for (let k = 0; k < cols; k++) {
      const cu = uStart + k * pu + off;
      if (cu + b > u1 + 1e-6) continue;
      const cv = vStart + r * pv;
      holes.push(kind === 'hex'
        ? [[cu, cv - a], [cu + b, cv - c], [cu + b, cv + c], [cu, cv + a], [cu - b, cv + c], [cu - b, cv - c]]
        : [[cu, cv - a], [cu + b, cv], [cu, cv + a], [cu - b, cv]]);
    }
  }
  return holes;
}

/** Cutters for the side and back walls. */
function wallPatternCutters(M, sp) {
  if (sp.pattern === 'none') return null;
  const { r, lip } = STD;
  const m = 3;
  const zLo = lip + sp.s + sp.chamfer + 2.5;
  const zHi = sp.zr - 2;
  const depth = Math.max(sp.wall, STD.rim) + 1.2;
  const parts = [];
  // side walls (u = y), both sides
  for (const side of [-1, 1]) {
    for (const poly of holeLayout(sp.pattern, sp.hole, sp.bar, -sp.D / 2 + r + m, sp.D / 2 - r - m, zLo, zHi)) {
      const xo = side * (sp.W / 2 + 0.5), xi = side * (sp.W / 2 - depth + 0.5);
      parts.push(M.Manifold.hull(poly.flatMap(([u, v]) => [[xo, u, v], [xi, u, v]])));
    }
  }
  // back wall (u = x)
  for (const poly of holeLayout(sp.pattern, sp.hole, sp.bar, -sp.W / 2 + r + m, sp.W / 2 - r - m, zLo, zHi)) {
    const yo = sp.D / 2 + 0.5, yi = sp.D / 2 - depth + 0.5;
    parts.push(M.Manifold.hull(poly.flatMap(([u, v]) => [[u, yo, v], [u, yi, v]])));
  }
  return unionAll(M, parts);
}

// ---------- parts ----------

function railsAndCuts(M, sp, part, seg) {
  const { rim, railE: e, lidT, lidCv, r, lidCh } = STD;
  const { zs, lipTop, H } = sp;
  // ledge (45 deg underside) + channel + lip (45 deg underside)
  const block = loft(M, sp, [[zs - e, 0.3], [lipTop, 0.3]], seg);
  const channel = loft(M, sp, [
    [zs - e, rim], [zs, rim + e], [zs, rim], [zs + lidT + lidCv, rim], [lipTop, rim + e],
  ], seg);
  part = op(M, 'union', part, op(M, 'difference', block, channel));
  // open the front above the ledge so the lid (and its front cap) slides in
  const yc = r + 0.6;
  part = op(M, 'difference', part, box(M, -sp.W, sp.W, -sp.D / 2 - 1, -sp.D / 2 + yc, zs, H + 1));
  // snap notches in the side walls, just behind the opening
  const yN = -sp.D / 2 + yc + 2.5;
  const nd = sp.lidSnap - lidCh + 0.2;
  const L0 = 1.6;
  const notches = [];
  for (const side of [-1, 1]) {
    const xf = side * (sp.W / 2 - rim - 0.1), xb = side * (sp.W / 2 - rim + nd);
    const pts = [];
    for (const z of [zs - 0.05, zs + lidT + 0.1]) {
      pts.push([xf, yN - L0 / 2 - nd - 0.1, z], [xf, yN + L0 / 2 + nd + 0.1, z], [xb, yN - L0 / 2, z], [xb, yN + L0 / 2, z]);
    }
    notches.push(M.Manifold.hull(pts));
  }
  return op(M, 'difference', part, unionAll(M, notches));
}

function buildBin(M, sp, opts) {
  const seg = opts.segments;
  const outer = loft(M, sp, outerProfile(sp), seg);
  const cavity = loft(M, sp, cavityProfile(sp), seg);
  let part = M.Manifold.difference(outer, cavity);
  outer.delete();

  if (sp.type === 'hopper') {
    const { r, rim } = STD;
    const depth = Math.max(sp.wall, rim) + 2;
    const yc = -sp.D / 2 + rim / 2;
    part = op(M, 'difference', part, box(M, -(sp.W / 2 - r), sp.W / 2 - r, yc - depth / 2, yc + depth / 2, sp.frontH, sp.H + 1));
  }
  part = op(M, 'difference', part, wallPatternCutters(M, sp));

  // dividers and scoop live inside the cavity
  const inner = [];
  const divTop = sp.rails ? sp.zs - STD.railE - 0.3 : sp.H - STD.lip - STD.fit - 0.5;
  const dt = Math.max(sp.wall, 0.8);
  const wi = sp.W - 2 * sp.wall, di = sp.D - 2 * sp.wall;
  for (let k = 1; k <= sp.divX; k++) {
    const x = -wi / 2 + (k * wi) / (sp.divX + 1);
    inner.push(box(M, x - dt / 2, x + dt / 2, -sp.D, sp.D, 0, divTop));
  }
  for (let k = 1; k <= sp.divY; k++) {
    const y = -di / 2 + (k * di) / (sp.divY + 1);
    inner.push(box(M, -sp.W, sp.W, y - dt / 2, y + dt / 2, 0, divTop));
  }
  if (sp.scoop > 0) {
    const S = Math.min(sp.scoop, divTop - sp.floor - 1);
    const y0 = -sp.D / 2, z0 = sp.floor - 0.2;
    inner.push(M.Manifold.hull([
      [-sp.W, y0, z0], [sp.W, y0, z0], [-sp.W, y0 + S + sp.wall, z0], [sp.W, y0 + S + sp.wall, z0],
      [-sp.W, y0, z0 + S + sp.wall], [sp.W, y0, z0 + S + sp.wall],
    ]));
  }
  if (inner.length) part = op(M, 'union', part, op(M, 'intersection', unionAll(M, inner), cavity));
  else cavity.delete();

  if (sp.rails) part = railsAndCuts(M, sp, part, seg);

  // text on the front face
  const zLo = STD.lip + sp.s + sp.chamfer + 1.2;
  const zHi = sp.type === 'hopper' ? sp.frontH - 1.5 : (sp.rails ? sp.zs - 1.2 : sp.H - 1.5);
  if (zHi - zLo >= 3) {
    const t = frontText(M, sp, opts.font, zLo, zHi);
    if (t) part = op(M, t.kind, part, t.solid);
  }
  return part;
}

function buildLid(M, sp, opts) {
  const seg = opts.segments;
  const { rim, lidCh, lidT, r } = STD;
  const capH = STD.lidZ; // from the lid bottom up to the rim top
  const a = sp.W / 2 - rim - lidCh;
  const yb = sp.D / 2 - rim - lidCh;
  const rb = Math.max(r - rim - lidCh, 0.3);
  const yc = r + 0.6;
  const yFront = -sp.D / 2;

  // plate outline: square front, rounded back corners, snap bumps on both sides
  const pts = [[-a, yFront, 0], [a, yFront, 0]];
  for (const [cx, start] of [[a - rb, 0], [-(a - rb), 90]]) {
    for (let k = 0; k <= seg; k++) {
      const t = ((start + (90 * k) / seg) * Math.PI) / 180;
      pts.push([cx + rb * Math.cos(t), yb - rb + rb * Math.sin(t), 0]);
    }
  }
  const plate = M.Manifold.hull([...pts, ...pts.map(([x, y]) => [x, y, lidT])]);
  const yN = yFront + yc + 2.5;
  const bumps = [];
  for (const side of [-1, 1]) {
    const xe = side * (a - 0.2), xt = side * (a + sp.lidSnap);
    const bp = [];
    for (const z of [0, lidT]) bp.push([xe, yN - 0.6 - sp.lidSnap - 0.2, z], [xe, yN + 0.6 + sp.lidSnap + 0.2, z], [xt, yN - 0.6, z], [xt, yN + 0.6, z]);
    bumps.push(M.Manifold.hull(bp));
  }
  let lid = op(M, 'union', plate, unionAll(M, bumps));

  // front cap: rebuilds the box's front wall and corners above the ledge
  const capSp = { ...sp, H: capH };
  const outerPrism = loft(M, capSp, [[0, 0], [capH, 0]], seg);
  const innerPrism = loft(M, capSp, [[lidT, rim], [capH + 1, rim]], seg);
  const slab = box(M, -sp.W, sp.W, yFront - 1, yFront + yc - lidCh, -1, capH + 2);
  const cap = op(M, 'intersection', op(M, 'difference', outerPrism, innerPrism), slab);
  lid = op(M, 'union', lid, cap);
  // trim the plate's front corners to the rounded outline
  lid = op(M, 'intersection', lid, loft(M, capSp, [[-1, 0], [capH + 1, 0]], seg));
  if (sp.lidPull === 'notch') {
    // finger notch in the cap
    const fr = 7;
    const notch = M.Manifold.cylinder(rim + 2, fr, fr, seg * 4).rotate([-90, 0, 0]).translate([0, yFront - 1, capH + fr - 3.2]);
    lid = op(M, 'difference', lid, notch);
  } else {
    // pinch tab: a fin on the front to grip between thumb and finger and pull
    const t = 2, out = 8, h = capH - 1, rr = 2.5;
    const fin = [];
    for (const x of [-t / 2, t / 2]) {
      fin.push([x, yFront + 0.6, 0], [x, yFront + 0.6, h], [x, yFront - out + rr, 0], [x, yFront - out, h - rr], [x, yFront - out + rr * 0.3, h - rr * 0.3]);
      fin.push([x, yFront - out + rr, h], [x, yFront - out, 0.8]);
    }
    lid = op(M, 'union', lid, M.Manifold.hull(fin));
  }

  // weight-saving pattern in the plate
  if (sp.lidPattern !== 'none') {
    const holes = holeLayout(sp.lidPattern, sp.hole, sp.bar, -a + 4, a - 4, yFront + yc + 6, yb - 4);
    const cut = unionAll(M, holes.map((poly) => M.Manifold.hull(poly.flatMap(([u, v]) => [[u, v, -1], [u, v, lidT + 1]]))));
    lid = op(M, 'difference', lid, cut);
  }
  // brand on top
  if (sp.lidBrand && sp.textStyle !== 'off' && opts.font && sp.lidPattern === 'none') {
    const tw = 2 * a - 12, th = Math.min(12, (sp.D - yc) * 0.18);
    const contours = layoutText(opts.font, [sp.brand || sp.label], tw, th, { maxLine: 12 });
    if (contours) {
      const t = textSolid(M, contours, 0.5).translate([0, (yFront + yc + yb) / 2, lidT - 0.05]);
      lid = op(M, 'union', lid, t);
    }
  }
  return lid;
}

/**
 * Build one part. `M` is the initialised manifold-3d module (after setup()).
 * opts: { segments, font } (font: an opentype.js Font, needed only for text).
 * Returns the Manifold; the caller owns it and must call delete().
 */
export function buildPart(M, input, { segments = 10, font = null } = {}) {
  const sp = resolveSpec(input);
  return sp.type === 'lid' ? buildLid(M, sp, { segments, font }) : buildBin(M, sp, { segments, font });
}

/** Where a lid sits on its box (for previews): z offset of the lid's bottom. */
export const lidSeat = (spec) => resolveSpec({ ...spec, type: 'box' }).zs;

/** Plain-array mesh of a Manifold: { positions: Float32Array, indices: Uint32Array }. */
export function toMesh(manifold) {
  const mesh = manifold.getMesh();
  const { numProp, vertProperties, triVerts } = mesh;
  const nv = vertProperties.length / numProp;
  const positions = new Float32Array(nv * 3);
  for (let k = 0; k < nv; k++) {
    positions[k * 3] = vertProperties[k * numProp];
    positions[k * 3 + 1] = vertProperties[k * numProp + 1];
    positions[k * 3 + 2] = vertProperties[k * numProp + 2];
  }
  return { positions, indices: new Uint32Array(triVerts) };
}

/** Grams of filament for a volume in mm3 (PLA 1.24 g/cm3 by default). */
export const grams = (mm3, density = 1.24) => (mm3 / 1000) * density;
/** Metres of 1.75 mm filament for a volume in mm3. */
export const metres = (mm3) => mm3 / (Math.PI * 0.875 * 0.875) / 1000;
/** Rough A1 print time in minutes: thin-walled parts print at ~9 mm3/s effective, plus warm-up. */
export const printMinutes = (mm3) => 6 + mm3 / 9 / 60;
