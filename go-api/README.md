# Go Core API Microservice (`go-api`)

Microservice for Volunteer-OS high-performance volunteer management, built in Go with standard library `net/http` and pure Go SQLite driver `modernc.org/sqlite`.

## Features & Endpoints

- **`GET /health`**: Health check endpoint returning `{"status": "ok"}` within 500ms.
- **`POST /volunteers`**: Accepts JSON payload `{ "name": "...", "email": "...", "phone": "...", "whatsappPhone": "...", "role": "...", "status": "...", "centerId": "..." }`, generates ID starting with `vol_`, inserts into SQLite database `prisma/dev.db`, and returns the created volunteer JSON object.
- **`GET /volunteers/:id`**: Retrieves volunteer record from database by ID.
- **`GET /volunteers`**: Retrieves list of all volunteer records from database.
- **`GET /volunteers/export`**: Queries `Volunteer` table joined with `Center` table and streams a CSV response (`Content-Type: text/csv`) with header:
  `Name, Email, Phone, Role, Status, TotalHours, Center`

## Architecture & Database

- **Database**: SQLite `prisma/dev.db` (Prisma schema shared with Next.js / Python apps).
- **Driver**: `modernc.org/sqlite` (CGO-free pure Go driver for cross-platform portability without GCC required).
- **Routing**: `net/http` standard library router.

## Setup & Running

```bash
# Navigate to go-api directory
cd go-api

# Build binary
go build -o go-api.exe main.go

# Run microservice
./go-api.exe
```

By default, server starts on port `8080` (customizable via `PORT` environment variable) and connects to `prisma/dev.db` (customizable via `DB_PATH` environment variable).

## Testing

### Go Unit Tests
```bash
go test -v ./...
```

### Integration Test Script
```bash
python test_go_api.py
```
