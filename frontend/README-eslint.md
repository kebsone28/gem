# ESLint Custom Ruleset pour PROQUELEC

Ce dossier contient des règles ESLint personnalisées pour maintenir les hauts standards de qualité UI/UX de l'application GEM_SAAS.

## Installation

\`\`\`bash
cd frontend
npm install -D eslint-plugin-local-rules --legacy-peer-deps
\`\`\`

## Fichiers
- \`.eslintrc.cjs\` : Configuration racine ESLint intégrant les règles.
- \`eslint-local-rules.cjs\` : Script contenant l'implémentation de 4 règles personnalisées AST (Abstract Syntax Tree).

## Règles Disponibles

1. **\`local-rules/no-tiny-text\`** (🔴 Error) : Interdit l'usage de polices en dessous de 12px (text-[8px], text-[9px], etc.). Effectue un remplacement automatique vers \`text-xs\`. Supporte le \`--fix\`.
2. **\`local-rules/flex-child-min-w-0\`** (🟠 Warn) : Rappelle l'importance du \`min-w-0\` pour éviter le dépassement de conteneurs Flex.
3. **\`local-rules/icon-button-aria-label\`** (🟠 Warn) : Scanne tous les \`<button>\` pour vérifier la présence d'un \`aria-label\` ou d'une balise \`title\` pour les logiciels de lecture vocale.
4. **\`local-rules/no-typos-jsx\`** (🔴 Error) : Détecte et remplace de manière agressive l'horreur lexicale "MÉNERGE" en "MÉNAGE". Supporte le \`--fix\`.

## Lancement

Pour lancer l'audit ESLint :
\`\`\`bash
npx eslint src/ --ext .ts,.tsx --fix
\`\`\`
