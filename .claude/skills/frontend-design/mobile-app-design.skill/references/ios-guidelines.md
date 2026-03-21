# iOS Design Guidelines Reference

## Source: Apple Human Interface Guidelines (developer.apple.com/design/human-interface-guidelines)

## Core Philosophy: Clarity, Deference, Depth, Consistency

### Clarity
- Clean, precise, uncluttered layouts
- Simple and direct labels — avoid jargon
- Universal icons that reduce cognitive load
- Strong visual hierarchy through size, color, weight
- Embrace whitespace — let elements breathe

### Deference
- UI should not steal spotlight from content
- Minimize distractions — hide unnecessary UI elements
- Subtle animations and transitions that guide, not overwhelm
- Interface "gets out of the way" during content consumption

### Depth
- Layers, shadows, and motion create clear hierarchy
- Translucency and blur for contextual overlays
- Parallax and dimensional effects where meaningful

### Consistency
- Standard UI elements and visual cues
- Familiar to users accustomed to Apple conventions
- Predictability reduces learning curve

---

## Liquid Glass (iOS 26+ / 2025)

Apple's most significant visual redesign since 2013. Key characteristics:
- **Translucent material** used for controls, navigation bars, modals
- Floats above content creating subtle depth and hierarchy
- Background shows through, creating dynamic visual connection
- **Unified aesthetic** across all Apple platforms
- Emphasizes continuity between hardware and software
- Refined color palette with bolder, left-aligned typography
- Concentricity creating unified rhythm

### Liquid Glass Application
- Navigation bars and tab bars use Liquid Glass material
- Modals and sheets float with translucent backgrounds
- Controls have glass-like quality with subtle reflections
- System adapts glass tint based on content behind it

---

## iOS Screen Sizes (Current)

Design for the smallest screen your audience realistically uses:
- iPhone SE: 375×667pt
- iPhone 14/15: 390×844pt
- iPhone 15 Pro: 393×852pt
- iPhone 15 Pro Max: 430×932pt
- iPhone 16 Pro: 402×874pt

**Tip**: Design at 393pt width as baseline (iPhone 15 Pro), test at 375pt minimum.

---

## Navigation (iOS)

### Tab Bar
- Located at bottom of screen
- 2-5 tabs (optimal: 4-5)
- Height: 49pt
- Icons: 25×25pt with text labels below
- Active state: filled icon + brand/system tint
- Inactive state: outlined icon + gray
- iOS now includes dedicated Search tab at bottom
- Supports persistent accessory views (e.g., media playback)

### Navigation Bar (Top)
- Title (large or inline)
- Back button (left) — always preserve back navigation
- Action buttons (right) — 1-2 maximum
- Liquid Glass material in iOS 26+
- Large titles collapse on scroll

### Bottom Sheet / Modal
- Half-height or full-height presentations
- Drag handle at top (pill-shaped indicator)
- Swipe down to dismiss
- Supports nested scrolling
- Use for secondary flows, filters, details

### Gestures
- Swipe from left edge: Go back (system gesture — never override)
- Swipe down: Dismiss modal/sheet
- Pull down: Refresh content
- Long press: Context menu (with haptic feedback)
- Pinch: Zoom (photos, maps)

---

## iOS Typography

### System Font: SF Pro
- SF Pro Display: For larger sizes (20pt+)
- SF Pro Text: For smaller sizes (below 20pt)
- SF Pro Rounded: For friendly/playful contexts
- Monospaced variant available for code/data

### Type Scale (Default Dynamic Type)
| Style          | Size | Weight    | Leading |
|----------------|------|-----------|---------|
| Large Title    | 34pt | Bold      | 41pt    |
| Title 1        | 28pt | Bold      | 34pt    |
| Title 2        | 22pt | Bold      | 28pt    |
| Title 3        | 20pt | Semibold  | 25pt    |
| Headline       | 17pt | Semibold  | 22pt    |
| Body           | 17pt | Regular   | 22pt    |
| Callout        | 16pt | Regular   | 21pt    |
| Subhead        | 15pt | Regular   | 20pt    |
| Footnote       | 13pt | Regular   | 18pt    |
| Caption 1      | 12pt | Regular   | 16pt    |
| Caption 2      | 11pt | Regular   | 13pt    |

### Dynamic Type
- Users can adjust text size system-wide
- Apps should support at least the standard dynamic type sizes
- Use UIFont.preferredFont(forTextStyle:) or equivalent
- Test with largest and smallest type settings

---

## iOS Color System

### Semantic System Colors
Use system colors that automatically adapt to light/dark mode:
- `systemBackground` — primary background
- `secondarySystemBackground` — grouped/card background
- `label` — primary text
- `secondaryLabel` — secondary text
- `systemBlue`, `systemGreen`, `systemRed`, etc. — tint colors
- `separator` — divider lines
- `systemGray` through `systemGray6` — gray scale

### Accent Colors
- Use sparingly for primary actions and interactive elements
- Should complement system colors
- Must maintain contrast in both light and dark modes

### Dark Mode
- Use semantic colors that auto-switch
- Test both appearances thoroughly
- Elevated surfaces are slightly lighter in dark mode
- Images may need separate dark mode variants

---

## iOS Components Best Practices

### Buttons
- Minimum touch target: 44×44pt
- Primary action: Filled button with brand color
- Secondary: Outlined or text button
- Destructive: Red tint (system red)
- Include haptic feedback for important actions

### Cards
- Rounded corners (12-16pt radius)
- Subtle shadow or elevated background
- Clear padding (16pt internal)
- Tap entire card for navigation (not tiny links inside)

### Lists / Tables
- Standard row height: 44pt minimum
- Disclosure indicators for drill-down (chevron right)
- Swipe actions for quick operations (delete, archive, flag)
- Section headers for grouped content

### Search
- Search bar at top of scrollable content
- Cancel button appears when focused
- Real-time suggestions as user types
- Recent searches for quick access

### Alerts & Action Sheets
- Alerts: Critical decisions with 2-3 options max
- Action Sheets: Multiple options triggered by user action
- Always include a Cancel option
- Destructive options in red

---

## iOS Accessibility

### VoiceOver
- Every interactive element needs an accessibility label
- Use `accessibilityHint` for non-obvious actions
- Group related elements with `accessibilityElement`
- Test full navigation flow with VoiceOver on

### Dynamic Type
- Support all text style categories
- Test with accessibility sizes (up to 310% of default)
- Ensure layouts don't break at extreme sizes

### Reduce Motion
- Respect `UIAccessibility.isReduceMotionEnabled`
- Replace animations with crossfades
- Disable parallax and bouncy effects

### Increase Contrast
- Support system "Increase Contrast" setting
- Provide higher contrast variants of custom colors
- Test with this setting enabled

### Smart Invert Colors
- Mark images and media to exclude from inversion
- Ensure custom views handle inversion properly
