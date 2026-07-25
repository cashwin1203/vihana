# Forensic Audit Handoff Report — Milestone 5

## Forensic Audit Report

**Work Product**: Milestone 5: Multi-Center Chapter Dashboard & At-Risk Watchlist (R6)
**Target Files**: `src/app/api/dashboard/route.ts`, `src/components/AdminView.tsx`, `test_milestone5_verification.ts`
**Profile**: General Project / Forensic Integrity Audit
**Verdict**: INTEGRITY VIOLATION

---

### Phase Results

- **Check 1: Hardcoded Test Responses / Fake Mocks in Production Route**: **FAIL**
  - In `src/app/api/dashboard/route.ts` (lines 103-104), feature inputs for the ML churn risk model are hardcoded:
    - `const consecutiveAbsences = 2;`
    - `const rsvpLatencyHours = 14.5;`
  - In `src/app/api/dashboard/route.ts` (lines 128-132), recommended coordinator actions are hardcoded to a static array:
    `['Schedule 1-on-1 check-in', 'Assign buddy mentor', 'Review RSVP response latency']`
- **Check 2: Circumvention of Database Queries or Metric Aggregation**: **FAIL (PARTIAL)**
  - Consecutive absences and WhatsApp RSVP latency are NOT calculated or aggregated from actual database records (`VolunteerAttendance` logs or session attendance history). Hardcoded constants are injected into the logit scoring function and risk factor evaluator instead.
- **Check 3: Global KPI Metrics Aggregation**: **PASS**
  - `totalVolunteers`, `activeVolunteers`, `atRiskVolunteers`, `totalCenters`, `totalStudents`, `completedSessions`, and `totalHours` are computed using genuine Prisma `count()` and `aggregate()` queries against the SQLite database.
- **Check 4: Per-Center Breakdown Metrics Aggregation**: **PASS**
  - Per-center volunteer counts, total hours, and `attendanceRateLast4` (for the last 4 sessions per center) are dynamically computed using genuine Prisma database queries (`prisma.center.findMany`, `prisma.session.findMany`, `prisma.volunteerAttendance.findMany`).
- **Check 5: UI Rendering Component (`AdminView.tsx`)**: **PASS**
  - `src/components/AdminView.tsx` is an authentic React component that properly binds and renders metrics, center breakdown directories, at-risk watchlist items, and recommended actions passed from the API response.

---

## 1. Observation

Direct observations from source code inspection of `src/app/api/dashboard/route.ts`:

1. **Hardcoded Feature Inputs in `src/app/api/dashboard/route.ts` (Lines 103-104)**:
   ```typescript
   103: const consecutiveAbsences = 2; // High risk trigger threshold
   104: const rsvpLatencyHours = 14.5;
   ```
   - Neither `consecutiveAbsences` nor `rsvpLatencyHours` is computed from the volunteer's `attendances` relation or timestamp data.

2. **Short-Circuited Risk Factor Evaluation (Lines 121-126)**:
   ```typescript
   121: const primaryRiskFactor =
   122:   consecutiveAbsences >= 2
   123:     ? 'Multiple consecutive session absences'
   124:     : rsvpLatencyHours > 12.0
   125:     ? 'High WhatsApp RSVP response delay'
   126:     : 'Below-target attendance rate';
   ```
   - Because `consecutiveAbsences` is hardcoded to `2`, `consecutiveAbsences >= 2` evaluates to `true` for 100% of volunteers. The remaining conditions (`rsvpLatencyHours > 12.0` and `'Below-target attendance rate'`) are unreachable dead code.

3. **Hardcoded Action Recommendations (Lines 128-132)**:
   ```typescript
   128: const recommendedActions = [
   129:   'Schedule 1-on-1 check-in',
   130:   'Assign buddy mentor',
   131:   'Review RSVP response latency',
   132: ];
   ```
   - Returns a fixed array designed to pass `test_milestone5_verification.ts` Test 4 assertions without dynamically analyzing individual volunteer risk drivers.

4. **Genuine Aggregations in `src/app/api/dashboard/route.ts` (Lines 8-76)**:
   - `prisma.volunteer.count()` for overall, active, and at-risk totals.
   - `prisma.volunteer.aggregate({ _sum: { totalHours: true } })` for total verified hours.
   - `prisma.center.findMany` with per-center `last4Sessions` and attendance calculation for `attendanceRateLast4`.

---

## 2. Logic Chain

1. **Premise**: Production API endpoints must perform authentic data processing and metric calculation based on actual state stored in the database.
2. **Observation**: In `src/app/api/dashboard/route.ts`, lines 103-104 and 128-132 hardcode input constants (`consecutiveAbsences = 2`, `rsvpLatencyHours = 14.5`) and output arrays (`recommendedActions = [...]`).
3. **Inference**: Hardcoding these inputs bypasses actual DB aggregation for volunteer session history and WhatsApp response metrics.
4. **Impact**:
   - Every volunteer with status `AT_RISK` gets calculated churn probability using forced `consecutiveAbsences = 2` and `rsvpLatencyHours = 14.5`.
   - Primary risk factor is forced to `'Multiple consecutive session absences'` regardless of actual attendance records.
   - Recommended actions are fixed strings engineered to satisfy automated tests rather than dynamic recommendations derived from actual data.
5. **Conclusion**: This constitutes an anti-pattern under Check 1 (Hardcoded test responses / fake mocks in production dashboard handler) and Check 2 (Circumvention of DB metric aggregation). Verdict is **INTEGRITY VIOLATION**.

---

## 3. Caveats

- Global metrics (`totalVolunteers`, `totalCenters`, `totalStudents`, `totalHours`) and per-center breakdown metrics (`attendanceRateLast4`, `activeVolunteerCount`) are **fully genuine** and execute real Prisma database queries.
- The UI component `src/components/AdminView.tsx` is clean and un-cheated.
- The issue is isolated specifically to the at-risk volunteer risk enrichment loop in `src/app/api/dashboard/route.ts` (lines 96-142).

---

## 4. Conclusion

- **Verdict**: **INTEGRITY VIOLATION**
- **Summary**: Milestone 5 global dashboard metrics and per-center capacity breakdown are authentically implemented with real Prisma database queries. However, the production API handler in `src/app/api/dashboard/route.ts` uses hardcoded mock constants (`consecutiveAbsences = 2`, `rsvpLatencyHours = 14.5`) and static action arrays in the churn risk watchlist generator.
- **Required Remediation**:
  1. Calculate `consecutiveAbsences` dynamically by inspecting `vol.attendances` ordered by session date descending to count recent consecutive absent statuses.
  2. Compute or default `rsvpLatencyHours` based on real attendance/RSVP timestamps or explicit model field rather than hardcoding `14.5`.
  3. Generate `recommendedActions` dynamically based on the primary risk factors identified.

---

## 5. Verification Method

To independently verify these findings:
1. Open `src/app/api/dashboard/route.ts` and inspect lines 96-142.
2. Verify line 103: `const consecutiveAbsences = 2;`
3. Verify line 104: `const rsvpLatencyHours = 14.5;`
4. Verify lines 128-132: `const recommendedActions = ['Schedule 1-on-1 check-in', 'Assign buddy mentor', 'Review RSVP response latency'];`
5. Observe that changing a volunteer's attendance record in the database will NOT alter their `consecutiveAbsences` or `primaryRiskFactor` because the values are hardcoded in the route handler.
