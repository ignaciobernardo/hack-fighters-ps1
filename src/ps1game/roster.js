// Todos los jugadores de la hack: ficha (ropa/cuerpo), datos (empresa) y ataque de empresa.
import PEOPLE_RAW from '../../data/people.json';
import { firmaFor } from './firmas.js';

const made = import.meta.glob('../../characters/*.json', { eager: true });
const drafts = import.meta.glob('../../characters/drafts/*.json', { eager: true });
export const SPECS = {};
for (const m of [...Object.values(drafts), ...Object.values(made)]) {
  const s = structuredClone(m.default);
  const slug = (s.photo || s.id + '.png').replace(/\.png$/, '');
  SPECS[slug] = { ...s, id: slug };
}
export const PEOPLE = PEOPLE_RAW.filter((p) => SPECS[p.id]);
export const IDS = PEOPLE.map((p) => p.id);
export const BY_ID = Object.fromEntries(PEOPLE.map((p) => [p.id, p]));
export const THUMB = { size: 32, cols: 16 };

// stats según el cuerpo de la ficha (más macizo = más lento, pega más, aguanta más)
export const FIGHTERS = {};
for (const p of PEOPLE) {
  const b = SPECS[p.id].body || {}, k = Math.max(0, Math.min(1, b.build ?? 0.5));
  FIGHTERS[p.id] = {
    short: p.short, name: p.name, company: p.company, cargo: p.cargo, role: p.role,
    speed: +(1.14 - k * 0.26).toFixed(2), power: +(0.9 + k * 0.24).toFixed(2), hp: Math.round(1200 + k * 260),
    special: firmaFor(p.company),
  };
}
