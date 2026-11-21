// Arma a los 237 y prueba cada ataque de empresa contra un rival quieto: tiene que hacer daño
// y además cumplir su mecánica (estado, curación, robo de vida, teletransporte…).
// node tools/check_all.mjs [carpeta de capturas]
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
  const P = __pelea, bad = []; const t0 = performance.now();
  for (const id of P.IDS) { try { await P.ensureChar(id); } catch (e) { bad.push(id + ': ' + e.message); } }
  return { bad, n: P.IDS.length, ms: Math.round((performance.now() - t0) / P.IDS.length) };
});
console.log('modelos:', r.bad.length ? r.bad : `los ${r.n} ok`, `(${r.ms} ms c/u)`);
const sigs = await page.evaluate(() => { const m = {}; for (const id of __pelea.IDS) { const s = __pelea.FIGHTERS[id].special; (m[s.name + '|' + s.kind] ||= { ...s, people: 0 }).people++; } return Object.values(m); });
const shots = process.argv[2];
const fails = []; const kinds = {}; const names = [];
for (const [i, s] of sigs.entries()) {
  kinds[s.kind] = (kinds[s.kind] || 0) + s.people;
  const at = { slip: 70, lob: 46, drive: 34, volley: 30, throw: 30, storm: 60, teleport: 26, crush: 52, orbit: 40, mines: 60, control: 60, heal: 50, swing: 18 }[s.kind] ?? 60;
  const out = await page.evaluate(([s, at]) => {
    const P = __pelea, [a, b] = P.S.f;
    P.sigs.clear(); a.reset(-1.1); b.reset(1.1); P.S.phase = 'fight'; P.S.timer = 60; P.S.stop = 0; b.fxSeen = {};
    a.data = { ...a.data, special: s }; if (s.kind === 'heal' || s.drain) a.hp = Math.round(a.maxHp * 0.5);
    // el rival camina hacia las minas; en lo demás se queda quieto
    P.ctl = () => ({ pressed: {} });
    const hpA = a.hp, hpB = b.hp, x0 = a.x;
    a.tryAttack('s', false, P.game); P.sim(at);
    return { mid: true, hpA, hpB, x0 };
  }, [s, at]);
  if (shots) { await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.screenshot({ path: `${shots}/sig-${String(i).padStart(3, '0')}.png` }); names.push(s.name + ' · ' + s.kind + ' · ' + s.people); }
  const res = await page.evaluate(([o, s]) => {
    const P = __pelea, [a, b] = P.S.f;
    if (s.kind === 'mines') b.x = a.x + 1.7;
    if (s.kind === 'orbit') b.x = a.x + 1.0;
    P.sim(330);
    return { dmg: o.hpB - b.hp, healed: a.hp - o.hpA, moved: Math.abs(a.x - o.x0), seen: Object.keys(b.fxSeen || {}) };
  }, [out, s]);
  const why = [];
  if (s.kind !== 'heal' && res.dmg <= 0) why.push('sin daño');
  if (s.status) for (const k of Object.keys(s.status)) if (!res.seen.includes(k)) why.push('no aplicó ' + k);
  if (s.kind === 'control' && !res.seen.includes('puppet')) why.push('no controló');
  if ((s.kind === 'heal' || s.drain) && res.healed <= 0) why.push('no curó');
  if (s.kind === 'teleport' && res.moved < 1.5) why.push('no se teletransportó');
  if (why.length) fails.push(`${s.name} (${s.kind}): ${why.join(', ')}`);
}
console.log(`${sigs.length} ataques ·`, Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(' · '));
console.log(fails.length ? 'FALLAN:\n' + fails.join('\n') : 'todos hacen daño y cumplen su mecánica');
console.log(errs.length ? errs.slice(0, 8) : 'sin errores de consola');
if (shots) (await import('fs')).writeFileSync(shots + '/names.json', JSON.stringify(names));
await browser.close();
