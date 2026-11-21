// Golpes del juego PS1 (cuadros a 60 Hz) y las poses de cada estado.
// Botones del gabinete: 1 golpe · 2 golpe fuerte · 3 especial · 4 patada · 5 patada alta · 6 dash.
// Con el joystick: abajo + botón = versión baja; en el aire = versión aérea.
import { POSES, blend, add } from '../gen/poses.js';

// height: high (pasa sobre el agachado) · mid · low (bloqueo agachado) · over (bloqueo de pie)
// tier: 1 liviano, 2 fuerte, 3 especial (un golpe que conecta se puede cancelar en uno de nivel mayor)
export const MOVES = {
  // de pie
  jab:      { pose: 'jab',      startup: 4, active: 3, recover: 8,  dmg: 40, reach: 1.0,  height: 'high', hitstun: 15, blockstun: 9,  push: 1.5, tier: 1, label: 'GOLPE' },
  straight: { pose: 'straight', startup: 7, active: 4, recover: 14, dmg: 76, reach: 1.22, height: 'high', hitstun: 20, blockstun: 12, push: 2.4, tier: 2, heavy: true, label: 'DIRECTO' },
  kick:     { pose: 'kick',     startup: 6, active: 4, recover: 12, dmg: 58, reach: 1.28, height: 'mid',  hitstun: 17, blockstun: 11, push: 2.0, tier: 1, label: 'PATADA' },
  highkick: { pose: 'highkick', startup: 9, active: 5, recover: 17, dmg: 92, reach: 1.42, height: 'high', hitstun: 22, blockstun: 13, push: 2.8, tier: 2, heavy: true, antiAir: true, label: 'PATADA ALTA' },
  // agachado
  cjab:     { pose: 'cjab',     startup: 4, active: 3, recover: 8,  dmg: 34, reach: 0.95, height: 'mid',  hitstun: 14, blockstun: 8,  push: 1.3, tier: 1, crouch: true, label: 'GOLPE BAJO' },
  uppercut: { pose: 'uppercut', startup: 6, active: 5, recover: 20, dmg: 84, reach: 0.95, height: 'mid',  hitstun: 0,  blockstun: 13, push: 1.2, tier: 2, crouch: true, rising: true, launch: true, antiAir: true, heavy: true, label: 'GANCHO' },
  lowkick:  { pose: 'lowkick',  startup: 5, active: 3, recover: 10, dmg: 38, reach: 1.18, height: 'low',  hitstun: 14, blockstun: 9,  push: 1.4, tier: 1, crouch: true, label: 'PATADA BAJA' },
  sweep:    { pose: 'sweep',    startup: 8, active: 4, recover: 20, dmg: 66, reach: 1.48, height: 'low',  hitstun: 0,  blockstun: 13, push: 1.8, tier: 2, crouch: true, knock: true, heavy: true, label: 'BARRIDA' },
  // en el aire (bloqueo de pie)
  airpunch: { pose: 'airpunch', startup: 3, active: 30, recover: 0, dmg: 46, reach: 0.95, height: 'over', hitstun: 16, blockstun: 10, push: 1.6, tier: 1, air: true, label: 'GOLPE AÉREO' },
  airheavy: { pose: 'airheavy', startup: 6, active: 30, recover: 0, dmg: 78, reach: 1.0,  height: 'over', hitstun: 20, blockstun: 12, push: 2.0, tier: 2, air: true, heavy: true, label: 'MARTILLO' },
  air:      { pose: 'air',      startup: 4, active: 40, recover: 0, dmg: 62, reach: 1.1,  height: 'over', hitstun: 18, blockstun: 11, push: 1.9, tier: 1, air: true, label: 'PATADA AÉREA' },
  divekick: { pose: 'divekick', startup: 5, active: 60, recover: 0, dmg: 70, reach: 0.95, height: 'over', hitstun: 18, blockstun: 12, push: 2.2, tier: 2, air: true, dive: true, heavy: true, label: 'PICADA' },
  // ataque de empresa (botón 3): la pose depende del tipo
  sig:      { pose: 'shot',     startup: 12, active: 1, recover: 24, spawn: true, tier: 3 },
  shot:     { pose: 'shot',     startup: 10, active: 1, recover: 22, spawn: true, tier: 3 },
  dash:     { pose: 'charge',   startup: 7, active: 16, recover: 18, dmg: 108, reach: 0.9, height: 'mid', hitstun: 0, blockstun: 15, push: 3.2, move: 8.6, knock: true, heavy: true, tier: 3 },
  rise:     { pose: 'rise',     startup: 3, active: 12, recover: 26, dmg: 100, reach: 0.95, height: 'mid', hitstun: 0, blockstun: 13, push: 1.2, launch: true, invuln: 7, vy: 9.6, heavy: true, tier: 3, antiAir: true },
};

// botón + estado → golpe
export function moveFor(btn, f, down) {
  if (f.airborne || f.state === 'jump' || f.state === 'airdash') return { p1: 'airpunch', p2: 'airheavy', k1: 'air', k2: 'divekick' }[btn];
  if (down) return { p1: 'cjab', p2: 'uppercut', k1: 'lowkick', k2: 'sweep' }[btn];
  return { p1: 'jab', p2: 'straight', k1: 'kick', k2: 'highkick' }[btn];
}

// ---- poses ----
// poses base (copia propia de las del juego cel v1, para no depender de sus cambios)
const BASE = {
  stance: POSES.stance, kick: POSES.kick, win: POSES.win,
  crouch: {
    drop: 0.27, shift: [0, 0.02],
    feet: { L: [0.13, 0.2, 18], R: [-0.16, -0.16, -55] },
    hips: [22, -40, 0], spine: [12, 8, 0], chest: [8, 12, 0], neck: [0, -4, 0], head: [-14, -8, 0],
    hands: { L: [0.06, 0.48, 0.32, 150], R: [-0.13, 0.42, 0.2, 150] },
  },
  jab: {
    drop: 0.08, shift: [0, 0.04],
    feet: { L: [0.1, 0.22, 14], R: [-0.13, -0.2, -62] },
    hips: [8, -28, 0], spine: [8, 4, 0], chest: [6, 2, 0], neck: [0, 6, 0], head: [-8, 4, 0],
    hands: { L: [0.06, 0.72, 0.62, 90], R: [-0.16, 0.62, 0.16, 150] },
  },
  cjab: {
    drop: 0.27, shift: [0, 0.04],
    feet: { L: [0.13, 0.22, 18], R: [-0.16, -0.16, -55] },
    hips: [22, -28, 0], spine: [12, 4, 0], chest: [8, 4, 0], neck: [0, 4, 0], head: [-14, 0, 0],
    hands: { L: [0.06, 0.5, 0.6, 90], R: [-0.13, 0.42, 0.18, 150] },
  },
  sweep: {
    drop: 0.34, shift: [0, -0.04],
    feet: { L: [0.2, 0.5, 70, 0.0, -10], R: [-0.13, -0.08, -40] },
    hips: [30, 25, 0], spine: [10, 10, 0], chest: [6, 10, 0], neck: [0, -20, 0], head: [-10, -20, 0],
    hands: { L: [0.2, 0.3, 0.2, 150], R: [-0.2, 0.18, -0.02, 60] },
  },
  jump: {
    feet: { L: [0.1, 0.12, 14, 0.14], R: [-0.12, -0.04, -40, 0.2] },
    hips: [10, -30, 0], spine: [8, 8, 0], chest: [6, 10, 0], head: [-6, -6, 0],
    hands: { L: [0.06, 0.74, 0.3, 150], R: [-0.15, 0.66, 0.16, 150] },
  },
  air: {
    feet: { L: [0.08, 0.5, 30, 0.2, -30], R: [-0.12, -0.04, -40, 0.2] },
    hips: [-12, 20, 0], spine: [-6, 10, 0], chest: [-4, 10, 0], neck: [6, -14, 0], head: [4, -16, 0],
    hands: { L: [0.16, 0.72, -0.02, 150], R: [-0.18, 0.7, 0.1, 150] },
  },
  block: {
    drop: 0.1, shift: [0, -0.04],
    feet: { L: [0.1, 0.18, 14], R: [-0.14, -0.22, -62] },
    hips: [0, -40, 0], spine: [-4, 8, 0], chest: [-2, 16, 0], neck: [0, -6, 0], head: [-16, -10, 0],
    hands: { L: [0.04, 0.84, 0.22, 175], R: [-0.07, 0.8, 0.2, 175] },
  },
  cblock: {
    drop: 0.28, shift: [0, -0.03],
    feet: { L: [0.13, 0.18, 18], R: [-0.16, -0.18, -55] },
    hips: [18, -40, 0], spine: [8, 8, 0], chest: [4, 16, 0], head: [-22, -10, 0],
    hands: { L: [0.04, 0.56, 0.24, 175], R: [-0.07, 0.52, 0.2, 175] },
  },
  hit: {
    drop: 0.06, shift: [0, -0.06],
    feet: { L: [0.1, 0.16, 14], R: [-0.13, -0.24, -62] },
    hips: [-6, -46, 4], spine: [-14, 0, 0], chest: [-16, 6, 0], neck: [-8, 0, 0], head: [-22, 10, 8],
    hands: { L: [0.16, 0.6, 0.12, 120], R: [-0.2, 0.55, 0.0, 120] },
  },
  fall: {
    feet: { L: [0.1, 0.3, 20, 0.22, -40], R: [-0.12, 0.22, -20, 0.12, -30] },
    hips: [-40, -20, 0], spine: [-14, 0, 0], chest: [-10, 0, 0], neck: [-10, 0, 0], head: [-18, 0, 0],
    arm: [0, 30, -20], fore: [0, -30, 0],
  },
  down: {
    drop: 0.44,
    feet: { L: [0.12, 0.44, 30, 0.0, 70], R: [-0.13, 0.38, -20, 0.0, 70] },
    hips: [-84, -10, 0], spine: [-4, 0, 0], chest: [-2, 0, 0], neck: [14, 0, 0], head: [16, 20, 0],
    arm: [0, 0, -55], fore: [0, -40, 0],
  },
  shot: {
    drop: 0.1, shift: [0, 0.06],
    feet: { L: [0.11, 0.26, 16], R: [-0.14, -0.22, -62] },
    hips: [10, 0, 0], spine: [8, 6, 0], chest: [6, 8, 0], neck: [0, -2, 0], head: [-6, -4, 0],
    hands: { L: [0.06, 0.66, 0.56, 70], R: [-0.02, 0.6, 0.52, 110] },
  },
  dash: {
    drop: 0.12, shift: [0, 0.1],
    feet: { L: [0.1, 0.3, 14], R: [-0.13, -0.26, -50] },
    hips: [26, 10, 0], spine: [14, 14, 0], chest: [10, 16, 0], neck: [-10, -14, 0], head: [-14, -12, 0],
    hands: { L: [0.1, 0.58, 0.3, 150], R: [-0.1, 0.62, 0.22, 150] },
  },
  rise: {
    drop: 0.0, shift: [0, 0.04],
    feet: { L: [0.1, 0.14, 14, 0.08], R: [-0.12, -0.1, -40, 0.16] },
    hips: [-6, 26, 0], spine: [-10, 14, 0], chest: [-12, 20, 0], neck: [-14, -10, 0], head: [-18, -16, 0],
    hands: { L: [0.14, 0.6, 0.12, 150], R: [-0.02, 1.16, 0.26, 120] },
  },
  lose: {
    drop: 0.03,
    feet: { L: [0.08, 0.04, 10], R: [-0.09, -0.04, -14] },
    hips: [6, -10, 0], spine: [10, 0, 0], chest: [12, 0, 0], neck: [10, 0, 0], head: [22, 0, 6],
    arm: [0, -4, -80], fore: [0, -10, 0],
  },
};
const S = POSES.stance;
export const P = {
  ...BASE,
  straight: {
    drop: 0.09, shift: [0, 0.1],
    feet: { L: [0.1, 0.3, 8], R: [-0.13, -0.24, -50, 0.012, 24] },
    hips: [12, 30, 0], spine: [10, 16, 0], chest: [6, 26, 0], neck: [0, -28, 0], head: [-6, -28, 0],
    hands: { L: [0.16, 0.7, 0.08, 150], R: [-0.02, 0.76, 0.64, 80] },
    elbow: { R: [-0.6, -0.6, -0.4] },
  },
  highkick: {
    drop: 0.0, shift: [0, -0.07],
    feet: { R: [-0.06, -0.1, -58] },
    hips: [-26, -74, 12], spine: [-12, 12, 0], chest: [-6, 24, 0], neck: [8, 22, 0], head: [4, 26, 0],
    thighL: [-146, 24, 14], shinL: [14, 0, 0], footL: [34, 0, 0],
    hands: { L: [0.22, 0.74, -0.08, 150], R: [-0.14, 0.82, 0.04, 150] },
  },
  uppercut: {
    drop: 0.02, shift: [0, 0.05],
    feet: { L: [0.1, 0.18, 14, 0.04], R: [-0.12, -0.12, -40, 0.06] },
    hips: [-6, 26, 0], spine: [-10, 14, 0], chest: [-12, 22, 0], neck: [-14, -10, 0], head: [-18, -16, 0],
    hands: { L: [0.14, 0.62, 0.12, 150], R: [-0.02, 1.14, 0.3, 120] },
  },
  lowkick: {
    drop: 0.3, shift: [0, -0.02],
    feet: { L: [0.16, 0.52, 40, 0.02, -24], R: [-0.15, -0.14, -55] },
    hips: [24, -6, 0], spine: [12, 6, 0], chest: [8, 8, 0], neck: [0, -6, 0], head: [-12, -6, 0],
    hands: { L: [0.08, 0.5, 0.3, 150], R: [-0.13, 0.44, 0.18, 150] },
  },
  airpunch: {
    feet: { L: [0.1, 0.14, 14, 0.16], R: [-0.12, -0.06, -40, 0.24] },
    hips: [6, 10, 0], spine: [12, 12, 0], chest: [8, 16, 0], neck: [0, -16, 0], head: [-4, -16, 0],
    hands: { L: [0.08, 0.6, 0.62, 80], R: [-0.15, 0.66, 0.14, 150] },
  },
  airheavy: {
    feet: { L: [0.1, 0.18, 14, 0.2], R: [-0.12, -0.02, -40, 0.26] },
    hips: [10, 0, 0], spine: [22, 0, 0], chest: [16, 0, 0], neck: [-6, 0, 0], head: [-10, 0, 0],
    hands: { L: [0.06, 0.5, 0.56, 110], R: [-0.04, 0.52, 0.56, 110] },
  },
  divekick: {
    feet: { L: [0.06, 0.46, 30, 0.0, -56], R: [-0.12, -0.06, -40, 0.32] },
    hips: [-34, 22, 0], spine: [8, 10, 0], chest: [6, 10, 0], neck: [8, -14, 0], head: [-8, -18, 0],
    hands: { L: [0.18, 0.78, -0.02, 150], R: [-0.2, 0.74, 0.08, 150] },
  },
  charge: BASE.dash,
  phone: {
    drop: 0.04, shift: [0, -0.02],
    feet: { L: [0.1, 0.14, 14], R: [-0.12, -0.14, -50] },
    hips: [0, -30, 0], spine: [2, 6, 0], chest: [2, 10, 0], neck: [10, -6, 0], head: [14, -8, 0],
    hands: { L: [0.06, 0.8, 0.36, 90], R: [-0.04, 0.72, 0.34, 120] },
  },
  toss: {
    drop: 0.06, shift: [0, 0.03],
    feet: { L: [0.1, 0.24, 14], R: [-0.13, -0.2, -55] },
    hips: [-4, 10, 0], spine: [-8, 10, 0], chest: [-8, 14, 0], neck: [-6, -10, 0], head: [-10, -12, 0],
    hands: { L: [0.14, 0.62, 0.2, 150], R: [-0.06, 1.12, 0.3, 100] },
  },
  point: {
    drop: 0.08, shift: [0, 0.05],
    feet: { L: [0.1, 0.24, 14], R: [-0.13, -0.22, -60] },
    hips: [8, -10, 0], spine: [8, 6, 0], chest: [6, 8, 0], neck: [0, -4, 0], head: [-6, -6, 0],
    hands: { L: [0.06, 0.74, 0.66, 90], R: [-0.16, 0.6, 0.14, 150] },
  },
  run: {
    drop: 0.11, shift: [0, 0.12],
    feet: { L: [0.1, 0.36, 14, 0.07], R: [-0.13, -0.32, -50] },
    hips: [26, 6, 0], spine: [18, 8, 0], chest: [10, 10, 0], neck: [-10, -8, 0], head: [-14, -8, 0],
    hands: { L: [0.12, 0.6, 0.16, 150], R: [-0.16, 0.56, -0.06, 150] },
  },
  backdash: {
    drop: 0.05, shift: [0, -0.1],
    feet: { L: [0.1, 0.08, 14, 0.1], R: [-0.13, -0.32, -62, 0.04] },
    hips: [-14, -36, 0], spine: [-10, 8, 0], chest: [-6, 12, 0], neck: [6, -4, 0], head: [-4, -8, 0],
    hands: { L: [0.06, 0.78, 0.26, 160], R: [-0.12, 0.72, 0.18, 160] },
  },
};

const breathe = (base, t, amt = 1) => {
  const s = Math.sin(t * 3.2);
  return add(base, { spine: [1.6 * s, 0, 0], chest: [1.8 * s, 0, 0], head: [-2.2 * s, 0, 0], drop: 0.008 * s }, amt);
};
const ease = (k) => 1 - (1 - k) * (1 - k);

function walk(f, base) {
  const ph = f.walkPhase, s = 0.08, d = f.walkDir;
  const sn = Math.sin(ph), cs = Math.cos(ph);
  const b = structuredClone(base);
  const fl = b.feet.L, fr = b.feet.R;
  b.feet = {
    L: [fl[0] + d[0] * s * sn, fl[1] + d[1] * s * sn, fl[2], Math.max(0, cs) * 0.045],
    R: [fr[0] - d[0] * s * sn, fr[1] - d[1] * s * sn, fr[2], Math.max(0, -cs) * 0.045],
  };
  b.drop = (b.drop ?? 0) + 0.012 * Math.abs(Math.sin(ph * 2)) - 0.006;
  return b;
}

export function poseOf(f) {
  const t = f.t, sec = f.clock / 60;
  switch (f.state) {
    case 'idle': return f.walking ? walk(f, breathe(S, sec)) : breathe(S, sec);
    case 'crouch': return breathe(P.crouch, sec, 0.5);
    case 'jump': return P.jump;
    case 'land': return blend(P.crouch, S, Math.min(1, t / 4));
    case 'dash': return t < 3 ? blend(S, P.run, t / 3) : P.run;
    case 'backdash': return t < 3 ? blend(S, P.backdash, t / 3) : t > 12 ? blend(P.backdash, S, (t - 12) / 5) : P.backdash;
    case 'airdash': return f.dashDir > 0 ? blend(P.jump, P.run, 0.7) : blend(P.jump, P.backdash, 0.7);
    case 'attack': {
      const m = f.move;
      const base = m.crouch ? P.crouch : m.air ? P.jump : S;
      const pose = P[m.pose];
      if (t < m.startup) return blend(base, pose, ease((t + 1) / m.startup));
      if (t < m.startup + m.active) return pose;
      return blend(pose, base, Math.min(1, (t - m.startup - m.active) / Math.max(1, m.recover)));
    }
    case 'hit': return blend(P.hit, f.crouching ? P.crouch : S, Math.max(0, (t - 3) / Math.max(1, f.stun)));
    case 'block': return f.crouching ? P.cblock : P.block;
    case 'fall': return P.fall;
    case 'down': case 'ko': return P.down;
    case 'getup': return blend(P.down, S, ease(Math.min(1, t / 13)));
    case 'win': return breathe(P.win, sec, 0.4);
    case 'lose': return breathe(P.lose, sec, 0.4);
    default: return breathe(S, sec);
  }
}
