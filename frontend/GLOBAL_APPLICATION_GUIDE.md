# 🎯 Guide d'Application Global — Contraste & Opacity

## 📋 Mission: Appliquer les corrections à TOUTES les pages

> Utiliser **la "Règle du /20"** partout

---

## 🏗️ PHASE 1: Fondations Globales

### ✅ 1. Variables CSS (DONE)
- [x] `theme.css` : Bien définies
- [x] Gradients: Spécifiés
- [x] Shadows: Présentes

### ✅ 2. Composants Principaux UI (DONE)
- [x] `Button` : Tous variants corrigés
- [x] `Card` : Contraste OK
- [x] `Alert` : Amélioré (green-100, etc.)
- [x] `Tabs` : Hiérarchie clarifiée
- [x] `Badge` : Déjà bon
- [x] `Skeleton` : Animations OK

---

## 🎨 Appliquer les Rules Globales

### RÈGLE 1: Hero / CTA Sections
```tsx
// ✅ BON
<section className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
  {/* ou */}
  <div className="bg-blue-600 text-white">

// ❌ MAUVAIS
<section className="bg-gradient-to-r from-blue-600/10 to-indigo-700/10">
```

### RÈGLE 2: Alerts / Notifications
```tsx
// ✅ BON (Light Mode)
className="bg-green-100 text-green-900 font-medium"

// ✅ BON (Dark Mode)
className="dark:bg-green-900/50 dark:text-green-100"

// ❌ MAUVAIS
className="bg-green-50 text-green-800"
className="dark:bg-green-900/20 dark:text-green-200"
```

### RÈGLE 3: Navigation / Tabs
```tsx
// ✅ BON
className="text-base font-semibold border-b-2 py-3 gap-4"

// ❌ MAUVAIS
className="text-sm font-medium border-b py-2 gap-2"
```

### RÈGLE 4: Section Containers
```tsx
// ✅ BON
<div className="bg-white dark:bg-gray-800 p-6 border border-gray-200 dark:border-gray-700">

// ❌ MAUVAIS (trop pâle)
<div className="bg-gray-50 dark:bg-gray-900/20">
```

### RÈGLE 5: Opacité Smart
```
Opacité:
  10% (/10)  = Quasi invisible → À ÉVITER sur contenu
  20% (/20)  = Très discret → Hover uniquement
  30-50%     = Bon pour backgrounds secondaires  
  70-100%    = Bon pour contenus importants

Matrice:
┌─────────────────────────────┐
│ Content      → 100%         │
│ Secondary    → 30-50%       │
│ Subtle/Hover → 10-20%       │
└─────────────────────────────┘
```

---

## 📄 Pages à Corriger (By Priority)

### TIER 1: Pages principales (CRITICAL)

#### 1. **Login.tsx** 
```
- Formulaire: bg-white / dark:bg-gray-800
- Inputs: border-gray-200 / dark:border-gray-700
- Boutons: appliquer Button components
- Hero/Header: contraste fort (si existe)

CHECKLIST:
[ ] Form fields lisibles
[ ] Buttons prônoncés (pas discrets)
[ ] Liens visibles
[ ] Status messages (alerts) clairs
```

#### 2. **Dashboard.tsx** (+ sub-dashboards)
```
- KPI Cards: fond blanc/gris-800
- Status badges: couleurs saturées
- Charts: tooltips lisibles
- Header: hiérarchie claire

CHECKLIST:
[ ] KPIs très lisibles
[ ] Status badges distinct
[ ] No faded text
[ ] Dark mode comfortable
```

#### 3. **Terrain.tsx**
```
- Map containers: lisibles
- Sidebars: bonne lisibilité
- Buttons/CTAs: type primary/secondary OK
- Alerts: visibilité excellente
```

#### 4. **Logistique.tsx**
```
- Tables: lisibilité texte OK
- Row highlights: subtils mais visibles
- Status indicators: couleurs claires
- Actions buttons: prominents
```

### TIER 2: Pages importantes

1. **Reports.tsx**
2. **Settings.tsx**
3. **Cahier.tsx**
4. **Bordereau.tsx**
5. **MissionOrder.tsx**

### TIER 3: Pages moins souvent utilisées

1. **Aide.tsx**
2. **Charges.tsx**
3. **DiagnosticSante.tsx**
4. **Simulation.tsx**
5. **AdminUsers.tsx**

---

## 🔍 CHECKLIST Audit de Base

Pour chaque page, scanner:

```
[ ] Zéro utilisation de /10 opacity importante
[ ] Zéro utilisation de /20 opacity sur contenu
[ ] Tous les textes lisibles (light + dark)
[ ] Titres: gras et visibles (font-semibold+)
[ ] Buttons: contraste fort avec background
[ ] Alerts: couleurs saturées (100, not 50)
[ ] Borders: visibles mais discrets
[ ] Dark mode: pas d'eye strain
[ ] WCAG AA minimum partout, AAA si héros
```

---

## 🛠️ Quick Fix Templates

### Template 1: Hero Section (Copy/Paste)
```tsx
<section className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-indigo-800 text-white p-8 rounded-xl">
  <h1 className="text-3xl font-bold mb-2">Title</h1>
  <p className="text-blue-50 mb-6">Description</p>
  <Button className="bg-white text-blue-600">CTA</Button>
</section>
```

### Template 2: Alert (Copy/Paste)
```tsx
<div className="bg-green-100 dark:bg-green-900/50 border-l-4 border-green-600 p-4 rounded">
  <div className="flex gap-3">
    <CheckCircle className="text-green-600 flex-shrink-0" />
    <div>
      <h3 className="font-semibold text-green-900 dark:text-green-100">Success</h3>
      <p className="text-green-800 dark:text-green-100 text-sm">Message</p>
    </div>
  </div>
</div>
```

### Template 3: Card Container (Copy/Paste)
```tsx
<div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-50 mb-4">Title</h3>
  <p className="text-gray-700 dark:text-gray-300">Content</p>
</div>
```

---

## 📊 Impact Attendu

### AVANT (Sans Application)
```
❌ Pages multicolores et incohérentes
❌ Certains textes illisibles
❌ Dark mode parfois difficile
❌ Design "amateur"
WCAG: AA border
```

### APRÈS (Avec Application)
```
✅ Cohérence visuelle totale
✅ Tous les textes lisibles
✅ Dark mode confortable
✅ Design "professionnel"
WCAG: AAA partout
```

---

## 🚀 Plan d'Exécution

### Étape 1 : Login + Dashboard (45 min)
```
$ Les 2 pages les plus vues
$ Impact maximum immédiat
$ Reste des pages en cascade
```

### Étape 2 : Pages secondaires (30 min)
```
$ Appliquer templates partout
$ Quick audit + fix
$ WCAG sweep
```

### Étape 3 : Validation (15 min)
```
$ Test light/dark mode global
$ Contrast checker partout
$ Deploy confidence!
```

---

## 📝 Fichiers à Modifier

### Global Files
- [ ] `theme.css` - Vérifier variables
- [ ] `index.css` ou CSS global - Appliquer opacity rules

### Component Files
- [ ] `Button.tsx` - DONE ✅
- [ ] `Alert.tsx` - DONE ✅  
- [ ] `Tabs.tsx` - DONE ✅
- [ ] `Card.tsx` - DONE ✅
- [ ] `Badge.tsx` - DONE ✅

### Page Files (Priority)
- [ ] `Login.tsx` - TODO
- [ ] `Dashboard.tsx` - TODO
- [ ] `Dashboard/AdminDashboard.tsx` - TODO
- [ ] `Dashboard/ClientDashboard.tsx` - TODO
- [ ] `Dashboard/TeamDashboard.tsx` - TODO
- [ ] `Terrain.tsx` - TODO
- [ ] `Logistique.tsx` - TODO
- [ ] `Reports.tsx` - TODO
- [ ] `Settings.tsx` - TODO
- [ ] ... (autres pages en cascade)

---

## ✨ Success Criteria

✅ Application is done when:
- [ ] All 19 pages are tested light/dark
- [ ] No /10 opacity on main content
- [ ] All alerts use bg-100 (light) + /50 (dark)
- [ ] Navigation has clear hierarchy
- [ ] Buttons are prominent (not subtle)
- [ ] Text contrast ≥ 7:1 everywhere
- [ ] Dark mode = comfortable viewing
- [ ] Overall = "Stripe-like professional"

---

**Status:** Ready for Phase 1 + 3 execution! 🚀
