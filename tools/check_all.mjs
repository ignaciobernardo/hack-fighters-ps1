// arma a los 237 y lanza cada ataque de empresa una vez; reporta errores. node tools/check_all.mjs [shots]
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto('http://127.0.0.1:8118/?fight=1&mode=2p&stage=buk&wobble=0', { waitUntil: 'load' });
await page.waitForFunction(() => window.__pelea?.ready, null, { timeout: 60000 });
const r = await page.evaluate(async () => {
  const P = __pelea, bad = []; let t0 = performance.now();
  for (const id of P.IDS) { try { await P.ensureChar(id); } catch (e) { bad.push(id + ': ' + e.message); } }
  return { bad, ms: Math.round((performance.now() - t0) / P.IDS.length) };
});
console.log('modelos:', r.bad.length ? r.bad : 'los ' + (await page.evaluate(() => __pelea.IDS.length)) + ' ok', `(${r.ms} ms c/u)`);
const sigs = await page.evaluate(() => { const m = {}; for (const id of __pelea.IDS) { const s = __pelea.FIGHTERS[id].special; m[s.name + '|' + s.kind] = s; } return Object.values(m); });
const shots = process.argv[2];
let i = 0;
for (const s of sigs) {
  const out = await page.evaluate((s) => {
    const P = __pelea, [a, b] = P.S.f;
    P.sigs.clear(); a.reset(-1.6); b.reset(1.6); P.S.phase = 'fight'; P.S.timer = 60;
    a.data = { ...a.data, special: s }; P.ctl = () => ({ pressed: {} });
    a.tryAttack('s', false, P.game); const hp = b.hp;
    P.sim(s.kind === 'slip' ? 95 : s.kind === 'lob' ? 50 : s.kind === 'drive' ? 40 : s.kind === 'volley' ? 34 : 62);
    return hp - b.hp;
  }, s);
  if (shots) { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.screenshot({ path: `${shots}/sig-${String(i).padStart(3, '0')}.png` }); }
  if (!out) console.log('sin daño:', s.name, s.kind);
  i++;
}
console.log(sigs.length, 'ataques;', errs.length ? errs.slice(0, 8) : 'sin errores');
await browser.close();
