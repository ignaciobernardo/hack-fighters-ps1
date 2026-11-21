// hack fighters PS1 — juego de pelea chico con los modelos low-poly de src/ps1, en tres
// escenarios (el MUT, Buk con su mural, la Casa Platanus). Render a 320×240, temblor de
// vértices, texturas afines y dither ordenado de 12 niveles, como el nodo de la referencia.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildPS1, loadAssets } from '../ps1/build.js';
import { ps1Globals } from '../ps1/material.js';
import { applyPose, POSES, blend, add } from '../gen/poses.js';
import { MOVES } from './moves.js';
import { Input, endFrame } from './input.js';
import { CPU } from './ai.js';
import { sfx, audioOn } from './sfx.js';
import { envGlobals } from './kit.js';
import { STAGE_IDS, getStage } from './stages.js';
import { IDS, FIGHTERS, SPECS, PEOPLE, THUMB } from './roster.js';
import { Sigs } from './sig.js';
import { makeProp } from './props.js';
import { Fighter, DT, altSpec } from './fighter.js';
import { FX } from './fx.js';
import { HW, HH, chrome, plain, glyph, hints, lifeBar, winMarks, vignette, controlsCard } from './hud.js';


const q = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

// ---------------- render ----------------
const RES = { w: 320, h: 240 };
const canvas = $('#view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(RES.w, RES.h, false);
const rt = new THREE.WebGLRenderTarget(RES.w, RES.h, { type: THREE.HalfFloatType, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, RES.w / RES.h, 0.1, 900);
const hemi = new THREE.HemisphereLight('#fff', '#666', 1.6);
const key = new THREE.DirectionalLight('#fff', 1.6);
const rim = new THREE.DirectionalLight('#fff', 0);
scene.add(hemi, key, rim, key.target, rim.target);
const fx = new FX(scene);

const pass = new THREE.ShaderMaterial({
  uniforms: { tColor: { value: rt.texture }, uRes: { value: new THREE.Vector2(RES.w, RES.h) }, uLevels: { value: +(q.get('levels') || 12) }, uSharp: { value: 0.2 }, uFade: { value: 1 }, uOn: { value: q.get('dither') === '0' ? 0 : 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `
    uniform sampler2D tColor; uniform vec2 uRes; uniform float uLevels, uSharp, uFade, uOn;
    varying vec2 vUv;
    vec3 srgb(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
    float bayer(vec2 p){
      int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
      float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
      return (m[x + y * 4] + 0.5) / 16.0;
    }
    void main(){
      vec2 cell = floor(vUv * uRes), px = 1.0 / uRes;
      vec2 uv = (cell + 0.5) / uRes;
      vec3 c = srgb(texture2D(tColor, uv).rgb);
      vec3 n = srgb(texture2D(tColor, uv + vec2(px.x, 0.0)).rgb) + srgb(texture2D(tColor, uv - vec2(px.x, 0.0)).rgb)
             + srgb(texture2D(tColor, uv + vec2(0.0, px.y)).rgb) + srgb(texture2D(tColor, uv - vec2(0.0, px.y)).rgb);
      c += (c * 4.0 - n) * uSharp;
      c *= uFade;
      if (uOn > 0.5) { float L = uLevels - 1.0; c = floor(clamp(c, 0.0, 1.0) * L + bayer(cell)) / L; }
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const passScene = new THREE.Scene(); passScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pass));
const passCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const hudCv = $('#hud'); hudCv.width = HW; hudCv.height = HH;
const hud = hudCv.getContext('2d');

function fit() {
  const w = Math.min(innerWidth, innerHeight * 4 / 3), h = w * 3 / 4;
  const wrap = $('#wrap'); wrap.style.width = w + 'px'; wrap.style.height = h + 'px';
}
addEventListener('resize', fit); fit();

let controls = null;
if (q.get('cam') === 'free') { controls = new OrbitControls(camera, hudCv); controls.target.set(0, 1.2, 0); camera.position.set(0, 1.6, 6); }

// ---------------- estado ----------------
// ?p1=ian-fry (id, prefijo del id o nombre corto)
const findId = (v, def) => {
  const k = (v || '').toLowerCase();
  let i = k ? IDS.findIndex((id) => id === k) : -1;
  if (i < 0 && k) i = IDS.findIndex((id) => id.startsWith(k));
  if (i < 0 && k) i = PEOPLE.findIndex((p) => p.short.toLowerCase() === k);
  return i >= 0 ? i : Math.max(0, IDS.findIndex((id) => id.startsWith(def)));
};
const S = {
  screen: 'boot', mode: q.get('mode') === '2p' ? '2p' : 'cpu', menu: 0,
  cur: [findId(q.get('p1'), 'ian-fry'), findId(q.get('p2'), 'rafael-fernandez')], locked: [false, false], pick: 0,
  stageI: Math.max(0, STAGE_IDS.indexOf(q.get('stage') || 'casa')),
  stage: null, f: [null, null], round: 1, phase: 'intro', pt: 0, timer: 60, frame: 0, st: 0,
  stop: 0, slow: 0, shakeA: 0, paused: false, winner: null, msg: null, trail: [1, 1], banner: [0, 0],
  wobble: q.get('wobble') !== '0', fade: null, loaded: 0, demo: q.get('demo') === '1',
};
envGlobals.uAffine.value = q.get('affine') === '0' ? 0 : 1;
const inputs = [new Input(1), new Input(2)];
let cpu = new CPU(+(q.get('cpu') || 0.6)), cpu1 = null;

const game = {
  projectiles: [],
  get fighting() { return S.screen === 'fight' && S.phase === 'fight'; },
  sfx,
  hitstop(n) { S.stop = Math.max(S.stop, n); },
  shake(a) { S.shakeA = Math.max(S.shakeA, a); },
  spark(def, att, blocked, heavy) {
    const x = def.x - att.facing * def.halfW * 0.6;
    const y = def.floorY + def.y + (def.crouching ? 0.45 : 0.72) * def.H;
    fx.spark(x, y, def.z, blocked, heavy);
  },
  sparkAt(x, y, z, blocked, heavy) { fx.spark(x, y, z, blocked, heavy); },
  canCast(f) { return !(f.sigCd > 0) && !sigs.busy(f); },
  dim(n) { S.dim = Math.max(S.dim || 0, n); },
  cast(f) { const o = S.f[0] === f ? S.f[1] : S.f[0]; sigs.cast(f, o); f.sigCd = SIG_CD; S.banner[S.f.indexOf(f)] = 80; sfx('shot'); },
  // amenazas en vuelo contra `me` (para la CPU)
  threat(me) { return sigs.items.find((i) => i.owner !== me && (i.kind === 'shot' || i.kind === 'drive' || i.kind === 'trap') && Math.sign(me.x - i.x) === Math.sign(i.vx) && Math.abs(i.x - me.x) < 2.8) || sigs.items.find((i) => i.owner !== me && (i.kind === 'fall' || i.kind === 'lob') && !i.hit && Math.abs(i.x - me.x) < 0.9 && i.y < 3); },
};
const sigs = new Sigs(scene, game);
const SIG_CD = 330;   // recarga del ataque de empresa (5,5 s)

// ---------------- escenario y luces ----------------
function setStage(id, tod = 'day') {
  const st = getStage(id, tod);
  if (S.stage === st) return st;
  if (S.stage) scene.remove(S.stage.root);
  S.stage = st;
  scene.add(st.root);
  scene.fog = new THREE.Fog(st.fog[0], st.fog[1], st.fog[2]);
  const c = st.chars;
  hemi.color.set(c.hemi[0]); hemi.groundColor.set(c.hemi[1]); hemi.intensity = c.hemi[2];
  key.color.set(c.key[0]); key.intensity = c.key[1]; key.position.set(...c.key[2]); key.target.position.set(0, 0, 0);
  rim.intensity = c.rim ? 1.1 : 0; rim.color.set(c.rimColor || '#9fb4ff'); rim.position.set(-1, 1.2, -2);
  return st;
}

// ---------------- personajes (se arman al vuelo; caché chico) ----------------
const chars = new Map();          // id → modelo ; 'alt:'+id → colores alternativos
const pending = new Map();
function inUse(c) { return S.f.some((f) => f && f.char === c) || preview.some((p) => p.char === c); }
async function ensureChar(id) {
  if (chars.has(id)) return chars.get(id);
  if (pending.has(id)) return pending.get(id);
  const pr = (async () => {
    const assets = await loadAssets(SPECS[id]);
    const c = buildPS1(SPECS[id], assets); c.assets = assets;
    chars.set(id, c); pending.delete(id);
    if (chars.size > 14) for (const [k, v] of chars) { if (chars.size <= 14) break; if (!inUse(v) && k !== id) { scene.remove(v.group); v.dispose(); chars.delete(k); } }
    return c;
  })();
  pending.set(id, pr);
  return pr;
}
function charFor(id, slot, otherId) {
  if (slot === 1 && otherId === id) {
    const k = 'alt:' + id;
    if (!chars.has(k)) { const c = buildPS1(altSpec(SPECS[id]), chars.get(id).assets); c.assets = chars.get(id).assets; chars.set(k, c); }
    return chars.get(k);
  }
  return chars.get(id);
}
function clearChars() {
  for (const c of chars.values()) scene.remove(c.group);
  for (const f of S.f) if (f) f.removeFrom(scene);
  for (const p of preview) { scene.remove(p.shadow, p.ring); p.char = null; }
}

// poses de pantalla (respiración suave)
const breathe = (base, t, amt = 1) => { const s = Math.sin(t * 2.6); return add(base, { spine: [1.6 * s, 0, 0], chest: [1.8 * s, 0, 0], head: [-2.2 * s, 0, 0], drop: 0.008 * s }, amt); };

// ---------------- selección: grilla de caritas + los dos elegidos en 3D ----------------
const GRID = { cols: 24, tile: 22 };
GRID.rows = Math.ceil(IDS.length / GRID.cols); GRID.x0 = (HW - GRID.cols * GRID.tile) / 2; GRID.y0 = 212;
const thumbs = new Image(); thumbs.src = '/ps1/thumbs.png';
const preview = ['#ff4a3a', '#3f8cff'].map((c, slot) => {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.58, 14), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
  ring.rotation.x = -Math.PI / 2; ring.renderOrder = 3;
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 9), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.38, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.renderOrder = 2;
  return { slot, ring, shadow, char: null, id: null, want: null, since: 0, x: slot ? 1.75 : -1.75, rep: 0 };
});
function slotOn(slot) { return slot === 0 || S.mode === '2p' || S.pick === 1; }
function previewStep() {
  const t = S.frame / 60;
  for (const p of preview) {
    const on = slotOn(p.slot), id = IDS[S.cur[p.slot]];
    if (p.want !== id) { p.want = id; p.since = S.frame; }
    const ready = chars.get(id);
    if (on && !ready && S.frame - p.since >= 6) ensureChar(id);
    if (on && ready && p.char !== ready && !(preview[1 - p.slot].char === ready && slotOn(1 - p.slot))) {
      if (p.char && preview[1 - p.slot].char !== p.char) scene.remove(p.char.group);
      p.char = ready; p.id = id; scene.add(ready.group, p.shadow, p.ring);
    }
    if (!on && p.char) { if (preview[1 - p.slot].char !== p.char) scene.remove(p.char.group); scene.remove(p.shadow, p.ring); p.char = null; }
    const c = p.char; if (!c) continue;
    const g = c.group, side = p.slot ? -1 : 1;
    g.visible = p.id === id || S.frame % 4 < 2;
    g.position.set(p.x, 0, 0); g.scale.x = side; g.rotation.y = side * 0.5;
    if (S.frame % 2 === 0) applyPose(c, S.locked[p.slot] ? breathe(POSES.win, t, 0.4) : breathe(POSES.stance, t + p.slot));
    p.shadow.position.set(p.x, 0.012, 0); p.shadow.scale.set(0.42 * c.P.H / 1.78, 0.24, 1);
    p.ring.position.set(p.x, 0.016, 0); p.ring.scale.setScalar(S.locked[p.slot] ? 1.1 : 1 + Math.sin(S.frame * 0.15) * 0.06);
  }
}

// ---------------- pelea ----------------
function placeFighters(ids) {
  clearChars();
  S.f = [new Fighter(charFor(ids[0], 0, null), 1), new Fighter(charFor(ids[1], 1, ids[0]), 2)];
  for (const f of S.f) {
    f.z = S.stage.lineZ; f.floorY = S.stage.floorY; f.char.group.visible = true; f.addTo(scene);
    // teléfono en la mano para los ataques de mensajes
    // lo que saca en la mano para su ataque (teléfono, martillo, lo que va a lanzar)
    const sp = f.data.special, first = Array.isArray(sp.prop) ? sp.prop[0] : sp.prop;
    const hand = sp.hand ?? (sp.kind === 'phone' ? 'phone' : ['swing', 'throw', 'lob', 'volley', 'slip', 'control', 'mines'].includes(sp.kind) ? first : null);
    if (hand && !f.char.hand) { const ph = makeProp(hand, hand === 'bubble' ? { text: '...' } : sp.po || {}); ph.position.set(0, -0.08, 0.03); ph.scale.setScalar(sp.kind === 'swing' ? 2.2 : 1.1); if (sp.kind === 'swing') { ph.rotation.set(Math.PI, 0, 0); ph.position.set(0, -0.3, 0.02); } f.char.bones[sp.kind === 'swing' ? 'handR' : 'handL'].add(ph); f.char.hand = ph; }
    if (f.char.hand) f.char.hand.visible = false;
    f.char.material.color.set('#fff');
  }
}
function startMatch() {
  if (!chars.has(IDS[S.cur[0]]) || !chars.has(IDS[S.cur[1]])) return;
  setStage(STAGE_IDS[S.stageI], 'day');
  placeFighters([IDS[S.cur[0]], IDS[S.cur[1]]]);
  cpu = new CPU(+(q.get('cpu') || 0.6));
  cpu1 = S.demo || S.autoCpu ? new CPU(0.6) : null;
  S.screen = 'fight'; S.round = 1;
  S.f.forEach((f) => (f.wins = 0));
  startRound();
}
function startRound() {
  S.f[0].reset(-1.35); S.f[1].reset(1.35);
  sigs.clear(); fx.clear(); S.banner = [0, 0]; S.dim = 0;
  S.phase = 'intro'; S.pt = 0; S.timer = 60; S.slow = 0; S.trail = [1, 1]; S.msg = null;
  sfx('round');
}
function say(text, o = {}) { S.msg = text ? { text, t: 0, ...o } : null; }

function checkHit(a, d) {
  const m = a.move;
  if (a.state !== 'attack' || !m?.dmg || a.hasHit || a.phase() !== 'active') return;
  if (d.invuln > 0 || d.lying || d.juggle >= 4) return;
  const dx = (d.x - a.x) * a.facing;
  if (dx < -0.15 || dx - d.halfW > m.reach * a.k) return;
  if (m.height === 'high' && d.crouching && !d.airborne && (d.state === 'crouch' || d.state === 'block' || d.state === 'attack')) return;
  const maxY = m.air ? 9 : (m.name === 'rise' || m.rising) ? 1.9 : m.antiAir ? 1.4 : m.height === 'low' ? 0.2 : 0.6;
  if (d.y > maxY + a.y) return;
  if (m.air && a.y > d.top - 0.1) return;
  const r = d.takeHit(m, a, game);
  if (r === 'block') a.blocked = true; else { a.hasHit = true; const st = m.name === 'sig' && a.data.special.status; if (st) for (const [k, v] of Object.entries(st)) d.fx[k] = Math.max(d.fx[k] || 0, v); }
  if (m.dive) { a.vy = 4.6; a.vx = -a.facing * 1.8; }
  a.comboT = 70;
}
function limits() {
  const [a, b] = S.f;
  const minSep = a.halfW + b.halfW + 0.08, dx = b.x - a.x;
  if (Math.abs(dx) < minSep && Math.abs(a.y - b.y) < 0.9 && !a.lying && !b.lying) {
    const push = (minSep - Math.abs(dx)) / 2 * (dx >= 0 ? 1 : -1);
    a.x -= push; b.x += push;
  }
  const B = S.stage.bound;
  for (const f of S.f) f.x = clamp(f.x, -B, B);
  const c = (a.x + b.x) / 2, half = 2.45;
  for (const f of S.f) f.x = clamp(f.x, c - half, c + half);
}

function fightStep() {
  const [a, b] = S.f;
  S.pt++;
  if (S.phase === 'intro') {
    if (S.pt === (S.round === 1 ? 30 : 10)) say(`RONDA ${S.round}`, { size: 44 });
    if (S.pt === (S.round === 1 ? 88 : 55)) { say('¡PELEA!', { size: 54, pal: 'gold' }); sfx('ok'); }
    if (S.pt >= (S.round === 1 ? 104 : 70)) { S.phase = 'fight'; }
  }
  if (S.phase === 'fight' && S.pt > 125 && S.msg?.text === '¡PELEA!') say('');
  if (S.phase === 'fight' && S.stop <= 0) S.timer -= 1 / 60;

  const ca = window.__pelea.ctl ? window.__pelea.ctl(a, b, S.pt) : cpu1 ? cpu1.poll(a, b, game) : inputs[0].poll();
  const cb = S.mode === 'cpu' ? cpu.poll(b, a, game) : inputs[1].poll();
  if ((ca.pressed.start || (S.mode === '2p' && cb.pressed.start)) && S.phase !== 'over' && !cpu1) { S.paused = true; S.pt0 = S.frame; return; }
  if (S.stop > 0) { S.stop--; return; }
  const none = { pressed: {} };
  // estados que dejan los ataques: confundido (controles al revés), congelado, lento, quemado
  const eff = (f, ctl) => {
    const x = f.fx;
    for (const k in x) if (x[k] > 0 && k !== 'master') (f.fxSeen ||= {})[k] = true;
    if (f.hidden > 0) f.hidden--;
    if (f.sigCd > 0) f.sigCd--;
    if (x.burn > 0) { x.burn--; if (x.burn % 30 === 0 && f.hp > 1) { f.hp = Math.max(1, f.hp - 14); fx.spark(f.x, f.floorY + 0.9, f.z, false, false); } }
    if (x.puppet > 0) { x.puppet--; const m = x.master, to = m && m.x >= f.x ? 'right' : 'left'; ctl = { pressed: {}, [to]: !m || Math.abs(m.x - f.x) > 0.75 }; }
    else if (x.confuse > 0) { x.confuse--; ctl = { ...ctl, left: ctl.right, right: ctl.left, up: ctl.down, down: ctl.up, dashTap: -(ctl.dashTap || 0), pressed: { ...ctl.pressed, p1: ctl.pressed.k1, k1: ctl.pressed.p1, p2: ctl.pressed.k2, k2: ctl.pressed.p2 } }; }
    if (x.heal > 0) x.heal--;
    const tint = x.heal > 0 ? (S.frame % 8 < 4 ? '#9dffb0' : '#ffffff') : x.freeze > 0 || x.shock > 0 ? (x.shock > 0 ? '#fff27a' : '#7fc8ff') : x.puppet > 0 ? '#8dff9a' : x.confuse > 0 ? '#d49aff' : x.slow > 0 ? '#9aa0a8' : x.burn > 0 ? '#ff9a6a' : '#ffffff';
    f.char.material.color.set(tint);
    if (x.squash > 0) { x.squash--; if (S.frame % 2) return null; }
    if (x.shock > 0) { x.shock--; if (!f.lying && f.state !== 'fall') return null; }
    if (x.freeze > 0) { x.freeze--; if (!f.lying && f.state !== 'fall') return null; }
    if (x.slow > 0) { x.slow--; if (S.frame % 2) return null; }
    return ctl;
  };
  const ea = eff(a, S.phase === 'fight' ? ca : none), eb = eff(b, S.phase === 'fight' ? cb : none);
  if (ea) a.update(ea, b, game);
  if (eb) b.update(eb, a, game);
  for (const f of S.f) if (f.comboT > 0) f.comboT--;
  sigs.update(S.f); if (S.dim > 0) S.dim--;
  for (const i of [0, 1]) { if (S.banner[i] > 0) S.banner[i]--; const f = S.f[i]; if (f.char.hand) { const k = f.data.special.kind; f.char.hand.visible = f.state === 'attack' && f.move?.name === 'sig' && (k === 'phone' || k === 'swing' || f.t < f.move.startup); } }
  if (S.phase === 'fight') { checkHit(a, b); checkHit(b, a); }
  limits();
  fx.update();

  if (S.phase === 'fight') {
    const ko = S.f.filter((f) => f.hp <= 0);
    if (ko.length || S.timer <= 0) {
      S.phase = 'ko'; S.pt = 0;
      if (ko.length) { say('K.O.', { size: 72, pal: 'red' }); sfx('ko'); S.slow = 70; }
      else say('TIEMPO', { size: 48 });
      S.winner = ko.length === 2 ? null : ko.length ? S.f.find((f) => f.hp > 0) : a.hp === b.hp ? null : a.hp > b.hp ? a : b;
    }
  } else if (S.phase === 'ko') {
    if (S.pt === 80) {
      const w = S.winner;
      if (w) { w.wins++; w.set('win'); w.vx = 0; }
      const l = w ? (w === a ? b : a) : null;
      if (l && l.hp > 0) l.set('lose');
      say(w ? (w.hp === w.maxHp ? 'PERFECTO' : `GANA ${w.data.short}`) : 'EMPATE', { size: 40, pal: 'gold' });
    }
    if (S.pt === 190) {
      const champ = S.f.find((f) => f.wins >= 2);
      if (champ) { S.phase = 'over'; S.pt = 0; say(`${champ.data.short} GANA LA PELEA`, { size: 34, pal: 'gold', stay: true }); }
      else { S.round++; startRound(); }
    }
  } else if (S.phase === 'over') {
    if (S.demo && S.pt > 120) { if (q.get('p1')) startMatch(); else { const ids = [0, 1].map(() => Math.floor(Math.random() * IDS.length)); Promise.all(ids.map((i) => ensureChar(IDS[i]))).then(() => { S.cur = ids; startMatch(); }); S.pt = -9999; } }
    if (ca.pressed.ok) fadeTo(() => startMatch());
    if (ca.pressed.back) fadeTo(() => toSelect());
  }
}

// ---------------- pantallas ----------------
function fadeTo(fn) { if (!S.fade) S.fade = { t: 0, fn }; }
function toTitle() { S.screen = 'title'; S.st = 0; setStage('casa', 'dusk'); clearChars(); }
function toSelect() {
  S.screen = 'select'; S.st = 0; S.locked = [false, false]; S.pick = 0; S.paused = false; say('');
  sigs.clear(); fx.clear();
  setStage('casa', 'dusk'); clearChars();
}
function toStageSelect() {
  S.screen = 'stage'; S.st = 0;
  setStage(STAGE_IDS[S.stageI], 'day');
  placeFighters([IDS[S.cur[0]], IDS[S.cur[1]]]);
}

function titleStep() {
  const a = inputs[0].poll(), b = inputs[1].poll();
  if (S.help) { if (a.pressed.ok || a.pressed.back || b.pressed.ok || b.pressed.back) { S.help = false; sfx('select'); } return; }
  const d = (a.pressed.down || b.pressed.down ? 1 : 0) - (a.pressed.up || b.pressed.up ? 1 : 0);
  if (d) { S.menu = (S.menu + d + 3) % 3; sfx('select'); }
  if (b.pressed.start) { S.menu = 1; }
  if (a.pressed.ok || b.pressed.start) {
    audioOn(); sfx('ok');
    if (S.menu === 2) S.help = true;
    else { S.mode = S.menu ? '2p' : 'cpu'; fadeTo(toSelect); }
  }
}
function selectStep() {
  const a = inputs[0].poll(), b = inputs[1].poll();
  const N = IDS.length, C = GRID.cols;
  const drive = (ctl, slot) => {
    const p = preview[slot];
    const dx = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0), dy = (ctl.down ? 1 : 0) - (ctl.up ? 1 : 0);
    const fresh = ctl.pressed.left || ctl.pressed.right || ctl.pressed.up || ctl.pressed.down;
    p.rep = dx || dy ? p.rep + 1 : 0;
    if ((dx || dy) && (fresh || (p.rep > 14 && p.rep % 3 === 0))) {
      let i = S.cur[slot], col = i % C, row = Math.floor(i / C);
      col = (col + dx + C) % C; row = (row + dy + GRID.rows) % GRID.rows;
      i = row * C + col; if (i >= N) i = dy > 0 ? col : dy < 0 ? (GRID.rows - 2) * C + col : dx > 0 ? row * C : N - 1;
      S.cur[slot] = i; sfx('select');
    }
    if (ctl.pressed.s) { S.cur[slot] = Math.floor(Math.random() * N); sfx('select'); }
    if (ctl.pressed.ok && chars.has(IDS[S.cur[slot]])) { S.locked[slot] = true; sfx('ok'); return true; }
    return false;
  };
  if (S.mode === 'cpu') {
    if (S.pick === 0) { if (drive(a, 0)) { S.pick = 1; S.cur[1] = Math.floor(Math.random() * N); } else if (a.pressed.back) fadeTo(toTitle); }
    else if (!S.locked[1]) { if (drive(a, 1)) fadeTo(toStageSelect); else if (a.pressed.back) { S.pick = 0; S.locked[0] = false; sfx('select'); } }
  } else {
    if (!S.locked[0]) drive(a, 0); else if (a.pressed.back) { S.locked[0] = false; sfx('select'); }
    if (!S.locked[1]) drive(b, 1); else if (b.pressed.back) { S.locked[1] = false; sfx('select'); }
    if (S.locked[0] && S.locked[1] && !S.fade) fadeTo(toStageSelect);
    if (!S.locked[0] && a.pressed.back) fadeTo(toTitle);
  }
  previewStep();
}
function stageStep() {
  const a = inputs[0].poll();
  const d = (a.pressed.right ? 1 : 0) - (a.pressed.left ? 1 : 0);
  if (d && !S.fade) { S.stageI = (S.stageI + d + STAGE_IDS.length) % STAGE_IDS.length; sfx('select'); setStage(STAGE_IDS[S.stageI], 'day'); for (const f of S.f) { f.z = S.stage.lineZ; f.floorY = S.stage.floorY; } S.st = 0; }
  if (a.pressed.ok) { sfx('ok'); fadeTo(startMatch); }
  if (a.pressed.back) fadeTo(toSelect);
  for (const f of S.f) { f.clock++; f.state = 'idle'; f.walking = false; f.y = 0; }
  S.f[0].x = -1.35; S.f[1].x = 1.35; S.f[0].facing = 1; S.f[1].facing = -1;
}

// ---------------- cámara ----------------
const camPos = new THREE.Vector3(0, 1.6, 6), camLook = new THREE.Vector3(0, 1.2, 0);
function setCam(pos, look, fov, k = 1) {
  camPos.lerp(pos, k); camLook.lerp(look, k);
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov += (fov - camera.fov) * k; camera.updateProjectionMatrix(); }
}
function fightCamTarget() {
  const [a, b] = S.f, z = S.stage.lineZ;
  const sep = Math.abs(a.x - b.x);
  const B = S.stage.bound;
  const tx = clamp((a.x + b.x) / 2, -B + 2.2, B - 2.2);
  const fc = S.stage.cams.fight || {}, fov = fc.fov ?? 40;
  const tanH = Math.tan((fov * Math.PI) / 360), asp = RES.w / RES.h;
  let dist = Math.max(4.9, (sep / 2 + 1.0) / (tanH * asp));
  const air = Math.max(a.y, b.y);
  const ty = 1.18 + air * 0.4 + S.stage.floorY; dist += air * 0.5;
  return { pos: new THREE.Vector3(tx, ty + 0.28, z + dist), look: new THREE.Vector3(tx, ty + (fc.up ?? 0), z), fov };
}
function updateCamera() {
  if (controls) { controls.update(); return; }
  const st = S.stage, t = S.st / 60;
  if (S.screen === 'title') {
    const a = Math.sin(t * 0.18) * 0.5;
    setCam(new THREE.Vector3(Math.sin(a) * 7.5, 1.7, Math.cos(a) * 7.5), new THREE.Vector3(0, 2.4, -2), 50, 0.08);
  } else if (S.screen === 'select') {
    setCam(new THREE.Vector3(0, 0.75, 7.75), new THREE.Vector3(0, -0.41, 0), 40, S.st < 2 ? 1 : 0.12);
  } else if (S.screen === 'stage') {
    const sc = st.cams.stage || {}, a = -0.9 + t * 0.22, r = sc.r ?? 8.5;
    setCam(new THREE.Vector3(Math.sin(a) * r, (sc.h ?? 2.3) + st.floorY, st.lineZ + Math.cos(a) * r), new THREE.Vector3(0, (sc.look ?? 1.6) + st.floorY, st.lineZ - 1.5), sc.fov ?? 46, S.st < 2 ? 1 : 0.1);
  } else if (S.screen === 'fight') {
    const tgt = fightCamTarget();
    if (S.phase === 'intro' && S.round === 1) {
      const k = smooth(S.pt / 110), a = (1 - k) * -1.3, r = 9 * (1 - k) + tgt.pos.z * k;
      const pos = new THREE.Vector3(tgt.pos.x + Math.sin(a) * r, tgt.pos.y + (1 - k) * 2.2, st.lineZ + Math.cos(a) * r);
      setCam(pos, tgt.look, tgt.fov, 1);
    } else {
      setCam(tgt.pos, tgt.look, tgt.fov, S.phase === 'intro' && S.pt < 2 ? 1 : 0.2);
    }
  }
  const sh = S.shakeA; S.shakeA *= 0.85;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z);
  camera.lookAt(camLook);
}

// ---------------- HUD ----------------
const toScreen = (v) => { const p = v.clone().project(camera); return [(p.x * 0.5 + 0.5) * HW, (-p.y * 0.5 + 0.5) * HH, p.z]; };
function drawMsg() {
  const m = S.msg; if (!m) return;
  m.t++;
  const k = Math.min(1, m.t / 7), s = (m.size || 40) * (1.7 - 0.7 * k);
  chrome(hud, m.text, HW / 2, HH * 0.42, s, { pal: m.pal || 'chrome', alpha: Math.min(1, m.t / 4) });
}
function drawHud() {
  hud.clearRect(0, 0, HW, HH);
  const blink = Math.floor(S.frame / 20) % 2 === 0;
  if (S.screen === 'boot') {
    hud.fillStyle = '#000'; hud.fillRect(0, 0, HW, HH);
    chrome(hud, 'CARGANDO', HW / 2, HH / 2 - 14, 30);
    hud.fillStyle = '#222'; hud.fillRect(HW / 2 - 110, HH / 2 + 20, 220, 8);
    hud.fillStyle = '#ffd23a'; hud.fillRect(HW / 2 - 110, HH / 2 + 20, 220 * Math.min(1, S.loaded / 2), 8);
    return;
  }
  if (S.screen === 'title') {
    vignette(hud, 0.55);
    chrome(hud, 'HACK', HW / 2, 118, 70, { spacing: 0.12 });
    chrome(hud, 'FIGHTERS', HW / 2, 180, 62, { spacing: 0.1, pal: 'gold' });
    plain(hud, `PLATANUS HACK 26 · ${IDS.length} LUCHADORES`, HW / 2, 222, 13, '#f3e9d6', { spacing: 0.18 });
    ['1 JUGADOR', '2 JUGADORES', 'CONTROLES'].forEach((t, i) => {
      const on = S.menu === i;
      chrome(hud, t, HW / 2, 300 + i * 34, on ? 25 : 21, { pal: on ? 'gold' : 'chrome', alpha: on ? 1 : 0.75 });
      if (on && blink) { glyph(hud, '1', HW / 2 - 128, 300 + i * 34, 9); }
    });
    if (S.help) { controlsCard(hud); hints(hud, [['1', 'VOLVER', 'U']]); }
    else hints(hud, [['ud', 'ELEGIR', 'W S'], ['1', 'OK', 'U'], ['start', 'EMPEZAR', 'ENTER']]);
    return;
  }
  if (S.screen === 'select') {
    const rival = S.mode === 'cpu' && S.pick === 1;
    chrome(hud, rival ? 'ELIGE A TU RIVAL' : 'ELIGE TU LUCHADOR', HW / 2, 20, 17, { spacing: 0.1 });
    if (slotOn(1)) chrome(hud, 'VS', HW / 2, 120, 30, { pal: 'gold' });
    const show = (slot) => {
      const id = IDS[S.cur[slot]], d = FIGHTERS[id], x = slot ? HW - 14 : 14, align = slot ? 'right' : 'left';
      plain(hud, slot ? (S.mode === '2p' ? '2P' : 'CPU') : '1P', x, 16, 12, slot ? '#6fb0ff' : '#ff6a4a', { align });
      chrome(hud, d.name.toUpperCase(), x, 40, d.name.length > 18 ? 14 : 18, { align, pal: S.locked[slot] ? 'gold' : slot ? 'blue' : 'chrome', spacing: 0.04 });
      plain(hud, (d.company || d.role).toUpperCase().slice(0, 30), x, 60, 10, '#eef1f5', { align });
      glyph(hud, '3', slot ? HW - 22 : 22, 78, 7);
      plain(hud, d.special.name, slot ? HW - 34 : 34, 79, 10, '#ffd23a', { align, italic: true });
      if (!chars.has(id)) plain(hud, 'CARGANDO…', slot ? HW - 150 : 150, 150, 11, '#c9ced8');
    };
    show(0); if (slotOn(1)) show(1);
    // grilla
    const { cols, tile, x0, y0, rows } = GRID;
    hud.fillStyle = 'rgba(8,8,14,0.82)'; hud.fillRect(x0 - 6, y0 - 6, cols * tile + 12, rows * tile + 12);
    hud.imageSmoothingEnabled = true;
    if (thumbs.complete) for (let i = 0; i < IDS.length; i++) {
      const k = PEOPLE[i].i;
      hud.drawImage(thumbs, (k % THUMB.cols) * THUMB.size, Math.floor(k / THUMB.cols) * THUMB.size, THUMB.size, THUMB.size, x0 + (i % cols) * tile + 1, y0 + Math.floor(i / cols) * tile + 1, tile - 2, tile - 2);
    }
    // mismos compañeros de empresa del 1P: marca amarilla
    const comp = FIGHTERS[IDS[S.cur[0]]].special.name;
    for (let i = 0; i < IDS.length; i++) if (FIGHTERS[IDS[i]].special.name === comp) { hud.fillStyle = '#ffd23a'; hud.fillRect(x0 + (i % cols) * tile + 1, y0 + Math.floor(i / cols) * tile + tile - 4, tile - 2, 3); }
    for (const slot of [1, 0]) {
      if (!slotOn(slot)) continue;
      const i = S.cur[slot], x = x0 + (i % cols) * tile, y = y0 + Math.floor(i / cols) * tile;
      const pulse = S.locked[slot] ? 0 : Math.floor(S.frame / 8) % 2;
      hud.lineWidth = 3; hud.strokeStyle = '#0b0b10'; hud.strokeRect(x - 2 - pulse, y - 2 - pulse, tile + 4 + pulse * 2, tile + 4 + pulse * 2);
      hud.lineWidth = 2; hud.strokeStyle = S.locked[slot] ? '#ffd23a' : slot ? '#4a9bff' : '#ff4a3a'; hud.strokeRect(x - 1 - pulse, y - 1 - pulse, tile + 2 + pulse * 2, tile + 2 + pulse * 2);
    }
    hints(hud, [['lr', 'MOVER', ''], ['1', 'ELEGIR', 'U'], ['3', 'AL AZAR', 'O'], ['2', 'VOLVER', 'I']], HH - 18);
    return;
  }
  if (S.screen === 'stage') {
    vignette(hud, 0.4);
    chrome(hud, 'ELIGE ESCENARIO', HW / 2, 42, 30, { spacing: 0.1 });
    const st = S.stage;
    chrome(hud, st.name, HW / 2, 356, 34, { pal: 'gold' });
    plain(hud, st.sub, HW / 2, 388, 13, '#eef1f5', { spacing: 0.16 });
    const pulse = Math.sin(S.frame * 0.2) * 3;
    hud.fillStyle = '#ffd23a'; hud.strokeStyle = '#0c0c14'; hud.lineWidth = 3;
    for (const s of [-1, 1]) { const x = HW / 2 + s * (196 + pulse); hud.beginPath(); hud.moveTo(x + s * 14, 356); hud.lineTo(x - s * 6, 344); hud.lineTo(x - s * 6, 368); hud.closePath(); hud.stroke(); hud.fill(); }
    STAGE_IDS.forEach((_, i) => { hud.fillStyle = '#0b0b10'; hud.fillRect(HW / 2 - 26 + i * 18, 406, 14, 14); hud.fillStyle = i === S.stageI ? '#ffd23a' : '#8a909c'; hud.fillRect(HW / 2 - 24 + i * 18, 408, 10, 10); });
    hints(hud, [['lr', 'CAMBIAR', 'A D'], ['1', 'PELEAR', 'U'], ['2', 'VOLVER', 'I']]);
    return;
  }
  if (S.screen === 'fight') {
    const flash = Math.floor(S.frame / 6) % 2 === 0;
    S.f.forEach((f, i) => {
      const k = f.hp / f.maxHp;
      S.trail[i] = Math.max(k, S.trail[i] - 0.005);
      const side = i ? 1 : -1;
      lifeBar(hud, side, k, S.trail[i], flash);
      chrome(hud, f.data.short, i ? HW - 36 : 36, 54, 19, { align: i ? 'right' : 'left', pal: i ? 'blue' : 'chrome' });
      winMarks(hud, side, f.wins);
      { // recarga del botón 3
        const k = 1 - (f.sigCd || 0) / SIG_CD, bx = i ? HW - 36 - 120 : 36, by = 70;
        hud.fillStyle = '#0b0b10'; hud.fillRect(bx - 2, by - 2, 124, 9); hud.fillStyle = '#3a3f48'; hud.fillRect(bx, by, 120, 5);
        hud.fillStyle = k >= 1 ? (flash ? '#3fd6a0' : '#b8ffe2') : '#2a8f6c'; hud.fillRect(i ? bx + 120 - 120 * k : bx, by, 120 * k, 5);
      }
      { const x = f.fx, lab = x.freeze > 0 ? 'CONGELADO' : x.shock > 0 ? 'ELECTROCUTADO' : x.heal > 0 ? 'CURÁNDOSE' : x.squash > 0 ? 'APLASTADO' : x.puppet > 0 ? 'CONTROLADO' : x.confuse > 0 ? 'CONFUNDIDO' : x.slow > 0 ? 'LENTO' : x.burn > 0 ? (S.f[1 - i].data.special.burnLabel || 'QUEMÁNDOSE') : ''; if (lab && Math.floor(S.frame / 10) % 2) plain(hud, lab, i ? HW - 36 : 36, 106, 11, '#ffd23a', { align: i ? 'right' : 'left' }); }
      if (S.banner[i] > 0) { glyph(hud, '3', i ? HW - 44 : 44, 84, 8); chrome(hud, f.data.special.name, i ? HW - 58 : 58, 85, 15, { align: i ? 'right' : 'left', pal: 'gold', alpha: Math.min(1, S.banner[i] / 12), spacing: 0.04 }); }
      if (f.combo >= 2 && f.comboT > 0) chrome(hud, `${f.combo} GOLPES`, i ? HW - 40 : 40, 150, 22, { align: i ? 'right' : 'left', pal: 'red' });
    });
    hud.save(); hud.fillStyle = '#0b0b10'; hud.beginPath(); hud.arc(HW / 2, 32, 26, 0, 7); hud.fill(); hud.restore();
    chrome(hud, String(Math.max(0, Math.ceil(S.timer))).padStart(2, '0'), HW / 2, 33, 30, { pal: 'gold', italic: false, spacing: 0.02 });
    drawMsg();
    if (S.phase === 'over' && !S.demo) hints(hud, [['1', 'REVANCHA', 'U'], ['2', 'MENÚ', 'I']]);
    if (S.paused) {
      hud.fillStyle = 'rgba(0,0,0,0.45)'; hud.fillRect(0, 0, HW, HH);
      chrome(hud, 'PAUSA', HW / 2, 46, 40);
      controlsCard(hud, 74);
      hints(hud, [['start', 'SEGUIR', 'ENTER'], ['2', 'SALIR', 'I']]);
    }
  }
}

// ---------------- bucle ----------------
let last = performance.now(), acc = 0;
function step() {
  S.frame++; S.st++;
  if (S.fade) {
    S.fade.t++;
    if (S.fade.t === 14) S.fade.fn();
    if (S.fade.t >= 28) S.fade = null;
  }
  if (S.screen === 'title') titleStep();
  else if (S.screen === 'select') selectStep();
  else if (S.screen === 'stage') stageStep();
  else if (S.screen === 'fight') {
    if (S.paused) {
      const a = inputs[0].poll(), b = inputs[1].poll();
      if (S.pt0 !== S.frame - 1 && (a.pressed.start || b.pressed.start)) S.paused = false;
      else if (a.pressed.back || b.pressed.back) { S.paused = false; fadeTo(toSelect); }
    } else fightStep();
  }
  if (S.slow > 0) S.slow--;
  S.stage?.update?.(S.frame);
  endFrame();
}
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (S.slow > 0) dt *= 0.35;
  acc += dt;
  while (acc >= DT) { acc -= DT; step(); }
  frame();
}
function frame() {
  if (S.screen === 'fight' || S.screen === 'stage') for (const f of S.f) if (f) f.sync(S.frame);
  if (S.stage) updateCamera();
  if (S.dim > 0 && S.screen === 'fight' && !S.paused) S.dimK = Math.min(1, (S.dimK || 0) + 0.12); else S.dimK = Math.max(0, (S.dimK || 0) - 0.08);
  pass.uniforms.uFade.value = (S.fade ? Math.abs(S.fade.t - 14) / 14 : 1) * (1 - 0.3 * (S.dimK || 0));
  ps1Globals.uSnap.value.set(S.wobble ? RES.w : 0, S.wobble ? RES.h : 0);
  ps1Globals.uWire.value = 0;
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear();
  if (S.stage) renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  renderer.render(passScene, passCam);
  drawHud();
}

// ---------------- arranque ----------------
addEventListener('keydown', () => audioOn(), { once: true });
addEventListener('pointerdown', () => audioOn(), { once: true });
requestAnimationFrame(loop);
(async () => {
  if (S.demo && !q.get('p1')) S.cur = [Math.floor(Math.random() * IDS.length), Math.floor(Math.random() * IDS.length)];
  await ensureChar(IDS[S.cur[0]]); S.loaded = 1; await ensureChar(IDS[S.cur[1]]); S.loaded = 2;
  const scr = q.get('screen');
  if (q.get('fight') === '1' || S.demo) { S.locked = [true, true]; startMatch(); }
  else if (scr === 'select') toSelect();
  else if (scr === 'stage') toStageSelect();
  else toTitle();
  if (q.get('hide') === 'chars') clearChars();
  window.__pelea.ready = true;
})();

window.__pelea = { ensureChar, sigs, IDS, FIGHTERS, sim(n) { for (let i = 0; i < n; i++) step(); frame(); return S.screen + ':' + S.phase; }, S, scene, camera, renderer, chars, setStage, startMatch, toSelect, toTitle, toStageSelect, clearChars, fx, game, MOVES, envGlobals, ready: false };
