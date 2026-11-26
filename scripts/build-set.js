// Build a list of AESS parts to 3MF/STL from the command line (no SolidCraft needed).
// Usage: node scripts/build-set.js <list.txt> [outDir] [--stl] [--plate]
//   list lines: <type> <nx> <ny> [nh] [wall] [qty]   e.g. "hopper 2 3 7 heavy 2"
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import Module from 'manifold-3d';
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
    return { spec: { type: p[0], nx, ny, nh, wall: words[0] ?? 'std' }, qty };
  });
}

const M = await Module();
M.setup();
await mkdir(outDir, { recursive: true });
const items = parseList(await readFile(listPath, 'utf8'));
const plate = [];
let total = 0;
for (const { spec, qty } of items) {
  const sp = resolveSpec(spec);
  const part = buildPart(M, spec, { segments: 16 });
  const vol = part.volume();
  const mesh = toMesh(part);
  part.delete();
  const file = join(outDir, `${sp.name}.${flags.has('--stl') ? 'stl' : '3mf'}`);
  await writeFile(file, Buffer.from(flags.has('--stl') ? makeSTL(mesh) : make3MF([{ name: sp.name, mesh }])));
  for (let k = 0; k < qty; k++) plate.push({ name: sp.name, mesh });
  total += grams(vol) * qty;
  console.log(`${sp.name.padEnd(28)} ${`${sp.W} x ${sp.D} x ${sp.H.toFixed(1)} mm`.padEnd(26)} ${grams(vol).toFixed(1).padStart(6)} g  x${qty}`);
}
if (flags.has('--plate')) await writeFile(join(outDir, 'AESS-plate.3mf'), Buffer.from(make3MF(plate)));
console.log(`total ~${total.toFixed(0)} g PLA -> ${outDir}`);
