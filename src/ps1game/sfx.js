// Sonidos sintetizados con WebAudio (sin archivos).
// ---- sonido: todo sintetizado con WebAudio (sin archivos) ----------------------
let ac = null, master = null;
export function audioOn() {
  if (!ac) { ac = new AudioContext(); master = ac.createGain(); master.gain.value = 0.5; master.connect(ac.destination); }
  if (ac.state === 'suspended') ac.resume();
}
function noise(dur) {
  const b = ac.createBuffer(1, Math.ceil(ac.sampleRate * dur), ac.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ac.createBufferSource(); s.buffer = b; return s;
}
function env(node, t0, a, peak, dur) {
  const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  node.connect(g); g.connect(master); return g;
}
function burst(t0, dur, f0, f1, q, peak, type = 'lowpass') {
  const n = noise(dur), f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t0); f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  n.connect(f); env(f, t0, 0.004, peak, dur); n.start(t0); n.stop(t0 + dur);
}
function tone(t0, dur, f0, f1, peak, type = 'sine') {
  const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  env(o, t0, 0.005, peak, dur); o.start(t0); o.stop(t0 + dur);
}
export function sfx(kind) {
  if (!ac) return;
  const t = ac.currentTime;
  switch (kind) {
    case 'whiff': burst(t, 0.09, 2400, 700, 1.2, 0.18, 'bandpass'); break;
    case 'whiffHeavy': burst(t, 0.16, 1600, 300, 1, 0.24, 'bandpass'); break;
    case 'hit': burst(t, 0.12, 5000, 600, 0.8, 0.6); tone(t, 0.12, 180, 60, 0.5); break;
    case 'heavy': burst(t, 0.22, 4000, 200, 0.7, 0.8); tone(t, 0.22, 140, 40, 0.8); break;
    case 'block': burst(t, 0.06, 6000, 3000, 2, 0.35, 'highpass'); tone(t, 0.05, 900, 600, 0.15, 'square'); break;
    case 'jump': tone(t, 0.08, 300, 520, 0.08, 'triangle'); break;
    case 'land': burst(t, 0.06, 800, 200, 1, 0.15); break;
    case 'thud': burst(t, 0.2, 900, 80, 0.8, 0.5); tone(t, 0.2, 90, 40, 0.5); break;
    case 'shot': tone(t, 0.25, 220, 880, 0.18, 'sawtooth'); burst(t, 0.25, 3000, 800, 1, 0.2, 'bandpass'); break;
    case 'rise': tone(t, 0.2, 200, 700, 0.2, 'square'); break;
    case 'ko': tone(t, 0.9, 110, 30, 0.9); burst(t, 0.8, 2000, 60, 0.6, 0.7); break;
    case 'select': tone(t, 0.06, 660, 880, 0.12, 'square'); break;
    case 'ok': tone(t, 0.12, 520, 1040, 0.16, 'square'); break;
    case 'round': tone(t, 0.15, 440, 440, 0.12, 'square'); tone(t + 0.16, 0.25, 660, 660, 0.12, 'square'); break;
    case 'super': tone(t, 0.5, 120, 900, 0.22, 'sawtooth'); burst(t, 0.6, 400, 6000, 0.7, 0.3, 'bandpass'); tone(t + 0.5, 0.5, 70, 35, 0.8); burst(t + 0.5, 0.5, 3000, 100, 0.6, 0.6); break;
    case 'cutin': burst(t, 0.3, 800, 5000, 1.5, 0.3, 'bandpass'); break;
    case 'counter': tone(t, 0.25, 1800, 1200, 0.22, 'square'); tone(t, 0.3, 2400, 1600, 0.12, 'triangle'); burst(t, 0.2, 6000, 1200, 1, 0.5); tone(t, 0.25, 120, 40, 0.8); break;
    case 'burst': tone(t, 0.7, 90, 30, 0.9); burst(t, 0.7, 6000, 80, 0.5, 0.9); tone(t, 0.35, 600, 1400, 0.15, 'square'); break;
    case 'reset': tone(t, 0.35, 1400, 180, 0.2, 'triangle'); tone(t + 0.05, 0.4, 2100, 260, 0.1, 'sine'); burst(t, 0.3, 300, 4000, 2, 0.15, 'bandpass'); break;
    case 'tele': for (let i = 0; i < 5; i++) tone(t + i * 0.035, 0.03, 300 + ((i * 397) % 900), 200 + ((i * 211) % 700), 0.12, 'square'); break;
    case 'grab': burst(t, 0.1, 1200, 300, 1, 0.4); tone(t, 0.1, 160, 90, 0.4); break;
    case 'slam': tone(t, 0.5, 80, 28, 1); burst(t, 0.6, 2500, 60, 0.6, 0.8); break;
    case 'wall': burst(t, 0.3, 5000, 300, 0.7, 0.7); tone(t, 0.3, 110, 45, 0.7); break;
    case 'parry': tone(t, 0.3, 2600, 2600, 0.2, 'sine'); tone(t, 0.25, 3900, 3900, 0.08, 'sine'); burst(t, 0.05, 8000, 4000, 2, 0.3, 'highpass'); break;
    case 'dash': burst(t, 0.14, 900, 3000, 1.4, 0.2, 'bandpass'); break;
    case 'beam': tone(t, 1.1, 180, 140, 0.25, 'sawtooth'); burst(t, 1.1, 1800, 600, 0.8, 0.35, 'bandpass'); break;
    case 'fall': tone(t, 0.35, 1400, 300, 0.12, 'triangle'); break;
    case 'boom': burst(t, 0.4, 3500, 80, 0.6, 0.7); tone(t, 0.35, 100, 35, 0.7); break;
    case 'tech': tone(t, 0.08, 900, 900, 0.18, 'square'); tone(t + 0.07, 0.1, 1300, 1300, 0.14, 'square'); break;
    case 'impact': burst(t, 0.05, 9000, 3000, 1, 0.5, 'highpass'); break;
  }
}
