# Original User Request

## 2026-07-24T18:50:12Z

<USER_REQUEST>
Build a production-grade NGO volunteer management platform for U&I India (Vihana Center, Bangalore) that automates WhatsApp-based attendance collection, maintains authoritative volunteer records, predicts volunteer attrition using ML, and provides dashboards for three roles: Chapter Leader, Center Coordinator, and Field Volunteer.

Working directory: C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os
Integrity mode: demo

---

## Context

The existing codebase at this working directory contains:
- A Next.js 14 (App Router) frontend with glassmorphism dark-mode UI
- A Python FastAPI microservice (`python/`) with churn prediction (`churn_model.py`) and voice NLU (`voice_processor.py`)
- A Prisma ORM schema with models: Organization, City, Center, Volunteer, Session, VolunteerAttendance, Student, AuditLog
- Seed data: Gomesh (Field Volunteer), Ashwin C (Center Coordinator, Vihana Center), Navin D (Chapter Leader)
- Security utilities: HMAC-SHA256 webhook verification, PII masking, audit logging (`src/lib/security.ts`)

Build on top of this existing codebase. Do not break any existing functionality.

---

## Requirements

### R1. Go Core API Microservice
Introduce a new Go microservice (in a `go-api/` subdirectory) that handles high-reliability operations:
- Volunteer CRUD (create, read, update, deactivate — not delete)
- Session management and attendance record writes
- CSV export of volunteer rosters and attendance history
- Health check endpoint
The Go service must expose a REST API and be invocable from the existing Next.js app. Use pre-built libraries (e.g., Gin or Chi for routing, GORM or sqlx for database).

### R2. Meta WhatsApp Cloud API Integration
The system must send automated Friday 10 AM RSVP broadcasts to all active volunteers at a center via Meta WhatsApp Cloud API. Volunteers respond with quick-reply buttons (Attending / Absent / Backup). On Saturday, a check-in confirmation message is sent. The webhook handler must verify HMAC-SHA256 signatures on all incoming messages. In environments where Meta credentials are not configured, fall back gracefully to the existing in-app WhatsApp Simulator.

### R3. WhatsApp-Based Volunteer Identity
Volunteers must be identifiable and authenticated by their WhatsApp phone number. When a volunteer interacts with the WhatsApp bot (RSVP, check-in, notes), the system looks them up by `whatsappPhone` and records the action against their profile. No separate username/password login is required for volunteers. The web dashboard for Coordinators and Chapter Leaders must enforce role-based access control (CHAPTER_LEADER > COORDINATOR > VOLUNTEER) using a lightweight session mechanism.

### R4. Python ML Attrition Engine
The existing Python FastAPI microservice must be extended with:
- A `/predict-churn` endpoint that accepts: `attendance_rate`, `rsvp_latency_hours`, `consecutive_absences`, `months_active`, `backup_frequency` — and returns: churn probability (0–100%), risk level (LOW / MEDIUM / HIGH), primary risk factor, and recommended coordinator action.
- A `/batch-predict` endpoint that accepts an array of volunteer records and returns risk scores for all of them in one call.
The churn model must use the existing logistic scoring classifier in `churn_model.py`.

### R5. Volunteer Roster & Attendance Records
The system must maintain an authoritative volunteer roster per center:
- Add, edit, and deactivate volunteers (deactivation preserves history)
- Record session attendance with RSVP status, check-in status, hours logged, and notes
- Allow coordinators to perform manual check-in overrides for volunteers present in person whose phone battery died or who had no mobile data
- CSV export of the complete volunteer roster and attendance history for any date range

### R6. Multi-Center Chapter Dashboard
The Chapter Leader view must display aggregated metrics across all centers:
- Active volunteer count per center
- Attendance rate (last 4 sessions) per center
- At-risk volunteer count (HIGH churn risk) per center
- Total verified volunteer hours across the chapter

### R7. Emergency Session Cancellation
The Center Coordinator must be able to cancel an upcoming session with one action. This cancellation must update the session record to CANCELLED and dispatch an emergency WhatsApp broadcast to all rostered volunteers for that session.

### R8. India DPDP Act 2023 Compliance
Student records must use anonymized locus codes (e.g., Student VHN-01) — no full names of minors stored in the database. All administrative actions (volunteer onboarding, holiday pause toggle, session cancellation, CSV export) must be recorded in the immutable AuditLog table.

---

## Acceptance Criteria

### Go API
- [ ] `GET /health` returns `{"status": "ok"}` within 500ms
- [ ] `POST /volunteers` successfully creates a volunteer record and it is retrievable via `GET /volunteers/:id`
- [ ] `GET /volunteers/export` returns a valid CSV with headers: Name, Email, Phone, Role, Status, TotalHours, Center

### WhatsApp Integration
- [ ] `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=test123` returns `test123`
- [ ] `POST /api/webhooks/whatsapp` with a valid HMAC-SHA256 signature and `action: RSVP_ATTENDING` returns a confirmation reply and updates the attendance record
- [ ] `POST /api/webhooks/whatsapp` with an invalid or missing signature returns HTTP 401

### Attrition ML Engine
- [ ] `POST /predict-churn` with `{attendance_rate: 0.45, rsvp_latency_hours: 20, consecutive_absences: 3, months_active: 2, backup_frequency: 0}` returns `risk_level: "HIGH"`
- [ ] `POST /batch-predict` with an array of 5 volunteer records returns 5 individual risk assessments

### Volunteer Management
- [ ] Deactivating a volunteer sets `status: INACTIVE` but preserves all historical attendance records
- [ ] Manual check-in override via coordinator dashboard updates `checkInStatus: PRESENT` and logs 3.0 hours for the target volunteer
- [ ] CSV export contains all attendance records for a specified center and date range

### Dashboard
- [ ] Chapter Leader view shows per-center breakdown: volunteer count, attendance rate, at-risk count, total hours
- [ ] At-risk volunteers (HIGH churn risk) appear in a watchlist with recommended coordinator actions

### Security & Compliance
- [ ] `GET /api/volunteers` does not expose raw phone numbers in the response — numbers must be masked (e.g., +91 ***** 43210)
- [ ] AuditLog table contains an entry for every administrative action (volunteer creation, session cancellation, CSV export, holiday pause toggle)
- [ ] No student record in the database contains a full personal name — only anonymized codes

---

## Technical Constraints

- The Go microservice should be placed in `go-api/` within the working directory.
- The Python ML microservice is in `python/` — extend it, do not replace it.
- The Next.js frontend in `src/` must remain functional — new backend services integrate with it via internal API calls or proxying.
- Database: SQLite (dev) via Prisma ORM — do not change the database engine.
- All secrets (Meta App Secret, Verify Token) must be read from environment variables — no hardcoded strings in production paths.
</USER_REQUEST>
