// Builds AESS parts off the main thread so the page stays responsive.
import Module from 'https://cdn.jsdelivr.net/npm/manifold-3d@3.5.4/manifold.js';
import { parse } from 'https://cdn.jsdelivr.net/npm/opentype.js@1.3.5/dist/opentype.mjs';
import { buildPart, resolveSpec, toMesh } from './aess-core.js';

const ready = Module().then((M) => { M.setup(); return M; });
const fontReady = fetch(new URL('./fonts/BarlowCondensed-Bold.ttf', import.meta.url))
  .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`font ${r.status}`))))
  .then((buf) => parse(buf))
  .catch(() => null); // text is skipped if the font can't load

self.onmessage = async ({ data }) => {
  const { id, spec, segments } = data;
  try {
    const [M, font] = await Promise.all([ready, fontReady]);
    const part = buildPart(M, spec, { segments, font });
    const volume = part.volume();
    const mesh = toMesh(part);
    part.delete();
    self.postMessage(
      { id, ok: true, spec: resolveSpec(spec), volume, positions: mesh.positions, indices: mesh.indices, font: !!font },
      [mesh.positions.buffer, mesh.indices.buffer],
    );
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
