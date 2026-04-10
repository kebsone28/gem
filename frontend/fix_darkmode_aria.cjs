const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
    });
}

walk('./src', (filePath) => {
    if (!filePath.endsWith('.tsx')) return;
    
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Dark Mode replacements
    // Simple naive replacements for common light mode colors to add dark mode counterparts
    // ONLY if the string doesn't already contain a dark: variant for that property
    
    const replacements = [
        { regex: /\bbg-white\b(?!.*dark:bg-)/g, replace: 'bg-white dark:bg-slate-900' },
        { regex: /\bbg-slate-50\b(?!.*dark:bg-)/g, replace: 'bg-slate-50 dark:bg-slate-800/50' },
        { regex: /\bbg-slate-100\b(?!.*dark:bg-)/g, replace: 'bg-slate-100 dark:bg-slate-800' },
        { regex: /\btext-slate-900\b(?!.*dark:text-)/g, replace: 'text-slate-900 dark:text-white' },
        { regex: /\btext-slate-800\b(?!.*dark:text-)/g, replace: 'text-slate-800 dark:text-slate-100' },
        { regex: /\btext-slate-700\b(?!.*dark:text-)/g, replace: 'text-slate-700 dark:text-slate-300' },
        { regex: /\btext-slate-600\b(?!.*dark:text-)/g, replace: 'text-slate-600 dark:text-slate-400' },
        { regex: /\bborder-slate-100\b(?!.*dark:border-)/g, replace: 'border-slate-100 dark:border-white/5' },
        { regex: /\bborder-slate-200\b(?!.*dark:border-)/g, replace: 'border-slate-200 dark:border-white/10' },
        { regex: /\bshadow-sm\b(?!.*dark:shadow-)/g, replace: 'shadow-sm dark:shadow-none' },
        
        // title -> aria-label for multiline
        { regex: /title=(["'])(.*?)\1/g, replace: 'aria-label=$1$2$1' }
    ];

    let newContent = content;
    
    // We only want to replace inside className="..." or className={`...`}
    // This is hard with pure regex. Let's just blindly replace the utility classes 
    // since this is Tailwind, collisions outside className are rare but possible.
    // A safer way is parsing className="([^"]*)"
    
    newContent = newContent.replace(/className=(["'{`])([\s\S]*?)\1/g, (match, quote, classNames) => {
        let updated = classNames;
        replacements.forEach(r => {
            if (r.regex.source.includes('title=')) return; // skip aria replacement here
            updated = updated.replace(r.regex, r.replace);
        });
        return `className=${quote}${updated}${quote}`;
    });

    // Run the aria-labels anywhere
    newContent = newContent.replace(/<button([\s\S]*?)title=(["'])(.*?)\2([\s\S]*?)>/g, '<button$1aria-label=$2$3$2$4>');

    // min-w-0 on flex children
    // If a div has `flex`, we should try to add min-w-0 to its children? Very hard to do via regex.
    // We'll skip min-w-0 in automated scripts and do it manually for important areas.

    if (original !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Audited DarkMode & Aria: ${filePath}`);
    }
});
