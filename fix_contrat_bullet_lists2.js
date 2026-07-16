const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// More direct approach: find patterns like "Text;\nText;\nText." and convert to bullets
// This specifically targets the example given: Article 6 sections

// Pattern for 3-item lists: Item1;\nItem2;\nItem3.
const threeItemList = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*)\./g;

content = content.replace(threeItemList, (match, p1, p2, p3) => {
  // Clean up each part
  const clean1 = p1.trim();
  const clean2 = p2.trim();
  const clean3 = p3.trim();
  return clean1 + '\n• ' + clean2 + '\n• ' + clean3 + '.';
});

// Pattern for 4-item lists: Item1;\nItem2;\nItem3;\nItem4.
const fourItemList = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*)\./g;

content = content.replace(fourItemList, (match, p1, p2, p3, p4) => {
  const clean1 = p1.trim();
  const clean2 = p2.trim();
  const clean3 = p3.trim();
  const clean4 = p4.trim();
  return clean1 + '\n• ' + clean2 + '\n• ' + clean3 + '\n• ' + clean4 + '.';
});

// Pattern for 2-item lists: Item1;\nItem2.
const twoItemList = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*)\./g;

content = content.replace(twoItemList, (match, p1, p2) => {
  const clean1 = p1.trim();
  const clean2 = p2.trim();
  return clean1 + '\n• ' + clean2 + '.';
});

// Handle lists that span across lines (text with line breaks in the middle)
// Pattern: Text;\nContinued text;\nFinal text.
const multiLinePattern = /([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*;)\n([a-zA-ZàâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ][^;]*)\./g;

content = content.replace(multiLinePattern, (match, p1, p2, p3) => {
  const clean1 = p1.trim();
  const clean2 = p2.trim();
  const clean3 = p3.trim();
  return clean1 + '\n• ' + clean2 + '\n• ' + clean3 + '.';
});

fs.writeFileSync(filePath, content, 'utf8');

console.log('Converted semicolon lists to bullet points - attempt 2');
