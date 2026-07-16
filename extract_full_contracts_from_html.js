const fs = require('fs');
const path = require('path');

const htmlFile = path.join(__dirname, 'docs/Cartographie et suivi des grappes de raccordement LSE.html');
const htmlContent = fs.readFileSync(htmlFile, 'utf8');

// Search for the full contract text in the HTML
// The contracts are likely embedded in the HTML as text content

// Extract sections that contain "CONTRAT DE PRESTATION DE SERVICE"
const contractSections = htmlContent.split(/CONTRAT DE PRESTATION DE SERVICE/);

console.log(`Found ${contractSections.length} sections with "CONTRAT DE PRESTATION DE SERVICE"`);

// Extract Lot A, B, C contracts
let lotAContract = '';
let lotBContract = '';
let lotCContract = '';

// Look for the contract text in the HTML
const lines = htmlContent.split('\n');
let currentContract = '';
let inContract = false;
let contractName = '';

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  // Check if this line starts a contract section
  if (line.includes('CONTRAT DE PRESTATION DE SERVICE') && line.includes('LOT A:')) {
    currentContract = 'LOT A';
    inContract = true;
    continue;
  } else if (line.includes('CONTRAT DE PRESTATION DE SERVICE') && line.includes('LOT B:')) {
    currentContract = 'LOT B';
    inContract = true;
    continue;
  } else if (line.includes('CONTRAT DE PRESTATION DE SERVICE') && line.includes('LOT C:')) {
    currentContract = 'LOT C';
    inContract = true;
    continue;
  }
  
  if (inContract) {
    // Check if we've reached the end of the contract
    if (line.includes('PROQUELEC') && line.includes('Pour le Prestataire')) {
      // This might be the signature section, still part of contract
      currentContract += line + '\n';
    } else if (line.includes('Fait à') && line.includes('exemplaires')) {
      // End of contract
      currentContract += line + '\n';
      inContract = false;
      
      if (currentContract === 'LOT A') {
        lotAContract = currentContract;
      } else if (currentContract === 'LOT B') {
        lotBContract = currentContract;
      } else if (currentContract === 'LOT C') {
        lotCContract = currentContract;
      }
      currentContract = '';
    } else {
      currentContract += line + '\n';
    }
  }
}

console.log('Lot A contract length:', lotAContract.length);
console.log('Lot B contract length:', lotBContract.length);
console.log('Lot C contract length:', lotCContract.length);

// Save the extracted contracts
if (lotAContract) {
  fs.writeFileSync(path.join(__dirname, 'docs/lotA_full.txt'), lotAContract, 'utf8');
  console.log('Saved Lot A full contract');
}

if (lotBContract) {
  fs.writeFileSync(path.join(__dirname, 'docs/lotB_full.txt'), lotBContract, 'utf8');
  console.log('Saved Lot B full contract');
}

if (lotCContract) {
  fs.writeFileSync(path.join(__dirname, 'docs/lotC_full.txt'), lotCContract, 'utf8');
  console.log('Saved Lot C full contract');
}
