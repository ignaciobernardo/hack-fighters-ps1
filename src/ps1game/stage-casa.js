// Casa Platanus — Soria 667, Las Condes. La calle frente al portón: muro blanco con hiedra,
// el "667", la reja gris, la casa blanca con su losa volada, árboles, el edificio blanco
// facetado a la derecha y autos estacionados (el de la carpa de techo incluido).
import * as THREE from 'three';
import { mat, tex, pixels, noisy, hex, css, mix, mul, Mesher, Batch, box, cyl, floor, wall, put, bake, flat, skyDome, rng, fbm, vnoise, grain } from './kit.js';

const TOD = {
  day: {
    sky: (v) => { const t = Math.max(0, v.y); const z = hex('#3f86de'), h = hex('#cfe5f6'); const c = mix(h, z, Math.pow(t, 0.55)); return mul(c, 1 / 255); },
    fog: ['#c3dcef', 40, 190], light: { dir: [-0.55, 0.78, 0.5], amb: 0.66, dif: 0.48 },
    chars: { hemi: ['#d6e8ff', '#8f8c74', 1.75], key: ['#fff1dc', 1.7, [-1.2, 1.8, 1.4]] },
  },
  dusk: {
    sky: (v) => {
      const t = Math.max(0, v.y);
      const sun = Math.max(0, v.x * -0.2 + v.z * -0.98);
      let c = t < 0.12 ? mix(hex('#ffb35c'), hex('#f07a54'), t / 0.12) : t < 0.35 ? mix(hex('#f07a54'), hex('#7b4a78'), (t - 0.12) / 0.23) : mix(hex('#7b4a78'), hex('#1f2350'), Math.min(1, (t - 0.35) / 0.5));
      c = mix(c, hex('#ffe2a0'), Math.pow(sun, 18) * (1 - t) * 0.9);
      return mul(c, 1 / 255);
    },
    fog: ['#c8826e', 30, 150], light: { dir: [0.35, 0.45, -0.3], amb: 0.5, dif: 0.32, tint: [1.06, 0.86, 0.8] },
    chars: { hemi: ['#ffc7a0', '#4a3a52', 1.5], key: ['#ffb070', 1.9, [1.4, 1.0, -0.4]], rim: true },
  },
};

// ---------- texturas ----------
function textures() {
  const T = {};
  T.asphalt = tex(128, 128, (g, w, h) => {
    pixels(g, w, h, (x, y) => {
      const n = fbm(x * 0.05, y * 0.05, 3), s = grain(x, y, 4);
      let c = mix(hex('#3e4043'), hex('#5a5c5e'), n);
      if (s > 0.93) c = mix(c, hex('#8d8f90'), 0.6);
      if (s < 0.05) c = mul(c, 0.8);
      const crack = Math.abs(vnoise(x * 0.07, y * 0.02, 8) - 0.5) < 0.012 && fbm(x * 0.03, y * 0.03, 9) > 0.55;
      return crack ? mul(c, 0.55) : c;
    });
  });
  T.concrete = tex(64, 64, (g, w, h) => {
    pixels(g, w, h, (x, y) => {
      let c = noisy('#b8b4ab', { sc: 0.09, amp: 0.1, gr: 0.08, seed: 11 })(x, y);
      if (x % 32 === 0 || y % 32 === 0) c = mul(c, 0.72);
      return c;
    });
  });
  T.curb = tex(32, 16, (g, w, h) => pixels(g, w, h, (x, y) => mul(noisy('#c9c5bb', { sc: 0.2, amp: 0.1, gr: 0.1, seed: 12 })(x, y), y < 3 ? 1.08 : 1)));
  T.pavers = tex(64, 64, (g, w, h) => {
    pixels(g, w, h, (x, y) => {
      const row = Math.floor(y / 8), off = (row % 2) * 6, col = Math.floor((x + off) / 12);
      const edge = (x + off) % 12 === 0 || y % 8 === 0;
      const k = 0.82 + grain(col, row, 21) * 0.3;
      let c = mul(mix(hex('#8f8a82'), hex('#a39e94'), grain(x, y, 22)), k);
      return edge ? mul(c, 0.55) : c;
    });
  });
  T.grass = tex(64, 64, (g, w, h) => pixels(g, w, h, (x, y) => {
    const n = fbm(x * 0.12, y * 0.12, 31), s = grain(x, y, 32);
    return mix(hex('#3f7a24'), hex('#86b947'), n * 0.8 + s * 0.3);
  }));
  T.plaster = tex(64, 64, (g, w, h) => pixels(g, w, h, (x, y) => {
    const n = fbm(x * 0.07, y * 0.07, 41);
    let c = mix(hex('#e9e8e2'), hex('#f7f6f1'), n);
    if (y > 54) c = mix(c, hex('#a9a69a'), (y - 54) / 14 * fbm(x * 0.3, y * 0.3, 42));
    return mul(c, 1 - grain(x, y, 43) * 0.05);
  }));
  // el bloque del "667": revoque blanco con los números delgados arriba a la derecha
  T.n667 = tex(128, 128, (g, w, h) => {
    pixels(g, w, h, (x, y) => {
      const n = fbm(x * 0.05, y * 0.05, 44);
      let c = mix(hex('#e8e7e1'), hex('#f8f7f2'), n);
      if (y > 112) c = mix(c, hex('#a7a396'), (y - 112) / 16 * 0.7);
      return c;
    });
    g.fillStyle = '#4a4b4e';
    g.font = '300 34px "Helvetica Neue", Helvetica, Arial, sans-serif';
    g.textAlign = 'right'; g.textBaseline = 'top';
    g.fillText('667', w - 10, 14);
    // sombra suave de la hiedra que cuelga desde la izquierda
    const gr = g.createLinearGradient(0, 0, 40, 0); gr.addColorStop(0, 'rgba(40,60,30,0.35)'); gr.addColorStop(1, 'rgba(40,60,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 40, h);
  }, { repeat: false });
  // hiedra: hojas en capas, borde superior irregular (alpha)
  T.ivy = tex(256, 64, (g, w, h) => {
    const R = rng(7);
    g.fillStyle = '#1e3a14'; g.fillRect(0, 0, w, h);
    const greens = ['#24501a', '#2f6a20', '#3f8327', '#55a031', '#73b83e', '#9fd25a'];
    for (let i = 0; i < 2600; i++) {
      const x = R() * w, y = R() * h;
      const lit = Math.min(5, Math.floor((1 - y / h) * 2.2 + R() * 4));
      g.fillStyle = greens[lit];
      g.beginPath(); g.ellipse(x, y, 1.6 + R() * 1.8, 1.1 + R() * 1.2, R() * 3, 0, 7); g.fill();
    }
    pixels(g, w, h, (x, y, r, gg, b) => {
      const top = 6 + fbm(x * 0.06, 0, 51) * 18 + vnoise(x * 0.4, 1, 52) * 5;
      const a = y < top ? 0 : 255;
      return [r, gg, b, a];
    });
  }, { repeat: true });
  T.mesh = tex(32, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    pixels(g, w, h, (x, y) => {
      const bar = x % 4 === 0 || y % 8 === 0;
      return bar ? [128, 131, 134, 255] : [70, 72, 74, 70];
    });
  });
  T.spikes = tex(32, 8, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#7d8084';
    for (let x = 0; x < w; x += 4) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 2, 0); g.lineTo(x + 4, h); g.fill(); }
  });
  T.metal = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#8a8d90', { sc: 0.3, amp: 0.08, gr: 0.08, seed: 61 })(x, y)));
  T.leaves = (base, hi, seed) => tex(64, 64, (g, w, h) => {
    const R = rng(seed);
    g.fillStyle = css(mul(hex(base), 0.55)); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 520; i++) {
      g.fillStyle = css(mix(hex(base), hex(hi), R() ** 1.4));
      g.beginPath(); g.ellipse(R() * w, R() * h, 1.2 + R() * 2.2, 0.8 + R() * 1.4, R() * 3, 0, 7); g.fill();
    }
  });
  T.bark = tex(16, 32, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#6b5a4a', { sc: 0.4, amp: 0.2, gr: 0.15, seed: 71 })(x, y * 0.3)));
  T.bougain = tex(64, 64, (g, w, h) => {
    const R = rng(81);
    g.fillStyle = '#2b4a1c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) { g.fillStyle = ['#3d6a26', '#4f8030'][i % 2]; g.beginPath(); g.ellipse(R() * w, R() * h, 2, 1.3, R() * 3, 0, 7); g.fill(); }
    for (let i = 0; i < 420; i++) { g.fillStyle = ['#c2186b', '#e2338a', '#f05aa3', '#9c1053'][Math.floor(R() * 4)]; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
  });
  // edificio blanco: losas blancas, ventanales y persianas de madera rojiza al azar
  T.tower = tex(96, 96, (g, w, h) => {
    const R = rng(91);
    g.fillStyle = '#eceae4'; g.fillRect(0, 0, w, h);
    for (let f = 0; f < 4; f++) {
      const y0 = f * 24;
      g.fillStyle = '#5a6878'; g.fillRect(0, y0 + 8, w, 12);     // ventanal
      for (let b = 0; b < 6; b++) {
        if (R() < 0.3) { g.fillStyle = ['#c98a5a', '#d29a68', '#b87a4c'][Math.floor(R() * 3)]; g.fillRect(b * 16 + 1, y0 + 6, 14, 15); for (let k = 0; k < 15; k += 2) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(b * 16 + 1, y0 + 6 + k, 14, 1); } }
        else if (R() < 0.3) { g.fillStyle = '#7f93a8'; g.fillRect(b * 16 + 2, y0 + 7, 6, 13); }
        g.fillStyle = '#d9d7d0'; g.fillRect(b * 16, y0 + 6, 1, 15);
      }
      g.fillStyle = '#f6f5f0'; g.fillRect(0, y0, w, 8);          // losa del balcón
      g.fillStyle = '#c9c7c0'; g.fillRect(0, y0 + 5, w, 1);
      g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, y0 + 18, w, 1); // baranda de vidrio
    }
  });
  T.towerSide = tex(64, 64, (g, w, h) => pixels(g, w, h, (x, y) => {
    let c = noisy('#e3e1da', { sc: 0.1, amp: 0.06, gr: 0.05, seed: 92 })(x, y);
    if (y % 16 > 4 && y % 16 < 10 && x % 16 > 3 && x % 16 < 11) c = hex('#56606c');
    return c;
  }));
  T.brick = tex(64, 64, (g, w, h) => pixels(g, w, h, (x, y) => {
    let c = noisy('#b89a7c', { sc: 0.1, amp: 0.1, gr: 0.1, seed: 93 })(x, y);
    if (y % 16 > 3 && y % 16 < 12 && x % 12 > 2 && x % 12 < 10) c = mix(hex('#4c5f72'), hex('#8fb0c8'), (y % 16) / 14);
    return c;
  }));
  T.glass = tex(64, 64, (g, w, h) => pixels(g, w, h, (x, y) => {
    let c = mix(hex('#3e6f9e'), hex('#9cc3e3'), fbm(x * 0.03, y * 0.08, 94));
    if (x % 8 === 0 || y % 6 === 0) c = mul(c, 0.7);
    return c;
  }));
  T.house = tex(64, 32, (g, w, h) => {
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f3a44'; g.fillRect(4, 8, 24, 18); g.fillRect(34, 8, 26, 18);
    g.fillStyle = '#5d7184'; g.fillRect(6, 10, 9, 14); g.fillRect(40, 10, 8, 14);
    g.fillStyle = '#e4e2dc'; g.fillRect(16, 8, 1, 18); g.fillRect(47, 8, 1, 18);
  }, { repeat: true });
  T.car = (body) => tex(32, 32, (g, w, h) => pixels(g, w, h, (x, y) => noisy(body, { sc: 0.2, amp: 0.05, gr: 0.05, seed: 95 })(x, y)));
  T.tire = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#1d1d1f', { sc: 0.5, amp: 0.2, gr: 0.2, seed: 96 })(x, y)));
  T.roofbox = tex(32, 16, (g, w, h) => pixels(g, w, h, (x, y) => mul(noisy('#26272a', { sc: 0.3, amp: 0.1, gr: 0.08, seed: 97 })(x, y), y === 7 ? 0.6 : 1)));
  return T;
}

// auto: perfil lateral extruido; los vidrios se pintan por altura y orientación de cada cara
function car(B, M, { x, z, len = 4.3, wid = 1.8, h = 1.55, ry = 0, color = '#f1f1ee', roofBox = false, hatch = false, T }) {
  const L = len / 2;
  const belt = h * 0.62;
  const prof = hatch
    ? [[-L, 0.3], [L, 0.3], [L, 0.62], [L - 0.15, belt], [L - 0.95, belt + 0.06], [L - 1.6, h], [-L + 0.25, h - 0.04], [-L, belt + 0.02]]
    : [[-L, 0.3], [L, 0.3], [L + 0.02, 0.66], [L - 0.2, belt], [L - 1.05, belt + 0.05], [L - 1.75, h], [-L + 0.55, h], [-L + 0.05, belt + 0.06], [-L, 0.62]];
  const shape = new THREE.Shape(prof.map(([a, b]) => new THREE.Vector2(a, b)));
  let g = new THREE.ExtrudeGeometry(shape, { depth: wid, bevelEnabled: false, steps: 1 });
  put(g, { z: -wid / 2 });
  // UV planas (la textura del color es casi lisa)
  const bodyC = [1, 1, 1];
  g = bake(g, {
    dir: [-0.5, 0.8, 0.5], amb: 0.78, dif: 0.32,
    fn: (px, py, pz, nx, ny, nz) => {
      if (py > belt + 0.02 && ny < 0.8) return [0.16, 0.18, 0.21];   // vidrios
      if (py < 0.5) return [0.55, 0.55, 0.56];                         // parachoques / zócalo
      return bodyC;
    },
  });
  put(g, { x, z, ry });
  B.add(M.car(color), g, { raw: true });
  // ruedas
  for (const [wx, wz] of [[L - 0.75, wid / 2 - 0.12], [-L + 0.75, wid / 2 - 0.12], [L - 0.75, -wid / 2 + 0.12], [-L + 0.75, -wid / 2 + 0.12]]) {
    const wg = put(cyl(0.33, 0.33, 0.24, 8), { rx: Math.PI / 2 });
    const c = Math.cos(ry), s = Math.sin(ry);
    put(wg, { x: x + wx * c + wz * s, y: 0.33, z: z - wx * s + wz * c, ry });
    B.add(M.tire, wg);
  }
  if (roofBox) {
    const rb = box(len * 0.62, 0.32, wid * 0.86, 1);
    put(rb, { x: x - 0.1 * Math.cos(ry), y: h + 0.24, z, ry });
    B.add(M.roofbox, rb);
    for (const sx of [-1, 1]) { const bar = box(0.06, 0.1, wid * 0.9, 1); put(bar, { x: x + sx * 0.8 * Math.cos(ry), y: h + 0.04, z, ry }); B.add(M.metal, bar); }
  }
}

// árbol: tronco de pocas caras y copa de icosaedros deformados
function tree(B, mLeaf, mBark, { x, z, trunkH = 3, r = 1.6, n = 5, seed = 1, spread = 1.2, base = null, sy = 1 }) {
  const R = rng(seed);
  const t = cyl(0.07 * r, 0.12 * r, trunkH, 5, 0.6);
  put(t, { x, y: (base ?? 0) + trunkH / 2, z });
  B.add(mBark, t);
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(r * (0.6 + R() * 0.5), 0);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const v = new THREE.Vector3().fromBufferAttribute(p, k); const d = 1 + (vnoise(v.x * 2 + seed, v.y * 2, v.z * 2) - 0.5) * 0.45; p.setXYZ(k, v.x * d, v.y * d * sy, v.z * d); }
    const uv = new Float32Array(p.count * 2); for (let k = 0; k < p.count; k++) { uv[k * 2] = (p.getX(k) + p.getZ(k)) * 0.6; uv[k * 2 + 1] = p.getY(k) * 0.6; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const a = R() * Math.PI * 2, d = R() * spread * r;
    put(g, { x: x + Math.cos(a) * d, y: (base ?? 0) + trunkH + r * 0.4 + R() * r * 0.8 * sy, z: z + Math.sin(a) * d * 0.7 });
    const k = 0.82 + R() * 0.3;
    B.add(mLeaf, g, { amb: 0.42 * k, dif: 0.72 * k });
  }
}

export function buildCasa({ tod = 'day' } = {}) {
  const L = TOD[tod];
  const root = new THREE.Group();
  root.name = 'casa';
  const T = textures();
  const carTex = new Map();
  const M = {
    asphalt: mat(T.asphalt), concrete: mat(T.concrete), curb: mat(T.curb), pavers: mat(T.pavers), grass: mat(T.grass),
    plaster: mat(T.plaster), n667: mat(T.n667), ivy: mat(T.ivy, { alphaTest: 0.5, side: THREE.DoubleSide }),
    mesh: mat(T.mesh, { transparent: true, side: THREE.DoubleSide, depthWrite: false }), spikes: mat(T.spikes, { alphaTest: 0.5, side: THREE.DoubleSide }),
    metal: mat(T.metal), bark: mat(T.bark), bougain: mat(T.bougain),
    leafLight: mat(T.leaves('#7fb53b', '#cfe87a', 101)), leafDark: mat(T.leaves('#2f5a24', '#5f9640', 102)), leafMid: mat(T.leaves('#4a7f2c', '#9cc95a', 103)),
    tower: mat(T.tower), towerSide: mat(T.towerSide), brick: mat(T.brick), glass: mat(T.glass), house: mat(T.house),
    tire: mat(T.tire), roofbox: mat(T.roofbox),
    car: (c) => { if (!carTex.has(c)) carTex.set(c, mat(T.car(c))); return carTex.get(c); },
  };
  const B = new Batch(L.light);

  // ---- suelo: calle, solera, vereda, pasto, adoquines ----
  B.add(M.asphalt, floor(-45, 45, -2.2, 18, 0, 2.6, 1.6));
  const curb = box(90, 0.16, 0.24, [0.6, 0.16]); put(curb, { y: 0.07, z: -2.3 }); B.add(M.curb, curb);
  B.add(M.concrete, floor(-45, -0.9, -4.0, -2.42, 0.14, 1.5, 1.5));
  B.add(M.grass, floor(-45, -0.9, -4.8, -4.0, 0.14, 1.4, 1.5));
  B.add(M.pavers, floor(-0.9, 45, -4.8, -2.42, 0.14, 1.3, 1.5));
  // entrada detrás de la reja: adoquines que suben
  { const g = floor(1.2, 17, -14, -4.95, 0, 1.3, 1.6); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setY(i, 0.14 + Math.max(0, -p.getZ(i) - 5) * 0.07); B.add(M.pavers, g); }
  B.add(M.grass, floor(-45, 1.2, -16, -5.05, 0.5, 1.4, 2.5));

  // ---- muro con hiedra ----
  const wl = box(44, 2.3, 0.28, [1.2, 1.2]); put(wl, { x: -23, y: 1.29, z: -4.94 }); B.add(M.plaster, wl);
  { // cortina de hiedra delante del muro, con borde superior irregular
    const g = wall(-45, -1.15, 0.14, 3.35, -4.76, [14.0, 3.21], 2.0);
    B.add(M.ivy, g, { dir: [-0.3, 0.6, 0.75], amb: 0.62, dif: 0.45 });
    const top = wall(-45, -1.15, 0, 1.0, 0, [14.0, 1.0], 2.0); put(top, { rx: -Math.PI / 2, y: 2.46, z: -4.76 });
  }
  // bloque blanco del 667
  const blk = box(2.35, 2.3, 0.34, [1.2, 1.2]); put(blk, { x: 0.03, y: 1.29, z: -4.95 }); B.add(M.plaster, blk);
  B.add(M.n667, wall(-1.15, 1.2, 0.14, 2.44, -4.775, 1, 3, true), { dir: [-0.3, 0.7, 0.8], amb: 0.7, dif: 0.32 });
  // buganvilia sobre el bloque
  { const R = rng(5); for (let i = 0; i < 7; i++) { const g = new THREE.IcosahedronGeometry(0.55 + R() * 0.4, 0); const uv = g.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 2, uv.getY(k) * 2); put(g, { x: -0.4 + R() * 2.6, y: 2.6 + R() * 1.2, z: -5.6 - R() * 1.2, sy: 0.8 }); B.add(M.bougain, g, { amb: 0.6, dif: 0.5 }); } }

  // ---- reja gris ----
  const gx0 = 1.2, gx1 = 45;
  B.add(M.mesh, wall(gx0, gx1, 0.22, 2.42, -4.96, [0.5, 0.5], 3), { raw: false, amb: 0.9, dif: 0.1 });
  B.add(M.spikes, wall(gx0, gx1, 2.46, 2.62, -4.96, [0.5, 0.16], 6));
  for (let x = gx0 + 0.05; x < gx1; x += 3.3) { const p = box(0.1, 2.5, 0.1, 0.5); put(p, { x, y: 1.39, z: -4.96 }); B.add(M.metal, p); }
  for (const y of [0.24, 2.44]) { const r = box(gx1 - gx0, 0.07, 0.08, 1); put(r, { x: (gx0 + gx1) / 2, y, z: -4.96 }); B.add(M.metal, r); }
  { const d = box(0.07, 2.2, 0.08, 0.5); put(d, { x: 8.7, y: 1.32, z: -4.95 }); B.add(M.metal, d); }
  // muro gris oscuro a continuación (como el de la derecha de la foto)
  { const g = box(1.2, 2.5, 0.3, 1); put(g, { x: gx0 - 0.0, y: 1.39, z: -4.98 }); }

  // ---- casa blanca detrás ----
  { // volumen bajo detrás de la reja (garaje / acceso)
    const g = box(9, 3.0, 4, [4, 3]); put(g, { x: 7.5, y: 1.9, z: -10.5 }); B.add(M.house, g);
    const g2 = box(7, 2.6, 0.5, [4, 3]); put(g2, { x: 13, y: 1.7, z: -8.2 }); B.add(M.plaster, g2);
    // volumen alto con ventanal
    const up = box(10, 2.6, 5, [4, 2.6]); put(up, { x: -1.5, y: 4.0, z: -11.5 }); B.add(M.house, up);
    const slab = box(14, 0.2, 7.5, 2); put(slab, { x: -0.5, y: 5.45, z: -11 }); B.add(M.plaster, slab, { amb: 0.75, dif: 0.3 });
    const slab2 = box(8, 0.18, 4.5, 2); put(slab2, { x: 9.5, y: 3.5, z: -10.5 }); B.add(M.plaster, slab2, { amb: 0.75, dif: 0.3 });
    const base = box(16, 2.6, 6, 1.5); put(base, { x: -2, y: 1.4, z: -12 }); B.add(M.leafMid, base);
  }

  // ---- árboles ----
  tree(B, M.leafLight, M.bark, { x: -3.9, z: -4.35, trunkH: 4.3, r: 0.85, n: 14, seed: 11, spread: 2.4, sy: 0.8 });
  tree(B, M.leafLight, M.bark, { x: -9.5, z: -4.35, trunkH: 3.0, r: 1.5, n: 6, seed: 12 });
  tree(B, M.leafMid, M.bark, { x: -14, z: -9, trunkH: 4, r: 2.6, n: 7, seed: 13 });
  tree(B, M.leafDark, M.bark, { x: 13, z: -8.5, trunkH: 3, r: 2.6, n: 9, seed: 14, sy: 1.4 });
  tree(B, M.leafDark, M.bark, { x: 18.5, z: -7, trunkH: 2.5, r: 2.4, n: 8, seed: 15, sy: 1.5 });
  tree(B, M.leafMid, M.bark, { x: -7, z: -10, trunkH: 4.5, r: 2.2, n: 6, seed: 16 });
  tree(B, M.leafDark, M.bark, { x: 3.5, z: -16, trunkH: 3, r: 1.8, n: 6, seed: 17, sy: 2.6, spread: 0.4 });
  tree(B, M.leafDark, M.bark, { x: -24, z: -6, trunkH: 3, r: 2.6, n: 7, seed: 18, sy: 1.2 });
  tree(B, M.leafMid, M.bark, { x: 26, z: -9, trunkH: 3, r: 3, n: 8, seed: 19 });
  // poste de hormigón
  { const p = cyl(0.09, 0.13, 8.5, 6, 1); put(p, { x: -6.2, y: 4.25 + 0.14, z: -3.95 }); B.add(M.curb, p);
    const arm = box(1.4, 0.08, 0.08, 1); put(arm, { x: -5.6, y: 8.2, z: -3.95 }); B.add(M.metal, arm);
    const lamp = box(0.45, 0.12, 0.22, 1); put(lamp, { x: -5.0, y: 8.12, z: -3.95 }); B.add(M.metal, lamp); }

  // ---- edificios ----
  { // el edificio blanco facetado de la derecha: planta de 5 lados, techo escalonado hacia la izquierda
    const foot = [[10, -27], [14.5, -24], [21, -25.5], [22, -37], [11, -37]];
    const tops = [24, 33, 37, 37, 30];
    const Mf = new Mesher();
    for (let i = 0; i < foot.length; i++) {
      const [ax, az] = foot[i], [bx, bz] = foot[(i + 1) % foot.length];
      const ha = tops[i], hb = tops[(i + 1) % foot.length];
      const len = Math.hypot(bx - ax, bz - az), u0 = 0, u1 = len / 12;
      Mf.quad([ax, 0, az], [bx, 0, bz], [bx, hb, bz], [ax, ha, az], [[u0, 0], [u1, 0], [u1, hb / 12], [u0, ha / 12]]);
    }
    B.add(M.tower, Mf.geometry(), { dir: [-0.6, 0.6, 0.55], amb: 0.66, dif: 0.42 });
    const roof = new Mesher(); roof.tri([10, 24, -27], [14.5, 33, -24], [11, 30, -37]); roof.tri([14.5, 33, -24], [21, 37, -25.5], [22, 37, -37]); roof.tri([14.5, 33, -24], [22, 37, -37], [11, 30, -37]);
    B.add(M.towerSide, roof.geometry());
  }
  for (const [x, z, w, d, h, m] of [[-19, -31, 9, 9, 29, 'brick'], [-8, -55, 8, 8, 46, 'glass'], [-30, -40, 10, 10, 22, 'towerSide'], [30, -45, 10, 10, 26, 'towerSide'], [3, -70, 12, 10, 34, 'brick']]) {
    const g = box(w, h, d, [8, 8]); put(g, { x, y: h / 2, z }); B.add(M[m], g, { dir: [-0.6, 0.6, 0.55], amb: 0.68, dif: 0.4 });
  }

  // ---- autos estacionados junto a la solera (los de los extremos dejan ver el portón) ----
  car(B, M, { x: 5.9, z: -1.25, len: 4.45, color: '#f2f2ef', roofBox: true, T });
  car(B, M, { x: -5.8, z: -1.25, len: 4.0, h: 1.48, color: '#9b9ea1', hatch: true, ry: Math.PI, T });
  car(B, M, { x: 12.5, z: -1.25, len: 4.6, h: 1.42, color: '#2f4f86', T });
  car(B, M, { x: -12.5, z: -1.25, len: 3.8, h: 1.45, color: '#b33a2e', hatch: true, ry: Math.PI, T });

  B.build(root);
  root.add(skyDome(L.sky));
  return {
    root, name: 'CASA PLATANUS', sub: 'SORIA 667 · LAS CONDES', tod,
    fog: L.fog, chars: L.chars, bound: 7.2, lineZ: 0, floorY: 0,
    cams: { select: { pos: [0, 1.05, 4.6], look: [0, 1.55, 0], fov: 56 } },
    update() {},
    dispose() { root.traverse((o) => { o.geometry?.dispose(); }); Object.values(T).forEach((t) => t.dispose?.()); },
  };
}
