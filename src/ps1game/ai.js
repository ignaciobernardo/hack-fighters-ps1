// CPU para el juego PS1: se acerca con dash, mezcla golpes altos/medios/bajos, salta con
// patadas aéreas o en picada, encadena cuando conecta, bloquea con reacción y anti-aéreos.
export class CPU {
  constructor(level = 0.6) { this.level = level; this.hold = null; this.holdT = 0; this.wait = 20; this.blockRoll = null; this.react = 0; this.plan = null; }

  poll(me, opp, game) {
    const out = { left: false, right: false, up: false, down: false, pressed: {}, dashTap: 0 };
    if (!game.fighting) return out;
    const fwd = me.facing > 0 ? 'right' : 'left', back = me.facing > 0 ? 'left' : 'right';
    const dist = Math.abs(opp.x - me.x);
    const L = this.level, r = Math.random();

    // seguir un combo que conectó
    if (me.state === 'attack' && (me.hasHit || me.blocked) && Math.random() < 0.25 + L * 0.5) {
      const n = me.move.name;
      const next = { jab: 'p2', cjab: 'k1', kick: 'k2', lowkick: 'k2', straight: 's', highkick: 's', airpunch: 'k1', air: 'p2' }[n];
      if (next) { out.pressed[next] = true; if (n === 'cjab' || n === 'lowkick') out.down = true; return out; }
    }
    // plan de salto: patada al bajar
    if (this.plan === 'jumpin' && (me.state === 'jump' || me.state === 'airdash')) {
      if (me.vy < 1.5 && dist < 1.9) { out.pressed[Math.random() < 0.5 ? 'k1' : (Math.random() < 0.5 ? 'k2' : 'p2')] = true; this.plan = null; }
      return out;
    }
    if (me.grounded && this.plan === 'jumpin' && me.state !== 'jump') this.plan = null;

    // amenaza: golpe que viene o proyectil
    const oppAtk = opp.state === 'attack' && opp.phase() !== 'recover' && dist < (opp.move?.reach ?? 1) * opp.k + 0.8;
    const shot = game.threat(me);
    if (oppAtk || shot) {
      if (this.blockRoll === null) { this.blockRoll = Math.random() < L * 0.85; this.react = Math.round(7 - L * 5); }
      if (this.react-- <= 0) {
        if (shot && !oppAtk && (shot.kind === 'trap' || shot.kind === 'drive') && Math.random() < 0.1 + L * 0.25) { out.up = true; out[fwd] = true; return out; }
        if (shot && !oppAtk && (shot.kind === 'fall' || shot.kind === 'lob') && Math.random() < 0.3) { out.pressed.dash = true; out[Math.random() < 0.5 ? fwd : back] = true; return out; }
        if (shot && !oppAtk && Math.random() < 0.03 + L * 0.04) { out.up = true; out[fwd] = true; return out; }
        if (this.blockRoll) {
          out[back] = true;
          if (opp.move?.height === 'low' || (opp.crouching && !opp.move?.air)) out.down = true;
          if (Math.random() < L * 0.04) { out.pressed.dash = true; }
          return out;
        }
      }
    } else this.blockRoll = null;

    // anti-aéreo
    if (opp.airborne && opp.vy < 2 && dist < 1.8 && Math.random() < L * 0.3) {
      if (Math.random() < 0.55) { out.down = true; out.pressed.p2 = true; }
      else out.pressed.k2 = true;
      return out;
    }

    if (this.holdT > 0) { this.holdT--; Object.assign(out, this.hold); return out; }
    if (--this.wait > 0) return out;
    this.wait = Math.round(4 + Math.random() * (20 - L * 14));

    const can = game.canCast(me);
    if (dist > 3.0) {
      if (can && r < 0.5) out.pressed.s = true;
      else if (r < 0.55) out.pressed.dash = true;
      else if (r < 0.7) { out.up = true; out[fwd] = true; this.plan = 'jumpin'; }
      else this.walk(fwd, 14);
    } else if (dist > 1.45) {
      if (can && r < 0.35) out.pressed.s = true;
      else if (r < 0.3) { out.pressed.dash = true; this.hold = { pressed: {} }; }
      else if (r < 0.45) out.pressed.k2 = true;
      else if (r < 0.55) out.pressed.k1 = true;
      else if (r < 0.7) { out.up = true; out[fwd] = true; this.plan = 'jumpin'; }
      else if (r < 0.8) { out.down = true; out.pressed.k2 = true; }
      else if (r < 0.88) this.walk(back, 10);
      else this.walk(fwd, 10);
    } else {
      if (r < 0.22) out.pressed.p1 = true;
      else if (r < 0.38) { out.down = true; out.pressed.k1 = true; }
      else if (r < 0.5) { out.down = true; out.pressed.p1 = true; }
      else if (r < 0.6) out.pressed.k1 = true;
      else if (r < 0.68) { out.down = true; out.pressed.k2 = true; }
      else if (r < 0.74) out.pressed.p2 = true;
      else if (r < 0.88) { out[back] = true; out.pressed.dash = true; }
      else { this.hold = { down: true, [back]: true }; this.holdT = 16; }
    }
    return out;
  }

  walk(dir, n) { this.hold = { [dir]: true }; this.holdT = n; }
}
