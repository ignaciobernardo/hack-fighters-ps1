// Visor del estilo PS1: atlas a la izquierda (con la malla UV encima), modelo a la derecha.
// Mismas fichas, esqueleto y poses que el generador cel. http://127.0.0.1:8114/ps1.html
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ANIMS, POSES, applyPose } from '../gen/poses.js';
import { buildPS1, loadAssets, loadFaces } from './build.js';
import { ps1Globals, makeDitherPass } from './material.js';

const files = import.meta.glob('../../characters/*.json', { eager: true });
const drafts = import.meta.glob('../../characters/drafts/*.json', { eager: true });
const order = ['ian', 'matias', 'paolo', 'rafa', 'juan'];
const made = Object.values(files).map((m) => structuredClone(m.default));
made.sort((a, b) => (order.indexOf(a.id) + 99) % 99 - (order.indexOf(b.id) + 99) % 99);
const rough = Object.values(drafts).map((m) => structuredClone(m.default)).sort((a, b) => a.name.localeCompare(b.name, 'es'));
const roster = [...made, ...rough];

const q = new URLSearchParams(location.search);
const state = {
  id: q.get('c') || made[0]?.id || roster[0].id,
  anim: q.get('pose') || 'stance',
  mode: q.get('mode') || 'ps1',      // ps1 (dither) | tex | wire
  fps: +(q.get('fps') || 12),
  yaw: +(q.get('yaw') ?? 35),
  bg: q.get('bg') || '#3d3d3d',
  levels: +(q.get('levels') || 12),
  px: +(q.get('px') || 0),          // tamaño del píxel del modo dither (0 = automático)
  wobble: q.get('wobble') === '1',
  lineup: q.get('lineup') === '1',
  paused: q.get('paused') === '1',
  spin: false,
};
if (q.get('ui') === '0') document.body.classList.add('bare');

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.target.set(0, 0.9, 0);
camera.position.set(0, 1.0, 6);
scene.add(new THREE.HemisphereLight('#ffffff', '#5e5e66', 1.7));
const key = new THREE.DirectionalLight('#ffffff', 1.5);
key.position.set(-1.6, 2.2, 3); camera.add(key); scene.add(camera);
const dither = makeDitherPass();

const shadowMat = new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.25, depthWrite: false });
const mkShadow = () => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 10), shadowMat); m.rotation.x = -Math.PI / 2; m.scale.set(0.36, 0.18, 1); m.position.y = 0.002; return m; };

let chars = [], current = null, token = 0;

function clear() {
  for (const c of chars) { scene.remove(c.group); scene.remove(c.shadow); c.dispose(); }
  chars = []; current = null;
}

async function rebuild() {
  const my = ++token;
  const team = state.lineup ? made : [roster.find((r) => r.id === state.id) || roster[0]];
  const assets = await Promise.all(team.map(loadAssets));
  if (my !== token) return;
  clear();
  team.forEach((spec, i) => {
    if (!assets[i]) return;
    const c = buildPS1(spec, assets[i]);
    const x = (i - (team.length - 1) / 2) * 0.95;
    c.group.position.x = x;
    c.shadow = mkShadow(); c.shadow.position.x = x;
    scene.add(c.group); scene.add(c.shadow);
    chars.push(c);
  });
  current = chars.find((c) => c.spec.id === state.id) || chars[0] || null;
  lastQ = -1;
  hud(); drawAtlas();
}

function hud() {
  const el = document.getElementById('stats');
  if (!current) { el.innerHTML = '<span class="name">sin foto</span>'; return; }
  const s = current.stats;
  const row = (k, v) => `<span class="k">${k}</span><span>${v.toLocaleString('es')}</span>`;
  el.innerHTML = `<span class="name">${current.spec.name}</span>` + row('Objetos', 1) + row('Vértices', s.verts) + row('Aristas', s.edges) + row('Caras', s.faces) + row('Triángulos', s.tris);
  document.getElementById('imgname').textContent = `${current.spec.id}-atlas.png · 512 × 512`;
}

function drawAtlas() {
  const el = document.getElementById('atlas');
  const g = el.getContext('2d'), N = el.width, k = N / 512;
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#000'; g.fillRect(0, 0, N, N);
  if (!current) return;
  g.drawImage(current.atlas.canvas, 0, 0, N, N);
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2.2; g.beginPath();
  const path = () => {
    for (const t of current.uvTris) {
      const p = [[t[0] * k, t[1] * k], [t[2] * k, t[3] * k], [t[4] * k, t[5] * k]];
      for (let i = 0; i < 3; i++) { if (t[6] === (i + 2) % 3) continue; g.moveTo(p[i][0], p[i][1]); g.lineTo(p[(i + 1) % 3][0], p[(i + 1) % 3][1]); }
    }
  };
  path(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.beginPath(); path(); g.stroke();
}

function resize() {
  const el = canvas.parentElement;
  renderer.setSize(el.clientWidth, el.clientHeight, false);
  camera.aspect = el.clientWidth / el.clientHeight; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

let lastQ = -1, customPose = null;
const t0 = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const t = (performance.now() - t0) / 1000;
  controls.update();
  const tq = state.paused ? 0 : Math.floor(t * state.fps);
  if (tq !== lastQ) {
    lastQ = tq;
    const fn = ANIMS[state.anim] || ANIMS.stance;
    chars.forEach((c, i) => {
      c.group.rotation.y = (state.yaw * Math.PI) / 180 + (state.spin ? t * 0.9 : 0);
      applyPose(c, customPose || fn(tq / state.fps + i * 0.37));
    });
  }
  const w = canvas.width, h = canvas.height;
  ps1Globals.uWire.value = state.mode === 'wire' ? 1 : 0;
  if (state.mode === 'ps1') {
    const pxs = state.px || Math.max(2, Math.round(h / 300));
    const sh = Math.round(h / pxs), sw = Math.round(w / pxs);
    if (dither.rt.width !== sw || dither.rt.height !== sh) dither.rt.setSize(sw, sh);
    ps1Globals.uSnap.value.set(state.wobble ? sw : 0, state.wobble ? sh : 0);
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(dither.rt); renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = dither.mat.uniforms;
    u.tColor.value = dither.rt.texture; u.uRes.value.set(sw, sh); u.uBg.value.set(state.bg); u.uLevels.value = state.levels;
    renderer.render(dither.scene, dither.cam);
  } else {
    ps1Globals.uSnap.value.set(0, 0);
    renderer.setClearColor(state.bg, 1);
    renderer.render(scene, camera);
  }
}

// ---------------- interfaz ----------------
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (v !== false && v != null) e.setAttribute(k, v); } for (const kid of kids.flat()) e.append(kid?.nodeType ? kid : document.createTextNode(kid ?? '')); return e; };
let filter = '', faces = {};
function mountRoster() {
  const el = document.getElementById('roster');
  const norm = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const slug = (s) => (s.photo || s.id).replace(/\.png$/, '');
  const who = (s) => h('button', { class: 'who' + (s.id === state.id && !state.lineup ? ' on' : ''), onclick: () => api.select(s.id) },
    h('img', { src: '/photos/' + s.photo, alt: '', loading: 'lazy' }), h('span', {}, h('b', {}, s.name), h('small', {}, '@' + (s.handle || s.id))));
  const list = h('div');
  const fill = () => {
    const f = norm(filter);
    const hits = rough.filter((s) => faces[slug(s)] && (!f || norm(s.name + ' ' + (s.handle || '')).includes(f)));
    list.replaceChildren(...hits.slice(0, 60).map(who), hits.length > 60 ? h('h2', {}, `y ${hits.length - 60} más: escribe para filtrar`) : '');
  };
  fill();
  el.replaceChildren(
    ...made.map(who),
    h('button', { class: 'who' + (state.lineup ? ' on' : ''), onclick: () => { state.lineup = !state.lineup; api.cam(0, 4, state.lineup ? 4 + made.length * 1.2 : 6, 0.9); rebuild(); mountRoster(); } }, h('span', {}, h('b', {}, state.lineup ? 'Ver uno solo' : 'Ver a todos juntos'))),
    h('h2', {}, 'Resto del hack (desde su foto)'),
    h('input', { class: 'find', type: 'search', placeholder: 'Buscar persona', value: filter, oninput: (e) => { filter = e.target.value; fill(); } }),
    list,
  );
}
function mountBar() {
  const row = (items, cur, on) => h('div', { class: 'seg' }, items.map(([v, l]) => h('button', { class: (Array.isArray(cur) ? cur.includes(v) : v === cur) ? 'on' : '', onclick: () => on(v) }, l)));
  document.getElementById('bar').replaceChildren(
    row([['ps1', 'Dither'], ['tex', 'Textura'], ['wire', 'Malla + textura']], state.mode, (v) => api.setMode(v)),
    row(Object.keys(ANIMS).map((k) => [k, { tpose: 'T', stand: 'De pie', stance: 'Guardia', punch: 'Golpe', kick: 'Patada', win: 'Victoria' }[k] || k]), state.anim, (v) => api.setAnim(v)),
    row([['wobble', 'Temblor'], ['spin', 'Girar']], [state.wobble ? 'wobble' : '', state.spin ? 'spin' : ''], (v) => { state[v] = !state[v]; mountBar(); }),
    row([['glb', 'Exportar GLB'], ['png', 'Exportar atlas']], '', (v) => (v === 'glb' ? api.exportGLB() : api.exportAtlas())),
  );
}

const api = {
  state, roster, made, scene, camera, controls, renderer, THREE, POSES,
  get char() { return current; },
  get chars() { return chars; },
  async select(id) { state.id = id; state.lineup = false; mountRoster(); await rebuild(); },
  rebuild,
  setMode(m) { state.mode = m; mountBar(); },
  setAnim(a) { state.anim = a; customPose = null; lastQ = -1; mountBar(); },
  setPose(p) { customPose = p; lastQ = -1; },
  async lineup(on = true) { state.lineup = on; await rebuild(); },
  cam(az = 0, el = 0, dist = 6, ty = 0.9, tx = 0) {
    controls.target.set(tx, ty, 0);
    const a = (az * Math.PI) / 180, e = (el * Math.PI) / 180;
    camera.position.set(tx + Math.sin(a) * Math.cos(e) * dist, ty + Math.sin(e) * dist, Math.cos(a) * Math.cos(e) * dist);
    controls.update();
  },
  exportAtlas() {
    if (!current) return;
    const a = document.createElement('a'); a.href = current.atlas.canvas.toDataURL('image/png'); a.download = current.spec.id + '-atlas.png'; a.click();
  },
  // GLB con rig y el atlas incrustado (se abre en Blender con la textura puesta)
  exportGLB(download = true) {
    const c = current; if (!c) return;
    applyPose(c, POSES.tpose, { ground: false });
    const yaw = c.group.rotation.y, x = c.group.position.x;
    c.group.rotation.y = 0; c.group.position.x = 0; c.group.updateMatrixWorld(true);
    const mesh = c.meshes[0], keep = mesh.material;
    mesh.material = new THREE.MeshStandardMaterial({ name: c.spec.id + '-atlas', map: c.tex, roughness: 1, metalness: 0, side: THREE.DoubleSide });
    // vértices soldados (los triángulos sueltos del visor se comparten donde coinciden posición, normal, UV y pesos)
    const geo = mesh.geometry, flat = geo.clone(); flat.deleteAttribute('bary');
    const welded = mergeVertices(flat, 1e-5); flat.dispose();
    mesh.geometry = welded;
    return new Promise((resolve) => new GLTFExporter().parse(c.group, (buf) => {
      const tmp = mesh.material; mesh.material = keep; tmp.map = null; tmp.dispose();
      mesh.geometry = geo; welded.dispose();
      c.group.rotation.y = yaw; c.group.position.x = x; lastQ = -1;
      if (download) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' })); a.download = c.spec.id + '.glb'; a.click(); }
      resolve(download ? buf.byteLength : buf);
    }, (e) => { console.error(e); resolve(0); }, { binary: true }));
  },
};
window.__hf = api;

resize();
loadFaces().then((f) => { faces = f; mountRoster(); });
mountRoster(); mountBar();
rebuild();
frame();
