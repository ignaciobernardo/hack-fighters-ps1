// El MUT (Mercado Urbano Tobalaba): atrio de varios pisos con los bordes de losa pintados
// azul, barandas negras, columnas de hormigón, tiendas iluminadas, la claraboya redonda con
// su anillo azul, escaleras mecánicas, la escalera central y ramos de flores secas colgando.
import * as THREE from 'three';
import { mat, tex, pixels, noisy, hex, css, mix, mul, Mesher, Batch, box, cyl, floor, put, flat, skyDome, rng, fbm, vnoise, grain } from './kit.js';

const CX = 0, CZ = -3.2, AX = 10.6, AZ = 7.6;      // elipse del atrio
const TOPS = [3.7, 6.9, 10.1], ROOF = 13.2, FASCIA = 0.72, GAL = 3.2;
const ell = (t, off = 0) => [CX + (AX + off) * Math.cos(t), CZ + (AZ + off) * Math.sin(t)];

function textures() {
  const T = {};
  T.floor = tex(64, 64, (g, w, h) => pixels(g, w, h, (x, y) => {
    let c = noisy('#8e7f6c', { sc: 0.05, amp: 0.14, gr: 0.06, seed: 201 })(x, y);
    if (x % 32 === 0 || y % 32 === 0) c = mul(c, 0.8);
    const sheen = Math.max(0, fbm(x * 0.02, y * 0.06, 202) - 0.55) * 0.6;
    return mix(c, [226, 206, 176], sheen);
  }));
  T.blue = tex(32, 32, (g, w, h) => pixels(g, w, h, (x, y) => {
    let c = noisy('#2a74cf', { sc: 0.15, amp: 0.07, gr: 0.06, seed: 203 })(x, y);
    if (y < 2) c = mul(c, 1.15);
    if (y > 29) c = mul(c, 0.7);
    return c;
  }));
  T.rail = tex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    pixels(g, w, h, (x, y) => {
      if (y < 3) return [24, 26, 30, 255];                       // pasamanos
      if (y > 28) return [30, 32, 36, 255];                      // zócalo
      if (x % 6 < 1) return [36, 38, 42, 255];                    // barrotes
      if (y > 14 && y < 16) return [36, 38, 42, 255];
      return [0, 0, 0, 0];
    });
  });
  T.concrete = tex(32, 32, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#c9c1b4', { sc: 0.12, amp: 0.1, gr: 0.08, seed: 204 })(x, y)));
  T.soffit = tex(32, 32, (g, w, h) => pixels(g, w, h, (x, y) => mul(noisy('#ddd5c6', { sc: 0.1, amp: 0.08, gr: 0.05, seed: 205 })(x, y), x % 16 === 0 ? 0.85 : 1)));
  // tiendas: 4 variantes de 128×64 en un atlas 256×128
  const words = ['FLORES', 'CAFÉ', 'DISEÑO', 'LIBROS', 'PAN', 'VINOS', 'DULCES', 'TÉ'];
  T.shops = tex(256, 128, (g) => {
    const R = rng(206);
    for (let v = 0; v < 4; v++) {
      const ox = (v % 2) * 128, oy = Math.floor(v / 2) * 64;
      const warm = [['#f6d49a', '#c98a4a'], ['#f3e2c0', '#b98f62'], ['#ffd08a', '#a8642e'], ['#e9efe6', '#9fb2a2']][v];
      const gr = g.createLinearGradient(0, oy + 14, 0, oy + 64); gr.addColorStop(0, warm[0]); gr.addColorStop(1, warm[1]);
      g.fillStyle = gr; g.fillRect(ox, oy + 14, 128, 50);
      // estanterías y productos
      for (let s = 0; s < 3; s++) {
        const sy = oy + 26 + s * 12;
        g.fillStyle = '#5a3a22'; g.fillRect(ox + 4, sy, 120, 2);
        for (let k = 0; k < 18; k++) { g.fillStyle = ['#9a4a32', '#d8b06a', '#5a7a4a', '#efe6d2', '#6a6a7a', '#c08a4a', '#7a5a4a'][Math.floor(R() * 7)]; g.fillRect(ox + 5 + k * 6.6 + R() * 2, sy - 3 - R() * 4, 3 + R() * 2, 3 + R() * 3); }
      }
      // gente (siluetas)
      for (let k = 0; k < 2 + Math.floor(R() * 3); k++) {
        const px = ox + 10 + R() * 108, ph = 18 + R() * 8;
        g.fillStyle = ['#3b3036', '#4a3b2c', '#2c3446', '#6a2a2a'][Math.floor(R() * 4)];
        g.fillRect(px, oy + 64 - ph, 6, ph); g.beginPath(); g.arc(px + 3, oy + 64 - ph - 3, 3, 0, 7); g.fill();
      }
      // carpintería oscura y letrero
      g.fillStyle = '#1f1c1a';
      for (let k = 0; k <= 4; k++) g.fillRect(ox + k * 32 - (k === 4 ? 2 : 0), oy + 14, 2, 50);
      g.fillStyle = ['#23201d', '#2d3a2a', '#3a2620', '#1f2a3a'][v]; g.fillRect(ox, oy, 128, 14);
      g.fillStyle = '#f2e6c8'; g.font = 'bold 10px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(words[(v * 2 + Math.floor(R() * 2)) % words.length], ox + 64, oy + 7.5);
    }
  }, { repeat: false });
  T.dark = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#2a2b2f', { sc: 0.3, amp: 0.15, gr: 0.1, seed: 207 })(x, y)));
  T.steps = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => (y % 4 === 0 ? [40, 40, 44] : x % 3 === 0 ? [110, 112, 118] : [150, 152, 158])));
  T.glass = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => [190, 220, 230, 70 + grain(x, y, 208) * 30]));
  T.wood = tex(32, 32, (g, w, h) => pixels(g, w, h, (x, y) => mul(noisy('#9a6a42', { sc: 0.08, amp: 0.15, gr: 0.1, seed: 209 })(x * 0.3, y * 3), y % 8 === 0 ? 0.7 : 1)));
  T.net = tex(32, 32, (g, w, h) => { g.clearRect(0, 0, w, h); pixels(g, w, h, (x, y) => ((x + y) % 8 === 0 || (x - y + 64) % 8 === 0 ? [235, 235, 230, 255] : [0, 0, 0, 0])); });
  T.leaves = tex(32, 32, (g, w, h) => { const R = rng(210); g.fillStyle = '#244a1e'; g.fillRect(0, 0, w, h); for (let i = 0; i < 220; i++) { g.fillStyle = ['#2f6a28', '#4c8f3a', '#7cb455'][Math.floor(R() * 3)]; g.beginPath(); g.ellipse(R() * w, R() * h, 2, 1, R() * 3, 0, 7); g.fill(); } });
  // ramos de flores secas: arriba tallos, abajo las flores (6 paletas)
  const PAL = [
    ['#9b8a5a', ['#e6e2d0', '#cfd7b8', '#b9c79a', '#f4f1e6']],          // hortensia seca
    ['#7d8a4a', ['#b8282e', '#d8433a', '#8e1d27', '#f0e7d8']],          // rosas rojas
    ['#8a7a3a', ['#f2a23a', '#e8732a', '#f6d04a', '#c45a1e']],          // siemprevivas
    ['#6f7a48', ['#7a4a9a', '#a77ac8', '#5a3a7a', '#e6dff0']],          // statice
    ['#5f7a52', ['#6f9a72', '#9cc29a', '#4f7a5a', '#cfe0c4']],          // eucalipto
    ['#a08a5a', ['#f4efe2', '#e2d3b8', '#cfa86a', '#f7f4ea']],          // paniculata / trigo
  ];
  T.flowers = tex(192, 64, (g) => {
    const R = rng(211);
    PAL.forEach(([stem, cols], v) => {
      const ox = v * 32;
      g.fillStyle = css(mul(hex(stem), 0.6)); g.fillRect(ox, 0, 32, 64);
      for (let i = 0; i < 40; i++) { g.fillStyle = css(mul(hex(stem), 0.8 + R() * 0.5)); g.fillRect(ox + R() * 32, 0, 1, 26 + R() * 18); }
      for (let i = 0; i < 260; i++) {
        const y = 22 + Math.pow(R(), 0.7) * 42;
        g.fillStyle = cols[Math.floor(R() * cols.length)];
        g.fillRect(ox + R() * 31, y, 1 + R() * 2.5, 1 + R() * 2.5);
      }
    });
  }, { repeat: false });
  T.lamp = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => mul([238, 236, 228], 0.9 + grain(x, y, 212) * 0.1)));
  return T;
}

// cuadrilátero vertical entre dos puntos del suelo, orientado hacia el centro del atrio
function vquad(M, a, b, y0, y1, uv, col) {
  const nx = -(b[1] - a[1]), nz = b[0] - a[0];
  const mx = (a[0] + b[0]) / 2 - CX, mz = (a[1] + b[1]) / 2 - CZ;
  const inward = nx * -mx + nz * -mz > 0;
  const A = inward ? a : b, Bp = inward ? b : a;
  const u = inward ? uv : [[uv[1][0], uv[0][1]], [uv[0][0], uv[1][1]], [uv[3][0], uv[2][1]], [uv[2][0], uv[3][1]]];
  M.quad([A[0], y0, A[1]], [Bp[0], y0, Bp[1]], [Bp[0], y1, Bp[1]], [A[0], y1, A[1]], u, col);
}

export function buildMut() {
  const root = new THREE.Group(); root.name = 'mut';
  const T = textures();
  const M = {
    floor: mat(T.floor), blue: mat(T.blue), rail: mat(T.rail, { alphaTest: 0.5, side: THREE.DoubleSide }), concrete: mat(T.concrete), soffit: mat(T.soffit),
    shops: mat(T.shops), dark: mat(T.dark), steps: mat(T.steps), glass: mat(T.glass, { transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    wood: mat(T.wood), net: mat(T.net, { alphaTest: 0.5, side: THREE.DoubleSide }), leaves: mat(T.leaves), flowers: mat(T.flowers, { side: THREE.DoubleSide }),
    lamp: mat(T.lamp, { side: THREE.DoubleSide }), white: mat(null, { side: THREE.DoubleSide }),
  };
  // luz cenital de la claraboya, más clara arriba
  const B = new Batch({ dir: [0.15, 1, 0.35], amb: 0.6, dif: 0.42, fn: (x, y) => 0.86 + Math.min(1, y / ROOF) * 0.22 });

  // arco del atrio sin el tramo que queda detrás de la cámara
  const N = 30, t0 = 2.36, t1 = Math.PI * 2 + 0.78;
  const ts = Array.from({ length: N + 1 }, (_, i) => t0 + (t1 - t0) * i / N);

  B.add(M.floor, floor(-22, 22, -16, 12, 0, 2.2, 1.6));

  const Mb = new Mesher(), Mr = new Mesher(), Ms = new Mesher(), Mshop = new Mesher(), Mc = new Mesher();
  const R = rng(301);
  for (let i = 0; i < N; i++) {
    const a0 = ell(ts[i]), b0 = ell(ts[i + 1]);
    const a1 = ell(ts[i], GAL), b1 = ell(ts[i + 1], GAL), a2 = ell(ts[i], 2.0), b2 = ell(ts[i + 1], 2.0);
    const len = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]);
    // planta baja: tiendas bajo la primera losa
    {
      const v = Math.floor(R() * 4), ox = (v % 2) * 0.5, oy = 0.5 - Math.floor(v / 2) * 0.5;
      vquad(Mshop, a2, b2, 0, TOPS[0] - FASCIA, [[ox, oy], [ox + 0.5, oy], [ox + 0.5, oy + 0.5], [ox, oy + 0.5]]);
    }
    TOPS.forEach((top, l) => {
      const u1 = len / 2;
      vquad(Mb, a0, b0, top - FASCIA, top, [[0, 0], [u1, 0], [u1, 1], [0, 1]]);
      vquad(Mr, a0, b0, top, top + 1.05, [[0, 0], [len, 0], [len, 1], [0, 1]]);
      // cielo de la losa (mirando hacia abajo)
      Ms.quad([a1[0], top - FASCIA, a1[1]], [b1[0], top - FASCIA, b1[1]], [b0[0], top - FASCIA, b0[1]], [a0[0], top - FASCIA, a0[1]], [[0, 0], [len / 2, 0], [len / 2, 1.5], [0, 1.5]]);
      const next = l < TOPS.length - 1 ? TOPS[l + 1] - FASCIA : ROOF;
      const v = Math.floor(R() * 4), ox = (v % 2) * 0.5, oy = 0.5 - Math.floor(v / 2) * 0.5;
      vquad(Mshop, a1, b1, top, next, [[ox, oy], [ox + 0.5, oy], [ox + 0.5, oy + 0.5], [ox, oy + 0.5]]);
    });
    // columnas cada dos tramos
    if (i % 2 === 0) {
      const c = ell(ts[i], 0.35);
      const col = box(0.5, ROOF, 0.5, [1, 2]); put(col, { x: c[0], y: ROOF / 2, z: c[1] });
      B.add(M.concrete, col);
    }
  }
  B.add(M.blue, Mb.geometry(), { amb: 0.72, dif: 0.3 });
  B.add(M.rail, Mr.geometry(), { amb: 0.9, dif: 0.1 });
  B.add(M.soffit, Ms.geometry(), { amb: 0.62, dif: 0.1 });
  B.add(M.shops, Mshop.geometry(), { flat: [1.02, 0.97, 0.9] });

  // techo con la claraboya: anillo azul, tambor, vidrio blanco y malla
  {
    const Mt = new Mesher(), K = 40, rIn = 4.6;
    for (let i = 0; i < K; i++) {
      const ta = (i / K) * Math.PI * 2, tb = ((i + 1) / K) * Math.PI * 2;
      const ia = [CX + rIn * Math.cos(ta), CZ + rIn * Math.sin(ta)], ib = [CX + rIn * Math.cos(tb), CZ + rIn * Math.sin(tb)];
      const oa = ell(ta, GAL + 0.5), ob = ell(tb, GAL + 0.5);
      Mt.quad([oa[0], ROOF, oa[1]], [ob[0], ROOF, ob[1]], [ib[0], ROOF, ib[1]], [ia[0], ROOF, ia[1]], [[0, 0], [1, 0], [1, 2], [0, 2]]);
    }
    B.add(M.soffit, Mt.geometry(), { amb: 0.75, dif: 0 });
    const ring = new THREE.TorusGeometry(4.6, 0.42, 4, 32); put(ring, { x: CX, y: ROOF - 0.1, z: CZ, rx: Math.PI / 2 });
    B.add(M.blue, ring, { amb: 0.8, dif: 0.2 });
    const drum = cyl(4.4, 4.4, 1.4, 24, 2, true); put(drum, { x: CX, y: ROOF + 0.7, z: CZ });
    B.add(M.white, drum, { flat: [0.92, 0.92, 0.9] });
    const sky = new THREE.CircleGeometry(4.45, 24); put(sky, { x: CX, y: ROOF + 1.4, z: CZ, rx: Math.PI / 2 });
    B.add(M.white, sky, { flat: [1.25, 1.25, 1.25] });
    const net = new THREE.CircleGeometry(4.4, 24); const uv = net.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 9, uv.getY(i) * 9);
    put(net, { x: CX, y: ROOF - 0.35, z: CZ, rx: Math.PI / 2 });
    B.add(M.net, net, { flat: [0.95, 0.95, 0.92] });
  }

  // escalera central hacia el primer piso
  {
    const n = 12, w = 2.6, z0 = -8.0, run = 0.3, rise = (TOPS[0]) / n;
    for (let s = 0; s < n; s++) {
      const st = box(w, rise, run + 0.02, [1, 0.25]); put(st, { x: 0, y: rise * (s + 0.5), z: z0 - run * s });
      B.add(M.concrete, st);
    }
    const len = Math.hypot(n * run, TOPS[0]), ang = Math.atan2(TOPS[0], n * run);
    for (const sx of [-1, 1]) {
      const side = box(0.12, 0.5, len, [1, 1]); put(side, { x: sx * (w / 2 + 0.06), y: TOPS[0] / 2 + 0.2, z: z0 - n * run / 2, rx: ang });
      B.add(M.dark, side);
      const gl = box(0.03, 1.0, len, [1, 1]); put(gl, { x: sx * (w / 2 + 0.06), y: TOPS[0] / 2 + 0.95, z: z0 - n * run / 2, rx: ang });
      B.add(M.glass, gl, { flat: true });
      const pl = box(1.6, 0.7, 3.2, [1, 1]); put(pl, { x: sx * (w / 2 + 1.1), y: 0.35, z: z0 + 0.4 });
      B.add(M.wood, pl);
      for (let k = 0; k < 4; k++) { const b = new THREE.IcosahedronGeometry(0.45, 0); put(b, { x: sx * (w / 2 + 1.1) + (k % 2 - 0.5) * 0.7, y: 0.9, z: z0 + 0.4 + (k - 1.5) * 0.7 }); B.add(M.leaves, b, { amb: 0.55, dif: 0.5 }); }
    }
  }
  // escaleras mecánicas a la derecha, cruzadas
  for (const [x, dir] of [[7.0, 1], [8.25, -1]]) {
    const len = 8.2, ang = Math.atan2(TOPS[0], 7.2) * dir;
    const zc = -6.9;
    const body = box(1.15, 0.9, len, [1, 1]); put(body, { x, y: TOPS[0] / 2 - 0.25, z: zc, rx: ang }); B.add(M.dark, body);
    const top = box(0.9, 0.05, len, [0.4, 0.4]); put(top, { x, y: TOPS[0] / 2 + 0.22, z: zc, rx: ang }); B.add(M.steps, top);
    for (const sx of [-0.52, 0.52]) { const gl = box(0.04, 0.9, len, [1, 1]); put(gl, { x: x + sx, y: TOPS[0] / 2 + 0.7, z: zc, rx: ang }); B.add(M.glass, gl, { flat: true }); const hr = box(0.08, 0.06, len, [1, 1]); put(hr, { x: x + sx, y: TOPS[0] / 2 + 1.16, z: zc, rx: ang }); B.add(M.dark, hr); }
  }
  // lámparas colgantes esmaltadas (lado derecho)
  const lines = [];
  for (const [x, y, z, s] of [[8.6, 6.0, 0.6, 1.2], [9.2, 9.4, -2.5, 1], [-8.8, 6.2, -0.8, 1], [3.5, 9.8, -9.2, 0.9], [-4.5, 9.8, -9.4, 0.9]]) {
    const sh = cyl(0.1 * s, 0.5 * s, 0.32 * s, 10, null, true); put(sh, { x, y, z }); B.add(M.lamp, sh, { amb: 0.75, dif: 0.3 });
    const bulb = new THREE.CircleGeometry(0.3 * s, 10); put(bulb, { x, y: y - 0.14 * s, z, rx: Math.PI / 2 }); B.add(M.white, bulb, { flat: [1.3, 1.2, 1.0] });
    lines.push(x, y + 0.16 * s, z, x, ROOF, z);
  }

  // ramos de flores secas colgando de hilos
  {
    const Rf = rng(401), n = 120;
    for (let i = 0; i < n; i++) {
      let x, z, tries = 0;
      do { x = (Rf() * 2 - 1) * 9.4; z = CZ + (Rf() * 2 - 1) * 6.6; tries++; } while (((x - CX) / 9.6) ** 2 + ((z - CZ) / 6.8) ** 2 > 1 && tries < 20);
      if (z > 4) continue;
      const nearFight = Math.abs(z) < 2.6;
      const bottom = nearFight ? 4.4 + Rf() * 6 : (z < -3 ? 2.9 : 3.6) + Rf() * 7.5;
      const h = 0.8 + Rf() * 1.1, r = 0.22 + Rf() * 0.3, v = Math.floor(Rf() * 6);
      // ramo boca abajo: tallos amarrados arriba, flores abultadas abajo
      const prof = [[0, 0], [0.6 * r, 0.05 * h], [0.92 * r, 0.16 * h], [r, 0.3 * h], [0.8 * r, 0.46 * h], [0.38 * r, 0.6 * h], [0.06, 0.74 * h], [0.035, h]];
      const g = new THREE.LatheGeometry(prof.map(([px, py]) => new THREE.Vector2(px * (0.9 + Rf() * 0.2), py)), 6);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (v + 0.05 + 0.9 * uv.getX(k)) / 6, Math.min(0.98, uv.getY(k) * 1.05));
      put(g, { x, y: bottom, z, ry: Rf() * 6, rz: (Rf() - 0.5) * 0.12 });
      B.add(M.flowers, g, { amb: 0.66, dif: 0.4 });
      lines.push(x, bottom + h, z, x, ROOF, z);
    }
  }
  B.build(root);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#4a4036', fog: true })));
  root.add(skyDome(() => [0.95, 0.95, 0.93]));

  return {
    root, name: 'EL MUT', sub: 'MERCADO URBANO TOBALABA', tod: 'day',
    fog: ['#cdbfa8', 16, 60], chars: { hemi: ['#fff3e2', '#6f5c4a', 1.7], key: ['#fff1dc', 1.35, [0.4, 2.2, 1.4]] },
    bound: 7.2, lineZ: 0, floorY: 0,
    cams: { fight: { up: 0.55, fov: 44 }, select: { pos: [0, 1.05, 4.6], look: [0, 1.7, 0], fov: 56 }, stage: { r: 8.4, h: 1.5, look: 3.4, fov: 50 } },
    update() {},
  };
}
