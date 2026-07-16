const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'frontend/src/modules/carto_grappes/engine/docxEngine.ts');

let content = fs.readFileSync(filePath, 'utf8');

// Find specific sections and manually fix them based on the example
// The issue is that the text uses \n as escape sequences in template strings

// Fix Article 6.1 Livraison des matériels
content = content.replace(
  /Enlèvement des kits et matériels au magasin tampon de LSE;\\nTransport, manutention et stockage temporaire \(à la charge du\\nPrestataire\);\\nSécurisation des espaces de stockage dans les villages;\\nTraçabilité des livraisons \(numéro de kit, ménage bénéficiaire\)\./g,
  'Enlèvement des kits et matériels au magasin tampon de LSE;\\n• Transport, manutention et stockage temporaire (à la charge du Prestataire);\\n• Sécurisation des espaces de stockage dans les villages;\\n• Traçabilité des livraisons (numéro de kit, ménage bénéficiaire).'
);

// Fix Article 6.2 Réalisation des fouilles et tranchées
content = content.replace(
  /Fouilles pour la pose des câbles et la prise de terre;\\nTranchées\\nconformes aux normes \(profondeur, largeur\);\\nRebouchage et finition des tranchées\./g,
  'Fouilles pour la pose des câbles et la prise de terre;\\n• Tranchées conformes aux normes (profondeur, largeur);\\n• Rebouchage et finition des tranchées.'
);

// Fix Article 6.3 Construction des murs supports
content = content.replace(
  /Construction du mur support pour le coffret de comptage \(si non existant\);\\nUtilisation de parpaings, ciment, sable \(fournis par\\nle Prestataire pour le mur\);\\nRespect des dimensions et normes de stabilité\./g,
  'Construction du mur support pour le coffret de comptage (si non existant);\\n• Utilisation de parpaings, ciment, sable (fournis par le Prestataire pour le mur);\\n• Respect des dimensions et normes de stabilité.'
);

// Fix Article 6.4 Pose des potelets
content = content.replace(
  /Pose du potelet galvanisé 4 m \(avec arrêtoir, bride de serrage, queue de cochon\);\\nScellement conforme aux exigences techniques;\\nStabilité et\\naccessibilité du potelet\./g,
  'Pose du potelet galvanisé 4 m (avec arrêtoir, bride de serrage, queue de cochon);\\n• Scellement conforme aux exigences techniques;\\n• Stabilité et accessibilité du potelet.'
);

// Fix Article 6.5 Pose des coffrets de comptage
content = content.replace(
  /Pose du coffret de comptage à la limite de propriété;\\nFixation sécurisée sur le mur support;\\nAccessibilité pour les interventions ultérieures \(Lot C\)\./g,
  'Pose du coffret de comptage à la limite de propriété;\\n• Fixation sécurisée sur le mur support;\\n• Accessibilité pour les interventions ultérieures (Lot C).'
);

// Fix Article 6.6 Installation électrique intérieure (the multi-line list)
content = content.replace(
  /Traçage et repérage des cheminements;\\nPose des câbles d'alimentation et circuits intérieurs;\\nInstallation et raccordement:\\nCoffret principal \(précâblé par le Lot A\);\\nCoffret secondaire \(si applicable\);\\nPrises, interrupteurs, points\\nlumineux, boîtes de dérivation;\\nContrôles de conformité avant réception\./g,
  'Traçage et repérage des cheminements;\\n• Pose des câbles d\'alimentation et circuits intérieurs;\\n• Installation et raccordement:\\n• Coffret principal (précâblé par le Lot A);\\n• Coffret secondaire (si applicable);\\n• Prises, interrupteurs, points lumineux, boîtes de dérivation;\\n• Contrôles de conformité avant réception.'
);

// Fix Article 6.7 Nettoyage et remise en état
content = content.replace(
  /Nettoyage du chantier après intervention;\\nRemise en état des lieux \(rebouchage, finitions\)\./g,
  'Nettoyage du chantier après intervention;\\n• Remise en état des lieux (rebouchage, finitions).'
);

// Fix Article 6.8 Traçabilité
content = content.replace(
  /Renseignement quotidien des\\nformulaires de suivi \(statuts, Gps, observations\);\\nStatut d'avancement transmis à PROQUELEC\./g,
  'Renseignement quotidien des formulaires de suivi (statuts, Gps, observations);\\n• Statut d\'avancement transmis à PROQUELEC.'
);

fs.writeFileSync(filePath, content, 'utf8');

console.log('Fixed specific Article 6 sections with bullet points');
