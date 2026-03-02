// copy-static-assets.js
// After vite build, copy vendor, manifest.json, sw.js, and any other static
// resources into the dist folder so that Nginx can serve them correctly.

const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function main() {
    const projectRoot = path.resolve(__dirname, '..');
    const distDir = path.join(projectRoot, 'dist');

    console.log('Copying static assets to', distDir);

    // first ensure manifest.json and sw.js exist at project root; if not create minimal ones
    const manifestSrc = path.join(projectRoot, 'manifest.json');
    if (!fs.existsSync(manifestSrc)) {
        const manifestData = {
            name: 'Proquelec',
            short_name: 'Proquelec',
            start_url: '/',
            display: 'standalone',
            icons: []
        };
        fs.writeFileSync(manifestSrc, JSON.stringify(manifestData));
        console.log('  created manifest.json');
    }
    const swSrc = path.join(projectRoot, 'sw.js');
    if (!fs.existsSync(swSrc)) {
        const swCode = `self.addEventListener('install',function(e){self.skipWaiting();});`;
        fs.writeFileSync(swSrc, swCode);
        console.log('  created sw.js');
    }

    // list of things to copy
    const things = [
        'vendor',
        'manifest.json',
        'sw.js',
        // standalone scripts used by HTML
        // files under src/infrastructure/external
        'src/infrastructure/external/ApiService.js',
        'src/infrastructure/external/AuthGuard.js',
        // legacy standalone scripts at project root
        'import_manager.js',
        'map_manager.js',
        'terrain_main.js',
        'auto-start-backup-watcher.js'
    ];

    for (let item of things) {
        // allow copying from subdirectories; preserve filename in dest root if path contains '/'
        const srcPath = path.join(projectRoot, item);
        let destPath;
        if (item.includes('/')) {
            destPath = path.join(distDir, path.basename(item));
        } else {
            destPath = path.join(distDir, item);
        }
        if (fs.existsSync(srcPath)) {
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
                copyDir(srcPath, destPath);
                console.log('  copied directory', item);
            } else {
                fs.copyFileSync(srcPath, destPath);
                console.log('  copied file', item);
            }
        } else {
            console.warn('  source not found, skipping', item);
        }
    }

    console.log('Done.');
}

main();
