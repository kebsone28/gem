
const fs = require('fs');
const content = fs.readFileSync('parametres.html', 'utf-8');

const scriptMatch = content.match(/<script>(?!.*src=)([\s\S]*?)<\/script>/i);
if (!scriptMatch) {
    console.log("No inline script found");
    process.exit(0);
}

const script = scriptMatch[1];
const lines = script.split('\n');
const offset = content.split('<script')[0].split('\n').length; // Heuristic for line offset

try {
    new Function(script);
    console.log("Syntax is VALID according to new Function()");
} catch (e) {
    console.log("Syntax ERROR found:");
    console.log(e.message);
    // Find the approximate location
    // We can try to bifurcate
}

// Manual deep check for braces/parens balance per block
let stack = [];
let inString = null;
let inBacktick = false;

for (let i = 0; i < script.length; i++) {
    const char = script[i];
    const next = script[i + 1];

    if (inString) {
        if (char === inString && script[i - 1] !== '\\') inString = null;
    } else if (inBacktick) {
        if (char === '`' && script[i - 1] !== '\\') inBacktick = false;
        else if (char === '$' && next === '{' && script[i - 1] !== '\\') {
            stack.push({ char: '${', pos: i });
            i++;
        }
    } else {
        if (char === "'" || char === '"') inString = char;
        else if (char === '`') inBacktick = true;
        else if (char === '{' || char === '(' || char === '[') stack.push({ char, pos: i });
        else if (char === '}' || char === ')' || char === ']') {
            if (stack.length === 0) {
                console.log(`EXTRA closing ${char} at script pos ${i}`);
            } else {
                const top = stack.pop();
                if ((char === '}' && top.char !== '{' && top.char !== '${') ||
                    (char === ')' && top.char !== '(') ||
                    (char === ']' && top.char !== '[')) {
                    console.log(`MISMATCH: got ${char} closing ${top.char} from pos ${top.pos} (at pos ${i})`);
                }
            }
        }
    }
}

stack.forEach(unclosed => {
    // Find line number
    const lineNo = script.substring(0, unclosed.pos).split('\n').length + offset - 1;
    console.log(`UNCLOSED ${unclosed.char} from line ${lineNo}`);
});

if (inString) console.log(`UNCLOSED string ${inString}`);
if (inBacktick) console.log("UNCLOSED backtick block");
