const { test, expect } = require('@playwright/test');

test('assignment flow works correctly', async ({ page }) => {
    test.setTimeout(60000);
    page.on('console', msg => {
        const text = msg.text();
        console.log(`[BROWSER ${msg.type().toUpperCase()}] ${text}`);
    });
    page.on('pageerror', err => {
        console.error(`[BROWSER ERROR] ${err.message}`);
    });

    console.log('Injecting mock auth...');
    await page.addInitScript(() => {
        localStorage.setItem('auth_token', 'mock_token');
        localStorage.setItem('auth_user', JSON.stringify({
            username: 'agent_test',
            role: 'admin'
        }));
    });

    console.log('Navigating to logistique.html...');
    await page.goto('http://localhost:5000/logistique.html', { waitUntil: 'domcontentloaded' });

    // Wait for initialization
    await page.waitForTimeout(2000);

    console.log('Switching to Grappes tab...');
    const grappeTab = page.locator('[data-tab="grappes"]');
    await grappeTab.click();
    await page.waitForTimeout(1000);

    console.log('Finding a sub-grappe card...');
    const modifyBtn = page.locator('button:has-text("MODIFIER L\'AFFECTATION")').first();
    await expect(modifyBtn).toBeVisible();
    await modifyBtn.click();

    console.log('Modal opened, checking a team (auto-saves)...');
    await page.waitForSelector('#globalModalContent');
    const firstCheckbox = page.locator('#globalModalContent input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();
    await firstCheckbox.check();

    console.log('Waiting for success toast...');
    await page.waitForSelector('.swal2-toast', { timeout: 10000 });

    console.log('Taking screenshot for verification...');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test_results_assignment.png', fullPage: true });

    console.log('Closing modal...');
    await page.click('button:has-text("TERMINER")');

    console.log('Verification complete.');
});
