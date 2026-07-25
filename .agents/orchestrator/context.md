# Orchestrator Context Recovery & Reference

## Project Metadata
- Project: NGO Volunteer Management Platform (U&I India - Vihana Center, Bangalore)
- Root Directory: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os`
- Working Directory: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\orchestrator`
- User Request File: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\ORIGINAL_REQUEST.md`

## Key Architecture & Technology Stack
- Next.js 14 (App Router) frontend with glassmorphism UI
- Python FastAPI microservice (`python/`) with `churn_model.py` and `voice_processor.py`
- Go microservice (`go-api/`) for core REST operations
- Prisma ORM (`prisma/schema.prisma`) with SQLite database (`prisma/dev.db`)
- Security (`src/lib/security.ts`): HMAC-SHA256 signature verification, PII masking, audit logging

## Workflow Protocol & Rules
- Dispatch-only orchestrator (never edit source code directly, never run builds directly).
- Every spawned subagent must have its own directory under `.agents/<agent_name>/`.
- Hard veto on forensic audit failure.
