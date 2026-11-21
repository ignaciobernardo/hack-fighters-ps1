// tira de cuadros de un ataque en movimiento: node tools/strip.mjs out.png p1 [stage] [extra js]
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const [out, list] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 320, height: 240 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const rows = [];
for (const [ri, id] of list.split(',').entries()) {
  await page.goto(`http://127.0.0.1:8118/?fight=1&p1=${id}&p2=ian-fry&stage=${['casa', 'buk', 'mut'][ri % 3]}&mode=2p`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__pelea?.ready, null, { timeout: 60000 });
  const name = await page.evaluate(() => { __pelea.ctl = (a, b, t) => ({ pressed: { s: t === 112 } }); __pelea.sim(118); const s = __pelea.S.f[0].data.special; if (s.kind === 'orbit' || s.kind === 'swing') __pelea.S.f[1].x = __pelea.S.f[0].x + 1.5; return s.name + ' · ' + s.kind; });
  const fr = [];
  for (let k = 0; k < 8; k++) { await page.evaluate((n) => __pelea.sim(n), k === 0 ? 8 : 20); await page.evaluate(() => new Promise((r) => requestAnimationFrame(r))); const f = `${out}.${ri}.${k}.png`; await page.screenshot({ path: f }); fr.push(f); }
  rows.push({ name, fr });
}
await browser.close();
fs.writeFileSync(out + '.json', JSON.stringify(rows));
execSync(`python3 -I - <<'PY'
from PIL import Image, ImageDraw
import json, os
rows = json.load(open('${out}.json'))
o = Image.new('RGB', (8 * 240, len(rows) * 194), 'black'); d = ImageDraw.Draw(o)
for r, row in enumerate(rows):
    d.text((4, r * 194 + 2), row['name'], fill='white')
    for k, f in enumerate(row['fr']):
        o.paste(Image.open(f).resize((240, 180)), (k * 240, r * 194 + 14)); os.remove(f)
o.save('${out}'); os.remove('${out}.json')
PY`);
