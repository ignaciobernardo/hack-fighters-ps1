// hoja de modelos: node tools/sheet.mjs out.png id1 id2 ...  (foto arriba, modelo abajo)
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const [out, ...ids] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 260, height: 420 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8118/ps1.html?ui=0&mode=tex&pose=stand&paused=1&yaw=20&c=' + ids[0], { waitUntil: 'load' });
await page.waitForFunction(() => window.__hf && window.__hf.char);
const dir = out.replace(/\.png$/, '-tmp'); fs.mkdirSync(dir, { recursive: true });
for (const [i, id] of ids.entries()) {
  await page.evaluate(async (id) => { await __hf.select(id); __hf.cam(0, 4, 5.4, 0.92); }, id);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${dir}/${i}.png` });
}
await browser.close();
execSync(`python3 -I - <<'PY'
from PIL import Image
ids=${JSON.stringify(ids)}
o=Image.new('RGB',(len(ids)*260,420+200),(48,48,48))
for i,id in enumerate(ids):
    o.paste(Image.open('${dir}/%d.png'%i),(i*260,200))
    ph=Image.open('public/ps1/%s.png'%id).convert('RGBA').resize((200,200)); bg=Image.new('RGBA',(200,200),(70,70,80,255)); bg.alpha_composite(ph); o.paste(bg.convert('RGB'),(i*260+30,0))
o.save('${out}')
PY`);
fs.rmSync(dir, { recursive: true });
