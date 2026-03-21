# Android & Material Design 3 Guidelines Reference

## Source: Material Design 3 (m3.material.io) & Android Developer Documentation

## Core Philosophy

Material Design 3 is Google's open-source design system for building high-quality digital experiences. M3 emphasizes:
- **Personalization**: Dynamic Color derived from user wallpapers
- **Accessibility**: Inclusive design as a foundation, not an afterthought
- **Adaptability**: Responsive across phones, tablets, foldables, wearables, and XR
- **Expression**: Encouraging products to feel unique while maintaining usability

---

## Material 3 Expressive (2025)

The latest evolution announced at Google I/O 2025. Key highlights:
- Backed by 46 research studies with 18,000+ participants globally
- Users of ALL age groups prefer M3 Expressive designs
- Expressive designs were found to be MORE usable (not just prettier)
- Enhanced emotional design patterns to boost engagement
- More dynamic sizing and placement of components (e.g., FAB)
- New motion physics system making interactions feel alive and fluid
- Increased animation, more colorful, modern aesthetic
- New components with greater visual and structural freedom
- Supports immersive platforms (AR/VR) with spatial panels and elevation

### What M3 Expressive Changes
- Color is used more boldly and intentionally
- Shapes are more varied and expressive (not just rounded rectangles)
- Motion feels more natural with physics-based animations
- Components have more personality while remaining accessible
- Older users can spot interactive elements as fast as younger users

---

## Android Screen Considerations

### Screen Densities
- mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi
- Use density-independent pixels (dp) for sizing
- Provide images at multiple densities or use vector graphics

### Common Screen Widths
- Compact: 0–599dp (phones)
- Medium: 600–839dp (small tablets, foldables)
- Expanded: 840dp+ (large tablets, desktops)

### Canonical Layouts
- **List-Detail**: Master list + detail panel (scales from phone to tablet)
- **Feed**: Scrollable content stream
- **Supporting Panel**: Main content + side panel on larger screens

---

## Navigation (Android)

### Bottom Navigation Bar
- 3-5 destinations (optimal: 4-5)
- Height: 56dp (80dp with labels)
- Icon size: 24×24dp
- Icon + label spacing: 8dp
- Active: Brand primary color, filled icon
- Inactive: Gray 600 (#757575), outlined icon
- Elevation: 8dp
- Badge support for notifications

### Navigation Rail (Tablets)
- Left side of screen
- For medium/expanded screen widths
- Same items as bottom nav but vertical layout
- Can include FAB at top

### Navigation Drawer
- For apps with 5+ destinations
- Modal (overlay) or permanent (side panel on tablets)
- Should not hide high-frequency actions

### Floating Action Button (FAB)
- Primary action of the screen
- Standard: 56×56dp
- Mini: 40×40dp
- Extended: with text label
- Position: Bottom right (16dp from edges)
- M3 Expressive allows more dynamic sizing and placement

### Top App Bar
- Standard: Title + navigation icon + action icons
- Centered: Title centered (for simple apps)
- Medium: Two-line layout with larger title
- Large: Prominent title that scrolls away
- Collapses on scroll (with elevation change)

---

## Material 3 Typography

### System Fonts: Roboto & Google Sans
- Roboto: Default system font for body text
- Google Sans: More expressive, used for headlines and display

### Type Scale
| Role          | Size  | Weight   | Line Height | Tracking |
|---------------|-------|----------|-------------|----------|
| Display Large | 57sp  | Regular  | 64sp        | -0.25sp  |
| Display Medium| 45sp  | Regular  | 52sp        | 0sp      |
| Display Small | 36sp  | Regular  | 44sp        | 0sp      |
| Headline Large| 32sp  | Regular  | 40sp        | 0sp      |
| Headline Med  | 28sp  | Regular  | 36sp        | 0sp      |
| Headline Small| 24sp  | Regular  | 32sp        | 0sp      |
| Title Large   | 22sp  | Regular  | 28sp        | 0sp      |
| Title Medium  | 16sp  | Medium   | 24sp        | 0.15sp   |
| Title Small   | 14sp  | Medium   | 20sp        | 0.1sp    |
| Body Large    | 16sp  | Regular  | 24sp        | 0.5sp    |
| Body Medium   | 14sp  | Regular  | 20sp        | 0.25sp   |
| Body Small    | 12sp  | Regular  | 16sp        | 0.4sp    |
| Label Large   | 14sp  | Medium   | 20sp        | 0.1sp    |
| Label Medium  | 12sp  | Medium   | 16sp        | 0.5sp    |
| Label Small   | 11sp  | Medium   | 16sp        | 0.5sp    |

### Typography Usage
- Use clear typographic scale for hierarchy
- sp (scale-independent pixels) respects user font size preferences
- Limit to 2-3 distinct text styles per screen for clarity
- Headlines draw attention; body text maintains readability

---

## Material 3 Color System

### Key Color Roles
- **Primary**: Main brand color for key components (FAB, buttons, active states)
- **On Primary**: Text/icons on primary color surfaces
- **Primary Container**: Lighter variant for backgrounds of primary elements
- **Secondary**: Supporting color for less prominent components
- **Tertiary**: Contrasting accent for balance
- **Error**: Indicates errors (#B3261E default)
- **Surface**: Background of cards, sheets, menus
- **On Surface**: Text/icons on surface
- **Outline**: Borders and dividers
- **Surface Variant**: Alternative surface for visual differentiation

### Dynamic Color
- Derives color scheme from user's wallpaper
- Available on Android 12+ (API 31+)
- Maintains brand colors for critical elements
- Allows personal expression while respecting product identity
- Use Material Theme Builder to preview dynamic schemes

### Dark Theme
- Surface: #121212 as base (not pure black)
- Elevated surfaces get progressively lighter (#1E1E1E, #232323, etc.)
- Primary color may need lightened variants for contrast
- Use "on" colors that maintain 4.5:1 contrast ratio
- Limited color palette — accent colors should be desaturated
- Elevation is communicated through lighter surface tones, not shadows

### Color Tokens
Design with tokens, not raw hex:
```
--md-sys-color-primary
--md-sys-color-on-primary
--md-sys-color-primary-container
--md-sys-color-on-primary-container
--md-sys-color-surface
--md-sys-color-on-surface
--md-sys-color-surface-variant
--md-sys-color-outline
--md-sys-color-error
```

---

## Material 3 Components

### Buttons
- **Filled**: High emphasis, primary action (height: 40dp)
- **Outlined**: Medium emphasis
- **Text**: Low emphasis
- **Elevated**: Mid emphasis with shadow
- **Tonal**: Mid emphasis with container color
- Corner radius: 20dp (full rounded)
- Minimum touch target: 48×48dp
- Minimum width: 64dp

### Cards
- **Elevated**: Subtle shadow, no outline
- **Filled**: Tinted surface, no shadow
- **Outlined**: Border, no shadow
- Corner radius: 12dp
- Internal padding: 16dp
- Content alignment: Start-aligned

### Chips
- Filter, suggestion, assist, input varieties
- Height: 32dp
- Corner radius: 8dp
- Can include leading icon and trailing close

### Dialogs
- Corner radius: 28dp
- Max width: 560dp
- Title + content + actions layout
- Actions: right-aligned text buttons
- Scrim behind dialog

### Bottom Sheets
- Standard: Non-modal, partial screen
- Modal: With scrim overlay
- Drag handle: 32×4dp centered at top
- Corner radius: 28dp (top corners only)

### Snackbar
- Appears at bottom of screen
- Max 2 lines text
- Optional action button
- Auto-dismisses after 4-10 seconds
- Height: 48dp (single line) / 68dp (two lines)

### Text Fields
- **Filled**: Background color, no border
- **Outlined**: Border, no background
- Height: 56dp
- Supporting text below
- Leading/trailing icons
- Error state with red border + helper text

---

## Material 3 Motion

### Duration
- Short: 150ms (quick feedback)
- Medium: 300ms (transitions)
- Long: 500ms (complex animations)

### Easing
- **Emphasized**: For transitions that need attention
- **Standard**: For most component animations
- **Decelerate**: For elements entering the screen
- **Accelerate**: For elements leaving the screen

### M3 Expressive Motion Physics
- Interactions feel alive, fluid, natural
- Spring-based animations for organic feel
- Shared element transitions between screens
- Container transforms for seamless navigation

---

## Android Gestures

### System Gestures (Do Not Override)
- Swipe from left/right edge: Back navigation
- Swipe up from bottom: Home
- Swipe up and hold: Recent apps

### In-App Gestures
- Pull down: Refresh
- Swipe item left/right: Actions (archive, delete)
- Long press: Select / context menu
- Double tap: Zoom / like
- Pinch: Zoom

---

## Android Accessibility

### TalkBack
- Provide contentDescription for all meaningful UI elements
- Use semantic roles (button, heading, checkbox)
- Ensure logical reading/focus order
- Group related elements with accessibility containers

### Font Scaling
- Use sp units for text (respects user preference)
- Test at 200% font scale
- Layouts must accommodate enlarged text without breaking

### Switch Access
- All interactive elements reachable via switch navigation
- Visible focus indicators
- Adequate spacing between targets

### High Contrast
- Support "High Contrast Text" system setting
- Test with color correction modes (protanopia, deuteranopia, tritanopia)

### Reduce Animations
- Respect `Settings.Global.ANIMATOR_DURATION_SCALE`
- Provide reduced motion alternatives
- Never require animation completion for functionality
