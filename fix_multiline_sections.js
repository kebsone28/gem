const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Fix sections where text spans multiple lines in the source file
// These need to be joined and then formatted with bullets

// Fix 6.1 - join the broken line "Prestataire);"
content = content.replace(
  /Transport, manutention et stockage temporaire \(à la charge du\nPrestataire\);/g,
  'Transport, manutention et stockage temporaire (à la charge du Prestataire);'
);

// Fix 6.2 - join the broken line "Tranchées\nconformes"
content = content.replace(
  /Tranchées\nconformes aux normes \(profondeur, largeur\);/g,
  'Tranchées conformes aux normes (profondeur, largeur);'
);

// Fix 6.3 - join the broken line "le Prestataire pour le mur);"
content = content.replace(
  /Utilisation de parpaings, ciment, sable \(fournis par\nle Prestataire pour le mur\);/g,
  'Utilisation de parpaings, ciment, sable (fournis par le Prestataire pour le mur);'
);

// Fix 6.4 - join the broken line "Stabilité et\naccessibilité"
content = content.replace(
  /Stabilité et\naccessibilité du potelet\./g,
  'Stabilité et accessibilité du potelet.'
);

// Fix 6.6 - join the broken line "points\nlumineux"
content = content.replace(
  /Prises, interrupteurs, points\nlumineux, boîtes de dérivation;/g,
  'Prises, interrupteurs, points lumineux, boîtes de dérivation;'
);

// Fix 6.8 - join the broken line "formulaires de suivi"
content = content.replace(
  /Renseignement quotidien des\nformulaires de suivi \(statuts, Gps, observations\);/g,
  'Renseignement quotidien des formulaires de suivi (statuts, Gps, observations);'
);

// Now that lines are joined, let's add bullet points for lists
// Pattern: Text;\nText;\nText. → Text;\n• Text;\n• Text.

// Split by actual newlines to process
const lines = content.split('\n');
const processedLines = [];

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

console.log('Fixed multiline sections and added bullet points');
