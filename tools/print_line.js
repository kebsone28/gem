const fs = require('fs');
const path = process.argv[2] || 'frontend/src/pages/AdminUsers.tsx';
const lineNum = parseInt(process.argv[3] || '1996', 10);
const s = fs.readFileSync(path,'utf8').split('\n');
const line = s[lineNum-1] || '';
console.log(lineNum+': '+line);
let caret = '';
for(let i=0;i<line.length && i<200;i++) caret += (i+1===28? '^': ' ');
console.log(''.padStart( (lineNum+': ').length, ' ')+caret);
