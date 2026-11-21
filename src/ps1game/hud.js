// HUD y pantallas en un canvas 2D de 640×480 escalado sin suavizado (resolución "alta"
// de la consola): letras cromadas en cursiva, barras de vida, botones de control.
export const HW = 640, HH = 480;

const FONT = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const PAL = {
  chrome: [[0, '#ffffff'], [0.32, '#e6ebf1'], [0.47, '#9aa3b0'], [0.53, '#4d5563'], [0.72, '#c9d0da'], [1, '#ffffff']],
  gold: [[0, '#fff8d6'], [0.38, '#ffd447'], [0.5, '#e08a12'], [0.56, '#9c4a0a'], [0.78, '#ffc93a'], [1, '#fff1a8']],
  red: [[0, '#ffe1d6'], [0.4, '#ff6a4a'], [0.52, '#b81d12'], [0.75, '#ff5a3a'], [1, '#ffd0c0']],
  blue: [[0, '#e3f0ff'], [0.4, '#6fb0ff'], [0.52, '#1f4fb8'], [0.75, '#5aa0ff'], [1, '#d6e8ff']],
};

export function chrome(g, text, x, y, size, o = {}) {
  g.save();
  g.font = `${o.italic === false ? '' : 'italic '}900 ${size}px ${FONT}`;
  g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  g.letterSpacing = `${Math.round((o.spacing ?? 0.07) * size)}px`;
  g.lineJoin = 'round';
  if (o.alpha != null) g.globalAlpha = o.alpha;
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillText(text, x + size * 0.07, y + size * 0.09);
  g.strokeStyle = o.stroke || '#0c0c14'; g.lineWidth = Math.max(3, size * 0.2); g.strokeText(text, x, y);
  const gr = g.createLinearGradient(0, y - size * 0.48, 0, y + size * 0.48);
  for (const [k, c] of PAL[o.pal || 'chrome']) gr.addColorStop(k, c);
  g.fillStyle = gr; g.fillText(text, x, y);
  g.restore();
  return g.measureText ? null : null;
}

export function plain(g, text, x, y, size, color = '#fff', o = {}) {
  g.save();
  g.font = `${o.italic ? 'italic ' : ''}${o.weight || 800} ${size}px ${o.font || FONT}`;
  g.textAlign = o.align || 'center'; g.textBaseline = 'middle';
  g.letterSpacing = `${Math.round((o.spacing ?? 0.05) * size)}px`;
  if (o.alpha != null) g.globalAlpha = o.alpha;
  g.lineJoin = 'round'; g.strokeStyle = '#0a0a10'; g.lineWidth = Math.max(2, size * 0.24); g.strokeText(text, x, y);
  g.fillStyle = color; g.fillText(text, x, y);
  g.restore();
}

// botones del gabinete: fila de arriba 1 2 3, fila de abajo 4 5 6
export const BTN_COLOR = { 1: '#ffd23a', 2: '#ff5a3a', 3: '#3fd6a0', 4: '#4aa8ff', 5: '#ff8fd0', 6: '#f2f2f2' };
export function abtn(g, n, x, y, r = 10) {
  g.save();
  g.fillStyle = '#0b0b10'; g.beginPath(); g.arc(x, y + r * 0.18, r + 1.5, 0, 7); g.fill();
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, BTN_COLOR[n]); gr.addColorStop(1, BTN_COLOR[n]);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  g.fillStyle = n === 6 ? '#202028' : '#14141c';
  g.font = `900 ${Math.round(r * 1.15)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(n), x, y + 1);
  g.restore();
}
export function startBtn(g, x, y, h = 14) {
  g.save();
  const w = h * 3.2;
  g.fillStyle = '#0b0b10'; g.fillRect(x - w / 2 - 1.5, y - h / 2 - 1.5, w + 3, h + 3);
  g.fillStyle = '#d9dde3'; g.fillRect(x - w / 2, y - h / 2, w, h);
  g.fillStyle = '#14141c'; g.font = `900 ${Math.round(h * 0.62)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('START', x, y + 1);
  g.restore();
  return w;
}

// botones de la época: círculo oscuro con el símbolo de color
const GLYPH = { x: '#86a8ff', o: '#ff6e6e', t: '#3fd8a2', s: '#ff8fd0' };
export function glyph(g, kind, x, y, r = 10) {
  if (/^[1-6]$/.test(kind)) return abtn(g, +kind, x, y, r);
  if (kind === 'start') return startBtn(g, x + r * 0.6, y, r * 1.3);
  g.save();
  g.fillStyle = '#16161c'; g.strokeStyle = '#9da3ad'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke();
  g.strokeStyle = GLYPH[kind] || '#fff'; g.lineWidth = 2.2; g.lineCap = 'round';
  const k = r * 0.48;
  g.beginPath();
  if (kind === 'x') { g.moveTo(x - k, y - k); g.lineTo(x + k, y + k); g.moveTo(x + k, y - k); g.lineTo(x - k, y + k); }
  else if (kind === 'o') g.arc(x, y, k, 0, 7);
  else if (kind === 't') { g.moveTo(x, y - k * 1.05); g.lineTo(x + k, y + k * 0.75); g.lineTo(x - k, y + k * 0.75); g.closePath(); }
  else if (kind === 's') g.rect(x - k * 0.8, y - k * 0.8, k * 1.6, k * 1.6);
  else if (kind === 'lr') {   // cruceta izquierda/derecha
    g.fillStyle = '#d6d9de';
    g.moveTo(x - r * 0.15, y - k); g.lineTo(x - r * 0.85, y); g.lineTo(x - r * 0.15, y + k); g.closePath();
    g.moveTo(x + r * 0.15, y - k); g.lineTo(x + r * 0.85, y); g.lineTo(x + r * 0.15, y + k); g.closePath();
    g.fill(); g.restore(); return;
  } else if (kind === 'ud') {
    g.fillStyle = '#d6d9de';
    g.moveTo(x - k, y - r * 0.15); g.lineTo(x, y - r * 0.85); g.lineTo(x + k, y - r * 0.15); g.closePath();
    g.moveTo(x - k, y + r * 0.15); g.lineTo(x, y + r * 0.85); g.lineTo(x + k, y + r * 0.15); g.closePath();
    g.fill(); g.restore(); return;
  }
  g.stroke();
  g.restore();
}

// fila de controles abajo: [[glifo, etiqueta, tecla], ...]
export function hints(g, items, y = HH - 26) {
  g.save();
  g.font = `italic 900 17px ${FONT}`; g.letterSpacing = '1px';
  const widths = items.map(([gl, label, key]) => 26 + (gl === 'start' ? 26 : 0) + g.measureText(label).width + (key ? 8 + key.length * 7.5 : 0) + 22);
  let x = HW / 2 - widths.reduce((a, b) => a + b, 0) / 2 + 11;
  g.restore();
  items.forEach(([gl, label, key], i) => {
    glyph(g, gl, x, y, 10);
    const lx = x + 16 + (gl === 'start' ? 26 : 0);
    chrome(g, label, lx, y, 17, { align: 'left', spacing: 0.05 });
    if (key) {
      g.save(); g.font = `italic 900 17px ${FONT}`; g.letterSpacing = '1px'; const w = g.measureText(label).width; g.restore();
      plain(g, key, lx + 6 + w, y + 1, 10, '#b9c0cc', { align: 'left', weight: 700, font: 'Arial, sans-serif' });
    }
    x += widths[i];
  });
}

// barra de vida: marco cromado, vida amarilla, rastro rojo; side = -1 izquierda, 1 derecha
export function lifeBar(g, side, k, trail, flash) {
  const w = 252, h = 15, y = 22;
  const x0 = side < 0 ? 34 : HW - 34 - w;
  g.save();
  g.fillStyle = '#0b0b10'; g.fillRect(x0 - 4, y - 4, w + 8, h + 8);
  const fr = g.createLinearGradient(0, y - 4, 0, y + h + 4); fr.addColorStop(0, '#f2f4f7'); fr.addColorStop(0.5, '#6d7480'); fr.addColorStop(1, '#d8dce2');
  g.strokeStyle = fr; g.lineWidth = 2; g.strokeRect(x0 - 3, y - 3, w + 6, h + 6);
  g.fillStyle = '#3a0d12'; g.fillRect(x0, y, w, h);
  const fill = (kk, c0, c1) => {
    const ww = Math.round(w * Math.max(0, kk));
    const xx = side < 0 ? x0 + w - ww : x0;
    const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, c0); gr.addColorStop(0.45, c1); gr.addColorStop(1, c0);
    g.fillStyle = gr; g.fillRect(xx, y, ww, h);
  };
  fill(trail, '#ff6a3a', '#c4180e');
  const low = k < 0.3;
  fill(k, low && flash ? '#fff1a0' : '#ffe86a', low ? (flash ? '#ff9a2a' : '#f06a12') : '#f2b400');
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(x0, y + 2, w, 2);
  g.restore();
}

export function winMarks(g, side, wins) {
  for (let j = 0; j < 2; j++) {
    const x = side < 0 ? 286 - 14 - j * 18 : HW - 286 + 14 + j * 18, y = 52;
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
    g.fillStyle = '#0b0b10'; g.fillRect(-7, -7, 14, 14);
    g.fillStyle = j < wins ? '#ffd23a' : '#3b3f48'; g.fillRect(-5, -5, 10, 10);
    if (j < wins) { g.fillStyle = '#fff6c0'; g.fillRect(-5, -5, 4, 4); }
    g.restore();
  }
}

export function vignette(g, a = 0.5) {
  const gr = g.createRadialGradient(HW / 2, HH / 2, HH * 0.35, HW / 2, HH / 2, HH * 0.85);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${a})`);
  g.fillStyle = gr; g.fillRect(0, 0, HW, HH);
}

// cartel de controles con el tablero del gabinete
export function controlsCard(g, y0 = 70) {
  const x0 = 34, w = HW - 68, h = 360;
  g.save();
  g.fillStyle = 'rgba(8,8,14,0.94)'; g.fillRect(x0, y0, w, h);
  const fr = g.createLinearGradient(0, y0, 0, y0 + h); fr.addColorStop(0, '#f2f4f7'); fr.addColorStop(0.5, '#6d7480'); fr.addColorStop(1, '#d8dce2');
  g.strokeStyle = fr; g.lineWidth = 2; g.strokeRect(x0 + 2, y0 + 2, w - 4, h - 4);
  g.restore();
  chrome(g, 'CONTROLES', HW / 2, y0 + 26, 24, { spacing: 0.12 });
  // joystick
  const jx = x0 + 70, jy = y0 + 104;
  g.save();
  g.fillStyle = '#1c1c24'; g.beginPath(); g.arc(jx, jy + 6, 30, 0, 7); g.fill();
  g.fillStyle = '#3a3a46'; g.fillRect(jx - 3, jy - 26, 6, 30);
  const bg = g.createRadialGradient(jx - 5, jy - 34, 2, jx, jy - 28, 14); bg.addColorStop(0, '#ff9a8a'); bg.addColorStop(1, '#c41e1e');
  g.fillStyle = bg; g.beginPath(); g.arc(jx, jy - 28, 13, 0, 7); g.fill();
  g.restore();
  const jt = [['◀ ▶', 'MOVER (ATRÁS BLOQUEA)'], ['▲', 'SALTAR'], ['▼', 'AGACHARSE'], ['▶▶  ◀◀', 'DASH CON DOBLE TOQUE']];
  jt.forEach(([k, t], i) => {
    plain(g, k, jx - 46, y0 + 160 + i * 20, 12, '#ffd23a', { align: 'left', font: 'Arial, sans-serif', weight: 900 });
    plain(g, t, jx + 12, y0 + 160 + i * 20, 12, '#eef1f5', { align: 'left', weight: 800 });
  });
  // tablero 2×3
  const names = { 1: 'GOLPE', 2: 'GOLPE FUERTE', 3: 'ESPECIAL', 4: 'PATADA', 5: 'PATADA ALTA', 6: 'DASH' };
  const bx = x0 + 300, by = y0 + 76;
  for (let n = 1; n <= 6; n++) {
    const cx = bx + ((n - 1) % 3) * 96, cy = by + Math.floor((n - 1) / 3) * 70 + ((n - 1) % 3 === 1 ? -8 : 0);
    abtn(g, n, cx, cy, 16);
    plain(g, names[n], cx, cy + 28, 11, '#eef1f5', { weight: 800 });
  }
  // combinaciones
  const ly = y0 + 250;
  const row = (y, items) => {
    let x = x0 + 26;
    for (const [pre, n, t] of items) {
      if (pre) { plain(g, pre, x, y, 12, '#ffd23a', { align: 'left', font: 'Arial, sans-serif', weight: 900 }); x += 20; }
      abtn(g, n, x + 8, y, 8); x += 22;
      plain(g, t, x, y, 11, '#eef1f5', { align: 'left', weight: 800 });
      g.save(); g.font = `800 11px ${FONT}`; g.letterSpacing = '1px'; x += g.measureText(t).width + 8; g.restore();
    }
  };
  plain(g, 'AGACHADO', x0 + 26, ly - 2, 11, '#9fb4ff', { align: 'left', weight: 900 });
  row(ly + 18, [['▼', 1, 'GOLPE BAJO'], ['▼', 2, 'GANCHO ARRIBA'], ['▼', 4, 'PATADA BAJA'], ['▼', 5, 'BARRIDA']]);
  plain(g, 'EN EL AIRE', x0 + 26, ly + 42, 11, '#9fb4ff', { align: 'left', weight: 900 });
  row(ly + 62, [['', 1, 'GOLPE'], ['', 2, 'MARTILLO'], ['', 4, 'PATADA'], ['', 5, 'PICADA'], ['', 6, 'DASH AÉREO']]);
  plain(g, 'GOLPE QUE CONECTA → SE CANCELA EN UNO MÁS FUERTE', HW / 2, ly + 86, 10, '#c9ced8', { weight: 800 });
  plain(g, 'DASH + BOTÓN = GOLPE CORRIENDO · ▲ DURANTE EL DASH = SALTO LARGO', HW / 2, ly + 100, 10, '#c9ced8', { weight: 800 });
}
