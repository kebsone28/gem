const { test, expect } = require('@playwright/test');
const path = require('path');
const { pathToFileURL } = require('url');

function fileUrl(relPath) {
  return pathToFileURL(path.resolve(__dirname, '..', '..', relPath)).toString();
}

test.describe('Rapports page — smoke', () => {
  test.setTimeout(120000);

  test('rapports.html loads and can generate a full report', async ({ page }) => {
    await page.goto(fileUrl('rapports.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });

    await expect(page.locator('text=Rapports et Export')).toBeVisible();

    // Click the "Rapport Complet" button and expect a generated preview
    await page.click('[data-report-type="complet"]');

    // Wait for preview content (generated header)
    await expect(page.locator('#reportPreview')).toContainText('Rapport Complet');
    await expect(page.locator('#reportPreview')).toContainText('Résumé Exécutif');
  });

  test('Rapports historique contains entries and actions', async ({ page }) => {
    await page.goto(fileUrl('rapports.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });

    // Ensure the history table exists and has rows
    await expect(page.locator('#reportHistory')).toBeVisible();
    await expect(page.locator('#reportHistory tr')).toHaveCountGreaterThan(0);

    // The 'Télécharger' and 'Voir' buttons should be present in row 1
    const firstRow = page.locator('#reportHistory tr').first();
    await expect(firstRow.locator('text=Télécharger')).toBeVisible();
    await expect(firstRow.locator('text=Voir')).toBeVisible();
  });
});
