---
name: Reliant POS
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0058be'
  on-secondary: '#ffffff'
  secondary-container: '#2170e4'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002113'
  on-tertiary-container: '#009668'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.2'
  price-display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.01em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 24px
---

## Brand & Style
The brand personality is authoritative yet approachable, focusing on reliability, speed, and precision. The design system is tailored for retail and hospitality environments where cognitive load must be minimized during high-traffic periods.

The aesthetic follows a **Modern Corporate** style with a leaning toward **Functional Minimalism**. It prioritizes clarity through generous whitespace within dense data sets and a structured hierarchy. The UI should feel like a high-performance tool—utilitarian and unobtrusive, but polished with subtle depth to ensure a premium user experience.

## Colors
The palette is anchored by **Deep Navy** (Primary) to establish a sense of permanence and professional trust. **Professional Blue** (Secondary) is used for interactive elements like links, selections, and secondary actions.

**Emerald Green** is reserved strictly for "Success" and "Finalize" actions, such as completing a sale or confirming a payment, providing a clear psychological reward. **Amber** serves as a high-visibility signal for alerts, such as low stock or pending transactions. Neutral grays are utilized for secondary text and borders to maintain a clean, low-distraction interface.

## Typography
**Inter** is the exclusive typeface for the design system, chosen for its exceptional legibility and neutral character. In a POS context, numeric clarity is paramount; Inter's tall x-height ensures that prices and SKU numbers are readable at a glance under varying lighting conditions.

The scale uses tight line heights for headlines to keep blocks of text compact, while labels use slightly increased letter spacing for better differentiation at small sizes. A specific `price-display` role is defined for total amounts and checkout figures to ensure they dominate the visual hierarchy.

## Layout & Spacing
The layout employs a **Fluid Grid** system that prioritizes a multi-pane interface. On desktop and tablets, the layout is split into a "Product Discovery" area (spanning 8 columns) and a "Transaction Sidebar" (spanning 4 columns).

Spacing follows a 4px baseline grid. High-density components (like product lists) use `sm` (8px) spacing to maximize information density, while structural layout elements use `lg` (24px) to prevent the UI from feeling cluttered. On mobile, the transaction sidebar collapses into a bottom sheet
