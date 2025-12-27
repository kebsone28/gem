const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => {
    try { console.log('PAGE LOG>', msg.type(), msg.text()); } catch(e) {}
  });
  const fileUrl = (rel) => 'file://' + path.resolve(__dirname, '..', rel).replace(/\\/g, '/');
  await page.goto(fileUrl('terrain.html'), { waitUntil: 'domcontentloaded' });

  const insertResult = await page.evaluate(async () => {
    const info = {
      isOpen: typeof window.db?.isOpen === 'function' ? window.db.isOpen() : null,
      hasMenages: !!(window.db?.menages),
      bulkPutType: typeof (window.db?.menages?.bulkPut),
      toArrayType: typeof (window.db?.menages?.toArray),
      tableFnPresent: typeof window.db?.table === 'function'
    };

    try {
      if (window.db?.menages?.clear) await window.db.menages.clear();
    } catch (e) { info.clearError = e && e.message }

    const sample = [ { id: 'DBG-1', nom_prenom_chef: 'Debug 1', gps_lat: 14.7, gps_lon: -17.4 }, { id: 'DBG-2', nom_prenom_chef: 'Debug 2', gps_lat: 14.71, gps_lon: -17.41 } ];

    try {
      if (window.db?.menages?.bulkPut) {
        await window.db.menages.bulkPut(sample);
      } else if (window.db?.menages?.put) {
        for (const s of sample) await window.db.menages.put(s);
      } else if (window.__inMemoryData && Array.isArray(window.__inMemoryData.menages)) {
        window.__inMemoryData.menages.push(...sample);
      } else {
        info.insertSkipped = true;
      }
    } catch (e) { info.insertError = e && e.message }

    try { info.menCount = window.db?.menages?.count ? await window.db.menages.count() : (window.__inMemoryData && window.__inMemoryData.menages ? window.__inMemoryData.menages.length : 0); } catch (e) { info.countError = e && e.message }

    try { info.menArray = window.db?.menages?.toArray ? await window.db.menages.toArray() : (window.__inMemoryData && window.__inMemoryData.menages ? window.__inMemoryData.menages.slice() : []); } catch (e) { info.toArrayError = e && e.message }

    try { info.inMem = window.__inMemoryData ? Object.keys(window.__inMemoryData).reduce((acc,k)=>{acc[k]=window.__inMemoryData[k].slice();return acc;},{}) : null } catch (e) { }

    try { info.dbKeys = Object.keys(window.db || {}); } catch (e) { }

    return info;
  });

  console.log('Insert result:', JSON.stringify(insertResult, null, 2));
  await browser.close();
})();
