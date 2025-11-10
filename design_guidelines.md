# Design Guidelines: AI Multi-Agent Screenshot Capture System

## Design Approach

**System Selected:** Material Design 3 adapted for technical/developer tools
**Rationale:** This is a utility-focused productivity application requiring clarity, efficiency, and information density. Material Design provides robust patterns for forms, data display, and loading states while maintaining a clean, professional aesthetic suitable for technical users.

**Core Principles:**
- Clarity over decoration: Every element serves a functional purpose
- Information hierarchy: Clear distinction between input, process, and output
- Scannable layouts: Users should quickly understand system state and results
- Developer-friendly: Technical yet approachable interface

---

## Typography

**Font Family:** Inter (via Google Fonts CDN) for entire interface
- Primary weights: 400 (regular), 500 (medium), 600 (semibold)

**Hierarchy:**
- Page title: text-2xl font-semibold (30px)
- Section headers: text-lg font-semibold (20px)
- API endpoint labels: text-sm font-medium uppercase tracking-wide (14px)
- Body text: text-base (16px)
- Helper text/metadata: text-sm text-gray-600 (14px)
- Code/technical data: font-mono text-sm (monospace, 14px)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8 consistently
- Component padding: p-6
- Section spacing: space-y-8
- Card internal spacing: p-4 or p-6
- Input/button spacing: px-4 py-2
- Grid gaps: gap-4 or gap-6

**Container Structure:**
- Main container: max-w-6xl mx-auto px-6
- Full-width cards/sections within container
- No multi-column layouts (single focused workflow)

---

## Component Library

### Input Section
**Question Input Interface:**
- Large textarea (min-h-32) with placeholder text
- Character counter in bottom-right corner
- Submit button: Primary action, px-8 py-3, prominent placement
- Example questions as chips/pills below input for quick testing

### Loading States
**Progress Indicator:**
- Linear progress bar showing current step
- Status text showing current action (e.g., "Analyzing task...", "Navigating to page...", "Capturing screenshot 3/5...")
- Animated spinner for indeterminate states
- Estimated time remaining when calculable

### Results Display
**Screenshot Gallery:**
- Vertical timeline layout (not grid)
- Each step as a card containing:
  - Step number badge
  - Screenshot (full-width within card, max-h-96, object-contain)
  - Step description text below image
  - Timestamp/metadata in small text
- Spacing between cards: space-y-6

**Screenshot Cards:**
- Border: border border-gray-200
- Rounded corners: rounded-lg
- Shadow: shadow-sm
- Hover state: subtle shadow-md transition
- Click to expand/zoom functionality indicated by cursor-pointer

### Navigation/Header
**Top Bar:**
- Logo/title on left
- API status indicator on right (connected/disconnected badge)
- Height: h-16
- Bottom border: border-b

### Response Metadata Panel
**Technical Details Section:**
- Collapsible panel showing:
  - Request timestamp
  - Processing duration
  - Number of steps captured
  - Target application detected
- Uses disclosure pattern (chevron icon to expand/collapse)
- Background: bg-gray-50 when expanded

### Error States
**Error Display:**
- Alert box with red accent (border-l-4 border-red-500)
- Error icon + clear error message
- Suggested actions/troubleshooting steps
- Retry button

---

## Interaction Patterns

**Primary User Flow:**
1. User enters question in textarea
2. Clicks submit → Input disabled, loading state begins
3. Progress updates stream in real-time
4. Screenshots appear progressively as captured (not all at once)
5. Final success state with complete gallery

**Secondary Interactions:**
- Click screenshot to view full-size in modal overlay
- Copy button for each step description
- Download button for screenshot set
- Clear/new query button to reset interface

---

## Animations

**Minimal, Purposeful Only:**
- Fade-in for progressively loaded screenshots (duration-300)
- Progress bar fill animation
- Smooth transitions for collapsible sections
- NO decorative animations, parallax, or scroll effects

---

## Icons

**Library:** Heroicons (outline style via CDN)
**Usage:**
- Loading: arrow-path with spin animation
- Success: check-circle
- Error: exclamation-triangle
- Expand: chevron-down/up
- Copy: clipboard
- Download: arrow-down-tray

---

## Images

This interface does NOT require a hero image. The focus is entirely on functional UI:
- Screenshots are the primary visual content (dynamically generated)
- No decorative imagery needed
- No background images or visual treatments

---

## Accessibility Implementation

- All form inputs have associated labels (visually hidden if needed for design)
- Screenshot images have alt text describing the UI state shown
- Loading states announced to screen readers
- Keyboard navigation for all interactive elements
- Focus indicators on all focusable elements (ring-2 ring-blue-500)
- Sufficient color contrast ratios throughout