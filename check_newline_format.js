const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Find the Article 6.1 section to see how newlines are represented
const match = content.match(/6\.1 Livraison des matériels([^]*?)6\.2/);

if (match) {
  console.log('Raw content of Article 6.1:');
  console.log(JSON.stringify(match[1]));
  console.log('\n\n');
  console.log('Display content:');
  console.log(match[1]);
} else {
  console.log('Pattern not found');
}
