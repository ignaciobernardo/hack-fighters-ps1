// exporta GLB (rig + atlas incrustado) y el atlas PNG de cada personaje hecho a mano
// uso: node tools/ps1_export.mjs [ids...]   → exports/ps1/<id>.glb, exports/ps1/<id>-atlas.png
import { createRequire } from 'module';
import { execSync } from 'child_process';
import fs from 'fs';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto('http://127.0.0.1:8118/ps1.html?ui=0&pose=tpose&paused=1', { waitUntil: 'load' });
await page.waitForFunction(() => window.__hf && window.__hf.char);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => __hf.made.map((s) => s.id));
fs.mkdirSync('exports/ps1', { recursive: true });
for (const id of ids) {
  const r = await page.evaluate(async (id) => {
    await __hf.select(id);
    const buf = await __hf.exportGLB(false);
    let bin = ''; const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return { glb: btoa(bin), png: __hf.char.atlas.canvas.toDataURL('image/png').split(',')[1], stats: __hf.char.stats };
  }, id);
  fs.writeFileSync(`exports/ps1/${id}.glb`, Buffer.from(r.glb, 'base64'));
  fs.writeFileSync(`exports/ps1/${id}-atlas.png`, Buffer.from(r.png, 'base64'));
  console.log(id, JSON.stringify(r.stats));
}
await browser.close();
