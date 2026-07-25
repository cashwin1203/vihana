package main

import (
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

// Volunteer represents the JSON model returned by the API.
type Volunteer struct {
	ID            string  `json:"id"`
	Name          string  `json:"name"`
	Email         string  `json:"email"`
	Phone         string  `json:"phone"`
	WhatsappPhone *string `json:"whatsappPhone"`
	Role          string  `json:"role"`
	Status        string  `json:"status"`
	Skills        string  `json:"skills"`
	JoinedDate    string  `json:"joinedDate"`
	TotalHours    float64 `json:"totalHours"`
	CenterID      *string `json:"centerId"`
	CreatedAt     string  `json:"createdAt"`
	UpdatedAt     string  `json:"updatedAt"`
}

// CreateVolunteerInput represents the payload accepted by POST /volunteers.
type CreateVolunteerInput struct {
	Name          string  `json:"name"`
	Email         string  `json:"email"`
	Phone         string  `json:"phone"`
	WhatsappPhone *string `json:"whatsappPhone"`
	Role          string  `json:"role"`
	Status        string  `json:"status"`
	CenterID      *string `json:"centerId"`
	Skills        *string `json:"skills"`
}

// App holding dependencies.
type App struct {
	DB *sql.DB
}

func main() {
	dbPath := findDatabasePath()
	log.Printf("Connecting to SQLite database at: %s", dbPath)

	db, err := initDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()
	log.Println("Database connection established successfully.")

	app := &App{DB: db}
	handler := app.Routes()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := ":" + port
	log.Printf("Starting Go Core API Microservice on http://localhost%s", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}

// initDB initializes the SQLite database connection with WAL mode, busy timeout, and connection pool configuration.
func initDB(dbPath string) (*sql.DB, error) {
	dsn := dbPath
	if !strings.Contains(dsn, "?") {
		dsn += "?_journal_mode=WAL&_pragma=busy_timeout=5000"
	} else {
		dsn += "&_journal_mode=WAL&_pragma=busy_timeout=5000"
	}

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		log.Printf("Warning: failed to set PRAGMA journal_mode: %v", err)
	}
	if _, err := db.Exec("PRAGMA busy_timeout=5000;"); err != nil {
		log.Printf("Warning: failed to set PRAGMA busy_timeout: %v", err)
	}

	return db, nil
}

// findDatabasePath resolves the absolute or relative path to prisma/dev.db.
func findDatabasePath() string {
	if envPath := os.Getenv("DB_PATH"); envPath != "" {
		return envPath
	}

	candidates := []string{
		"../prisma/dev.db",
		"prisma/dev.db",
		"C:\\Users\\LENOVO\\.gemini\\antigravity\\scratch\\volunteer-os\\prisma\\dev.db",
	}

	// Try working directory relative resolution
	cwd, err := os.Getwd()
	if err == nil {
		candidates = append(candidates,
			filepath.Join(cwd, "prisma", "dev.db"),
			filepath.Join(cwd, "..", "prisma", "dev.db"),
		)
	}

	for _, path := range candidates {
		if fileInfo, err := os.Stat(path); err == nil && !fileInfo.IsDir() {
			abs, err := filepath.Abs(path)
			if err == nil {
				return abs
			}
			return path
		}
	}

	// Default fallback
	return "../prisma/dev.db"
}

// Routes sets up HTTP multiplexer.
func (app *App) Routes() http.Handler {
	mux := http.NewServeMux()

	// Registered endpoints
	mux.HandleFunc("/health", app.handleHealth)
	mux.HandleFunc("/volunteers", app.handleVolunteers)
	mux.HandleFunc("/volunteers/", app.handleVolunteerByID)
	mux.HandleFunc("/volunteers/export", app.handleExportVolunteers)

	return app.corsMiddleware(mux)
}

// corsMiddleware adds basic CORS headers.
func (app *App) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// handleHealth responds with GET /health -> {"status": "ok"}
func (app *App) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// handleVolunteers routes GET /volunteers and POST /volunteers, as well as GET /volunteers/export
func (app *App) handleVolunteers(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		app.listVolunteers(w, r)
	case http.MethodPost:
		app.createVolunteer(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// handleVolunteerByID handles GET /volunteers/:id or GET /volunteers/export
func (app *App) handleVolunteerByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/volunteers/")
	if path == "export" || path == "export/" {
		app.handleExportVolunteers(w, r)
		return
	}

	if path == "" {
		app.handleVolunteers(w, r)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	app.getVolunteerByID(w, r, path)
}

// createVolunteer handles POST /volunteers
func (app *App) createVolunteer(w http.ResponseWriter, r *http.Request) {
	var input CreateVolunteerInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Invalid JSON payload"})
		return
	}

	if strings.TrimSpace(input.Name) == "" || strings.TrimSpace(input.Email) == "" || strings.TrimSpace(input.Phone) == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "Missing required fields: name, email, phone"})
		return
	}

	id := generateVolunteerID()
	role := input.Role
	if strings.TrimSpace(role) == "" {
		role = "VOLUNTEER"
	}
	status := input.Status
	if strings.TrimSpace(status) == "" {
		status = "ACTIVE"
	}
	skills := ""
	if input.Skills != nil {
		skills = *input.Skills
	}

	nowIso := time.Now().UTC().Format(time.RFC3339)
	totalHours := 0.0

	var whatsappPhoneVal interface{}
	if input.WhatsappPhone != nil {
		whatsappPhoneVal = *input.WhatsappPhone
	} else {
		whatsappPhoneVal = nil
	}

	var centerIDVal interface{}
	if input.CenterID != nil {
		centerIDVal = *input.CenterID
	} else {
		centerIDVal = nil
	}

	query := `
		INSERT INTO Volunteer (id, name, email, phone, whatsappPhone, role, status, skills, joinedDate, totalHours, centerId, createdAt, updatedAt)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := app.DB.ExecContext(r.Context(), query,
		id,
		input.Name,
		input.Email,
		input.Phone,
		whatsappPhoneVal,
		role,
		status,
		skills,
		nowIso,
		totalHours,
		centerIDVal,
		nowIso,
		nowIso,
	)

	if err != nil {
		log.Printf("Error inserting volunteer: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("Failed to create volunteer: %v", err)})
		return
	}

	vol := Volunteer{
		ID:            id,
		Name:          input.Name,
		Email:         input.Email,
		Phone:         input.Phone,
		WhatsappPhone: input.WhatsappPhone,
		Role:          role,
		Status:        status,
		Skills:        skills,
		JoinedDate:    nowIso,
		TotalHours:    totalHours,
		CenterID:      input.CenterID,
		CreatedAt:     nowIso,
		UpdatedAt:     nowIso,
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(vol)
}

// getVolunteerByID handles GET /volunteers/:id
func (app *App) getVolunteerByID(w http.ResponseWriter, r *http.Request, id string) {
	query := `
		SELECT id, name, email, phone, whatsappPhone, role, status, skills, joinedDate, totalHours, centerId, createdAt, updatedAt
		FROM Volunteer
		WHERE id = ?
	`

	var v Volunteer
	var whatsappPhone sql.NullString
	var centerID sql.NullString
	var skills sql.NullString

	err := app.DB.QueryRowContext(r.Context(), query, id).Scan(
		&v.ID,
		&v.Name,
		&v.Email,
		&v.Phone,
		&whatsappPhone,
		&v.Role,
		&v.Status,
		&skills,
		&v.JoinedDate,
		&v.TotalHours,
		&centerID,
		&v.CreatedAt,
		&v.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(map[string]string{"error": "Volunteer not found"})
		return
	} else if err != nil {
		log.Printf("Error querying volunteer %s: %v", id, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Database error"})
		return
	}

	if whatsappPhone.Valid {
		v.WhatsappPhone = &whatsappPhone.String
	}
	if centerID.Valid {
		v.CenterID = &centerID.String
	}
	if skills.Valid {
		v.Skills = skills.String
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(v)
}

// listVolunteers handles GET /volunteers
func (app *App) listVolunteers(w http.ResponseWriter, r *http.Request) {
	query := `
		SELECT id, name, email, phone, whatsappPhone, role, status, skills, joinedDate, totalHours, centerId, createdAt, updatedAt
		FROM Volunteer
		ORDER BY createdAt DESC
	`

	rows, err := app.DB.QueryContext(r.Context(), query)
	if err != nil {
		log.Printf("Error listing volunteers: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Database error"})
		return
	}
	defer rows.Close()

	volunteers := []Volunteer{}

	for rows.Next() {
		var v Volunteer
		var whatsappPhone sql.NullString
		var centerID sql.NullString
		var skills sql.NullString

		if err := rows.Scan(
			&v.ID,
			&v.Name,
			&v.Email,
			&v.Phone,
			&whatsappPhone,
			&v.Role,
			&v.Status,
			&skills,
			&v.JoinedDate,
			&v.TotalHours,
			&centerID,
			&v.CreatedAt,
			&v.UpdatedAt,
		); err != nil {
			log.Printf("Error scanning volunteer row: %v", err)
			continue
		}

		if whatsappPhone.Valid {
			v.WhatsappPhone = &whatsappPhone.String
		}
		if centerID.Valid {
			v.CenterID = &centerID.String
		}
		if skills.Valid {
			v.Skills = skills.String
		}

		volunteers = append(volunteers, v)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(volunteers)
}

// handleExportVolunteers handles GET /volunteers/export
func (app *App) handleExportVolunteers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	query := `
		SELECT 
			v.name,
			v.email,
			v.phone,
			v.role,
			v.status,
			v.totalHours,
			COALESCE(c.name, '') AS centerName
		FROM Volunteer v
		LEFT JOIN Center c ON v.centerId = c.id
		ORDER BY v.name ASC
	`

	rows, err := app.DB.QueryContext(r.Context(), query)
	if err != nil {
		log.Printf("Error querying volunteers for export: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]string{"error": "Database error"})
		return
	}
	defer rows.Close()

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=\"volunteers.csv\"")
	w.WriteHeader(http.StatusOK)

	// Requirement specifies exact header line: Name, Email, Phone, Role, Status, TotalHours, Center
	w.Write([]byte("Name, Email, Phone, Role, Status, TotalHours, Center\n"))

	for rows.Next() {
		var name, email, phone, role, status, centerName string
		var totalHours float64

		if err := rows.Scan(&name, &email, &phone, &role, &status, &totalHours, &centerName); err != nil {
			log.Printf("Error scanning row for CSV export: %v", err)
			continue
		}

		line := fmt.Sprintf("%s, %s, %s, %s, %s, %g, %s\n",
			escapeCSVField(name),
			escapeCSVField(email),
			escapeCSVField(phone),
			escapeCSVField(role),
			escapeCSVField(status),
			totalHours,
			escapeCSVField(centerName),
		)
		w.Write([]byte(line))
	}
}

// escapeCSVField quotes string if it contains special CSV characters.
func escapeCSVField(field string) string {
	if strings.ContainsAny(field, ",\"\n\r") {
		escaped := strings.ReplaceAll(field, "\"", "\"\"")
		return "\"" + escaped + "\""
	}
	return field
}

// generateVolunteerID generates a vol_ prefix UUID.
func generateVolunteerID() string {
	var b [16]byte
	_, err := rand.Read(b[:])
	if err != nil {
		return fmt.Sprintf("vol_%d", time.Now().UnixNano())
	}
	b[6] = (b[6] & 0x0f) | 0x40 // Version 4
	b[8] = (b[8] & 0x3f) | 0x80 // Variant RFC 4122
	return fmt.Sprintf("vol_%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
