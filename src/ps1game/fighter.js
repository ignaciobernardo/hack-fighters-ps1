// Luchador del juego PS1: estados, física (en el eje X sobre un escenario 3D), dash,
// golpes por botón + dirección, cancelaciones y malabares. Modelo low-poly de src/ps1.
import * as THREE from 'three';
import { applyPose } from '../gen/poses.js';
import { MOVES, moveFor, poseOf } from './moves.js';
import { FIGHTERS } from './roster.js';

export const YAW = 62 * Math.PI / 180;
export const DT = 1 / 60;
const G = 34;              // gravedad: saltos cortos y rápidos
const JUMP_VY = 9.0;
const WALK_F = 2.6, WALK_B = 2.0;
const BUF = 7;             // cuadros que se recuerda un botón apretado antes de tiempo

export function altSpec(spec) {
  const s = structuredClone(spec);
  const rot = (hex) => { const c = new THREE.Color(hex), h = {}; c.getHSL(h, THREE.SRGBColorSpace); return '#' + new THREE.Color().setHSL((h.h + 0.5) % 1, Math.max(h.s, 0.35), h.l, THREE.SRGBColorSpace).getHexString(); };
  for (const k of ['top', 'jacket', 'bottom']) if (s[k]?.color) s[k].color = rot(s[k].color);
  if (s.shoes?.accent) s.shoes.accent = rot(s.shoes.accent);
  return s;
}

const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.38, depthWrite: false, fog: false });
const shadowGeo = new THREE.CircleGeometry(1, 9);
const ATTACKS = ['p1', 'p2', 'k1', 'k2', 's'];

export class Fighter {
  constructor(char, slot) {
    this.char = char;
    this.id = char.spec.id; this.slot = slot;
    this.data = FIGHTERS[this.id];
    this.H = char.P.H;
    this.k = this.H / 1.78;
    this.shadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.renderOrder = 2;
    this.z = 0; this.floorY = 0;
    this.wins = 0;
    this.reset(slot === 1 ? -1.35 : 1.35);
  }

  addTo(scene) { scene.add(this.char.group, this.shadow); }
  removeFrom(scene) { scene.remove(this.char.group, this.shadow); }

  reset(x) {
    Object.assign(this, {
      x, y: 0, vx: 0, vy: 0, facing: this.slot === 1 ? 1 : -1, state: 'idle', t: 0, clock: 0,
      hp: this.data.hp, maxHp: this.data.hp, move: null, hasHit: false, blocked: false, stun: 0,
      crouching: false, guarding: false, walking: false, walkPhase: 0, invuln: 0, combo: 0, comboT: 0, lastPose: -99, dirty: true,
      buf: null, bufT: 0, dbuf: 0, dbufT: 0, airAttacks: 0, airDashUsed: false, dashDir: 1, chain: 0, juggle: 0, landLag: 3,
      yawOverride: null, sigCd: 0, fx: { confuse: 0, freeze: 0, slow: 0, burn: 0, shock: 0, puppet: 0, squash: 0, heal: 0 }, hidden: 0,
    });
    this.walkDir = [Math.cos(YAW), Math.sin(YAW)];
  }

  set(state) { if (this.state !== state) { this.state = state; this.t = 0; this.dirty = true; } }
  get grounded() { return this.y <= 0.0001 && this.vy <= 0; }
  get actionable() { return this.state === 'idle' || this.state === 'crouch' || (this.state === 'land' && this.t >= this.landLag); }
  get airborne() { return this.y > 0.02; }
  get lying() { return this.state === 'down' || this.state === 'ko' || this.state === 'getup'; }
  phase() {
    const m = this.move; if (this.state !== 'attack' || !m) return null;
    return this.t < m.startup ? 'startup' : this.t < m.startup + m.active ? 'active' : 'recover';
  }

  startMove(name, game, carry = 0) {
    const m = MOVES[name];
    if (!m) return;
    this.move = { ...m, name };
    this.hasHit = false; this.blocked = false;
    this.set('attack');
    this.crouching = !!m.crouch;
    if (m.air) {
      this.airAttacks++;
      if (m.dive) { this.vy = -7.6; this.vx = this.facing * 5.6; }
    } else if (!m.move) this.vx = carry;
    if (m.invuln) this.invuln = m.invuln;
    this.bufT = 0; this.buf = null;
    game.sfx(m.heavy ? 'whiffHeavy' : 'whiff');
  }

  // intentar un golpe con el botón del búfer
  tryAttack(btn, down, game, carry = 0) {
    if (btn === 's') {
      if (this.airborne) return false;
      if (!game.canCast(this)) return false;
      this.startMove('sig', game);
      this.move.pose = { phone: 'phone', rain: 'toss', lob: 'toss', slip: 'cjab', drive: 'point', volley: 'shot', throw: 'shot' }[this.data.special.kind] || 'shot';
      const sp = this.data.special;
      if (sp.kind === 'phone') { this.move.startup = 14; this.move.recover = 22; }
      if (sp.kind === 'swing') Object.assign(this.move, { pose: 'straight', startup: 10, active: 7, recover: 14, dmg: 185, reach: 2.0, chip: 0.4, height: 'mid', hitstun: 0, blockstun: 16, push: 3, knock: true, heavy: true, spawn: true, move: 4.2 });
      if (sp.kind === 'heal') { this.move.pose = 'toss'; this.move.recover = 46; }
      if (sp.kind === 'teleport') { this.move.pose = 'cjab'; this.move.startup = 6; this.move.recover = 20; }
      if (sp.kind === 'drive' || sp.kind === 'slip' || sp.kind === 'throw') { this.move.startup = 7; this.move.recover = 14; }
      if (sp.kind === 'storm' || sp.kind === 'crush' || sp.kind === 'orbit') { this.move.pose = 'toss'; this.move.recover = sp.kind === 'orbit' ? 16 : 34; }
      if (sp.kind === 'mines') this.move.pose = 'cjab';
      if (sp.kind === 'control') { this.move.pose = 'point'; this.move.recover = 30; }
      return true;
    }
    const name = moveFor(btn, this, down);
    if (!name) return false;
    this.startMove(name, game, carry);
    return true;
  }

  startDash(dir, game) {
    this.dashDir = dir; this.dbufT = 0;
    this.crouching = false;
    if (this.airborne) {
      this.airDashUsed = true; this.vy = 0; this.vx = dir * this.facing * 7.2;
      this.set('airdash');
    } else if (dir > 0) { this.vx = this.facing * 8.2 * this.data.speed; this.set('dash'); }
    else { this.vx = -this.facing * 6.6; this.vy = 2.4; this.y = 0.01; this.invuln = 8; this.set('backdash'); }
    game.sfx('jump');
  }

  // ¿se puede cancelar el golpe actual en otro?
  canCancel(btn, down) {
    const m = this.move;
    if (!m || !(this.hasHit || this.blocked)) return false;
    if (this.t < m.startup || this.t > m.startup + m.active + Math.min(10, m.recover)) return false;
    if (m.air && (btn === 's' || this.airAttacks >= 2 || !this.airborne)) return false;
    const nm = btn === 's' ? { tier: 3 } : MOVES[moveFor(btn, this, down)];
    if (!nm) return false;
    if (!!nm.air !== !!m.air && nm.tier !== 3) return false;
    if (nm.tier > m.tier) return true;
    return m.tier === 1 && nm.tier === 1 && this.chain < 2;   // cadenas de golpes livianos
  }

  update(ctl, opp, game) {
    this.t++; this.clock++;
    if (this.invuln > 0) this.invuln--;
    const fwdKey = this.facing > 0 ? 'right' : 'left', backKey = this.facing > 0 ? 'left' : 'right';
    const pr = ctl.pressed || {};
    // búfer de botones
    for (const b of ATTACKS) if (pr[b]) { this.buf = b; this.bufT = BUF; }
    if (this.bufT > 0) this.bufT--; else this.buf = null;
    if (pr.dash) { this.dbuf = ctl[backKey] && !ctl[fwdKey] ? -1 : 1; this.dbufT = BUF; }
    else if (ctl.dashTap) { this.dbuf = ctl.dashTap === this.facing ? 1 : -1; this.dbufT = BUF; }
    else if (this.dbufT > 0) this.dbufT--;
    const wantDash = this.dbufT > 0;

    this.walking = false;
    this.guarding = !!ctl[backKey] && !ctl[fwdKey];

    if (this.actionable) {
      if (this.grounded) this.facing = opp.x >= this.x ? 1 : -1;
      this.chain = 0;
      if (wantDash) this.startDash(this.dbuf, game);
      else if (this.buf && this.tryAttack(this.buf, ctl.down, game)) { /* golpe */ }
      else if (ctl.up) {
        this.vy = JUMP_VY; this.airAttacks = 0; this.airDashUsed = false;
        this.vx = (ctl[fwdKey] ? 3.2 : ctl[backKey] ? -2.6 : 0) * this.facing;
        this.crouching = false; this.set('jump'); game.sfx('jump');
      } else if (ctl.down) { this.crouching = true; this.vx = 0; this.set('crouch'); }
      else {
        this.crouching = false;
        const v = ctl[fwdKey] ? WALK_F : ctl[backKey] ? -WALK_B : 0;
        this.vx = v * this.data.speed * this.facing;
        this.walking = v !== 0;
        if (this.walking) this.walkPhase += Math.sign(v) * Math.abs(this.vx) * DT / (0.15 * this.H) * Math.PI;
        this.set('idle');
      }
    } else if (this.state === 'dash') {
      this.vx = this.facing * 8.2 * this.data.speed * Math.max(0.25, 1 - this.t / 16);
      if (this.t >= 4 && this.buf) this.tryAttack(this.buf, ctl.down, game, this.vx * 0.55);
      else if (this.t >= 4 && ctl.up) { this.vy = JUMP_VY * 0.95; this.vx = this.facing * 4.4; this.airAttacks = 0; this.airDashUsed = false; this.set('jump'); game.sfx('jump'); }
      else if (this.t >= 15) this.set(ctl.down ? 'crouch' : 'idle');
    } else if (this.state === 'backdash') {
      this.vx *= 0.9;
      if (this.grounded && this.t > 4) { this.vx = 0; this.landLag = 4; this.set('land'); }
    } else if (this.state === 'airdash') {
      this.vy = 0;
      this.vx = this.dashDir * this.facing * 7.2 * (1 - this.t / 24);
      if (this.t >= 3 && this.buf && this.airAttacks < 2) this.tryAttack(this.buf, false, game);
      else if (this.t >= 12) this.set('jump');
    } else if (this.state === 'jump') {
      if (this.buf && this.airAttacks < 2 && this.buf !== 's') this.tryAttack(this.buf, false, game);
      else if (wantDash && !this.airDashUsed && this.y > 0.45) this.startDash(this.dbuf, game);
    } else if (this.state === 'attack') {
      const m = this.move;
      if (m.move) this.vx = this.phase() === 'active' ? m.move * this.facing : this.phase() === 'recover' ? this.vx * 0.8 : 0;
      else if (!m.air && this.grounded) this.vx *= 0.86;
      if (m.rising && this.t === m.startup) { this.vy = 3.2; this.y = 0.01; }
      if (m.spawn && this.t === m.startup) game.cast(this);
      // cancelaciones: golpe que conecta → otro más fuerte (o dash si fue fuerte)
      if (this.buf && this.canCancel(this.buf, ctl.down)) {
        const next = this.buf;
        if (next !== 's' && MOVES[moveFor(next, this, ctl.down)]?.tier === this.move.tier) this.chain++;
        this.tryAttack(next, ctl.down, game);
      } else if (wantDash && this.dbuf > 0 && m.tier === 2 && this.hasHit && !m.air && this.t >= m.startup) {
        this.startDash(1, game);
      } else {
        const total = m.startup + m.active + m.recover;
        if (m.air) { if (this.grounded && this.t > 1) { this.landLag = m.dive && !this.hasHit ? 10 : 3; this.vx = 0; this.set('land'); } }
        else if (this.t >= total) {
          if (this.airborne) this.set('jump');
          else this.set(m.crouch && ctl.down ? 'crouch' : 'idle');
        }
      }
    } else if (this.state === 'hit' || this.state === 'block') {
      this.vx *= 0.85;
      if (this.t >= this.stun) this.set(this.crouching ? 'crouch' : 'idle');
    } else if (this.state === 'down') {
      this.vx *= 0.75;
      if (this.t >= (this.downT || 24)) { this.downT = 0; this.set('getup'); this.invuln = 16; }
    } else if (this.state === 'getup') {
      if (this.t >= 14) { this.crouching = false; this.juggle = 0; this.set('idle'); }
    } else if (this.state === 'ko') { this.vx *= 0.85; }

    // física
    if (this.state !== 'airdash' && (!this.grounded || this.vy > 0)) {
      this.vy -= G * DT;
      this.y += this.vy * DT;
      if (this.y <= 0) {
        this.y = 0; this.vy = 0;
        if (this.state === 'jump') { this.landLag = 3; this.set('land'); this.vx = 0; game.sfx('land'); }
        else if (this.state === 'fall') { this.set(this.hp <= 0 ? 'ko' : 'down'); this.juggle = 0; game.sfx('thud'); game.shake(0.05); }
        else if (this.state === 'attack' && !this.move.air) { this.vx *= 0.5; }
        else if (this.state === 'hit') { this.vx = 0; }
      }
    }
    this.x += this.vx * DT;
  }

  takeHit(m, from, game) {
    const lowOk = this.crouching, highOk = !this.crouching;
    const blockOk = this.guarding && (this.actionable || this.state === 'block' || this.state === 'land') && !this.airborne &&
      (m.height === 'low' ? lowOk : m.height === 'over' ? highOk : true);
    const dir = from.facing;
    if (blockOk) {
      this.stun = m.blockstun; this.set('block'); this.t = 0;
      this.vx = dir * m.push * 0.9;
      if (m.tier === 3 && m.dmg) this.hp = Math.max(1, this.hp - Math.round(m.dmg * (m.chip ?? 0.12)));
      game.spark(this, from, true); game.sfx('block');
      return 'block';
    }
    const scale = Math.max(0.45, 1 - from.combo * 0.08);    // daño decreciente en combos largos
    const dmg = Math.round((m.dmg || 0) * from.data.power * (from.combo > 1 ? scale : 1));
    this.hp = Math.max(0, this.hp - dmg);
    const wasStunned = this.state === 'hit' || this.state === 'fall';
    from.combo = wasStunned ? from.combo + 1 : 1;
    if (this.airborne || this.state === 'fall') this.juggle++;
    const air = this.airborne;
    if (this.hp <= 0 || m.knock || m.launch || air || (m.antiAir && air)) {
      this.set('fall');
      this.vy = m.launch ? 8.4 : air ? (m.antiAir ? 6.4 : 4.4) : 5.2;
      this.vx = dir * (m.launch ? 1.2 : 3.0);
      this.y = Math.max(this.y, 0.01);
      this.crouching = false;
    } else {
      this.stun = m.hitstun; this.set('hit'); this.t = 0;
      this.vx = dir * m.push;
    }
    game.spark(this, from, false, m.heavy); game.sfx(m.heavy ? 'heavy' : 'hit');
    game.hitstop(m.heavy ? 8 : 5);
    if (m.heavy) game.shake(0.07);
    return 'hit';
  }

  get halfW() { return 0.24 * this.k; }
  get top() { return this.y + (this.crouching ? 0.62 : this.lying ? 0.3 : 1.0) * this.H; }

  sync(frame, force = false, pose = null) {
    const g = this.char.group;
    g.position.set(this.x, this.floorY + this.y, this.z);
    g.visible = !(this.hidden > 0);
    this.shadow.visible = g.visible;
    const sq = this.fx.squash > 0 ? Math.min(1, this.fx.squash / 12) : 0;
    g.scale.set((this.facing > 0 ? 1 : -1) * (1 + 0.45 * sq), 1 - 0.58 * sq, 1 + 0.45 * sq);
    const yaw = this.yawOverride ?? YAW;
    g.rotation.y = this.facing > 0 ? yaw : -yaw;
    if (force || this.dirty || frame !== this.lastPose) {
      applyPose(this.char, pose || poseOf(this));
      this.lastPose = frame; this.dirty = false;
    }
    const sh = Math.max(0.35, 1 - this.y * 0.5);
    this.shadow.position.set(this.x, this.floorY + 0.012, this.z);
    this.shadow.scale.set(0.42 * this.k * sh * (this.lying ? 1.7 : 1), 0.24 * sh, 1);
  }
}
