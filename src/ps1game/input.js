// Controles del gabinete Platanus Arcade: joystick + 6 botones + START por jugador.
// Mismas teclas que manda el gabinete (CABINET_KEYS del repo del arcade; no cambiarlas,
// solo se pueden agregar atajos al final de cada lista).
export const CABINET_KEYS = {
  P1_U: ['w'], P1_D: ['s'], P1_L: ['a'], P1_R: ['d'],
  P1_1: ['u'], P1_2: ['i'], P1_3: ['o'],
  P1_4: ['j'], P1_5: ['k'], P1_6: ['l'],
  P2_U: ['ArrowUp'], P2_D: ['ArrowDown'], P2_L: ['ArrowLeft'], P2_R: ['ArrowRight'],
  P2_1: ['r'], P2_2: ['t'], P2_3: ['y'],
  P2_4: ['f'], P2_5: ['g'], P2_6: ['h'],
  START1: ['Enter', 'Escape'], START2: ['2'],   // Escape: atajo local para pausar
};
// qué hace cada botón en la pelea (fila de arriba golpes, fila de abajo patadas)
export const BUTTONS = { 1: 'p1', 2: 'p2', 3: 's', 4: 'k1', 5: 'k2', 6: 'dash' };

const keyToCodes = new Map();
for (const [code, keys] of Object.entries(CABINET_KEYS)) for (const k of keys) {
  const kk = k.length === 1 ? k.toLowerCase() : k;
  if (!keyToCodes.has(kk)) keyToCodes.set(kk, []);
  keyToCodes.get(kk).push(code);
}
const held = new Set(), taps = new Set();
const norm = (e) => (e.key.length === 1 ? e.key.toLowerCase() : e.key);
addEventListener('keydown', (e) => {
  const codes = keyToCodes.get(norm(e));
  if (codes || e.key === 'Escape' || e.key === ' ') e.preventDefault();
  if (e.repeat || !codes) return;
  for (const c of codes) { held.add(c); taps.add(c); }
});
addEventListener('keyup', (e) => { const codes = keyToCodes.get(norm(e)); if (codes) for (const c of codes) held.delete(c); });
addEventListener('blur', () => held.clear());

// mando estándar como respaldo: cruceta/stick, X Y = golpes, A B = patadas, RB especial, LB/RT dash
function pad(i) {
  const gp = navigator.getGamepads?.()[i];
  if (!gp) return null;
  const b = (n) => !!gp.buttons[n]?.pressed, ax = gp.axes[0] ?? 0, ay = gp.axes[1] ?? 0;
  return { left: b(14) || ax < -0.5, right: b(15) || ax > 0.5, up: b(12) || ay < -0.6, down: b(13) || ay > 0.6, p1: b(2), p2: b(3), k1: b(0), k2: b(1), s: b(5), dash: b(4) || b(7), start: b(9) };
}

const DIRS = { left: 'L', right: 'R', up: 'U', down: 'D' };
export class Input {
  constructor(player) { this.n = player; this.prevPad = {}; this.lastTap = { left: -99, right: -99 }; this.frame = 0; }
  // devuelve { left, right, up, down, p1, p2, s, k1, k2, dash, start, pressed: {...}, dashTap: -1|0|1 (izq/der) }
  poll() {
    this.frame++;
    const n = this.n, out = { pressed: {}, dashTap: 0 };
    for (const [a, d] of Object.entries(DIRS)) { out[a] = held.has(`P${n}_${d}`); out.pressed[a] = taps.has(`P${n}_${d}`); }
    for (const [b, a] of Object.entries(BUTTONS)) { out[a] = held.has(`P${n}_${b}`); out.pressed[a] = taps.has(`P${n}_${b}`); }
    out.start = held.has(`START${n}`); out.pressed.start = taps.has(`START${n}`);
    const gp = pad(n - 1);
    if (gp) for (const a of Object.keys(gp)) { if (gp[a]) out[a] = true; if (gp[a] && !this.prevPad[a]) out.pressed[a] = true; }
    this.prevPad = gp || {};
    // doble toque izquierda/derecha = dash
    for (const a of ['left', 'right']) if (out.pressed[a]) {
      if (this.frame - this.lastTap[a] <= 13) { out.dashTap = a === 'left' ? -1 : 1; this.lastTap[a] = -99; }
      else this.lastTap[a] = this.frame;
    }
    // aliases para menús
    out.pressed.ok = out.pressed.p1 || out.pressed.k1 || out.pressed.start;
    out.pressed.back = out.pressed.p2 || out.pressed.k2;
    return out;
  }
}

export function tapped(code) { return taps.has(code); }
export function anyTap() { return taps.size > 0; }
export function endFrame() { taps.clear(); }
