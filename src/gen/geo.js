// Primitivas de malla para el generador. Todo se construye en pose de bind (T-pose)
// en espacio de mundo, con pesos de skin por vértice referidos por nombre de hueso.
import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const spow = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);

export const skin1 = (name) => ({ n: [name], w: [1] });
export const skin2 = (a, b, t) => (t <= 0.001 ? skin1(a) : t >= 0.999 ? skin1(b) : { n: [a, b], w: [1 - t, t] });

// RNG determinista (mulberry32)
export function rng(seed) {
  let a = (seed >>> 0) || 1;
  const f = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.range = (lo, hi) => lo + (hi - lo) * f();
  f.pick = (arr) => arr[Math.floor(f() * arr.length)];
  return f;
}

// Interpolador Catmull-Rom sobre claves [x, ...valores]
export function curve(keys) {
  const n = keys.length;
  const dim = keys[0].length - 1;
  return (x) => {
    if (x <= keys[0][0]) return keys[0].slice(1);
    if (x >= keys[n - 1][0]) return keys[n - 1].slice(1);
    let i = 0;
    while (i < n - 2 && x > keys[i + 1][0]) i++;
    const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
    const t = (x - k1[0]) / (k2[0] - k1[0]);
    const out = [];
    for (let d = 1; d <= dim; d++) {
      const m1 = (k2[d] - k0[d]) / (k2[0] - k0[0]) * (k2[0] - k1[0]);
      const m2 = (k3[d] - k1[d]) / (k3[0] - k1[0]) * (k2[0] - k1[0]);
      const t2 = t * t, t3 = t2 * t;
      out.push((2 * t3 - 3 * t2 + 1) * k1[d] + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * k2[d] + (t3 - t2) * m2);
    }
    return out;
  };
}

export class Geo {
  constructor() {
    this.p = []; this.i = []; this.uv = []; this.sk = []; this.sh = []; this.lw = []; this.sn = [];
  }
  get count() { return this.p.length / 3; }
  vert(pos, o = {}) {
    const k = this.p.length / 3;
    this.p.push(pos.x, pos.y, pos.z);
    this.uv.push(o.u ?? 0, o.v ?? 0);
    this.sk.push(o.skin);
    this.sh.push(o.shade ?? 0);
    this.lw.push(o.lw ?? 1);
    this.sn.push(o.sn ?? null);
    return k;
  }
  tri(a, b, c) { this.i.push(a, b, c); }
  // rejilla de índices [fila][col]; orientación hacia afuera para sweep/blob
  grid(rows, wrap, flip = false) {
    const R = rows.length;
    for (let r = 0; r < R - 1; r++) {
      const C = rows[r].length;
      const lim = wrap ? C : C - 1;
      for (let c = 0; c < lim; c++) {
        const c1 = (c + 1) % C;
        const A = rows[r][c], B = rows[r][c1], Cc = rows[r + 1][c1], D = rows[r + 1][c];
        if (!flip) { this.tri(A, D, Cc); this.tri(A, Cc, B); } else { this.tri(A, Cc, D); this.tri(A, B, Cc); }
      }
    }
  }
  toGeometry(boneIndex) {
    const n = this.count;
    const pos = new Float32Array(this.p);
    // normales suaves soldando por posición
    const acc = new Map();
    const keyOf = (k) => `${Math.round(pos[k * 3] * 2e4)},${Math.round(pos[k * 3 + 1] * 2e4)},${Math.round(pos[k * 3 + 2] * 2e4)}`;
    const keys = new Array(n);
    for (let k = 0; k < n; k++) { keys[k] = keyOf(k); if (!acc.has(keys[k])) acc.set(keys[k], [0, 0, 0]); }
    const a = V(), b = V(), c = V(), e1 = V(), e2 = V();
    for (let t = 0; t < this.i.length; t += 3) {
      const ia = this.i[t], ib = this.i[t + 1], ic = this.i[t + 2];
      a.fromArray(pos, ia * 3); b.fromArray(pos, ib * 3); c.fromArray(pos, ic * 3);
      e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2);
      for (const k of [ia, ib, ic]) { const g = acc.get(keys[k]); g[0] += e1.x; g[1] += e1.y; g[2] += e1.z; }
    }
    const on = new Float32Array(n * 3), nn = new Float32Array(n * 3);
    for (let k = 0; k < n; k++) {
      const g = acc.get(keys[k]);
      let l = Math.hypot(g[0], g[1], g[2]) || 1;
      on[k * 3] = g[0] / l; on[k * 3 + 1] = g[1] / l; on[k * 3 + 2] = g[2] / l;
      const s = this.sn[k];
      if (s) { nn[k * 3] = s.x; nn[k * 3 + 1] = s.y; nn[k * 3 + 2] = s.z; } else { nn[k * 3] = on[k * 3]; nn[k * 3 + 1] = on[k * 3 + 1]; nn[k * 3 + 2] = on[k * 3 + 2]; }
    }
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      const s = this.sk[k] || skin1('hips');
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
    g.setAttribute('normal', new THREE.BufferAttribute(nn, 3));
    g.setAttribute('onormal', new THREE.BufferAttribute(on, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.uv), 2));
    g.setAttribute('shade', new THREE.BufferAttribute(new Float32Array(this.sh), 1));
    g.setAttribute('lw', new THREE.BufferAttribute(new Float32Array(this.lw), 1));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    g.setIndex(this.i);
    g.boundingSphere = new THREE.Sphere(V(0, 1, 0), 3);
    return g;
  }
}

const val = (f, ...args) => (typeof f === 'function' ? f(...args) : f);

// Tubo a lo largo de una curva. Sección superelíptica (rx sobre X local, rz sobre el eje "up").
// o: { pts, r:(t,i)=>[rx,rz], exp, segs, up, upFn, twist, capStart, capEnd, capLen, skin, shade, lw,
//      arc:[a0,a1], thickness, closed, sn:(pos,nrmApprox,t,a)=>Vector3|null, uvScale }
export function sweep(geo, o) {
  const pts = o.pts, n = pts.length;
  const segs = o.segs ?? 12;
  const closed = !!o.closed;
  const open = !!o.arc;
  const a0 = open ? o.arc[0] : 0, a1 = open ? o.arc[1] : Math.PI * 2;
  const cols = open ? segs + 1 : segs;
  // longitudes acumuladas
  const L = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = L[n - 1] || 1;
  const frames = [];
  let Z = (o.up || V(0, 0, 1)).clone();
  for (let i = 0; i < n; i++) {
    const p0 = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)];
    const p1 = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    const T = p1.clone().sub(p0).normalize();
    if (o.upFn) Z = o.upFn(i, L[i] / total).clone();
    Z.addScaledVector(T, -Z.dot(T));
    if (Z.lengthSq() < 1e-8) Z.set(Math.abs(T.y) < 0.9 ? 0 : 1, Math.abs(T.y) < 0.9 ? 1 : 0, 0).addScaledVector(T, -T.y);
    Z.normalize();
    const X = T.clone().cross(Z).normalize();
    frames.push({ T, X, Z: Z.clone() });
  }
  const ringVerts = (i, t, scale, along, inset) => {
    const f = frames[i];
    let [rx, rz] = val(o.r, t, i);
    rx = Math.max(1e-5, (rx - inset) * scale); rz = Math.max(1e-5, (rz - inset) * scale);
    const e = val(o.exp, t, i) ?? 2;
    const tw = val(o.twist, t, i) ?? 0;
    const ct = Math.cos(tw), st = Math.sin(tw);
    const X = f.X.clone().multiplyScalar(ct).addScaledVector(f.Z, st);
    const Zr = f.Z.clone().multiplyScalar(ct).addScaledVector(f.X, -st);
    const c = pts[i].clone().addScaledVector(f.T, along);
    const sk = val(o.skin, t, i);
    const lw = val(o.lw, t, i) ?? 1;
    const row = [];
    for (let s = 0; s < cols; s++) {
      const a = a0 + (a1 - a0) * (s / segs);
      const cx = spow(Math.cos(a), 2 / e), cz = spow(Math.sin(a), 2 / e);
      const p = c.clone().addScaledVector(X, cx * rx).addScaledVector(Zr, cz * rz);
      if (o.warp) o.warp(p, t, a, inset);
      const sn = o.sn ? o.sn(p, t, a) : null;
      row.push(geo.vert(p, { u: o.uv && !inset ? a / (Math.PI * 2) : 0, v: o.uv && !inset ? t : 0, skin: sk, shade: val(o.shade, t, a) ?? 0, lw, sn }));
    }
    return row;
  };
  const build = (inset) => {
    const rows = [];
    for (let i = 0; i < n; i++) rows.push(ringVerts(i, L[i] / total, 1, 0, inset));
    return rows;
  };
  const rows = build(0);
  if (closed) rows.push(rows[0]);

  if (o.thickness) {
    const inner = build(o.thickness);
    if (closed) inner.push(inner[0]);
    geo.grid(rows, !open);
    geo.grid(inner, !open, true);
    if (!closed) {
      geo.grid([inner[0], rows[0]], !open);
      geo.grid([rows[n - 1], inner[n - 1]], !open);
    }
    if (open) {
      const R = rows.length;
      for (let r = 0; r < R - 1; r++) {
        // borde a0
        geo.tri(rows[r][0], inner[r][0], inner[r + 1][0]); geo.tri(rows[r][0], inner[r + 1][0], rows[r + 1][0]);
        const e = cols - 1;
        geo.tri(rows[r][e], inner[r + 1][e], inner[r][e]); geo.tri(rows[r][e], rows[r + 1][e], inner[r + 1][e]);
      }
    }
    return rows;
  }

  // tapas
  const cap = (end) => {
    const kind = end ? o.capEnd : o.capStart;
    if (!kind || kind === 'none' || closed || open) return;
    const i = end ? n - 1 : 0, t = end ? 1 : 0, dir = end ? 1 : -1;
    const f = frames[i];
    const [rx, rz] = val(o.r, t, i);
    const sk = val(o.skin, t, i);
    const capShade = val(o.capShade, end) ?? val(o.shade, t, 0) ?? 0;
    let last = rows[end ? rows.length - 1 : 0];
    let len = 0;
    if (kind === 'round') {
      len = (o.capLen ?? 1) * Math.min(rx, rz);
      const K = 3;
      for (let k = 1; k <= K; k++) {
        const th = (k / (K + 1)) * Math.PI / 2;
        const row = ringVerts(i, t, Math.cos(th), dir * Math.sin(th) * len, 0);
        if (end) geo.grid([last, row], true); else geo.grid([row, last], true);
        last = row;
      }
    }
    const pole = geo.vert(pts[i].clone().addScaledVector(f.T, dir * len), { u: 0, v: 0, skin: sk, shade: capShade, lw: val(o.lw, t, i) ?? 1 });
    for (let s = 0; s < segs; s++) {
      const A = last[s], B = last[(s + 1) % segs];
      if (end) geo.tri(A, pole, B); else geo.tri(A, B, pole);
    }
  };
  geo.grid(rows, !open);
  cap(false); cap(true);
  return rows;
}

// Superelipsoide. o: { c, r:[rx,ry,rz], e1, e2, rows, segs, skin, M (Matrix4 rot), deform:(p, unit)=>void, shade, lw, sn }
export function blob(geo, o) {
  const rowsN = o.rows ?? 10, segs = o.segs ?? 14;
  const e1 = o.e1 ?? 2, e2 = o.e2 ?? 2;
  const [rx, ry, rz] = o.r;
  const rows = [];
  for (let r = 0; r <= rowsN; r++) {
    const phi = -Math.PI / 2 + (Math.PI * r) / rowsN;
    const cy = spow(Math.sin(phi), 2 / e1), cr = spow(Math.cos(phi), 2 / e1);
    const row = [];
    for (let s = 0; s < segs; s++) {
      const a = (s / segs) * Math.PI * 2;
      const unit = V(cr * spow(Math.cos(a), 2 / e2), cy, cr * spow(Math.sin(a), 2 / e2));
      const p = V(unit.x * rx, unit.y * ry, unit.z * rz);
      if (o.deform) o.deform(p, unit);
      if (o.M) p.applyMatrix4(o.M);
      p.add(o.c);
      row.push(geo.vert(p, { u: 0, v: 0, skin: val(o.skin, p, unit), shade: val(o.shade, unit) ?? 0, lw: val(o.lw, unit) ?? 1, sn: o.sn ? o.sn(p, unit) : null }));
    }
    rows.push(row);
  }
  geo.grid(rows, true);
  return rows;
}

// puntos intermedios de una Catmull-Rom 3D
export function spline(points, n) {
  const c = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return c.getPoints(n - 1);
}

export const rotM = (x = 0, y = 0, z = 0, order = 'XYZ') => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(x, y, z, order));
