---
name: ux-ui-responsive-design
description: Build modern, user-friendly, fast, and fully responsive websites that work seamlessly on both desktop and mobile devices, following industry-standard UX/UI design principles from authoritative sources. Use this skill whenever the user wants to create a website, landing page, dashboard, web app, portfolio, ecommerce site, or any interface that needs to be modern, easy to use, responsive, and accessible across all devices. Also trigger when the user mentions "UX", "UI", "responsive", "mobile-first", "modern design", "user-friendly", "works on desktop and mobile", or wants to improve the UI of an existing website.
---

# UX/UI Responsive Web Design Skill

Build modern, user-friendly, fast, and fully responsive websites — grounded in proven principles from Nielsen Norman Group, Google Material Design, WCAG, and Core Web Vitals.

---

## 1. Core UX Principles (from Nielsen Norman Group)

Every design decision must be anchored in **Jakob Nielsen's 10 Usability Heuristics**:

### 1.1 User-Centricity
- Every design decision must answer: "How does this help the user?"
- Conduct a content audit first — identify the most critical things users need
- Use progressive disclosure: reveal complex information only when users need it

### 1.2 Visibility of System Status
- Provide feedback for every user action (loading spinner, success toast, progress bar)
- Use skeleton screens instead of blank pages while loading
- Clearly display the current state (active menu item, breadcrumb, step indicator)

### 1.3 Consistency & Standards
- Use the same design tokens across the entire project (colors, spacing, typography, border-radius)
- Identical components must look and behave the same on every page
- Buttons, icons, and menus must work the way users expect

### 1.4 Error Prevention & Recovery
- Prevent errors before they happen (real-time validation, confirmation dialogs)
- Display clear error messages that explain how to fix the issue — avoid technical jargon
- Always allow users to undo/redo actions

### 1.5 Recognition Over Recall
- Pair icons with labels (never use standalone icons that require guessing)
- Show recent searches, suggestions, and autocomplete
- Navigation must be visible and discoverable — users should never have to memorize paths

### 1.6 Hierarchy & Information Architecture
- **Visual Hierarchy**: Use size, color, and font weight to differentiate levels of importance
- **Information Architecture**: Group content logically; navigation depth should not exceed 3 levels
- CTA (Call-to-Action) must be the most prominent element on the page

---

## 2. Mobile-First & Responsive Design

### 2.1 Mobile-First Approach (Progressive Enhancement)
- **Start designing from the smallest screen** and progressively enhance for larger screens
- Use relative units (%, rem, em, vw, vh) instead of fixed px values
- Use CSS Grid + Flexbox as the primary layout systems

### 2.2 Breakpoints Strategy (Content-First)
```css
/* Mobile-First Breakpoints */
/* Base: 320px+ (mobile) */
/* sm: 640px+ (large phone / small tablet) */
/* md: 768px+ (tablet) */
/* lg: 1024px+ (laptop) */
/* xl: 1280px+ (desktop) */
/* 2xl: 1536px+ (large desktop) */
```
- **Do not design for specific devices** — let the content determine where layout changes should occur
- Test responsiveness at every breakpoint before delivery

### 2.3 Touch-Friendly Design
- Minimum touch target size: **44x44px** (Apple HIG) or **48x48dp** (Material Design)
- Minimum spacing between tap targets: 8px to prevent accidental taps
- Place interactive elements within the **thumb zone** on mobile (lower portion of the screen)
- Design gesture support where appropriate: swipe, pull-to-refresh, pinch-to-zoom

### 2.4 Navigation Patterns
- **Mobile**: Hamburger menu, bottom navigation bar (max 5 items), or tab bar
- **Desktop**: Horizontal nav bar, sidebar, mega menu
- **All devices**: Breadcrumb, easily accessible search bar, sticky header (when appropriate)
- Hamburger menu must include a clear icon and a "Menu" label for accessibility

### 2.5 Responsive Images & Media
```html
<img 
  src="image.jpg" 
  srcset="image-sm.jpg 480w, image-md.jpg 768w, image-lg.jpg 1200w"
  sizes="(max-width: 480px) 100vw, (max-width: 768px) 50vw, 33vw"
  alt="Descriptive alt text"
  loading="lazy"
  width="800" height="600"
>
```
- Use WebP/AVIF formats for better compression
- Always set width/height to prevent layout shift (CLS)

---

## 3. Visual Design System

### 3.1 Typography System
Use a harmonious type scale (ratio 1.25 or 1.333):

```css
:root {
  /* Type Scale (ratio 1.25 - Major Third) */
  --text-xs: clamp(0.75rem, 0.7rem + 0.25vw, 0.8rem);
  --text-sm: clamp(0.875rem, 0.8rem + 0.3vw, 0.95rem);
  --text-base: clamp(1rem, 0.9rem + 0.4vw, 1.125rem);
  --text-lg: clamp(1.125rem, 1rem + 0.5vw, 1.3rem);
  --text-xl: clamp(1.25rem, 1.1rem + 0.7vw, 1.5rem);
  --text-2xl: clamp(1.5rem, 1.2rem + 1.2vw, 2rem);
  --text-3xl: clamp(1.875rem, 1.4rem + 1.8vw, 2.5rem);
  --text-4xl: clamp(2.25rem, 1.6rem + 2.5vw, 3.5rem);
  
  /* Line Height */
  --leading-tight: 1.2;    /* headings */
  --leading-normal: 1.5;   /* body text - minimum for readability */
  --leading-relaxed: 1.75;  /* long-form reading */
}
```

**Typography Rules:**
- Body text minimum **16px** on mobile (prevents iOS auto-zoom)
- Minimum line-height of **1.5** for body text (WCAG 1.4.12)
- Maximum line length: **60–75 characters** per line
- Font pairing: use a maximum of 2 fonts — Display font + Body font
- Use `clamp()` for fluid typography that scales with the viewport
- Load only the font weights actually used; set `font-display: swap`

### 3.2 Color System (WCAG Compliant)

```css
:root {
  /* Semantic Colors */
  --color-primary: ;       /* Main brand color */
  --color-primary-hover: ;
  --color-secondary: ;     /* Secondary color */
  --color-accent: ;        /* Highlight color */
  
  /* Neutral Scale */
  --color-bg: ;            /* Main background */
  --color-surface: ;       /* Card/panel background */
  --color-border: ;        /* Borders */
  --color-text-primary: ;  /* Primary text */
  --color-text-secondary: ;/* Secondary text */
  --color-text-muted: ;    /* Muted/subtle text */
  
  /* Feedback Colors */
  --color-success: ;
  --color-warning: ;
  --color-error: ;
  --color-info: ;
}
```

**Color Accessibility Rules (WCAG 2.2):**
- **Normal text**: contrast ratio ≥ **4.5:1** (AA)
- **Large text** (18px bold or 24px+): ≥ **3:1** (AA)
- **Non-text UI elements** (buttons, icons, borders): ≥ **3:1**
- **Never use color as the sole means of communication** — always supplement with icons, labels, or patterns
- Support **Dark Mode** — use CSS custom properties for theme switching
- Test with color blindness simulation before shipping

### 3.3 Spacing System (8px Grid)
```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
}
```
- Use spacing values from the scale only — never use arbitrary values
- Mobile can use smaller spacing than desktop (reduce by 1–2 steps)
- Section padding: mobile `--space-12` to `--space-16`, desktop `--space-20` to `--space-24`

### 3.4 Shadow & Elevation
```css
:root {
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04);
}
```
- Use shadows to create depth hierarchy (more important/elevated elements get stronger shadows)
- In dark mode, use borders or lighter surfaces instead of shadows

---

## 4. Performance & Core Web Vitals

Websites that take longer than 3 seconds to load lose 53% of mobile users. Meet these targets:

### 4.1 Core Web Vitals Targets (Google)
| Metric | Target | What It Measures |
|--------|--------|-----------------|
| **LCP** (Largest Contentful Paint) | ≤ 2.5 seconds | Main content loading speed |
| **INP** (Interaction to Next Paint) | ≤ 200ms | Interaction responsiveness |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | Layout visual stability |

### 4.2 Performance Optimization Techniques
- **Images**: lazy loading, srcset, WebP/AVIF, always set width/height
- **CSS**: inline critical CSS, defer non-critical CSS, minify
- **JavaScript**: code splitting, tree shaking, defer non-essential scripts
- **Fonts**: `font-display: swap`, preload critical fonts, subset to used languages
- **Caching**: use CDN, cache headers, service worker for offline support
- **Above-the-fold**: prioritize loading content at the top of the viewport first

### 4.3 Animation Performance
- Only animate `transform` and `opacity` (GPU-accelerated properties)
- Avoid animating properties that trigger layout/paint (width, height, margin, top, left)
- Use `will-change` sparingly
- Respect `prefers-reduced-motion` for users with motion sensitivity

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 5. Microinteractions & Motion Design

### 5.1 Animation Principles
- **Purposeful**: every animation must serve a purpose (feedback, transition, guiding attention)
- **Quick**: 150–300ms for UI feedback, 300–500ms for transitions
- **Natural**: use easing curves (ease-out for enter, ease-in for exit)
- **Subtle**: a good animation is one users "feel" rather than "see"

### 5.2 Essential Microinteractions
- Button hover/active states, focus rings
- Loading states (skeleton, spinner, progress)
- Real-time form validation feedback
- Page transitions (fade, slide)
- Scroll-triggered reveals (using IntersectionObserver)
- Toast notifications (auto-dismiss)

---

## 6. Accessibility (WCAG 2.2 Level AA)

### 6.1 Per-Page Checklist
- [ ] Semantic HTML (header, nav, main, section, article, footer)
- [ ] Skip navigation link for keyboard users
- [ ] All images have meaningful alt text
- [ ] Visible focus indicators (never remove outline)
- [ ] Full keyboard navigation support for all functionality
- [ ] ARIA labels for interactive elements without visible text
- [ ] All color contrasts meet WCAG AA standards
- [ ] Form labels are properly associated with input fields
- [ ] Error messages are clear and readable by screen readers
- [ ] Text resizable up to 200% without layout breakage (WCAG 1.4.4)
- [ ] Content reflows at 320px width without horizontal scrolling (WCAG 1.4.10)

### 6.2 Focus Management
```css
/* Clear, visible custom focus style */
:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
  border-radius: 2px;
}
/* Hide focus ring when using mouse */
:focus:not(:focus-visible) {
  outline: none;
}
```

---

## 7. Modern UI Patterns (2025–2026)

### 7.1 Bento Grid Layout
```css
.bento-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr));
  gap: var(--space-4);
}
/* Larger featured card */
.bento-grid .featured {
  grid-column: span 2;
  grid-row: span 2;
}
@media (max-width: 640px) {
  .bento-grid .featured {
    grid-column: span 1;
    grid-row: span 1;
  }
}
```

### 7.2 Glassmorphism (Use Sparingly)
```css
.glass-card {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
}
/* Fallback for unsupported browsers */
@supports not (backdrop-filter: blur(12px)) {
  .glass-card {
    background: rgba(255, 255, 255, 0.85);
  }
}
```

### 7.3 Soft UI / Subtle Neumorphism
- Apply only to key touchpoints (important buttons, cards) — not the entire page
- Must maintain WCAG-compliant contrast ratios

### 7.4 Dark Mode Implementation
```css
:root { /* Light Mode defaults */ }
[data-theme="dark"] {
  --color-bg: #0f172a;
  --color-surface: #1e293b;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-border: #334155;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    /* Auto dark mode styles */
  }
}
```

---

## 8. Component Design Patterns

### 8.1 Responsive Card
```css
.card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.card-image {
  aspect-ratio: 16/9;
  object-fit: cover;
  width: 100%;
}
.card-content {
  padding: var(--space-4);
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
```

### 8.2 Responsive Button System
```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5em;
  font-weight: 600;
  border-radius: 8px;
  transition: all 0.15s ease;
  cursor: pointer;
  min-height: 44px; /* Touch target */
  padding: 0.625rem 1.25rem;
}
.btn-primary { background: var(--color-primary); color: white; }
.btn-secondary { background: var(--color-surface); border: 1px solid var(--color-border); }
.btn-ghost { background: transparent; }
/* Sizes */
.btn-sm { min-height: 36px; padding: 0.375rem 0.75rem; font-size: var(--text-sm); }
.btn-lg { min-height: 52px; padding: 0.75rem 1.75rem; font-size: var(--text-lg); }
```

### 8.3 Form Design
- Labels must always appear above inputs (never use placeholders as label substitutes)
- Minimum input height: 44px with finger-friendly internal padding
- Real-time validation + clear error messages
- Use the appropriate input type (email, tel, number, date) for correct mobile keyboards
- Support autofill/autocomplete

---

## 9. Implementation Checklist

When building a website using this skill, verify every item:

### Before Writing Code:
- [ ] Define target users and use cases
- [ ] Plan Information Architecture
- [ ] Design mobile layout first

### During Development:
- [ ] Use semantic HTML
- [ ] Set up design tokens in CSS variables
- [ ] Write mobile-first CSS (base = mobile, media queries = scale up)
- [ ] All interactive elements ≥ 44px
- [ ] All color contrasts pass WCAG AA
- [ ] Fluid typography using clamp()
- [ ] Images include lazy loading, srcset, alt text, width/height
- [ ] Animations use only transform/opacity + prefers-reduced-motion support

### Before Delivery:
- [ ] Test responsiveness at every breakpoint (320px – 1920px+)
- [ ] Test on major browsers (Chrome, Safari, Firefox)
- [ ] Full keyboard navigation works
- [ ] Lighthouse scores: Performance ≥ 90, Accessibility ≥ 90
- [ ] CLS, LCP, INP all meet targets

---

## 10. References

All principles in this skill are sourced from:

| Source | Topics |
|--------|--------|
| **Nielsen Norman Group** (nngroup.com) | 10 Usability Heuristics, UX Principles, Design Patterns |
| **Google Material Design 3** (m3.material.io) | Color System, Typography, Accessibility, Components |
| **WCAG 2.2** (w3.org/WAI/WCAG22) | Color Contrast, Text Resize, Keyboard Navigation, Reflow |
| **Google Core Web Vitals** (web.dev/vitals) | LCP, INP, CLS, Performance Optimization |
| **Figma Resource Library** (figma.com) | Mobile-First Design, Responsive Layout |
| **UX Design Institute** (uxdesigninstitute.com) | 7 Fundamental UX Principles (2026 Edition) |
| **Google Design** (design.google) | Global Accessibility, Touch Targets, Inclusive Design |
| **UX Collective** (uxdesign.cc) | 2026 UX Design Shifts, AI Transparency, Multimodal UX |
