// Build a list of AESS parts to 3MF/STL from the command line (no SolidCraft needed).
// Usage: node scripts/build-set.js <list.txt> [outDir] [--stl] [--plate]
//   list lines: <type> <nx> <ny> [nh] [qty] [key=value ...]
//   e.g. "hopper 2 3 7 2 wall=heavy label=M6x30"   "box 2 2 4 divX=2 divY=2"   "lid 2 2"
//   Any spec key works (pattern=hex, scoop=10, brand=..., textStyle=off); use _ for spaces in values.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Module from 'manifold-3d';
import { parse } from 'opentype.js/dist/opentype.mjs';
import { buildPart, resolveSpec, toMesh, grams } from '../web/aess-core.js';
import { make3MF, makeSTL } from '../web/aess-export.js';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const [listPath, outDir = 'dist/parts'] = args.filter((a) => !a.startsWith('--'));
if (!listPath) {
  console.error('usage: node scripts/build-set.js <list.txt> [outDir] [--stl] [--plate]');
  process.exit(2);
}

function parseList(text) {
  return text.split(/\r?\n/).map((l) => l.split('#')[0].trim()).filter(Boolean).map((l) => {
    const p = l.split(/\s+/);
    const nums = p.slice(1).filter((x) => /^\d+$/.test(x)).map(Number);
    const words = p.slice(1).filter((x) => !/^\d+$/.test(x));
    const [nx, ny, nh = 1, qty = 1] = nums;
    const spec = { type: p[0], nx, ny, nh };
    for (const w of words) {
      const [k, v] = w.includes('=') ? w.split('=') : ['wall', w];
      spec[k] = /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v.replace(/_/g, ' ');
    }
    return { spec, qty };
  });
}

const M = await Module();
M.setup();
const fontBuf = await readFile(new URL('../web/fonts/BarlowCondensed-Bold.ttf', import.meta.url));
const font = parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
await mkdir(outDir, { recursive: true });
const items = parseList(await readFile(listPath, 'utf8'));
const plate = [];
let total = 0;
for (const { spec, qty } of items) {
  const sp = resolveSpec(spec);
  const part = buildPart(M, spec, { segments: 16, font });
  const vol = part.volume();
  const mesh = toMesh(part);
  part.delete();
  const file = join(outDir, `${sp.name}.${flags.has('--stl') ? 'stl' : '3mf'}`);
  await writeFile(file, Buffer.from(flags.has('--stl') ? makeSTL(mesh) : make3MF([{ name: sp.name, mesh }])));
  for (let k = 0; k < qty; k++) plate.push({ name: sp.name, mesh });
  total += grams(vol) * qty;
  console.log(`${sp.name.padEnd(28)} ${`${+sp.pW.toFixed(1)} x ${+sp.pD.toFixed(1)} x ${sp.pH.toFixed(1)} mm`.padEnd(26)} ${grams(vol).toFixed(1).padStart(6)} g  x${qty}`);
}
if (flags.has('--plate')) await writeFile(join(outDir, 'AESS-plate.3mf'), Buffer.from(make3MF(plate)));
console.log(`total ~${total.toFixed(0)} g PLA -> ${outDir}`);
