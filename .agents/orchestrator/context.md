# Context Recovery & Technical Specifications

## Technical Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + custom CSS variables in `globals.css`
- **Icons**: Lucide React (`lucide-react`)
- **Database**: Prisma (`@prisma/client`)
- **Design Tokens**: U&I Crimson (`#CC1100`), Dark glassmorphism (`backdrop-filter: blur(12px)`), Google Inter/Outfit fonts

## Requirements Mapping
- **R1**: Visual Hierarchy, Crimson Red (`#CC1100`), Glassmorphism, Elevated depth shadows, Google Inter/Outfit fonts, WCAG AA contrast.
- **R2**: Interactive hover lifts (`transform: translateY(-2px)`), Spring physics modals (`cubic-bezier(0.16, 1, 0.3, 1)`), Stat card counter transitions, Live center pulse badge.
- **R3**: Dashboard ergonomics (`AdminView`, `CoordinatorView`), spacing consistency, empty states, loading skeletons, modal dividers & explicit action buttons.
- **R4**: Responsive layout (320px - 1920px), minimum 44px touch targets, focus states, zero horizontal scroll breakage.

## Acceptance Criteria Verification Commands
- `npx next build`
