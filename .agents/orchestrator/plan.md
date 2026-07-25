# NGO Volunteer Management Platform - Master Execution Plan

## Objectives
Deliver a fully functioning, production-ready NGO Volunteer Management Platform for U&I India (Vihana Center, Bangalore) fulfilling all acceptance criteria across Go Core API, Meta WhatsApp Cloud API Integration, WhatsApp Volunteer Identity & RBAC, Python ML Attrition Engine, Volunteer Roster & Attendance Records, Multi-Center Chapter Dashboard, Emergency Session Cancellation, and India DPDP Act 2023 Compliance.

## Milestone Plan

### Milestone 0: Exploration & Architecture Blueprinting
- **Goal**: Read existing codebase, analyze Prisma schema, Next.js routes, Python FastAPI setup, security utils, and seed data.
- **Worker**: Explorer subagent (`teamwork_preview_explorer`)
- **Outputs**: Comprehensive architecture report in `.agents/explorer_m0/analysis.md`

### Milestone 1: Python ML Attrition Engine & API Extensions (R4)
- **Goal**: Implement `/predict-churn` and `/batch-predict` endpoints in FastAPI (`python/main.py`), utilizing `churn_model.py`.
- **Worker**: Implementer (`teamwork_preview_worker`)
- **Reviewer**: Reviewer (`teamwork_preview_reviewer`)
- **Challenger**: Challenger (`teamwork_preview_challenger`)
- **Auditor**: Forensic Auditor (`teamwork_preview_auditor`)

### Milestone 2: Go Core API Microservice (R1)
- **Goal**: Build standalone Go service in `go-api/` exposing `GET /health`, `POST /volunteers`, `GET /volunteers/:id`, `GET /volunteers/export`.
- **Worker**: Implementer (`teamwork_preview_worker`)
- **Reviewer**: Reviewer (`teamwork_preview_reviewer`)
- **Challenger**: Challenger (`teamwork_preview_challenger`)
- **Auditor**: Forensic Auditor (`teamwork_preview_auditor`)

### Milestone 3: Meta WhatsApp Cloud API Webhook Integration & Simulator Fallback (R2, R3)
- **Goal**: Implement `/api/webhooks/whatsapp` handling subscription verification and HMAC-SHA256 signature checking, RSVP/check-in processing, phone lookup auth, fallback to simulator.
- **Worker**: Implementer (`teamwork_preview_worker`)
- **Reviewer**: Reviewer (`teamwork_preview_reviewer`)
- **Challenger**: Challenger (`teamwork_preview_challenger`)
- **Auditor**: Forensic Auditor (`teamwork_preview_auditor`)

### Milestone 4: Volunteer Roster, Attendance, Emergency Cancellation & DPDP Compliance (R3, R5, R7, R8)
- **Goal**: Implement deactivation, manual check-in override (+3.0 hours), emergency session cancellation + broadcast, PII phone masking on `GET /api/volunteers`, AuditLog records for admin actions, student locus codes.
- **Worker**: Implementer (`teamwork_preview_worker`)
- **Reviewer**: Reviewer (`teamwork_preview_reviewer`)
- **Challenger**: Challenger (`teamwork_preview_challenger`)
- **Auditor**: Forensic Auditor (`teamwork_preview_auditor`)

### Milestone 5: Multi-Center Chapter Dashboard & Watchlist (R6)
- **Goal**: Build Chapter Leader UI with per-center metrics (volunteers, attendance rate last 4 sessions, at-risk count, total hours), and At-risk Watchlist with recommended coordinator actions.
- **Worker**: Implementer (`teamwork_preview_worker`)
- **Reviewer**: Reviewer (`teamwork_preview_reviewer`)
- **Challenger**: Challenger (`teamwork_preview_challenger`)
- **Auditor**: Forensic Auditor (`teamwork_preview_auditor`)

### Milestone 6: End-to-End Verification & Forensic Integrity Audit
- **Goal**: Execute full test harness across all acceptance criteria and obtain clean forensic auditor verification.
- **Worker**: Challenger + Auditor
