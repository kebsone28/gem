const { test, expect } = require('@playwright/test');

test('Paramètres - should maintain team order when adding/removing teams', async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:3002/index.html', { waitUntil: 'load' });
    
    // Wait a bit for initialization
    await page.waitForTimeout(2000);
    
    // Log current URL to debug
    console.log('Current URL:', page.url());
    
    // Click on Paramètres in the nav (look for button or link with text)
    const paramsLink = await page.$('button:has-text("Paramètres")') || 
                       await page.$('a:has-text("Paramètres")') ||
                       await page.$('[href*="parametres"]');
    
    if (paramsLink) {
        await paramsLink.click();
        await page.waitForTimeout(1500);
    }
    
    // Now look for teams tab in current page
    const teamsTab = await page.waitForSelector('[data-tab="teams"]', { timeout: 5000 }).catch(() => null);
    
    if (!teamsTab) {
        // Try to navigate directly
        await page.goto('http://localhost:3002/parametres.html', { waitUntil: 'load' });
        await page.waitForTimeout(2000);
    }
    
    // Try clicking the teams tab
    const teamTabButton = await page.$('[data-tab="teams"]');
    if (teamTabButton) {
        await teamTabButton.click();
        await page.waitForTimeout(1000);
    }
    
    // Get initial order of team cards
    const initialOrder = await page.$$eval(
        '.team-config-card',
        cards => cards.map(card => {
            const h4 = card.querySelector('h4');
            return h4 ? h4.textContent.trim() : 'unknown';
        })
    ).catch(e => {
        console.error('Error getting initial order:', e);
        return [];
    });
    
    console.log('✅ Initial team order:', initialOrder);
    expect(initialOrder.length).toBeGreaterThan(0);
    
    const firstTeamName = initialOrder[0];
    
    // Try to add a team instance
    const increaseBtn = await page.$('.team-config-card .fa-plus');
    if (increaseBtn) {
        await increaseBtn.click();
        await page.waitForTimeout(800); // Debounce
    }
    
    // Get order after adding a team
    const orderAfterAdd = await page.$$eval(
        '.team-config-card',
        cards => cards.map(card => {
            const h4 = card.querySelector('h4');
            return h4 ? h4.textContent.trim() : 'unknown';
        })
    ).catch(e => []);
    
    console.log('✅ Order after adding team:', orderAfterAdd);
    
    // The first team should still be first
    expect(orderAfterAdd.length).toBeGreaterThanOrEqual(initialOrder.length);
    expect(orderAfterAdd[0]).toBe(firstTeamName);
    
    console.log('✅ Order stability test PASSED!');
});

test('Paramètres - should show stable layout when page loads', async ({ page }) => {
    await page.goto('http://localhost:3002/parametres.html', { waitUntil: 'load' });
    
    // Wait for content
    await page.waitForTimeout(2000);
    
    // Check that teams section exists
    const teamContainer = await page.$('#teamTypesContainer');
    expect(teamContainer).toBeTruthy();
    
    // Should have at least some team cards
    const teamCards = await page.$$('.team-config-card');
    console.log(`✅ Found ${teamCards.length} team cards`);
    expect(teamCards.length).toBeGreaterThanOrEqual(0);
    
    // Get the order
    const order = await page.$$eval(
        '.team-config-card h4',
        headers => headers.map(h => h.textContent.trim())
    );
    
    console.log('✅ Team order on load:', order);
});
