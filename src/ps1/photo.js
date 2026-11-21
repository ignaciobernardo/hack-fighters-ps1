// La foto de la persona como textura de la cabeza (la técnica de los juegos de fútbol de PS1):
// con los puntos de Vision se escala la foto al esqueleto, la silueta alfa da el ancho
// de cada anillo de la cabeza (pelo incluido) y la cara se proyecta de frente.
import { lerp, clamp } from './low.js';

export function readPhoto(img, face) {
  const S = 512;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = S;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, S, S);
  const d = g.getImageData(0, 0, S, S).data;
  const ix = (x) => clamp(Math.round(x * S), 0, S - 1);
  const A = (x, y) => d[(ix(y) * S + ix(x)) * 4 + 3];
  const C = (x, y) => { const k = (ix(y) * S + ix(x)) * 4; return [d[k], d[k + 1], d[k + 2]]; };
  // ancho de la silueta en una fila, caminando desde cx (tolera huecos chicos del peinado)
  const span = (y, cx) => {
    const yi = ix(y); let l = ix(cx), r = l, gap = 0;
    for (let x = ix(cx); x >= 0; x--) { if (d[(yi * S + x) * 4 + 3] > 128) { l = x; gap = 0; } else if (++gap > 5) break; }
    gap = 0;
    for (let x = ix(cx); x < S; x++) { if (d[(yi * S + x) * 4 + 3] > 128) { r = x; gap = 0; } else if (++gap > 5) break; }
    return [l / S, (r + 1) / S];
  };
  const median = (x0, y0, x1, y1) => {
    const px = [];
    for (let y = ix(y0); y <= ix(y1); y++) for (let x = ix(x0); x <= ix(x1); x++) {
      const k = (y * S + x) * 4; if (d[k + 3] > 200) px.push([d[k], d[k + 1], d[k + 2]]);
    }
    if (!px.length) return null;
    const m = (i) => { const a = px.map((p) => p[i]).sort((p, q) => p - q); return a[a.length >> 1]; };
    return [m(0), m(1), m(2)];
  };
  return { S, canvas, data: d, face, A, C, span, median };
}

// Modelo de la cabeza en coordenadas del personaje.
// P: proporciones (chinY, headH, headC). Devuelve anillos de abajo (mentón) hacia arriba.
export function headModel(P, ph) {
  const f = ph.face;
  const ex = (f.eyeL[0] + f.eyeR[0]) / 2, ey = (f.eyeL[1] + f.eyeR[1]) / 2;
  const eyeD = Math.hypot(f.eyeR[0] - f.eyeL[0], f.eyeR[1] - f.eyeL[1]);
  const chinRow = f.chin[1];
  const faceLen = chinRow - ey;
  // mundo por unidad de foto: ojos→mentón ≈ media cabeza; distancia entre ojos ≈ 0.27 cabeza
  const k = 0.65 * (0.5 * P.headH / faceLen) + 0.35 * (0.27 * P.headH / eyeD);
  const fx = (2 * ex + f.chin[0] + f.mouth[0]) / 4;
  const cheek = Math.max(0.5 * eyeD * 1.6, (f.jawR[0] - f.jawL[0]) / 2);
  // tope del pelo sobre la línea media
  let top = ey - 1.2 * faceLen;
  for (let y = 0; y < ph.S; y++) {
    const yn = y / ph.S; let hit = false;
    for (let x = fx - 0.06; x <= fx + 0.06; x += 1 / ph.S) if (ph.A(x, yn) > 128) { hit = true; break; }
    if (hit) { top = yn; break; }
  }
  top = Math.max(top, ey - 1.6 * faceLen);
  const browRow = ey - 0.36 * faceLen;
  const rows = {
    chin: chinRow, mouth: f.mouth[1], nose: f.nose[1], eye: ey, brow: browRow,
    hairline: lerp(top, browRow, 0.62), upper: lerp(top, browRow, 0.3), nearTop: lerp(top, browRow, 0.09), top,
  };
  const Y = (py) => P.chinY + (chinRow - py) * k;
  const X = (px) => (px - fx) * k;
  const D = 0.42 * P.headH, z0 = P.headC.z;
  const cheekW = cheek * k;
  const hairRing = (row, skull, zf, zb) => {
    const [l, r] = ph.span(row, fx);
    let hw = Math.max(skull * cheek, Math.min(2.0 * cheek, (r - l) / 2));
    const cx = hw > skull * cheek * 1.01 ? (l + r) / 2 : fx;
    const extra = Math.max(0, hw * k - cheekW * 1.02);
    return { row, y: Y(row), hw: hw * k, cx: X(cx), zf: z0 + zf * D + extra * 0.35, zb: z0 - zb * D - extra * 0.85, e: 2.2 };
  };
  const [el, er] = ph.span(rows.eye, fx);
  const eyeHw = clamp((er - el) / 2, cheek * 1.0, cheek * 1.18);
  const rings = [
    { row: rows.chin, y: Y(rows.chin), hw: cheek * 0.4 * k, cx: X(f.chin[0]), zf: z0 + 0.8 * D, zb: z0 + 0.12 * D, e: 2 },
    { row: rows.mouth, y: Y(rows.mouth), hw: cheek * 0.8 * k, cx: X((f.mouth[0] + fx) / 2), zf: z0 + 0.92 * D, zb: z0 - 0.45 * D, e: 2.1, bump: 0.03 * D },
    { row: rows.nose, y: Y(rows.nose), hw: cheek * 0.95 * k, cx: 0, zf: z0 + 0.92 * D, zb: z0 - 0.82 * D, e: 2.2, bump: 0.16 * D },
    { row: rows.eye, y: Y(rows.eye), hw: eyeHw * k, cx: 0, zf: z0 + 0.88 * D, zb: z0 - 1.0 * D, e: 2.3, bump: 0.05 * D },
    hairRing(rows.brow, 0.96, 0.97, 1.02),
    hairRing(rows.hairline, 0.9, 0.88, 1.0),
    hairRing(rows.upper, 0.74, 0.62, 0.88),
    hairRing(rows.nearTop, 0.42, 0.28, 0.5),
  ];
  const topY = Y(top);
  const maxHw = Math.max(...rings.map((r) => r.hw / k + Math.abs(r.cx / k)));
  const crop = { x0: fx - maxHw * 1.1, y0: top - 0.012, x1: fx + maxHw * 1.1, y1: chinRow + 0.035 };
  crop.w = crop.x1 - crop.x0; crop.h = crop.y1 - crop.y0;
  const t = (row) => (chinRow - row) / (chinRow - top);
  return {
    k, fx, cheek, rows, rings, topY, crop, z0, D,
    pole: { y: topY, z: z0 - 0.12 * D, x: rings[rings.length - 1].cx },
    t: { eye: t(rows.eye), nose: t(rows.nose), mouth: t(rows.mouth), brow: t(rows.brow), hairline: t(rows.hairline) },
    toPhoto: (p) => [fx + p.x / k, chinRow - (p.y - P.chinY) / k],
  };
}

// colores medidos en la foto
export function photoColors(ph, hm) {
  const { fx, cheek, rows } = hm;
  const skinA = ph.median(fx - 0.62 * cheek, rows.nose - 0.02, fx - 0.42 * cheek, rows.nose + 0.02);
  const skinB = ph.median(fx + 0.42 * cheek, rows.nose - 0.02, fx + 0.62 * cheek, rows.nose + 0.02);
  const sk = skinA && skinB ? skinA.map((v, i) => (v + skinB[i]) / 2) : skinA || skinB || [214, 160, 128];
  const [l, r] = ph.span(rows.upper, fx);
  const hair = ph.median(lerp(l, r, 0.3), rows.nearTop + 0.005, lerp(l, r, 0.7), rows.hairline - 0.01) || [40, 32, 30];
  return { skin: sk, hair, hairSpan: [l, r] };
}
