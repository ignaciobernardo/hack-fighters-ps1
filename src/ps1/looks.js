// Ropa y silueta reales de cada persona (data/people.json → look, sacado de sus fotos)
// aplicadas sobre la ficha borrador, en vez del disfraz al azar del generador.
import PEOPLE from '../../data/people.json';
const BY = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));

// correcciones a mano del largo de pelo detectado (0 = corto; número = largos de cara)
const HAIR = { 'daniel-leal': 0, 'lucas-van-sint-jan': 0, 'nicolas-alejandro-bermedo-dominguez': 0, 'josefina-hidalgo': 1.0 };

export function applyLook(spec) {
  const slug = (spec.photo || spec.id + '.png').replace(/\.png$/, '');
  const look = BY[slug]?.look;
  if (slug in HAIR) spec = { ...spec, hairLong: HAIR[slug] };
  if (!look || !spec.draft) return spec;
  const s = structuredClone(spec), t = look.top || {}, curva = look.silueta === 'curva';
  const c2 = t.color2 || '#f1efe9';
  s.prints = []; s.hands = { type: 'bare' }; s.jacket = { type: 'none' };
  const fit = curva ? 0.25 : 0.5;
  switch (t.tipo) {
    case 'camisa': s.top = { type: 'shirt', color: t.color, sleeves: t.manga === 'corta' ? 'short' : 'long', fit, length: 0.5 }; break;
    case 'sweater': s.top = { type: 'longsleeve', color: t.color, fabric: 'knit', fit, length: 0.5 }; break;
    case 'poleron': s.top = { type: 'hoodie', color: t.color, fit: fit + 0.15, length: 0.55 }; break;
    case 'chaqueta': s.top = { type: 'tee', color: c2, fit, length: 0.5 }; s.jacket = { type: 'coat', color: t.color, fit: 0.35, length: 0.32, open: 0.42, sleeves: 'long' }; break;
    case 'traje': s.top = { type: 'shirt', color: c2, fit, length: 0.5, tuck: true }; s.jacket = { type: 'coat', color: t.color, fit: 0.3, length: 0.42, open: 0.4, sleeves: 'long' }; break;
    case 'chaleco': s.top = { type: 'shirt', color: c2, fit, length: 0.5 }; s.jacket = { type: 'vest', color: t.color, fit: 0.2, length: 0.3, open: 0.3 }; break;
    default: s.top = { type: 'tee', color: t.color || '#ddd', sleeves: t.manga === 'sin' ? 'none' : t.manga === 'larga' ? 'long' : 'short', fit, length: 0.5 };
  }
  const p = look.pants || {};
  s.bottom = { type: curva ? 'slim' : 'straight', color: p.color || '#2b2f3a', fabric: p.tipo === 'jeans' ? 'denim' : 'twill' };
  const sh = look.shoes || {};
  s.shoes = { type: 'sneaker', color: sh.color || '#f1efe9', accent: sh.color || '#f1efe9', sole: sh.tipo === 'zapatillas' ? '#f4f4f0' : '#1d1d20', size: curva ? 0.95 : 1.05 };
  const b = s.body || {};
  if (curva) s.body = { ...b, height: Math.min(1.7, (b.height ?? 1.75) * 0.93), build: Math.min(0.22, b.build ?? 0.3), shoulders: 0.08, hips: 0.78, waist: 1, bust: 1 };
  else s.body = { ...b, build: look.build === 'delgado' ? 0.25 : look.build === 'ancho' ? 0.85 : b.build };
  return s;
}
