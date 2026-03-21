---
name: mobile-app-design
description: Design modern, beautiful, and user-friendly mobile app interfaces for iOS and Android. Use this skill whenever the user asks to create mobile app screens, mobile UI mockups, app prototypes, mobile components, or any mobile-first interface design. Also trigger when the user mentions "app design", "mobile UI", "mobile UX", "iOS design", "Android design", "app mockup", "mobile screen", "mobile prototype", "React Native UI", "Flutter UI", "SwiftUI design", or wants to build any interface specifically for phones or tablets. This skill covers navigation patterns, touch interactions, typography, color systems, dark mode, accessibility, and platform-specific guidelines (Material Design 3 / Apple HIG). Use this skill even if the user doesn't explicitly say "mobile" but describes features typical of mobile apps (e.g., tab bars, swipe gestures, bottom sheets, pull-to-refresh).
---

# Mobile App Design Skill

This skill guides creation of modern, intuitive, and visually stunning mobile app interfaces that follow platform best practices and current design trends. It produces production-ready mobile UI code (React/HTML/CSS) that faithfully represents how the app would look and feel on a real device.

## Before You Start

Read the relevant reference files based on the task:
- For **iOS-focused** designs: Read `references/ios-guidelines.md`
- For **Android-focused** designs: Read `references/android-guidelines.md`
- For **cross-platform** or general mobile: Read both reference files
- Always consult `references/mobile-ux-principles.md` for universal UX principles

## Design Thinking for Mobile

Before writing any code, work through these questions:

### 1. Platform Context
- **Which platform?** iOS, Android, or cross-platform?
- **Device targets?** Phone only? Phone + tablet? Foldables?
- **If iOS**: Follow Apple HIG — Clarity, Deference, Depth, Consistency. Use Liquid Glass aesthetics (iOS 26+), SF Pro typography, system semantic colors
- **If Android**: Follow Material Design 3 — Dynamic Color, adaptive components, Roboto/Google Sans typography, elevation system
- **If cross-platform**: Design a shared visual language that respects each platform's conventions. Shared foundation, platform-specific interaction details

### 2. User & Usage Context
- **Who uses it?** Age range, tech savviness, accessibility needs
- **Where/when?** On-the-go, one-handed, in bright sunlight, at night in bed
- **Primary hand?** Design for thumb-zone reachability (bottom 45% of screen = easy zone)
- **Session length?** Quick glance vs. deep engagement affects information density

### 3. Aesthetic Direction
Choose a clear visual identity — don't default to generic:
- **Clean & Minimal** — generous whitespace, restrained palette, subtle shadows
- **Bold & Expressive** — Material 3 Expressive style, vibrant dynamic colors, playful shapes
- **Premium & Refined** — luxury feel, elegant typography, glass effects, micro-animations
- **Warm & Friendly** — rounded corners, soft colors, approachable illustrations
- **Dark & Immersive** — content-forward, cinematic feel, deep surfaces
- **Editorial & Magazine** — strong typographic hierarchy, asymmetric layouts

**CRITICAL**: Every design must feel intentional. No generic gray-and-blue apps. Make bold choices that match the app's personality.

## Mobile-Specific Design Rules

### Touch Targets & Interaction
- **Minimum touch target**: 44×44pt (iOS) / 48×48dp (Android) — this is NON-NEGOTIABLE
- **Spacing between targets**: minimum 8px/8dp to prevent mis-taps
- **Thumb zone awareness**: Place primary actions in bottom 45% of screen
  ```
  ┌─────────────┐
  │  🔴 Hard    │  Top 25% — avoid primary actions here
  │─────────────│
  │  🟡 OK      │  Middle 30% — content & secondary actions
  │─────────────│
  │  🟢 Easy    │  Bottom 45% — navigation, primary CTAs, FAB
  └─────────────┘
  ```
- **Gesture support**: Swipe, pull-to-refresh, long-press, pinch — but always provide visible button alternatives
- **Feedback**: Every tap needs visual/haptic response within 100ms
- **Edge-to-edge**: Modern apps use full-screen layouts respecting safe areas (notch, home indicator, status bar)

### Navigation Patterns
Choose based on app complexity:
- **Bottom Tab Bar** (3-5 items): Best for apps with equal-priority top-level sections. Most common and user-friendly. Height: 56dp (Android) / 49pt (iOS)
- **Bottom Sheet**: Flexible sub-flows, modal content. Can be half-screen or full-screen. Supports vertical scroll + horizontal carousel
- **Navigation Drawer / Hamburger**: Secondary or infrequent items only. Don't hide primary features here
- **Stack Navigation**: Push/pop screens with back gesture (swipe from left edge)
- **Tab + Stack hybrid**: Most common real-world pattern (tabs for top-level, stack for drill-down)

**Rules**:
- Keep main functions reachable within 2 taps from home
- Don't move navigation between pages — consistency builds muscle memory
- If navigation isn't visible, users won't find it
- Gestures are accelerators, not the only path

### Typography for Mobile
- **Body text minimum**: 16px (iOS: 17pt San Francisco, Android: 16sp Roboto)
- **Heading scale**: 1.3x–1.6x of body text size
- **Line height**: 1.4–1.6 for body text for comfortable reading
- **Max line length**: 60-75 characters per line on phone
- **Dynamic Type support**: Design with scalable text in mind
- **Hierarchy**: Use size, weight, AND color to establish clear scanning order
- **Font pairing**: Platform system font for body (SF Pro / Roboto), distinctive display font for headings if brand permits

### Color System
- **Design tokens**: Use semantic color names (background, surface, onSurface, primary, secondary, error) not hardcoded hex values
- **Light + Dark mode**: Design both in parallel, not as afterthought
- **Dark mode rules**:
  - Use dark gray (#121212) not pure black (#000000) — reduces eye strain, allows elevation
  - Use off-white (#E0E0E0–#EDEDED) not pure white (#FFFFFF) — prevents halation effect
  - Accent colors appear more vibrant on dark backgrounds — desaturate slightly
  - Use lighter surface colors for elevated elements (cards, sheets, dialogs)
- **Dynamic Color** (Material 3): Consider user wallpaper-derived palettes for Android
- **WCAG contrast requirements**:
  - Regular text: ≥ 4.5:1 contrast ratio
  - Large text (18pt+ or 14pt+ bold): ≥ 3:1
  - Non-text UI elements (icons, borders, controls): ≥ 3:1
  - These apply to BOTH light and dark themes independently
- **Color is never the only indicator**: Always pair color with icons, text labels, or patterns (WCAG 1.4.1)

### Spacing & Layout
- **Base unit**: 8dp/8pt grid system for all spacing and sizing
- **Screen margins**: 16dp minimum horizontal padding
- **Card spacing**: 8–16dp between cards
- **Section spacing**: 24–32dp between content sections
- **Content width**: Design for 360dp–428dp width range (covers most phones)
- **Safe areas**: Account for notch (top), home indicator (bottom), rounded corners
- **Scroll behavior**: Content should scroll vertically; use horizontal scroll sparingly (carousels)

### Accessibility (Not Optional)
- All interactive elements must have accessible labels
- Support screen readers (VoiceOver / TalkBack)
- Support Dynamic Type / font scaling
- Provide reduced motion alternatives for animations
- Ensure logical focus order for keyboard/switch control navigation
- Never rely solely on color, gesture, or animation to convey information
- Touch targets ≥ 44×44pt minimum (ideally larger for primary actions)

### Performance-Conscious Design
- Minimize layers and complex shadows on lower-end devices
- Optimize images: use appropriate resolution for device pixel density
- Keep animations under 300ms for responsiveness feel
- Progressive disclosure: don't load everything at once
- Skeleton screens > spinner loading indicators
- Design for offline/poor connectivity gracefully

## Implementation Guidelines

When generating mobile UI as code (React/HTML):

### Phone Frame Wrapper
Always wrap mobile designs in a realistic phone frame:
```css
.phone-frame {
  width: 393px;       /* iPhone 15 Pro logical width */
  height: 852px;      /* iPhone 15 Pro logical height */
  border-radius: 48px;
  overflow: hidden;
  border: 8px solid #1a1a1a;
  position: relative;
  background: var(--bg-color);
}
```

### Status Bar
Include a realistic status bar with time, signal, wifi, battery:
```
9:41    ·····  📶  🔋
```

### Home Indicator
Include bottom home indicator bar for modern phones:
```css
.home-indicator {
  width: 134px;
  height: 5px;
  background: var(--text-color);
  border-radius: 100px;
  margin: 8px auto;
  opacity: 0.3;
}
```

### Bottom Navigation
For tab bars, always include proper sizing and active/inactive states:
- Icon size: 24×24
- Label font: 10–12px
- Active: brand primary color
- Inactive: gray/muted
- Include subtle animation on tab switch

### Scrollable Content
Mobile screens overflow — make content areas scrollable:
```css
.content-area {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
```

### Responsive Text
```css
body {
  font-size: 16px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}
```

## Modern Mobile Design Trends (2025-2026)

Stay current with these trends, but apply them purposefully:

1. **AI-Personalized Layouts**: Interfaces that adapt based on user behavior
2. **Gesture-First Navigation**: Bottom sheets, swipe actions, but always with visible fallbacks
3. **Dark-First Design**: Many users default to dark mode — design dark first, then adapt to light
4. **Micro-Interactions**: Purposeful animations that communicate state changes (not decoration)
5. **Glassmorphism / Translucency**: Frosted glass effects for overlays (Apple's Liquid Glass, Material blur)
6. **Progressive Disclosure**: Reveal complexity gradually, show only what's needed
7. **Bottom-Oriented UI**: Move controls and actions to the bottom of the screen
8. **Bento Grid Layouts**: Card-based modular layouts for dashboards and home screens
9. **Skeleton Loading**: Gray placeholder blocks that animate while content loads
10. **Voice & Multimodal Input**: Consider voice, gesture, and touch as complementary inputs
11. **Passkey Authentication**: Biometric-first login flows replacing passwords
12. **Sustainable Design**: Energy-efficient dark modes, lightweight assets, minimal data usage

## Quality Checklist

Before delivering a mobile design, verify:

- [ ] Touch targets meet minimum size (44pt/48dp)
- [ ] Primary actions are in thumb-reach zone
- [ ] Navigation is visible and consistent
- [ ] Text meets minimum size (16px body)
- [ ] Color contrast meets WCAG ratios (4.5:1 text, 3:1 large/UI)
- [ ] Dark mode is properly implemented (not just inverted)
- [ ] Status bar and safe areas are respected
- [ ] Scrolling behavior is smooth and natural
- [ ] Loading states exist (skeleton or indicator)
- [ ] Empty states provide guidance (not just blank)
- [ ] Error states are helpful and recoverable
- [ ] The design has a clear, intentional aesthetic identity
- [ ] Platform conventions are respected (iOS or Android)
