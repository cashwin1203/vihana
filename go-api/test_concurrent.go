package main

import (
	"database/sql"
	"fmt"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

func testDSN(name string, dsn string, maxConns int) {
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		fmt.Printf("[%s] Open err: %v\n", name, err)
		return
	}
	defer db.Close()

	db.SetMaxOpenConns(maxConns)

	// Ensure WAL & busy_timeout
	_, _ = db.Exec("PRAGMA journal_mode=WAL;")
	_, _ = db.Exec("PRAGMA busy_timeout=5000;")

	var wg sync.WaitGroup
	failures := 0
	var mu sync.Mutex

	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			query := `INSERT INTO Volunteer (id, name, email, phone, role, status, skills, joinedDate, totalHours, createdAt, updatedAt) 
				VALUES (?, ?, ?, ?, 'VOLUNTEER', 'ACTIVE', '', '2026-01-01', 0, '2026-01-01', '2026-01-01')`
			idStr := fmt.Sprintf("vol_test_%d_%d", time.Now().UnixNano(), id)
			emailStr := fmt.Sprintf("test_%d_%d@example.com", time.Now().UnixNano(), id)
			_, err := db.Exec(query, idStr, fmt.Sprintf("Name %d", id), emailStr, "123")
			if err != nil {
				mu.Lock()
				failures++
				fmt.Printf("[%s] Worker %d error: %v\n", name, id, err)
				mu.Unlock()
			}
		}(i)
	}

	wg.Wait()
	fmt.Printf("[%s] MaxConns=%d => Failures: %d / 20\n", name, maxConns, failures)
}

func main() {
	testDSN("DSN1-WAL-5000-Max10", "file:../prisma/dev.db?_journal_mode=WAL&_pragma=busy_timeout=5000", 10)
	testDSN("DSN2-WAL-5000-Max1", "file:../prisma/dev.db?_journal_mode=WAL&_pragma=busy_timeout=5000", 1)
	testDSN("DSN3-WAL-5000-Max100", "file:../prisma/dev.db?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)", 100)
}
