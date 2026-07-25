# Volunteer OS — System Architecture & Technical Investigation Report (M0)

**Author:** Explorer M0  
**Date:** July 25, 2026  
**Project Root:** `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os`  
**Working Directory:** `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\explorer_m0`  

---

## Executive Summary

Volunteer OS is an operational management platform and WhatsApp conversational engine for education-focused NGOs (inspired by U&I India). It automates weekend roster RSVPs, field check-ins, educational session logging, student attendance, and volunteer churn retention analytics across multi-center urban chapters.

This report documents the thorough investigation of the existing codebase (`prisma/`, `src/`, `python/`, package files) and provides implementation blueprints for requirements **R1 through R8**.

---

## 1. Codebase Analysis & Evidence Inventory

### 1.1 Data Layer & Prisma Schema (`prisma/schema.prisma` & `prisma/seed.ts`)
- **Database Engine:** SQLite (`prisma/dev.db`) configured via Prisma Client v5.19.1.
- **Core Entities & Relationships:**
  - `Organization` (1) ── (N) `City` (1) ── (N) `Center`
  - `Center` (1) ── (N) `Volunteer`
  - `Center` (1) ── (N) `Student`
  - `Center` (1) ── (N) `Session`
  - `Session` (N) ── (N) `Volunteer` via join table `VolunteerAttendance`
  - `Session` (N) ── (N) `Student` via join table `StudentAttendance`
  - `AuditLog`: Standalone immutable security and compliance log.
- **Key Entity Constraints & Schema Details:**
  - `Volunteer`: Unique email (`@unique`), fields `phone`, `whatsappPhone`, `role` (`CHAPTER_LEADER`, `COORDINATOR`, `VOLUNTEER`), `status` (`ACTIVE`, `AT_RISK`, `INACTIVE`), `skills`, `totalHours` (Float), `centerId`. Indexed on `[centerId, status]` and `[role]`.
  - `Student`: DPDP Act 2023 compliant model. Uses `studentCode` (e.g. `Student VHN-01`) instead of real minor names or contact info. Indexed on `[centerId]`.
  - `Session`: `sessionDate`, `startTime`, `endTime`, `status` (`UPCOMING`, `COMPLETED`, `CANCELLED`), `topicCovered`, `activitiesCompleted`, `challengesFaced`. Indexed on `[centerId, status]` and `[sessionDate]`.
  - `VolunteerAttendance`: `rsvpStatus` (`PENDING`, `ATTENDING`, `ABSENT`, `BACKUP`), `checkInStatus` (`PENDING`, `PRESENT`, `ABSENT`, `LATE`), `botState` (`IDLE`, `AWAITING_RSVP`, `AWAITING_CHECKIN`, `AWAITING_NOTES`), `hoursLogged` (Float). Unique constraint on `[sessionId, volunteerId]`.
  - `StudentAttendance`: `status` (`PRESENT`, `ABSENT`, `NEEDS_HELP`), `notes`. Unique constraint on `[sessionId, studentId]`.
  - `AuditLog`: `actorId`, `actorName`, `action`, `details` (JSON string), `createdAt`.
- **Seed Inventory (`prisma/seed.ts`):**
  - NGO: "U&I Trust", Cities: "Bangalore", "Chennai".
  - Centers: Vihana Center (Whitefield, Sat 2:30-5:30 PM), Mala Learning Center (Koramangala, Sat 10 AM-1 PM), Ramamurthynagar Center (Sun 2-5 PM).
  - Roles Seeded: Navin D & Sathya (`CHAPTER_LEADER`), Ashwin C, Nishant, Rohit (`COORDINATOR`), Gomesh, Priya, Sneha, Arjun (`VOLUNTEER`).
  - 12 Anonymized Students (`Student VHN-01` to `Student VHN-12`).
  - Past completed sessions & upcoming weekend session with pre-populated attendances.

### 1.2 Web Application Framework & Security Layer (`src/`)
- **Framework:** Next.js 14.2.8 (App Router), React 18.3.1, TypeScript 5.5.4, Lucide React icons.
- **Security implementation (`src/lib/security.ts`):**
  1. `verifyWhatsAppSignature`: Verifies Meta Webhook HMAC-SHA256 signatures (`x-hub-signature-256`) against `process.env.META_APP_SECRET` using `crypto.createHmac` and `crypto.timingSafeEqual`. Bypasses verification only in non-production environments when secret/header is missing.
  2. `maskVolunteerPII`: Redacts volunteer contact details for public API responses (e.g. `+91 98*****210` and `as****@uandi.org`).
  3. `sanitizeInputText`: Strips HTML/script tags (`<`, `>`) and caps max string length (default 1000 chars) to prevent prompt injection and XSS.
  4. `logSecurityAudit`: Asynchronous logger creating immutable `AuditLog` records for security and operational actions.
- **API Routes Review:**
  - `GET/POST/PATCH /api/volunteers`: Volunteer listing (with PII masking option), onboarding, and status/role updates.
  - `POST /api/volunteers/import`: Bulk CSV import route, parsing CSV rows and performing `upsert` on email.
  - `PATCH /api/attendance`: Updates volunteer or student attendance and auto-aggregates present volunteer total hours.
  - `GET/POST/PATCH /api/centers`: Center operational directory and `isPausedForHoliday` toggle.
  - `GET /api/dashboard`: Aggregates metrics, centers, recent sessions, and retention risk list.
  - `GET/POST /api/webhooks/whatsapp`: Webhook verification challenge and conversational message handler.
  - `POST /api/whatsapp/send`: Outbound WhatsApp broadcast dispatcher with holiday pause filter and emergency cancel capability.
  - `POST /api/ai-summary`: Donor impact report generator.
  - `GET/POST /api/launch-activities`: Interactive de-stress games library and variation generator.

### 1.3 Python ML & NLU Microservice (`python/`)
- **Dependencies (`python/requirements.txt`):** `fastapi==0.110.0`, `uvicorn==0.28.0`, `pydantic==2.6.4`, `pandas==2.2.1`, `scikit-learn==1.4.1.post1`, `numpy==1.26.4`.
- **Churn Predictor (`python/churn_model.py`):**
  - Evaluates volunteer churn risk via weighted logistic scoring algorithm (or Scikit-Learn `RandomForestClassifier` fallback).
  - Features: `attendance_rate`, `rsvp_latency_hours`, `consecutive_absences`, `months_active`, `backup_frequency`.
  - Output: `churn_probability` (%), `risk_level` (`HIGH`, `MEDIUM`, `LOW`), `primary_risk_factor`, `recommended_action`.
- **Voice NLU Processor (`python/voice_processor.py`):**
  - Parses voice note transcripts to classify subject (`Math`, `English`, `Science`), extract taught topics, flag students needing help, and calculate sentiment (`CONCERNED`, `POSITIVE`, `NEUTRAL`).
- **FastAPI Application (`python/main.py`):**
  - Exposes `GET /health`, `POST /predict-churn`, `POST /process-voice-note`. Runs on port 8000.

---

## 2. Technical Implementation Blueprints (R1 - R8)

### Blueprint R1: Go Core API Microservice (`go-api/`)
- **Objective:** High-performance core API service written in Go using Gin or Chi router, connecting directly to SQLite database (`prisma/dev.db`).
- **Directory Layout:**
  ```
  go-api/
  ├── main.go               # Entry point & Chi/Gin router initialization
  ├── go.mod                # Go module definition
  ├── go.sum
  ├── config/               # Environment & database configuration
  │   └── config.go
  ├── db/                   # Database connection (modernc.org/sqlite)
  │   └── database.go
  ├── handlers/             # REST handler functions
  │   ├── health.go         # GET /health
  │   ├── volunteers.go     # REST CRUD endpoints
  │   └── export.go         # GET /api/v1/volunteers/export (CSV Stream)
  ├── models/               # Struct definitions matching Prisma schema
  │   ├── volunteer.go
  │   └── audit_log.go
  └── middleware/           # CORS, Logging, Auth headers
      └── logger.go
  ```
- **Database Connectivity:** Direct SQLite connection sharing `prisma/dev.db` using `github.com/mattn/go-sqlite3` or CGO-free `modernc.org/sqlite`.
- **Endpoints Specification:**
  - `GET /health`: Returns JSON `{"status":"healthy","service":"volunteer-os-go-api","database":"connected","timestamp":"..."}`.
  - `GET /api/v1/volunteers`: Query params `center_id`, `status`, `role`, `mask`. Returns volunteer array.
  - `POST /api/v1/volunteers`: Accepts JSON payload, inserts into `Volunteer` table, writes to `AuditLog`.
  - `PUT /api/v1/volunteers/:id`: Updates fields, recalculates totals if required, logs audit entry.
  - `DELETE /api/v1/volunteers/:id`: Sets volunteer status to `INACTIVE`.
  - `GET /api/v1/volunteers/export`: Streams CSV file (`Content-Type: text/csv`) with headers: `Volunteer ID, Name, Email, Phone, Role, Status, Skills, Total Hours, Center ID`.

---

### Blueprint R2: Meta WhatsApp Cloud API Webhook Integration (`/api/webhooks/whatsapp`)
- **Webhook Integration Architecture:**
  ```
  [ Meta WhatsApp Cloud API / Web Simulator ]
                      │
                      ▼
        HTTP GET/POST /api/webhooks/whatsapp
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
  [ GET Challenge ]          [ POST Webhook Payload ]
  Verify hub.mode &          1. HMAC-SHA256 Signature Verification
  hub.verify_token           2. Simulator Payload Normalization
        │                    3. Action Dispatcher
        ▼                           │
  Return hub.challenge      ┌───────┴───────┬───────────────┬───────────────┐
                            ▼               ▼               ▼               ▼
                       RSVP ATTEND     RSVP ABSENT      CHECK-IN        LOG NOTES /
                       (Update DB)    (Trigger Standby) (+3.0 hrs)       TEXT COMMANDS
  ```
- **Verification Challenge (`GET`):** Checks `hub.mode === 'subscribe'` and `hub.verify_token === process.env.META_WA_VERIFY_TOKEN` (defaulting to `'VOLUNTEER_OS_WA_TOKEN'`).
- **Signature Security (`POST`):** Validates `x-hub-signature-256` header against `process.env.META_APP_SECRET` using `verifyWhatsAppSignature()`. Returns `401 Unauthorized` on failure.
- **Dual Payload Normalization:** Standardizes payloads coming from either Meta WhatsApp Cloud API (nested `entry[0].changes[0].value.messages[0]`) or the in-app Web Simulator (`WhatsAppSimulatorModal.tsx`).
- **Action State Machine:**
  - `RSVP_ATTENDING` / `ACCEPT_BACKUP`: Sets `VolunteerAttendance.rsvpStatus = 'ATTENDING'`, clears `botState = 'IDLE'`.
  - `RSVP_ABSENT`: Sets `rsvpStatus = 'ABSENT'`, identifies next pending/backup volunteer in center, updates session standby flag, and logs audit event.
  - `CHECK_IN`: Sets `checkInStatus = 'PRESENT'`, credits `hoursLogged = 3.0`, updates `Volunteer.totalHours`, sets `botState = 'AWAITING_NOTES'`.
  - `LOG_NOTES` / Text: Handles text input or `/status` command.

---

### Blueprint R3: WhatsApp-Based Volunteer Identity & RBAC
- **Identity Resolution:**
  - Matches incoming WhatsApp `from` phone number against `Volunteer.whatsappPhone` or `Volunteer.phone`.
  - If phone number is unmapped, responds with: *"Sorry, your WhatsApp number (+91 XXXXX XXXXX) is not registered in Volunteer OS. Please contact your Chapter Leader."*
- **Role Hierarchy & Access Controls:**
  - `CHAPTER_LEADER`: Access to chapter-wide metrics, multi-center analytics, retention risk watchlist, system audit logs, and global overrides.
  - `COORDINATOR`: Access to center roster management, holiday pause toggle (`isPausedForHoliday`), session creation, manual check-in override (+3.0 hrs), emergency session cancellation, and CSV volunteer import.
  - `VOLUNTEER`: Access to personal Friday RSVP responses, field check-in (+3.0 hrs), logbook notes submission, personal hours history, and de-stress games.
- **WhatsApp Text Command Dispatcher:**
  - `/status`: Returns live roster breakdown (Attending / Total, Center Slot Time, Session status). Available to all roles.
  - `/pause [on|off]`: Toggles `isPausedForHoliday` for coordinator's center (Restricted to `COORDINATOR` & `CHAPTER_LEADER`).
  - `/cancel [reason]`: Cancels upcoming session and broadcasts emergency alert (Restricted to `COORDINATOR` & `CHAPTER_LEADER`).
  - `/roster`: Displays list of attending and absent volunteers for upcoming session (Restricted to `COORDINATOR` & `CHAPTER_LEADER`).

---

### Blueprint R4: Python ML Attrition Engine (`python/main.py`)
- **Existing Endpoints:** `GET /health`, `POST /predict-churn`, `POST /process-voice-note`.
- **New Batch Endpoint Blueprint (`POST /batch-predict`):**
  - **Pydantic Schema:**
    ```python
    class VolunteerChurnItem(BaseModel):
        volunteer_id: str
        attendance_rate: float
        rsvp_latency_hours: float
        consecutive_absences: int
        months_active: float
        backup_frequency: int

    class BatchChurnRequest(BaseModel):
        volunteers: List[VolunteerChurnItem]
    ```
  - **Processing Logic:** Iterates over volunteer items, invokes `VolunteerChurnPredictor.predict_risk()`, and compiles individual predictions along with aggregate summary stats (`total_evaluated`, `high_risk_count`, `medium_risk_count`, `average_churn_probability`).
  - **Integration:** Triggered via Next.js `/api/dashboard` or background worker to auto-flag volunteers meeting `churn_probability >= 60.0%` with status `'AT_RISK'` in Prisma DB.

---

### Blueprint R5: Volunteer Roster & Attendance Records
- **Roster Life Cycle:**
  - `ACTIVE` -> `AT_RISK` -> `INACTIVE`.
  - Inactive volunteers are excluded from automated Friday RSVP broadcasts and active roster scheduling.
- **Manual Check-In Override & Hours Aggregation:**
  - Route: `PATCH /api/attendance`.
  - When Coordinator manually sets `checkInStatus = 'PRESENT'`, system assigns `hoursLogged = 3.0` (or manual override amount).
  - Auto-recalculation: Instantly runs SQL sum query on `VolunteerAttendance` where `checkInStatus = 'PRESENT'` for that volunteer, updating `Volunteer.totalHours`.
- **CSV Export Endpoint:**
  - Route: `GET /api/volunteers/export` (Next.js or Go Core API).
  - Formats data into standard CSV: `Volunteer ID, Name, Email, Phone, Role, Status, Skills, Center Name, Total Hours Logged`.
  - Logs audit event `EXPORTS_VOLUNTEER_ROSTER_CSV`.

---

### Blueprint R6: Multi-Center Chapter Dashboard
- **Component & Architecture (`src/components/AdminView.tsx` & `/api/dashboard`):**
  - **Top KPI Cards:** Active Volunteers count & retention %, Total Hours Logged, Students Supported, Active Centers count.
  - **Multi-Center Directory Breakdown:** Cards for each center (`Vihana Center`, `Mala Learning Center`, `Ramamurthynagar Center`) detailing location, day/slot time, current volunteer count vs. target (`targetVolunteerCount`), and student count vs. target (`targetStudentCount`).
  - **Retention Risk Watchlist:** Interactive panel displaying `AT_RISK` volunteers, showing center, skills, consecutive absences, primary risk factor, and quick action buttons (`1-on-1 Check-in`, `Re-assign Center`, `Mark Inactive`).

---

### Blueprint R7: Emergency Session Cancellation
- **Workflow & Execution (`/api/whatsapp/send`):**
  - Payload: `{ "centerId": "...", "type": "EMERGENCY_CANCEL", "reason": "Heavy Rain / Center Flooding" }`.
  - Database Update: Finds upcoming session for center, updates `status = 'CANCELLED'`, sets `challengesFaced = "Cancelled: Heavy Rain / Center Flooding"`.
  - Outbound WhatsApp Broadcast: Sends emergency alert to all volunteers registered at that center:
    *"🚨 EMERGENCY ALERT: Session at Vihana Center has been CANCELLED (Heavy Rain / Center Flooding). Please do NOT report to center."*
  - Security Audit Logging: Writes `AuditLog` entry with action `'EMERGENCY_SESSION_CANCEL'`, `centerId`, `centerName`, and `reason`.

---

### Blueprint R8: India DPDP Act 2023 Compliance
- **Compliance Architecture:**
  - **Anonymized Student Identifiers:** Minor student records use synthetic locus codes (e.g. `Student VHN-01` to `Student VHN-12`) instead of storing real minor names, phone numbers, or addresses.
  - **PII Masking (`maskVolunteerPII`):** Obfuscates volunteer emails (`as****@uandi.org`) and phone numbers (`+91 98*****210`) when exporting data or rendering non-admin API views.
  - **Immutable Audit Logging (`AuditLog`):** Every sensitive action (volunteer onboarding, status change, CSV import, holiday pause toggle, emergency session cancellation, WhatsApp RSVP/Check-in) creates an immutable `AuditLog` entry recording `actorName`, `action`, and `details` JSON blob.

---

## 3. Summary Matrix of Requirements & Implementations

| Req | Title | Key Components / Files | Status / Blueprint Target |
| :--- | :--- | :--- | :--- |
| **R1** | Go Core API Microservice | `go-api/` (Chi/Gin, SQLite `dev.db`, REST CRUD, CSV export) | Blueprint Complete |
| **R2** | Meta WhatsApp Webhook Integration | `/api/webhooks/whatsapp`, `src/lib/security.ts`, Simulator Modal | Code Explored & Blueprint Complete |
| **R3** | WhatsApp Volunteer Identity & RBAC | `Volunteer.role`, Phone Resolution, Dynamic Command Dispatcher | Blueprint Complete |
| **R4** | Python ML Attrition Engine | `python/main.py`, `churn_model.py`, `/batch-predict` endpoint | Code Explored & Blueprint Complete |
| **R5** | Roster & Attendance Records | `/api/attendance`, `/api/volunteers/import`, Manual Check-In (+3.0 hrs) | Code Explored & Blueprint Complete |
| **R6** | Multi-Center Chapter Dashboard | `AdminView.tsx`, `/api/dashboard`, Center Breakdown & Risk Watchlist | Code Explored & Blueprint Complete |
| **R7** | Emergency Session Cancellation | `/api/whatsapp/send`, Emergency Broadcast, `AuditLog` | Code Explored & Blueprint Complete |
| **R8** | India DPDP Act 2023 Compliance | Anonymized `Student.studentCode`, `maskVolunteerPII`, `AuditLog` | Code Explored & Blueprint Complete |

---

## 4. Conclusion & Next Steps
The Volunteer OS architecture is thoroughly analyzed and ready for implementation. All requirements R1-R8 have concrete blueprints backed by codebase evidence. Subsequent milestones (M1 Go API, M2 Webhooks & RBAC, M3 ML Engine & Dashboard) can build directly on these specifications.
