import fs from 'fs';
import http from 'http';

const planResp = await fetch('http://localhost:5008/api/formations/planify', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ regions: [{ region: 'Dakar', count: 5 }], options: { includeWeekends: false } })
});
const plan = await planResp.json();
fs.writeFileSync('plan.json', JSON.stringify(plan, null, 2), 'utf8');
console.log('PLAN_OK');

const docxResp = await fetch('http://localhost:5008/api/formations/planify/export', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan, format: 'docx' })
});
const docxBuffer = Buffer.from(await docxResp.arrayBuffer());
fs.writeFileSync('plan_test.docx', docxBuffer);
console.log('DOCX_OK');

const pdfResp = await fetch('http://localhost:5008/api/formations/planify/export', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan, format: 'pdf' })
});
const pdfBuffer = Buffer.from(await pdfResp.arrayBuffer());
fs.writeFileSync('plan_test.pdf', pdfBuffer);
console.log('PDF_OK');

const commitResp = await fetch('http://localhost:5008/api/formations/planify/commit', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ plan })
});
const commitJson = await commitResp.json();
console.log('COMMIT_OK', JSON.stringify(commitJson));
