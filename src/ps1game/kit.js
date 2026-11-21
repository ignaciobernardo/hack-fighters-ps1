// Kit de escenarios PS1: materiales sin luz (iluminación horneada en los vértices, como se
// hacía en la consola), temblor de vértices, texturas afines (se deforman con la perspectiva),
// texturas pintadas en canvas con vecino más cercano y armado de mallas por lotes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ps1Globals } from '../ps1/material.js';
import { fbm, vnoise, grain } from '../ps1/paint.js';

export { fbm, vnoise, grain };
export const envGlobals = { uAffine: { value: 1 } };

// ---------- azar con semilla ----------
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- materiales ----------
function inject(m) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnap = ps1Globals.uSnap;
    sh.uniforms.uAffine = envGlobals.uAffine;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSnap;\nuniform float uAffine;\nvarying float vAffW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        if (uSnap.x > 0.0 && gl_Position.w > 0.0) {
          vec2 ndc = gl_Position.xy / gl_Position.w;
          vec2 px = floor((ndc * 0.5 + 0.5) * uSnap) + 0.5;
          gl_Position.xy = (px / uSnap * 2.0 - 1.0) * gl_Position.w;
        }
        float aw = mix(1.0, max(gl_Position.w, 0.05), uAffine);
        #ifdef USE_MAP
          vMapUv *= aw;
        #endif
        vAffW = aw;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAffW;')
      .replace('#include <map_fragment>', `#ifdef USE_MAP
          vec4 sampledDiffuseColor = texture2D( map, vMapUv / vAffW );
          diffuseColor *= sampledDiffuseColor;
        #endif`);
  };
  m.customProgramCacheKey = () => 'ps1env-v1';
  return m;
}

// material de escenario: sin luces, el sombreado viene en el color de los vértices
export function mat(map = null, o = {}) {
  return inject(new THREE.MeshBasicMaterial({
    map, color: o.color ?? 0xffffff, vertexColors: o.vc ?? true,
    transparent: !!o.transparent, opacity: o.opacity ?? 1, alphaTest: o.alphaTest ?? 0,
    side: o.side ?? THREE.FrontSide, fog: o.fog ?? true, depthWrite: o.depthWrite ?? true,
  }));
}

// ---------- texturas ----------
export function tex(w, h, draw, o = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  if (o.repeat !== false) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.userData.canvas = cv;
  return t;
}
// píxel por píxel: fn(x, y) → [r, g, b] o [r, g, b, a] (0..255)
export function pixels(g, w, h, fn) {
  const im = g.getImageData(0, 0, w, h), d = im.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = fn(x, y, d[(y * w + x) * 4], d[(y * w + x) * 4 + 1], d[(y * w + x) * 4 + 2], d[(y * w + x) * 4 + 3]);
    if (!c) continue;
    const i = (y * w + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = c[3] ?? 255;
  }
  g.putImageData(im, 0, 0);
}
export const hex = (h) => { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const css = (c, a = 1) => `rgba(${c.map((v) => Math.round(Math.max(0, Math.min(255, v)))).join(',')},${a})`;
export const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

// ruido de "foto": base + manchas de baja frecuencia + grano
export function noisy(base, { s = 1, sc = 0.06, amp = 0.18, gr = 0.08, seed = 0, tint = null } = {}) {
  const b = hex(base), t = tint ? hex(tint) : null;
  return (x, y) => {
    const n = fbm(x * sc, y * sc, seed, 4), k = 1 + (n - 0.5) * 2 * amp + (grain(x, y, seed + 9) - 0.5) * gr;
    const c = t ? mix(b, t, Math.max(0, n - 0.5) * 1.4) : b;
    return mul(c, k * s);
  };
}

// ---------- geometría ----------
export class Mesher {
  constructor() { this.p = []; this.uv = []; this.c = []; }
  tri(a, b, c, ua = [0, 0], ub = [1, 0], uc = [1, 1], col = [1, 1, 1]) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
    const ca = col[0]?.length ? col : [col, col, col];
    for (const k of ca) this.c.push(k[0], k[1], k[2]);
  }
  // a b c d en sentido antihorario visto desde el frente (abajo-izq, abajo-der, arriba-der, arriba-izq)
  quad(a, b, c, d, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], col = [1, 1, 1]) {
    const cs = col[0]?.length ? col : [col, col, col, col];
    this.tri(a, b, c, uv[0], uv[1], uv[2], [cs[0], cs[1], cs[2]]);
    this.tri(a, c, d, uv[0], uv[2], uv[3], [cs[0], cs[2], cs[3]]);
  }
  get empty() { return this.p.length === 0; }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    return g;
  }
}

// caja con UV en metros (tile = metros por repetición; null = 0..1 por cara)
export function box(w, h, d, tile = 1) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
  if (tile) {
    const [tu, tv] = Array.isArray(tile) ? tile : [tile, tile];
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    const uv = g.attributes.uv;
    for (let f = 0; f < 6; f++) for (let i = 0; i < 6; i++) {
      const k = f * 6 + i;
      uv.setXY(k, uv.getX(k) * dims[f][0] / tu, uv.getY(k) * dims[f][1] / tv);
    }
  }
  return g;
}
export function cyl(rt, rb, h, sides = 6, tile = null, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, sides, 1, open).toNonIndexed();
  if (tile) { const uv = g.attributes.uv; const circ = Math.PI * (rt + rb); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ / tile, uv.getY(i) * h / tile); }
  return g;
}
// plano horizontal subdividido (para que la textura afín no se deforme demasiado)
export function floor(x0, x1, z0, z1, y = 0, tile = 1, cell = 1.2) {
  const M = new Mesher();
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), nz = Math.max(1, Math.ceil((z1 - z0) / cell));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const xa = x0 + (x1 - x0) * i / nx, xb = x0 + (x1 - x0) * (i + 1) / nx;
    const za = z0 + (z1 - z0) * j / nz, zb = z0 + (z1 - z0) * (j + 1) / nz;
    M.quad([xa, y, zb], [xb, y, zb], [xb, y, za], [xa, y, za], [[xa / tile, -zb / tile], [xb / tile, -zb / tile], [xb / tile, -za / tile], [xa / tile, -za / tile]]);
  }
  return M.geometry();
}
// plano vertical (pared) mirando a +z, subdividido
export function wall(x0, x1, y0, y1, z = 0, tile = 1, cell = 1.5, uvFit = false) {
  const M = new Mesher();
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), ny = Math.max(1, Math.ceil((y1 - y0) / cell));
  const U = (x) => uvFit ? (x - x0) / (x1 - x0) : x / (Array.isArray(tile) ? tile[0] : tile);
  const Vv = (y) => uvFit ? (y - y0) / (y1 - y0) : y / (Array.isArray(tile) ? tile[1] : tile);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const xa = x0 + (x1 - x0) * i / nx, xb = x0 + (x1 - x0) * (i + 1) / nx;
    const ya = y0 + (y1 - y0) * j / ny, yb = y0 + (y1 - y0) * (j + 1) / ny;
    M.quad([xa, ya, z], [xb, ya, z], [xb, yb, z], [xa, yb, z], [[U(xa), Vv(ya)], [U(xb), Vv(ya)], [U(xb), Vv(yb)], [U(xa), Vv(yb)]]);
  }
  return M.geometry();
}

// mover / girar / escalar la geometría misma (antes de hornear la luz)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export function put(g, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1, sx, sy, sz } = {}) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx ?? s, sy ?? s, sz ?? s));
  g.applyMatrix4(_m);
  return g;
}

// luz horneada: ambiente + difusa con una dirección fija, por cara (sombreado plano)
export function bake(g, { dir = [-0.45, 0.8, 0.55], amb = 0.62, dif = 0.45, tint = [1, 1, 1], fn = null, smooth = false } = {}) {
  if (g.index) g = g.toNonIndexed();
  if (!smooth) {
    // normales por cara
    const p = g.attributes.position, n = new Float32Array(p.count * 3);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      b.sub(a); c.sub(a); b.cross(c).normalize();
      for (let k = 0; k < 3; k++) n.set([b.x, b.y, b.z], (i + k) * 3);
    }
    g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
  }
  const p = g.attributes.position, n = g.attributes.normal;
  const old = g.attributes.color;
  const col = new Float32Array(p.count * 3);
  const L = new THREE.Vector3(...dir).normalize();
  for (let i = 0; i < p.count; i++) {
    const nx = n.getX(i), ny = n.getY(i), nz = n.getZ(i);
    let s = amb + dif * Math.max(0, nx * L.x + ny * L.y + nz * L.z);
    let c = old ? [old.getX(i), old.getY(i), old.getZ(i)] : [1, 1, 1];
    if (fn) { const r = fn(p.getX(i), p.getY(i), p.getZ(i), nx, ny, nz); if (typeof r === 'number') s *= r; else c = [c[0] * r[0], c[1] * r[1], c[2] * r[2]]; }
    col[i * 3] = c[0] * s * tint[0]; col[i * 3 + 1] = c[1] * s * tint[1]; col[i * 3 + 2] = c[2] * s * tint[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
// sin sombreado (superficies que brillan: cielo, vidrios iluminados, letreros)
export function flat(g, c = [1, 1, 1]) {
  if (g.index) g = g.toNonIndexed();
  const col = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < col.length; i += 3) col.set(c, i);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}

// lotes: todas las piezas de un mismo material en una sola malla
export class Batch {
  constructor(light) { this.light = light; this.map = new Map(); }
  add(material, g, o = {}) {
    if (!o.raw) g = o.flat ? flat(g, o.flat === true ? [1, 1, 1] : o.flat) : bake(g, { ...this.light, ...o });
    for (const k of Object.keys(g.attributes)) if (!['position', 'uv', 'color', 'normal'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!this.map.has(material)) this.map.set(material, []);
    this.map.get(material).push(g);
    return g;
  }
  build(root, order = 0) {
    for (const [m, list] of this.map) {
      const g = mergeGeometries(list, false);
      list.forEach((x) => x.dispose());
      const mesh = new THREE.Mesh(g, m);
      mesh.renderOrder = m.transparent ? order + 1 : order;
      mesh.matrixAutoUpdate = false;
      root.add(mesh);
    }
    this.map.clear();
    return root;
  }
}

// cielo: domo de pocos polígonos con un degradé en los vértices (con bandas, como en la época)
export function skyDome(fn, { r = 400, w = 24, h = 14 } = {}) {
  const g = new THREE.SphereGeometry(r, w, h).toNonIndexed();
  const p = g.attributes.position, col = new Float32Array(p.count * 3), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); col.set(fn(v), i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(g, inject(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })));
  m.renderOrder = -10;
  return m;
}

// cartel / sprite plano (siempre mirando a +z) con textura propia
export function card(texture, w, h, o = {}) {
  const g = new THREE.PlaneGeometry(w, h);
  const m = new THREE.Mesh(flat(g, o.tint || [1, 1, 1]), mat(texture, { alphaTest: o.alphaTest ?? 0.5, side: THREE.DoubleSide, transparent: !!o.transparent, fog: o.fog ?? true }));
  return m;
}
