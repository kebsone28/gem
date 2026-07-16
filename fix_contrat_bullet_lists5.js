const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// The content has actual newlines in the source file, so we need to process it differently
// Let's split by actual newlines and process line by line

const lines = content.split('\n');
const processedLines = [];
let inList = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmedLine = line.trim();
  
  // Check if this line ends with semicolon and might be start of a list
  if (trimmedLine.endsWith(';') && 
      !trimmedLine.match(/^\d+\./) && // Not a numbered section
      !trimmedLine.match(/^Article/) && // Not a new article
      !trimmedLine.match(/^Titre/) && // Not a new title
      !trimmedLine.match(/^[A-Z]{2,}/)) { // Not all caps
    
    // Add the current line
    processedLines.push(line);
    
    // Look ahead to see if next lines are part of the list
    let j = i + 1;
    while (j < lines.length) {
      const nextLine = lines[j].trim();
      
      // Check if next line looks like a continuation (capital letter, not a new section)
      if (nextLine.length > 0 && 
          /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇa-zàâäéèêëïîôùûüç]/.test(nextLine) &&
          !nextLine.match(/^\d+\./) && 
          !nextLine.match(/^Article/) && 
          !nextLine.match(/^Titre/) &&
          !nextLine.match(/^[A-Z]{2,}/)) {
        
        // This is a continuation - add bullet point
        // Preserve the indentation of the original line
        const originalIndent = lines[j].match(/^(\s*)/)[1];
        processedLines.push(originalIndent + '• ' + nextLine);
        j++;
      } else {
        break;
      }
    }
    
    // Skip the lines we processed
    i = j - 1;
    continue;
  }
  
  processedLines.push(line);
}

content = processedLines.join('\n');

fs.writeFileSync(filePath, content, 'utf8');

console.log('Converted semicolon lists to bullet points by processing actual newlines');
