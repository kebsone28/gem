const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Function to convert semicolon-separated lists to bullet points
function convertSemicolonLists(text) {
  // Pattern to match semicolon-separated lists
  // This matches text that looks like: Item1;\nItem2;\nItem3.
  // We want to convert it to: Item1;\n• Item2;\n• Item3.
  
  // First, let's handle lists that end with a period
  const pattern = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;\n]*);\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;\n]*;\n)+([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;\n]*)\./g;
  
  text = text.replace(pattern, (match) => {
    // Split by semicolon and process
    const items = match.split(';\n').map(item => item.trim());
    if (items.length < 2) return match;
    
    // First item stays as is, others get bullets
    let result = items[0];
    for (let i = 1; i < items.length; i++) {
      let item = items[i];
      // Remove trailing period from last item
      if (i === items.length - 1) {
        item = item.replace(/\.$/, '');
      }
      result += ';\n• ' + item;
    }
    return result + '.';
  });
  
  return text;
}

// Apply the conversion
content = convertSemicolonLists(content);

// More aggressive pattern for specific cases
// Pattern: Text;\nMore text (possibly across lines);\nFinal text.
const multiLinePattern = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^.;]*)\./g;

content = content.replace(multiLinePattern, (match, p1, p2, p3) => {
  return p1 + '\n• ' + p2 + '\n• ' + p3 + '.';
});

// Handle longer lists (4+ items)
const longListPattern = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^.;]*)\./g;

content = content.replace(longListPattern, (match, p1, p2, p3, p4) => {
  return p1 + '\n• ' + p2 + '\n• ' + p3 + '\n• ' + p4 + '.';
});

// Handle even longer lists (5+ items)
const veryLongListPattern = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;.;\n]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^.;]*)\./g;

content = content.replace(veryLongListPattern, (match, p1, p2, p3, p4, p5) => {
  return p1 + '\n• ' + p2 + '\n• ' + p3 + '\n• ' + p4 + '\n• ' + p5 + '.';
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('Converted semicolon lists to bullet points');
