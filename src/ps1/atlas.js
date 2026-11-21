// Pinta el atlas completo de un personaje: telas con pliegues horneados, costuras,
// estampados, la foto de la cara y el pelo sacado de la misma foto.
import { R, CAP, SOLE, HAND, EXTRA, TORSO_S, ARM_U, LEG_V, torsoV, armV, legV } from './plan.js';
import { Atlas, FABRIC, denim, hex2rgb, rgb2css, mixc, mulc, lum, fbm, grain, vnoise, textOn, seam, clamp, smooth } from './paint.js';
import { lerp } from './low.js';

const gauss = (x, w) => Math.exp(-(x / w) * (x / w));
// aplica un factor de luz; en telas oscuras suma un poco para que el pliegue se lea
const shade = (c, f) => { const d = (1 - lum(c) / 255) * 34; return [c[0] * f + (f - 1) * d, c[1] * f + (f - 1) * d, c[2] * f + (f - 1) * d]; };
const darken = (c, k) => mulc(c, k);
const ellipseP = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));

function fabric(kind, base, wx, wy, seed, fade = 0) {
  if (kind === 'denim') return denim(base, wx, wy, seed, fade);
  if (kind === 'oxford') {
    const f = FABRIC.cotton(wx, wy, seed) + (((Math.floor(wx * 900) + Math.floor(wy * 900)) & 1) ? 0.025 : -0.025);
    return shade(base, f);
  }
  return shade(base, (FABRIC[kind] || FABRIC.cotton)(wx, wy, seed));
}

// pliegue vectorial: sombra suave + borde de luz (multiplicar / trama)
function fold(g, pts, o = {}) {
  const w = o.w ?? 2.4;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.filter = `blur(${o.blur ?? 1.2}px)`;
  g.globalCompositeOperation = 'multiply';
  g.strokeStyle = `rgba(20,24,34,${o.a ?? 0.35})`; g.lineWidth = w;
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  if (o.hi !== 0) {
    g.globalCompositeOperation = 'screen';
    g.strokeStyle = `rgba(255,255,255,${o.hi ?? 0.16})`; g.lineWidth = w * 0.7;
    const [dx, dy] = o.off || [w * 0.8, 0];
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + dx, y + dy) : g.moveTo(x + dx, y + dy))); g.stroke();
  }
  g.restore();
}

export function paintAtlas(plan, spec, look) {
  const A = new Atlas(512);
  const { P, u, top, jk, bt, shoes, hands } = plan;
  const seed = (spec.seed ?? 7) * 101;
  const skin = look.skin, hair = look.hair;
  const topC = hex2rgb(top.color || '#ddd');
  const jC = jk ? hex2rgb(jk.color || '#333') : topC;
  const trimC = jk ? hex2rgb(jk.trim || rgb2css(darken(jC, 0.7))) : topC;
  const pantsC = hex2rgb(bt.color || '#334');
  const beltC = hex2rgb(bt.beltColor || '#2a2224');
  const metal = [214, 186, 112];
  const Hw = P.neckBaseY - P.crotchY;
  const layerColor = (L, wx, wy, fade) => {
    switch (L) {
      case 'jacket': return fabric(jk.fabric, jC, wx, wy, seed + 1);
      case 'collar': return jk && jk.type !== 'vest' ? fabric(jk.fabric, jC, wx, wy, seed + 1) : fabric(top.fabric, darken(topC, 0.93), wx, wy, seed + 2);
      case 'top': return fabric(top.fabric, topC, wx, wy, seed + 2);
      case 'pants': return fabric(bt.fabric, pantsC, wx, wy, seed + 3, fade);
      case 'belt': return fabric('leather', beltC, wx, wy, seed + 4);
      default: return shade(skin, FABRIC.skin(wx, wy, seed + 5));
    }
  };

  // ---------------- torso ----------------
  const T = R.torso;
  A.fill(T, (uu, vf) => {
    const s = TORSO_S[1] - vf * (TORSO_S[1] - TORSO_S[0]);
    const ring = look.torsoRing(s);
    const circ = ellipseP(ring.rx, ring.rz);
    const wx = uu * circ, wy = s * Hw;
    const L = plan.layer(s, uu);
    const front = Math.abs(uu - 0.5), back = Math.min(uu, 1 - uu);
    const seatFade = bt.fabric === 'denim' ? 0.5 * gauss(back - 0.09, 0.07) * gauss(s - 0.06, 0.08) : 0;
    let c = layerColor(L, wx, wy, seatFade + 0.25 * gauss(front - 0.11, 0.06) * gauss(s - 0.1, 0.1));
    let f = 1;
    const side = Math.min(Math.abs(uu - 0.25), Math.abs(uu - 0.75));
    f *= 1 - 0.2 * gauss(side, 0.05) * smooth(0.55, 0.74, s) * (1 - smooth(0.84, 0.94, s));
    f *= lerp(0.88, 1, smooth(-0.1, 0.45, s));
    f *= 1 + 0.06 * gauss(front, 0.13) * gauss(s - 0.72, 0.12);
    f *= 1 + 0.05 * gauss(s - 0.95, 0.05);
    if (!plan.tuck && s < plan.topHem && s > plan.topHem - 0.06) f *= lerp(0.62, 1, (plan.topHem - s) / 0.06);
    if (jk && s < plan.jHem && s > plan.jHem - 0.06) f *= lerp(0.66, 1, (plan.jHem - s) / 0.06);
    if (plan.tuck && s > plan.waist && s < plan.waist + 0.035) f *= lerp(0.75, 1, (s - plan.waist) / 0.035);
    if (L === 'top' || L === 'jacket') f *= 1 + 0.045 * Math.sin(s * 44 + fbm(uu * 5, s * 2, seed) * 5) * smooth(0.2, 0.3, s) * (1 - smooth(0.5, 0.6, s));
    if (L === 'collar') f *= lerp(0.85, 1.05, (s - 1) / 0.16);
    return shade(c, f);
  });

  // ---------------- piernas ----------------
  const G = R.leg;
  const legLen = P.hipJointY - P.ankleY;
  const baggy = bt.type === 'wide';
  A.fill(G, (uu, vf) => {
    const vv = LEG_V[0] + vf * (LEG_V[1] - LEG_V[0]);
    const rad = plan.legRad(Math.max(0, vv)) * u * lerp(1, P.k, 0.5);
    const wx = uu * 2 * Math.PI * rad, wy = vv * legLen;
    const front = Math.abs(uu - 0.5), back = Math.min(uu, 1 - uu);
    let c, f = 1;
    if (vv <= plan.pantsEnd) {
      let fade = 0;
      if (bt.fabric === 'denim') {
        fade = 0.55 * gauss(front, 0.1) * gauss(vv - 0.25, 0.17) + 0.4 * gauss(front, 0.08) * gauss(vv - 0.52, 0.07) + 0.35 * gauss(back, 0.1) * gauss(vv - 0.08, 0.1);
        fade += 0.18 * gauss(Math.abs(uu - 0.75), 0.03);
      }
      c = layerColor('pants', wx, wy, fade);
      if (baggy) f *= 1 + 0.13 * Math.sin(uu * Math.PI * 12 + fbm(uu * 4, vv * 2, seed + 8) * 6) * smooth(0.15, 0.6, vv);
      else f *= 1 + 0.05 * Math.sin(uu * Math.PI * 10 + fbm(uu * 4, vv * 2, seed + 8) * 5);
      f *= 1 - 0.18 * gauss(back, 0.12) * gauss(vv - 0.5, 0.05);
      f *= 1 - 0.12 * gauss(uu - 0.25, 0.08) * smooth(0.0, -0.08, vv - 0.1);
      if (vv > plan.pantsEnd - 0.04 && bt.type !== 'joggers') f *= lerp(1, 0.8, (vv - (plan.pantsEnd - 0.04)) / 0.04);
      if (bt.type === 'joggers' && vv > 0.92) f *= 0.9 + 0.08 * Math.sin(uu * 220);
    } else {
      c = shade(skin, FABRIC.skin(wx, wy, seed + 6));
      f *= 1 - 0.14 * gauss(vv - 0.5, 0.05) * gauss(back, 0.15);
      f *= 1 + 0.06 * gauss(vv - 0.5, 0.05) * gauss(front, 0.1);
      if (vv < plan.pantsEnd + 0.05) f *= lerp(0.72, 1, (vv - plan.pantsEnd) / 0.05);
      if (plan.sock > 0 && vv > 1 - plan.sock * 0.62) {
        const sockC = hex2rgb(shoes.sockColor || '#f1efe9');
        c = shade(sockC, 1 + 0.06 * Math.sin(uu * 260) + (grain(wx * 800, wy * 800, seed) - 0.5) * 0.06);
        if (vv < 1 - plan.sock * 0.62 + 0.025) f *= 0.92;
      }
    }
    return shade(c, f);
  });

  // ---------------- brazos ----------------
  const M = R.arm;
  const armLen = P.upperArm + P.foreArm;
  const hc = hex2rgb(hands.color || '#2a2a30');
  A.fill(M, (uu, vf) => {
    const a = ARM_U[0] + vf * (ARM_U[1] - ARM_U[0]);
    const rad = 0.034 * u;
    const wx = uu * 2 * Math.PI * rad, wy = a * armLen;
    const L = plan.armLayer(a);
    let c = layerColor(L, wx, wy, 0), f = 1;
    const front = Math.abs(uu - 0.5), back = Math.min(uu, 1 - uu);
    if (L !== 'skin') {
      f *= 1 - 0.22 * gauss(uu - 0.25, 0.1) * smooth(0.12, -0.05, a);
      f *= 1 - 0.18 * gauss(front - 0.05, 0.12) * gauss(a - 0.5, 0.05);
      const end = L === 'jacket' ? plan.jEnd : plan.topEnd;
      const rolled = (L === 'jacket' ? plan.jSleeves : top.sleeves) === 'rolled';
      if (rolled && a > end - 0.07) f *= 1.06 + 0.1 * Math.sin((a - end) * 260);
      else if (a > end - 0.035) f *= 0.86;
      if (L === 'top' && jk && plan.jEnd > 0 && a > plan.jEnd && a < plan.jEnd + 0.05) f *= lerp(0.7, 1, (a - plan.jEnd) / 0.05);
    } else {
      const end = Math.max(plan.topEnd, plan.jEnd);
      if (a < end + 0.05) f *= lerp(0.68, 1, clamp((a - end) / 0.05));
      f *= 1 - 0.1 * gauss(back, 0.1) * gauss(a - 0.5, 0.05);
      if (hands.type === 'wraps' && a > 0.88) { c = shade(hex2rgb(hands.color || '#efe8d8'), 1 + 0.08 * Math.sin((a + uu * 0.12) * 240)); }
      if (hands.wrist && a > 0.88 && a < 0.96) c = shade(hex2rgb(hands.wristColor || '#222'), 1 + 0.06 * Math.sin(uu * 200));
      if (hands.type === 'gloves' && a > 0.955) c = fabric('leather', hc, wx, wy, seed);
    }
    return shade(c, f);
  });

  // ---------------- cuello, manos ----------------
  A.fill(R.neck, (uu, vf) => shade(skin, FABRIC.skin(uu * 0.2, vf * 0.06, seed) * lerp(0.72, 0.98, smooth(0, 0.7, vf)) * (1 - 0.1 * gauss(Math.min(uu, 1 - uu), 0.2))));
  const handBase = hands.type === 'gloves' ? hc : hands.type === 'wraps' ? hex2rgb(hands.color || '#efe8d8') : skin;
  const handKind = hands.type === 'gloves' ? 'leather' : hands.type === 'wraps' ? 'cotton' : 'skin';
  const fingerless = hands.type === 'fingerless';
  A.fill(HAND.back, (x, y) => {
    let c = fingerless && x < 0.62 ? fabric('leather', hc, x * 0.07, y * 0.05, seed) : fingerless ? skin : handBase;
    c = fingerless && x < 0.62 ? c : shade(c, (FABRIC[handKind] || FABRIC.skin)(x * 0.07, y * 0.05, seed));
    let f = 1 - 0.1 * gauss(x - 0.64, 0.05) + 0.06 * gauss(x - 0.55, 0.05);
    if (x > 0.66) f *= 1 - 0.14 * Math.max(0, Math.cos(y * Math.PI * 8)) ** 8;
    if (hands.type === 'wraps') f *= 1 + 0.08 * Math.sin((x * 0.6 + y) * 30);
    return shade(c, f);
  });
  A.fill(HAND.palm, (x, y) => shade(fingerless && x < 0.62 ? hc : mulc(handBase, 1.04), 1 - 0.15 * gauss(x - 0.6, 0.03) - 0.1 * gauss(y - 0.5 - (x - 0.5) * 0.4, 0.03)));
  A.fill(HAND.side, (x, y) => shade(fingerless && x < 0.62 ? hc : handBase, lerp(0.9, 1.02, y) * (1 - 0.12 * gauss(x - 0.62, 0.05))));

  // ---------------- cabeza (atrás y lados) ----------------
  const hm = look.hm, ph = look.ph;
  const longHair = (spec.hair?.style === 'long');
  const bald = (spec.hair?.style === 'bald' || spec.hair?.style === 'buzz');
  const [hl, hr] = look.hairSpan;
  const stripY0 = hm.rows.nearTop + 0.25 * (hm.rows.hairline - hm.rows.nearTop), stripY1 = hm.rows.hairline;
  const hairAt = (uu, t) => {
    // pelo de la foto, repetido en espejo alrededor de la cabeza, con mechones verticales
    const tx = Math.abs(((uu * 3.0) % 2) - 1);
    const px = lerp(lerp(hl, hr, 0.22), lerp(hl, hr, 0.78), tx);
    const py = lerp(stripY0, stripY1, Math.abs(((t * 2.2 + uu * 0.3) % 2) - 1));
    const s = ph.A(px, py) > 200 ? ph.C(px, py) : hair;
    const d = lum(s) - lum(hair);
    const c = Math.abs(d) > 70 ? hair : mixc(hair, s, 0.75);
    return shade(c, 1 + (fbm(uu * 60, t * 5, seed + 11, 3) - 0.5) * 0.35);
  };
  const tE = hm.t.eye, tN = hm.t.nose, tM = hm.t.mouth;
  A.fill(R.headB, (uu, vf) => {
    const t = 1 - vf;
    const d = Math.abs(uu - 0.5);           // 0 nuca … 0.5 frente
    const sideD = Math.abs(d - 0.25);       // 0 en las orejas
    let hb;
    if (longHair) hb = d > 0.38 ? hm.t.hairline : -1;
    else if (bald) hb = 2;
    else if (d < 0.25) hb = lerp(tM - 0.02, tE + 0.04, smooth(0.0, 0.25, d));
    else hb = lerp(tE + 0.04, hm.t.hairline, smooth(0.25, 0.5, d)) - 0.12 * gauss(d - 0.3, 0.025);
    let c;
    if (t > hb) c = hairAt(uu, t);
    else {
      c = shade(skin, FABRIC.skin(uu * 0.5, t * 0.2, seed) * lerp(0.82, 0.96, smooth(0, 0.5, t)) * (t > hb - 0.06 ? lerp(0.78, 1, (hb - t) / 0.06) : 1));
      if (t < 0.12 && d > 0.3) c = shade(c, 0.86);
    }
    // orejas
    if (!longHair && sideD < 0.045 && t > tN - 0.05 && t < tE + 0.07) {
      const ex = sideD / 0.045, ey = (t - (tN + tE) / 2 + 0.01) / ((tE - tN) / 2 + 0.06);
      const r = ex * ex + ey * ey;
      if (r < 1) c = shade(skin, r > 0.55 ? 0.98 : 0.8 + 0.12 * r);
    }
    return c;
  });

  // ---------------- zapatillas ----------------
  const sh = { color: hex2rgb(shoes.color || '#eee'), accent: hex2rgb(shoes.accent || '#c33'), sole: hex2rgb(shoes.sole || '#f2f0ea'), lace: hex2rgb(shoes.lace || '#fafafa') };
  const boot = shoes.type === 'boot';
  const shoeH = look.shoe.hMax, soleT = look.shoe.sole;
  A.fill(R.shoeSide, (x, y) => {
    const hy = (1 - y) * shoeH;              // altura en el mundo
    const prof = look.shoe.heightAt(x);      // alto del empeine en esa posición
    let c;
    if (hy < soleT) {
      c = shade(sh.sole, 1 + (grain(x * 300, y * 60, seed) - 0.5) * 0.06);
      if (hy < soleT * 0.35) c = shade(c, 0.86);
      if (Math.abs(hy - soleT * 0.6) < soleT * 0.08) c = shade(c, 0.9);
    } else {
      const kind = boot ? 'leather' : 'leather';
      c = fabric(kind, sh.color, x * 0.3, hy, seed + 21);
      const toe = x > 0.8, heel = x < 0.16;
      if ((toe || heel) && !boot) c = shade(c, 0.96);
      // franja de acento (genérica, no de marca)
      if (!boot) {
        const k = (hy - soleT) / (prof - soleT);
        const band = Math.abs(k - lerp(0.25, 0.75, smooth(0.3, 0.75, x))) < 0.08 && x > 0.28 && x < 0.78;
        if (band) c = fabric('leather', sh.accent, x * 0.3, hy, seed + 22);
        if (heel && k > 0.25) c = fabric('leather', sh.accent, x * 0.3, hy, seed + 23);
      }
      // costuras y arrugas de la puntera
      if (x > 0.7 && x < 0.86) c = shade(c, 1 - 0.12 * Math.max(0, Math.sin(x * 120)) ** 6);
      if (hy > prof - 0.004 * u) c = shade(c, 0.78);
    }
    return c;
  });
  A.fill(R.shoeTop, (x, y) => {
    const across = Math.abs(y - 0.5) * 2;
    let c = fabric('leather', sh.color, x * 0.3, y * 0.08, seed + 24);
    if (x < 0.2 && across < 0.55) c = shade(mixc(c, [40, 36, 38], 0.7), 1);   // abertura del tobillo (forro)
    if (x >= 0.24 && x < 0.66 && across < 0.32) {
      // lengüeta y cordones en zigzag
      c = shade(c, 0.92);
      const lx = (x - 0.24) / 0.42 * 6;
      const zz = Math.abs((lx % 1) - 0.5) * 2;
      if (Math.abs(across - zz * 0.28) < 0.07) c = shade(sh.lace, 1 - 0.1 * (lx % 1));
    }
    if (!boot && x > 0.72) c = shade(c, 0.97 - 0.1 * Math.max(0, Math.sin(x * 140)) ** 8);
    return shade(c, lerp(0.85, 1, 1 - across * 0.6));
  });
  A.fill(SOLE, (x, y) => shade(darken(sh.sole, 0.82), (Math.sin(x * 70) > 0.4 || Math.sin(y * 50) > 0.6) ? 0.78 : 1));

  // ---------------- extras: audífonos, capucha ----------------
  const hp = spec.acc?.headphones;
  const hpC = hex2rgb(hp?.color || '#1c1c20'), hpA = hex2rgb(hp?.accent || '#3a3a44');
  A.fill(EXTRA.cup, (x, y) => shade(hpC, FABRIC.plastic(x * 0.1, y * 0.1, seed) * (0.85 + 0.25 * Math.max(0, 1 - Math.hypot(x - 0.35, y - 0.3) * 2.4))));
  A.fill(EXTRA.cap, (x, y) => { const r = Math.hypot(x - 0.5, y - 0.5); return r > 0.36 && r < 0.44 ? hpA : shade(hpC, 1.1 - r * 0.5 + (r < 0.2 ? 0.08 : 0)); });
  A.fill(EXTRA.band, (x, y) => shade(hpC, (0.9 + 0.15 * Math.sin(y * Math.PI)) * FABRIC.leather(x * 0.2, y * 0.05, seed)));
  A.fill(EXTRA.hood, (x, y) => shade(fabric(jk?.fabric || 'knit', jC, x * 0.3, y * 0.15, seed + 1), lerp(0.75, 1.05, Math.sin(y * Math.PI))));

  // ---------------- parches sólidos ----------------
  const patch = ([x, y], c) => A.fill({ x: x - 8, y: y - 8, w: 16, h: 16 }, () => c);
  patch(CAP.dark, [24, 22, 26]);
  patch(CAP.skin, darken(skin, 0.8));
  patch(CAP.collar, darken(jk && jk.type !== 'vest' ? jC : topC, 0.85));
  patch(CAP.crotch, darken(pantsC, 0.7));
  patch(CAP.hair, darken(hair, 0.85));
  patch(CAP.plastic, hpC);
  patch(CAP.accent, hpA);

  A.commit();

  // ---------------- cara: la foto ----------------
  const F = R.headF, cr = hm.crop;
  A.g.drawImage(ph.canvas, cr.x0 * ph.S, cr.y0 * ph.S, cr.w * ph.S, cr.h * ph.S, F.x, F.y, F.w, F.h);
  fillHoles(A.g, F, hair);

  // ---------------- detalles vectoriales ----------------
  const tx = (uu) => T.x + uu * T.w;
  const ty = (s) => torsoV(s);
  const gx = (uu) => G.x + uu * G.w;
  const gy = (vv) => legV(vv);
  const mx = (uu) => M.x + uu * M.w;
  const my = (a) => armV(a);
  const dk = (c, k = 0.6, a = 1) => `rgba(${darken(c, k).map(Math.round).join(',')},${a})`;
  const stitchOf = (c) => (bt.fabric === 'denim' ? 'rgba(214,170,92,0.75)' : `rgba(${mixc(c, [255, 255, 255], 0.25).map(Math.round).join(',')},0.6)`);

  A.draw(T, (g) => {
    // pantalón: tiro, bragueta, bolsillos
    const pantsTop = plan.waist;
    seam(g, [[tx(0.5), ty(-0.1)], [tx(0.5), ty(pantsTop - 0.04)]], { dark: dk(pantsC, 0.5, 0.7), stitch: stitchOf(pantsC) });
    seam(g, [[tx(0.002), ty(-0.1)], [tx(0.002), ty(pantsTop)]], { dark: dk(pantsC, 0.5, 0.7) });
    seam(g, [[tx(0.998), ty(-0.1)], [tx(0.998), ty(pantsTop)]], { dark: dk(pantsC, 0.5, 0.7) });
    if (bt.type !== 'joggers') {
      seam(g, [[tx(0.53), ty(pantsTop - 0.04)], [tx(0.53), ty(0.08)], [tx(0.5), ty(0.03)]], { dark: dk(pantsC, 0.55, 0.6), stitch: stitchOf(pantsC), off: 1.2 });
      for (const sg of [-1, 1]) {
        g.strokeStyle = dk(pantsC, 0.45, 0.8); g.lineWidth = 1.2;
        g.beginPath(); g.moveTo(tx(0.5 + sg * 0.1), ty(pantsTop - 0.035)); g.quadraticCurveTo(tx(0.5 + sg * 0.12), ty(0.13), tx(0.5 + sg * 0.19), ty(0.12)); g.stroke();
        // bolsillos traseros
        if (bt.fabric === 'denim' || bt.type === 'straight' || bt.type === 'slim' || bt.type === 'wide') {
          const cx = sg > 0 ? tx(0.095) : tx(0.905);
          g.strokeStyle = stitchOf(pantsC); g.setLineDash([1.5, 1.3]); g.lineWidth = 0.9;
          g.beginPath(); g.moveTo(cx - 9, ty(0.19)); g.lineTo(cx + 9, ty(0.19)); g.lineTo(cx + 8, ty(0.06)); g.lineTo(cx, ty(0.03)); g.lineTo(cx - 8, ty(0.06)); g.closePath(); g.stroke();
          g.setLineDash([]);
        }
      }
    }
    // pretina / cinturón
    const wy0 = ty(pantsTop), wy1 = ty(pantsTop - 0.035);
    if (plan.belt) {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(T.x, wy0, T.w, 1);
      g.fillStyle = rgb2css(metal); g.fillRect(tx(0.5) - 6, wy0 + 0.5, 12, wy1 - wy0 - 0.5);
      g.fillStyle = rgb2css(darken(metal, 0.6)); g.fillRect(tx(0.5) - 3, wy0 + 2, 6, wy1 - wy0 - 4);
      g.fillStyle = dk(beltC, 0.7, 0.9);
      for (const uu of [0.36, 0.64, 0.12, 0.88]) g.fillRect(tx(uu) - 1, wy0 - 1, 2, wy1 - wy0 + 2);
    } else if (bt.type === 'joggers') {
      g.fillStyle = dk(pantsC, 0.8, 0.9); g.fillRect(T.x, wy0, T.w, wy1 - wy0);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; for (let x = T.x; x < T.x + T.w; x += 2) { g.beginPath(); g.moveTo(x, wy0); g.lineTo(x, wy1); g.stroke(); }
      g.strokeStyle = rgb2css(hex2rgb(bt.trim || '#eee')); g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(tx(0.49), wy1); g.lineTo(tx(0.48), wy1 + 14); g.moveTo(tx(0.51), wy1); g.lineTo(tx(0.52), wy1 + 13); g.stroke();
    } else if (!plan.tuck || true) {
      seam(g, [[T.x, wy1], [T.x + T.w, wy1]], { dark: dk(pantsC, 0.5, 0.6), stitch: stitchOf(pantsC) });
    }
    // costados de la prenda de arriba
    const topFrom = plan.tuck ? plan.waist : plan.topHem;
    for (const uu of [0.25, 0.75]) seam(g, [[tx(uu), ty(topFrom)], [tx(uu), ty(0.9)]], { dark: dk(topC, 0.6, 0.45) });
    seam(g, [[T.x, ty(0.955)], [T.x + T.w, ty(0.955)]], { dark: dk(topC, 0.6, 0.3) });
    if (!plan.tuck) seam(g, [[T.x, ty(plan.topHem + 0.02)], [T.x + T.w, ty(plan.topHem + 0.02)]], { dark: dk(topC, 0.6, 0.5), stitch: `rgba(${mixc(topC, [255, 255, 255], 0.3).map(Math.round).join(',')},0.5)`, off: 0 });
    // tirones de tela desde las axilas
    for (const sg of [-1, 1]) {
      fold(g, [[tx(0.5 + sg * 0.22), ty(0.76)], [tx(0.5 + sg * 0.15), ty(0.66)], [tx(0.5 + sg * 0.1), ty(0.6)]], { a: 0.22, w: 3 });
      fold(g, [[tx(0.5 + sg * 0.21), ty(0.7)], [tx(0.5 + sg * 0.17), ty(0.55)]], { a: 0.16, w: 2.5 });
      fold(g, [[tx(sg > 0 ? 0.03 : 0.97), ty(0.8)], [tx(sg > 0 ? 0.12 : 0.88), ty(0.68)]], { a: 0.18, w: 3 });
    }
    if (plan.tuck) for (let i = 0; i < 9; i++) { const uu = 0.05 + i * 0.11 + Math.sin(i * 7) * 0.02; fold(g, [[tx(uu), ty(plan.waist + 0.005)], [tx(uu + 0.01), ty(plan.waist + 0.07)]], { a: 0.25, w: 2 }); }

    // cuello y frente de la prenda de arriba
    const tC = topC;
    if (top.type === 'shirt') {
      // tapeta, botones y cuello abierto
      const openTo = 0.86;
      seam(g, [[tx(0.5) + 3, ty(topFrom)], [tx(0.5) + 3, ty(openTo)]], { dark: dk(tC, 0.7, 0.55) });
      seam(g, [[tx(0.5) - 3, ty(topFrom)], [tx(0.5) - 3, ty(openTo)]], { dark: dk(tC, 0.7, 0.4) });
      for (let s = openTo - 0.04; s > topFrom + 0.02; s -= 0.085) { g.fillStyle = rgb2css(darken(tC, 0.72)); g.fillRect(tx(0.5) - 1, ty(s) - 1, 2, 2); }
      g.fillStyle = rgb2css(skin);
      g.beginPath(); g.moveTo(tx(0.5), ty(openTo)); g.lineTo(tx(0.5) - 15, ty(1.0)); g.lineTo(tx(0.5) + 15, ty(1.0)); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.moveTo(tx(0.5), ty(openTo)); g.lineTo(tx(0.5) - 15, ty(1.0)); g.lineTo(tx(0.5) - 11, ty(1.0)); g.closePath(); g.fill();
      // puntas del cuello
      g.fillStyle = rgb2css(mixc(tC, [255, 255, 255], 0.1)); g.strokeStyle = dk(tC, 0.6, 0.6); g.lineWidth = 1;
      for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(tx(0.5) + sg * 13, ty(1.01)); g.lineTo(tx(0.5) + sg * 6, ty(0.925)); g.lineTo(tx(0.5) + sg * 18, ty(0.955)); g.closePath(); g.fill(); g.stroke(); }
    } else if (top.type === 'tank') {
      g.fillStyle = rgb2css(skin);
      g.beginPath(); g.ellipse(tx(0.5), ty(1.0), 20, 22, 0, 0, Math.PI * 2); g.fill();
    } else {
      // cuello redondo con ribete
      g.strokeStyle = rgb2css(darken(tC, 0.85)); g.lineWidth = 3;
      g.beginPath(); g.moveTo(T.x, ty(0.985)); g.lineTo(tx(0.42), ty(0.985)); g.quadraticCurveTo(tx(0.5), ty(0.94), tx(0.58), ty(0.985)); g.lineTo(T.x + T.w, ty(0.985)); g.stroke();
      if (top.type === 'hoodie') fold(g, [[tx(0.44), ty(0.96)], [tx(0.5), ty(0.9)], [tx(0.56), ty(0.96)]], { a: 0.3, w: 3 });
    }

    // chaqueta: cierre / abertura / ribetes / bolsillos
    if (jk) {
      const hemY = ty(plan.jHem);
      const edge = [];
      for (let s = plan.jHem; s <= 1.0001; s += 0.02) edge.push(s);
      for (const sg of [-1, 1]) {
        g.strokeStyle = rgb2css(trimC); g.lineWidth = jk.type === 'vest' ? 2.2 : 1.6;
        g.beginPath(); edge.forEach((s, i) => { const x = tx(0.5 + sg * Math.max(0.004, plan.openHalf(s))); i ? g.lineTo(x, ty(s)) : g.moveTo(x, ty(s)); }); g.stroke();
      }
      if (jk.type === 'fleece' || jk.type === 'hoodie' || jk.type === 'coat') {
        // dientes del cierre en la parte cerrada
        g.fillStyle = jk.type === 'fleece' ? 'rgba(10,10,12,0.9)' : rgb2css(darken(trimC, 0.8));
        for (let s = plan.jHem; s < 1; s += 0.012) if (plan.openHalf(s) < 0.006) g.fillRect(tx(0.5) - 1, ty(s), 2, 1);
        fold(g, [[tx(0.36), ty(plan.jHem + 0.02)], [tx(0.39), ty(plan.jHem + 0.14)]], { a: 0.25, w: 3 });
        fold(g, [[tx(0.64), ty(plan.jHem + 0.02)], [tx(0.61), ty(plan.jHem + 0.14)]], { a: 0.25, w: 3 });
        // bolsillos
        g.strokeStyle = dk(jC, 0.5, 0.8); g.lineWidth = 1.2;
        for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(tx(0.5 + sg * 0.09), ty(plan.jHem + 0.2)); g.lineTo(tx(0.5 + sg * 0.15), ty(plan.jHem + 0.05)); g.stroke(); }
      }
      g.fillStyle = rgb2css(darken(trimC, 0.95)); g.fillRect(T.x, hemY - 3, T.w, 3);
      if (jk.type === 'vest') {
        // sisas con ribete
        g.strokeStyle = rgb2css(trimC); g.lineWidth = 2;
        for (const uu of [0.25, 0.75]) { g.beginPath(); g.ellipse(tx(uu), ty(0.9), 0.055 * T.w, (0.17 / (TORSO_S[1] - TORSO_S[0])) * T.h, 0, Math.PI * 0.0, Math.PI * 2); g.stroke(); }
        g.fillStyle = rgb2css(metal); for (let s = plan.jHem + 0.05; s < 0.62; s += 0.09) g.fillRect(tx(0.5) - 1 - 0.006 * T.w, ty(s) - 1, 3, 3);
      }
      if (jk.cord || jk.type === 'hoodie') {
        g.strokeStyle = rgb2css(hex2rgb(jk.cord || '#eee')); g.lineWidth = 1.6;
        for (const sg of [-1, 1]) { const x0 = tx(0.5 + sg * Math.max(0.03, plan.openHalf(0.99) + 0.012)); g.beginPath(); g.moveTo(x0, ty(1.0)); g.lineTo(x0 - sg * 2, ty(0.8)); g.stroke(); g.fillStyle = rgb2css(darken(hex2rgb(jk.cord || '#eee'), 0.8)); g.fillRect(x0 - sg * 2 - 1.5, ty(0.8), 3, 5); }
      }
    }

    // estampados
    for (const p of spec.prints || []) {
      const on = p.on || 'top';
      if (on === 'jacket' && !jk) continue;
      if (on === 'top' && jk && p.side !== 'back' && (jk.open ?? 0.34) < 0.3) continue;
      const hem = on === 'jacket' ? plan.jHem : topFrom;
      const s = lerp(hem, 0.98, p.y ?? 0.6);
      const ring = look.torsoRing(s);
      const pxW = T.w / ellipseP(ring.rx, ring.rz), pxH = T.h / ((TORSO_S[1] - TORSO_S[0]) * Hw);
      const size = (p.size ?? 1) * 0.034 * u * pxH;
      const col = p.color || '#fff';
      const centers = p.side === 'back' ? [T.x, T.x + T.w] : [tx(0.5)];
      g.save();
      if (on === 'top' && jk) {
        if (p.side === 'back') { g.restore(); continue; }
        g.beginPath();
        const ss = []; for (let k = plan.jHem; k <= 1.0001; k += 0.01) ss.push(k);
        ss.forEach((k, i) => (i ? g.lineTo(tx(0.5 - plan.openHalf(k)), ty(k)) : g.moveTo(tx(0.5 - plan.openHalf(k)), ty(k))));
        ss.reverse().forEach((k) => g.lineTo(tx(0.5 + plan.openHalf(k)), ty(k)));
        g.closePath(); g.clip();
      }
      for (const cx of centers) {
        if (p.kind === 'band') { g.fillStyle = col; g.fillRect(T.x, ty(s) - size * 0.3, T.w, size * 0.6); continue; }
        if (p.kind === 'banana') {
          g.save(); g.translate(cx, ty(s)); g.scale(pxW / pxH, 1); g.strokeStyle = col; g.lineWidth = size * 0.4; g.lineCap = 'round';
          g.beginPath(); g.arc(0, -size * 0.9, size * 1.25, Math.PI * 0.22, Math.PI * 0.78); g.stroke(); g.restore(); continue;
        }
        const lines = String(p.text || '').split('\n');
        lines.forEach((ln, i) => textOn(g, ln, cx, ty(s) + (i - (lines.length - 1) / 2) * size * 0.95, size, col, { scaleX: pxW / pxH, max: 0.36 * T.w / (pxW / pxH) }));
        // la tinta se gasta un poco con la tela
        g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.18;
        for (let i = 0; i < 40; i++) { g.fillStyle = '#556'; g.fillRect(cx - size * 2 + grain(i, 3, seed) * size * 4, ty(s) - size * 0.6 + grain(i, 5, seed) * size * 1.2, 1, 1); }
        g.restore();
      }
      g.restore();
    }
  });

  A.draw(G, (g) => {
    // costuras: exterior (u .75) e interior (u .25), basta
    const end = Math.min(plan.pantsEnd, LEG_V[1]);
    seam(g, [[gx(0.75), gy(-0.1)], [gx(0.75), gy(end)]], { dark: dk(pantsC, 0.5, 0.7), stitch: stitchOf(pantsC), w: 1.2 });
    seam(g, [[gx(0.25), gy(-0.02)], [gx(0.25), gy(end)]], { dark: dk(pantsC, 0.5, 0.6), stitch: bt.fabric === 'denim' ? stitchOf(pantsC) : null });
    if (bt.stripe) { g.fillStyle = rgb2css(hex2rgb(bt.trim || '#eee')); g.fillRect(gx(0.75) - 4, gy(-0.1), 8, gy(Math.min(end, 0.92)) - gy(-0.1)); }
    if (bt.type !== 'joggers') seam(g, [[G.x, gy(end) - 5], [G.x + G.w, gy(end) - 5]], { dark: dk(pantsC, 0.5, 0.6), stitch: stitchOf(pantsC), off: 0 });
    if (bt.type === 'joggers') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(G.x, gy(0.92), G.w, 2); }
    if (bt.fabric === 'denim') {
      // bigotes en la entrepierna y panal detrás de la rodilla
      for (let i = 0; i < 6; i++) {
        const y = gy(0.02 + i * 0.022), x0 = gx(0.29 + i * 0.006);
        g.save(); g.filter = 'blur(0.8px)'; g.strokeStyle = 'rgba(235,240,250,0.45)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x0, y + 6); g.lineTo(x0 + 26 - i * 2, y - 2); g.stroke(); g.restore();
      }
      for (const cx of [G.x + 8, G.x + G.w - 8]) for (let i = 0; i < 4; i++) fold(g, [[cx - 14, gy(0.47 + i * 0.016)], [cx, gy(0.475 + i * 0.016)], [cx + 14, gy(0.47 + i * 0.016)]], { a: 0.35, w: 2.2, hi: 0.2, off: [0, 1.6] });
    }
    if (baggy || bt.type === 'straight') {
      // pliegues verticales y la tela amontonada en el tobillo
      for (let i = 0; i < 7; i++) { const uu = 0.07 + i * 0.14 + grain(i, 1, seed) * 0.04; fold(g, [[gx(uu), gy(0.12 + grain(i, 2, seed) * 0.1)], [gx(uu + 0.02), gy(0.45)], [gx(uu - 0.01), gy(0.8)]], { a: baggy ? 0.3 : 0.16, w: baggy ? 4 : 2.4 }); }
      const stackFrom = baggy ? 0.8 : 0.9;
      for (let k = 0; k < (baggy ? 7 : 4); k++) {
        const vv = stackFrom + k * ((end - stackFrom) / (baggy ? 7 : 4));
        const pts = []; for (let i = 0; i <= 10; i++) pts.push([G.x + (i / 10) * G.w, gy(vv) + (i % 2 ? 4 : -4) + Math.sin(i * 1.7 + k) * 2]);
        fold(g, pts, { a: 0.38, w: 3, hi: 0.22, off: [0, 2] });
      }
    }
    if (bt.type === 'joggers') for (let k = 0; k < 5; k++) { const pts = []; for (let i = 0; i <= 8; i++) pts.push([G.x + (i / 8) * G.w, gy(0.78 + k * 0.028) + (i % 2 ? 3 : -3)]); fold(g, pts, { a: 0.3, w: 2.6, off: [0, 1.6] }); }
    if (bt.type === 'shorts' && bt.pocket) seam(g, [[gx(0.7), gy(0.0)], [gx(0.72), gy(0.18)], [gx(0.8), gy(0.18)], [gx(0.8), gy(0.0)]], { dark: dk(pantsC, 0.5, 0.7) });
    for (let i = 0; i < 3; i++) fold(g, [[gx(0.42 + i * 0.05), gy(0.5)], [gx(0.5 + i * 0.05), gy(0.53)]], { a: 0.25, w: 2 });
  });

  A.draw(M, (g) => {
    const ends = [];
    if (plan.topEnd > 0 && plan.topEnd < 0.99) ends.push([plan.topEnd, topC]);
    if (jk && plan.jEnd > 0 && plan.jEnd < 0.99) ends.push([plan.jEnd, jC]);
    for (const [e, c] of ends) seam(g, [[M.x, my(e - 0.03)], [M.x + M.w, my(e - 0.03)]], { dark: dk(c, 0.55, 0.6), stitch: `rgba(${mixc(c, [255, 255, 255], 0.3).map(Math.round).join(',')},0.5)`, off: 0 });
    seam(g, [[mx(0.25), my(-0.1)], [mx(0.25), my(Math.max(plan.topEnd, plan.jEnd))]], { dark: 'rgba(0,0,0,0.3)' });
    if (Math.max(plan.topEnd, plan.jEnd) > 0.6) for (let i = 0; i < 4; i++) fold(g, [[mx(0.38 + i * 0.04), my(0.47 + i * 0.012)], [mx(0.5 + i * 0.04), my(0.5 + i * 0.01)], [mx(0.62 + i * 0.03), my(0.47 + i * 0.012)]], { a: 0.3, w: 2.4, off: [0, 1.5] });
    if (top.type === 'shirt' && plan.topEnd > 0.9) seam(g, [[M.x, my(0.92)], [M.x + M.w, my(0.92)]], { dark: dk(topC, 0.6, 0.6) });
  });

  // malla UV para la vista de atlas
  return A;
}

// rellena los huecos transparentes de la foto con el color vecino (dilatación) y deja todo opaco
function fillHoles(g, F, fallback) {
  const img = g.getImageData(F.x, F.y, F.w, F.h), d = img.data, W = F.w, H = F.h;
  const solid = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) solid[i] = d[i * 4 + 3] > 200 ? 1 : 0;
  for (let it = 0; it < 40; it++) {
    const add = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x; if (solid[i]) continue;
      let r = 0, gg = 0, b = 0, n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const j = yy * W + xx; if (!solid[j]) continue;
        r += d[j * 4]; gg += d[j * 4 + 1]; b += d[j * 4 + 2]; n++;
      }
      if (n) add.push([i, r / n, gg / n, b / n]);
    }
    if (!add.length) break;
    for (const [i, r, gg, b] of add) { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; solid[i] = 1; }
  }
  for (let i = 0; i < W * H; i++) { if (!solid[i]) { d[i * 4] = fallback[0]; d[i * 4 + 1] = fallback[1]; d[i * 4 + 2] = fallback[2]; } d[i * 4 + 3] = 255; }
  g.putImageData(img, F.x, F.y);
}
