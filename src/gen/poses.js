// Poses en grados sobre huesos alineados al mundo (bind en T).
// Brazos: [giro sobre su eje, adelante/atrás, subir/bajar]  (orden YZX)
// Piernas: [adelante(-)/atrás(+), giro del pie, abrir]       (orden ZXY)
// Tronco/cabeza: [inclinar, girar, ladear]                   (orden YXZ)
// Las claves sin lado (arm, fore, thigh…) valen para ambos; el lado R se espeja solo.
import * as THREE from 'three';

const D = Math.PI / 180;
const ORDER = { arm: 'YZX', fore: 'YZX', hand: 'YZX', clav: 'YZX', thigh: 'ZXY', shin: 'ZXY', foot: 'ZXY' };
const SIDED = ['clav', 'arm', 'fore', 'hand', 'thigh', 'shin', 'foot'];

export const POSES = {
  tpose: {},
  stand: {
    feet: { L: [0.07, 0.0, 10], R: [-0.07, 0.0, -10] },
    arm: [0, -6, -78], fore: [0, -12, 0],
  },
  // guardia: pie izquierdo adelante, puños arriba.
  // feet = IK [x, z, giro°, alto, cabeceo°] · hands = IK [x, y, z, giro°] (unidades de altura)
  stance: {
    drop: 0.075, shift: [0, 0.01],
    feet: { L: [0.1, 0.2, 14], R: [-0.13, -0.2, -62] },
    hips: [8, -40, 0], spine: [8, 8, 0], chest: [6, 12, 0], neck: [0, -4, 0], head: [-8, -8, 0],
    hands: { L: [0.05, 0.71, 0.33, 150], R: [-0.16, 0.6, 0.17, 150] },
  },
  punch: {
    drop: 0.085, shift: [0, 0.08],
    feet: { L: [0.1, 0.28, 8], R: [-0.13, -0.24, -50, 0.012, 24] },
    hips: [10, 26, 0], spine: [8, 14, 0], chest: [4, 24, 0], neck: [0, -26, 0], head: [-6, -26, 0],
    hands: { L: [0.16, 0.7, 0.1, 150], R: [-0.03, 0.74, 0.52, 80] },
    elbow: { R: [-0.6, -0.6, -0.4] },
  },
  kick: {
    drop: 0.03, shift: [0, -0.05],
    feet: { R: [-0.06, -0.08, -58] },
    hips: [-16, -64, 8], spine: [-8, 10, 0], chest: [-4, 22, 0], neck: [6, 20, 0], head: [2, 24, 0],
    thighL: [-104, 20, 4], shinL: [8, 0, 0], footL: [30, 0, 0],
    hands: { L: [0.2, 0.7, -0.06, 150], R: [-0.12, 0.76, 0.08, 150] },
  },
  win: {
    feet: { L: [0.09, 0.03, 16], R: [-0.1, -0.02, -24] },
    hips: [0, -12, 0], spine: [-6, 0, 0], chest: [-8, 6, 0], head: [-10, 10, 4],
    hands: { L: [0.2, 1.12, 0.02, 0], R: [-0.17, 0.56, 0.1, 100] },
    elbow: { L: [1, 0.2, -0.3] },
  },
};

const e = new THREE.Euler(), q = new THREE.Quaternion(), qp = new THREE.Quaternion(), v = new THREE.Vector3();

export function resolve(pose) {
  // expande claves sin lado y espeja R
  const out = {};
  for (const [k, val] of Object.entries(pose || {})) {
    if (SIDED.includes(k)) { out[k + 'L'] = out[k + 'L'] || val; out[k + 'R'] = out[k + 'R'] || val; } else out[k] = val;
  }
  return out;
}

const mixA = (x, y, t, n) => { const o2 = []; for (let i = 0; i < n; i++) o2.push((x?.[i] ?? 0) + ((y?.[i] ?? 0) - (x?.[i] ?? 0)) * t); return o2; };
export function blend(a, b, t) {
  const A = resolve(a), B = resolve(b), out = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (k === 'feet' || k === 'hands' || k === 'elbow') {
      out[k] = {};
      for (const s of ['L', 'R']) { const x = A[k]?.[s], y = B[k]?.[s]; if (x && y) out[k][s] = mixA(x, y, t, 5); else if (t < 0.5 ? x : y) out[k][s] = t < 0.5 ? x : y; }
    } else if (k === 'drop') out.drop = (A.drop ?? 0) + ((B.drop ?? 0) - (A.drop ?? 0)) * t;
    else if (k === 'shift') out.shift = mixA(A.shift, B.shift, t, 2);
    else out[k] = mixA(A[k], B[k], t, 3);
  }
  return out;
}

export function add(a, b, k = 1) {
  const A = resolve(a), B = resolve(b), out = { ...A };
  for (const key of Object.keys(B)) {
    if (key === 'drop') out.drop = (A.drop ?? 0) + B.drop * k;
    else if (key === 'feet' || key === 'shift' || key === 'hands' || key === 'elbow') continue;
    else { const x = A[key] || [0, 0, 0], y = B[key]; out[key] = [x[0] + y[0] * k, x[1] + y[1] * k, x[2] + y[2] * k]; }
  }
  return out;
}

const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
// cuaternión que lleva el hueso (bind hacia -Y, frente +Z) a apuntar en dir con el frente hacia pole
function aim(dir, pole, out) {
  _y.copy(dir).multiplyScalar(-1).normalize();
  _z.copy(pole).addScaledVector(_y, -pole.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize(); _x.crossVectors(_y, _z);
  return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

export function applyPose(char, pose, o = {}) {
  const P = resolve(pose), bones = char.bones, H = char.P.H;
  for (const name in bones) {
    const b = bones[name];
    b.position.copy(b.userData.rest);
    const r = P[name];
    const base = name.replace(/[LR]$/, '');
    const order = ORDER[base] || 'YXZ';
    if (Array.isArray(r)) {
      const mir = name.endsWith('R') && SIDED.includes(base) ? -1 : 1;
      e.set(r[0] * D, r[1] * D * mir, r[2] * D * mir, order);
      b.quaternion.setFromEuler(e);
    } else b.quaternion.identity();
  }
  const feet = P.feet || {};
  bones.root.position.set(0, 0, 0);
  // chibi: misma bajada absoluta con piernas más cortas → cuclillas más marcadas, como un sprite
  if (P.drop) bones.hips.position.y -= P.drop * H * (char.P.chibi ? 1.05 : 1);
  if (P.shift) { bones.hips.position.x += P.shift[0] * H; bones.hips.position.z += P.shift[1] * H; }
  // todo en espacio del personaje: la cadena cuelga de root, que no rota
  const up = (b) => { b.updateMatrix(); b.matrixWorld.multiplyMatrices(b.parent.matrixWorld, b.matrix); };
  const charQ = (b, out) => { out.identity(); for (let k = b; k && k !== bones.root.parent; k = k.parent) out.premultiply(k.quaternion); return out; };
  const charP = (b, out) => { out.set(0, 0, 0); for (let k = b; k && k !== bones.root.parent; k = k.parent) out.applyQuaternion(k.quaternion).add(k.position); return out; };
  const hq = new THREE.Quaternion(), tq = new THREE.Quaternion(), sq = new THREE.Quaternion(), hp = new THREE.Vector3();
  // brazos por IK: hands = { L: [x, y, z, giro°], R: [...] } en unidades de altura, espacio del personaje
  const hands = P.hands || {};
  for (const s of ['L', 'R']) {
    const h = hands[s]; if (!h) continue;
    const sg = s === 'L' ? 1 : -1;
    const arm = bones['arm' + s], fore = bones['fore' + s], hand = bones['hand' + s];
    const a1 = char.P.upperArm, a2 = char.P.foreArm;
    charQ(arm.parent, hq); charP(arm, hp);
    const target = v.set(h[0] * H, h[1] * H, h[2] * H);
    // cuerpo chibi: el objetivo se mide desde el hombro y se escala al largo del brazo
    if (char.P.chibi) { target.y -= char.P.shoulderDy + 0.05 * H * char.P.chibi; target.sub(hp).multiplyScalar(char.P.armRatio).add(hp); }
    const d = target.clone().sub(hp);
    const dist = Math.min(d.length(), (a1 + a2) * 0.999);
    const dn = d.clone().normalize();
    const el = P.elbow?.[s];
    const pole = el ? new THREE.Vector3(el[0], el[1], el[2]) : new THREE.Vector3(sg * 0.45, -1, -0.35);
    pole.addScaledVector(dn, -pole.dot(dn)).normalize();
    const alpha = Math.acos(Math.min(1, Math.max(-1, (a1 * a1 + dist * dist - a2 * a2) / (2 * a1 * dist))));
    const axis = dn.clone().cross(pole).normalize();
    const ud = dn.clone().applyAxisAngle(axis, alpha);
    const elbow = hp.clone().addScaledVector(ud, a1);
    const fd = hp.clone().addScaledVector(dn, dist).sub(elbow).normalize();
    // base: X local = a lo largo del hueso (con signo del lado), Z local = contrario al codo
    const basis = (dir, out) => {
      _x.copy(dir).multiplyScalar(sg);
      _z.copy(pole).multiplyScalar(-1); _z.addScaledVector(_x, -_z.dot(_x)).normalize();
      _y.crossVectors(_z, _x);
      return out.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
    };
    basis(ud, tq); basis(fd, sq);
    if (h[3]) sq.multiply(q.setFromAxisAngle(_x.set(1, 0, 0), h[3] * D * sg));
    arm.quaternion.copy(hq).invert().multiply(tq);
    fore.quaternion.copy(tq).invert().multiply(sq);
  }
  const l1 = char.P.hipJointY - char.P.kneeY, l2 = char.P.kneeY - char.P.ankleY;
  let minY = Infinity, anyFK = false;
  for (const s of ['L', 'R']) {
    const thigh = bones['thigh' + s], shin = bones['shin' + s], foot = bones['foot' + s];
    const f = feet[s];
    let yaw, pitch = 0;
    if (f) {
      // IK de dos huesos: f = [x, z, giro°, alto, cabeceo°] en unidades de altura
      charQ(bones.hips, hq); charP(thigh, hp);
      yaw = (f[2] ?? 0) * D; pitch = (f[4] ?? 0) * D;
      const target = v.set(f[0] * H, char.P.ankleY + (f[3] ?? 0) * H, f[1] * H);
      const d = target.clone().sub(hp);
      const dist = Math.min(d.length(), (l1 + l2) * 0.999);
      const dn = d.clone().normalize();
      const pole = new THREE.Vector3(Math.sin(yaw), 0.15, Math.cos(yaw));
      const axis = dn.clone().cross(pole).normalize();
      const alpha = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
      const td = dn.clone().applyAxisAngle(axis, alpha);
      const knee = hp.clone().addScaledVector(td, l1);
      const sd = hp.clone().addScaledVector(dn, dist).sub(knee).normalize();
      aim(td, pole, tq); aim(sd, pole, sq);
      thigh.quaternion.copy(hq).invert().multiply(tq);
      shin.quaternion.copy(tq).invert().multiply(sq);
    } else {
      anyFK = true;
      charQ(shin, sq);
      v.set(0, 0, 1).applyQuaternion(sq);
      yaw = Math.atan2(v.x, v.z);
      pitch = (Array.isArray(P['foot' + s]) ? P['foot' + s][0] : 0) * D;
    }
    q.setFromEuler(e.set(pitch, yaw, 0, 'YXZ'));
    foot.quaternion.copy(sq).invert().multiply(q);
    if (!f) { charP(foot, hp); minY = Math.min(minY, hp.y - Math.max(0, Math.sin(pitch)) * char.P.footLen * 0.6); }
  }
  // sin IK: apoyar el pie más bajo en el suelo
  if (anyFK && !P.feet && o.ground !== false) bones.root.position.y = char.P.ankleY - minY;
  bones.root.updateMatrixWorld(true);
}

// Animaciones de muestra. Devuelven una pose para un tiempo t (s); el visor las
// muestrea a pocos cuadros por segundo para el look de animación limitada.
const breathe = (base, amt = 1) => (t) => {
  const s = Math.sin(t * 2.6), c = Math.sin(t * 2.6 + 1.1);
  return add(base, {
    spine: [1.6 * s, 0, 0], chest: [1.8 * s, 0, 0], head: [-2.2 * s, 0, 0],
    drop: 0.008 * s,
  }, amt);
};

export const ANIMS = {
  tpose: () => POSES.tpose,
  stand: breathe(POSES.stand, 0.5),
  stance: breathe(POSES.stance, 1),
  punch: (t) => { const k = t % 1.5; return k < 0.16 ? blend(POSES.stance, POSES.punch, k / 0.16) : k < 0.5 ? POSES.punch : k < 0.7 ? blend(POSES.punch, POSES.stance, (k - 0.5) / 0.2) : breathe(POSES.stance)(t); },
  kick: (t) => { const k = t % 1.7; return k < 0.2 ? blend(POSES.stance, POSES.kick, k / 0.2) : k < 0.6 ? POSES.kick : k < 0.85 ? blend(POSES.kick, POSES.stance, (k - 0.6) / 0.25) : breathe(POSES.stance)(t); },
  win: breathe(POSES.win, 0.4),
};
