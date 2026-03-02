const { test, expect } = require('@playwright/test');
// prevent service worker from interfering with our sanity checks
test.use({ serviceWorkers: 'block' });
const path = require('path');
const { pathToFileURL } = require('url');

function fileUrl(relPath) {
  return pathToFileURL(path.resolve(__dirname, '..', '..', relPath)).toString();
}

// list of HTML pages to verify
const PAGES = [
  'index.html',
  'login.html',
  'terrain.html',
  'parametres.html',
  'simulation.html',
  'rapports.html',
  'charges.html',
  'bordereau.html',
  'logistique.html',
  'cahier-equipes.html',
  'aide.html',
  'audit_systeme.html'
];

// helper which visits a page, records any console errors, and optionally retries
async function checkPage(page, relativePath) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto(fileUrl(relativePath), { waitUntil: 'domcontentloaded', timeout: 120000 });

  // if we saw errors, attempt a repair: clear localStorage and reload once
  if (errors.length) {
    console.log(`  ⚠ errors on ${relativePath}, clearing localStorage and reloading`);
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  }

  return errors;
}

// global test suite
test.describe('Global smoke / sanity checks for all pages', () => {
  test.setTimeout(180000);

  test('all frontend pages load and errors are reported', async ({ page }) => {
    // start by clearing any stored state
    await page.goto(fileUrl('index.html'), { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    let totalErrors = 0;
    for (const rel of PAGES) {
      const err = await checkPage(page, rel);
      if (err.length) {
        console.warn(`${rel} console errors (${err.length}):`, err);
        totalErrors += err.length;
      }
      // also clear storage between pages to avoid cascading faults
      await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    }
  });

  // additional authenticated check: terrain map should render when logged in
  test('terrain.html shows map after login', async ({ page }) => {
    await page.goto('http://localhost/login.html');
    await page.waitForFunction(() => window.apiService && typeof window.apiService.login === 'function', { timeout: 5000 });
    await page.evaluate(async ({email, pass}) => {
      await window.apiService.login(email, pass);
    }, { email: 'admin@proquelec.com', pass: 'Touba2828Touba' });
    // give the app a moment to apply auth
    await page.waitForTimeout(500);
    await page.goto('http://localhost/terrain.html');
    const hasMap = await page.$('#householdMap') !== null;
    expect(hasMap).toBe(true);
  });
});
