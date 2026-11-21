// Pintura del atlas: ruido, telas y utilidades de canvas. Todo determinista por semilla.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];

export function hex2rgb(h) {
  h = String(h || '#888').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgb2css = (c) => `rgb(${c.map((v) => Math.round(clamp(v, 0, 255))).join(',')})`;
export const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

// ---- ruido -------------------------------------------------------------
function h2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const grain = (x, y, s = 0) => h2(Math.floor(x), Math.floor(y), s);
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, oct = 4) {
  let t = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { t += vnoise(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2.03; }
  return t / n;
}

// ---- lienzo con búfer de píxeles ----------------------------------------
export class Atlas {
  constructor(S = 512) {
    this.S = S;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = S;
    this.g = this.canvas.getContext('2d', { willReadFrequently: true });
    this.img = this.g.createImageData(S, S);
  }
  // fn(u, v, x, y) → [r,g,b] con u,v ∈ [0,1] dentro del rect (v=0 arriba)
  fill(R, fn) {
    const d = this.img.data, S = this.S;
    for (let y = R.y; y < R.y + R.h; y++) {
      for (let x = R.x; x < R.x + R.w; x++) {
        const c = fn((x - R.x + 0.5) / R.w, (y - R.y + 0.5) / R.h, x, y);
        const k = (y * S + x) * 4;
        d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
      }
    }
  }
  commit() { this.g.putImageData(this.img, 0, 0); }
  // dibujo vectorial recortado a un rect; fn(g, R)
  draw(R, fn) {
    const g = this.g; g.save(); g.beginPath(); g.rect(R.x, R.y, R.w, R.h); g.clip(); fn(g, R); g.restore();
  }
}

// ---- telas ----------------------------------------------------------------
// Devuelven un factor de luz/color para una posición en el mundo (unidades de altura).
// Las telas "fotográficas" del PS1: grano fino, manchas grandes y pliegues con contraste.
export const FABRIC = {
  cotton: (wx, wy, s) => 1 + (fbm(wx * 30, wy * 30, s, 3) - 0.5) * 0.12 + (grain(wx * 700, wy * 700, s) - 0.5) * 0.05,
  fleece: (wx, wy, s) => 1 + (fbm(wx * 90, wy * 90, s, 3) - 0.5) * 0.3 + (grain(wx * 900, wy * 900, s) - 0.5) * 0.12,
  knit: (wx, wy, s) => 1 + (fbm(wx * 30, wy * 30, s, 3) - 0.5) * 0.1 + Math.sin(wx * 900) * 0.025 + (grain(wx * 800, wy * 800, s) - 0.5) * 0.05,
  twill: (wx, wy, s) => 1 + (fbm(wx * 25, wy * 25, s, 3) - 0.5) * 0.12 + (((wx + wy) * 520) % 1 < 0.5 ? 0.025 : -0.025) + (grain(wx * 700, wy * 700, s) - 0.5) * 0.04,
  leather: (wx, wy, s) => 1 + (fbm(wx * 14, wy * 14, s, 4) - 0.5) * 0.18 + (grain(wx * 500, wy * 500, s) - 0.5) * 0.04,
  skin: (wx, wy, s) => 1 + (fbm(wx * 22, wy * 22, s, 3) - 0.5) * 0.07 + (grain(wx * 600, wy * 600, s) - 0.5) * 0.025,
  plastic: (wx, wy, s) => 1 + (fbm(wx * 10, wy * 10, s, 2) - 0.5) * 0.08,
};

// Mezclilla: color base → índigo con desgaste claro, trama diagonal y vetas verticales.
export function denim(base, wx, wy, s, fade = 0) {
  const b = base;
  const light = mixc(b, [Math.min(255, b[0] * 1.35 + 60), Math.min(255, b[1] * 1.35 + 62), Math.min(255, b[2] * 1.3 + 58)], 1);
  const streak = fbm(wx * 120, wy * 9, s + 3, 3);
  const twill = ((wx * 640 + wy * 640) % 1) < 0.5 ? 1.04 : 0.96;
  const slub = (grain(wx * 260, wy * 900, s + 9) - 0.5) * 0.18;
  let t = clamp(fade * 0.85 + (streak - 0.5) * 0.7 + slub);
  const c = mixc(b, light, t);
  return mulc(c, twill * (1 + (grain(wx * 900, wy * 900, s) - 0.5) * 0.08));
}

// pliegue suave: banda oscura con borde claro (luz rasante horneada como en las texturas de la época)
export function crease(d, w) {
  // d: distancia firmada a la línea del pliegue, w: ancho
  const x = d / w;
  if (x < -1.6 || x > 1.6) return 1;
  return 1 - 0.32 * Math.exp(-x * x * 3) + 0.14 * Math.exp(-(x - 1.1) * (x - 1.1) * 5);
}

export function textOn(g, txt, x, y, size, color, o = {}) {
  g.save();
  g.fillStyle = color;
  g.font = `${o.weight || 900} ${size}px ${o.font || '"Arial Black", "Helvetica Neue", Impact, sans-serif'}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if (o.scaleX) { g.translate(x, y); g.scale(o.scaleX, 1); g.fillText(txt, 0, 0, o.max || 9999); }
  else g.fillText(txt, x, y, o.max || 9999);
  g.restore();
}

// costura: línea oscura con puntadas claras al lado
export function seam(g, pts, o = {}) {
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = o.dark || 'rgba(0,0,0,0.38)'; g.lineWidth = o.w || 1;
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
  if (o.stitch) {
    g.strokeStyle = o.stitch; g.lineWidth = o.sw || 0.8; g.setLineDash(o.dash || [1.6, 1.4]);
    const off = o.off ?? 1.6;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x + off, y) : g.moveTo(x + off, y))); g.stroke();
  }
  g.restore();
}
