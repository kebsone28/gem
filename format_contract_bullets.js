const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Process each contract constant to add bullet points
function formatContractLists(text) {
  // Find the contract constants
  const lines = text.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if this is a contract constant declaration
    if (line.match(/^const CONTRAT_LOT_[ABC] = `/)) {
      result.push(line);
      
      // Get the contract content (everything until the closing backtick)
      let contractContent = '';
      let j = i + 1;
      
      while (j < lines.length) {
        if (lines[j].trim() === '`;') {
          break;
        }
        contractContent += lines[j] + '\n';
        j++;
      }
      
      // Process the contract content to add bullets
      const formatted = addBulletsToContract(contractContent);
      result.push(formatted);
      result.push('`;');
      
      // Skip the lines we processed
      i = j;
    } else {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

function addBulletsToContract(contractText) {
  // Split by \n (literal backslash-n in the template string)
  const items = contractText.split('\\n');
  const result = [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Check if this looks like the start of a list (ends with semicolon)
    if (item.trim().endsWith(';') && !item.trim().match(/^\d+\./) && !item.trim().match(/^Article/) && !item.trim().match(/^Titre/)) {
      result.push(item);
      
      // Look ahead for continuation items
      let j = i + 1;
      while (j < items.length) {
        const nextItem = items[j].trim();
        
        // Check if this looks like a continuation
        if (nextItem.length > 0 && 
            /^[A-ZÀÂÄÉÈÊËÏÎÔÙÛÜÇa-zàâäéèêëïîôùûüç]/.test(nextItem) &&
            !nextItem.match(/^\d+\./) && 
            !nextItem.match(/^Article/) && 
            !nextItem.match(/^Titre/) &&
            !nextItem.match(/^[A-Z]{2,}/) &&
            !nextItem.endsWith(';')) { // Not ending with semicolon means it's a continuation
          
          result.push('• ' + nextItem);
          j++;
        } else if (nextItem.endsWith(';') && !nextItem.match(/^\d+\./) && !nextItem.match(/^Article/) && !nextItem.match(/^Titre/)) {
          // Another list item
          result.push('• ' + nextItem);
          j++;
        } else {
          break;
        }
      }
      
      i = j - 1;
    } else {
      result.push(item);
    }
  }
  
  return result.join('\\n');
}

content = formatContractLists(content);

fs.writeFileSync(filePath, content, 'utf8');

console.log('Formatted contract lists with bullet points');
