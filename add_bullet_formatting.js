const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Function to convert semicolon lists to bullet lists in contract text
function convertSemicolonListsToBullets(text) {
  // This works on the raw contract text before it's escaped for template strings
  // We need to find patterns like: "Item1;\nItem2;\nItem3." and convert to bullets
  
  // First, let's process line by line within the contract constants
  const lines = text.split('\n');
  const processedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Skip if not a contract line
    if (!trimmedLine.startsWith('const CONTRAT_LOT_')) {
      processedLines.push(line);
      continue;
    }
    
    // This is a contract constant line
    processedLines.push(line);
    
    // Now process the contract content until we reach the closing backtick
    let j = i + 1;
    const contractLines = [];
    
    while (j < lines.length) {
      const contractLine = lines[j];
      
      if (contractLine.trim() === '`;') {
        // End of contract
        break;
      }
      
      contractLines.push(contractLine);
      j++;
    }
    
    // Process the contract content to add bullets
    const processedContract = processContractContent(contractLines.join('\n'));
    processedLines.push(processedContract);
    processedLines.push('`;');
    
    // Skip the contract lines we processed
    i = j;
  }
  
  return processedLines.join('\n');
}

function processContractContent(contractText) {
  // Split by literal \n which represents newlines in the template string
  const items = contractText.split('\\n');
  const processedItems = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Check if this item ends with semicolon and the next items look like list continuations
    if (item.trim().endsWith(';') && i + 1 < items.length) {
      processedItems.push(item);
      
      // Look ahead for list items
      let j = i + 1;
      while (j < items.length) {
        const nextItem = items[j].trim();
        
        // Check if next item looks like a continuation (starts with capital letter, not a new section)
        if (nextItem.length > 0 && 
            /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇa-zàâäéèêëïîôùûüç]/.test(nextItem) &&
            !nextItem.match(/^\d+\./) && // Not a numbered section
            !nextItem.match(/^Article/) && // Not a new article
            !nextItem.match(/^Titre/) && // Not a new title
            !nextItem.match(/^[A-Z]{2,}/)) { // Not all caps
          
          // This is a continuation - add bullet
          processedItems.push('• ' + nextItem);
          j++;
        } else {
          break;
        }
      }
      
      // Skip the items we processed
      i = j - 1;
      continue;
    }
    
    processedItems.push(item);
  }
  
  return processedItems.join('\\n');
}

content = convertSemicolonListsToBullets(content);

fs.writeFileSync(filePath, content, 'utf8');

console.log('Added bullet formatting to contract lists');
