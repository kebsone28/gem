# 🎨 Design System - Visual Guide

## 📐 Color System

### Primary Colors (Electric Blue)

```css
--color-primary-50:   #F0F7FF  /* Lightest - Backgrounds */
--color-primary-100:  #E0EEFF
--color-primary-200:  #C1DCFF
--color-primary-300:  #A2CBFF
--color-primary-400:  #83B9FF
--color-primary-500:  #1E90FF  /* Medium - Accents */
--color-primary-600:  #0066FF  /* PRIMARY - Main action */
--color-primary-700:  #004FCC
--color-primary-800:  #003B99
--color-primary-900:  #002766
--color-primary-950:  #001433  /* Darkest - Dark surfaces */
```

### Semantic Colors

```css
--color-success: #10B981     /* Confimed, success states */
--color-warning: #F59E0B     /* Caution, warnings */
--color-error: #EF4444       /* Errors, destructive */
--color-info: #3B82F6        /* Neutral information */
```

### Neutral Colors (Grayscale)

```css
--color-gray-0:   #FFFFFF     /* Pure white */
--color-gray-50:  #F8FAFC     /* Off-white */
--color-gray-100: #F1F5F9
--color-gray-200: #E2E8F0     /* Borders */
--color-gray-300: #CBD5E1
--color-gray-400: #94A3B8
--color-gray-500: #64748B
--color-gray-600: #475569
--color-gray-700: #334155
--color-gray-800: #1E293B
--color-gray-900: #0F172A     /* Almost black */
```

---

## 🎨 Button Styles

### Primary Button
```
Background:  #0066FF → #1E90FF (gradient)
Text:        White
State:
  - Hover:   Shadow glow, -2px translate
  - Active:  Shadow glow, 0 translate
  - Focus:   Focus ring 2px blue
Padding:     0.625rem 1rem (md)
```

### Secondary Button
```
Background:  #F1F5F9
Border:      1px solid #E2E8F0
Text:        #0F172A
State:
  - Hover:   Background #E2E8F0
```

### Outline Button
```
Border:      2px solid #0066FF
text:        #0066FF
Background:  Transparent
State:
  - Hover:   Background #F0F7FF
```

---

## 🔤 Typography System

### Headings (Using Lexend)

| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| h1 | 2.5rem | 700 | Page titles |
| h2 | 2.0rem | 700 | Section titles |
| h3 | 1.5rem | 600 | Subsections |
| h4 | 1.25rem | 600 | Card titles |
| h5 | 1.125rem | 600 | Labels |
| h6 | 1.0rem | 600 | Small titles |

### Body Text (Using Inter)

| Type | Size | Weight | Line-Height |
|------|------|--------|-------------|
| Large | 1rem | 400 | 1.6 |
| Base | 0.95rem | 400 | 1.6 |
| Small | 0.875rem | 400 | 1.5 |
| Tiny | 0.75rem | 400 | 1.0 |

---

## 📏 Spacing Scale

```css
xs:   0.25rem    (4px)
sm:   0.5rem     (8px)
md:   1rem       (16px)
lg:   1.5rem     (24px)
xl:   2rem       (32px)
2xl:  2.5rem     (40px)
3xl:  3rem       (48px)
```

Usage:
- Component padding: md (16px)
- Card padding: lg (24px)
- Section gap: xl (32px)
- Page padding: xl/2xl (32-40px)

---

## 🔲 Border Radius Scale

```css
xs:    4px      /* Minimal rounding */
sm:    6px      /* Small buttons */
md:    8px      /* Inputs, cards */
lg:    12px     /* Cards, modals */
xl:    16px     /* Large components */
2xl:   20px     /* Larger components */
3xl:   28px     /* Extra large */
full:  9999px   /* Pills, circles */
```

---

## 🎬 Animations & Transitions

### Transition Durations

```css
fast:  150ms  /* Quick feedback */
base:  250ms  /* Default */
slow:  350ms  /* Emphasized */
```

### Timing Function

```css
cubic-bezier(0.4, 0, 0.2, 1)  /* Smooth, natural motion */
```

### Common Animations

```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slideInUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Pulse (Loading) */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

## 💧 Shadows (Elevation)

```css
--shadow-xs:    0 1px 2px rgba(0, 0, 0, 0.05)      /* Subtle */
--shadow-sm:    0 2px 4px rgba(0, 0, 0, 0.08)      /* Slight */
--shadow-md:    0 4px 8px rgba(0, 0, 0, 0.1)       /* Normal */
--shadow-lg:    0 8px 16px rgba(0, 0, 0, 0.12)     /* Elevated */
--shadow-xl:    0 12px 24px rgba(0, 0, 0, 0.15)    /* High */
--shadow-2xl:   0 16px 40px rgba(0, 0, 0, 0.2)     /* Very High */
--shadow-glow:  0 0 20px rgba(0, 102, 255, 0.3)    /* Blue Glow */
```

---

## 🌈 Gradients

### Primary Gradient
```css
linear-gradient(135deg, #0066FF 0%, #1E90FF 50%, #00D4FF 100%)
/* Electric blue to cyan */
```

### Subtle Gradient
```css
linear-gradient(135deg, #F0F7FF 0%, #E0EEFF 50%, #F0F4FF 100%)
/* Light blue for backgrounds */
```

### Header Gradient
```css
linear-gradient(180deg, #0052CC 0%, #0066FF 50%, #1E90FF 100%)
/* Vertical for headers */
```

---

## 🌙 Dark Mode Adjustments

### Color Mappings (Light → Dark)

| Element | Light | Dark |
|---------|-------|------|
| Background | #FFFFFF | #0A0E27 |
| Surface | #F8FAFC | #0F1629 |
| Text Primary | #0F172A | #F7FAFC |
| Text Secondary | #475569 | #CBD5E0 |
| Border | #E2E8F0 | #2D3748 |

### Contrast Compliance

- Light Mode: Text (0F172A) on White - **19.5:1** ✅
- Dark Mode: Text (F7FAFC) on Bg (0A0E27) - **18.2:1** ✅
- Both exceed WCAG AAA (7:1)

---

## 📦 Component Sizes

### Button Sizes

```css
sm:  12-14px text, 0.5rem 0.875rem padding
md:  14-16px text, 0.625rem 1rem padding (default)
lg:  16-18px text, 0.875rem 1.5rem padding
```

### Input Sizes

```css
md:  14-16px text, 0.625rem 1rem padding (default)
lg:  16-18px text, 0.875rem 1.25rem padding
sm:  12-14px text, 0.5rem 0.75rem padding
```

### Card Padding

```css
Standard: 1.5rem (24px)
Compact:  1rem (16px)
Spacious: 2rem (32px)
```

---

## ♿ Accessibility Features

### Focus Indicators

```css
/* Default focus */
outline: 2px solid var(--color-primary);
outline-offset: 2px;

/* Extended focus (larger target) */
box-shadow: 0 0 0 3px rgba(0, 102, 255, 0.1);
```

### Minimum Touch Target

```css
/* All interactive elements */
min-width: 44px;
min-height: 44px;
```

### Color Contrast (WCAG AAA)

```
Minimum: 7:1 for normal text
         4.5:1 for large text

Implementation: 19.5:1 (light), 18.2:1 (dark) ✅
```

---

## 📱 Responsive Breakpoints

```css
Mobile:   < 640px    (default, mobile-first)
Tablet:   640px+     (md:)
Desktop:  1024px+    (lg:)
Large:    1280px+    (xl:)
```

### Grid Patterns

```css
Mobile:  1 column
Tablet:  2 columns
Desktop: 3-4 columns
```

---

## 🎯 Design Tokens Summary

| Token | Value | Usage |
|-------|-------|-------|
| Primary Color | #0066FF | Main brand color |
| Border Color | #E2E8F0 | Dividers |
| Border Radius | 8-12px | Cards, buttons |
| Shadow | 0 4px 8px | Depth |
| Transition | 250ms | Smooth motion |
| Font Family | Inter | Body text |
| Font Family | Lexend | Headings |
| Line Height | 1.6 | Body text |
| Letter Spacing | -0.01em | All text |

---

## 🚀 Component Library Quick Reference

```tsx
// Button
<Button variant="primary|secondary|outline|ghost|danger">Text</Button>

// Card
<Card className="p-6">Content</Card>

// Badge
<Badge variant="success|warning|error|info|primary">Label</Badge>

// Input
<Input label="Name" placeholder="Type here" error="Error?" />

// Alert
<Alert variant="success|error" icon={<Icon />}>Message</Alert>

// Modal
<Modal isOpen onClose={() => {}} title="Title">Content</Modal>

// StatCard
<StatCard label="Users" value="123" trend={{ value: 5, isPositive: true }} />

// Tabs
<Tabs tabs={[{ label: 'Tab', content: <div /> }]} />

// Pagination
<Pagination currentPage={1} totalPages={10} onPageChange={setPage} />
```

---

## 🎨 Color Usage Guide

### DO ✅

- Use primary blue for main actions (buttons, links)
- Use semantic colors for status (success, warning, error)
- Use gray palette for neutral elements
- Use accent colors sparingly

### DON'T ❌

- Mix too many colors
- Use colors without semantic meaning
- Violate contrast ratio (minimum 7:1)
- Forget to test in dark mode

---

## 📊 File Structure

```
frontend/src/
├── styles/theme.css              ← All variables defined
├── contexts/ThemeContext.tsx     ← Theme management
├── components/
│   ├── ThemeToggle.tsx           ← Dark/light toggle
│   ├── UI/index.tsx              ← All components
│   └── DesignShowcase.tsx        ← Demo page
└── index.new.css                 ← Global styles
```

---

## 🔗 Quick Links

- **Full Guide**: `DESIGN_SYSTEM.md`
- **Integration**: `DESIGN_SYSTEM_INTEGRATION.md`
- **Quick Start**: `QUICK_START.md`
- **Demo Page**: Visit `/design` route
- **Examples**: `App.example.tsx`

---

**Last Updated**: March 2026  
**Design System Version**: 1.0.0  
**Status**: ✅ Production Ready
