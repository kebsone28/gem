# 🔍 ESLint Config — PROQUELEC GEM-SAAS

Configuration ESLint custom avec règles d'audit UI automatisées.

---

## 📦 Installation

```bash
npm install -D \
  eslint \
  @typescript-eslint/parser \
  @typescript-eslint/eslint-plugin \
  eslint-plugin-react \
  eslint-plugin-react-hooks \
  eslint-plugin-jsx-a11y \
  eslint-plugin-tailwindcss \
  eslint-plugin-local-rules
```

## 📁 Fichiers à placer à la racine du projet

```
frontend/
├── .eslintrc.cjs                    ← config principale
└── eslint-plugin-local-rules.cjs    ← règles custom
```

## ▶️ Utilisation

```bash
# Lancer l'audit sur tout le projet
npx eslint src/ --ext .ts,.tsx

# Lancer avec auto-fix (corrige les problèmes automatiquement)
npx eslint src/ --ext .ts,.tsx --fix

# Cibler uniquement les composants terrain
npx eslint src/components/terrain/ --ext .tsx

# Voir un rapport détaillé
npx eslint src/ --ext .ts,.tsx --format stylish
```

## 🎯 Ce que détectent les règles custom

| Règle | Sévérité | Description |
|---|---|---|
| `local-rules/no-tiny-text` | 🔴 error | Textes < 12px (text-[8px] à text-[11px]) |
| `local-rules/flex-child-min-w-0` | 🟠 warn | Enfants flex sans min-w-0 |
| `local-rules/icon-button-aria-label` | 🟠 warn | Boutons icône sans aria-label |
| `local-rules/no-typos-jsx` | 🔴 error | Fautes de frappe (MÉNERGE → MÉNAGE) |
| `no-alert` | 🔴 error | prompt(), alert(), confirm() natifs |
| `jsx-a11y/label-has-associated-control` | 🔴 error | Input sans label |

## 💡 Intégration VS Code

Installer l'extension **ESLint** (dbaeumer.vscode-eslint) puis ajouter dans `.vscode/settings.json` :

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": ["typescript", "typescriptreact"]
}
```

## 🔁 Intégration CI/CD (GitHub Actions)

```yaml
- name: ESLint Audit UI
  run: npx eslint src/ --ext .ts,.tsx --max-warnings 0
```
