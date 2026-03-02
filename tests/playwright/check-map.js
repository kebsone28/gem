const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // login via UI to ensure tokens are set correctly
  await page.goto('http://localhost/login.html');
  await page.waitForFunction(() => window.apiService && typeof window.apiService.login === 'function', { timeout: 5000 });
  await page.evaluate(async ({email,pass}) => {
    await window.apiService.login(email, pass);
  }, {email:'admin@proquelec.com', pass:'Touba2828Touba'});
  await page.waitForTimeout(500);

  await page.goto('http://localhost/terrain.html',{waitUntil:'domcontentloaded'});
  const hasMap = await page.$('#householdMap') !== null;
  let visible = false;
  if (hasMap) {
    visible = await page.$eval('#householdMap',el=>{
      const r = el.getBoundingClientRect();
      return r.width>0 && r.height>0;
    });
  }
  console.log('map present',hasMap,'visible',visible);
  await browser.close();
})();