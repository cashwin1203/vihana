## 2026-07-25T00:42:24Z
You are Implementer M2. Your working directory is `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\implementer_m2`.
Project root: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os`

DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Task:
Build the Go Core API Microservice in a `go-api/` directory under project root `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\go-api`.

Requirements & Acceptance Criteria:
1. Initialize Go module (e.g. `go mod init volunteer-os/go-api`). Use Gin, Chi, or net/http router, connecting to SQLite database `prisma/dev.db` (using CGO-free `modernc.org/sqlite` or `github.com/mattn/go-sqlite3` or standard driver).
2. Endpoints:
   - `GET /health`: Returns JSON `{"status": "ok"}` within 500ms.
   - `POST /volunteers`: Accepts JSON payload `{ "name": "...", "email": "...", "phone": "...", "whatsappPhone": "...", "role": "...", "status": "...", "centerId": "..." }`, generates `id` (e.g. `vol_...` or cuid/uuid), inserts record into `Volunteer` table in `prisma/dev.db`, and returns the created volunteer JSON object.
   - `GET /volunteers/:id`: Retrieves volunteer record from `Volunteer` table by `id`.
   - `GET /volunteers`: Retrieves list of volunteers from database.
   - `GET /volunteers/export`: Queries `Volunteer` table (joined with `Center` table for center name), and returns a CSV response (`Content-Type: text/csv`) with exact header line:
     `Name, Email, Phone, Role, Status, TotalHours, Center`
     followed by data rows.
3. Verification:
   - Compile or run the Go service (e.g. `go build` or `go run main.go`).
   - Create a test script (e.g. `go-api/test_go_api.py` or Go unit tests) that tests:
     - `GET /health` -> `status == "ok"`
     - `POST /volunteers` -> creates record
     - `GET /volunteers/:id` -> returns created record
     - `GET /volunteers/export` -> returns valid CSV starting with header `Name, Email, Phone, Role, Status, TotalHours, Center`.
4. Documentation & Handoff:
   - Write full details in `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\implementer_m2\handoff.md`.
   - Send message to parent (`d900bdcd-fc29-418a-9bb4-bbb3b81aa5cf`) reporting completion with test results.
