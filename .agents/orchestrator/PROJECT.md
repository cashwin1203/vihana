# Project: NGO Volunteer Management Platform (U&I India - Vihana Center, Bangalore)

## Architecture
- **Frontend / Fullstack**: Next.js 14 (App Router) glassmorphism dark-mode UI, Prisma ORM (SQLite DB `prisma/dev.db`), REST API routes (`src/app/api/`).
- **Python ML Microservice**: FastAPI service (`python/`) providing churn prediction and voice NLU.
- **Go Core API Microservice**: High-reliability Go microservice (`go-api/`) exposing REST endpoints for CRUD, attendance, CSV exports, health check.
- **Integrations**: Meta WhatsApp Cloud API (`/api/webhooks/whatsapp`) with HMAC-SHA256 verification and local in-app simulator fallback.
- **Security & Compliance**: Phone number PII masking, AuditLog database entries for administrative actions, India DPDP Act 2023 compliant anonymized student locus codes (e.g. Student VHN-01).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M0 | Exploration & Blueprint | Explore codebase, database schema, existing services, and document component contracts | None | DONE |
| M1 | Python ML Attrition Engine | Extend `python/` with `/predict-churn` and `/batch-predict` endpoints using `churn_model.py` | M0 | DONE |
| M2 | Go Core API Microservice | Implement `go-api/` microservice with REST endpoints for health, volunteer CRUD, attendance, and CSV export | M0 | DONE |
| M3 | WhatsApp Cloud API Integration | Webhook handler `GET/POST /api/webhooks/whatsapp` with HMAC verification, subscription challenge, simulator fallback | M0 | DONE |
| M4 | Volunteer Roster, Attendance & Compliance | Next.js API & UI for RBAC, Deactivation, Manual check-in override, Emergency session cancellation, PII masking, AuditLog | M1, M2, M3 | DONE |
| M5 | Multi-Center Chapter Dashboard | Chapter Leader dashboard showing multi-center metrics, attendance rate, at-risk watchlist with recommended actions | M4 | DONE |
| M6 | End-to-End Verification & Audit | Comprehensive test verification suite across all ACs, end-to-end user workflows, and Forensic Integrity Audit | M1–M5 | DONE |

## Interface Contracts
### Go API Microservice (`go-api/`)
- `GET /health` -> `200 OK {"status": "ok"}`
- `POST /volunteers` -> `201 Created` / `200 OK` (creates record, returns Volunteer JSON)
- `GET /volunteers/:id` -> `200 OK` (returns Volunteer JSON)
- `GET /volunteers/export` -> `200 OK` (content-type: text/csv, headers: Name, Email, Phone, Role, Status, TotalHours, Center)

### Python ML Microservice (`python/`)
- `POST /predict-churn` -> input `{attendance_rate, rsvp_latency_hours, consecutive_absences, months_active, backup_frequency}`, returns `{churn_probability, risk_level, primary_risk_factor, recommended_action}`
- `POST /batch-predict` -> input `[{...}]` array of volunteer metrics, returns array of risk assessments

### Meta WhatsApp Webhook (`/api/webhooks/whatsapp`)
- `GET /api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=...&hub.challenge=test123` -> returns `test123`
- `POST /api/webhooks/whatsapp` -> HMAC-SHA256 signature verification, processes actions (`RSVP_ATTENDING`, etc.), returns confirmation reply and updates database.
