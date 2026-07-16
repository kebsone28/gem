const { execSync } = require('child_process');
const fs = require('fs');
try {
  execSync('npx tsc --noEmit 2>tsc_full.txt', { cwd: 'frontend', timeout: 180000 });
  const out = fs.readFileSync('frontend/tsc_full.txt', 'utf8');
  const lines = out.split('\n');
  const cartoLines = lines.filter((l) => l.includes('carto_grappes'));
  fs.writeFileSync('tsc_carto.txt', cartoLines.join('\n'));
  fs.writeFileSync('tsc_total.txt', 'Total: ' + lines.length + ' Carto: ' + cartoLines.length);
} catch (e) {
  try {
    const out = fs.readFileSync('frontend/tsc_full.txt', 'utf8');
    const lines = out.split('\n');
    const cartoLines = lines.filter((l) => l.includes('carto_grappes'));
    fs.writeFileSync('tsc_carto.txt', cartoLines.join('\n'));
    fs.writeFileSync('tsc_total.txt', 'Total: ' + lines.length + ' Carto: ' + cartoLines.length);
  } catch (e2) {
    fs.writeFileSync('tsc_total.txt', 'ERROR: ' + e2.message);
  }
}
