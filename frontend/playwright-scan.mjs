import fs from 'fs';
import path from 'path';
import { chromium, firefox, webkit } from 'playwright';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5174';
const waitUntil = 'load';
const pagesToCheck = ['/', '/login', '/terrain'];

function slugify(s){
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g,'').toLowerCase();
}

async function run() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), 'test-artifacts', `scan-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  const browsers = [
    { name: 'chromium', impl: chromium },
    { name: 'firefox', impl: firefox },
    { name: 'webkit', impl: webkit },
  ];

  for (const b of browsers) {
    console.log(`Launching ${b.name}...`);
    const browser = await b.impl.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const p of pagesToCheck) {
      const url = new URL(p, baseURL).toString();
      const slug = slugify(p === '/' ? 'home' : p);
      const screenshotPath = path.join(outDir, `${b.name}--${slug}.png`);
      const consolePath = path.join(outDir, `${b.name}--${slug}--console.txt`);
      const errors = [];
      const logs = [];

      page.on('console', msg => {
        logs.push(`[console:${msg.type()}] ${msg.text()}`);
      });
      page.on('pageerror', ev => {
        errors.push(`[pageerror] ${ev.message}`);
      });
      page.on('request', req => {
        logs.push(`[request:${req.method()}] ${req.url()}`);
      });
      page.on('requestfailed', req => {
        const f = req.failure ? req.failure() : null;
        logs.push(`[requestfailed] ${req.url()} ${f && f.errorText ? f.errorText : ''}`);
      });
      page.on('response', res => {
        logs.push(`[response:${res.status()}] ${res.url()}`);
      });

      console.log(`- Navigating ${b.name} -> ${url}`);
      try {
        await page.goto(url, { waitUntil, timeout: 60000 });
      } catch (e) {
        logs.push(`[navigation error] ${String(e)}`);
      }

      // give time for dynamic UI to settle
      await page.waitForTimeout(1000);

      try {
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`  saved screenshot ${screenshotPath}`);
      } catch (e) {
        logs.push(`[screenshot error] ${String(e)}`);
      }

      const content = [];
      content.push(`URL: ${url}`);
      content.push(`Browser: ${b.name}`);
      content.push('--- console logs ---');
      content.push(...logs);
      if (errors.length) {
        content.push('--- page errors ---');
        content.push(...errors);
      }

      fs.writeFileSync(consolePath, content.join('\n'), 'utf8');
      console.log(`  saved logs ${consolePath}`);
    }

    await browser.close();
    console.log(`${b.name} finished`);
  }

  console.log(`Artifacts saved to ${outDir}`);
}

run().catch(err => {
  console.error('Scan failed:', err);
  process.exit(1);
});
