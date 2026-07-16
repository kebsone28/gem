const fs = require('fs');
const path = require('path');

// Read the individual contract files
const lotA = fs.readFileSync(path.join(__dirname, 'docs/lotA.txt'), 'utf8');
const lotB = fs.readFileSync(path.join(__dirname, 'docs/lotB.txt'), 'utf8');
const lotC = fs.readFileSync(path.join(__dirname, 'docs/lotC.txt'), 'utf8');

// Read the current corrupted file to get the structure (functions, imports, etc.)
const currentFile = fs.readFileSync(path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts'), 'utf8');

// Extract the non-contract parts (imports, functions, etc.)
const lines = currentFile.split('\n');
const nonContractLines = [];
let inContract = false;
let contractName = '';

for (const line of lines) {
  if (line.match(/^const CONTRAT_LOT_[ABC] = `/)) {
    inContract = true;
    contractName = line.match(/const (CONTRAT_LOT_[ABC]) = `/)[1];
    continue;
  }
  
  if (inContract && line === '`;') {
    inContract = false;
    // Add the clean contract text here
    let cleanContract;
    if (contractName === 'CONTRAT_LOT_A') {
      cleanContract = lotA.trim();
    } else if (contractName === 'CONTRAT_LOT_B') {
      cleanContract = lotB.trim();
    } else if (contractName === 'CONTRAT_LOT_C') {
      cleanContract = lotC.trim();
    }
    
    // Escape backticks and backslashes for template string
    cleanContract = cleanContract.replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/\$/g, '\\$');
    
    nonContractLines.push('const ' + contractName + ' = `' + cleanContract + '`;');
    continue;
  }
  
  if (!inContract) {
    nonContractLines.push(line);
  }
}

const restoredContent = nonContractLines.join('\n');

fs.writeFileSync(path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts'), restoredContent, 'utf8');

console.log('Restored docxEngine.ts with clean contract text');
