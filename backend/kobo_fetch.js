import fs from 'fs';

async function getForm() {
  const url = 'https://kf.kobotoolbox.org/api/v2/assets/aEYZwPujJiFBTNb6mxMGCB/';
  console.log('Fetching from:', url);
  try {
    const res = await fetch(url, { headers: { 'Authorization': 'Token 2e3a09a8bff3fbb3a2510dbcba84486582897f3f' } });
    const data = await res.json();
    fs.writeFileSync('kobo_form.json', JSON.stringify(data, null, 2));
    console.log('Saved to kobo_form.json');
  } catch (e) {
    console.error(e);
  }
}
getForm();
