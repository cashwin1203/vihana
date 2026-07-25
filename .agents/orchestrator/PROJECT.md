# Project: Volunteer OS UI/UX Agency Audit & Overhaul

> Lead Agency: Studio Vanguard (Design Director, Lead UI/UX Architect, Motion & Micro-interaction Lead, Design System & Component Engineer, Accessibility & Contrast Specialist)

## Architecture & Design Tokens
- **Primary Brand Color**: U&I Crimson (`#CC1100`)
- **Dark Mode Surface**: Glassmorphism with `backdrop-filter: blur(12px)` and border highlight `rgba(255, 255, 255, 0.1)`
- **Typography**: Google Inter / Outfit font hierarchy
- **Motion Spec**: Hover lift `transform: translateY(-2px)`, spring physics cubic-bezier `cubic-bezier(0.16, 1, 0.3, 1)`, counter entrance animations, pulse status badges.
- **Accessibility Spec**: WCAG 2.1 AA compliant contrast ratio (>= 4.5:1 text, >= 3:1 UI components), minimum 44px touch targets, visible ring focus indicators.

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Exploration & UI/UX Audit | Analyze existing Next.js layout, CSS tokens, Tailwind/CSS setup, component hierarchy | None | DONE |
| M1 | Design System & Color Refresh | Implement U&I Crimson `#CC1100` theme, glassmorphism tokens, CSS gradients, typography, high-contrast WCAG AA compliance [R1] | M0 | DONE |
| M2 | Motion & Micro-interactions | Add interactive hover lifts, modal entrance spring physics, counter animations, and pulse indicators [R2] | M1 | IN_PROGRESS |
| M3 | Dashboard Ergonomics & Layout Polish | Polish Chapter & Centre Leader views (`AdminView`, `CoordinatorView`), spacing, empty states, loading skeletons, action button alignment [R3] | M2 | PLANNED |
| M4 | Responsive Layout & Touch Targets | Fix viewports (320px - 1920px), 44px touch targets, prevent horizontal scroll overflow, E2E build verification (`npx next build`) [R4] | M3 | PLANNED |

## Code Layout
- `src/app/globals.css`: Tailored CSS variables, glassmorphism utilities, keyframes, scrollbar styling
- `src/app/layout.tsx`: Root layout, global fonts (Inter/Outfit), theme providers
- `src/app/page.tsx`: Main page composition and view switching
- `src/components/Header.tsx`: Navigation bar, center selector, action items
- `src/components/MetricCard.tsx`: Metric stat display, counter animations, trend indicators
- `src/components/AdminView.tsx`: Chapter Leader View - multi-center metrics, aggregate analysis
- `src/components/CoordinatorView.tsx`: Centre Leader View - session roster, attendance, churn watchlist
- `src/components/VolunteerView.tsx`: Volunteer view
- `src/components/*Modal.tsx`: AISummaryModal, LaunchActivityModal, VolunteerManagementModal, WhatsAppSimulatorModal

## Interface Contracts & Constraints
- ZERO build or compilation errors during `npx next build`.
- Preserve existing data interfaces and Prisma schema.
- Maintain responsive behavior down to 320px mobile up to 1920px desktop.
