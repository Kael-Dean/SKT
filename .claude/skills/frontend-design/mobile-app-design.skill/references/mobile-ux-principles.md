# Universal Mobile UX Principles

## Sources: Nielsen Norman Group, WCAG 2.1/2.2, Baymard Institute, MIT Touch Lab, UX research

This document contains platform-agnostic UX principles that apply to all mobile app designs.

---

## 1. The Thumb Zone Model

Based on research by Steven Hoober and MIT Touch Lab:

### Physical Facts
- Average fingertip width: 1.6–2.0cm (45–57px)
- Average thumb width: 2.5cm (75px)
- 75% of users interact with phones using one thumb
- Users are less precise at screen edges (top and bottom)

### Zone Map (6.1" phone)
```
┌──────────────────────┐
│                      │
│    HARD TO REACH     │  Top 25%
│    Avoid primary     │  Requires hand repositioning
│    actions here      │
│                      │
├──────────────────────┤
│                      │
│    NATURAL ZONE      │  Middle 30%
│    Content display   │  Comfortable one-hand reach
│    Secondary actions │
│                      │
├──────────────────────┤
│                      │
│    EASY ZONE         │  Bottom 45%
│    Navigation        │  Natural thumb arc
│    Primary CTAs      │  Place critical actions here
│    FAB, tab bars     │
│                      │
└──────────────────────┘
```

### Hoober's Touch Target Padding Guidelines
- Top of screen: 42px padding
- Bottom of screen: 46px padding
- Bigger targets for primary / high-consequence actions
- 60×60pt or larger for emergency, payment, navigation controls

---

## 2. Touch Target Standards

### Platform Minimums
| Platform          | Minimum Size | Recommended |
|-------------------|-------------|-------------|
| Apple (iOS)       | 44×44pt     | 48×48pt     |
| Google (Android)  | 48×48dp     | 48×48dp     |
| WCAG 2.5.8        | 24×24px     | 44×44px     |
| Physical (NNG)    | 1cm × 1cm  | —           |

### Spacing Rules
- Minimum 8px/8dp between interactive elements
- Small targets need MORE spacing (inversely proportional)
- A well-spaced 44pt button outperforms a cramped 48pt button
- Consider: 84% of mobile apps struggle with proper touch targets (Baymard)

### Implementation Tips
- Expand touch targets beyond visible element size using padding
- Make the entire card/row tappable, not just the text or icon
- For icon buttons, add invisible padding to reach 48dp minimum
- Test on real devices with real fingers (not just mouse clicks)

---

## 3. Navigation Principles

### Fitts's Law Applied to Mobile
- Larger and closer targets are faster to tap
- Edge targets (against screen bezel) are effectively infinite-width
- Bottom-edge buttons have natural stopping point

### Core Navigation Rules
1. **Visibility**: If users can't see it, they won't find it
2. **Consistency**: Don't move navigation between screens
3. **Reachability**: 2 taps maximum to any primary function
4. **Feedback**: Indicate current location clearly (active tab state)
5. **Predictability**: Standard patterns > clever innovations
6. **Recovery**: Always provide a way back (back button, close, cancel)

### Navigation Pattern Selection Guide
| App Complexity        | Recommended Pattern                |
|-----------------------|------------------------------------|
| 2-3 sections          | Tab bar (bottom)                   |
| 3-5 sections          | Tab bar (bottom) — most common     |
| 5+ sections           | Tab bar + drawer for extras        |
| Linear flow           | Stack navigation (push/pop)        |
| Content-heavy         | Tab + stack hybrid                 |
| Dashboard             | Bento grid with drill-down         |
| E-commerce            | Tab bar + search + bottom sheet    |

### Gestures as Navigation
- Gestures feel fast for power users
- But gestures have a discoverability problem
- Rule: Always provide visible button alternatives
- Use subtle visual hints (peek edges, drag handles) to teach gestures
- Haptic feedback confirms gesture recognition

---

## 4. Information Architecture for Mobile

### Progressive Disclosure
- Show only what users need at each step
- Hide advanced options behind "More" or expandable sections
- Use bottom sheets for secondary details
- Reveal complexity on demand, not upfront

### Content Prioritization
- Mobile screens show ~30% of desktop content at once
- Prioritize by user task frequency
- Primary action should be immediately visible
- Secondary content accessible within 1-2 interactions

### Hierarchy Cues
- Size: Larger = more important
- Position: Top/center = more important
- Color: Brand/accent color = interactive or important
- Weight: Bold = headings/emphasis
- Spacing: More space around important elements

---

## 5. Typography Best Practices for Mobile

### Sizing
- Body text: 16px minimum (17pt iOS, 16sp Android)
- Small text / captions: never below 11-12px
- Headings: 1.3x–1.6x body size scaling
- Touch-interactive text (links): same sizing rules as buttons

### Readability
- Line height: 1.4–1.6 for body text
- Line length: 60-75 characters maximum per line
- Paragraph spacing: 0.5–1.0em between paragraphs
- Letter spacing: slight positive tracking (0.5-1px) aids mobile reading
- Font weight: Minimum 400 (Regular) for body; avoid thin/light weights below 16px

### Hierarchy System (3-Level Minimum)
1. **Display/Title**: Large, bold — page headers, hero text
2. **Subtitle/Section**: Medium weight — section headers, card titles
3. **Body**: Regular weight — main content text
4. **Caption/Meta**: Smaller, lighter — timestamps, secondary info

### Font Selection
- System fonts (SF Pro / Roboto) guarantee readability and performance
- Custom display fonts for brand personality — but only for large headings
- Avoid decorative fonts for body text
- Test fonts at smallest intended size on real devices

---

## 6. Color & Theming Principles

### Color Psychology in Mobile
- Blue: Trust, professionalism (banking, social media)
- Green: Growth, health, success (fintech, wellness)
- Red: Urgency, errors, alerts (use sparingly)
- Orange/Yellow: Energy, warmth, attention
- Purple: Premium, creative
- Neutral: Sophistication, focus on content

### Color System Architecture
```
Background Layer:    background, surface, surface-variant
Content Layer:       on-background, on-surface, on-surface-variant
Interactive Layer:   primary, secondary, tertiary
Feedback Layer:      error, success, warning, info
```

### Dark Mode Design Principles
1. Use dark gray (#121212) as base — not pure black
2. Use off-white (#E0E0E0) for text — not pure white
3. Communicate elevation through surface lightness (not shadow)
4. Desaturate accent colors slightly for dark backgrounds
5. Test both themes independently for WCAG compliance
6. Respect system preference (prefers-color-scheme)
7. Provide manual toggle as override

### WCAG Contrast Quick Reference
- Regular text on background: ≥ 4.5:1
- Large text on background: ≥ 3:1
- UI components and graphical objects: ≥ 3:1
- Focus indicators: ≥ 3:1 against adjacent colors
- Color must never be the ONLY indicator of meaning

---

## 7. Motion & Animation

### Purpose of Motion
- **Feedback**: Confirm user action (button press, toggle)
- **Orientation**: Show spatial relationships (screen transitions)
- **Focus**: Direct attention to important changes
- **Delight**: Add personality (sparingly — purposeful, not decorative)

### Timing Guidelines
| Animation Type    | Duration  | Use Case                       |
|-------------------|-----------|--------------------------------|
| Micro-feedback    | 100-150ms | Button press, toggle, ripple   |
| Simple transition | 200-300ms | Fade, slide, scale             |
| Complex transition| 300-500ms | Page transitions, expand/collapse|
| Stagger delay     | 50-100ms  | List item reveals              |

### Rules
- Response to touch: within 100ms
- Never block interaction during animation
- Provide reduced-motion alternatives
- Use easing curves (never linear for UI motion)
- Physics-based springs feel more natural than cubic-bezier
- Exit animations should be faster than enter animations

---

## 8. Loading & Empty States

### Loading Patterns (Best to Worst)
1. **Skeleton screens**: Gray placeholder blocks that animate — best perceived performance
2. **Progressive loading**: Show content as it arrives (text before images)
3. **Pull-to-refresh indicator**: Standard spinner during refresh
4. **Inline loading**: Small indicator within the updating component
5. **Full-screen spinner**: Last resort — feels slowest

### Empty State Design
Every screen should have a designed empty state:
- Illustration or icon (friendly, not sad)
- Brief explanation of what will appear here
- Clear action to get started ("Create your first...", "Browse...")
- Never show a completely blank screen

### Error States
- Explain what went wrong in plain language
- Provide a clear action to recover ("Try again", "Go back")
- Don't blame the user
- Retain user input when possible (don't clear forms on error)
- Offer alternative paths when primary action fails

---

## 9. Onboarding Patterns

### Progressive Onboarding (Preferred)
- Show value before asking commitment
- Teach through doing, not reading
- 3-5 screens maximum for feature intro
- Skip option always visible
- Dot/progress indicator shows position

### Onboarding Best Practices
- Delay account creation until necessary (let users explore first)
- Permission requests should explain WHY (just-in-time, not upfront)
- Use tooltips and coach marks for feature discovery
- First session should feel guided but not forced
- Measure Day 1 and Day 7 retention as success metrics

---

## 10. Performance as UX

### Speed Perception
- < 100ms: Feels instant
- 100-300ms: Feels responsive
- 300-1000ms: Feels like processing
- > 1000ms: User loses focus — show progress indicator
- > 3000ms: Unacceptable — users leave

### Design for Performance
- Optimize image sizes for device pixel density
- Lazy load below-the-fold content
- Cache frequently accessed data
- Design offline states (not just error states)
- Lightweight animations over heavy particle effects
- Test on mid-range devices, not just flagships

---

## 11. Form Design for Mobile

### Input Best Practices
- Use appropriate keyboard type (email, number, phone, URL)
- Auto-capitalize and auto-correct where appropriate
- Inline validation (immediate feedback, not on submit)
- Clear error messages below the field
- Floating labels that move above on focus
- Large tap targets for input fields (56dp height minimum)

### Reducing Input Friction
- Pre-fill when possible (location, name, date)
- Use pickers for dates, times, and predefined options
- Biometric authentication over typed passwords
- Auto-advance between OTP digits
- Support paste for codes and addresses
- Show/hide password toggle

---

## 12. Mobile-Specific Interaction Patterns

### Pull-to-Refresh
- Standard gesture for refreshing feed/list content
- Visual indicator (spinner) appears at top
- Content shifts down during refresh
- Not appropriate for non-list screens

### Swipe Actions on List Items
- Left swipe: Primary action (e.g., delete, archive)
- Right swipe: Secondary action (e.g., mark as read, pin)
- Color-coded backgrounds reveal under the swiped row
- Always provide confirmation for destructive actions

### Long Press
- Opens context menu or selection mode
- Trigger with haptic feedback
- Use for secondary actions on items
- Not discoverable — always provide alternative access

### Bottom Sheet
- Half-screen: Filters, details, quick actions
- Full-screen: Complex sub-flows, editing
- Draggable between states
- Scrim behind modal sheets
- Snap points for intermediate heights

### Floating Action Button (FAB)
- One per screen maximum
- Primary creation action ("New", "Compose", "Add")
- Bottom right position (respecting navigation)
- Can hide on scroll, reappear on scroll up
- Extended FAB includes text label for clarity
