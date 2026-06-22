const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fp = path.join(dir, file);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        results = results.concat(walk(fp));
      } else if (fp.endsWith('.tsx')) {
        const lines = fs.readFileSync(fp, 'utf8').split('\n');
        lines.forEach((line, i) => {
          if (/style=\{\{/.test(line) && !line.includes("'--") && !line.includes('"--') && !line.includes('...')) {
            results.push({
              file: path.relative(process.cwd(), fp).replace(/\\/g, '/'),
              line: i + 1,
              code: line.trim().substring(0, 140)
            });
          }
        });
      }
    });
  } catch (e) { /* skip */ }
  return results;
}

const dirs = [
  'frontend/src/modules',
  'frontend/src/components',
];

let hits = [];
dirs.forEach(d => { hits = hits.concat(walk(d)); });
hits.forEach(h => console.log(`${h.file}:${h.line}  =>  ${h.code}`));
console.log(`\n--- TOTAL LEGACY INLINE STYLES: ${hits.length} ---`);
