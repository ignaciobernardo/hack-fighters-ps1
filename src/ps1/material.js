// Material PS1: textura con vecino más cercano, luz por Lambert, malla opcional encima
// (quads, sin diagonales) y "temblor" de vértices al ajustarlos a la grilla de píxeles.
// Más el pase de dither ordenado del modo PS1 (como el nodo Instant Dither).
import * as THREE from 'three';

export const ps1Globals = {
  uSnap: { value: new THREE.Vector2(0, 0) },
  uWire: { value: 0 },
  uWireColor: { value: new THREE.Color('#0d0d10') },
};

export function makePS1Material(tex) {
  const m = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSnap = ps1Globals.uSnap;
    sh.uniforms.uWire = ps1Globals.uWire;
    sh.uniforms.uWireColor = ps1Globals.uWireColor;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 bary;\nvarying vec3 vBary;\nuniform vec2 uSnap;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vBary = bary;
        if (uSnap.x > 0.0) {
          vec2 ndc = gl_Position.xy / gl_Position.w;
          vec2 px = floor((ndc * 0.5 + 0.5) * uSnap) + 0.5;
          gl_Position.xy = (px / uSnap * 2.0 - 1.0) * gl_Position.w;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBary;\nuniform float uWire;\nuniform vec3 uWireColor;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uWire > 0.0) {
          vec3 dd = fwidth(vBary);
          vec3 aa = smoothstep(vec3(0.0), dd * 1.3, vBary);
          float edge = 1.0 - min(min(aa.x, aa.y), aa.z);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, uWireColor, edge * uWire * 0.85);
        }`);
  };
  m.customProgramCacheKey = () => 'ps1-v1';
  return m;
}

// Pase final: nitidez, brillo previo y cuantización por canal con matriz de Bayer 4×4.
export function makeDitherPass() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null }, uRes: { value: new THREE.Vector2(1, 1) },
      uLevels: { value: 12 }, uSharp: { value: 0.2 }, uBright: { value: 1.0 }, uBg: { value: new THREE.Color('#3d3d3d') },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `
      uniform sampler2D tColor; uniform vec2 uRes; uniform float uLevels, uSharp, uBright; uniform vec3 uBg;
      varying vec2 vUv;
      vec3 srgb(vec3 c){ c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
      float bayer(vec2 p){
        int x = int(mod(p.x, 4.0)), y = int(mod(p.y, 4.0));
        int i = x + y * 4;
        float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
        return (m[i] + 0.5) / 16.0;
      }
      void main(){
        vec2 cell = floor(vUv * uRes);
        vec2 uv = (cell + 0.5) / uRes, px = 1.0 / uRes;
        vec4 t = texture2D(tColor, uv);
        vec3 bg = srgb(uBg);
        if (t.a < 0.003) { gl_FragColor = vec4(bg, 1.0); return; }
        // sombra de contacto (semitransparente sobre fondo vacío): a = opacidad²
        vec3 c = t.a < 0.5 ? bg * (1.0 - sqrt(t.a) * 1.2) : srgb(t.rgb);
        if (t.a >= 0.5) {
          vec3 n = vec3(0.0);
          for (int k = 0; k < 4; k++) {
            vec2 o = k == 0 ? vec2(px.x, 0.0) : k == 1 ? vec2(-px.x, 0.0) : k == 2 ? vec2(0.0, px.y) : vec2(0.0, -px.y);
            vec4 s = texture2D(tColor, uv + o);
            n += s.a < 0.5 ? c : srgb(s.rgb);
          }
          c += (c * 4.0 - n) * uSharp;
        }
        c *= uBright;
        float L = uLevels - 1.0;
        c = floor(clamp(c, 0.0, 1.0) * L + bayer(cell)) / L;
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const scene = new THREE.Scene();
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, magFilter: THREE.NearestFilter, minFilter: THREE.NearestFilter, samples: 0 });
  return { mat, scene, cam, rt };
}
