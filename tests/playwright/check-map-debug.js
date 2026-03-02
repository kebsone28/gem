const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Use the real login page and ApiService to authenticate
  await page.goto('http://localhost/login.html');
  // wait for ApiService to be available
  await page.waitForFunction(() => {
    return window.apiService && typeof window.apiService.login === 'function';
  }, { timeout: 5000 });

  // perform login via the client API
  await page.evaluate(async ({email, pass}) => {
    try {
      await window.apiService.login(email, pass);
    } catch (e) {
      console.warn('client login failed', e);
    }
  }, { email: 'admin@proquelec.com', pass: 'Touba2828Touba' });

  // wait briefly for any redirects to occur
  await page.waitForTimeout(1000);

  // navigate explicitly to terrain in case redirect didn't happen
  await page.goto('http://localhost/terrain.html');
  // wait a bit for scripts to execute
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    const el = document.querySelector('#householdMap');
    if (!el) return { present: false };
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    const data = {
      present: true,
      rect: { width: rect.width, height: rect.height, top: rect.top, left: rect.left },
      offset: { width: el.offsetWidth, height: el.offsetHeight },
      style: {
        display: style.display,
        visibility: style.visibility,
        position: style.position,
        overflow: style.overflow,
        'background-color': style.backgroundColor
      }
    };
    // also check parents up to body
    let p = el.parentElement;
    const parents = [];
    while (p) {
      const r = p.getBoundingClientRect();
      const s = window.getComputedStyle(p);
      parents.push({ tag: p.tagName, id: p.id, class: p.className, rect: {w:r.width,h:r.height}, display: s.display, visibility: s.visibility });
      p = p.parentElement;
    }
    data.parents = parents;
    return data;
  });

  console.log('debug map container:', result);

  await browser.close();
})();