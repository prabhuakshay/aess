// Builds AESS parts off the main thread so the page stays responsive.
import Module from 'https://cdn.jsdelivr.net/npm/manifold-3d@3.5.4/manifold.js';
import { buildPart, resolveSpec, toMesh } from './aess-core.js';

const ready = Module().then((M) => { M.setup(); return M; });

self.onmessage = async ({ data }) => {
  const { id, spec, segments } = data;
  try {
    const M = await ready;
    const part = buildPart(M, spec, { segments });
    const volume = part.volume();
    const mesh = toMesh(part);
    part.delete();
    self.postMessage(
      { id, ok: true, spec: resolveSpec(spec), volume, positions: mesh.positions, indices: mesh.indices },
      [mesh.positions.buffer, mesh.indices.buffer],
    );
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
