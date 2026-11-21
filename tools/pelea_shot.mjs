// capturas del juego PS1: node tools/pelea_shot.mjs out.png "query" [js antes de capturar] [frames de espera]
import { createRequire } from 'module';
import { execSync } from 'child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright');
const [out, query = '', js = '', wait = '30'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 960, height: 720 } });
const errs = [];
page.on('pageerror', (e) => errs.push('[pageerror] ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push('[' + m.type() + '] ' + m.text()); });
await page.goto('http://127.0.0.1:8118/?' + query, { waitUntil: 'load' });
await page.waitForFunction(() => window.__pelea && window.__pelea.ready, null, { timeout: 60000 });
if (js) await page.evaluate(js);
await page.evaluate((n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); }), +wait);
await page.screenshot({ path: out });
console.log(errs.slice(0, 12).join('\n') || 'ok');
await browser.close();
