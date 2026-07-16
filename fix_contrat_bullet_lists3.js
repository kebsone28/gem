const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Split by literal \n to process line by line
const lines = content.split('\n');
const processedLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check if this line ends with semicolon and the next line looks like it continues a list
  if (line.trim().endsWith(';') && i + 1 < lines.length) {
    const nextLine = lines[i + 1].trim();
    // If next line starts with capital letter and doesn't look like a new section
    if (nextLine.length > 0 && 
        /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇ]/.test(nextLine) && 
        !nextLine.match(/^\d+\./) && // Not a numbered section
        !nextLine.match(/^Article/) && // Not a new article
        !nextLine.match(/^Titre/) && // Not a new title
        !nextLine.match(/[A-Z]{2,}/)) { // Not all caps (probably a header)
      
      // This looks like a list continuation
      processedLines.push(line);
      processedLines.push('• ' + nextLine);
      i++; // Skip the next line as we've processed it
      continue;
    }
  }
  
  processedLines.push(line);
}

// Rejoin the lines
content = processedLines.join('\n');

fs.writeFileSync(filePath, content, 'utf8');

console.log('Converted semicolon lists to bullet points - attempt 3');
