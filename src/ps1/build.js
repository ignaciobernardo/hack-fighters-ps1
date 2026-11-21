// spec + foto → personaje low-poly estilo PS1: una malla con skin, un atlas de 512 px.
// Usa el mismo esqueleto y las mismas poses que el generador cel.
import * as THREE from 'three';
import { proportions, buildSkeleton } from '../gen/skeleton.js';
import { torsoProfile } from '../gen/body.js';
import { Low, V, lerp, clamp, smooth, skin1, skin2, angles, loft, loftPoly } from './low.js';
import { S, R, CAP, SOLE, HAND, EXTRA, ARM_R, makePlan, torsoV, armV, legV } from './plan.js';
import { readPhoto, headModel, photoColors, hairLength } from './photo.js';
import { paintAtlas } from './atlas.js';
import { makePS1Material } from './material.js';

const X1 = V(1, 0, 0), Y1 = V(0, 1, 0), Z1 = V(0, 0, 1);

const torsoSkin = (s) => {
  if (s < 0.2) return skin1('hips');
  if (s < 0.45) return skin2('hips', 'spine', smooth((s - 0.2) / 0.25));
  if (s < 0.72) return skin2('spine', 'chest', smooth((s - 0.45) / 0.27));
  return skin1('chest');
};

// ---------------- cabeza ----------------
// melena: cortina de pelo desde las cejas hacia abajo, por atrás y los costados
function buildLongHair(L, P, hm, len) {
  const B = R.headB, k = hm.k, faceLen = (hm.rows.chin - hm.rows.eye) * k;
  const brow = hm.rings[4], nose = hm.rings[2];
  const zc = (brow.zf + brow.zb) / 2 - 0.1 * hm.D, rz0 = (brow.zf - brow.zb) / 2 * 1.02, rx0 = Math.max(brow.hw, nose.hw * 1.08) * 1.04;
  const yEnd = P.chinY - len * faceLen;
  const levels = [[brow.y, 1.02, 1.0], [nose.y, 1.12, 1.05], [P.chinY, 1.2, 1.04], [lerp(P.chinY, yEnd, 0.55), 1.24, 1.0], [yEnd, 1.08, 0.86]];
  const A = 2.2, N = 8;
  const rows = levels.map(([y, kx, kz], i) => Array.from({ length: N + 1 }, (_, j) => {
    const t = -A + (2 * A * j) / N, fr = Math.abs(t) / A;
    const wob = 1 + (j % 2 ? 0.035 : -0.02) * i;
    return { p: V(brow.cx - Math.sin(t) * rx0 * kx * wob, y + (i === levels.length - 1 ? (j % 2 ? 0.012 : -0.01) * P.H - fr * fr * 0.012 * P.H : 0), zc - Math.cos(t) * rz0 * kz * wob), skin: skin1('head'), t, i };
  }));
  const map = (p) => {
    const row = rows.flat().reduce((b, q) => (q.p.distanceToSquared(p) < b.p.distanceToSquared(p) ? q : b));
    return [B.x + (0.5 + (row.t / (Math.PI * 2)) * 0.8) * B.w, B.y + lerp(0.08, 0.92, row.i / (levels.length - 1)) * B.h];
  };
  for (let i = 0; i < rows.length - 1; i++) {
    const inside = V(brow.cx, (levels[i][0] + levels[i + 1][0]) / 2, zc);
    for (let j = 0; j < N; j++) L.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j], { inside, map, group: 'hairlong' });
  }
}

function buildHead(L, P, hm, spec) {
  const th = angles(12);
  const F = R.headF, B = R.headB, cr = hm.crop;
  const rings = hm.rings.map((r, i) => ({
    c: V(r.cx, r.y, (r.zf + r.zb) / 2), X: X1, Z: Z1, rx: r.hw, rz: (r.zf - r.zb) / 2, e: r.e, v: 0, skin: skin1('head'),
    warp: r.bump ? (p, t) => { if (Math.abs(t - Math.PI) < 1e-3) p.z += r.bump; } : null,
  }));
  const tOf = (y) => clamp((y - P.chinY) / (hm.topY - P.chinY));
  const map = (p, n) => {
    if (n.z > 0.24) {
      const [px, py] = hm.toPhoto(p);
      return [F.x + ((px - cr.x0) / cr.w) * F.w, F.y + ((py - cr.y0) / cr.h) * F.h];
    }
    const a = Math.atan2(p.x, p.z - hm.z0);
    const uu = ((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    return [B.x + uu * B.w, B.y + (1 - tOf(p.y)) * B.h];
  };
  const fixWrap = (uvs, n) => {
    if (n.z > 0.24) return uvs;   // cara
    const xs = uvs.map((q) => q[0]);
    if (Math.max(...xs) - Math.min(...xs) < B.w / 2) return uvs;
    return uvs.map(([x, y]) => [Math.min(B.x + B.w - 0.5, x < B.x + B.w / 2 ? x + B.w : x), y]);
  };
  const rows = rings.map((r) => th.map((t) => {
    const e = 2 / (r.e ?? 2);
    const p = r.c.clone().addScaledVector(X1, Math.sign(-Math.sin(t)) * Math.abs(Math.sin(t)) ** e * r.rx).addScaledVector(Z1, Math.sign(-Math.cos(t)) * Math.abs(Math.cos(t)) ** e * r.rz);
    if (r.warp) r.warp(p, t);
    return { p, skin: r.skin };
  }));
  const center = V(0, (P.chinY + hm.topY) / 2, hm.z0);
  for (let i = 0; i < rows.length - 1; i++) {
    const inside = rings[i].c.clone().lerp(rings[i + 1].c, 0.5);
    for (let j = 0; j < th.length - 1; j++) L.quad(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j], { inside, map, fixWrap, group: 'head' });
  }
  // coronilla y bajo el mentón
  const pole = { p: V(hm.pole.x, hm.pole.y, hm.pole.z), skin: skin1('head') };
  const last = rows[rows.length - 1];
  for (let j = 0; j < th.length - 1; j++) L.tri(last[j], last[j + 1], pole, { inside: center, map, fixWrap, group: 'head' });
  const first = rows[0], chinC = { p: rings[0].c.clone().add(V(0, -0.004 * P.H, -0.01 * P.H)), skin: skin1('head') };
  for (let j = 0; j < th.length - 1; j++) L.tri(first[j], first[j + 1], chinC, { dir: V(0, -1, 0.2), map, fixWrap, group: 'head' });

  // audífonos (la foto ya los trae de frente; acá van con volumen)
  const hp = spec.acc?.headphones;
  if (hp) {
    const ear = hm.rings[2], earY = lerp(hm.rings[2].y, hm.rings[3].y, 0.4);
    const r = 0.036 * P.H, dep = 0.022 * P.H;
    const cupX = Math.max(hm.rings[2].hw, hm.rings[3].hw) * 0.86;
    const cz = hm.z0 - 0.12 * hm.D;
    for (const sg of [-1, 1]) {
      const c0 = V(sg * (cupX - dep * 0.2), earY, cz), c1 = V(sg * (cupX + dep * 0.8), earY, cz);
      const ringsCup = [
        { c: c0, X: Y1, Z: Z1, rx: r * 0.9, rz: r * 0.8, e: 2, v: EXTRA.cup.y + 2, skin: skin1('head') },
        { c: c0.clone().lerp(c1, 0.6), X: Y1, Z: Z1, rx: r, rz: r * 0.92, e: 2.2, v: EXTRA.cup.y + 16, skin: skin1('head') },
        { c: c1, X: Y1, Z: Z1, rx: r * 0.92, rz: r * 0.85, e: 2.2, v: EXTRA.cup.y + 30, skin: skin1('head') },
      ];
      const capMap = (p) => [EXTRA.cap.x + clamp((p.z - cz) / r * 0.5 + 0.5) * EXTRA.cap.w, EXTRA.cap.y + clamp(0.5 - (p.y - earY) / r * 0.5) * EXTRA.cap.h];
      loft(L, ringsCup, { th: angles(8), x: EXTRA.cup.x, w: EXTRA.cup.w, group: null, capEnd: { uv: [EXTRA.cap.x + 16, EXTRA.cap.y + 16], map: capMap } });
    }
    // diadema
    const top = hm.topY + 0.004 * P.H;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * Math.PI;
      pts.push(V(Math.sin(a) * (cupX + dep * 0.3), earY + 0.035 * P.H + Math.cos(a) * (top - earY - 0.035 * P.H), cz));
    }
    const bandRings = pts.map((p, i) => {
      const tng = pts[Math.min(8, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      const out = Z1.clone().cross(tng).normalize();
      return { c: p, X: out, Z: Z1, rx: 0.006 * P.H, rz: 0.016 * P.H, e: 3, v: EXTRA.band.y + (i / 8) * EXTRA.band.h, skin: skin1('head') };
    });
    loft(L, bandRings, { th: angles(4, true), x: EXTRA.band.x, w: EXTRA.band.w, group: null });
  }
}

// ---------------- cuello ----------------
function buildNeck(L, P) {
  const u = P.H, r = 0.035 * u * lerp(0.9, 1.15, P.build);
  const rings = [
    { c: V(0, P.neckBaseY - 0.035 * u, -0.008 * u), rx: r * 1.15, rz: r * 1.05, skin: skin1('chest'), v: R.neck.y + R.neck.h },
    { c: V(0, P.neckBaseY + 0.012 * u, -0.005 * u), rx: r, rz: r * 0.95, skin: skin2('chest', 'neck', 0.6), v: R.neck.y + R.neck.h * 0.55 },
    { c: V(0, P.chinY + 0.03 * u, -0.004 * u), rx: r * 0.95, rz: r * 0.92, skin: skin2('neck', 'head', 0.7), v: R.neck.y },
  ].map((k) => ({ ...k, X: X1, Z: Z1, e: 2 }));
  loft(L, rings, { th: angles(6, true), x: R.neck.x, w: R.neck.w, group: 'neck' });
}

// ---------------- torso ----------------
function torsoRings(P, spec, plan) {
  const prof = torsoProfile(P, spec);
  const ss = new Set([-0.1, 0.0, 0.13, 0.36, 0.58, 0.76, 0.87, 0.95, 1.0]);
  for (const b of plan.torsoBreaks) { ss.add(+(b - 0.004).toFixed(4)); ss.add(+(b + 0.004).toFixed(4)); }
  const list = [...ss].filter((s) => s >= -0.1 && s <= 1).sort((a, b) => a - b);
  const ring = (s) => {
    const r = prof(Math.min(1, s)), off = plan.torsoOff(s);
    return { s, c: V(0, lerp(P.crotchY, P.neckBaseY, s), r.zc), X: X1, Z: Z1, rx: r.rx + off, rz: r.rz + off, e: Math.min(2.6, r.e), v: torsoV(s), skin: torsoSkin(s) };
  };
  const rings = list.map(ring);
  // cuello alto de chaqueta (polar)
  if (plan.jk && (plan.jk.collar === 'high')) {
    const nr = 0.031 * P.H * lerp(0.9, 1.15, P.build);
    for (const [s, k] of [[1.05, 1.9], [1.14, 1.75]]) rings.push({ s, c: V(0, lerp(P.crotchY, P.neckBaseY, s), -0.006 * P.H), X: X1, Z: Z1, rx: nr * k, rz: nr * k * 0.95, e: 2.2, v: torsoV(s), skin: skin2('chest', 'neck', (s - 1) * 4) });
  } else if (plan.top.type === 'shirt' && (!plan.jk || plan.jk.type === 'vest')) {
    const nr = 0.031 * P.H * lerp(0.9, 1.15, P.build);
    rings.push({ s: 1.06, c: V(0, lerp(P.crotchY, P.neckBaseY, 1.06), -0.008 * P.H), X: X1, Z: Z1, rx: nr * 1.45, rz: nr * 1.4, e: 2.2, v: torsoV(1.06), skin: skin2('chest', 'neck', 0.25) });
  }
  return { rings, ringAt: (s) => ring(Math.max(-0.1, Math.min(1, s))) };
}

function buildTorso(L, P, spec, plan, tr) {
  const collar = tr.rings[tr.rings.length - 1].s > 1.0;
  loft(L, tr.rings, {
    th: angles(8, true), x: R.torso.x, w: R.torso.w, group: 'torso',
    capStart: { uv: CAP.crotch }, capEnd: collar ? null : { uv: CAP.collar },
  });
  // capucha: un rollo de tela detrás del cuello
  if (plan.jk && plan.jk.collar === 'hood') {
    const u = P.H, y = P.neckBaseY + 0.004 * u, H = EXTRA.hood;
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const a = lerp(-1.45, 1.45, i / 6);
      const back = Math.cos(a);
      pts.push(V(Math.sin(a) * 0.066 * u, y + 0.012 * u * Math.max(0, back), -0.01 * u - Math.cos(a) * (0.052 + 0.016 * Math.max(0, back)) * u));
    }
    const rings = pts.map((p, i) => {
      const tng = pts[Math.min(6, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
      const side = Y1.clone().cross(tng).normalize();
      const back = Math.max(0, Math.cos(lerp(-1.45, 1.45, i / 6)));
      return { c: p, X: Y1, Z: side, rx: (0.016 + 0.016 * back) * u, rz: (0.014 + 0.018 * back) * u, e: 2, v: H.y + (i / 6) * H.h, skin: skin2('chest', 'neck', 0.2) };
    });
    loft(L, rings, { th: angles(6, true), x: H.x, w: H.w, group: 'hood', capStart: { uv: [H.x + 4, H.y + 4] }, capEnd: { uv: [H.x + 4, H.y + H.h - 4] } });
  }
}

// ---------------- brazos y manos ----------------
function buildArms(L, P, plan) {
  const u = P.H, k = P.k, len = P.upperArm + P.foreArm, e = P.upperArm / len;
  const set = new Set([-0.1, 0.0, 0.2, 0.42, 0.5, 0.58, 0.78, 1.0]);
  for (const b of plan.armBreaks) { set.add(+(b - 0.006).toFixed(4)); set.add(+(b + 0.006).toFixed(4)); }
  const list = [...set].filter((x) => x >= -0.1 && x <= 1).sort((a, b) => a - b);
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const skinAt = (uu) => {
      if (uu < 0) return skin2('clav' + s, 'arm' + s, smooth((uu + 0.1) / 0.1));
      if (uu < e - 0.1) return skin1('arm' + s);
      if (uu < e + 0.1) return skin2('arm' + s, 'fore' + s, smooth((uu - (e - 0.1)) / 0.2));
      return skin1('fore' + s);
    };
    const rings = list.map((uu) => {
      const [a, b] = ARM_R(clamp(uu));
      const off = plan.armOff(uu);
      // el arranque del brazo queda dentro del torso (sin hombreras que asomen)
      const drop = 0.009 * u * (1 - smooth(clamp((uu + 0.1) / 0.35)));
      return { c: V(sg * (P.shoulderX + uu * len), P.shoulderY - drop, 0), X: Y1, Z: Z1, rx: a * u * k * (uu < 0 ? 0.82 : 1) + (uu < 0 ? 0 : off), rz: b * u * k * (uu < 0 ? 0.9 : 1) + (uu < 0 ? 0 : off), e: 2.1, v: armV(uu), skin: skinAt(uu) };
    });
    loft(L, rings, { th: angles(6, true), x: R.arm.x, w: R.arm.w, group: 'arm' + s, capEnd: { uv: CAP.skin } });
    buildHand(L, P, plan, s, sg);
  }
}

function buildHand(L, P, plan, s, sg) {
  const u = P.H, hs = plan.hands.size ?? 1;
  const x0 = P.wristX - 0.006 * u, len = 0.064 * u * hs;
  const y0 = P.shoulderY, hh = 0.019 * u * hs, hz = 0.025 * u * hs;
  const sk = skin1('hand' + s);
  const ring = (t, kh, kz, dy = 0) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => ({ p: V(sg * (x0 + t * len), y0 + a * hh * kh + dy, b * hz * kz), skin: sk }));
  const rows = [ring(0, 0.85, 0.85), ring(0.45, 1.05, 1.0), ring(0.8, 1.0, 1.0, -0.002 * u), ring(1, 0.75, 0.9, -0.006 * u)];
  const map = (p, n) => {
    const t = clamp(Math.abs(p.x - sg * x0) / len, 0.04, 0.96);
    const across = clamp((p.z / hz + 1) / 2, 0.04, 0.96);
    if (Math.abs(n.y) >= Math.abs(n.z) && Math.abs(n.y) >= Math.abs(n.x)) {
      const P2 = n.y > 0 ? HAND.back : HAND.palm;
      return [P2.x + t * P2.w, P2.y + across * P2.h];
    }
    const up = clamp(((p.y - y0) / hh + 1) / 2, 0.04, 0.96);
    return [HAND.side.x + t * HAND.side.w, HAND.side.y + (1 - up) * HAND.side.h];
  };
  loftPoly(L, rows, { map, inside: (i) => V(sg * (x0 + (i + 0.5) / 3 * len), y0, 0), group: null, capStart: V(sg * (x0 + len * 0.5), y0, 0), capEnd: V(sg * (x0 + len * 0.5), y0, 0) });
  // pulgar
  const tx0 = x0 + 0.012 * u * hs, tl = 0.034 * u * hs;
  const tring = (t, k) => [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) => ({ p: V(sg * (tx0 + t * tl), y0 - 0.006 * u + a * 0.008 * u * k, hz * 0.95 + 0.009 * u + b * 0.009 * u * k), skin: sk }));
  loftPoly(L, [tring(0, 1), tring(1, 0.8)], { map, inside: () => V(sg * (tx0 + tl / 2), y0 - 0.006 * u, hz + 0.009 * u), group: null, capStart: V(sg * (tx0 + tl), y0, hz), capEnd: V(sg * tx0, y0, hz) });
}

// ---------------- piernas ----------------
function buildLegs(L, P, plan) {
  const u = P.H, k = lerp(1, P.k, 0.5);
  const set = new Set([-0.08, 0.1, 0.28, 0.44, 0.52, 0.6, 0.76, 0.9, 1.0]);
  if (plan.pantsEnd < 0.99) { set.add(+(plan.pantsEnd - 0.006).toFixed(4)); set.add(+(plan.pantsEnd + 0.006).toFixed(4)); }
  if (plan.pantsEnd > 1.0) { set.add(+plan.pantsEnd.toFixed(4)); }
  if (plan.bt.type === 'joggers') { set.add(0.88); set.add(0.93); }
  const list = [...set].filter((x) => x <= Math.max(1, plan.pantsEnd) + 1e-6).sort((a, b) => a - b);
  const legLen = P.hipJointY - P.ankleY;
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const skinAt = (vv) => {
      if (vv < 0.08) return skin2('hips', 'thigh' + s, smooth((vv + 0.08) / 0.16));
      if (vv < 0.4) return skin1('thigh' + s);
      if (vv < 0.6) return skin2('thigh' + s, 'shin' + s, smooth((vv - 0.4) / 0.2));
      return skin1('shin' + s);
    };
    const rings = list.map((vv) => {
      const r = plan.legRad(Math.max(0, vv)) * u * k;
      const y = P.hipJointY - vv * legLen;
      return { c: V(sg * (P.hipX + plan.spread * u * Math.max(0, vv)), y, 0.002 * u), X: X1, Z: Z1, rx: r, rz: r * 1.05, e: 2.2, v: legV(Math.min(vv, 1.14)), skin: skinAt(vv) };
    });
    const pantsToEnd = plan.pantsEnd >= 0.99;
    loft(L, rings, { th: angles(8, true), x: R.leg.x, w: R.leg.w, mirror: sg < 0, group: 'leg' + s, capEnd: { uv: pantsToEnd ? CAP.dark : CAP.skin } });
  }
}

// ---------------- zapatillas ----------------
function shoeShape(P, plan) {
  const u = P.H, size = plan.shoes.size ?? 1, boot = plan.shoes.type === 'boot';
  const len = P.footLen * 1.02 * size, w = 0.034 * u * size;
  const sole = (boot ? 0.018 : 0.022) * u, hHeel = (boot ? 0.13 : 0.074) * u, hToe = 0.04 * u;
  const ts = [0, 0.08, 0.3, 0.55, 0.78, 0.92, 1];
  const widthK = [0.78, 0.92, 0.95, 1.0, 0.98, 0.84, 0.5];
  const heightAt = (t) => {
    if (t <= 0.08) return hHeel * lerp(1, 0.98, t / 0.08);
    if (t <= 0.55) return lerp(hHeel * 0.98, boot ? hToe * 1.5 : lerp(hHeel, hToe, 0.75), smooth((t - 0.08) / 0.47));
    return lerp(boot ? hToe * 1.5 : lerp(hHeel, hToe, 0.75), hToe * 0.75, smooth((t - 0.55) / 0.45));
  };
  return { len, w, sole, hMax: hHeel, ts, widthK, heightAt, boot };
}

function buildShoes(L, P, plan, shape) {
  const u = P.H, { len, w, sole, hMax, ts, widthK, heightAt } = shape;
  const SS = R.shoeSide, ST = R.shoeTop;
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    const cx = sg * P.hipX, z0 = -0.24 * len;
    const sk = skin1('foot' + s);
    const rows = ts.map((t, i) => {
      const z = z0 + t * len, ww = w * widthK[i], h = heightAt(t);
      const lift = t > 0.85 ? (t - 0.85) / 0.15 * 0.008 * u : t < 0.04 ? (0.04 - t) / 0.04 * 0.004 * u : 0;
      const pts = [[ww, lift], [ww * 1.03, sole], [ww * 0.97, sole + (h - sole) * 0.55], [ww * 0.55, h], [-ww * 0.55, h], [-ww * 0.97, sole + (h - sole) * 0.55], [-ww * 1.03, sole], [-ww, lift]];
      return pts.map(([x, y]) => ({ p: V(cx + x, y, z), skin: sk }));
    });
    const map = (p, n) => {
      const t = clamp((p.z - z0) / len);
      if (n.y < -0.6) return [SOLE.x + clamp((p.x - cx) / (2 * w) + 0.5) * SOLE.w, SOLE.y + t * SOLE.h];
      if (n.y > 0.55) return [ST.x + t * ST.w, ST.y + clamp((p.x - cx) / (2 * w) + 0.5) * ST.h];
      return [SS.x + t * SS.w, SS.y + clamp(1 - p.y / hMax) * SS.h];
    };
    loftPoly(L, rows, { map, inside: (i) => V(cx, heightAt(ts[i]) * 0.4, z0 + (ts[i] + ts[i + 1]) / 2 * len), group: null, capStart: V(cx, 0.03 * u, z0 + 0.2 * len), capEnd: V(cx, 0.02 * u, z0 + 0.7 * len) });
  }
}

// ---------------- todo ----------------
export function buildPS1(spec, assets) {
  // cabeza un poco más chica que en el cel: proporciones más realistas, como en la referencia
  const P = proportions({ ...spec, body: { ...(spec.body || {}), head: (spec.body?.head ?? 1) * 0.86 } });
  const sk = buildSkeleton(P);
  const plan = makePlan(spec, P);
  const ph = readPhoto(assets.img, assets.face);
  const hm = headModel(P, ph);
  const colors = photoColors(ph, hm);
  const hairLen = spec.hairLong ?? (spec.hair?.style === 'bald' ? 0 : hairLength(ph, hm, colors.hair, colors.skin));
  const tr = torsoRings(P, spec, plan);
  const shoe = shoeShape(P, plan);

  const L = new Low(S);
  buildHead(L, P, hm, spec);
  if (hairLen > 0.3) buildLongHair(L, P, hm, hairLen);
  buildNeck(L, P);
  buildTorso(L, P, spec, plan, tr);
  buildArms(L, P, plan);
  buildLegs(L, P, plan);
  buildShoes(L, P, plan, shoe);

  const atlas = paintAtlas(plan, spec, { skin: colors.skin, hair: colors.hair, hairSpan: colors.hairSpan, long: hairLen > 0.3 ? true : undefined, ph, hm, torsoRing: tr.ringAt, shoe });
  const tex = new THREE.CanvasTexture(atlas.canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false;
  tex.flipY = true;
  const material = makePS1Material(tex);
  const geometry = L.toGeometry(sk.index);
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.name = 'body'; mesh.frustumCulled = false;
  const group = new THREE.Group();
  group.name = spec.id || 'char';
  group.add(sk.root);
  mesh.bind(sk.skeleton, new THREE.Matrix4());
  group.add(mesh);
  return {
    spec, P, group, bones: sk.bones, skeleton: sk.skeleton, meshes: [mesh], lines: [], ps1: true,
    atlas, tex, material, uvTris: L.uvTris, plan, head: hm, colors, hairLen,
    stats: { ...L.blenderStats(), parts: 1 },
    setLight() {}, setFace() {},
    setWire() {},
    dispose() { geometry.dispose(); material.dispose(); tex.dispose(); },
  };
}

// carga la foto sin fondo y los puntos de la cara
let facesP = null;
const imgCache = new Map();
export function loadFaces() { return (facesP ??= fetch('/ps1/faces.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})));}
export async function loadAssets(spec) {
  const slug = (spec.photo || spec.id + '.png').replace(/\.png$/, '');
  const faces = await loadFaces();
  const face = faces[slug];
  if (!face) return null;
  if (!imgCache.has(slug)) {
    imgCache.set(slug, new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `/ps1/${slug}.png`; }));
  }
  try { return { img: await imgCache.get(slug), face }; } catch { return null; }
}
