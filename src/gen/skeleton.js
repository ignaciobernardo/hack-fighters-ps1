// Proporciones y esqueleto. Bind en T-pose, mirando a +Z, con todos los huesos
// alineados al mundo (rotación identidad), así las poses se escriben en ejes simples.
import * as THREE from 'three';
import { lerp } from './geo.js';

// chibi ∈ [0,1]: 0 = proporciones reales, 1 = proporciones de sprite (≈3,5 cabezas):
// cabeza grande, tronco y piernas cortos, manos y pies grandes.
export function proportions(spec, chibi = 0) {
  const b = spec.body || {};
  const ck = chibi;
  const H = b.height ?? 1.78;
  const build = b.build ?? 0.5;          // 0 flaco … 1 macizo
  const sh = b.shoulders ?? 0.5;         // 0 angosto … 1 ancho
  const hipsW = b.hips ?? 0.4;           // 0 angosto … 1 ancho
  const headS = b.head ?? 1;
  const legs = b.legs ?? 0.5;            // largo de piernas
  const headH = lerp(0.152, 0.27, ck) * H * headS;       // mentón → coronilla
  const chinY = H - headH;
  const hipJointY = H * lerp(lerp(0.52, 0.575, legs), lerp(0.335, 0.37, legs), ck);
  const ankleY = H * 0.052;
  const P = {
    H, build, sh, hipsW, headS, headH, chinY,
    k: lerp(0.84, 1.2, build),            // grosor general
    headR: headH * 0.5,
    headC: new THREE.Vector3(0, chinY + headH * 0.52, 0.004 * H),
    neckY: chinY - lerp(0.012, 0.004, ck) * H,
    neckBaseY: chinY - lerp(0.028, 0.012, ck) * H,
    shoulderY: chinY - lerp(0.074, 0.05, ck) * H,
    shoulderX: H * lerp(0.09, 0.118, sh),
    chestY: lerp(hipJointY, chinY, 0.6),
    spineY: lerp(hipJointY, chinY, 0.3),
    hipsY: hipJointY + 0.035 * H,
    hipJointY,
    hipX: H * lerp(0.044, 0.056, hipsW),
    crotchY: hipJointY - 0.045 * H,
    kneeY: lerp(ankleY, hipJointY, 0.5),
    ankleY,
    upperArm: H * lerp(0.158, 0.112, ck),
    foreArm: H * lerp(0.146, 0.1, ck),
    hand: H * 0.1,
    footLen: H * lerp(0.158, 0.17, ck),
    chibi: ck,
    handK: lerp(1, 1.32, ck),
    limbK: lerp(1, 1.18, ck),
    footK: lerp(1, 1.12, ck),
  };
  // para adaptar las poses (escritas para proporciones reales) al cuerpo chibi
  const shN = H - 0.152 * H * headS - 0.074 * H;
  P.armRatio = (P.upperArm + P.foreArm) / (H * 0.304);
  P.shoulderDy = shN - P.shoulderY;
  P.legRatio = (hipJointY - ankleY) / (H * lerp(0.52, 0.575, legs) - ankleY);
  P.elbowX = P.shoulderX + P.upperArm;
  P.wristX = P.elbowX + P.foreArm;
  return P;
}

export function buildSkeleton(P) {
  const bones = {}; const list = [];
  const mk = (name, parent, x, y, z) => {
    const b = new THREE.Bone(); b.name = name;
    b.userData.world = new THREE.Vector3(x, y, z);
    const pw = parent ? bones[parent].userData.world : new THREE.Vector3();
    b.position.set(x - pw.x, y - pw.y, z - pw.z);
    b.userData.rest = b.position.clone();
    if (parent) bones[parent].add(b);
    bones[name] = b; list.push(b);
    return b;
  };
  mk('root', null, 0, 0, 0);
  mk('hips', 'root', 0, P.hipsY, 0);
  mk('spine', 'hips', 0, P.spineY, 0);
  mk('chest', 'spine', 0, P.chestY, 0);
  mk('neck', 'chest', 0, P.neckBaseY, -0.004 * P.H);
  mk('head', 'neck', 0, P.chinY + P.headH * 0.12, 0);
  for (const [s, sg] of [['L', 1], ['R', -1]]) {
    mk('clav' + s, 'chest', sg * P.H * 0.03, P.shoulderY - 0.012 * P.H, 0);
    mk('arm' + s, 'clav' + s, sg * P.shoulderX, P.shoulderY, 0);
    mk('fore' + s, 'arm' + s, sg * P.elbowX, P.shoulderY, 0);
    mk('hand' + s, 'fore' + s, sg * P.wristX, P.shoulderY, 0);
    mk('thigh' + s, 'hips', sg * P.hipX, P.hipJointY, 0);
    mk('shin' + s, 'thigh' + s, sg * P.hipX, P.kneeY, 0);
    mk('foot' + s, 'shin' + s, sg * P.hipX, P.ankleY, 0);
  }
  bones.root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const index = {}; list.forEach((b, i) => (index[b.name] = i));
  return { bones, list, skeleton, index, root: bones.root };
}
