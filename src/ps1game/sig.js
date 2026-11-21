// Motor de los ataques de empresa: lluvias, ráfagas, tiros en parábola, trampas y cosas
// que cruzan el suelo. Cada cosa en vuelo es un "item" con su objeto low-poly.
import { makeProp } from './props.js';

const DT = 1 / 60;
const pick = (a, i) => (Array.isArray(a) ? a[i % a.length] : a);

export class Sigs {
  constructor(scene, game) { this.scene = scene; this.game = game; this.items = []; this.queue = []; this.frame = 0; }

  busy(f) { return this.items.some((i) => i.owner === f) || this.queue.some((q) => q.owner === f); }
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
    const r = d.takeHit({ hitstun: 14, blockstun: 9, push: 0.7, height: 'mid', tier: 3, ...m }, from, this.game);
    if (r === 'hit') { o.combo = from.combo; o.comboT = 70; }
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
          if (r === 'hit') { d.downT = 75; d.vy = 6.2; d.vx = -Math.sign(it.vx || 1) * 0.6; this.rainOn(it.owner, d, it.sig, it.sig.then || 'bill', it.sig.thenPo, it.sig.n ?? 8, true); }
        }
        if (it.t > it.life || Math.abs(it.x) > 13) it.alive = false;
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
