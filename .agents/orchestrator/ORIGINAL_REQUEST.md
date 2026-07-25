# Original User Request

## 2026-07-25T10:11:38+05:30

<USER_REQUEST>
# Teamwork Project Prompt — UI/UX Agency Audit & Overhaul

> Goal: Execute multi-role design agency audit and implement cutting-edge UI/UX upgrades for Volunteer OS.

Act as a world-class digital design firm (Studio Vanguard) comprising specialized roles:
- **Design Director:** Overall aesthetic vision, brand coherence, and premium feel.
- **Lead UI/UX Architect:** Spatial hierarchy, dashboard ergonomics, and layout flow.
- **Motion & Micro-interaction Lead:** Hardware-accelerated animations, hover transitions, and visual feedback.
- **Design System & Component Engineer:** Modular CSS tokens, glassmorphism, responsive grid systems.
- **Accessibility & Contrast Specialist:** WCAG 2.1 AA compliance, high-contrast readable text, keyboard focus indicators.

Working directory: C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os
Integrity mode: development

---

## Requirements

### R1. Executive UI Design System & Color Refresh
Audit and upgrade the application's visual hierarchy. Enhance U&I India's Crimson Red (`#CC1100`) identity with sleek dark-mode glassmorphism, refined gradient overlays, elevated card depth shadows, and typography hierarchy using Google Inter/Outfit fonts.

### R2. High-Impact Motion & Micro-Interactions
Implement responsive micro-interactions across all interactive components:
- Interactive hover lifts (`transform: translateY(-2px)`) with subtle glow borders.
- Smooth modal entrances with spring physics (`cubic-bezier(0.16, 1, 0.3, 1)`).
- Dynamic stat card counter entrance transitions.
- Status badge pulse indicators for live center operations.

### R3. Dashboard Component Ergonomics & Layout Polish
Refine card layouts, metric card density, and action button alignment across both Chapter Leader View and Centre Leader View:
- Improve spacing consistency (`gap`, `padding`) to prevent visual clutter.
- Add visual indicators for empty states and loading skeletons.
- Enhance modal readability with clean section dividers and explicit action buttons.

### R4. Responsive Layout & Touch Target Enhancements
Ensure flawless responsiveness across mobile, tablet, and desktop viewports (320px to 1920px). Ensure all touch targets meet minimum 44px boundaries with clear focus states.

---

## Acceptance Criteria

### Visual & Architectural Polish
- [ ] Application compiles cleanly with zero CSS or TypeScript build errors (`npx next build`).
- [ ] All interactive elements feature smooth hover transitions (`transition: all 0.2s ease`).
- [ ] Modal dialogs load with backdrop blur (`backdrop-filter: blur(12px)`) and entrance keyframe animations.
- [ ] U&I Crimson (`#CC1100`) and complementary dark mode tones maintain WCAG AA contrast compliance across all text labels.
- [ ] Mobile navigation and table layouts adapt cleanly without horizontal scroll breaking page containers.
</USER_REQUEST>
