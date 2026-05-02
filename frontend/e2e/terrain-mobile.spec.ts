import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

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

test.describe('Terrain mobile', () => {
  test.skip(!adminEmail || !adminPassword, 'Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.');

  test.use({ viewport: { width: 390, height: 844 }, isMobile: true });

  test('liste, outils et rapports restent accessibles sans débordement horizontal', async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto('/terrain');

    await expect(page.getByText(/pilotage/i)).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: /^liste$/i }).click();

    await expect(page.getByRole('heading', { name: /ménages/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /exporter csv/i })).toBeVisible();

    const reportButtonCount = await page
      .locator('button[title^="Télécharger"], button[title$="non disponible"]')
      .count();
    expect(reportButtonCount).toBeGreaterThan(0);

    await page.getByRole('button', { name: /outils terrain/i }).click();
    await expect(page.getByText(/carte, couches, itinéraire/i)).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
