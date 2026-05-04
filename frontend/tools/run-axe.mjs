import fs from 'fs';
import path from 'path';
import { chromium, firefox, webkit } from 'playwright';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5174';
const pagesToCheck = ['/', '/login', '/terrain'];

function slugify(s) {
  return s.replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '').toLowerCase();
}

async function run() {
  const browsers = [
    { name: 'chromium', impl: chromium },
    { name: 'firefox', impl: firefox },
    { name: 'webkit', impl: webkit },
  ];

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve(process.cwd(), 'test-artifacts', `axe-reports-${timestamp}`);
  fs.mkdirSync(outDir, { recursive: true });

  for (const b of browsers) {
    console.log(`Launching ${b.name}...`);
    const browser = await b.impl.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    for (const p of pagesToCheck) {
      const url = new URL(p, baseURL).toString();
      const slug = `${b.name}-${slugify(p === '/' ? 'home' : p)}`;
      console.log(`- Checking ${url} on ${b.name}`);

      try {
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      } catch (e) {
        console.warn(`  navigation failed: ${String(e)}`);
      }

      // inject axe-core from unpkg (no install required)
      await page.addScriptTag({ url: 'https://unpkg.com/axe-core@4.12.1/axe.min.js' });

      // run axe
      const result = await page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        return await axe.run();
      });

      const outPath = path.join(outDir, `${slug}.json`);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`  saved ${outPath} (violations: ${result.violations.length})`);
    }

    await browser.close();
  }

  console.log(`Axe reports saved to ${outDir}`);
}

run().catch(err => {
  console.error('Axe run failed:', err);
  process.exit(1);
});
