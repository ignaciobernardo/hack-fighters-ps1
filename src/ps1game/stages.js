// Registro de escenarios (se construyen una vez y quedan en caché).
import { buildCasa } from './stage-casa.js';
import { buildMut } from './stage-mut.js';
import { buildBuk } from './stage-buk.js';

export const STAGE_IDS = ['mut', 'buk', 'casa'];
const BUILD = { casa: buildCasa, mut: buildMut, buk: buildBuk };
const cache = new Map();

export function getStage(id, tod = 'day') {
  const key = id + ':' + tod;
  if (!cache.has(key)) cache.set(key, BUILD[id]({ tod }));
  return cache.get(key);
}
