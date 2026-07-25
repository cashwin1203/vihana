package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("Failed to open in-memory db: %v", err)
	}

	createTables := `
	CREATE TABLE Center (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL
	);
	CREATE TABLE Volunteer (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		email TEXT UNIQUE NOT NULL,
		phone TEXT NOT NULL,
		whatsappPhone TEXT,
		role TEXT NOT NULL DEFAULT 'VOLUNTEER',
		status TEXT NOT NULL DEFAULT 'ACTIVE',
		skills TEXT NOT NULL DEFAULT '',
		joinedDate TEXT NOT NULL,
		totalHours REAL NOT NULL DEFAULT 0,
		centerId TEXT,
		createdAt TEXT NOT NULL,
		updatedAt TEXT NOT NULL
	);
	`
	if _, err := db.Exec(createTables); err != nil {
		t.Fatalf("Failed to create test tables: %v", err)
	}

	// Insert test center
	if _, err := db.Exec(`INSERT INTO Center (id, name) VALUES ('center_1', 'Main Center')`); err != nil {
		t.Fatalf("Failed to insert test center: %v", err)
	}

	return db
}

func TestHealthEndpoint(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	app := &App{DB: db}

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	app.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK, got %d", rec.Code)
	}

	var res map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("Failed to parse JSON response: %v", err)
	}

	if res["status"] != "ok" {
		t.Fatalf("Expected status 'ok', got '%s'", res["status"])
	}
}

func TestCreateAndGetVolunteer(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	app := &App{DB: db}

	payload := `{
		"name": "Test Volunteer",
		"email": "test@example.com",
		"phone": "+123456789",
		"whatsappPhone": "+123456789",
		"role": "VOLUNTEER",
		"status": "ACTIVE",
		"centerId": "center_1",
		"skills": "Go, Python"
	}`

	req := httptest.NewRequest(http.MethodPost, "/volunteers", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	app.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("Expected status 201 Created, got %d. Body: %s", rec.Code, rec.Body.String())
	}

	var created Volunteer
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil {
		t.Fatalf("Failed to unmarshal created volunteer: %v", err)
	}

	if created.ID == "" || !strings.HasPrefix(created.ID, "vol_") {
		t.Fatalf("Expected ID starting with 'vol_', got '%s'", created.ID)
	}
	if created.Name != "Test Volunteer" {
		t.Fatalf("Expected name 'Test Volunteer', got '%s'", created.Name)
	}

	// Test GET /volunteers/:id
	reqGet := httptest.NewRequest(http.MethodGet, "/volunteers/"+created.ID, nil)
	recGet := httptest.NewRecorder()

	app.Routes().ServeHTTP(recGet, reqGet)

	if recGet.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK for GET volunteer by id, got %d", recGet.Code)
	}

	var retrieved Volunteer
	if err := json.Unmarshal(recGet.Body.Bytes(), &retrieved); err != nil {
		t.Fatalf("Failed to unmarshal retrieved volunteer: %v", err)
	}

	if retrieved.ID != created.ID || retrieved.Email != created.Email {
		t.Fatalf("Retrieved volunteer does not match created volunteer")
	}

	// Test GET /volunteers
	reqList := httptest.NewRequest(http.MethodGet, "/volunteers", nil)
	recList := httptest.NewRecorder()

	app.Routes().ServeHTTP(recList, reqList)

	if recList.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK for GET /volunteers, got %d", recList.Code)
	}

	var list []Volunteer
	if err := json.Unmarshal(recList.Body.Bytes(), &list); err != nil {
		t.Fatalf("Failed to unmarshal volunteers list: %v", err)
	}

	if len(list) != 1 {
		t.Fatalf("Expected 1 volunteer in list, got %d", len(list))
	}
}

func TestExportVolunteers(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	app := &App{DB: db}

	// Insert volunteer directly into DB
	_, err := db.Exec(`
		INSERT INTO Volunteer (id, name, email, phone, whatsappPhone, role, status, skills, joinedDate, totalHours, centerId, createdAt, updatedAt)
		VALUES ('vol_100', 'Alice Smith', 'alice@example.com', '123', '123', 'VOLUNTEER', 'ACTIVE', 'Math', '2026-01-01T00:00:00Z', 15.5, 'center_1', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')
	`)
	if err != nil {
		t.Fatalf("Failed to seed volunteer: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/volunteers/export", nil)
	rec := httptest.NewRecorder()

	app.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("Expected status 200 OK for export, got %d", rec.Code)
	}

	contentType := rec.Header().Get("Content-Type")
	if !strings.HasPrefix(contentType, "text/csv") {
		t.Fatalf("Expected Content-Type text/csv, got %s", contentType)
	}

	csvText := rec.Body.String()
	lines := strings.Split(strings.TrimSpace(csvText), "\n")
	if len(lines) < 2 {
		t.Fatalf("Expected at least 2 lines in CSV output, got %d", len(lines))
	}

	expectedHeader := "Name, Email, Phone, Role, Status, TotalHours, Center"
	if strings.TrimSpace(lines[0]) != expectedHeader {
		t.Fatalf("Expected header '%s', got '%s'", expectedHeader, strings.TrimSpace(lines[0]))
	}

	if !strings.Contains(lines[1], "Alice Smith") || !strings.Contains(lines[1], "Main Center") {
		t.Fatalf("Data line does not contain expected values: %s", lines[1])
	}
}
