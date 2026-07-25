## 2026-07-25T01:56:46Z
You are the Worker for Milestone 5: Multi-Center Chapter Dashboard & At-Risk Watchlist (R6) for the NGO Volunteer Management Platform (U&I India - Vihana Center, Bangalore).

Working directory: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\worker_m5_gen2`
Project root: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os`

### Objective & Tasks
Inspect and implement/verify all functionality for Milestone 5 (Requirement R6 & Acceptance Criteria):
1. **Chapter Leader Aggregated Multi-Center Dashboard Metrics**:
   - Ensure the Chapter Leader dashboard API route (`/api/dashboard` or similar) and UI (`src/components/AdminView.tsx` / dashboard pages) display per-center breakdown metrics:
     - Active volunteer count per center
     - Attendance rate (last 4 sessions) per center
     - At-risk volunteer count (`HIGH` churn risk) per center
     - Total verified volunteer hours across the entire chapter
2. **At-Risk Watchlist**:
   - Ensure volunteers identified with `HIGH` churn risk (using Python ML model predictions or equivalent metric calculations) appear in a dedicated Watchlist table/section.
   - Include specific recommended coordinator actions for each at-risk volunteer (e.g. "Schedule 1-on-1 check-in", "Assign buddy mentor", "Review RSVP response latency").
3. **Automated Verification Script**:
   - Create and run an automated test script (`test_milestone5_verification.ts`) that calls `/api/dashboard` and verifies the JSON output structure and UI rendering logic.

### MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Verification & Hand-off
- Document all build and test execution results.
- Write your final handoff report to `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\worker_m5_gen2\handoff.md`.
- Send a `send_message` to your parent (`8512b0dd-0e25-4f55-a1be-cb59b44702cc`) summarizing results and path to handoff report.
