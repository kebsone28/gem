import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

const routes = [
  '/dashboard',
  '/terrain',
  '/rapports',
  '/charges',
  '/cahier',
  '/logistique',
  '/bordereau',
  '/simulation',
  '/settings',
  '/admin/users',
  '/admin/security',
  '/admin/diagnostic',
  '/admin/mission',
  '/admin/approval',
  '/admin/kobo-terminal',
  '/admin/kobo-mapping',
  '/admin/organization',
  '/admin/pv-automation',
  '/communication',
  '/planning',
  '/planning-formation',
  '/admin/alerts',
  '/aide',
  '/mission-order',
];

const loginAsAdmin = async (page: Page) => {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.locator('input[name="username"]').fill(adminEmail!);
  await page.locator('input[name="password"]').fill(adminPassword!);
  await page.getByRole('button', { name: /connecter|connexion|login/i }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
};

test.describe('Application routes smoke', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.');

  test('pages principales et rubriques protégées se chargent sans crash React', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await loginAsAdmin(page);

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(750);

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator('body')).not.toContainText(
        /une erreur s'est produite pendant l'ouverture de la page|impossible de charger cette page/i
      );
    }

    expect(pageErrors).toEqual([]);
  });
});
