// Torneo CPU contra CPU para medir el balance: node tools/balance.mjs [peleas]
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const N = +(process.argv[2] || 120);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto('http://127.0.0.1:8118/?demo=1&p1=ian-fry&p2=rafael-fernandez', { waitUntil: 'load' });
await page.waitForFunction(() => window.__pelea?.ready, null, { timeout: 60000 });
const K = {}; let frames = 0, rounds = 0, timeouts = 0;
for (let m = 0; m < N; m++) {
  const r = await page.evaluate(async () => {
    const P = __pelea, n = P.IDS.length; P.S.demo = false; P.S.autoCpu = true;
    // un representante por ataque, para que todos los tipos jueguen parejo
    P._reps ||= Object.values(P.IDS.reduce((o, id) => ((o[P.FIGHTERS[id].special.name] ||= id), o), {}));
    const pick = () => P.IDS.indexOf(P._reps[Math.floor(Math.random() * P._reps.length)]);
    const ids = [pick(), pick()];
    await Promise.all(ids.map((i) => P.ensureChar(P.IDS[i])));
    P.S.cur = ids; P.startMatch();
    let f = 0; while (P.S.phase !== 'over' && f < 30000) { P.sim(200); f += 200; }
    const [a, b] = P.S.f;
    return { kinds: [a.data.special.kind, b.data.special.kind], wins: [a.wins, b.wins], f, rounds: P.S.round };
  });
  frames += r.f; rounds += r.rounds; if (r.f >= 30000) timeouts++;
  r.kinds.forEach((k, i) => { (K[k] ||= { w: 0, n: 0 }).n++; if (r.wins[i] > r.wins[1 - i]) K[k].w++; });
}
console.log(`${N} peleas · ${(frames / rounds / 60).toFixed(1)} s por ronda · sin terminar: ${timeouts}`);
console.log(Object.entries(K).sort((a, b) => b[1].w / b[1].n - a[1].w / a[1].n).map(([k, v]) => `${k.padEnd(9)} ${String(Math.round((100 * v.w) / v.n)).padStart(3)}% de ${v.n}`).join('\n'));
const st = await page.evaluate(() => __pelea.sigs.stats);
console.log('por lanzamiento:', Object.entries(st).map(([k, v]) => `${k} ${v.cast}x daño ${Math.round(v.dmg / v.cast)} conecta ${v.hit} bloquea ${v.block}`).join(' | '));
console.log(errs.length ? errs.slice(0, 5) : 'sin errores');
await browser.close();
