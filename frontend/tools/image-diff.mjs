import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

function listScans(dir) {
  return fs.readdirSync(dir).filter(f => f.startsWith('scan-') || f.startsWith('mobile-scan-')).sort();
}

function ensure(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readPng(file) {
  const buf = fs.readFileSync(file);
  return PNG.sync.read(buf);
}

function writePng(png, file) {
  const buf = PNG.sync.write(png);
  fs.writeFileSync(file, buf);
}

async function run() {
  const base = path.resolve(process.cwd(), 'test-artifacts');
  if (!fs.existsSync(base)) {
    console.error('No test-artifacts directory found');
    process.exit(1);
  }

  const scans = listScans(base);
  if (scans.length < 2) {
    console.error('Need at least two scan folders to compare');
    process.exit(1);
  }

  const previous = scans[scans.length - 2];
  const latest = scans[scans.length - 1];
  console.log('Comparing', previous, '→', latest);

  const prevDir = path.join(base, previous);
  const latestDir = path.join(base, latest);
  const outDir = path.join(base, `${latest}-diffs`);
  ensure(outDir);

  const prevFiles = fs.readdirSync(prevDir).filter(f => f.endsWith('.png'));
  const latestFiles = fs.readdirSync(latestDir).filter(f => f.endsWith('.png'));

  const pairs = latestFiles.map(f => {
    const match = prevFiles.find(p => p === f) || null;
    return { name: f, prev: match ? path.join(prevDir, match) : null, latest: path.join(latestDir, f) };
  });

  const report = [];
  for (const p of pairs) {
    try {
      const imgB = readPng(p.latest);
      let imgA = null;
      if (p.prev) imgA = readPng(p.prev);

      if (!imgA) {
        report.push({ file: p.name, status: 'new', diff: null });
        // copy latest as-is to outDir for reference
        fs.copyFileSync(p.latest, path.join(outDir, p.name.replace('.png', '--latest.png')));
        continue;
      }

      const width = Math.max(imgA.width, imgB.width);
      const height = Math.max(imgA.height, imgB.height);

      const A = new PNG({ width, height });
      const B = new PNG({ width, height });
      A.bitblt(imgA, 0, 0, imgA.width, imgA.height, 0, 0);
      B.bitblt(imgB, 0, 0, imgB.width, imgB.height, 0, 0);

      const diff = new PNG({ width, height });
      const diffPixels = pixelmatch(A.data, B.data, diff.data, width, height, { threshold: 0.12 });

      const diffPath = path.join(outDir, p.name.replace('.png', '--diff.png'));
      writePng(diff, diffPath);

      report.push({ file: p.name, status: diffPixels > 0 ? 'changed' : 'identical', diff: diffPath, pixels: diffPixels });
    } catch (e) {
      console.error('Error processing', p.name, e);
    }
  }

  const reportPath = path.join(outDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ previous, latest, items: report }, null, 2), 'utf8');
  console.log('Diffs written to', outDir);
  console.log('Report:', reportPath);
}

run().catch(e => { console.error(e); process.exit(1); });
