const { chromium } = require('playwright');
(async()=>{
  const b = await chromium.launch({headless:false});
  const p = await b.newPage();
  await p.goto('http://localhost/login.html');
  await p.waitForSelector('#loginForm');
  await p.fill('#email','admin@proquelec.com');
  await p.fill('#password','Touba2828Touba');
  await p.click('#submitBtn');
  await p.waitForTimeout(5000);
  console.log('URL after click', await p.url());
  const token = await p.evaluate(()=>localStorage.getItem('accessToken'));
  console.log('token', token);
  await b.close();
})();