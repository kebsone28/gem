const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Process line by line to convert inline semicolon lists to bullet lists
const lines = content.split('\n');
const processedLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  const trimmedLine = line.trim();
  
  // Skip lines that are clearly not list items
  if (trimmedLine.match(/^\d+\./) || // Numbered section
      trimmedLine.match(/^Article/) || // Article header
      trimmedLine.match(/^Titre/) || // Title header
      trimmedLine.match(/^[A-Z]{2,}/) || // All caps header
      trimmedLine.match(/^const /) || // Code
      trimmedLine.match(/^export /) || // Code
      trimmedLine.match(/^import /) || // Code
      trimmedLine.match(/^  /) && !trimmedLine.match(/•/)) { // Indented but not already bulleted
    
    processedLines.push(line);
    continue;
  }
  
  // Check if this line contains multiple semicolon-separated items
  // Pattern: Text; Text; Text.
  if (trimmedLine.includes(';') && trimmedLine.match(/^[^;]*;[^;]*;/)) {
    
    // Count semicolons to determine if it's a list
    const semicolonCount = (trimmedLine.match(/;/g) || []).length;
    
    if (semicolonCount >= 2) {
      // This looks like a list - split it and add bullets
      const items = trimmedLine.split(';').map(item => item.trim());
      
      if (items.length >= 2) {
        // First item stays as is (without the semicolon)
        let firstItem = items[0];
        
        // Process remaining items
        const bulletItems = [];
        for (let j = 1; j < items.length; j++) {
          let item = items[j];
          // Remove trailing period from last item
          if (j === items.length - 1) {
            item = item.replace(/\.$/, '');
          }
          bulletItems.push('• ' + item);
        }
        
        // Reconstruct: first item; then each bullet item on new line
        const originalIndent = line.match(/^(\s*)/)[1];
        processedLines.push(originalIndent + firstItem + ';');
        
        for (const bulletItem of bulletItems) {
          processedLines.push(originalIndent + bulletItem + ';');
        }
        
        // Add final period
        processedLines[processedLines.length - 1] = processedLines[processedLines.length - 1].replace(/;$/, '.');
        
        continue;
      }
    }
  }
  
  processedLines.push(line);
}

content = processedLines.join('\n');

fs.writeFileSync(filePath, content, 'utf8');

console.log('Converted inline semicolon lists to bullet lists');
