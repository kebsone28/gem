const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

function fileUrl(relPath) {
  return pathToFileURL(path.resolve(__dirname, '..', '..', relPath)).toString();
}

test.describe('Smoke tests — local pages', () => {
  test.setTimeout(120000);
  test('index.html loads and shows key metrics', async ({ page }) => {
    // Use a longer navigation timeout and don't wait full 'load' (CDN assets might be slow)
    await page.goto(fileUrl('index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await expect(page.locator('text=Avancement Global')).toBeVisible();
    await expect(page.locator('#globalProgress')).toBeVisible();
    await expect(page.locator('#completedHouses')).toBeVisible();
    // nav exists
    await expect(page.locator('a[href="parametres.html"]')).toBeVisible();
  });

  test('parametres.html loads and can save parameters (localStorage)', async ({ page }) => {
    await page.goto(fileUrl('parametres.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await expect(page.locator('text=Paramètres du Projet')).toBeVisible();
    const totalHouses = page.locator('#totalHouses');
    await expect(totalHouses).toBeVisible();
    // The UI sets #totalHouses to readonly (calculated from zones). For test purposes
    // remove readonly and set the value via the page context so Playwright can save it.
    await page.evaluate(() => {
      const el = document.getElementById('totalHouses');
      if (el) {
        el.removeAttribute('readonly');
        el.value = '1234';
        el.style.backgroundColor = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // click save button
    await page.click('button[data-action="save-parameters"]');

    // confirm localStorage has an object with project.totalHouses = 1234
    const saved = await page.evaluate(() => localStorage.getItem('electrificationApp'));
    expect(saved).not.toBeNull();
    const obj = JSON.parse(saved || '{}');
    expect(obj.project && obj.project.totalHouses).toBe(1234);
  });

  test('simulation.html runs a simple simulation and shows results', async ({ page }) => {
    await page.goto(fileUrl('simulation.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await expect(page.locator('text=Simulateur de Scénarios')).toBeVisible();

    await page.fill('#simMasonTeams', '5');
    await page.fill('#simNetworkTeams', '4');
    await page.fill('#simInteriorType1Teams', '2');
    await page.fill('#simInteriorType2Teams', '1');

    // click run
    await page.click('[data-sim="run"]');

    // results block should become visible and contain non-default values
    await expect(page.locator('#simulationResults')).toBeVisible();
    await expect(page.locator('#simDuration')).not.toHaveText('0 jours');
    await expect(page.locator('#simProductivity')).not.toHaveText('0 ménages/j');
  });
});
