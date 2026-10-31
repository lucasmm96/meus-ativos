---
name: Equity & Yield Wealth Tracking
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c0cab4'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8a9480'
  outline-variant: '#414939'
  surface-tint: '#8adb58'
  primary: '#8adb58'
  on-primary: '#153800'
  primary-container: '#6cba3b'
  on-primary-container: '#1c4500'
  inverse-primary: '#2f6c00'
  secondary: '#adc6ff'
  on-secondary: '#002e69'
  secondary-container: '#0162cf'
  on-secondary-container: '#dae4ff'
  tertiary: '#ffb2bc'
  on-tertiary: '#600f26'
  tertiary-container: '#f68598'
  on-tertiary-container: '#711d31'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#a5f871'
  primary-fixed-dim: '#8adb58'
  on-primary-fixed: '#092100'
  on-primary-fixed-variant: '#225100'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a41'
  on-secondary-fixed-variant: '#004494'
  tertiary-fixed: '#ffd9dd'
  tertiary-fixed-dim: '#ffb2bc'
  on-tertiary-fixed: '#400013'
  on-tertiary-fixed-variant: '#7e273b'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display-lg:
    fontFamily: Playfair Display
    fontSize: 36px
    fontWeight: '600'
    lineHeight: 44px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Playfair Display
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Playfair Display
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Playfair Display
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
    letterSpacing: 0em
  headline-sm:
    fontFamily: Playfair Display
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.05em
  financial-numeric:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system targets discerning individual investors managing high-conviction portfolios in variable income—specifically domestic equities (Ações) and real estate investment trusts (FIIs). The aesthetic rejects the hyperactive, gamified neon styling of retail crypto platforms in favor of an authoritative, analytical, and discreet wealth management presence. 

The visual voice merges high-editorial wealth management with pragmatic fintech utility:
- **Tone:** Grounded, disciplined, sovereign, and razor-sharp.
- **Aesthetic Movement:** Modern Editorial Minimalist meets High-Precision Dark Mode.
- **Form Factor Context:** Mobile-first Progressive Web App (PWA). Interactions must respect touch targets, physical device safe areas (notches, home bars), and instant tactile response while preserving deep visual hierarchy across dense financial datasets.

## Colors

The palette operates within strict luminance discipline tailored for low-light legibility and sustained visual focus. Rather than decorative color use, hues represent semantic asset classes and system states:

- **Canvas & Surface Tokens:**
  - `background-base`: `#121212` — Deep neutral foundation engineered to minimize OLED battery drain and visual strain.
  - `surface-card`: `#1E1E1E` — Primary elevation layer for content modules, asset groupings, and metric containers.
  - `surface-elevated`: `#262626` — Sub-cards, nested lists, and floating sheets.
  - `border-subtle`: `#2D2D2D` — Structural division providing crisp edge definition without perceptual noise.
  - `border-active`: `#3E3E3E` — Interactive boundaries under hover or tap states.

- **Semantic Asset Class & Status Tokens:**
  - `equity-primary` (Ações): `#6CBA3B` — Energetic organic green denoting corporate equity, capital gains, and positive yield.
  - `yield-primary` (FIIs): `#4285F4` — Architectural, structured blue representing Real Estate Investment Trusts, monthly rental dividends, and foundational yield.
  - `alert-critical` (Alerta/Offline): `#CF6679` — Desaturated warm crimson reserved for loss metrics, offline connection status, sync errors, and sell-side triggers.

- **Typography & Content Hierarchy:**
  - `text-primary`: `#FFFFFF` — Asset tickers, total net worth, primary labels, and active values.
  - `text-secondary`: `#A0A0A0` — Yield-on-cost, volume, dividend payment dates, and secondary column headers.
  - `text-tertiary`: `#6E6E6E` — Timestamps, disclaimers, micro metadata, and disabled actions.

## Typography

The typographical engine leverages deliberate juxtaposition:
- **Playfair Display (Headline Font):** Provides timeless banking prestige. Used for overall portfolio balances, dividend total summaries, chart milestone figures, and modal intros. It elevates the portfolio balance from a plain database query into personal net worth.
- **Inter (Body & Controls):** Used for analytical legibility. Every ticker symbol (e.g., `PETR4`, `HGLG11`), average price calculation, allocation percentage, table row, and form label must use Inter.
- **Tabular Figures:** Always apply `font-feature-settings: "tnum" 1` to Inter elements across financial metrics, price tags, and delta fluctuations to eliminate visual jitter during real-time valuation updates.

## Layout & Spacing

The layout is built for single-hand mobile interactions within a Progressive Web App container, scaling gracefully to tablet split-views:

- **Layout Model:** A fluid single-column stack on mobile devices (`max-width: 480px`), transitioning to a structured 2-column or sidebar dashboard above `768px`.
- **Vertical Rhythm:** A strict 4px/8px incremental scale governs component spacing. Internal card paddings sit predominantly at `space-md` (16px), preserving density without touch crowding.
- **PWA Mobile Safe Margins:** Base bottom margins must factor in the iOS/Android virtual navigation bar, demanding an extra dynamic safe padding (`env(safe-area-inset-bottom, 16px)`) underneath bottom navigation bars and floating transaction triggers.
- **Touch Targets:** Interactive rows, ticker pickers, and filter chips must enforce a minimum target dimension of 44x44px.

## Elevation & Depth

In dark mode interfaces, drop shadows become easily lost or muddy against deep backgrounds. Visual depth is established through a strict combination of **tonal surface layering** and **refined 1px stroke boundaries**:

- **Ground Level (`#121212`):** Primary viewport backdrop; holds page titles and persistent background charts.
- **Tier 1 Container (`#1E1E1E`):** Main portfolio balance cards, asset category cards, and transactional forms. Outlined with a continuous `1px solid #2D2D2D`.
- **Tier 2 Interactive Element (`#262626`):** Input fields, segmented asset switches, and nested asset detail rows inside an expanded card.
- **Floating Overlays & Sheets:** Fixed bottom navigation, action sheets, and ticker search menus sit on `rgba(30, 30, 30, 0.88)` backed by `backdrop-filter: blur(16px)`. Border stays crisp at `#3E3E3E`.
- **Ambient Shadow System:**
  - `elevation-card`: `0px 4px 20px -2px rgba(0, 0, 0, 0.5)`
  - `elevation-modal`: `0px 12px 32px -4px rgba(0, 0, 0, 0.7)`
  - *No colored glow is permitted except a 10% opacity diffuse aura under primary action buttons during focus.*

## Shapes

The design system embraces an elegant geometry calibrated by controlled rounded curves:
- **Small Controls & Chips:** Utilize 8px (`rounded-md`) to ensure tags and filter buttons feel solid and crisp.
- **Standard Cards & Input Blocks:** Standardized at 16px (`rounded-xl`), creating soft enclosures for asset metrics while remaining structural.
- **Hero Dashboard Cards & Modals:** Scaled to 24px (`rounded-2xl`) for high visual separation, softening bottom sheet takeovers and summary net-worth widgets.
- **Avatars & Asset Badges:** Fully circular (`rounded-full`) for asset class iconography (e.g., green bull icon for Ações, blue building icon for FIIs).

## Components

### Buttons
- **Primary Action (New Trade / Deposit):** Solid `#6CBA3B` or `#4285F4` background depending on contextual focus. Black text `#121212` for maximum contrast, `rounded-xl`, height 48px, typography `label-lg`.
- **Secondary / Ghost:** Transparent background, `1px solid #2D2D2D`, text `#FFFFFF`. On tap: background shifts to `#262626`.
- **Destructive / Sell:** Deep neutral surface with `1px solid #CF6679`, text `#CF6679`.

### Asset Allocation Chips & Filters
- Compact pill controls (`rounded-full`) with height 32px.
- **Ações Filter:** Inactive state displays `#1E1E1E` with `#A0A0A0` text; Active state displays `#1E1E1E` bordered with `#6CBA3B`, text `#6CBA3B`, and an inline glowing dot indicator.
- **FIIs Filter:** Active state features border and text in `#4285F4`.

### Cards (Asset Row & Metric Widgets)
- Background `#1E1E1E`, border `1px solid #2D2D2D`, `rounded-xl`, padding `16px`.
- Left-aligned ticker badge (`Inter Bold`, white) with company or fund name below (`#A0A0A0`).
- Right-aligned values featuring total holding amount (`Inter Medium`, tabular numerals), paired with a colored percentage badge (`+1.45%` in `#6CBA3B`, `-0.82%` in `#CF6679`).

### Inputs & Financial Keyboards
- Height 48px, background `#121212`, border `1px solid #2D2D2D`, corner radius `rounded-xl`, text `#FFFFFF`.
- Placeholder text in `#6E6E6E`. Focus state introduces a crisp `1px solid #4285F4` border with no diffuse box shadow.
- Asset quantity and price inputs strictly invoke numeric keypad triggers (`inputmode="decimal"`).

### Checkboxes & Segmented Selectors
- Custom 20x20px checkboxes with 4px border radius. Unchecked: `#2D2D2D` outline; Checked: `#6CBA3B` fill with `#121212` checkmark icon.
- Segmented control (Ações vs. FIIs switcher): Full-width toggle pill in `#121212` with a sliding `#262626` thumb, bordered by `#2D2D2D`.

### Offline / Sync Banner
- Positioned immediately beneath the status bar. Background `rgba(207, 102, 121, 0.12)`, border `1px solid #CF6679`, text `#CF6679`, typography `label-md`. Communicates cached portfolio state without blocking user exploration.