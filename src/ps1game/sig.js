// Motor de los ataques de empresa: lluvias, ráfagas, tiros en parábola, trampas y cosas
// que cruzan el suelo. Cada cosa en vuelo es un "item" con su objeto low-poly.
import { makeProp } from './props.js';

const DT = 1 / 60;
const pick = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);

export class Sigs {
  constructor(scene, game) { this.scene = scene; this.game = game; this.items = []; this.queue = []; this.frame = 0; }

  busy(f) { return this.items.some((i) => i.owner === f && i.kind !== 'puff') || this.queue.some((q) => q.owner === f); }
  clear() { for (const i of this.items) this.scene.remove(i.mesh); this.items = []; this.queue = []; }

  spawn(owner, prop, po, o) {
    const mesh = makeProp(prop, po || {});
    mesh.scale.setScalar(o.scale ?? 1.3);
    const it = { owner, mesh, t: 0, alive: true, hit: false, spin: [0, 0, 0], ...o };
    mesh.position.set(it.x, it.y, owner.z + (it.dz ?? 0.1));
    this.scene.add(mesh); this.items.push(it);
    return it;
  }
  later(owner, delay, fn) { this.queue.push({ owner, at: this.frame + delay, fn }); }

  puff(f, sig, po, x, y) {
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; this.spawn(f, pick(sig.prop, i), po, { kind: 'puff', x, y, vx: Math.cos(a) * 3.2, vy: Math.sin(a) * 3.2 + 1, life: 18, scale: 0.9, spin: [4, 4, 6] }); }
    this.game.sparkAt(x, y, f.z, true, true);
  }

  rainOn(f, opp, sig, prop, po, n, lying = false) {
    for (let i = 0; i < n; i++) this.later(f, i * 6, () => {
      const p = pick(prop, i + Math.floor(Math.random() * 3));
      const ppo = p === 'bubble' ? { text: pick(sig.texts, i), color: sig.color, fg: sig.fg } : po;
      this.spawn(f, p, ppo, {
        kind: 'fall', x: opp.x + (Math.random() - 0.5) * 1.3 + opp.vx * 0.25, y: f.floorY + 4.6 + Math.random() * 0.6, vx: 0, vy: -5.5 - Math.random() * 2,
        dmg: 26, spin: p === 'bubble' || p === 'doc' || p === 'bill' ? [0, 0, (Math.random() - 0.5) * 2] : [Math.random() * 5, Math.random() * 3, Math.random() * 5],
        scale: p === 'bubble' ? 1.5 : 1.35, r: 0.3, lying, flutter: p === 'bill' || p === 'doc' || p === 'envelope' ? 1 : 0,
      });
    });
  }

  // lanzar el ataque de f contra opp
  cast(f, opp) {
    const sig = f.data.special, po = sig.po || {}, dir = f.facing;
    const hx = f.x + dir * 0.5 * f.k, hy = f.floorY + f.y + 0.68 * f.H;
    switch (sig.kind) {
      case 'phone': case 'rain': this.rainOn(f, opp, sig, sig.prop, po, sig.n ?? 9); break;
      case 'storm': {   // cae por todo el escenario
        const n = sig.n ?? 26;
        for (let i = 0; i < n; i++) this.later(f, i * 4, () => {
          const p = pick(sig.prop, i);
          this.spawn(f, p, po, { kind: 'fall', x: opp.x + (Math.random() - 0.5) * 7.5, y: f.floorY + 4.6 + Math.random() * 1.2, vx: 0, vy: -6 - Math.random() * 2.5, dmg: 20,
            spin: p === 'doc' || p === 'bill' ? [0, 0, (Math.random() - 0.5) * 2] : [Math.random() * 5, Math.random() * 3, Math.random() * 5], scale: 1.35, r: 0.32, flutter: p === 'bill' || p === 'doc' ? 1 : 0 });
        });
        break;
      }
      case 'teleport': {  // desaparece y aparece detrás del rival con un golpe
        const B = 7, side = Math.sign(opp.x - f.x) || 1;
        this.puff(f, sig, po, f.x, f.floorY + 0.9);
        f.hidden = 9; f.invuln = Math.max(f.invuln, 16);
        this.later(f, 9, () => {
          let nx = opp.x + side * 0.85; if (Math.abs(nx) > B) nx = opp.x - side * 0.85;
          f.x = nx; f.y = 0; f.vx = 0; f.facing = opp.x >= f.x ? 1 : -1;
          this.puff(f, sig, po, f.x, f.floorY + 0.9);
          this.game.sfx('rise');
        });
        this.later(f, 14, () => {
          if (Math.abs(opp.x - f.x) < 1.35 && !opp.lying && opp.invuln <= 0) this.strike({ owner: f, vx: f.facing }, opp, { dmg: 100, heavy: true, knock: true, push: 2.6 });
        });
        break;
      }
      case 'heal': {
        for (let i = 0; i < 7; i++) this.later(f, i * 9, () => {
          f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.028));
          this.spawn(f, pick(sig.prop, i), po, { kind: 'puff', x: f.x + (Math.random() - 0.5) * 0.9, y: f.floorY + 0.4 + Math.random() * 0.6, vx: 0, vy: 2.2, life: 26, scale: 1, spin: [0, 3, 0] });
          this.game.sfx('select');
        });
        break;
      }
      case 'swing': break;   // el golpe lo da el propio luchador con el objeto en la mano
      case 'volley': {
        const n = sig.n ?? 3;
        for (let i = 0; i < n; i++) this.later(f, i * 8, () => this.spawn(f, pick(sig.prop, i), po, {
          kind: 'shot', x: f.x + dir * 0.5 * f.k, y: f.floorY + f.y + (0.5 + (i % 3) * 0.13) * f.H, vx: dir * 9.5, vy: 0, dmg: Math.round(130 / n) + 8,
          spin: [0, 0, -dir * 9], r: 0.26, scale: 1.2,
        }));
        break;
      }
      case 'throw': this.spawn(f, pick(sig.prop, 0), po, { kind: 'shot', x: hx, y: hy, vx: dir * 8.5, vy: 0, dmg: 95, heavy: true, spin: [0, 0, -dir * 10], r: 0.32, scale: 1.6 }); break;
      case 'lob': {
        const T = 44, dx = Math.max(1.2, Math.abs(opp.x - f.x)) * dir, g = 16;
        this.spawn(f, pick(sig.prop, 0), po, { kind: 'lob', x: hx, y: hy + 0.2, vx: (dx - dir * 0.5) / (T * DT), vy: (g * T * DT) / 2 + (f.floorY + 0.7 - hy) / (T * DT), g, dmg: 105, heavy: true, knock: true, spin: [0, 0, -dir * 7], r: 0.42, scale: 1.9 });
        break;
      }
      case 'slip':
        this.spawn(f, pick(sig.prop, 0), po, { kind: 'trap', x: f.x + dir * 0.6, y: f.floorY + 0.55, vx: dir * 5.2, vy: 1.5, life: 150, r: 0.3, scale: 1.3, spin: [0, 4, 0], sig });
        break;
      case 'drive':
        this.spawn(f, pick(sig.prop, 0), po, { kind: 'drive', x: f.x - dir * 0.9, y: f.floorY + 0.42, vx: dir * 9.5, vy: 0, dmg: 110, heavy: true, knock: true, r: 0.55, scale: 2.4, face: dir, roll: sig.prop === 'tire' });
        break;
    }
  }

  strike(it, d, m) {
    const o = it.owner;
    const from = Object.create(o); from.facing = Math.sign(it.vx) || o.facing;
    const hp0 = d.hp;
    const r = d.takeHit({ hitstun: 14, blockstun: 9, push: 0.7, height: 'mid', tier: 3, ...m }, from, this.game);
    if (r === 'hit') {
      o.combo = from.combo; o.comboT = 70;
      const st = it.status || o.data.special.status;
      if (st) for (const [k, v] of Object.entries(st)) d.fx[k] = Math.max(d.fx[k] || 0, v);
      if (it.drain || o.data.special.drain) o.hp = Math.min(o.maxHp, o.hp + Math.round((hp0 - d.hp) * 0.9));
    }
    return r;
  }

  update(fighters) {
    this.frame++;
    this.queue = this.queue.filter((q) => { if (q.at > this.frame) return true; q.fn(); return false; });
    for (const it of this.items) {
      it.t++;
      const d = fighters[0] === it.owner ? fighters[1] : fighters[0];
      const m = it.mesh, ground = it.owner.floorY;
      if (it.kind === 'fall') {
        it.y += it.vy * DT; it.x += Math.sin(it.t * 0.2 + it.x * 9) * 0.012 * it.flutter;
        const reach = Math.abs(it.x - d.x) < d.halfW + it.r;
        if (!it.hit && reach && it.y - ground < d.top && it.y - ground > d.y - 0.1) {
          if (d.lying || d.state === 'fall') {
            if (it.lying && d.state !== 'getup' && d.hp > 0) {
              d.hp = Math.max(0, d.hp - Math.round(it.dmg * 0.7)); this.game.sparkAt(it.x, it.y, d.z, false, false); this.game.sfx('hit');
              if (d.hp <= 0 && d.state === 'down') d.set('ko');
              it.hit = true; it.vy = 3; it.dead = 12;
            }
          } else if (d.invuln <= 0) {
            this.strike(it, d, { dmg: it.dmg, height: 'over' });
            it.hit = true; it.vy = 3.5; it.vx = (Math.random() - 0.5) * 3; it.dead = 14;
          }
        }
        if (it.dead) { it.vy -= 16 * DT; it.x += (it.vx || 0) * DT; if (--it.dead <= 0) it.alive = false; }
        if (it.y <= ground + 0.12) { if (!it.bounced && !it.dead) { it.bounced = true; it.vy = 2.6; it.dead = 16; it.hit = true; } }
      } else if (it.kind === 'shot') {
        it.x += it.vx * DT;
        if (!it.hit && !d.lying && d.invuln <= 0 && Math.abs(it.x - d.x) < d.halfW + it.r && it.y - ground < d.top + 0.1 && it.y - ground > d.y - 0.15 && !(d.crouching && it.y - ground > 0.66 * d.H)) {
          this.strike(it, d, { dmg: it.dmg, heavy: it.heavy, push: 1.2, hitstun: 16 }); it.alive = false;
        }
        if (Math.abs(it.x) > 13 || it.t > 120) it.alive = false;
      } else if (it.kind === 'lob') {
        it.vy -= it.g * DT; it.x += it.vx * DT; it.y += it.vy * DT;
        const near = Math.abs(it.x - d.x) < d.halfW + it.r && it.y - ground < d.top + 0.15 && it.y - ground > d.y - 0.2;
        if (near && !d.lying && d.invuln <= 0 && it.t > 8) { this.strike(it, d, { dmg: it.dmg, heavy: true, knock: true, height: 'over', push: 2 }); it.alive = false; }
        else if (it.y <= ground + 0.15) { this.game.sparkAt(it.x, ground + 0.3, d.z, true, true); this.game.sfx('thud'); it.alive = false; }
      } else if (it.kind === 'trap') {
        if (it.y > ground + 0.06) { it.vy -= 14 * DT; it.y = Math.max(ground + 0.06, it.y + it.vy * DT); it.x += it.vx * DT; }
        else { it.vx *= 0.955; it.x += it.vx * DT; it.spin = [0, it.vx * 2, 0]; m.rotation.x = 0; m.rotation.z = 0; }
        if (it.y <= ground + 0.07 && !d.airborne && !d.lying && d.invuln <= 0 && Math.abs(it.x - d.x) < d.halfW + it.r) {
          const r = this.strike(it, d, { dmg: 34, height: 'low', knock: true, heavy: true, push: 1 });
          it.alive = false;
          if (r === 'hit') {
            d.downT = 80; d.vy = 6.2; d.vx = -Math.sign(it.vx || 1) * 0.6;
            const s2 = it.sig, o2 = it.owner, n2 = s2.n ?? 8;
            // le cae encima… y además por todos lados
            this.rainOn(o2, d, s2, s2.then || 'bill', s2.thenPo, n2, true);
            if (s2.everywhere) for (let i = 0; i < 18; i++) this.later(o2, i * 5, () => this.spawn(o2, s2.then || 'bill', s2.thenPo || {}, { kind: 'fall', x: d.x + (Math.random() - 0.5) * 8, y: o2.floorY + 4.6 + Math.random(), vx: 0, vy: -5 - Math.random() * 2, dmg: 14, lying: true, spin: [0, 0, (Math.random() - 0.5) * 2], scale: 1.3, r: 0.3, flutter: 1 }));
          }
        }
        if (it.t > it.life || Math.abs(it.x) > 13) it.alive = false;
      } else if (it.kind === 'puff') {
        it.x += it.vx * DT; it.y += it.vy * DT; it.vy -= 6 * DT;
        m.scale.setScalar(it.scale * Math.max(0.1, 1 - it.t / it.life));
        if (it.t >= it.life) it.alive = false;
      } else if (it.kind === 'drive') {
        it.x += it.vx * DT;
        if (!it.hit && !d.lying && d.invuln <= 0 && Math.abs(it.x - d.x) < d.halfW + it.r && d.y < 0.9) { this.strike(it, d, { dmg: it.dmg, heavy: true, knock: true, push: 3 }); it.hit = true; }
        if (Math.abs(it.x - it.owner.x) > 14 || it.t > 150) it.alive = false;
      }
      m.position.x = it.x; m.position.y = it.y;
      if (it.kind === 'drive') { m.rotation.y = it.face > 0 ? 0 : Math.PI; if (it.roll) m.rotation.z = -it.face * it.t * 0.5; else m.position.y = it.y + Math.abs(Math.sin(it.t * 0.5)) * 0.04; }
      else { m.rotation.x += it.spin[0] * DT; m.rotation.y += it.spin[1] * DT; m.rotation.z += it.spin[2] * DT; }
      if (it.dead) m.visible = it.dead % 2 === 0 || it.dead > 8;
    }
    this.items = this.items.filter((i) => i.alive || (this.scene.remove(i.mesh), false));
  }
}
