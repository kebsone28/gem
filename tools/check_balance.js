const fs = require('fs');
const path = process.argv[2] || 'frontend/src/pages/AdminUsers.tsx';
const s = fs.readFileSync(path, 'utf8');
const open = { '{': '}', '(': ')', '[': ']' };
const close = { '}': '{', ')': '(', ']': '[' };
const stack = [];
let line = 1, col = 0;
for (let i = 0; i < s.length; i++) {
  const ch = s[i];
  if (ch === '\n') { line++; col = 0; continue; }
  col++;
  if (open[ch]) {
    stack.push({ ch, line, col, i });
  } else if (close[ch]) {
    const last = stack.pop();
    if (!last || last.ch !== close[ch]) {
      console.error('Unmatched close', ch, 'at', path + ':' + line + ':' + col);
      process.exit(2);
    }
  }
}
if (stack.length) {
  const last = stack[stack.length-1];
  console.error('Unclosed', last.ch, 'opened at', path + ':' + last.line + ':' + last.col);
  process.exit(3);
}
console.log('All balanced');
