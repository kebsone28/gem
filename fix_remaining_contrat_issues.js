const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Fix roman numeral casing in titles (all possible mixed case variants)
content = content.replace(/Titre Ii/g, 'Titre II');
content = content.replace(/Titre Iii/g, 'Titre III');
content = content.replace(/Titre IIi/g, 'Titre III');
content = content.replace(/Titre Iv/g, 'Titre IV');
content = content.replace(/Titre Vi/g, 'Titre VI');
content = content.replace(/Titre Vii/g, 'Titre VII');
content = content.replace(/Titre VIi/g, 'Titre VII');
content = content.replace(/Titre Viii/g, 'Titre VIII');
content = content.replace(/Titre VIii/g, 'Titre VIII');
content = content.replace(/Titre VIIi/g, 'Titre VIII');
content = content.replace(/Titre Ix/g, 'Titre IX');
content = content.replace(/Titre X/g, 'Titre X');

// Fix ContrÔLes
content = content.replace(/ContrÔLes/g, 'Contrôles');

// Fix "• la" patterns that should not have bullet points
content = content.replace(/pour • la/g, 'pour la');
content = content.replace(/pour • le/g, 'pour le');
content = content.replace(/pendant • le/g, 'pendant le');
content = content.replace(/pendant • la/g, 'pendant la');
content = content.replace(/Assurer • la/g, 'Assurer la');
content = content.replace(/Organiser • la/g, 'Organiser la');
content = content.replace(/Organiser • le/g, 'Organiser le');
content = content.replace(/à • la/g, 'à la');
content = content.replace(/à • le/g, 'à le');
content = content.replace(/formation, • le transport/g, 'formation, le transport');
content = content.replace(/Intérieures\) • la/g, 'Intérieures) la');
content = content.replace(/Intérieures\) • le/g, 'Intérieures) le');

// Fix bullet points in the middle of sentences
content = content.replace(/réalise • le précâblage/g, 'réalise le précâblage');
content = content.replace(/d'assurer • la/g, 'd\'assurer la');
content = content.replace(/garde, • le transport/g, 'garde, le transport');
content = content.replace(/;\n• la préparation des kits/g, ';\nla préparation des kits');
content = content.replace(/et • la pose électrique intérieure/g, 'et la pose électrique intérieure');
content = content.replace(/Avant • le tirage du câble/g, 'Avant le tirage du câble');
content = content.replace(/assure • la pose/g, 'assure la pose');
content = content.replace(/à réaliser • les raccordements/g, 'à réaliser les raccordements');

// Fix broken sentences
content = content.replace(/Contrôle négatif: le taux d'anomalies non détectées ou non signalées par le Prestataire est$/gm, 'Contrôle négatif: le taux d\'anomalies non détectées ou non signalées par le Prestataire est');

// Remove duplicate "Parties" after "Obligations des parties"
content = content.replace(/Obligations des parties\nParties/g, 'Obligations des parties');

// Fix broken sentences with truncated text
content = content.replace(/supérieur à 10 % des éléments contrôlés\.$/gm, 'supérieur à 10 % des éléments contrôlés. Dans ce cas, les pénalités prévues à l\'Article 26 sont applicables.');

fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed remaining contrat formatting issues');
