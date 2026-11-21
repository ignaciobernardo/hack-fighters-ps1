// Malla low-poly estilo PS1: triángulos sueltos (sin índices), cada uno con su UV en
// el atlas (en píxeles), pesos de skin y una marca para esconder la diagonal de los quads
// en la vista de malla (así se ven quads como en Blender).
import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
export const skin1 = (n) => ({ n: [n], w: [1] });
export const skin2 = (a, b, t) => (t <= 0.001 ? skin1(a) : t >= 0.999 ? skin1(b) : { n: [a, b], w: [1 - t, t] });

const _e1 = V(), _e2 = V(), _n = V(), _c = V();

export class Low {
  constructor(atlasSize = 512) {
    this.S = atlasSize;
    this.pos = []; this.uv = []; this.skin = []; this.bary = []; this.grp = [];
    this.uvTris = [];   // para dibujar la malla sobre el atlas: [x0,y0,x1,y1,x2,y2,hide]
  }
  get tris() { return this.pos.length / 9; }
  // a,b,c: { p: Vector3, uv?: [x,y] px, skin }  ·  o: { inside | dir, map(p, n) → [x,y], group, hide: esquina opuesta a la arista oculta }
  tri(a, b, c, o = {}) {
    _e1.subVectors(b.p, a.p); _e2.subVectors(c.p, a.p); _n.crossVectors(_e1, _e2);
    if (_n.lengthSq() < 1e-16) return;
    let flip = false;
    if (o.inside) { _c.copy(a.p).add(b.p).add(c.p).divideScalar(3).sub(o.inside); flip = _n.dot(_c) < 0; }
    else if (o.dir) flip = _n.dot(o.dir) < 0;
    let C = [a, b, c];
    if (flip) { C = [a, c, b]; _n.negate(); }
    const n = _n.clone().normalize();
    let uvs = C.map((k) => (o.map ? o.map(k.p, n, k) : k.uv));
    if (o.fixWrap) uvs = o.fixWrap(uvs, n);
    const hide = o.hide ? C.indexOf(o.hide) : -1;
    for (let i = 0; i < 3; i++) {
      const k = C[i];
      this.pos.push(k.p.x, k.p.y, k.p.z);
      this.uv.push(uvs[i][0] / this.S, 1 - uvs[i][1] / this.S);
      this.skin.push(k.skin);
      const b = [0, 0, 0]; b[i] = 1; if (hide >= 0) b[hide] = 1;
      this.bary.push(...b);
      this.grp.push(o.group ?? null);
    }
    this.uvTris.push([uvs[0][0], uvs[0][1], uvs[1][0], uvs[1][1], uvs[2][0], uvs[2][1], hide]);
  }
  quad(a, b, c, d, o = {}) {
    this.tri(a, b, c, { ...o, hide: b });
    this.tri(a, c, d, { ...o, hide: d });
  }
  // número de vértices como los cuenta Blender (posiciones únicas)
  uniqueVerts() {
    const s = new Set();
    for (let i = 0; i < this.pos.length; i += 3) s.add(`${Math.round(this.pos[i] * 1e4)},${Math.round(this.pos[i + 1] * 1e4)},${Math.round(this.pos[i + 2] * 1e4)}`);
    return s.size;
  }
  // estadísticas como las muestra Blender (quads cuentan como una cara)
  blenderStats() {
    const key = (t, i) => { const k = (t * 3 + i) * 3; return `${Math.round(this.pos[k] * 1e4)},${Math.round(this.pos[k + 1] * 1e4)},${Math.round(this.pos[k + 2] * 1e4)}`; };
    const edges = new Set(); let quadTris = 0;
    for (let t = 0; t < this.uvTris.length; t++) {
      const hide = this.uvTris[t][6];
      if (hide >= 0) quadTris++;
      for (let i = 0; i < 3; i++) {
        if (hide === (i + 2) % 3) continue;   // arista opuesta a la esquina oculta
        const a = key(t, i), b = key(t, (i + 1) % 3);
        edges.add(a < b ? a + '|' + b : b + '|' + a);
      }
    }
    return { verts: this.uniqueVerts(), edges: edges.size, faces: this.tris - quadTris / 2, tris: this.tris };
  }
  toGeometry(boneIndex) {
    const n = this.pos.length / 3;
    const pos = new Float32Array(this.pos);
    const nor = new Float32Array(n * 3);
    // normales: suaves dentro de cada grupo (soldando por posición), planas sin grupo
    const acc = new Map();
    const key = (k) => `${this.grp[k]}|${Math.round(pos[k * 3] * 1e4)},${Math.round(pos[k * 3 + 1] * 1e4)},${Math.round(pos[k * 3 + 2] * 1e4)}`;
    const fn = [];
    for (let t = 0; t < n; t += 3) {
      _e1.set(pos[t * 3 + 3] - pos[t * 3], pos[t * 3 + 4] - pos[t * 3 + 1], pos[t * 3 + 5] - pos[t * 3 + 2]);
      _e2.set(pos[t * 3 + 6] - pos[t * 3], pos[t * 3 + 7] - pos[t * 3 + 1], pos[t * 3 + 8] - pos[t * 3 + 2]);
      _n.crossVectors(_e1, _e2);
      fn.push(_n.clone());
      for (let i = 0; i < 3; i++) {
        const k = t + i;
        if (this.grp[k] == null) continue;
        const kk = key(k); const g = acc.get(kk) || [0, 0, 0];
        g[0] += _n.x; g[1] += _n.y; g[2] += _n.z; acc.set(kk, g);
      }
    }
    for (let k = 0; k < n; k++) {
      let x, y, z;
      if (this.grp[k] == null) { const f = fn[Math.floor(k / 3)]; x = f.x; y = f.y; z = f.z; }
      else [x, y, z] = acc.get(key(k));
      const l = Math.hypot(x, y, z) || 1;
      nor[k * 3] = x / l; nor[k * 3 + 1] = y / l; nor[k * 3 + 2] = z / l;
    }
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      const s = this.skin[k] || skin1('hips');
      let tot = 0;
      for (let j = 0; j < Math.min(4, s.n.length); j++) {
        const bi = boneIndex[s.n[j]];
        if (bi === undefined) throw new Error('hueso desconocido: ' + s.n[j]);
        si[k * 4 + j] = bi; sw[k * 4 + j] = s.w[j]; tot += s.w[j];
      }
      for (let j = 0; j < 4; j++) sw[k * 4 + j] /= tot || 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('bary', new THREE.BufferAttribute(new Float32Array(this.bary), 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.boundingSphere = new THREE.Sphere(V(0, 1, 0), 3);
    return g;
  }
}

// Ángulos de un anillo, de 0 a 2π inclusive (la costura se duplica). 0 = espalda, π = frente.
// flat: cara plana al frente (y atrás) en vez de arista.
export function angles(n, flat = false) {
  const out = [0];
  for (let j = 0; j < n; j++) {
    const t = flat ? (Math.PI * 2 * (j + 0.5)) / n : (Math.PI * 2 * (j + 1)) / n;
    if (t < Math.PI * 2 - 1e-6) out.push(t);
  }
  out.push(Math.PI * 2);
  return out;
}

// punto del anillo: X·(−sen θ) + Z·(−cos θ) → θ=0 atrás, θ=π/2 lado −X, θ=π frente, θ=3π/2 lado +X
export function ringPoint(r, t) {
  const e = 2 / (r.e ?? 2);
  const p = r.c.clone().addScaledVector(r.X, spow(-Math.sin(t), e) * r.rx).addScaledVector(r.Z, spow(-Math.cos(t), e) * r.rz);
  if (r.warp) r.warp(p, t);
  return p;
}

// Tubo por anillos. rings: [{ c, X, Z, rx, rz, e, v (px en el atlas), skin, warp }]
// o: { th: ángulos, x, w (franja del atlas para u), mirror, group, capStart, capEnd: { uv:[x,y] } }
export function loft(L, rings, o) {
  const th = o.th;
  const ux = (t) => { const u = t / (Math.PI * 2); return o.x + (o.mirror ? 1 - u : u) * o.w; };
  const rows = rings.map((r) => th.map((t) => ({ p: ringPoint(r, t), uv: [ux(t), r.v], skin: r.skin })));
  for (let i = 0; i < rows.length - 1; i++) {
    const inside = rings[i].c.clone().add(rings[i + 1].c).multiplyScalar(0.5);
    for (let j = 0; j < th.length - 1; j++) {
      L.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j], { inside, group: o.group, map: o.map });
    }
  }
  const cap = (i, spec, sgn) => {
    if (!spec) return;
    const r = rings[i];
    const ax = rings[Math.min(rings.length - 1, i + 1)].c.clone().sub(rings[Math.max(0, i - 1)].c).normalize().multiplyScalar(sgn);
    const c = { p: r.c.clone().addScaledVector(ax, spec.bulge || 0), uv: spec.uv, skin: r.skin };
    for (let j = 0; j < th.length - 1; j++) {
      const a = rows[i][j], b = rows[i][j + 1];
      L.tri({ ...a, uv: spec.ring ? a.uv : spec.uv }, { ...b, uv: spec.ring ? b.uv : spec.uv }, c, { dir: ax, group: spec.group, map: spec.map });
    }
  };
  cap(0, o.capStart, -1);
  cap(rings.length - 1, o.capEnd, 1);
  return rows;
}

// Anillos de puntos arbitrarios (misma cantidad por anillo, cerrados). Para zapatillas y manos.
// rows: [[{p, skin}]], o: { map, inside(i) → Vector3, group, capStart, capEnd }
export function loftPoly(L, rows, o) {
  const n = rows[0].length;
  for (let i = 0; i < rows.length - 1; i++) {
    const inside = o.inside(i);
    for (let j = 0; j < n; j++) {
      const j1 = (j + 1) % n;
      L.quad(rows[i][j], rows[i][j1], rows[i + 1][j1], rows[i + 1][j], { inside, map: o.map, group: o.group });
    }
  }
  const cap = (row, inside) => {
    // abanico desde el centroide
    const c = V(); row.forEach((k) => c.add(k.p)); c.divideScalar(row.length);
    const ctr = { p: c, skin: row[0].skin };
    for (let j = 0; j < n; j++) L.tri(row[j], row[(j + 1) % n], ctr, { inside, map: o.map, group: o.capGroup });
  };
  if (o.capStart) cap(rows[0], o.capStart);
  if (o.capEnd) cap(rows[rows.length - 1], o.capEnd);
}
