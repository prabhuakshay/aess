// Mesh writers: binary STL and 3MF (a small store-only ZIP writer, no dependencies).

/** Binary STL of { positions, indices }. Returns an ArrayBuffer. */
export function makeSTL({ positions, indices }) {
  const triCount = indices.length / 3;
  const buf = new ArrayBuffer(84 + triCount * 50);
  const dv = new DataView(buf);
  const header = 'AESS bin - binary STL';
  for (let i = 0; i < header.length; i++) dv.setUint8(i, header.charCodeAt(i));
  dv.setUint32(80, triCount, true);
  let o = 84;
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[c] - positions[a], vy = positions[c + 1] - positions[a + 1], vz = positions[c + 2] - positions[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    for (const v of [nx, ny, nz]) { dv.setFloat32(o, v, true); o += 4; }
    for (const i of [a, b, c]) {
      dv.setFloat32(o, positions[i], true);
      dv.setFloat32(o + 4, positions[i + 1], true);
      dv.setFloat32(o + 8, positions[i + 2], true);
      o += 12;
    }
    dv.setUint16(o, 0, true);
    o += 2;
  }
  return buf;
}

const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);

/**
 * 3MF with one object per item, laid out in rows on a 256 mm bed (the slicer can re-arrange).
 * items: [{ name, mesh: { positions, indices } }]. Returns an ArrayBuffer.
 */
export function make3MF(items, { bed = 256, spacing = 6 } = {}) {
  let objects = '';
  let build = '';
  let x = 0, y = 0, rowDepth = 0;
  items.forEach((item, k) => {
    const { positions, indices } = item.mesh;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const verts = [];
    for (let i = 0; i < positions.length; i += 3) {
      const px = positions[i], py = positions[i + 1], pz = positions[i + 2];
      if (px < minX) minX = px; if (px > maxX) maxX = px;
      if (py < minY) minY = py; if (py > maxY) maxY = py;
      verts.push(`<vertex x="${+px.toFixed(4)}" y="${+py.toFixed(4)}" z="${+pz.toFixed(4)}"/>`);
    }
    const tris = [];
    for (let t = 0; t < indices.length; t += 3) tris.push(`<triangle v1="${indices[t]}" v2="${indices[t + 1]}" v3="${indices[t + 2]}"/>`);
    const id = k + 1;
    objects += `<object id="${id}" name="${esc(item.name)}" type="model"><mesh><vertices>${verts.join('')}</vertices><triangles>${tris.join('')}</triangles></mesh></object>`;
    const w = maxX - minX, d = maxY - minY;
    if (x > 0 && x + w > bed) { x = 0; y += rowDepth + spacing; rowDepth = 0; }
    const tx = x - minX + spacing, ty = y - minY + spacing;
    build += `<item objectid="${id}" transform="1 0 0 0 1 0 0 0 1 ${tx.toFixed(3)} ${ty.toFixed(3)} 0"/>`;
    x += w + spacing;
    rowDepth = Math.max(rowDepth, d);
  });

  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
<metadata name="Title">AESS bins</metadata><metadata name="Application">AESS generator</metadata>
<resources>${objects}</resources><build>${build}</build></model>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  const files = [
    ['[Content_Types].xml', contentTypes],
    ['_rels/.rels', rels],
    ['3D/3dmodel.model', model],
  ];
  return zipStore(files);
}

/** ZIP of several files (any ArrayBuffer or string), stored without compression. */
export function makeZip(files) {
  return zipStore(files);
}

let CRC_TABLE;
function crc32(bytes) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const entries = files.map(([name, data]) => {
    const bytes = typeof data === 'string' ? enc.encode(data) : new Uint8Array(data);
    return { name: enc.encode(name), bytes, crc: crc32(bytes) };
  });
  const localSize = entries.reduce((n, e) => n + 30 + e.name.length + e.bytes.length, 0);
  const centralSize = entries.reduce((n, e) => n + 46 + e.name.length, 0);
  const out = new Uint8Array(localSize + centralSize + 22);
  const dv = new DataView(out.buffer);
  let o = 0;
  const offsets = [];
  for (const e of entries) {
    offsets.push(o);
    dv.setUint32(o, 0x04034b50, true); dv.setUint16(o + 4, 20, true); dv.setUint16(o + 6, 0x0800, true);
    dv.setUint16(o + 8, 0, true); dv.setUint16(o + 10, 0, true); dv.setUint16(o + 12, 0x21, true);
    dv.setUint32(o + 14, e.crc, true); dv.setUint32(o + 18, e.bytes.length, true); dv.setUint32(o + 22, e.bytes.length, true);
    dv.setUint16(o + 26, e.name.length, true); dv.setUint16(o + 28, 0, true);
    out.set(e.name, o + 30); out.set(e.bytes, o + 30 + e.name.length);
    o += 30 + e.name.length + e.bytes.length;
  }
  const cdStart = o;
  entries.forEach((e, i) => {
    dv.setUint32(o, 0x02014b50, true); dv.setUint16(o + 4, 20, true); dv.setUint16(o + 6, 20, true);
    dv.setUint16(o + 8, 0x0800, true); dv.setUint16(o + 10, 0, true); dv.setUint16(o + 12, 0, true);
    dv.setUint16(o + 14, 0x21, true); dv.setUint32(o + 16, e.crc, true);
    dv.setUint32(o + 20, e.bytes.length, true); dv.setUint32(o + 24, e.bytes.length, true);
    dv.setUint16(o + 28, e.name.length, true); dv.setUint16(o + 30, 0, true); dv.setUint16(o + 32, 0, true);
    dv.setUint16(o + 34, 0, true); dv.setUint16(o + 36, 0, true); dv.setUint32(o + 38, 0, true);
    dv.setUint32(o + 42, offsets[i], true);
    out.set(e.name, o + 46);
    o += 46 + e.name.length;
  });
  dv.setUint32(o, 0x06054b50, true); dv.setUint16(o + 4, 0, true); dv.setUint16(o + 6, 0, true);
  dv.setUint16(o + 8, entries.length, true); dv.setUint16(o + 10, entries.length, true);
  dv.setUint32(o + 12, o - cdStart, true); dv.setUint32(o + 16, cdStart, true); dv.setUint16(o + 20, 0, true);
  return out.buffer;
}
