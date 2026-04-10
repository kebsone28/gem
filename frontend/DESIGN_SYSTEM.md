# 🎨 Design System GEM SAAS - Guide Complet

## Vue d'ensemble

Ce design system fournit un ensemble cohérent de composants, de styles et de directives pour construire une interface utilisateur élégante et accessible avec un thème électrique bleu premium.

---

## 📦 Installation et Configuration

### 1. Importer le Thème CSS

Assurez-vous que `theme.css` est importé en premier dans votre `main.tsx`:

```tsx
import './styles/theme.css'
import App from './App.tsx'
```

### 2. Envelopper l'Application avec ThemeProvider

```tsx
import React from 'react'
import { ThemeProvider } from './contexts/ThemeContext'
import App from './App'

ReactDOM.render(
  <ThemeProvider>
    <App />
  </ThemeProvider>,
  document.getElementById('root')
)
```

### 3. Ajouter le Bouton de Thème (Optionnel)

```tsx
import { ThemeToggle } from './components/ThemeToggle'

export const Header = () => {
  return (
    <header>
      <h1>Mon App</h1>
      <ThemeToggle />
    </header>
  )
}
```

---

## 🎯 Utilisation des Composants

### Button

```tsx
import { Button } from './components/UI'

export const Example = () => {
  return (
    <div>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      
      <Button isLoading>Loading...</Button>
      <Button icon={<IconComponent />}>With Icon</Button>
    </div>
  )
}
```

### Card

```tsx
import { Card } from './components/UI'

export const Example = () => {
  return (
    <Card className="p-6">
      <h3>Card Title</h3>
      <p>Card content goes here</p>
    </Card>
  )
}
```

### Badge

```tsx
import { Badge } from './components/UI'

export const Example = () => {
  return (
    <div>
      <Badge variant="success">Active</Badge>
      <Badge variant="warning">Warning</Badge>
      <Badge variant="error">Error</Badge>
      <Badge variant="info">Info</Badge>
      <Badge variant="primary">Primary</Badge>
    </div>
  )
}
```

### Input

```tsx
import { Input } from './components/UI'
import { Settings } from 'lucide-react'

export const Example = () => {
  return (
    <div>
      <Input label="Name" placeholder="Enter your name" />
      <Input
        label="Email"
        type="email"
        placeholder="you@example.com"
      />
      <Input
        label="With Error"
        error="This field is required"
        placeholder="Invalid"
      />
      <Input
        label="With Icon"
        icon={<Settings size={18} />}
        placeholder="Settings"
      />
    </div>
  )
}
```

### Alert

```tsx
import { Alert } from './components/UI'
import { Info, Check, AlertTriangle, X } from 'lucide-react'

export const Example = () => {
  return (
    <div>
      <Alert variant="success" icon={<Check />}>
        Success message
      </Alert>
      <Alert variant="info" icon={<Info />}>
        Info message
      </Alert>
      <Alert variant="warning" icon={<AlertTriangle />}>
        Warning message
      </Alert>
      <Alert variant="error" icon={<X />}>
        Error message
      </Alert>
    </div>
  )
}
```

### StatCard

```tsx
import { StatCard } from './components/UI'
import { Users } from 'lucide-react'

export const Example = () => {
  return (
    <StatCard
      label="Active Users"
      value="2,543"
      icon={<Users size={32} />}
      trend={{ value: 12, isPositive: true }}
    />
  )
}
```

### Tabs

```tsx
import { Tabs } from './components/UI'

export const Example = () => {
  const tabs = [
    { label: 'Tab 1', content: <div>Content 1</div> },
    { label: 'Tab 2', content: <div>Content 2</div> },
  ]

  return <Tabs tabs={tabs} defaultTab={0} />
}
```

### Modal

```tsx
import { Modal, Button } from './components/UI'
import { useState } from 'react'

export const Example = () => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>Open Modal</Button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Modal Title"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary">Confirm</Button>
          </>
        }
      >
        <p>Modal content here</p>
      </Modal>
    </>
  )
}
```

### Pagination

```tsx
import { Pagination } from './components/UI'
import { useState } from 'react'

export const Example = () => {
  const [page, setPage] = useState(1)

  return (
    <Pagination
      currentPage={page}
      totalPages={10}
      onPageChange={setPage}
    />
  )
}
```

---

## 🌈 Utilisation du Thème

### Variables CSS

Toutes les couleurs et les espacements sont définis comme des variables CSS:

```css
/* Accéder aux variables de thème */
color: var(--color-primary);
background-color: var(--color-bg-primary);
border-color: var(--color-border-primary);
padding: var(--spacing-lg);
border-radius: var(--radius-lg);
box-shadow: var(--shadow-md);
```

### Hook useTheme

```tsx
import { useTheme } from './contexts/ThemeContext'

export const MyComponent = () => {
  const { theme, toggleTheme, setTheme } = useTheme()

  return (
    <div>
      <p>Current theme: {theme}</p>
      <button onClick={toggleTheme}>Toggle Theme</button>
      <button onClick={() => setTheme('dark')}>Dark Mode</button>
      <button onClick={() => setTheme('light')}>Light Mode</button>
    </div>
  )
}
```

---

## 🎨 Palette de Couleurs

### Primaires

- **Bleu Principal**: #0066FF
- **Bleu Clair**: #1E90FF
- **Bleu Foncé**: #0052CC
- **Cyan Accent**: #00D4FF

### Sémantiques

- **Succès**: #10B981
- **Attention**: #F59E0B
- **Erreur**: #EF4444
- **Info**: #3B82F6

### Neutres

Les neutres vont de `--color-gray-0` (#FFFFFF) à `--color-gray-900` (#0F172A)

---

## ✨ Caractéristiques de Conception

### 1. Mode Sombre Intelligent

- Transitions fluides entre les modes
- Persiste dans le localStorage
- Respecte les préférences système
- Contraste optimal pour l'accessibilité

### 2. Typographie Optimisée

- **Lexend** pour les titres (meilleure lisibilité)
- **Inter** pour le contenu (performance)
- Hiérarchie claire et cohérente
- Spacing et ligne-height optimisés

### 3. Accessibilité

- Support WCAG 2.1 AAA
- Focus states visibles
- Icônes avec texte alternatif
- Contraste de couleur adéquat
- Support des lecteurs d'écran

### 4. Animations

- Transitions fluides (150ms - 350ms)
- Cubic-bezier optimisée
- Animations GPU-accelerated
- Respecte `prefers-reduced-motion`

### 5. Responsive

- Design Mobile-First
- Breakpoints Tailwind standard
- Grilles flexibles
- Images optimisées

---

## 📐 Espacement et Radius

### Espacement

```
xs: 0.25rem (4px)
sm: 0.5rem (8px)
md: 1rem (16px)
lg: 1.5rem (24px)
xl: 2rem (32px)
2xl: 2.5rem (40px)
3xl: 3rem (48px)
```

### Border Radius

```
xs: 4px
sm: 6px
md: 8px
lg: 12px
xl: 16px
2xl: 20px
3xl: 28px
full: 9999px
```

---

## 🎬 Transitions

```
fast: 150ms
base: 250ms
slow: 350ms
```

Utilisez avec `cubic-bezier(0.4, 0, 0.2, 1)` pour une animation en courbe naturelle.

---

## 🔧 Personnalisation

### Ajouter une Nouvelle Couleur

Modifiez `theme.css`:

```css
:root {
  --color-custom: #YOUR_HEX_COLOR;
  --color-custom-light: #LIGHTER_VERSION;
  --color-custom-dark: #DARKER_VERSION;
}
```

### Ajouter un Nouveau Composant

```tsx
interface MyComponentProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'secondary'
}

export const MyComponent: React.FC<MyComponentProps> = ({
  variant = 'primary',
  className = '',
  ...props
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 text-white',
    secondary: 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100',
  }

  return (
    <div className={`${variantClasses[variant]} ${className}`} {...props} />
  )
}
```

---

## 🚀 Bonnes Pratiques

1. **Utilisez les variables CSS** pour la cohérence
2. **Testez en mode sombre** pour tous les composants
3. **Maintenez 1.5:1 min de contrast** pour le texte
4. **Utilisez Tailwind** pour les utilities rapides
5. **Importez les icônes** de `lucide-react`
6. **Testez l'accessibilité** avec des tests automatisés
7. **Documentez les variantes** de vos composants
8. **Optimisez les performances** avec code-splitting

---

## 📱 Responsive Design

```tsx
<div className="
  grid
  grid-cols-1          /* Mobile */
  md:grid-cols-2       /* Tablet */
  lg:grid-cols-4       /* Desktop */
  gap-4
">
  {/* Content */}
</div>
```

---

## 🔗 Ressources

- [Lucide Icons](https://lucide.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Framer Motion](https://www.framer.com/motion/)

---

**Dernière mise à jour**: Mars 2026
**Version**: 1.0.0
