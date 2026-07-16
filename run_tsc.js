const {execSync} = require('child_process');
const fs = require('fs');
try {
  execSync('npx tsc --noEmit --pretty false 2>tsc_output.txt', {cwd: 'frontend', encoding:'utf8', timeout: 180000});
} catch(e) {
  // tsc exits non-zero when there are errors, that's expected
}
const out = fs.readFileSync('frontend/tsc_output.txt', 'utf8');
const lines = out.split('\n').filter(l => l.includes('carto_grappes') && l.includes('error TS'));
fs.writeFileSync('tsc_carto_errors.txt', lines.length > 0 ? lines.join('\n') : 'NO CARTO GRAPPES ERRORS FOUND');
// Also save total count
const totalErrors = out.split('\n').filter(l => l.includes('error TS')).length;
fs.writeFileSync('tsc_total_errors.txt', String(totalErrors));
