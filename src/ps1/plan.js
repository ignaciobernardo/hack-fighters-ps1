// Distribución del atlas y "plan" de la ropa: qué prenda cubre qué parte del cuerpo,
// con qué holgura. Lo usan la malla (radios, escalones de los bordes) y la pintura (capas).
import { lerp } from './low.js';
import { curve } from '../gen/geo.js';

export const S = 512;
// regiones en píxeles (como un mapa UV de la época: todo el personaje en una imagen)
export const R = {
  headF: { x: 0, y: 0, w: 176, h: 192 },     // cara: la foto proyectada de frente
  headB: { x: 176, y: 0, w: 160, h: 96 },    // resto de la cabeza (u = vuelta, v = alto)
  neck: { x: 176, y: 96, w: 64, h: 32 },
  hand: { x: 240, y: 96, w: 96, h: 32 },     // dorso · palma · costados
  extra: { x: 176, y: 128, w: 160, h: 64 },  // audífonos, capucha
  arm: { x: 336, y: 0, w: 176, h: 192 },     // compartida por los dos brazos
  torso: { x: 0, y: 192, w: 256, h: 208 },
  leg: { x: 256, y: 192, w: 256, h: 320 },   // compartida, la derecha espejada
  shoeSide: { x: 0, y: 400, w: 176, h: 64 },
  shoeTop: { x: 0, y: 464, w: 176, h: 48 },
  caps: { x: 176, y: 400, w: 80, h: 112 },
};
// parches de color sólido (tapas, interiores)
export const CAP = {
  dark: [184, 408], skin: [184, 424], collar: [184, 440], crotch: [184, 456],
  hair: [184, 472], plastic: [184, 488], accent: [184, 504],
};
export const SOLE = { x: 200, y: 400, w: 56, h: 48 };
export const HAND = { back: { x: 240, y: 96, w: 32, h: 32 }, palm: { x: 272, y: 96, w: 32, h: 32 }, side: { x: 304, y: 96, w: 32, h: 32 } };
export const EXTRA = { cup: { x: 176, y: 128, w: 48, h: 32 }, cap: { x: 224, y: 128, w: 32, h: 32 }, band: { x: 176, y: 160, w: 80, h: 32 }, hood: { x: 256, y: 128, w: 80, h: 64 } };

// rangos de v de cada franja
export const TORSO_S = [-0.1, 1.16];   // s del torso (0 entrepierna, 1 base del cuello)
export const ARM_U = [-0.1, 1.0];      // hombro → muñeca
export const LEG_V = [-0.1, 1.14];     // cadera → tobillo (más allá = pantalón ancho hasta el suelo)

export const torsoV = (s) => R.torso.y + ((TORSO_S[1] - s) / (TORSO_S[1] - TORSO_S[0])) * R.torso.h;
export const armV = (uu) => R.arm.y + ((uu - ARM_U[0]) / (ARM_U[1] - ARM_U[0])) * R.arm.h;
export const legV = (vv) => R.leg.y + ((vv - LEG_V[0]) / (LEG_V[1] - LEG_V[0])) * R.leg.h;

export const ARM_R = curve([[0, 0.035, 0.037], [0.2, 0.041, 0.043], [0.5, 0.032, 0.033], [0.64, 0.036, 0.034], [1, 0.024, 0.021]]);
export const LEG_R = curve([[0, 0.064, 0.066], [0.25, 0.058, 0.062], [0.5, 0.041, 0.044], [0.66, 0.045, 0.048], [1, 0.027, 0.03]]);

export function makePlan(spec, P) {
  const u = P.H;
  const top = { type: 'tee', ...(spec.top || {}) };
  const jk = spec.jacket && spec.jacket.type && spec.jacket.type !== 'none' ? { ...spec.jacket } : null;
  const bt = { type: 'straight', ...(spec.bottom || {}) };
  const shoes = { type: 'sneaker', ...(spec.shoes || {}) };
  const hands = { type: 'bare', ...(spec.hands || {}) };
  bt.fabric = bt.fabric || { slim: 'denim', straight: 'denim', wide: 'denim', joggers: 'fleece', shorts: 'twill' }[bt.type] || 'denim';
  top.fabric = top.fabric || { tee: 'cotton', longsleeve: 'cotton', shirt: 'oxford', tank: 'knit', hoodie: 'knit' }[top.type] || 'cotton';
  if (jk) jk.fabric = jk.fabric || { fleece: 'fleece', hoodie: 'knit', vest: 'twill', coat: 'twill' }[jk.type] || 'twill';

  const waist = 0.25;
  const tuck = !!top.tuck;
  const topHem = tuck ? waist - 0.03 : lerp(0.36, 0.17, top.length ?? 0.5);
  const jHem = jk ? (jk.type === 'vest' ? lerp(0.36, 0.08, jk.length ?? 0.3) : lerp(0.3, -0.06, jk.length ?? 0.5)) : 9;
  const fitTop = lerp(0.003, 0.014, top.fit ?? 0.5) * u;
  const fitJ = jk ? fitTop + lerp(0.007, 0.022, jk.fit ?? 0.5) * u : 0;
  const fitB = (bt.type === 'wide' ? 0.011 : bt.type === 'slim' ? 0.003 : 0.007) * u;
  const belt = !!bt.belt;
  const torsoOff = (s) => {
    let o = 0;
    if (s <= waist) o = fitB + (belt && s > waist - 0.035 ? 0.0025 * u : 0);
    if (s >= topHem && !(tuck && s < waist)) o = Math.max(o, fitTop + (tuck && s < waist + 0.06 ? 0.004 * u : 0));
    if (jk && s >= jHem) o = Math.max(o, fitJ);
    return o;
  };
  // abertura delantera de la chaqueta (en u, mitad del ancho), más abierta arriba
  const openHalf = (s) => {
    if (!jk) return 0;
    const o = jk.open ?? 0.34;
    if (jk.type === 'vest') return lerp(0.004, 0.09 + o * 0.16, Math.pow(Math.max(0, (s - jHem) / (1 - jHem)), 1.25));
    return lerp(0.004, 0.012 + o * 0.08, Math.pow(Math.max(0, (s - lerp(jHem, 1, 0.45)) / (1 - lerp(jHem, 1, 0.45))), 1.5));
  };
  const layer = (s, uu) => {
    const front = Math.abs(uu - 0.5);
    if (jk && s >= jHem && s <= 1.02) {
      const inOpen = front < openHalf(s);
      const arm = jk.type === 'vest' && Math.min(Math.abs(uu - 0.25), Math.abs(uu - 0.75)) < 0.055 * Math.sqrt(Math.max(0, 1 - ((s - 0.9) / 0.17) ** 2)) && s > 0.73;
      if (!inOpen && !arm) return 'jacket';
    }
    if (belt && s <= waist && s > waist - 0.035) return 'belt';
    if (s >= topHem && !(tuck && s < waist)) return s > 1.0 ? 'collar' : 'top';
    if (s <= waist) return 'pants';
    return 'top';
  };

  // mangas: hasta dónde llega cada capa (uu ∈ [0,1] hombro → muñeca)
  const defSleeve = { tee: 'short', longsleeve: 'long', shirt: 'long', tank: 'none', hoodie: 'long' }[top.type] || 'short';
  top.sleeves = top.sleeves || defSleeve;
  const topEnd = { short: top.sleeveLen ?? 0.34, long: 0.97, rolled: 0.6, none: -0.06 }[top.sleeves] ?? 0.34;
  const jSleeves = jk ? (jk.sleeves ?? (jk.type === 'vest' ? 'none' : 'long')) : 'none';
  const jEnd = jk ? ({ long: 0.97, rolled: 0.6, short: 0.36, none: -1 }[jSleeves] ?? 0.97) : -1;
  const fitST = lerp(0.003, 0.011, top.fit ?? 0.5) * u + (top.sleeves === 'short' ? 0.004 * u : 0);
  const fitSJ = fitST + lerp(0.007, 0.014, jk?.fit ?? 0.5) * u;
  const armOff = (uu) => {
    let o = 0;
    if (uu <= topEnd) o = fitST + (top.sleeves === 'rolled' && uu > topEnd - 0.07 ? 0.005 * u : 0);
    if (jk && uu <= jEnd) o = Math.max(o, fitSJ + (jSleeves === 'rolled' && uu > jEnd - 0.07 ? 0.005 * u : 0));
    return o;
  };
  const armLayer = (uu) => (jk && uu <= jEnd ? 'jacket' : uu <= topEnd ? 'top' : 'skin');

  // piernas
  const floorVV = (P.hipJointY - 0.014 * u) / (P.hipJointY - P.ankleY);
  const pantsEnd = bt.type === 'shorts' ? lerp(0.62, 0.36, bt.length ?? 0.5)
    : bt.type === 'wide' ? floorVV : bt.type === 'straight' ? 1.04 : bt.type === 'joggers' ? 0.99 : 1.01;
  const legRad = (vv) => {
    const [a] = LEG_R(Math.min(1, vv));
    if (vv > pantsEnd + 1e-4) return a;
    switch (bt.type) {
      case 'slim': return a + 0.006;
      case 'joggers': return vv < 0.88 ? Math.max(a + 0.008, 0.05) : lerp(Math.max(LEG_R(0.88)[0] + 0.008, 0.05), 0.034, (vv - 0.88) / 0.11);
      case 'wide': return lerp(0.07, 0.079, Math.min(1, vv)) - 0.004 * Math.exp(-(((vv - 0.5) / 0.15) ** 2));
      case 'shorts': return Math.max(a + 0.012, 0.064);
      default: return Math.max(a + 0.006, lerp(0.064, 0.05, Math.min(1, vv)));
    }
  };
  const spread = bt.type === 'wide' ? 0.02 : 0;
  const sock = bt.type === 'shorts' ? (shoes.sock ?? 0) : 0;

  return {
    u, P, top, jk, bt, shoes, hands, waist, tuck, topHem, jHem, fitTop, fitJ, fitB, belt,
    torsoOff, openHalf, layer, topEnd, jEnd, jSleeves, armOff, armLayer, pantsEnd, legRad, spread, floorVV, sock,
    torsoBreaks: [waist, ...(tuck ? [] : [topHem]), ...(jk ? [jHem] : [])],
    armBreaks: [topEnd, ...(jk ? [jEnd] : [])].filter((x) => x > 0 && x < 0.995),
  };
}
