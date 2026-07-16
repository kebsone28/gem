const fs = require('fs');
const path = require('path');

// Read the clean contract text
const contractText = fs.readFileSync(path.join(__dirname, 'docs/contrats_full.txt'), 'utf8');

// Split by lot
const lotA = contractText.split('PROQUELEC - LOT B')[0];
const lotBStart = contractText.indexOf('PROQUELEC - LOT B');
const lotCStart = contractText.indexOf('PROQUELEC - LOT C');
const lotB = contractText.substring(lotBStart, lotCStart);
const lotC = contractText.substring(lotCStart);

console.log('Extracted contracts:');
console.log('LOT A length:', lotA.length);
console.log('LOT B length:', lotB.length);
console.log('LOT C length:', lotC.length);

// Save individual contracts for reference
fs.writeFileSync(path.join(__dirname, 'docs/lotA.txt'), lotA);
fs.writeFileSync(path.join(__dirname, 'docs/lotB.txt'), lotB);
fs.writeFileSync(path.join(__dirname, 'docs/lotC.txt'), lotC);

console.log('Saved individual contract files');
