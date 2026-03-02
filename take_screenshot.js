const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/logistique.html', { waitUntil: 'networkidle0' });

    // Handle optional login
    try {
        const isLogin = await page.$('#username');
        if (isLogin) {
            await page.type('#username', 'admin');
            await page.type('#password', 'admin123');
            await page.click('#loginBtn');
            await page.waitForNavigation({ waitUntil: 'networkidle0' });
        }
    } catch (e) {
        console.log('No login needed or already logged in.');
    }

    // Click Grappes tab
    await page.evaluate(() => {
        const tab = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.includes('Grappes') || b.dataset.tab === 'grappes');
        if (tab) tab.click();
    });

    // Wait for rendering
    await new Promise(r => setTimeout(r, 3000));

    // Create path in artifacts directory
    const screenshotPath = "C:\\Users\\User\\.gemini\\antigravity\\brain\\21cc83dd-eecd-4eb0-af72-bb027bb872bb\\final_glassmorphism_ui_" + Date.now() + ".webp";
    await page.screenshot({ path: screenshotPath, type: 'webp' });
    console.log("SCREENSHOT:" + screenshotPath);

    await browser.close();
})();
