// AESS geometry core: builds every AESS part with the Manifold kernel.
// The bin body (foot, flare, walls, fixed rim, hopper opening) mirrors cad/aess_master.sc,
// and test/core.test.js checks the volumes against SolidCraft. Everything else (slide-lid
// rails and lids, text, patterns, ribs, dividers, inserts, bases, caddies) is defined here;
// see docs/STANDARD.md.

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
  // inserts
  insClr: 0.4,  // clearance between an insert and the box wall
  trayIn: 2.6,  // tray outline inset (clears the lid lips at 2.2)
  trayLedge: 3.2, // tray ledge reaches this far in from the outside
});

export const WALLS = Object.freeze({ lite: 0.8, std: 1.2, heavy: 1.6 });
export const LID_FITS = Object.freeze({ loose: 0.6, standard: 0.7, tight: 0.8 });
export const TYPES = Object.freeze({
  hopper: { code: 'HOP', label: 'Hopper', group: 'bin' },
  box: { code: 'BOX', label: 'Box', group: 'bin' },
  lid: { code: 'LID', label: 'Slide lid', group: 'lid' },
  cup: { code: 'CUP', label: 'Cups', group: 'insert' },
  tray: { code: 'TRAY', label: 'Lift-out tray', group: 'insert' },
  holder: { code: 'HOLD', label: 'Holder', group: 'insert' },
  base: { code: 'BASE', label: 'Base plate', group: 'structure' },
  caddy: { code: 'CADDY', label: 'Carry caddy', group: 'structure' },
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
  pattern: 'none', hole: 6, bar: 2.4,
  divX: 0, divY: 0, scoop: 0,
  floorRibs: 'none', ribH: 3, wallRibs: false, gusset: 0,
  sideSlope: 0, grips: false, gauge: false,
  brand: 'Akshay Enterprises', label: '', textStyle: 'engrave',
  lidRails: true, lidSnap: LID_FITS.standard, lidPull: 'tab', lidStyle: 'plain', lidPattern: 'none', lidBrand: true,
  dispHole: 12, labelTape: 24, trayDepth: 0,
  cupsX: 2, cupsY: 2,
  holderMode: 'drill', holderH: 0, gridHole: 8, gridPitch: 14,
  baseCols: 1, baseRows: 1, basePads: 'rubber',
  caddyCols: 4, caddyRows: 2, caddyH: 60,
});

const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = (v) => String(+v.toFixed(2));
const pick = (v, list, d) => (list.includes(v) ? v : d);

/** Normalise and validate a part spec; returns a full spec with every derived size. */
export function resolveSpec(input = {}) {
  const i = { ...DEFAULTS, ...input };
  const type = TYPES[i.type] ? i.type : 'hopper';
  const group = TYPES[type].group;
  const { lip, fit, rim, gap, lidZ, railE, lidT, lidCv } = STD;
  const warnings = [];

  const wall = clamp(typeof i.wall === 'number' ? i.wall : (WALLS[i.wall] ?? WALLS.std), 0.8, 1.6);
  const floor = clamp(num(i.floor, wall), 0.8, 3);
  const chamfer = clamp(num(i.chamfer, 0), 0, 0.8);

  // the host box: bins describe themselves; lids and inserts describe the box they fit
  let W, D, H, nx = null, ny = null, nh = null;
  const system = SYSTEMS[i.system] ? i.system : 'metric';
  const sys = SYSTEMS[system];
  const U = clamp(num(i.U, sys.U), 20, 128);
  const hu = clamp(num(i.hu, sys.hu), 3, 50);
  const sizeMode = i.sizeMode === 'custom' ? 'custom' : 'grid';
  const isHopper = type === 'hopper';
  if (sizeMode === 'grid') {
    nx = Math.round(clamp(num(i.nx, 2), 1, 20));
    ny = Math.round(clamp(num(i.ny, 3), 1, 20));
    nh = Math.round(clamp(num(i.nh, 7), isHopper ? 2 : 1, 60));
    W = nx * U - gap;
    D = ny * U - gap;
    H = nh * hu + lip + fit;
  } else {
    W = clamp(num(i.W, 84), 24, 400);
    D = clamp(num(i.D, 126), 24, 400);
    H = clamp(num(i.H, 53), 11, 400);
  }
  const minH = isHopper ? 18 : 11;
  if (H < minH) { H = minH; if (sizeMode === 'custom' && group === 'bin') warnings.push(`Raised to the ${minH} mm minimum height.`); }

  const s = rim + fit;
  const hostIsBox = type !== 'hopper';
  const rails = hostIsBox && i.lidRails !== false && H >= 18;
  if (type === 'box' && i.lidRails !== false && !rails) warnings.push('Slide-lid rails need a box at least 18 mm tall.');
  const zs = H - lidZ;                       // lid bottom / ledge top
  const lipTop = zs + lidT + lidCv + railE;  // = H - 4.6, below the next bin's foot
  const usableTop = rails ? zs - railE - 0.5 : H - lip - fit - 0.5; // nothing inside may rise above this
  let trayDepth = hostIsBox ? clamp(num(i.trayDepth, 0), 0, 80) : 0;
  const trayTop = usableTop;
  if (trayDepth && trayTop - trayDepth < floor + 8) { trayDepth = 0; warnings.push('The box is too shallow for that tray.'); }
  const trayZ = trayDepth ? trayTop - trayDepth : null; // tray bottom = tray-ledge top
  const zr = Math.min(H - lip - fit - 1, rails ? zs - railE - 1 : Infinity, trayZ != null ? trayZ - (STD.trayLedge - rim) - 1 : Infinity);
  const frontRatio = isHopper ? clamp(num(i.frontRatio, 0.4), 0.15, 0.9) : 1;
  const frontH = H * frontRatio;

  const floorRibs = pick(i.floorRibs, ['none', 'long', 'cross'], 'none');
  const ribH = clamp(num(i.ribH, 3), 1.5, 6);
  const sp = {
    type, group, system, sizeMode, U, hu, nx, ny, nh, W, D, H, wall, floor, chamfer, frontRatio, frontH, s, rails, zs, lipTop, zr,
    usableTop, trayDepth, trayZ, warnings,
    pattern: pick(i.pattern, PATTERNS, 'none'),
    hole: clamp(num(i.hole, 6), 3, 20),
    bar: clamp(num(i.bar, 2.4), 1.2, 8),
    divX: Math.round(clamp(num(i.divX, 0), 0, 30)),
    divY: Math.round(clamp(num(i.divY, 0), 0, 30)),
    scoop: clamp(num(i.scoop, 0), 0, 30),
    floorRibs, ribH,
    ribTop: floor + (floorRibs === 'none' ? 0 : ribH),
    wallRibs: !!i.wallRibs && i.pattern === 'none',
    gusset: clamp(num(i.gusset, 0), 0, 10),
    sideSlope: isHopper ? clamp(num(i.sideSlope, 0), 0, 0.5) : 0,
    grips: !!i.grips,
    gauge: !!i.gauge,
    brand: String(i.brand ?? '').slice(0, 40),
    label: String(i.label ?? '').slice(0, 40),
    textStyle: pick(i.textStyle, ['engrave', 'raise', 'off'], 'engrave'),
    lidSnap: clamp(num(i.lidSnap, LID_FITS.standard), 0.5, 0.9),
    lidPull: pick(i.lidPull, ['tab', 'notch'], 'tab'),
    lidStyle: pick(i.lidStyle, ['plain', 'window', 'label', 'dispenser'], 'plain'),
    lidPattern: pick(i.lidPattern, ['none', 'diamond', 'hex'], 'none'),
    lidBrand: i.lidBrand !== false,
    dispHole: clamp(num(i.dispHole, 12), 4, 40),
    labelTape: pick(num(i.labelTape, 24), [12, 18, 24, 36], 24),
    cupsX: Math.round(clamp(num(i.cupsX, 2), 1, 8)),
    cupsY: Math.round(clamp(num(i.cupsY, 2), 1, 8)),
    holderMode: pick(i.holderMode, ['drill', 'hex', 'grid'], 'drill'),
    holderH: clamp(num(i.holderH, 0), 0, 200),
    gridHole: clamp(num(i.gridHole, 8), 3, 40),
    gridPitch: clamp(num(i.gridPitch, 14), 6, 60),
    baseCols: Math.round(clamp(num(i.baseCols, 1), 1, 6)),
    baseRows: Math.round(clamp(num(i.baseRows, 1), 1, 6)),
    basePads: pick(i.basePads, ['none', 'rubber', 'magnet'], 'rubber'),
    caddyCols: Math.round(clamp(num(i.caddyCols, 4), 1, 6)),
    caddyRows: Math.round(clamp(num(i.caddyRows, 2), 1, 4)),
    caddyH: clamp(num(i.caddyH, 60), 30, 150),
  };
  if (type === 'tray' && !sp.trayDepth) {
    sp.trayDepth = autoTrayDepth(sp);
    sp.trayZ = trayTop - sp.trayDepth;
  }

  // names
  const wallTag = Object.entries(WALLS).find(([, v]) => Math.abs(v - wall) < 1e-9)?.[0].toUpperCase() ?? `${fmt(wall)}MM`;
  const imp = system === 'imperial';
  const gridTag = imp
    ? `-G${fmt(U / 25.4)}IN${Math.abs(hu - sys.hu) > 1e-9 ? `-H${fmt(hu / 25.4)}IN` : ''}`
    : `${Math.abs(U - sys.U) > 1e-9 ? `-G${fmt(U)}` : ''}${Math.abs(hu - sys.hu) > 1e-9 ? `-H${fmt(hu)}` : ''}`;
  const foot = sizeMode === 'grid' ? `${nx}x${ny}` : imp ? `${fmt(W / 25.4)}x${fmt(D / 25.4)}IN` : `${fmt(W)}x${fmt(D)}MM`;
  const full = sizeMode === 'grid' ? `${nx}x${ny}x${nh}${gridTag}` : imp ? `${fmt(W / 25.4)}x${fmt(D / 25.4)}x${fmt(H / 25.4)}IN` : `${fmt(W)}x${fmt(D)}x${fmt(H)}MM`;
  const code = TYPES[type].code;
  const nonStdSnap = Math.abs(sp.lidSnap - LID_FITS.standard) > 1e-9 ? `-S${fmt(sp.lidSnap)}` : '';
  if (type === 'lid') sp.name = `AESS-LID-${foot}${sizeMode === 'grid' ? gridTag : ''}${sp.lidStyle !== 'plain' ? `-${sp.lidStyle.toUpperCase()}` : ''}${nonStdSnap}`;
  else if (type === 'cup') sp.name = `AESS-CUP-${full}-${sp.cupsX}x${sp.cupsY}`;
  else if (type === 'tray') sp.name = `AESS-TRAY-${full}-D${fmt(sp.trayDepth)}`;
  else if (type === 'holder') sp.name = `AESS-HOLD-${full}-${sp.holderMode.toUpperCase()}`;
  else if (type === 'base') sp.name = `AESS-BASE-${foot}${sizeMode === 'grid' ? gridTag : ''}-${sp.baseCols}x${sp.baseRows}`;
  else if (type === 'caddy') sp.name = `AESS-CADDY-${sp.caddyCols}x${sp.caddyRows}${sizeMode === 'grid' && gridTag ? gridTag : ''}`;
  else sp.name = `AESS-${code}-${full}-${wallTag}${type === 'box' && !rails ? '-OPEN' : ''}`;

  // printed size of the part itself
  if (type === 'lid') Object.assign(sp, { pW: W, pD: D + (sp.lidPull === 'tab' ? 8 : 0), pH: lidZ });
  else if (type === 'base') Object.assign(sp, { pW: sp.baseCols * (W + gap) - gap, pD: sp.baseRows * (D + gap) - gap, pH: baseHeight(sp) });
  else if (type === 'caddy') {
    const cw = (sizeMode === 'grid' ? U - gap : 41.5) + 1;
    Object.assign(sp, { cell: cw, pW: sp.caddyCols * (cw + 1.6) + 1.6, pD: sp.caddyRows * (cw + 1.6) + 1.6 + (sp.caddyRows > 1 ? 3 : 0), pH: sp.caddyH });
  } else Object.assign(sp, { pW: W, pD: D, pH: H });
  if (sp.pW > STD.bed || sp.pD > STD.bed || sp.pH > STD.bed) warnings.push(`Larger than the ${STD.bed} mm A1 bed.`);
  return sp;
}

/** A sensible tray depth for a box: about a third of its usable height. */
export const autoTrayDepth = (sp) => Math.max(12, Math.round((sp.usableTop - sp.floor) * 0.35));

const baseHeight = (sp) => baseFloor(sp) + STD.lip + STD.fit + 1;
const baseFloor = (sp) => (sp.basePads === 'magnet' ? 3.2 : 2.0);

// ---------- 2D/3D helpers ----------

/** Points of a rounded rectangle (half sizes a, b, corner radius rr) at height z, centred at (cx, cy). */
function rrect(a, b, rr, z, seg, cx = 0, cy = 0) {
  rr = Math.max(Math.min(rr, a - 0.01, b - 0.01), 0.05);
  const pts = [];
  const corners = [[a - rr, b - rr, 0], [-(a - rr), b - rr, 90], [-(a - rr), -(b - rr), 180], [a - rr, -(b - rr), 270]];
  for (const [x, y, start] of corners) {
    for (let k = 0; k <= seg; k++) {
      const t = ((start + (90 * k) / seg) * Math.PI) / 180;
      pts.push([cx + x + rr * Math.cos(t), cy + y + rr * Math.sin(t), z]);
    }
  }
  return pts;
}
/** Points of the W x D outline inset `inset`, at height z. */
const slice = (sp, inset, z, seg) => rrect(sp.W / 2 - inset, sp.D / 2 - inset, STD.r - inset, z, seg);

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
/** Rounded-rectangle prism. */
const rprism = (M, a, b, rr, z0, z1, seg, cx = 0, cy = 0) => M.Manifold.hull([...rrect(a, b, rr, z0, seg, cx, cy), ...rrect(a, b, rr, z1, seg, cx, cy)]);

function unionAll(M, parts) {
  parts = parts.filter(Boolean);
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  const out = M.Manifold.union(parts);
  parts.forEach((p) => p.delete());
  return out;
}
function op(M, kind, a, b) {
  if (!b) return a;
  if (!a) return kind === 'union' ? b : (b.delete(), null);
  const out = M.Manifold[kind](a, b);
  a.delete();
  b.delete();
  return out;
}
const box = (M, x0, x1, y0, y1, z0, z1) => M.Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);
/** Prism through a vertical wall from a 2D polygon (u, v) on the plane x = const or y = const. */
function wallPrism(M, poly, axis, a0, a1) {
  return M.Manifold.hull(poly.flatMap(([u, v]) => (axis === 'x' ? [[a0, u, v], [a1, u, v]] : [[u, a0, v], [u, a1, v]])));
}

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

/** The widest the box wall reaches inward between z0 and z1 (inserts must clear it). */
function maxInsetBetween(sp, z0, z1) {
  const prof = cavityProfile(sp);
  let m = 0;
  for (let z = z0; z <= z1 + 1e-9; z += 0.25) m = Math.max(m, insetAt(prof, z));
  return Math.max(m, insetAt(prof, z1)) + (z0 < sp.floor + sp.gusset + 0.01 ? sp.gusset : 0);
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

/** Lay out up to two lines of text centred in a w x h box (mm). Returns contours centred on (0, 0), or null. */
function layoutText(font, lines, w, h, { split = 0.58, maxLine = 14, gapRatio = 0.18 } = {}) {
  lines = lines.map((t) => String(t).trim()).filter(Boolean);
  if (!font || !lines.length || w < 3 || h < 1.5) return null;
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
    const cx = (p.bb.x1 + p.bb.x2) / 2, cyTop = -p.bb.y1;
    for (const c of pathContours(p.path)) out.push(c.map(([x, y]) => [(x - cx) * p.scale, top + (y - cyTop) * p.scale]));
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

/** Text on the front face (y = -D/2) between zLo and zHi: engraved or raised. */
function frontText(M, sp, font, zLo, zHi) {
  if (sp.textStyle === 'off' || !font) return null;
  const lines = sp.label && sp.brand ? [sp.label, sp.brand] : [sp.brand || sp.label];
  const contours = layoutText(font, lines, sp.W - 2 * STD.r - 3, zHi - zLo, { split: 0.6, maxLine: 14 });
  if (!contours) return null;
  const zc = (zLo + zHi) / 2;
  if (sp.textStyle === 'engrave') {
    const depth = Math.min(0.6, sp.wall - 0.4);
    return { kind: 'difference', solid: textSolid(M, contours, depth + 0.3).rotate([90, 0, 0]).translate([0, -sp.D / 2 + depth, zc]) };
  }
  return { kind: 'union', solid: textSolid(M, contours, 0.7).rotate([90, 0, 0]).translate([0, -sp.D / 2 + 0.1, zc]) };
}

// ---------- patterns ----------

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
  const a = size / 2;
  const b = kind === 'hex' ? size * 0.42 : a;
  const c = kind === 'hex' ? a - b : 0;
  const pu = 2 * b + bar * Math.SQRT2;
  const pv = kind === 'hex' ? a + c + bar : a + bar * Math.SQRT2 / 2;
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

/** Teardrop (round hole with a 45 deg peak) for holes in vertical walls, centred at (cu, cv). */
function teardrop(cu, cv, r, n = 16) {
  const pts = [];
  for (let k = 0; k <= n; k++) {
    const t = ((135 + (270 * k) / n) * Math.PI) / 180;
    pts.push([cu + r * Math.cos(t), cv + r * Math.sin(t)]);
  }
  pts.push([cu, cv + r * Math.SQRT2]);
  return pts;
}

const wallZone = (sp) => ({ zLo: STD.lip + sp.s + sp.chamfer + 2.5, zHi: sp.zr - 2 });

function wallPatternCutters(M, sp) {
  if (sp.pattern === 'none') return null;
  const { r } = STD;
  const m = 3;
  const { zLo, zHi } = wallZone(sp);
  const depth = Math.max(sp.wall, STD.rim) + 1.2;
  const parts = [];
  for (const side of [-1, 1]) {
    for (const poly of holeLayout(sp.pattern, sp.hole, sp.bar, -sp.D / 2 + r + m, sp.D / 2 - r - m, zLo, zHi)) {
      parts.push(wallPrism(M, poly, 'x', side * (sp.W / 2 + 0.5), side * (sp.W / 2 - depth + 0.5)));
    }
  }
  for (const poly of holeLayout(sp.pattern, sp.hole, sp.bar, -sp.W / 2 + r + m, sp.W / 2 - r - m, zLo, zHi)) {
    parts.push(wallPrism(M, poly, 'y', sp.D / 2 + 0.5, sp.D / 2 - depth + 0.5));
  }
  return unionAll(M, parts);
}

// ---------- bins ----------

function railsAndCuts(M, sp, part, seg) {
  const { rim, railE: e, lidT, lidCv, r, lidCh } = STD;
  const { zs, lipTop, H } = sp;
  const block = loft(M, sp, [[zs - e, 0.3], [lipTop, 0.3]], seg);
  const channel = loft(M, sp, [[zs - e, rim], [zs, rim + e], [zs, rim], [zs + lidT + lidCv, rim], [lipTop, rim + e]], seg);
  part = op(M, 'union', part, op(M, 'difference', block, channel));
  const yc = r + 0.6;
  part = op(M, 'difference', part, box(M, -sp.W, sp.W, -sp.D / 2 - 1, -sp.D / 2 + yc, zs, H + 1));
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

/** A ledge ring for the lift-out tray: flat top at z, 45 deg underside, reaching STD.trayLedge in. */
function trayLedge(M, sp, seg) {
  const z = sp.trayZ, w = sp.wall, reach = STD.trayLedge;
  const block = loft(M, sp, [[z - (reach - w) - 0.01, 0.3], [z, 0.3]], seg);
  const inner = loft(M, sp, [[z - (reach - w) - 0.01, w], [z, reach]], seg);
  return op(M, 'difference', block, inner);
}

/** Thread-check holes (and their size labels) through the +X side wall. */
function gaugeCutters(M, sp, font) {
  const sizes = sp.system === 'imperial'
    ? [['#6', 3.5], ['#8', 4.17], ['#10', 4.83], ['1/4', 6.35], ['5/16', 7.94], ['3/8', 9.53], ['1/2', 12.7]]
    : [['M3', 3], ['M4', 4], ['M5', 5], ['M6', 6], ['M8', 8], ['M10', 10], ['M12', 12]];
  const { zLo, zHi } = wallZone(sp);
  const textH = 3.2;
  const parts = [];
  const texts = [];
  let u = -sp.D / 2 + STD.r + 4;
  const uMax = sp.D / 2 - STD.r - 4;
  const x0 = sp.W / 2 + 0.5, x1 = sp.W / 2 - Math.max(sp.wall, STD.rim) - 0.6;
  for (const [label, d] of sizes) {
    const r = (d + 0.3) / 2;
    const need = 2 * r + 4;
    const cv = zLo + textH + 2 + r;
    if (u + need > uMax || cv + r * Math.SQRT2 > zHi) break;
    const cu = u + need / 2;
    parts.push(wallPrism(M, teardrop(cu, cv, r), 'x', x0, x1));
    if (font && sp.textStyle !== 'off') {
      const c = layoutText(font, [label], need - 1, textH, { maxLine: textH });
      if (c) {
        const depth = Math.min(0.5, sp.wall - 0.4);
        // text on +X face reads left to right as +Y
        texts.push(textSolid(M, c, depth + 0.3).rotate([90, 0, 90]).translate([sp.W / 2 - depth, cu, zLo + textH / 2 + 0.5]));
      }
    }
    u += need;
  }
  return unionAll(M, [...parts, ...texts]);
}

function buildBin(M, sp, opts) {
  const seg = opts.segments;
  const outer = loft(M, sp, outerProfile(sp), seg);
  const cavProf = cavityProfile(sp);
  const cavity = loft(M, sp, cavProf, seg);
  let part = M.Manifold.difference(outer, cavity);
  outer.delete();

  if (sp.type === 'hopper') {
    const { r, rim } = STD;
    const depth = Math.max(sp.wall, rim) + 2;
    const yc = -sp.D / 2 + rim / 2;
    part = op(M, 'difference', part, box(M, -(sp.W / 2 - r), sp.W / 2 - r, yc - depth / 2, yc + depth / 2, sp.frontH, sp.H + 1));
    if (sp.sideSlope > 0) {
      const L = sp.sideSlope * sp.D, y0 = -sp.D / 2;
      const pts = [];
      for (const x of [-sp.W, sp.W]) pts.push([x, y0 - 1, sp.frontH], [x, y0, sp.frontH], [x, y0 + L, sp.H], [x, y0 + L, sp.H + 1], [x, y0 - 1, sp.H + 1]);
      part = op(M, 'difference', part, M.Manifold.hull(pts));
    }
  }
  part = op(M, 'difference', part, wallPatternCutters(M, sp));

  // everything inside the cavity: dividers, ribs, gussets, scoop
  const inner = [];
  const divTop = (sp.trayZ != null ? sp.trayZ - (STD.trayLedge - sp.wall) - 0.3 : sp.usableTop + 0.2);
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
  if (sp.floorRibs !== 'none') {
    // ribs on the half grid with 45 deg chamfered tops, so parts slide over them
    const rw = 1.2, h = sp.ribH, z0 = sp.floor - 0.1, z1 = sp.floor + h;
    const pitch = (sp.sizeMode === 'grid' ? sp.U : 42) / 2;
    const ribX = (x) => M.Manifold.hull([-1, 1].flatMap((sy) => [[x - rw / 2, sy * sp.D, z0], [x + rw / 2, sy * sp.D, z0], [x - rw / 2, sy * sp.D, z1 - rw / 2], [x + rw / 2, sy * sp.D, z1 - rw / 2], [x, sy * sp.D, z1]]));
    const ribY = (y) => M.Manifold.hull([-1, 1].flatMap((sx) => [[sx * sp.W, y - rw / 2, z0], [sx * sp.W, y + rw / 2, z0], [sx * sp.W, y - rw / 2, z1 - rw / 2], [sx * sp.W, y + rw / 2, z1 - rw / 2], [sx * sp.W, y, z1]]));
    const span = (L) => { const n = Math.max(1, Math.round(L / pitch)); return Array.from({ length: n - 1 }, (_, k) => -L / 2 + ((k + 1) * L) / n); };
    for (const x of span(sp.W)) inner.push(ribX(x));               // lengthwise (front to back)
    if (sp.floorRibs === 'cross') for (const y of span(sp.D)) inner.push(ribY(y));
  }
  if (sp.wallRibs) {
    const pitch = (sp.sizeMode === 'grid' ? sp.U : 42) / 2;
    const p = 1.5, rw = 1.2, z0 = sp.floor - 0.1, z1 = Math.min(sp.zr, sp.trayZ ?? Infinity) - 0.5;
    const iw = sp.wall;
    const span = (L) => { const n = Math.max(1, Math.round(L / pitch)); return Array.from({ length: n - 1 }, (_, k) => -L / 2 + ((k + 1) * L) / n); };
    // vertical ribs with a 45 deg top on the side walls (x = +-W/2) and the back wall
    for (const side of [-1, 1]) {
      for (const y of span(sp.D)) {
        const xo = side * (sp.W / 2 - iw + 0.2), xi = side * (sp.W / 2 - iw - p);
        inner.push(M.Manifold.hull([[xo, y - rw / 2, z0], [xo, y + rw / 2, z0], [xi, y - rw / 2, z0], [xi, y + rw / 2, z0], [xo, y - rw / 2, z1], [xo, y + rw / 2, z1], [xi, y - rw / 2, z1 - p], [xi, y + rw / 2, z1 - p]]));
      }
    }
    for (const x of span(sp.W)) {
      const yo = sp.D / 2 - iw + 0.2, yi = sp.D / 2 - iw - p;
      inner.push(M.Manifold.hull([[x - rw / 2, yo, z0], [x + rw / 2, yo, z0], [x - rw / 2, yi, z0], [x + rw / 2, yi, z0], [x - rw / 2, yo, z1], [x + rw / 2, yo, z1], [x - rw / 2, yi, z1 - p], [x + rw / 2, yi, z1 - p]]));
    }
  }
  if (sp.gusset > 0) {
    // 45 deg fillet where the floor meets the walls: stiffer corners, nothing gets stuck
    const g = sp.gusset, f = sp.floor;
    const I = insetAt(cavProf, f + g);
    const slab = loft(M, sp, [[f - 0.1, 0.2], [f + g, 0.2]], seg);
    const core = loft(M, sp, [[f - 0.1, I + g + 0.1], [f + g, I]], seg);
    inner.push(op(M, 'difference', slab, core));
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

  if (sp.trayZ != null && sp.type === 'box') part = op(M, 'union', part, trayLedge(M, sp, seg));
  if (sp.rails) part = railsAndCuts(M, sp, part, seg);

  // finger grips through the short sides, just below the rim zone
  if (sp.grips) {
    const gw = Math.min(30, sp.D - 2 * STD.r - 10), gh = 12;
    const top = Math.min(sp.zr, sp.trayZ ?? Infinity) - 3;
    const bottom = top - gh;
    if (gw >= 16 && bottom > STD.lip + sp.s + 4) {
      const ch = 6;
      const poly = [[-gw / 2, bottom], [gw / 2, bottom], [gw / 2, top - ch], [gw / 2 - ch, top], [-gw / 2 + ch, top], [-gw / 2, top - ch]];
      const depth = Math.max(sp.wall, STD.rim) + 1.5;
      part = op(M, 'difference', part, unionAll(M, [-1, 1].map((side) => wallPrism(M, poly, 'x', side * (sp.W / 2 + 0.5), side * (sp.W / 2 - depth)))));
    } else sp.warnings.push('Too small for finger grips.');
  }
  if (sp.gauge) part = op(M, 'difference', part, gaugeCutters(M, sp, opts.font));

  // text on the front face
  const zLo = STD.lip + sp.s + sp.chamfer + 1.2;
  const zHi = sp.type === 'hopper' ? sp.frontH - 1.5 : (sp.rails ? sp.zs - 1.2 : sp.H - 1.5);
  if (zHi - zLo >= 3) {
    const t = frontText(M, sp, opts.font, zLo, zHi);
    if (t) part = op(M, t.kind, part, t.solid);
  }
  return part;
}

// ---------- slide lid ----------

function buildLid(M, sp, opts) {
  const seg = opts.segments;
  const { rim, lidCh, lidT, r } = STD;
  const capH = STD.lidZ;
  const a = sp.W / 2 - rim - lidCh;
  const yb = sp.D / 2 - rim - lidCh;
  const rb = Math.max(r - rim - lidCh, 0.3);
  const yc = r + 0.6;
  const yFront = -sp.D / 2;

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

  const capSp = { ...sp, H: capH };
  const outerPrism = loft(M, capSp, [[0, 0], [capH, 0]], seg);
  const innerPrism = loft(M, capSp, [[lidT, rim], [capH + 1, rim]], seg);
  const slab = box(M, -sp.W, sp.W, yFront - 1, yFront + yc - lidCh, -1, capH + 2);
  lid = op(M, 'union', lid, op(M, 'intersection', op(M, 'difference', outerPrism, innerPrism), slab));
  lid = op(M, 'intersection', lid, loft(M, capSp, [[-1, 0], [capH + 1, 0]], seg));
  if (sp.lidPull === 'notch') {
    const fr = 7;
    lid = op(M, 'difference', lid, M.Manifold.cylinder(rim + 2, fr, fr, seg * 4).rotate([-90, 0, 0]).translate([0, yFront - 1, capH + fr - 3.2]));
  } else {
    const t = 2, out = 8, h = capH - 1, rr = 2.5;
    const fin = [];
    for (const x of [-t / 2, t / 2]) {
      fin.push([x, yFront + 0.6, 0], [x, yFront + 0.6, h], [x, yFront - out + rr, 0], [x, yFront - out, h - rr], [x, yFront - out + rr * 0.3, h - rr * 0.3]);
      fin.push([x, yFront - out + rr, h], [x, yFront - out, 0.8]);
    }
    lid = op(M, 'union', lid, M.Manifold.hull(fin));
  }

  // the usable top area of the plate (behind the cap)
  const ax0 = -a + 4, ax1 = a - 4, ay0 = yFront + yc + 6, ay1 = yb - 4;
  const acx = 0, acy = (ay0 + ay1) / 2;
  let brandArea = { w: 2 * a - 12, cy: acy, h: Math.min(12, (sp.D - yc) * 0.18) };
  if (sp.lidStyle === 'window') {
    const wa = Math.max(4, (ax1 - ax0) / 2 - 2), wb = Math.max(4, (ay1 - ay0) / 2 - 2);
    lid = op(M, 'difference', lid, rprism(M, wa, wb, 3, -1, lidT + 1, seg, acx, acy));
    // 0.5 mm rebate, 3 mm wider: drop in a clear PET sheet cut to size (glue or tape)
    lid = op(M, 'difference', lid, rprism(M, wa + 3, wb + 3, 4, lidT - 0.5, lidT + 1, seg, acx, acy));
    brandArea = null;
  } else if (sp.lidStyle === 'label') {
    const lh = sp.labelTape + 1, lw = Math.min(ax1 - ax0, 120);
    const ly = yFront + yc + 6 + lh / 2;
    lid = op(M, 'difference', lid, rprism(M, lw / 2, lh / 2, 1.5, lidT - 0.4, lidT + 1, seg, 0, ly));
    brandArea = { w: 2 * a - 12, cy: (ly + lh / 2 + ay1) / 2, h: Math.min(10, (ay1 - ly - lh / 2) * 0.4) };
  } else if (sp.lidStyle === 'dispenser') {
    const d = Math.min(sp.dispHole, (ax1 - ax0) - 6, (ay1 - ay0) - 6);
    const collar = M.Manifold.cylinder(1.2 + 0.05, d / 2 + 2, d / 2 + 1.2, seg * 4).translate([acx, acy, lidT - 0.05]);
    lid = op(M, 'union', lid, collar);
    lid = op(M, 'difference', lid, M.Manifold.cylinder(lidT + 4, d / 2, d / 2, seg * 4).translate([acx, acy, -1]));
    brandArea = { w: 2 * a - 12, cy: (acy + d / 2 + 3 + ay1) / 2, h: Math.min(10, (ay1 - acy - d / 2 - 3) * 0.5) };
  }
  if (sp.lidPattern !== 'none' && sp.lidStyle === 'plain') {
    const holes = holeLayout(sp.lidPattern, sp.hole, sp.bar, ax0, ax1, ay0, ay1);
    lid = op(M, 'difference', lid, unionAll(M, holes.map((poly) => M.Manifold.hull(poly.flatMap(([u, v]) => [[u, v, -1], [u, v, lidT + 1]])))));
    brandArea = null;
  }
  if (brandArea && sp.lidBrand && sp.textStyle !== 'off' && opts.font && brandArea.h >= 3) {
    const contours = layoutText(opts.font, [sp.brand || sp.label], brandArea.w, brandArea.h, { maxLine: 12 });
    if (contours) lid = op(M, 'union', lid, textSolid(M, contours, 0.5).translate([0, brandArea.cy, lidT - 0.05]));
  }
  return lid;
}

// ---------- inserts (sized from the host box) ----------

/** Footprint available to inserts standing on the floor up to height zTop: half sizes and corner radius. */
function insertFootprint(sp, z0, zTop) {
  const I = maxInsetBetween(sp, z0, zTop) + STD.insClr;
  return { a: sp.W / 2 - I, b: sp.D / 2 - I, rr: Math.max(STD.r - I, 0.6), I };
}

function buildCup(M, sp, opts) {
  const seg = opts.segments;
  const z0 = sp.ribTop;
  const top = (sp.trayZ != null ? sp.trayZ - (STD.trayLedge - sp.wall) : sp.usableTop) - 0.4;
  const { a, b } = insertFootprint(sp, z0, top);
  const g = 0.5;
  const cw = (2 * a - (sp.cupsX - 1) * g) / sp.cupsX, cd = (2 * b - (sp.cupsY - 1) * g) / sp.cupsY;
  const h = top - z0;
  if (cw < 12 || cd < 12 || h < 8) sp.warnings.push('Cups would be very small: use fewer cups or a bigger box.');
  const t = 0.8, rr = Math.min(3, cw / 2 - 0.1, cd / 2 - 0.1);
  const outer = rprism(M, cw / 2, cd / 2, rr, 0, h, seg);
  // coved inside: 45 deg chamfer between floor and walls so a finger can sweep it out
  const cove = Math.min(4, cw / 4, cd / 4);
  const ia = cw / 2 - t, ib = cd / 2 - t, irr = Math.max(rr - t, 0.3);
  const cavity = M.Manifold.hull([...rrect(ia - cove, ib - cove, irr, t, seg), ...rrect(ia, ib, irr, t + cove, seg), ...rrect(ia, ib, irr, h + 1, seg)]);
  let cup = op(M, 'difference', outer, cavity);
  // pull notch on the front edge
  const nr = Math.min(6, cw / 4);
  cup = op(M, 'difference', cup, M.Manifold.cylinder(t + 2, nr, nr, seg * 4).rotate([-90, 0, 0]).translate([0, -cd / 2 - 1, h + nr * 0.4]));
  sp.cupLayout = { cw, cd, g, z0, count: sp.cupsX * sp.cupsY };
  return cup;
}

function buildTray(M, sp, opts) {
  const seg = opts.segments;
  const In = STD.trayIn;
  const a = sp.W / 2 - In, b = sp.D / 2 - In, rr = Math.max(STD.r - In, 0.6);
  const h = sp.trayDepth, t = 0.8;
  let tray = op(M, 'difference', rprism(M, a, b, rr, 0, h, seg), rprism(M, a - t, b - t, Math.max(rr - t, 0.3), t, h + 1, seg));
  // tray dividers
  const inner = [];
  for (let k = 1; k <= sp.divX; k++) { const x = -a + (k * 2 * a) / (sp.divX + 1); inner.push(box(M, x - 0.4, x + 0.4, -b, b, 0, h - 1)); }
  for (let k = 1; k <= sp.divY; k++) { const y = -b + (k * 2 * b) / (sp.divY + 1); inner.push(box(M, -a, a, y - 0.4, y + 0.4, 0, h - 1)); }
  tray = op(M, 'union', tray, unionAll(M, inner));
  // finger notches at both short ends for lifting
  const nr = Math.min(9, b / 2, h * 0.7);
  const notchLen = t + 3;
  tray = op(M, 'difference', tray, unionAll(M, [-1, 1].map((sx) => M.Manifold.cylinder(notchLen, nr, nr, seg * 4).rotate([0, 90, 0])
    .translate([sx > 0 ? a - 1.5 : -a - notchLen + 1.5, 0, h]))));
  return tray;
}

const DRILLS = {
  metric: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((d) => [String(d), d]),
  imperial: [[1, 16], [5, 64], [3, 32], [7, 64], [1, 8], [9, 64], [5, 32], [11, 64], [3, 16], [13, 64], [7, 32], [15, 64], [1, 4], [5, 16], [3, 8], [7, 16], [1, 2]]
    .map(([n, d]) => [`${n}/${d}`, (25.4 * n) / d]),
};

/** Holder insert, built upright (deck on top); `opts.orient === 'print'` flips it deck-down for printing. */
function buildHolder(M, sp, opts) {
  const seg = opts.segments;
  const z0 = sp.ribTop;
  const maxH = (sp.trayZ != null ? sp.trayZ - (STD.trayLedge - sp.wall) : sp.usableTop) - 0.4 - z0;
  const mode = sp.holderMode;
  const td = mode === 'hex' ? 8 : 3;
  const h = clamp(sp.holderH || (mode === 'hex' ? 14 : Math.round(maxH * 0.45)), td + 4, maxH);
  const { a, b, rr } = insertFootprint(sp, z0, z0 + h);
  const t = 1.2;
  let part = op(M, 'difference', rprism(M, a, b, rr, 0, h, seg), rprism(M, a - t, b - t, Math.max(rr - t, 0.3), -1, h - td, seg));
  // support ribs under the deck every ~20 mm (they print standing on the deck, which goes on the bed)
  const ribs = [];
  const nRib = Math.max(0, Math.round((2 * b) / 20) - 1);
  for (let k = 1; k <= nRib; k++) { const y = -b + (k * 2 * b) / (nRib + 1); ribs.push(box(M, -a + t - 0.1, a - t + 0.1, y - 0.6, y + 0.6, Math.max(0, h - td - 6), h - td + 0.1)); }
  part = op(M, 'union', part, unionAll(M, ribs));

  const holes = [], texts = [];
  const zTop = h;
  if (mode === 'drill') {
    const list = DRILLS[sp.system === 'imperial' ? 'imperial' : 'metric'];
    const textH = 3, m = 3;
    // pack sizes into rows (each slot = hole + label underneath), then spread rows and slots evenly
    const slots = list.map(([label, d]) => {
      const r = (d + 0.35) / 2;
      return { label, r, w: Math.max(2 * r + 2.5, label.length * 1.6 + 1.5), h: 2 * r + textH + 2.5 };
    });
    const rows = [];
    let row = [], rowW = 0;
    for (const sl of slots) {
      if (row.length && rowW + sl.w > 2 * a - 2 * m) { rows.push(row); row = []; rowW = 0; }
      row.push(sl); rowW += sl.w;
    }
    if (row.length) rows.push(row);
    const rowH = rows.map((rw) => Math.max(...rw.map((sl) => sl.h)));
    const freeV = 2 * b - 2 * m - rowH.reduce((n, v) => n + v, 0);
    if (freeV < 0) sp.warnings.push('Not every drill size fits: use a bigger box.');
    const gapV = Math.max(0, freeV) / (rows.length + 1);
    let y = b - m - gapV;
    rows.forEach((rw, k) => {
      if (y - rowH[k] < -b + m - 0.01) return;
      const freeH = 2 * a - 2 * m - rw.reduce((n, sl) => n + sl.w, 0);
      const gapH = Math.max(0, freeH) / (rw.length + 1);
      let x = -a + m + gapH;
      for (const sl of rw) {
        const cx = x + sl.w / 2, cy = y - sl.r - 0.5;
        holes.push(M.Manifold.cylinder(td + 8, sl.r, sl.r, Math.max(12, seg * 3)).translate([cx, cy, zTop - td - 7]));
        if (opts.font) {
          const c = layoutText(opts.font, [sl.label], sl.w - 0.6, textH, { maxLine: textH });
          if (c) texts.push(textSolid(M, c, 0.8).translate([cx, cy - sl.r - 1 - textH / 2, zTop - 0.5]));
        }
        x += sl.w + gapH;
      }
      y -= rowH[k] + gapV;
    });
  } else if (mode === 'hex') {
    const af = 6.35 + 0.3, R = af / Math.sqrt(3); // 1/4 in hex bits
    const pu = af + 3.2, pv = 2 * R + 2.6;
    for (let y = b - 3 - R; y > -b + 3 + R; y -= pv) {
      for (let x = -a + 3 + af / 2; x < a - 3 - af / 2; x += pu) {
        holes.push(M.Manifold.cylinder(td + 8, R, R, 6).rotate([0, 0, 30]).translate([x, y, zTop - td - 7]));
      }
    }
  } else {
    const r = sp.gridHole / 2, p = Math.max(sp.gridPitch, sp.gridHole + 2);
    const nx = Math.floor((2 * a - 6 - 2 * r) / p) + 1, ny = Math.floor((2 * b - 6 - 2 * r) / p) + 1;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      holes.push(M.Manifold.cylinder(td + 8, r, r, Math.max(16, seg * 3)).translate([-((nx - 1) * p) / 2 + i * p, -((ny - 1) * p) / 2 + j * p, zTop - td - 7]));
    }
  }
  part = op(M, 'difference', part, unionAll(M, [...holes, ...texts]));
  if (opts.orient === 'print') part = part.rotate([180, 0, 0]).translate([0, 0, h]);
  sp.holderHeight = h;
  return part;
}

// ---------- structure ----------

/** Base plate: sockets that take the feet of 1..n stacks, with pockets underneath for feet or magnets. */
function buildBase(M, sp, opts) {
  const seg = opts.segments;
  const { gap, rim } = STD;
  const fl = baseFloor(sp), H = baseHeight(sp);
  const pW = sp.pW, pD = sp.pD;
  const plate = M.Manifold.hull([...rrect(pW / 2, pD / 2, STD.r, 0.4, seg), ...rrect(pW / 2 - 0.4, pD / 2 - 0.4, STD.r - 0.4, 0, seg), ...rrect(pW / 2, pD / 2, STD.r, H, seg)]);
  const sockets = [], pads = [];
  for (let i = 0; i < sp.baseCols; i++) {
    for (let j = 0; j < sp.baseRows; j++) {
      const cx = -pW / 2 + sp.W / 2 + i * (sp.W + gap), cy = -pD / 2 + sp.D / 2 + j * (sp.D + gap);
      sockets.push(rprism(M, sp.W / 2 - rim, sp.D / 2 - rim, STD.r - rim, fl, H + 1, seg, cx, cy));
      if (sp.basePads !== 'none') {
        const [d, depth] = sp.basePads === 'magnet' ? [6.3, 2.2] : [10.4, 1.2];
        const ox = Math.min(10, sp.W / 4), oy = Math.min(10, sp.D / 4);
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
          pads.push(M.Manifold.cylinder(depth + 0.01, d / 2, d / 2, seg * 3).translate([cx + sx * (sp.W / 2 - ox), cy + sy * (sp.D / 2 - oy), -0.01]));
        }
      }
    }
  }
  return op(M, 'difference', plate, unionAll(M, [...sockets, ...pads]));
}

/** Carry caddy: wells for 1x1 bins with a handle down the middle. */
function buildCaddy(M, sp, opts) {
  const seg = opts.segments;
  const cell = sp.cell, t = 1.6, hw = 18, ht = 3;
  const pW = sp.pW, pD = sp.pD;
  const fl = 1.6;
  let part = rprism(M, pW / 2, pD / 2, STD.r, 0, hw, seg);
  const mid = sp.caddyRows > 1 ? Math.floor(sp.caddyRows / 2) : null;
  const wells = [];
  for (let i = 0; i < sp.caddyCols; i++) {
    for (let j = 0; j < sp.caddyRows; j++) {
      const shift = mid != null && j >= mid ? ht : 0;
      const cx = -pW / 2 + t + cell / 2 + i * (cell + t), cy = -pD / 2 + t + cell / 2 + j * (cell + t) + shift;
      wells.push(rprism(M, cell / 2, cell / 2, STD.r, fl, hw + 1, seg, cx, cy));
    }
  }
  part = op(M, 'difference', part, unionAll(M, wells));
  // handle: a plate between the rows (or along the back) with a hand hole
  const hy = mid != null ? -pD / 2 + t + mid * (cell + t) - t / 2 + ht / 2 : pD / 2 - ht / 2;
  const hl = pW - 2 * STD.r;
  let handle = box(M, -hl / 2, hl / 2, hy - ht / 2, hy + ht / 2, 0, sp.caddyH);
  const hole = Math.min(90, hl - 30), hh = 28, top = sp.caddyH - 8, ch = 10;
  const poly = [[-hole / 2, top - hh], [hole / 2, top - hh], [hole / 2, top - ch], [hole / 2 - ch, top], [-hole / 2 + ch, top], [-hole / 2, top - ch]];
  handle = op(M, 'difference', handle, wallPrism(M, poly, 'y', hy - ht, hy + ht));
  return op(M, 'union', part, handle);
}

// ---------- public API ----------

/**
 * Build one part. `M` is the initialised manifold-3d module (after setup()).
 * opts: { segments, font, orient } (font: an opentype.js Font, needed only for text;
 * orient: 'print' (default) lays the part as it should print, 'use' as it sits in its box).
 * Returns the Manifold; the caller owns it and must call delete().
 */
export function buildPart(M, input, { segments = 10, font = null, orient = 'print' } = {}) {
  const sp = resolveSpec(input);
  const opts = { segments, font, orient };
  switch (sp.type) {
    case 'lid': return buildLid(M, sp, opts);
    case 'cup': return buildCup(M, sp, opts);
    case 'tray': return buildTray(M, sp, opts);
    case 'holder': return buildHolder(M, sp, opts);
    case 'base': return buildBase(M, sp, opts);
    case 'caddy': return buildCaddy(M, sp, opts);
    default: return buildBin(M, sp, opts);
  }
}

/**
 * Where an insert or lid sits in its host box, for previews: a list of placements [x, y, z]
 * for the part as built with orient 'use'. Returns null for parts that stand alone.
 */
export function placements(input) {
  const sp = resolveSpec(input);
  if (sp.type === 'lid') return [[0, 0, sp.zs]];
  if (sp.type === 'tray') return [[0, 0, sp.trayZ]];
  if (sp.type === 'holder') return [[0, 0, sp.ribTop]];
  if (sp.type === 'cup') {
    const top = (sp.trayZ != null ? sp.trayZ - (STD.trayLedge - sp.wall) : sp.usableTop) - 0.4;
    const { a, b } = insertFootprint(sp, sp.ribTop, top);
    const g = 0.5;
    const cw = (2 * a - (sp.cupsX - 1) * g) / sp.cupsX, cd = (2 * b - (sp.cupsY - 1) * g) / sp.cupsY;
    const out = [];
    for (let i = 0; i < sp.cupsX; i++) for (let j = 0; j < sp.cupsY; j++) out.push([-a + cw / 2 + i * (cw + g), -b + cd / 2 + j * (cd + g), sp.ribTop]);
    return out;
  }
  return null;
}

/** How many to print by default (cups come as a set). */
export const defaultQty = (input) => { const sp = resolveSpec(input); return sp.type === 'cup' ? sp.cupsX * sp.cupsY : 1; };

/** The host box an insert or lid belongs to (for previews and "add the box" actions). */
export const hostSpec = (input) => ({ ...input, type: 'box', trayDepth: input.type === 'tray' ? resolveSpec(input).trayDepth : input.trayDepth });

/**
 * Rough load the floor carries in a stack before it sags ~1 mm (kg). The floor of a stacked bin is held
 * only round its edge; sitting on a table it carries anything. Simply supported plate, Roark's table,
 * PLA long-term modulus ~1800 MPa; ribs counted as an equivalent thicker plate.
 */
export function floorLoadKg(input) {
  const sp = resolveSpec(input);
  if (sp.group !== 'bin') return null;
  const I0 = erodedInset(outerProfile(sp), sp.floor + 0.5, sp.wall);
  const A = sp.W - 2 * I0, B = sp.D - 2 * I0;
  const a = Math.max(A, B), b = Math.min(A, B);
  if (b <= 0) return null;
  const ratio = a / b;
  const table = [[1, 0.0444], [1.2, 0.0616], [1.4, 0.077], [1.6, 0.0906], [1.8, 0.1017], [2, 0.111], [3, 0.1335], [4, 0.14], [100, 0.1421]];
  let alpha = 0.1421;
  for (let k = 0; k < table.length - 1; k++) {
    const [r0, a0] = table[k], [r1, a1] = table[k + 1];
    if (ratio <= r1) { alpha = a0 + ((a1 - a0) * (ratio - r0)) / (r1 - r0); break; }
  }
  const t = sp.floor;
  let tEff = t;
  if (sp.floorRibs !== 'none') {
    const p = (sp.sizeMode === 'grid' ? sp.U : 42) / 2, rw = 1.2, h = sp.ribH - 0.6; // chamfered top counts as ~0.6 less
    const A1 = p * t, A2 = rw * h, yc = (A1 * t / 2 + A2 * (t + h / 2)) / (A1 + A2);
    const I = (p * t ** 3) / 12 + A1 * (yc - t / 2) ** 2 + (rw * h ** 3) / 12 + A2 * (t + h / 2 - yc) ** 2;
    const te = Math.cbrt((12 * I) / p);
    tEff = sp.floorRibs === 'cross' ? te : Math.cbrt(Math.sqrt(te ** 3 * t ** 3)) * 1.15; // one-way ribs: about halfway, a bit better
  }
  if (sp.gusset > 0) tEff *= 1 + Math.min(0.15, sp.gusset / 40);
  const E = 1800, w = 1;
  const q = (w * E * tEff ** 3) / (alpha * b ** 4); // N/mm2
  return (q * A * B) / 9.81;
}

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

/** Slicer settings that suit a part (for Bambu-ready 3MF files). */
export function printSettings(input) {
  const sp = resolveSpec(input);
  const loops = sp.group === 'bin' ? Math.max(2, Math.round(sp.wall / 0.42)) : 2;
  return { wall_loops: sp.type === 'base' ? 2 : loops, sparse_infill_density: sp.type === 'base' ? '15%' : '0%', bottom_shell_layers: Math.max(3, Math.ceil((sp.group === 'bin' ? sp.floor : 1.2) / 0.2)), layer_height: 0.2 };
}

/** Grams of filament for a volume in mm3 (PLA 1.24 g/cm3 by default). */
export const grams = (mm3, density = 1.24) => (mm3 / 1000) * density;
/** Metres of 1.75 mm filament for a volume in mm3. */
export const metres = (mm3) => mm3 / (Math.PI * 0.875 * 0.875) / 1000;
/** Rough A1 print time in minutes: thin-walled parts print at ~9 mm3/s effective, plus warm-up. */
export const printMinutes = (mm3) => 6 + mm3 / 9 / 60;
