// Oficina de Buk: el muro azul con el mural de dibujos de colores y el logo, la tarima de
// madera delante, cielo de hormigón a la vista con ductos plateados, la cañería roja y
// las lámparas lineales; ventanales a la izquierda, planta y puf a la derecha.
import * as THREE from 'three';
import { mat, tex, pixels, noisy, hex, css, mix, mul, Mesher, Batch, box, cyl, floor, wall, put, flat, skyDome, rng, fbm, vnoise, grain } from './kit.js';

const MZ = -4.6, MX = 8.6, MH = 4.5;

// mural original en el espíritu del de la foto: fondo azul, dibujos sueltos de colores, logo blanco
function paintMural(g, W, H) {
  const R = rng(5150);
  pixels(g, W, H, (x, y) => {
    const n = fbm(x * 0.012, y * 0.05, 501), s = fbm(x * 0.2, y * 0.02, 502);
    return mul(mix(hex('#2257c4'), hex('#2f6fe0'), n), 0.94 + s * 0.12);
  });
  const P = { cream: '#f6e3b4', yellow: '#ffd23f', orange: '#ff8a2b', red: '#ff4a3a', pink: '#ff9fc8', magenta: '#e8457c', mint: '#9fe3c4', green: '#3fb873', sky: '#a6dcff', white: '#fbf7ee', lilac: '#c9a6ff' };
  const cols = Object.values(P);
  const pick = (...k) => P[k[Math.floor(R() * k.length)]];
  const logo = { x: W * 0.5, y: H * 0.36, w: 230, h: 90 };
  const free = (x, y, r) => !(Math.abs(x - logo.x) < logo.w / 2 + r && Math.abs(y - logo.y) < logo.h / 2 + r);
  const blob = (x, y, r, fill) => {
    g.fillStyle = fill; g.beginPath();
    const k = 7 + Math.floor(R() * 4), pts = [];
    for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2, rr = r * (0.65 + R() * 0.5); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8]); }
    g.moveTo((pts[0][0] + pts[k - 1][0]) / 2, (pts[0][1] + pts[k - 1][1]) / 2);
    for (let i = 0; i < k; i++) { const p = pts[i], q = pts[(i + 1) % k]; g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
    g.fill();
  };
  const star = (x, y, r, n, fill, inner = 0.45) => { g.fillStyle = fill; g.beginPath(); for (let i = 0; i <= n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? r * inner : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.fill(); };
  const line = (w, c) => { g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; };
  const D = {
    sun(x, y, r) { const c = pick('yellow', 'orange', 'red'); line(3, c); for (let i = 0; i < 12; i++) { const a = i / 12 * 7; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.stroke(); } g.fillStyle = c; g.beginPath(); g.arc(x, y, r * 0.42, 0, 7); g.fill(); },
    flower(x, y, r) { const c = pick('pink', 'red', 'yellow', 'white', 'lilac'), n = 5 + Math.floor(R() * 3); g.fillStyle = c; for (let i = 0; i < n; i++) { const a = i / n * 7; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.36, 0, 7); g.fill(); } g.fillStyle = pick('yellow', 'orange', 'white'); g.beginPath(); g.arc(x, y, r * 0.3, 0, 7); g.fill(); },
    leaf(x, y, r) { const c = pick('green', 'mint', 'pink'); line(2.5, c); const a0 = -Math.PI / 2 + (R() - 0.5); g.beginPath(); g.moveTo(x, y + r); g.quadraticCurveTo(x + (R() - 0.5) * r, y, x + Math.cos(a0) * r, y + Math.sin(a0) * r); g.stroke(); g.fillStyle = c; for (let i = 0; i < 4; i++) { const t = 0.2 + i * 0.2; g.beginPath(); g.ellipse(x + (i % 2 ? 1 : -1) * r * 0.25, y + r - t * r * 1.6, r * 0.28, r * 0.12, (i % 2 ? -1 : 1) * 0.6, 0, 7); g.fill(); } },
    bulb(x, y, r) { g.fillStyle = P.yellow; g.beginPath(); g.arc(x, y - r * 0.15, r * 0.5, 0, 7); g.fill(); g.fillStyle = P.cream; g.fillRect(x - r * 0.2, y + r * 0.3, r * 0.4, r * 0.3); line(2, P.white); g.beginPath(); g.arc(x, y - r * 0.15, r * 0.5, 0, 7); g.stroke(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.5; g.beginPath(); g.moveTo(x + Math.cos(a) * r * 0.7, y - r * 0.15 + Math.sin(a) * r * 0.7); g.lineTo(x + Math.cos(a) * r * 0.95, y - r * 0.15 + Math.sin(a) * r * 0.95); g.stroke(); } },
    cup(x, y, r) { const c = pick('pink', 'cream', 'red', 'sky'); g.fillStyle = c; g.beginPath(); g.moveTo(x - r * 0.45, y - r * 0.4); g.lineTo(x + r * 0.45, y - r * 0.4); g.lineTo(x + r * 0.32, y + r * 0.5); g.lineTo(x - r * 0.32, y + r * 0.5); g.fill(); line(3, c); g.beginPath(); g.arc(x + r * 0.48, y, r * 0.2, -1.4, 1.4); g.stroke(); line(2, P.white); for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x - r * 0.2 + i * r * 0.2, y - r * 0.55); g.quadraticCurveTo(x - r * 0.3 + i * r * 0.2, y - r * 0.8, x - r * 0.2 + i * r * 0.2, y - r); g.stroke(); } },
    smile(x, y, r) { g.fillStyle = pick('yellow', 'pink', 'orange'); g.beginPath(); g.arc(x, y, r * 0.5, 0, 7); g.fill(); g.fillStyle = '#2a1f2a'; g.beginPath(); g.arc(x - r * 0.17, y - r * 0.1, r * 0.06, 0, 7); g.arc(x + r * 0.17, y - r * 0.1, r * 0.06, 0, 7); g.fill(); line(2, '#2a1f2a'); g.beginPath(); g.arc(x, y + r * 0.02, r * 0.25, 0.3, Math.PI - 0.3); g.stroke(); },
    star4(x, y, r) { star(x, y, r * 0.6, 4, pick('white', 'yellow', 'pink', 'mint'), 0.3); },
    star8(x, y, r) { star(x, y, r * 0.6, 8, pick('red', 'orange', 'yellow', 'magenta'), 0.5); },
    fish(x, y, r) { const c = pick('orange', 'red', 'pink'); g.fillStyle = c; g.beginPath(); g.ellipse(x, y, r * 0.5, r * 0.25, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + r * 0.4, y); g.lineTo(x + r * 0.75, y - r * 0.25); g.lineTo(x + r * 0.75, y + r * 0.25); g.fill(); g.fillStyle = '#1a1a2a'; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.05, r * 0.05, 0, 7); g.fill(); },
    squiggle(x, y, r) { line(3, pick('white', 'pink', 'yellow', 'mint')); g.beginPath(); for (let i = 0; i <= 12; i++) { const t = i / 12; g.lineTo(x - r * 0.6 + t * r * 1.2, y + Math.sin(t * 9) * r * 0.15); } g.stroke(); },
    dots(x, y, r) { g.fillStyle = pick('white', 'yellow', 'pink'); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x + (R() - 0.5) * r, y + (R() - 0.5) * r, 2 + R() * 2, 0, 7); g.fill(); } },
    flame(x, y, r) { g.fillStyle = pick('orange', 'red', 'yellow'); g.beginPath(); g.moveTo(x, y - r * 0.6); g.quadraticCurveTo(x + r * 0.45, y, x, y + r * 0.45); g.quadraticCurveTo(x - r * 0.45, y, x, y - r * 0.6); g.fill(); },
    balloon(x, y, r) { const c = pick('red', 'pink', 'yellow', 'mint', 'lilac'); g.fillStyle = c; g.beginPath(); g.ellipse(x, y - r * 0.15, r * 0.32, r * 0.4, 0, 0, 7); g.fill(); line(1.5, P.white); g.beginPath(); g.moveTo(x, y + r * 0.25); g.quadraticCurveTo(x + r * 0.15, y + r * 0.5, x - r * 0.05, y + r * 0.8); g.stroke(); },
  };
  // fondo: manchas grandes crema/amarillas y plantas que suben desde abajo
  for (let i = 0; i < 9; i++) { const x = R() * W, y = H * (0.55 + R() * 0.5); if (free(x, y, 60)) blob(x, y, 40 + R() * 50, pick('cream', 'yellow', 'pink', 'mint')); }
  g.fillStyle = P.cream; g.fillRect(0, 0, 26, H); g.fillStyle = P.yellow; g.fillRect(26, 0, 6, H);
  for (let i = 0; i < 14; i++) { const x = R() * W; if (free(x, H * 0.8, 40)) D.leaf(x, H - 30 - R() * 40, 40 + R() * 30); }
  // dibujos medianos y chicos en una grilla con desorden
  const kinds = Object.keys(D);
  for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 26; gx++) {
    const x = (gx + 0.5 + (R() - 0.5) * 0.8) * (W / 26), y = (gy + 0.5 + (R() - 0.5) * 0.7) * (H / 6);
    const r = 14 + R() * 22;
    if (!free(x, y, r * 0.6) || R() < 0.12) continue;
    g.save(); g.translate(x, y); g.rotate((R() - 0.5) * 0.9); g.translate(-x, -y);
    D[kinds[Math.floor(R() * kinds.length)]](x, y, r);
    g.restore();
  }
  // logo
  g.fillStyle = P.white; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.font = '700 72px "Arial Rounded MT Bold", "Nunito", "Helvetica Neue", sans-serif';
  const tw = g.measureText('buk').width;
  g.fillText('buk', logo.x - tw / 2 + 10, logo.y + 22);
  g.beginPath(); g.arc(logo.x - tw / 2 - 8, logo.y + 2, 7, 0, 7); g.fill();
}

function textures() {
  const T = {};
  T.mural = tex(1024, 256, paintMural, { repeat: false });
  T.floor = tex(64, 64, (g, w, h) => pixels(g, w, h, (x, y) => {
    const plank = Math.floor(y / 8), off = (plank * 23) % 64;
    let c = noisy('#c49a6c', { sc: 0.05, amp: 0.08, gr: 0.03, seed: 511 })(x * 0.25 + off, y * 2);
    c = mul(c, 0.9 + grain(plank, Math.floor((x + off) / 48), 512) * 0.2);
    if (y % 8 === 0 || (x + off) % 48 === 0) c = mul(c, 0.84);
    return c;
  }));
  T.deck = tex(64, 32, (g, w, h) => pixels(g, w, h, (x, y) => {
    let c = noisy('#d2ab7c', { sc: 0.05, amp: 0.1, gr: 0.06, seed: 513 })(x * 0.25, y * 2);
    if (y % 8 === 0) c = mul(c, 0.75);
    return c;
  }));
  T.ceiling = tex(32, 32, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#5d5f63', { sc: 0.1, amp: 0.12, gr: 0.08, seed: 514 })(x, y)));
  T.duct = tex(32, 16, (g, w, h) => pixels(g, w, h, (x, y) => { let c = noisy('#c4c8cc', { sc: 0.2, amp: 0.08, gr: 0.08, seed: 515 })(x, y); if (x % 16 === 0) c = mul(c, 0.7); if (y < 5) c = mul(c, 1.12); return c; }));
  T.red = tex(8, 8, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#c8231c', { sc: 0.5, amp: 0.1, gr: 0.1, seed: 516 })(x, y)));
  T.white = tex(32, 32, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#ecebe6', { sc: 0.1, amp: 0.04, gr: 0.04, seed: 517 })(x, y)));
  T.window = tex(64, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#dff0ff'); gr.addColorStop(0.6, '#f4f9ff'); gr.addColorStop(1, '#cfd9df');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = '#b9c7d2'; for (let i = 0; i < 5; i++) g.fillRect(i * 14 + 2, 30 - i % 3 * 6, 10, 40);
    g.fillStyle = '#9fb59a'; g.fillRect(0, 52, w, 12);
    g.fillStyle = '#3a3d42'; g.fillRect(0, 0, 3, h); g.fillRect(0, 0, w, 3); g.fillRect(0, 40, w, 2);
  });
  T.leaves = tex(32, 32, (g, w, h) => { const R = rng(518); g.fillStyle = '#1f4a1c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { g.fillStyle = ['#2f6a28', '#3f8a33', '#6aa84a'][Math.floor(R() * 3)]; g.beginPath(); g.ellipse(R() * w, R() * h, 2.5, 1.2, R() * 3, 0, 7); g.fill(); } });
  T.pot = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#e9e6df', { sc: 0.3, amp: 0.05, gr: 0.06, seed: 519 })(x, y)));
  T.puff = tex(16, 16, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#8d9096', { sc: 0.3, amp: 0.12, gr: 0.1, seed: 520 })(x, y)));
  T.dark = tex(8, 8, (g, w, h) => pixels(g, w, h, (x, y) => noisy('#2c2e33', { sc: 0.5, amp: 0.1, gr: 0.1, seed: 521 })(x, y)));
  return T;
}

export function buildBuk() {
  const root = new THREE.Group(); root.name = 'buk';
  const T = textures();
  const M = {
    mural: mat(T.mural), floor: mat(T.floor), deck: mat(T.deck), ceiling: mat(T.ceiling), duct: mat(T.duct), red: mat(T.red),
    white: mat(T.white), window: mat(T.window), leaves: mat(T.leaves), pot: mat(T.pot), puff: mat(T.puff), dark: mat(T.dark), glow: mat(null),
  };
  const B = new Batch({ dir: [-0.65, 0.65, 0.4], amb: 0.68, dif: 0.36 });

  B.add(M.floor, floor(-14, 14, -4.6, 14, 0, 2.6, 1.4));
  // muro del mural (la textura cubre todo el ancho)
  B.add(M.mural, wall(-MX, MX, 0, MH, MZ, 1, 1.6, true), { amb: 0.84, dif: 0.2 });
  B.add(M.white, wall(-14, -MX, 0, 4.7, MZ, 1.2, 2), { amb: 0.78, dif: 0.2 });
  B.add(M.white, wall(MX, 14, 0, 4.7, MZ, 1.2, 2), { amb: 0.74, dif: 0.2 });
  B.add(M.white, wall(-MX, MX, MH, 4.7, MZ, 1.2, 2), { amb: 0.6, dif: 0.1 });
  // tarima de madera y escalón
  { const d = box(17.2, 0.42, 1.4, [1.6, 0.4]); put(d, { y: 0.21, z: MZ + 0.7 }); B.add(M.deck, d);
    const s = box(17.2, 0.21, 0.42, [1.6, 0.4]); put(s, { y: 0.105, z: MZ + 1.6 }); B.add(M.deck, s); }
  // cielo de hormigón, ductos, cañería roja, luces lineales
  { const c = floor(-14, 14, -14, 4.6, 0, 2, 2); put(c, { rx: Math.PI, y: 4.7 }); B.add(M.ceiling, c, { amb: 0.55, dif: 0 });
    for (const [z, y, r] of [[-3.7, 4.12, 0.32], [0.6, 4.2, 0.26], [4.5, 4.15, 0.3]]) {
      const d = cyl(r, r, 28, 8, 1); put(d, { rz: Math.PI / 2, y, z }); B.add(M.duct, d, { amb: 0.7, dif: 0.35 });
      for (let x = -10; x <= 10; x += 5) { const df = cyl(0.18, 0.22, 0.2, 8); put(df, { x: x + 1.2, y: y - r - 0.08, z }); B.add(M.white, df, { amb: 0.8 }); }
    }
    const p = cyl(0.055, 0.055, 28, 6); put(p, { rz: Math.PI / 2, y: 4.5, z: -4.25 }); B.add(M.red, p, { amb: 0.75 });
    const p2 = cyl(0.055, 0.055, 12, 6); put(p2, { rx: Math.PI / 2, y: 4.5, x: 5.5, z: 1.6 }); B.add(M.red, p2, { amb: 0.75 });
    for (const x of [-6.5, -2.2, 2.2, 6.5]) for (const z of [-2.1, 2.2]) {
      const l = box(0.1, 0.07, 2.6, 1); put(l, { x, y: 3.85, z }); B.add(M.glow, l, { flat: [1.3, 1.3, 1.28] });
      const h = box(0.14, 0.05, 2.7, 1); put(h, { x, y: 3.9, z }); B.add(M.dark, h);
    }
  }
  // ventanales a la izquierda y una columna
  { const wnd = wall(-14, 0, 0, 4.7, 0, [1.6, 4.7], 1.6, false); put(wnd, { ry: Math.PI / 2, x: -9.4, z: -4.6 }); B.add(M.window, wnd, { flat: [1.12, 1.12, 1.1] });
    const col = box(0.6, 4.7, 0.6, [1, 1]); put(col, { x: -8.7, y: 2.35, z: -4.1 }); B.add(M.white, col);
    const col2 = box(0.6, 4.7, 0.6, [1, 1]); put(col2, { x: -8.7, y: 2.35, z: 3.5 }); B.add(M.white, col2); }
  // pared derecha, planta grande y puf gris
  { const rw = wall(-14, 0, 0, 4.7, 0, [1.2, 1.2], 2); put(rw, { ry: -Math.PI / 2, x: 9.4, z: 9.4 }); B.add(M.white, rw, { amb: 0.66, dif: 0.1 });
    const pot = cyl(0.42, 0.32, 0.65, 8, 1); put(pot, { x: 7.7, y: 0.32, z: -2.2 }); B.add(M.pot, pot);
    const trunk = cyl(0.05, 0.07, 1.6, 5); put(trunk, { x: 7.7, y: 1.4, z: -2.2 }); B.add(M.dark, trunk);
    const R = rng(77); for (let i = 0; i < 9; i++) { const b = new THREE.IcosahedronGeometry(0.45 + R() * 0.25, 0); put(b, { x: 7.7 + (R() - 0.5) * 1.1, y: 1.9 + R() * 1.5, z: -2.2 + (R() - 0.5) * 0.9 }); B.add(M.leaves, b, { amb: 0.55, dif: 0.55 }); }
    const puff = new THREE.SphereGeometry(0.6, 8, 5); put(puff, { x: 6.2, y: 0.32, z: -2.6, sy: 0.55 }); B.add(M.puff, puff);
    const puff2 = new THREE.SphereGeometry(0.55, 8, 5); put(puff2, { x: -7.2, y: 0.3, z: -2.4, sy: 0.55 }); B.add(M.puff, puff2); }

  B.build(root);
  root.add(skyDome(() => [0.85, 0.87, 0.9]));
  return {
    root, name: 'BUK', sub: 'EL MURAL DE LA OFICINA', tod: 'day',
    fog: ['#d7dbe0', 18, 70], chars: { hemi: ['#f3f6ff', '#7d6a56', 1.7], key: ['#ffffff', 1.35, [-2.2, 1.8, 1.2]] },
    bound: 7.2, lineZ: 0, floorY: 0,
    cams: { select: { pos: [0, 1.05, 4.6], look: [0, 1.7, 0], fov: 56 } },
    update() {},
  };
}
