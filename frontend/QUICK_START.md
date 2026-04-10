# 🚀 QUICK START - Design System GEM SAAS

## ⚡ Démarrage Rapide (5 minutes)

### 1️⃣ Ajouter ThemeProvider à App.tsx

```tsx
import { ThemeProvider } from './contexts/ThemeContext'

function App() {
  return (
    <ThemeProvider>
      <Router>
        {/* Your app here */}
      </Router>
    </ThemeProvider>
  )
}

export default App
```

### 2️⃣ Importer le CSS en premier dans main.tsx

```tsx
import './styles/theme.css'
import './index.new.css'
import App from './App'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)
```

### 3️⃣ Ajouter le ThemeToggle au Layout

```tsx
import { ThemeToggle } from './components/ThemeToggle'

export const Header = () => {
  return (
    <header className="flex justify-between items-center p-4">
      <h1>GEM SAAS</h1>
      <ThemeToggle />
    </header>
  )
}
```

### 4️⃣ Utiliser les Composants

```tsx
import { Button, Card, Badge, Input, Alert } from './components/UI'
import { Check } from 'lucide-react'

// ✅ Button
<Button variant="primary">Click me</Button>

// ✅ Card
<Card className="p-4">Content</Card>

// ✅ Badge
<Badge variant="success">Active</Badge>

// ✅ Input
<Input label="Name" placeholder="Enter name" />

// ✅ Alert
<Alert variant="success" icon={<Check />}>Success!</Alert>
```

---

## 📁 Structure des Fichiers

```
frontend/src/
├── styles/theme.css              ← Variables CSS globales ✨
├── contexts/
│   └── ThemeContext.tsx          ← Gestion du thème 🌙
├── components/
│   ├── ThemeToggle.tsx           ← Bouton switch thème 🔆
│   ├── UI/index.tsx              ← Tous les composants 🧩
│   ├── DesignShowcase.tsx        ← Page démo 🎨
│   └── LandingPageExample.tsx    ← Page landing 🚀
├── index.new.css                 ← Global styles 💅
└── App.vue (envelopper avec ThemeProvider)
```

---

## 🎨 Composants Disponibles

### Button
```tsx
<Button variant="primary|secondary|outline|ghost|danger" size="sm|md|lg">
  Click
</Button>
```

### Card
```tsx
<Card className="p-4" elevated>
  Content
</Card>
```

### Badge
```tsx
<Badge variant="success|warning|error|info|primary">Label</Badge>
```

### Input
```tsx
<Input 
  label="Name" 
  placeholder="Text" 
  error="Error message"
  icon={<Icon />}
/>
```

### Alert
```tsx
<Alert variant="success|warning|error|info" icon={<Icon />}>
  Message
</Alert>
```

### StatCard
```tsx
<StatCard 
  label="Users" 
  value="2,543" 
  icon={<Users />}
  trend={{ value: 12, isPositive: true }}
/>
```

### Modal
```tsx
const [isOpen, setIsOpen] = useState(false)
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Title"
  actions={<Button>Confirm</Button>}
>
  Content
</Modal>
```

### Tabs
```tsx
<Tabs 
  tabs={[
    { label: 'Tab 1', content: <div>Content 1</div> },
    { label: 'Tab 2', content: <div>Content 2</div> },
  ]} 
/>
```

---

## 🌈 Palette de Couleurs

| Nom | Hex | Utilisation |
|-----|-----|-------------|
| Primary | #0066FF | Actions principales |
| Success | #10B981 | Confirmations |
| Warning | #F59E0B | Attention |
| Error | #EF4444 | Erreurs |
| Info | #3B82F6 | Informations |

---

## 🌙 Mode Sombre

```tsx
import { useTheme } from './contexts/ThemeContext'

export const MyComponent = () => {
  const { theme, toggleTheme, setTheme } = useTheme()

  return (
    <div>
      <p>Current: {theme}</p>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  )
}
```

---

## 📚 Ressources

| Document | Contenu |
|----------|---------|
| `DESIGN_SYSTEM.md` | Guide complet et détaillé |
| `DESIGN_SYSTEM_INTEGRATION.md` | Guide d'intégration |
| `/design` | Page de démonstration |
| `App.example.tsx` | Exemple d'intégration complet |
| `DesignShowcase.tsx` | Showcase de tous les composants |

---

## ✅ Checklist d'Intégration

- [ ] ThemeProvider ajouté à App.tsx
- [ ] CSS importé en premier dans main.tsx
- [ ] ThemeToggle ajouté au Layout
- [ ] Testé le mode sombre
- [ ] Remplacé quelques buttons
- [ ] Remplacé quelques cards
- [ ] Testé sur mobile
- [ ] Vérifié l'accessibilité

---

## 🎯 Prochaines Étapes

1. ✨ Utiliser les composants dans les nouvelles pages
2. 🔄 Refactoriser les pages existantes progressivement
3. ♿ Vérifier l'accessibilité WCAG AAA
4. 📱 Tester sur tous les appareils
5. 🚀 Mettre en production

---

## 🆘 Aide Rapide

**"Le thème ne change pas"**
→ Vérifiez que ThemeProvider enveloppe toute l'app

**"Les styles ne s'appliquent pas"**
→ Importez theme.css EN PREMIER

**"Le localStorage ne persiste pas"**
→ Vérifiez les paramètres de confidentialité du navigateur

**"L'accessibilité échoue"**
→ Utilisez des labels pour les inputs et testez le contraste

---

## 📞 Documentation

Pour plus de détails, consultez:
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) - Documentation complète
- [DESIGN_SYSTEM_INTEGRATION.md](./DESIGN_SYSTEM_INTEGRATION.md) - Guide d'intégration en profondeur

---

**Créé**: Mars 2026  
**Version**: 1.0.0  
**Support**: React 19+, TypeScript 5+, Tailwind CSS 4+

🎉 **Vous êtes prêt à utiliser le design system !**
