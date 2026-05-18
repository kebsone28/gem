const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

// 1. Move the files
const utilsDir = path.join(__dirname, 'utils');
const securityDir = path.join(__dirname, 'core', 'security');

if (!fs.existsSync(securityDir)) fs.mkdirSync(securityDir, { recursive: true });

if (fs.existsSync(path.join(utilsDir, 'permissions.ts'))) {
  fs.renameSync(path.join(utilsDir, 'permissions.ts'), path.join(securityDir, 'types.ts'));
}
if (fs.existsSync(path.join(utilsDir, 'roleUtils.ts'))) {
  fs.renameSync(path.join(utilsDir, 'roleUtils.ts'), path.join(securityDir, 'roleUtils.ts'));
}

// 2. Update all imports across the frontend/src directory
walk(__dirname, (filePath) => {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // We moved permissions.ts to core/security/types.ts
    // The relative depth changes. But wait, replacing paths by absolute aliases is better if configured, 
    // or just a regex replace for relative paths.
    
    // Instead of complex relative path calculation, let's just do a regex replace for any import containing 'utils/permissions'
    // This is tricky. Let's calculate the relative path based on __dirname.
    
    const depth = filePath.replace(__dirname, '').split(path.sep).length - 2;
    const prefix = depth === 0 ? './' : '../'.repeat(depth);
    
    const securityPath = prefix + 'core/security/types';
    const rolePath = prefix + 'core/security/roleUtils';
    
    content = content.replace(/['"]([^'"]*)utils\/permissions['"]/g, `'${securityPath}'`);
    content = content.replace(/['"]([^'"]*)utils\/roleUtils['"]/g, `'${rolePath}'`);
    
    // Also handle MODULE_REGISTRY path if we moved it
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated imports in ${filePath}`);
    }
  }
});
