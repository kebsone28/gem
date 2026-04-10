const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

let modifiedFiles = 0;

walk('./src', (filePath) => {
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let newContent = content;

    // 1. Typography: Replace text-[8px], text-[9px], text-[10px], text-[11px] with text-xs
    newContent = newContent.replace(/text-\[(?:8|9|10|11)px\]/g, 'text-xs');

    // 2. Titles: Replace title="XYZ" to aria-label="XYZ" on buttons
    // This regex looks for <button ... title="..." ...>
    // A bit dangerous as it could match inside strings, but for JSX it's mostly safe.
    newContent = newContent.replace(/<button([^>]*)title=(["'])(.*?)\2([^>]*)>/g, '<button$1aria-label=$2$3$2$4>');

    // 3. Overflow X Auto: Add fade effect
    // We look for className="..." containing overflow-x-auto and add relative if missing, 
    // but honestly it's safer to just let the developer know or do it carefully.
    
    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        modifiedFiles++;
        console.log(`Updated typography/aria in: ${filePath}`);
    }
});

console.log(`Total files modified: ${modifiedFiles}`);
