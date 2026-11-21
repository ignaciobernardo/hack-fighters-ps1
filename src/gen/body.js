// Cuerpo y ropa. Como en los modelos de pelea estilo anime, no hay cuerpo debajo de
// la ropa: se modela la silueta vestida, por piezas, y cada pieza recibe su tinta.
import { V, lerp, clamp, smooth, curve, sweep, blob, skin1, skin2, rotM } from './geo.js';

export function torsoProfile(P, spec) {
  const u = P.H, k = P.k;
  const hipK = lerp(0.93, 1.14, P.hipsW);
  const belly = spec.body?.belly ?? 0;
  const sx = P.shoulderX / u;
  const f = curve([
    // s, rx, rz, zc, exp
    [-0.08, 0.058 * hipK, 0.054, 0, 2.2],
    [0.0, 0.08 * hipK, 0.066, 0, 2.3],
    [0.13, 0.093 * hipK, 0.071, -0.002, 2.4],
    [0.36, 0.08 + belly * 0.012, 0.059 + belly * 0.022, 0.002 + belly * 0.014, 2.3],
    [0.58, sx * 0.84 + belly * 0.006, 0.066 + belly * 0.012, 0.004 + belly * 0.008, 2.5],
    [0.76, sx * 0.96, 0.073, 0.006, 2.7],
    [0.87, sx * 0.92, 0.06, 0.002, 2.8],
    [0.95, sx * 0.66, 0.05, -0.002, 2.6],
    [1.0, 0.05, 0.044, -0.004, 2.2],
  ]);
  const kx = lerp(1, k, 0.55);
  return (s) => {
    const [rx, rz, zc, e] = f(s);
    return { s, y: lerp(P.crotchY, P.neckBaseY, s), rx: rx * u * kx, rz: rz * u * k, zc: zc * u, e };
  };
}

const torsoSkin = (s) => {
  if (s < 0.2) return skin1('hips');
  if (s < 0.45) return skin2('hips', 'spine', smooth((s - 0.2) / 0.25));
  if (s < 0.72) return skin2('spine', 'chest', smooth((s - 0.45) / 0.27));
  return skin1('chest');
};

// punto del anillo del torso a un ángulo (0 = +X, π/2 = frente)
export function torsoPoint(ring, a, extra = 0) {
  const cx = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), 2 / ring.e);
  const cz = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), 2 / ring.e);
  return V(cx * (ring.rx + extra), ring.y, ring.zc + cz * (ring.rz + extra));
}

export function torsoTube(ctx, key, s0, s1, fit, o = {}) {
  const N = o.rows ?? 16;
  const ss = [...Array(N)].map((_, i) => lerp(s0, s1, i / (N - 1)));
  const rings = ss.map((s) => ctx.torso(s));
  const fitAt = (s) => (typeof fit === 'function' ? fit(s) : fit);
  return sweep(ctx.g(key), {
    pts: rings.map((r) => V(0, r.y, r.zc)),
    r: (t, i) => [rings[i].rx + fitAt(ss[i]), rings[i].rz + fitAt(ss[i])],
    exp: (t, i) => rings[i].e,
    segs: o.segs ?? 24, up: V(0, 0, 1),
    skin: (t, i) => (o.skin ? o.skin(ss[i]) : torsoSkin(ss[i])),
    capStart: o.capStart ?? 'flat', capEnd: o.capEnd ?? 'flat', capShade: -1,
    arc: o.arc, thickness: o.thickness, warp: o.warp, shade: o.shade, lw: o.lw, uv: o.uv,
  });
}

// ---- brazos -------------------------------------------------------------
const armRadius = curve([[0, 0.035, 0.037], [0.2, 0.041, 0.043], [0.5, 0.032, 0.033], [0.64, 0.036, 0.034], [1, 0.024, 0.021]]);

function armSkin(ctx, s, uu) {
  const P = ctx.P, d = 0.11;
  const e = P.upperArm / (P.upperArm + P.foreArm);
  if (uu < e - d) return skin1('arm' + s);
  if (uu < e + d) return skin2('arm' + s, 'fore' + s, smooth((uu - (e - d)) / (2 * d)));
  return skin1('fore' + s);
}

// tubo a lo largo del brazo, uu ∈ [0,1] hombro → muñeca
export function armTube(ctx, s, key, u0, u1, fit, o = {}) {
  const P = ctx.P, u = P.H, k = P.k, sg = s === 'L' ? 1 : -1;
  const N = o.rows ?? Math.max(4, Math.round((u1 - u0) * 16));
  const uus = [...Array(N)].map((_, i) => lerp(u0, u1, i / (N - 1)));
  const len = P.upperArm + P.foreArm;
  const fitAt = (x) => (typeof fit === 'function' ? fit(x) : fit);
  return sweep(ctx.g(key), {
    pts: uus.map((x) => V(sg * (P.shoulderX + x * len), P.shoulderY, 0)),
    r: (t, i) => { const [a, b] = armRadius(uus[i]); const f = fitAt(uus[i]); const lk = P.limbK ?? 1; return [a * u * k * lk + f, b * u * k * lk + f]; },
    exp: o.exp ?? 2.2, segs: o.segs ?? 12, up: V(0, 0, 1),
    skin: (t, i) => armSkin(ctx, s, uus[i]),
    capStart: o.capStart ?? 'round', capEnd: o.capEnd ?? 'flat', capShade: -1, capLen: o.capLen,
    lw: o.lw, shade: o.shade,
  });
}

// ---- piernas ------------------------------------------------------------
const legRadius = curve([[0, 0.064, 0.066], [0.25, 0.058, 0.062], [0.5, 0.041, 0.044], [0.66, 0.045, 0.048], [1, 0.027, 0.03]]);

function legSkin(s, vv) {
  const d = 0.1;
  if (vv < 0.5 - d) return skin1('thigh' + s);
  if (vv < 0.5 + d) return skin2('thigh' + s, 'shin' + s, smooth((vv - (0.5 - d)) / (2 * d)));
  return skin1('shin' + s);
}

// vv ∈ [0,1] cadera → tobillo. radius: (vv)=>[rx,rz] en fracción de H, o null = pierna desnuda
export function legTube(ctx, s, key, v0, v1, o = {}) {
  const P = ctx.P, u = P.H, k = P.k, sg = s === 'L' ? 1 : -1;
  const N = o.rows ?? Math.max(4, Math.round((v1 - v0) * 18));
  const vs = [...Array(N)].map((_, i) => lerp(v0, v1, i / (N - 1)));
  const rad = o.radius || legRadius;
  const fit = o.fit ?? 0;
  return sweep(ctx.g(key), {
    pts: vs.map((x) => V(sg * (P.hipX + (o.spread ?? 0) * u * x), lerp(P.hipJointY, P.ankleY, x), (o.zc?.(x) ?? 0) * u)),
    r: (t, i) => { const [a, b] = rad(vs[i]); const lk = P.limbK ?? 1; return [a * u * k * lk + fit, b * u * k * lk + fit]; },
    exp: o.exp ?? 2.2, segs: o.segs ?? 14, up: V(0, 0, 1),
    skin: (t, i) => (o.skin ? o.skin(vs[i]) : legSkin(s, vs[i])),
    capStart: o.capStart ?? 'round', capEnd: o.capEnd ?? 'flat', capShade: -1, capLen: o.capLen,
    lw: o.lw, shade: o.shade,
  });
}

// ---- prendas ------------------------------------------------------------
export function buildNeck(ctx) {
  const P = ctx.P, u = P.H;
  const r = 0.03 * u * lerp(0.9, 1.2, P.build);
  sweep(ctx.g('skin'), {
    pts: [V(0, P.neckBaseY - 0.02 * u, -0.006 * u), V(0, P.neckBaseY + 0.02 * u, -0.003 * u), V(0, P.chinY + 0.035 * u, 0.0)],
    r: (t) => [r * lerp(1.12, 1, t), r * lerp(1.08, 0.98, t)], segs: 14, up: V(0, 0, 1),
    skin: (t) => skin2('chest', 'neck', smooth(t * 2.2)), capStart: 'none', capEnd: 'none', shade: (t) => -0.55 * smooth((t - 0.35) / 0.5),
  });
}

function crewCollar(ctx, key, radius, drop = 0.014, thick = 0.007) {
  const P = ctx.P, u = P.H;
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    pts.push(V(Math.cos(a) * radius * 1.12, P.neckBaseY + 0.006 * u - Math.max(0, Math.sin(a)) * drop * u, -0.004 * u + Math.sin(a) * radius));
  }
  sweep(ctx.g(key), { pts, closed: true, r: [thick * u, thick * u * 1.2], segs: 6, up: V(0, 1, 0), skin: skin1('chest') });
}

export function buildTop(ctx) {
  const P = ctx.P, u = P.H, top = ctx.spec.top || {};
  const type = top.type || 'tee';
  const fitBase = lerp(0.004, 0.022, top.fit ?? 0.5) * u;
  const tuck = !!top.tuck;
  const sHem = tuck ? 0.27 : lerp(0.36, 0.2, top.length ?? 0.5);
  const fit = (s) => (tuck ? fitBase * lerp(0.25, 1, smooth((s - 0.27) / 0.15)) : fitBase * lerp(1.5, 1, smooth((s - sHem) / 0.4)) + 0.008 * u * (1 - smooth((s - sHem) / 0.25))) * (s > 0.9 ? lerp(1, 0.5, (s - 0.9) / 0.1) : 1);
  ctx.topFit = fit;
  const key = 'top';
  // el anillo superior se cierra hacia el cuello
  torsoTube(ctx, key, sHem, 1.0, fit, { capEnd: 'flat', rows: 18, uv: true });
  const neckR = 0.04 * u * lerp(0.9, 1.15, P.build);
  if (type === 'tee' || type === 'longsleeve') crewCollar(ctx, top.collarColor ? 'topTrim' : key, neckR * 1.18);
  if (type === 'hoodie') crewCollar(ctx, key, neckR * 1.25, 0.02, 0.012);
  if (type === 'shirt') shirtCollar(ctx, key, neckR);
  if (type === 'tank') crewCollar(ctx, key, neckR * 1.5, 0.05, 0.006);
  if (type === 'shirt') {
    // tapeta y botones
    const g = ctx.g('topTrim');
    const pts = [];
    for (let i = 0; i <= 8; i++) { const s = lerp(Math.max(sHem, 0.34), 0.9, i / 8); const p = torsoPoint(ctx.torso(s), Math.PI / 2, fit(s) + 0.002 * u); pts.push(p); }
    sweep(g, { pts, r: [0.011 * u, 0.0035 * u], exp: 3, segs: 6, up: V(0, 0, 1), skin: (t) => torsoSkin(lerp(Math.max(sHem, 0.34), 0.9, t)), capStart: 'flat', capEnd: 'flat', lw: 0.6 });
    for (let i = 0; i < 4; i++) {
      const s = lerp(0.42, 0.82, i / 3); const p = torsoPoint(ctx.torso(s), Math.PI / 2, fit(s) + 0.006 * u);
      blob(ctx.g('button'), { c: p, r: [0.006 * u, 0.006 * u, 0.003 * u], rows: 4, segs: 8, skin: torsoSkin(s), lw: 0.5 });
    }
  }
  // mangas
  const sl = top.sleeves || (type === 'tank' ? 'none' : type === 'tee' ? 'short' : 'long');
  ctx.sleeveEnd = { L: 0, R: 0 };
  for (const s of ['L', 'R']) {
    if (ctx.jacketSleeves) { ctx.sleeveEnd[s] = 0; continue; }
    const loose = lerp(0.006, 0.02, top.fit ?? 0.5) * u;
    if (sl === 'short') {
      const end = top.sleeveLen ?? 0.3;
      armTube(ctx, s, key, 0, end, (x) => loose * lerp(0.4, 1.15, x / end), { rows: 7 });
      ctx.sleeveEnd[s] = end;
    } else if (sl === 'long') {
      armTube(ctx, s, key, 0, 0.93, (x) => loose * lerp(0.5, 0.8, smooth(x * 4)), { rows: 16 });
      armTube(ctx, s, top.cuffColor ? 'topTrim' : key, 0.9, 0.99, loose * 0.75 + 0.004 * u, { rows: 3, capStart: 'flat' });
      ctx.sleeveEnd[s] = 0.99;
    } else if (sl === 'rolled') {
      const end = 0.6;
      armTube(ctx, s, key, 0, end, (x) => loose * lerp(0.5, 0.95, smooth(x * 4)), { rows: 12 });
      armTube(ctx, s, key, end - 0.085, end + 0.015, loose + 0.008 * u, { rows: 4, capStart: 'flat', exp: 2.4 });
      ctx.sleeveEnd[s] = end;
    } else ctx.sleeveEnd[s] = 0;
  }
}

function shirtCollar(ctx, key, neckR) {
  const P = ctx.P, u = P.H;
  // banda cónica abierta al frente, con las puntas caídas
  const gap = 0.3;
  const pts = [V(0, P.neckBaseY + 0.036 * u, -0.004 * u), V(0, P.neckBaseY + 0.02 * u, -0.004 * u), V(0, P.neckBaseY - 0.004 * u, -0.004 * u)];
  sweep(ctx.g(key), {
    pts, r: (t) => { const r = neckR * lerp(1.02, 1.75, t); return [r * 1.08, r]; }, segs: 22, up: V(0, 0, 1),
    arc: [Math.PI / 2 + gap, Math.PI / 2 - gap + Math.PI * 2], thickness: 0.006 * u, skin: skin1('chest'),
    warp: (p, t, a) => {
      const front = Math.pow(clamp(Math.sin(a)), 3);
      p.y -= front * t * 0.03 * u; p.z += front * t * 0.008 * u;
    },
  });
}

export function buildJacket(ctx) {
  const P = ctx.P, u = P.H, j = ctx.spec.jacket;
  if (!j || !j.type || j.type === 'none') return;
  const type = j.type;
  const sHem = lerp(0.3, -0.04, j.length ?? 0.5);
  const base = (ctx.topFit ? ctx.topFit(0.6) : 0.01 * u);
  const fit = (s) => base + lerp(0.012, 0.03, j.fit ?? 0.5) * u * (s > 0.92 ? lerp(1, 0.55, (s - 0.92) / 0.08) : 1) * lerp(1.25, 1, smooth((s - sHem) / 0.5));
  const gapTop = j.open ?? 0.34;
  const th = 0.008 * u;
  const flare = (j.flare ?? 0.3);
  torsoTube(ctx, 'jacket', sHem, 0.985, fit, {
    rows: 20, segs: 28, thickness: th, uv: true,
    arc: [Math.PI / 2 + gapTop, Math.PI / 2 - gapTop + Math.PI * 2],
    warp: (p, t, a) => {
      // abre el frente hacia abajo
      const front = Math.pow(clamp(Math.sin(a)), 2);
      const down = 1 - t;
      p.x += Math.sign(p.x) * front * down * flare * 0.035 * u;
      p.z -= front * down * flare * 0.006 * u;
    },
  });
  // vivos del cierre a lo largo de la abertura
  const edge = (sgn) => {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12, s = lerp(sHem, 0.97, t);
      const a = Math.PI / 2 + sgn * gapTop;
      const p = torsoPoint(ctx.torso(s), a, fit(s) - th * 0.3);
      const front = Math.pow(clamp(Math.sin(a)), 2), down = 1 - t;
      p.x += Math.sign(p.x) * front * down * flare * 0.035 * u; p.z -= front * down * flare * 0.006 * u;
      pts.push(p);
    }
    sweep(ctx.g('jacketTrim'), { pts, r: [0.007 * u, 0.007 * u], segs: 6, exp: 3, up: V(0, 0, 1), skin: (t) => torsoSkin(lerp(sHem, 0.97, t)), capStart: 'round', capEnd: 'round', lw: 0.7 });
  };
  edge(1); edge(-1);
  // pretina inferior
  if (j.hemBand !== false) {
    torsoTube(ctx, j.trimHem ? 'jacketTrim' : 'jacket', sHem - 0.012, sHem + 0.04, (s) => fit(s) + 0.005 * u, {
      rows: 3, segs: 28, thickness: th * 1.3, arc: [Math.PI / 2 + gapTop, Math.PI / 2 - gapTop + Math.PI * 2],
      warp: (p, t, a) => { const front = Math.pow(clamp(Math.sin(a)), 2); p.x += Math.sign(p.x) * front * flare * 0.035 * u; p.z -= front * flare * 0.006 * u; },
    });
  }
  // cuello
  const neckR = 0.042 * u * lerp(0.9, 1.15, P.build);
  if (j.collar === 'high') {
    const pts = [V(0, P.neckBaseY - 0.012 * u, -0.006 * u), V(0, P.neckBaseY + 0.02 * u, -0.006 * u), V(0, P.neckBaseY + 0.058 * u, -0.008 * u)];
    sweep(ctx.g('jacket'), {
      pts, r: (t) => { const r = neckR * lerp(1.85, 1.6, t); return [r * 1.1, r * 1.02]; }, segs: 22, up: V(0, 0, 1),
      arc: [Math.PI / 2 + 0.62, Math.PI / 2 - 0.62 + Math.PI * 2], thickness: 0.009 * u, skin: skin1('chest'),
      warp: (p, t, a) => { const front = Math.pow(clamp(Math.sin(a)), 2); p.y -= front * t * 0.022 * u; p.x += Math.sign(p.x) * front * t * 0.012 * u; },
    });
  } else if (j.collar === 'hood') {
    blob(ctx.g('jacket'), {
      c: V(0, P.neckBaseY + 0.005 * u, -0.075 * u), r: [0.095 * u, 0.062 * u, 0.062 * u], e1: 2.2, e2: 2.4, rows: 10, segs: 16, skin: skin1('chest'),
      deform: (p, un) => { if (un.y < 0) p.y *= 1.5; p.x *= 1 - 0.25 * clamp(-un.y); },
    });
    // borde de la capucha alrededor del cuello
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = lerp(Math.PI / 2 + 0.5, Math.PI / 2 - 0.5 + Math.PI * 2, i / 16);
      const r = neckR * 1.55;
      pts.push(V(Math.cos(a) * r * 1.15, P.neckBaseY + 0.012 * u - Math.max(0, Math.sin(a)) * 0.035 * u, -0.006 * u + Math.sin(a) * r));
    }
    sweep(ctx.g('jacket'), { pts, r: [0.016 * u, 0.02 * u], segs: 8, up: V(0, 1, 0), skin: skin1('chest'), capStart: 'round', capEnd: 'round' });
    // cordones
    for (const sgn of [1, -1]) {
      const a = Math.PI / 2 - sgn * 0.42; const r = neckR * 1.5;
      const p0 = V(Math.cos(a) * r * 1.15, P.neckBaseY - 0.02 * u, -0.006 * u + Math.sin(a) * r + 0.004 * u);
      const s1 = 0.62; const p1 = torsoPoint(ctx.torso(s1), Math.PI / 2 - sgn * 0.3, base + 0.012 * u);
      sweep(ctx.g('cord'), { pts: [p0, p0.clone().lerp(p1, 0.5).add(V(0, 0, 0.008 * u)), p1], r: [0.004 * u, 0.004 * u], segs: 5, up: V(1, 0, 0), skin: skin1('chest'), capStart: 'round', capEnd: 'round', lw: 0.6 });
      blob(ctx.g('cordTip'), { c: p1.clone().add(V(0, -0.008 * u, 0)), r: [0.0055 * u, 0.012 * u, 0.0055 * u], rows: 5, segs: 6, skin: skin1('chest'), lw: 0.6 });
    }
  } else if (j.collar === 'lapel') {
    const pts = [V(0, P.neckBaseY + 0.03 * u, -0.006 * u), V(0, P.neckBaseY + 0.012 * u, -0.006 * u), V(0, P.neckBaseY - 0.012 * u, -0.006 * u)];
    sweep(ctx.g('jacket'), {
      pts, r: (t) => { const r = neckR * lerp(1.25, 2.0, t); return [r * 1.1, r]; }, segs: 22, up: V(0, 0, 1),
      arc: [Math.PI / 2 + 0.55, Math.PI / 2 - 0.55 + Math.PI * 2], thickness: 0.007 * u, skin: skin1('chest'),
      warp: (p, t, a) => { const front = Math.pow(clamp(Math.sin(a)), 3); p.y -= front * t * 0.05 * u; },
    });
  }
  // mangas
  const sl = j.sleeves ?? 'long';
  if (sl !== 'none') {
    ctx.jacketSleeves = true;
    const loose = lerp(0.012, 0.03, j.fit ?? 0.5) * u;
    for (const s of ['L', 'R']) {
      const end = sl === 'short' ? 0.34 : sl === 'rolled' ? 0.62 : 0.95;
      armTube(ctx, s, 'jacket', 0, end, (x) => loose * lerp(0.6, sl === 'long' ? 0.85 : 1.1, smooth(x * 3 / end)), { rows: 16, capLen: 0.8 });
      if (sl === 'long') armTube(ctx, s, 'jacketTrim', 0.9, 1.0, loose * 0.8 + 0.005 * u, { rows: 3, capStart: 'flat' });
      if (sl === 'rolled') armTube(ctx, s, 'jacket', end - 0.08, end + 0.015, loose * 1.1 + 0.008 * u, { rows: 4, capStart: 'flat' });
      ctx.jacketSleeveEnd = ctx.jacketSleeveEnd || {};
      ctx.jacketSleeveEnd[s] = sl === 'long' ? 1.0 : end;
    }
  }
}

export function buildArmsAndHands(ctx) {
  const P = ctx.P, u = P.H, k = P.k;
  const hands = ctx.spec.hands || {};
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1;
    const covered = Math.max(ctx.sleeveEnd?.[s] ?? 0, ctx.jacketSleeveEnd?.[s] ?? 0);
    if (covered < 0.97) {
      const from = Math.max(0, covered - 0.12);
      armTube(ctx, s, 'skin', from, 1.0, 0, { capStart: from === 0 ? 'round' : 'none', capEnd: 'round', capLen: 0.4, rows: Math.max(4, Math.round((1 - from) * 16)) });
    }
    const wx = P.wristX, y = P.shoulderY;
    const hs = lerp(0.92, 1.1, P.build) * (hands.size ?? 1) * (P.handK ?? 1);
    const type = hands.type || 'bare';
    const palmKey = type === 'gloves' || type === 'fingerless' ? 'glove' : type === 'wraps' ? 'wrap' : 'skin';
    const fingerKey = type === 'gloves' ? 'glove' : 'skin';
    const X = (d) => sg * (wx + d * u * hs);
    // puño
    blob(ctx.g(palmKey), { c: V(X(0.043), y, 0), r: [0.041 * u * hs, 0.029 * u * hs, 0.04 * u * hs], e1: 3, e2: 3, rows: 8, segs: 14, skin: skin1('hand' + s) });
    for (let f = 0; f < 4; f++) {
      const z = lerp(-0.0285, 0.0285, f / 3) * u * hs;
      const drop = [0.002, 0, 0.001, 0.004][f] * u;
      sweep(ctx.g(fingerKey), {
        pts: [V(X(0.079), y + 0.021 * u * hs - drop, z), V(X(0.087), y - 0.004 * u * hs - drop, z), V(X(0.074), y - 0.027 * u * hs, z)],
        r: [0.0108 * u * hs, 0.0108 * u * hs], segs: 6, up: V(0, 0, 1), skin: skin1('hand' + s), capStart: 'round', capEnd: 'round', lw: 0.75,
      });
    }
    sweep(ctx.g(fingerKey), {
      pts: [V(X(0.022), y - 0.008 * u * hs, 0.036 * u * hs), V(X(0.052), y - 0.024 * u * hs, 0.044 * u * hs), V(X(0.074), y - 0.031 * u * hs, 0.026 * u * hs)],
      r: [0.0125 * u * hs, 0.0125 * u * hs], segs: 6, up: V(0, 1, 0), skin: skin1('hand' + s), capStart: 'round', capEnd: 'round', lw: 0.75,
    });
    if (type === 'wraps' || type === 'fingerless' || hands.wrist) {
      // muñequera / venda
      const key = type === 'wraps' ? 'wrap' : hands.wrist ? 'wrist' : 'glove';
      const len = P.upperArm + P.foreArm;
      const a0 = type === 'wraps' ? 0.8 : 0.9;
      sweep(ctx.g(key), {
        pts: [V(sg * (P.shoulderX + a0 * len), y, 0), V(sg * (P.shoulderX + 1.0 * len), y, 0), V(X(0.012), y, 0)],
        r: (t) => { const [a, b] = armRadius(lerp(a0, 1, clamp(t * 1.3))); return [a * u * k + 0.005 * u, b * u * k + 0.005 * u]; },
        segs: 12, up: V(0, 0, 1), skin: (t) => (t > 0.85 ? skin1('hand' + s) : skin1('fore' + s)), capStart: 'flat', capEnd: 'flat', capShade: -1,
      });
    }
  }
}

const PANTS = {
  straight: curve([[0, 0.071, 0.073], [0.25, 0.065, 0.068], [0.5, 0.055, 0.057], [0.75, 0.05, 0.052], [1, 0.048, 0.05]]),
  slim: curve([[0, 0.068, 0.07], [0.25, 0.061, 0.064], [0.5, 0.047, 0.05], [0.7, 0.046, 0.049], [1, 0.036, 0.038]]),
  joggers: curve([[0, 0.074, 0.076], [0.25, 0.07, 0.072], [0.5, 0.06, 0.062], [0.8, 0.056, 0.058], [0.92, 0.05, 0.052], [1, 0.04, 0.042]]),
  wide: curve([[0, 0.076, 0.078], [0.25, 0.074, 0.076], [0.5, 0.072, 0.074], [0.8, 0.076, 0.078], [1, 0.08, 0.082]]),
  shorts: curve([[0, 0.074, 0.076], [0.2, 0.072, 0.074], [0.45, 0.07, 0.072], [1, 0.07, 0.07]]),
};

export function buildBottom(ctx) {
  const P = ctx.P, u = P.H, b = ctx.spec.bottom || {};
  const type = b.type || 'straight';
  const rad = PANTS[type] || PANTS.straight;
  const fit = 0.006 * u;
  // pelvis
  const sTop = b.rise ?? 0.33;
  torsoTube(ctx, 'bottom', -0.03, sTop, (s) => fit * lerp(1.6, 0.6, smooth(s / sTop)), { rows: 9, capStart: 'round', capEnd: 'flat', skin: (s) => (s < 0.25 ? skin1('hips') : skin2('hips', 'spine', smooth((s - 0.25) / 0.3) * 0.5)) });
  const end = type === 'shorts' ? (b.length ?? 0.44) : (b.length ?? (type === 'joggers' ? 0.97 : 1.0));
  ctx.legEnd = end;
  for (const s of ['L', 'R']) {
    legTube(ctx, s, 'bottom', 0, end, { radius: rad, rows: Math.round(end * 20), capLen: 0.6 });
    if (type === 'joggers') legTube(ctx, s, 'bottomTrim', end - 0.045, end + 0.01, { radius: rad, fit: 0.004 * u, rows: 3, capStart: 'flat' });
    if (type === 'shorts' && b.cuff !== false) legTube(ctx, s, 'bottomTrim', end - 0.03, end + 0.004, { radius: rad, fit: 0.004 * u, rows: 3, capStart: 'flat' });
    if (b.stripe) {
      // franja lateral
      const sg = s === 'L' ? 1 : -1; const pts = [];
      for (let i = 0; i <= 10; i++) { const v = lerp(0.04, end - 0.05, i / 10); const [rx] = rad(v); pts.push(V(sg * (P.hipX + rx * u * P.k + 0.001 * u), lerp(P.hipJointY, P.ankleY, v), 0)); }
      sweep(ctx.g('bottomTrim'), { pts, r: [0.004 * u, 0.012 * u], exp: 3, segs: 6, up: V(0, 0, 1), skin: (t) => legSkin(s, lerp(0.04, end - 0.05, t)), capStart: 'flat', capEnd: 'flat', lw: 0.5 });
    }
    if (b.pocket) {
      const sg = s === 'L' ? 1 : -1; const v = 0.3; const [rx] = rad(v);
      blob(ctx.g('bottom'), { c: V(sg * (P.hipX + rx * u * P.k * 0.92), lerp(P.hipJointY, P.ankleY, v), 0.004 * u), r: [0.02 * u, 0.045 * u, 0.04 * u], e1: 4, e2: 4, rows: 6, segs: 10, skin: skin1('thigh' + s) });
      blob(ctx.g('bottom'), { c: V(sg * (P.hipX + rx * u * P.k * 0.95), lerp(P.hipJointY, P.ankleY, v) + 0.034 * u, 0.004 * u), r: [0.022 * u, 0.014 * u, 0.044 * u], e1: 4, e2: 4, rows: 5, segs: 10, skin: skin1('thigh' + s) });
    }
    // pierna desnuda / calcetín
    if (end < 0.97) {
      legTube(ctx, s, 'skin', Math.max(0, end - 0.1), 1.0, { capStart: 'none', capEnd: 'none' });
      const sock = ctx.spec.shoes?.sock;
      if (sock) { legTube(ctx, s, 'sock', 1 - sock, 1.0, { fit: 0.0025 * u, capStart: 'flat', capEnd: 'none', rows: 5 }); legTube(ctx, s, 'sock', 1 - sock - 0.01, 1 - sock + 0.05, { fit: 0.005 * u, capStart: 'flat', capEnd: 'flat', rows: 3 }); }
    }
  }
  // cinturón
  if (b.belt) {
    const sB = sTop - 0.04;
    torsoTube(ctx, 'belt', sB - 0.035, sB + 0.035, fit * 0.8 + 0.006 * u, { rows: 3, segs: 24, capStart: 'flat', capEnd: 'flat', skin: () => skin2('hips', 'spine', 0.35) });
    const p = torsoPoint(ctx.torso(sB), Math.PI / 2, fit + 0.012 * u);
    blob(ctx.g('metal'), { c: p, r: [0.024 * u, 0.02 * u, 0.007 * u], e1: 4, e2: 4, rows: 6, segs: 12, skin: skin2('hips', 'spine', 0.35) });
  }
}

export function buildShoes(ctx) {
  const P = ctx.P, u = P.H, sh = ctx.spec.shoes || {};
  const type = sh.type || 'sneaker';
  const big = (sh.size ?? 1) * lerp(0.96, 1.08, P.build) * (P.footK ?? 1);
  for (const s of ['L', 'R']) {
    const sg = s === 'L' ? 1 : -1, x = sg * P.hipX, sk = skin1('foot' + s);
    const L = P.footLen * big, W = 0.046 * u * big;
    const z0 = -0.34 * L, zAt = (f) => z0 + f * L;         // f: 0 talón … 1 punta
    const soleH = (type === 'boot' ? 0.03 : 0.027) * u * (sh.platform ?? 1);
    // suela: gruesa, con la punta levantada
    const solePts = [0, 0.12, 0.3, 0.55, 0.8, 0.94, 1.0].map((f) => V(x, soleH * 0.5 + Math.pow(Math.max(0, f - 0.7) / 0.3, 2) * 0.012 * u, zAt(f)));
    const soleW = curve([[0, 0.7], [0.12, 0.98], [0.3, 1.02], [0.6, 1.12], [0.85, 1.02], [1, 0.62]]);
    sweep(ctx.g('sole'), { pts: solePts, r: (t) => [W * soleW(t)[0] * 1.07, soleH * 0.5], exp: 4, segs: 14, up: V(0, 1, 0), skin: sk, capStart: 'round', capEnd: 'round', capLen: 0.5 });
    // capellada
    const upH = curve([[0, 0.03], [0.1, 0.05], [0.3, 0.054], [0.52, 0.043], [0.78, 0.033], [1, 0.022]]);
    const upW = curve([[0, 0.62], [0.12, 0.92], [0.3, 0.98], [0.6, 1.05], [0.85, 0.96], [1, 0.58]]);
    const fs = [0.02, 0.1, 0.2, 0.32, 0.45, 0.6, 0.75, 0.88, 0.97];
    const upPts = fs.map((f) => V(x, soleH + upH(f)[0] * u * big * 0.72, zAt(f)));
    sweep(ctx.g('shoe'), { pts: upPts, r: (t, i) => [W * upW(fs[i])[0], upH(fs[i])[0] * u * big], exp: 2.5, segs: 14, up: V(0, 1, 0), skin: sk, capStart: 'round', capEnd: 'round', capLen: 0.6 });
    // puntera y talonera
    const toe = fs.filter((f) => f >= 0.74);
    sweep(ctx.g('shoeAccent'), { pts: toe.map((f) => V(x, soleH + upH(f)[0] * u * big * 0.7, zAt(f))), r: (t, i) => [W * upW(toe[i])[0] + 0.003 * u, upH(toe[i])[0] * u * big + 0.003 * u], exp: 2.5, segs: 14, up: V(0, 1, 0), skin: sk, capStart: 'flat', capEnd: 'round', capLen: 0.6 });
    const heel = [0.015, 0.06, 0.12, 0.18];
    sweep(ctx.g('shoeAccent'), { pts: heel.map((f) => V(x, soleH + upH(f)[0] * u * big * 0.8, zAt(f))), r: (t, i) => [W * upW(heel[i])[0] + 0.003 * u, upH(heel[i])[0] * u * big * 0.9 + 0.003 * u], exp: 2.5, segs: 14, up: V(0, 1, 0), skin: sk, capStart: 'round', capEnd: 'flat', capLen: 0.6 });
    // cuello acolchado alrededor del tobillo
    const topY = type === 'boot' ? P.ankleY + 0.1 * u : P.ankleY + (sh.high === false ? 0.012 : 0.034) * u;
    const ring = [];
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; ring.push(V(x + Math.cos(a) * 0.036 * u * big, topY + Math.sin(a) * 0.012 * u, -0.004 * u + Math.sin(a) * 0.043 * u * big)); }
    if (type === 'boot') {
      sweep(ctx.g('shoe'), { pts: [V(x, soleH + 0.03 * u, -0.004 * u), V(x, P.ankleY + 0.02 * u, -0.006 * u), V(x, topY, -0.006 * u)], r: (t) => [0.04 * u * big * lerp(1, 1.1, t), 0.047 * u * big * lerp(1, 1.08, t)], segs: 14, up: V(0, 0, 1), skin: (t) => (t > 0.6 ? skin2('foot' + s, 'shin' + s, 0.6) : sk), capStart: 'none', capEnd: 'flat', capShade: -1 });
      sweep(ctx.g('shoeAccent'), { pts: [V(x, P.ankleY + 0.03 * u, -0.006 * u), V(x, P.ankleY + 0.056 * u, -0.006 * u)], r: [0.047 * u * big, 0.054 * u * big], segs: 14, up: V(0, 0, 1), skin: sk, capStart: 'flat', capEnd: 'flat' });
      blob(ctx.g('metal'), { c: V(x + sg * 0.047 * u * big, P.ankleY + 0.043 * u, 0.004 * u), r: [0.006 * u, 0.014 * u, 0.014 * u], e1: 4, e2: 4, rows: 5, segs: 8, skin: sk, lw: 0.6 });
    } else {
      sweep(ctx.g('shoeAccent'), { pts: ring, closed: true, r: [0.011 * u, 0.013 * u], segs: 6, up: V(0, 1, 0), skin: sk });
      sweep(ctx.g('shoe'), { pts: [V(x, soleH + 0.03 * u, -0.004 * u), V(x, topY, -0.004 * u)], r: [0.036 * u * big, 0.043 * u * big], segs: 12, up: V(0, 0, 1), skin: sk, capStart: 'none', capEnd: 'flat', capShade: -1 });
    }
    // lengüeta
    blob(ctx.g('shoe'), { c: V(x, topY - 0.004 * u, 0.04 * u * big), r: [0.024 * u * big, 0.032 * u, 0.011 * u], e1: 2.5, e2: 2.5, rows: 6, segs: 10, skin: sk, M: rotM(-0.4, 0, 0) });
    // cordones
    for (let i = 0; i < 3; i++) {
      const f = lerp(0.42, 0.62, i / 2), z = zAt(f), y = soleH + upH(f)[0] * u * big * 1.7;
      sweep(ctx.g('lace'), { pts: [V(x - 0.024 * u * big, y - 0.01 * u, z), V(x, y + 0.002 * u, z + 0.002 * u), V(x + 0.024 * u * big, y - 0.01 * u, z)], r: [0.0042 * u, 0.0042 * u], segs: 5, up: V(0, 1, 0), skin: sk, capStart: 'round', capEnd: 'round', lw: 0.55 });
    }
    // franja lateral
    if (sh.stripe !== false && type !== 'boot') {
      for (const side of [1, -1]) {
        const pts = [0.2, 0.33, 0.48].map((f, i) => V(x + side * (W * upW(f)[0] + 0.001 * u), soleH + upH(f)[0] * u * big * lerp(1.25, 0.5, i / 2), zAt(f)));
        sweep(ctx.g('shoeAccent'), { pts, r: [0.003 * u, 0.008 * u], exp: 3, segs: 6, up: V(0, 1, 0), skin: sk, capStart: 'round', capEnd: 'round', lw: 0.5 });
      }
    }
  }
}
