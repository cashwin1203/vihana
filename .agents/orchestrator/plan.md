# Plan: Studio Vanguard UI/UX Agency Overhaul

## Studio Vanguard Roles
- **Design Director**: Visual hierarchy, Crimson Red (`#CC1100`) identity, brand coherence.
- **Lead UI/UX Architect**: Spatial layout, dashboard ergonomics (`AdminView` / `CoordinatorView`), component density.
- **Motion & Micro-interaction Lead**: Hover lifts, modal spring physics, counter transitions, pulse indicators.
- **Design System & Component Engineer**: Glassmorphism CSS tokens, gradients, skeleton loaders, responsive grid.
- **Accessibility & Contrast Specialist**: WCAG 2.1 AA compliance, >=44px touch targets, focus rings.

## Milestone Plan

### Milestone 0: Exploration & UI/UX Audit
- **Objective**: Audit current CSS (`globals.css`), component architecture, layout bugs, responsive breakpoints, contrast gaps.
- **Action**: Spawn Explorer subagent (`explorer_m0`) to inspect code, map CSS tokens, components, modals, and list targeted changes.

### Milestone 1: Design System & Color Refresh (R1)
- **Objective**: Implement U&I Crimson (`#CC1100`) design system, glassmorphism tokens, elevated shadow depth, dark-mode gradient overlays, and WCAG AA contrast.
- **Subagents**: Worker (`implementer_m1`), Reviewer (`reviewer_m1`), Challenger (`challenger_m1`), Auditor (`auditor_m1`).
- **Verification**: `npx next build` passes without styling or compilation errors; contrast ratio verification.

### Milestone 2: High-Impact Motion & Micro-Interactions (R2)
- **Objective**: Hardware-accelerated hover lifts (`translateY(-2px)`), modal entrance spring physics (`cubic-bezier(0.16, 1, 0.3, 1)`), stat card counter entrance transitions, live status badge pulse indicators.
- **Subagents**: Worker (`implementer_m2`), Reviewer (`reviewer_m2`), Challenger (`challenger_m2`), Auditor (`auditor_m2`).
- **Verification**: Smooth keyframe definitions in CSS/Tailwind and React hooks/state transitions; `npx next build` clean build.

### Milestone 3: Dashboard Ergonomics & Layout Polish (R3)
- **Objective**: Refine Chapter Leader (`AdminView`) and Centre Leader (`CoordinatorView`) card layouts, metric card density, spacing (`gap`/`padding`), empty states, loading skeletons, modal section dividers.
- **Subagents**: Worker (`implementer_m3`), Reviewer (`reviewer_m3`), Challenger (`challenger_m3`), Auditor (`auditor_m3`).
- **Verification**: Structural check of all view containers and modal components; clean build.

### Milestone 4: Responsive Layout & Touch Targets (R4) & Final Victory Gate
- **Objective**: Mobile to desktop viewport responsiveness (320px to 1920px), minimum 44px touch targets on buttons/inputs/controls, clear focus rings, zero horizontal scroll breakage, full E2E build verification.
- **Subagents**: Worker (`implementer_m4`), Reviewer (`reviewer_m4`), Challenger (`challenger_m4`), Auditor (`auditor_m4`).
- **Verification**: `npx next build` clean build, victory claim sent to Sentinel (`47a651e2-f3ac-47b7-bbdd-cd610cbda8a2`).
