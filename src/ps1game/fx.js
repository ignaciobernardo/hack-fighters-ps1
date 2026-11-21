// Efectos PS1: chispa de golpe (sprite de pocos píxeles + esquirlas de triángulos),
// proyectiles (texto pixelado con estela, o un plátano de polígonos que gira).
import * as THREE from 'three';
import { mat, tex, flat, bake, Mesher } from './kit.js';

function starTex(fill, core) {
  return tex(24, 24, (g, w) => {
    g.clearRect(0, 0, w, w);
    const c = w / 2, pts = 8;
    const path = (k) => {
      g.beginPath();
      for (let i = 0; i <= pts * 2; i++) {
        const a = (i / (pts * 2)) * Math.PI * 2, r = (i % 2 ? 0.28 : 0.5 + ((i * 37) % 5) / 30) * c * k;
        g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.closePath();
    };
    path(0.98); g.fillStyle = '#1a1420'; g.fill();
    path(0.82); g.fillStyle = fill; g.fill();
    path(0.45); g.fillStyle = core; g.fill();
  }, { repeat: false });
}

function textTex(text, color) {
  return tex(64, 32, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${text.length > 3 ? 17 : 22}px "Arial Black", system-ui, sans-serif`;
    g.lineJoin = 'round'; g.strokeStyle = '#140f1a'; g.lineWidth = 6; g.strokeText(text, w / 2, h / 2 + 1);
    g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 1);
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, w, 0); // (sin brillo extra)
    // umbral de alfa: bordes duros como en la consola
    const im = g.getImageData(0, 0, w, h); for (let i = 3; i < im.data.length; i += 4) im.data[i] = im.data[i] > 110 ? 255 : 0; g.putImageData(im, 0, 0);
  }, { repeat: false });
}

// plátano: tubo curvo de 6 lados, más grueso al medio, puntas cafés
function bananaGeo() {
  const M = new Mesher(), N = 10, S = 6;
  const ring = (i) => {
    const t = i / N, a = (t - 0.5) * 2.2;
    const cx = Math.sin(a) * 0.32, cy = (1 - Math.cos(a)) * 0.32 - 0.1;
    const r = 0.03 + Math.sin(t * Math.PI) * 0.075;
    const tx = Math.cos(a), ty = Math.sin(a);
    return Array.from({ length: S }, (_, k) => {
      const b = (k / S) * Math.PI * 2;
      const nx = -ty * Math.cos(b), ny = tx * Math.cos(b), nz = Math.sin(b);
      return [cx + nx * r, cy + ny * r, nz * r];
    });
  };
  const rings = Array.from({ length: N + 1 }, (_, i) => ring(i));
  const yel = [1, 0.84, 0.2], brown = [0.42, 0.28, 0.12], green = [0.55, 0.7, 0.2];
  for (let i = 0; i < N; i++) for (let k = 0; k < S; k++) {
    const k2 = (k + 1) % S;
    const c = i === 0 ? brown : i === N - 1 ? green : yel;
    const ridge = k % 2 ? 0.88 : 1;
    M.quad(rings[i][k], rings[i + 1][k], rings[i + 1][k2], rings[i][k2], undefined, c.map((v) => v * ridge));
  }
  return bake(M.geometry(), { dir: [-0.4, 0.8, 0.6], amb: 0.6, dif: 0.55 });
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.hitMat = mat(starTex('#ffd21f', '#fffbe8'), { alphaTest: 0.5, side: THREE.DoubleSide, fog: false, vc: false });
    this.blockMat = mat(starTex('#8ab4ff', '#f3f6ff'), { alphaTest: 0.5, side: THREE.DoubleSide, fog: false, vc: false });
    this.hitMat.depthTest = this.blockMat.depthTest = false;
    this.shardGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.05, 0), new THREE.Vector3(-0.025, -0.03, 0), new THREE.Vector3(0.025, -0.03, 0)]);
    this.shardMat = [new THREE.MeshBasicMaterial({ color: '#fff3a8', side: THREE.DoubleSide, depthTest: false, fog: false }), new THREE.MeshBasicMaterial({ color: '#ff9a2a', side: THREE.DoubleSide, depthTest: false, fog: false })];
    this.sparkGeo = new THREE.PlaneGeometry(1, 1);
    this.items = [];
    this.banana = bananaGeo();
    this.bananaMat = mat(null, { side: THREE.DoubleSide });
    this.textMats = new Map();
  }

  spark(x, y, z, blocked, heavy) {
    const m = new THREE.Mesh(this.sparkGeo, blocked ? this.blockMat : this.hitMat);
    m.position.set(x, y, z + 0.5); m.rotation.z = Math.random() * 6; m.renderOrder = 20;
    m.userData = { kind: 'spark', t: 0, s: (heavy ? 0.95 : 0.65) * (blocked ? 0.8 : 1) };
    this.scene.add(m); this.items.push(m);
    const n = blocked ? 4 : heavy ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(this.shardGeo, this.shardMat[i % 2]);
      const a = Math.random() * Math.PI * 2, v = 1.5 + Math.random() * (heavy ? 3.5 : 2.2);
      s.position.set(x, y, z + 0.5); s.renderOrder = 21;
      s.userData = { kind: 'shard', t: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v + 1.2, vr: (Math.random() - 0.5) * 30 };
      this.scene.add(s); this.items.push(s);
    }
  }

  shotMesh(sp) {
    const grp = new THREE.Group();
    const s = sp.size ?? 1;
    if (sp.mesh === 'banana') {
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(this.banana, i ? new THREE.MeshBasicMaterial({ color: '#f2c230', transparent: true, opacity: [1, 0.35, 0.15][i], depthWrite: false }) : this.bananaMat);
        m.scale.setScalar(1.6 * s); m.userData.trail = i;
        grp.add(m);
      }
      grp.userData.spin = true;
    } else {
      if (!this.textMats.has(sp.text)) this.textMats.set(sp.text, textTex(sp.text, sp.color));
      const t = this.textMats.get(sp.text);
      for (let i = 0; i < 3; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 * s, 0.45 * s), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, opacity: [1, 0.45, 0.2][i], depthWrite: false, fog: false }));
        m.position.z = -i * 0.01; m.userData.trail = i;
        grp.add(m);
      }
    }
    grp.renderOrder = 15;
    this.scene.add(grp);
    return grp;
  }

  update() {
    for (const m of this.items) {
      const u = m.userData; u.t++;
      if (u.kind === 'spark') {
        const k = u.t / 9;
        m.scale.setScalar(u.s * (0.4 + 0.8 * Math.min(1, k * 2.4)));
        m.visible = u.t < 9 && (u.t < 6 || u.t % 2 === 0);
        m.rotation.z += 0.05;
      } else {
        u.vy -= 0.25; m.position.x += u.vx / 60; m.position.y += u.vy / 60; m.rotation.z += u.vr / 60;
        m.visible = u.t < 16;
      }
    }
    this.items = this.items.filter((m) => {
      const alive = m.userData.kind === 'spark' ? m.userData.t < 10 : m.userData.t < 18;
      if (!alive) this.scene.remove(m);
      return alive;
    });
  }

  clear() { for (const m of this.items) this.scene.remove(m); this.items = []; }
}
