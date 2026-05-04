import { chromium } from 'playwright';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:5174';

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to', baseURL);
  await page.goto(baseURL, { waitUntil: 'load', timeout: 60000 });

  // Wait for component
  await page.waitForSelector('.mission-list', { timeout: 10000 });

  // Expand first year group
  const toggle = await page.$('.mission-year-toggle');
  if (!toggle) {
    console.error('❌ .mission-year-toggle not found');
    await browser.close();
    process.exit(2);
  }
  await toggle.click();
  await page.waitForTimeout(250);

  // Open history modal
  const histBtn = await page.$('.mission-actions .btn-ghost');
  if (!histBtn) {
    console.error('❌ Historique button not found');
    await browser.close();
    process.exit(2);
  }
  await histBtn.click();

  try {
    await page.waitForSelector('.mission-history-panel', { timeout: 5000 });
    console.log('✅ MissionList smoke test passed (modal opened)');
  } catch (e) {
    console.error('❌ mission-history-panel did not appear', e);
    await browser.close();
    process.exit(3);
  }

  await browser.close();
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
