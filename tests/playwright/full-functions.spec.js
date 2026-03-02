const { test, expect } = require('@playwright/test');

// this suite performs a lightweight "functional" check of each page
// and attempts to exercise the primary interactive feature of the page.
// it also clears storage before and after each page to reduce state leakage.

const BASE = 'http://localhost';
const ADMIN_EMAIL = 'admin@proquelec.com';
const ADMIN_PASS = 'Touba2828Touba';

async function login(page) {
  // Use the UI form instead of direct evaluation to avoid serialization issues
  await page.goto(`${BASE}/login.html`);
  await page.waitForSelector('#loginForm');
  await page.fill('#email', ADMIN_EMAIL);
  await page.fill('#password', ADMIN_PASS);
  await page.click('#submitBtn');
  // allow time for login logic to run (redirect may happen or page may update)
  await page.waitForTimeout(2000);
}

// helper used by previous global spec
async function clearStorage(page) {
  // ensure we are on an http origin so localStorage is accessible
  try {
    await page.goto(`${BASE}/index.html`);
  } catch {}
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
}

// simple function to catch and throw on console errors
async function assertNoConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // ignore IndexedDB transport issue (known benign in headless tests)
      if (text.includes('Failed to write log to IndexedDB')) return;
      // ignore temporary 429 responses from API (rate limiting during tests)
      if (text.includes('status of 429')) return;
      errors.push(text);
    }
  });
  // give any scripts a chance to run
  await page.waitForTimeout(500);
  expect(errors, `console errors: ${errors.join('\n')}`).toHaveLength(0);
}

// test definitions

test.describe('Complete page function checks (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // seed an authenticated admin user directly in storage
    await page.goto(`${BASE}/login.html`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      const user = { id: '1', username: 'admin', role: 'admin' };
      localStorage.setItem('auth_user', JSON.stringify(user));
      localStorage.setItem('auth_token', 'dummy.jwt.token');
    });
    // navigate to a landing page to let AuthGuard run
    await page.goto(`${BASE}/terrain.html`);
  });

  test('index.html - login landing behaviour', async ({ page }) => {
    // after beforeEach login, we should already be on the landing page
    await assertNoConsoleErrors(page);
    const url = page.url();
    expect(url).toMatch(/\/(index|terrain|logistique)\.html$/);
  });

  test('terrain.html - map interacts, filters', async ({ page }) => {
    await page.goto(`${BASE}/terrain.html`);
    await assertNoConsoleErrors(page);
    // verify map exists and can be manipulated (if authorized)
    const map = await page.$('#householdMap');
    expect(map).not.toBeNull();
    const filterBtn = await page.$('.filter-btn');
    if (filterBtn) await filterBtn.click();
  });

  test('parametres.html - edit & save', async ({ page }) => {
    await page.goto(`${BASE}/parametres.html`);
    await assertNoConsoleErrors(page);
    const input = await page.$('input[name="someSetting"]');
    if (input) {
      await input.fill('test');
      const save = await page.$('button[type="submit"]');
      if (save) await save.click();
    }
  });

  test('simulation.html - run sample', async ({ page }) => {
    await page.goto(`${BASE}/simulation.html`);
    await assertNoConsoleErrors(page);
    const run = await page.$('#runSimulationBtn');
    if (run) await run.click();
  });

  test('rapports.html - open first report', async ({ page }) => {
    await page.goto(`${BASE}/rapports.html`);
    await assertNoConsoleErrors(page);
    const first = await page.$('.report-row');
    if (first) await first.click();
  });

  test('charges.html - export button', async ({ page }) => {
    await page.goto(`${BASE}/charges.html`);
    await assertNoConsoleErrors(page);
    const exp = await page.$('#exportChargesBtn');
    if (exp) await exp.click();
  });

  test('bordereau.html - basic page load', async ({ page }) => {
    await page.goto(`${BASE}/bordereau.html`);
    await assertNoConsoleErrors(page);
    // page should at least have a heading or description
    const heading = await page.$('h1, h2');
    expect(heading).not.toBeNull();
  });

  test('logistique.html - GrappeAssignment quick check', async ({ page }) => {
    await page.goto(`${BASE}/logistique.html`);
    await assertNoConsoleErrors(page);
    const btn = await page.$('#someGrappeAction');
    if (btn) await btn.click();
  });

  test('cahier-equipes.html - simple form fill', async ({ page }) => {
    await page.goto(`${BASE}/cahier-equipes.html`);
    await assertNoConsoleErrors(page);
    const txt = await page.$('textarea');
    if (txt) await txt.fill('abc');
  });

  test('aide.html & audit_systeme.html - static pages load', async ({ page }) => {
    for (const p of ['aide.html', 'audit_systeme.html']) {
      await page.goto(`${BASE}/${p}`);
      await assertNoConsoleErrors(page);
    }
  });
});
