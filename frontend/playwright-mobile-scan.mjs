import fs from 'fs';
import path from 'path';
import { chromium, firefox, webkit, devices } from 'playwright';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5174';
const pagesToCheck = ['/', '/login', '/terrain'];
const deviceList = ['iPhone 12', 'Pixel 5'];

function slugify(s){
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g,'').toLowerCase();
}

async function run() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), 'test-artifacts', `mobile-scan-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browsers = [
    { name: 'chromium', impl: chromium },
    { name: 'firefox', impl: firefox },
    { name: 'webkit', impl: webkit },
  ];

  for (const b of browsers) {
    console.log(`Launching ${b.name}...`);
    const browser = await b.impl.launch();

    for (const devName of deviceList) {
      const dev = devices[devName];
      const contextOptions = { ...dev };
      // Firefox doesn't support isMobile/hasTouch; emulate only viewport/userAgent
      if (b.name === 'firefox') {
        delete contextOptions.isMobile;
        delete contextOptions.hasTouch;
      }
      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();

      for (const p of pagesToCheck) {
        const url = new URL(p, baseURL).toString();
        const slug = slugify((devName + '-' + (p === '/' ? 'home' : p)));
        const screenshotPath = path.join(outDir, `${b.name}--${slug}.png`);
        const consolePath = path.join(outDir, `${b.name}--${slug}--console.txt`);
        const logs = [];

        page.on('console', msg => logs.push(`[console:${msg.type()}] ${msg.text()}`));
        page.on('pageerror', ev => logs.push(`[pageerror] ${ev.message}`));
        page.on('request', req => logs.push(`[request:${req.method()}] ${req.url()}`));
        page.on('requestfailed', req => {
          const f = req.failure ? req.failure() : null;
          logs.push(`[requestfailed] ${req.url()} ${f && f.errorText ? f.errorText : ''}`);
        });
        page.on('response', res => logs.push(`[response:${res.status()}] ${res.url()}`));

        console.log(`- ${b.name}/${devName} -> ${url}`);
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        } catch (e) {
          logs.push(`[navigation error] ${String(e)}`);
        }

        await page.waitForTimeout(1000);
        try { await page.screenshot({ path: screenshotPath, fullPage: true }); } catch (e) { logs.push(`[screenshot error] ${String(e)}`); }

        const content = [`URL: ${url}`, `Browser: ${b.name}`, `Device: ${devName}`, '--- logs ---', ...logs];
        fs.writeFileSync(consolePath, content.join('\n'), 'utf8');
        console.log(`  saved ${screenshotPath} + logs`);
      }

      await context.close();
    }

    await browser.close();
    console.log(`${b.name} finished`);
  }

  console.log(`Artifacts saved to ${outDir}`);
}

run().catch(err => { console.error('Mobile scan failed:', err); process.exit(1); });
