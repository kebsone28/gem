const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Add a function to format semicolon lists as bullet lists
const bulletFormattingFunction = `
// ─── Formatage des listes à puces ───────────────────────────────────────────────
function formatTextWithBullets(text: string): string {
  const lines = text.split('\\\\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) {
      result.push('');
      continue;
    }
    
    // Check if this line ends with semicolon and might be start of a list
    if (line.endsWith(';') && 
        !line.match(/^\\d+\\./) && // Not a numbered section
        !line.match(/^Article/) && // Not a new article
        !line.match(/^Titre/) && // Not a new title
        !line.match(/^[A-Z]{2,}/)) { // Not all caps
      
      // Add the current line
      result.push(line);
      
      // Look ahead for continuation items
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j].trim();
        
        // Check if next line looks like a continuation
        if (nextLine.length > 0 && 
            /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇa-zàâäéèêëïîôùûüç]/.test(nextLine) &&
            !nextLine.match(/^\\d+\\./) && 
            !nextLine.match(/^Article/) && 
            !nextLine.match(/^Titre/) &&
            !nextLine.match(/^[A-Z]{2,}/)) {
          
          // This is a continuation - add bullet point
          result.push('• ' + nextLine);
          j++;
        } else {
          break;
        }
      }
      
      // Skip the lines we processed
      i = j - 1;
    } else {
      result.push(line);
    }
  }
  
  return result.join('\\\\n');
}
`;

// Insert the function before the generateContratBlob function
const insertPosition = content.indexOf('// ─── Génération DOCX ───────────────────────────────────────────────────────────');
if (insertPosition !== -1) {
  content = content.slice(0, insertPosition) + bulletFormattingFunction + '\n' + content.slice(insertPosition);
}

// Update the generateContratBlob function to use the formatting
content = content.replace(
  /let content = contrat;\n  \/\/ Replace placeholders/,
  `let content = contrat;\n  // Format text with bullets\n  content = formatTextWithBullets(content);\n  // Replace placeholders`
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('Added bullet formatting function to docxEngine');
