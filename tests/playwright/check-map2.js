const { chromium } = require('playwright');
(async()=>{
  const browser = await chromium.launch({headless:true, args:['--no-sandbox','--disable-setuid-sandbox']});
  const page = await browser.newPage();
  await page.goto('http://localhost/terrain.html',{waitUntil:'domcontentloaded'});
  try { await page.waitForSelector('#householdMap',{timeout:5000}); } catch {}
  const hasMap = await page.$('#householdMap') !== null;
  let visible=false;
  if(hasMap){
    visible = await page.$eval('#householdMap',el=>{
      const r=el.getBoundingClientRect();return r.width>0 && r.height>0;
    });
  }
  console.log('map present',hasMap,'visible',visible);
  await browser.close();
})();