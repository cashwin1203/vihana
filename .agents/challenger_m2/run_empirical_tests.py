#!/usr/bin/env python3
"""
Empirical Verification & Adversarial Test Suite for Go Core API
Location: .agents/challenger_m2/run_empirical_tests.py
"""

import os
import sys
import time
import json
import uuid
import csv
import io
import urllib.request
import urllib.error
import sqlite3
import subprocess
import threading
from concurrent.futures import ThreadPoolExecutor

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GO_API_DIR = os.path.join(PROJECT_ROOT, "go-api")
DB_PATH = os.path.join(PROJECT_ROOT, "prisma", "dev.db")
PORT = "8085"
BASE_URL = f"http://localhost:{PORT}"

results = {
    "passed": [],
    "failed": [],
    "caveats": [],
    "latencies": {}
}

def log(msg):
    print(f"[CHALLENGER-M2] {msg}", flush=True)

def record_pass(test_name, detail=""):
    results["passed"].append({"name": test_name, "detail": detail})
    log(f"✅ PASS: {test_name} {('- ' + detail) if detail else ''}")

def record_fail(test_name, reason):
    results["failed"].append({"name": test_name, "reason": reason})
    log(f"❌ FAIL: {test_name} - {reason}")

def test_db_direct():
    log("Checking SQLite DB directly...")
    if not os.path.exists(DB_PATH):
        record_fail("SQLite File Existence", f"DB file missing at {DB_PATH}")
        return
    try:
        conn = sqlite3.connect(DB_PATH)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Volunteer'")
        if not cur.fetchone():
            record_fail("Volunteer Table Schema", "Volunteer table missing")
            return
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Center'")
        if not cur.fetchone():
            record_fail("Center Table Schema", "Center table missing")
            return
        cur.execute("SELECT COUNT(*) FROM Volunteer")
        count = cur.fetchone()[0]
        record_pass("SQLite DB Direct Check", f"Tables present, {count} existing records in Volunteer table")
        conn.close()
    except Exception as e:
        record_fail("SQLite DB Direct Check", str(e))

def start_go_server():
    log(f"Starting Go API server on port {PORT}...")
    env = os.environ.copy()
    env["PORT"] = PORT
    env["DB_PATH"] = DB_PATH
    
    # Run main.go
    proc = subprocess.Popen(
        ["go", "run", "main.go"],
        cwd=GO_API_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    
    # Wait for server to start
    started = False
    for _ in range(30):
        time.sleep(0.3)
        try:
            req = urllib.request.Request(f"{BASE_URL}/health")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                if resp.status == 200:
                    started = True
                    break
        except Exception:
            pass
            
    if not started:
        stdout, stderr = proc.communicate(timeout=2)
        log(f"Server stdout: {stdout}")
        log(f"Server stderr: {stderr}")
        raise RuntimeError("Failed to start Go server")
        
    log("Go server started successfully.")
    return proc

def test_health_endpoint():
    url = f"{BASE_URL}/health"
    start = time.perf_counter()
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            results["latencies"]["GET /health"] = elapsed_ms
            status_code = resp.status
            body_bytes = resp.read()
            data = json.loads(body_bytes.decode("utf-8"))
            
            if status_code != 200:
                record_fail("GET /health status code", f"Expected 200, got {status_code}")
                return
            if data.get("status") != "ok":
                record_fail("GET /health body", f"Expected {{\"status\": \"ok\"}}, got {data}")
                return
            if elapsed_ms > 500.0:
                record_fail("GET /health latency", f"Latency {elapsed_ms:.2f}ms > 500ms threshold")
                return
                
            record_pass("AC1: GET /health", f"Status 200 OK, {{\"status\":\"ok\"}}, latency {elapsed_ms:.2f}ms (<500ms limit)")
    except Exception as e:
        record_fail("AC1: GET /health", str(e))

def test_health_disallowed_methods():
    url = f"{BASE_URL}/health"
    req = urllib.request.Request(url, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            record_fail("POST /health Method Not Allowed", f"Expected 405, got {resp.status}")
    except urllib.error.HTTPError as e:
        if e.code == 405:
            record_pass("POST /health disallowed method", "Returned 405 Method Not Allowed")
        else:
            record_fail("POST /health disallowed method", f"Expected 405, got {e.code}")
    except Exception as e:
        record_fail("POST /health disallowed method", str(e))

def test_volunteers_post_and_get():
    unique_str = uuid.uuid4().hex[:8]
    test_email = f"empirical_{unique_str}@example.com"
    test_name = f"Empirical Tester {unique_str}"
    payload = {
        "name": test_name,
        "email": test_email,
        "phone": "+15550199",
        "whatsappPhone": "+15550199",
        "role": "VOLUNTEER",
        "status": "ACTIVE",
        "skills": "Go, Python, Empirical Challenge"
    }
    
    # 1. POST /volunteers
    post_url = f"{BASE_URL}/volunteers"
    data_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(post_url, data=data_bytes, headers={"Content-Type": "application/json"}, method="POST")
    
    created_vol = None
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            results["latencies"]["POST /volunteers"] = elapsed_ms
            if resp.status != 201:
                record_fail("POST /volunteers status", f"Expected 201 Created, got {resp.status}")
                return
            created_vol = json.loads(resp.read().decode("utf-8"))
            if not created_vol.get("id", "").startswith("vol_"):
                record_fail("POST /volunteers ID format", f"ID does not start with vol_: {created_vol.get('id')}")
                return
            if created_vol.get("email") != test_email:
                record_fail("POST /volunteers payload field", f"Email mismatch: {created_vol.get('email')}")
                return
            record_pass("POST /volunteers", f"Created record ID={created_vol['id']} in {elapsed_ms:.2f}ms")
    except Exception as e:
        record_fail("POST /volunteers", str(e))
        return

    vol_id = created_vol["id"]
    
    # 2. GET /volunteers/:id
    get_id_url = f"{BASE_URL}/volunteers/{vol_id}"
    start = time.perf_counter()
    req_get = urllib.request.Request(get_id_url)
    try:
        with urllib.request.urlopen(req_get, timeout=5.0) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            results["latencies"]["GET /volunteers/:id"] = elapsed_ms
            if resp.status != 200:
                record_fail("GET /volunteers/:id status", f"Expected 200 OK, got {resp.status}")
                return
            retrieved = json.loads(resp.read().decode("utf-8"))
            if retrieved.get("id") != vol_id:
                record_fail("GET /volunteers/:id match", f"ID mismatch: got {retrieved.get('id')}, expected {vol_id}")
                return
            if retrieved.get("name") != test_name:
                record_fail("GET /volunteers/:id match", f"Name mismatch: got {retrieved.get('name')}")
                return
            record_pass("AC2: POST /volunteers & GET /volunteers/:id", f"Record created and successfully retrieved via GET /volunteers/{vol_id} ({elapsed_ms:.2f}ms)")
    except Exception as e:
        record_fail("AC2: GET /volunteers/:id", str(e))

    # 3. GET /volunteers/:id with non-existent ID
    bad_id_url = f"{BASE_URL}/volunteers/vol_nonexistent_99999"
    try:
        req_bad = urllib.request.Request(bad_id_url)
        with urllib.request.urlopen(req_bad, timeout=5.0) as resp:
            record_fail("GET non-existent volunteer status", f"Expected 404, got {resp.status}")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            body = json.loads(e.read().decode("utf-8"))
            if body.get("error") == "Volunteer not found":
                record_pass("GET /volunteers/:id (404 Not Found)", "Returned 404 with error msg 'Volunteer not found'")
            else:
                record_fail("GET /volunteers/:id (404 Not Found)", f"Unexpected error body: {body}")
        else:
            record_fail("GET /volunteers/:id (404 Not Found)", f"Expected 404, got {e.code}")

def test_volunteers_validation():
    # Missing required field 'name'
    payload_no_name = {"email": "noname@example.com", "phone": "+123456"}
    req = urllib.request.Request(f"{BASE_URL}/volunteers", data=json.dumps(payload_no_name).encode(), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            record_fail("POST /volunteers missing name validation", f"Expected 400, got {resp.status}")
    except urllib.error.HTTPError as e:
        if e.code == 400:
            record_pass("POST /volunteers validation (missing name)", "Returned 400 Bad Request")
        else:
            record_fail("POST /volunteers validation (missing name)", f"Expected 400, got {e.code}")

def test_volunteers_export():
    export_url = f"{BASE_URL}/volunteers/export"
    start = time.perf_counter()
    req = urllib.request.Request(export_url)
    try:
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            elapsed_ms = (time.perf_counter() - start) * 1000.0
            results["latencies"]["GET /volunteers/export"] = elapsed_ms
            if resp.status != 200:
                record_fail("AC3: GET /volunteers/export status", f"Expected 200 OK, got {resp.status}")
                return
            
            c_type = resp.headers.get("Content-Type", "")
            if not c_type.startswith("text/csv"):
                record_fail("AC3: GET /volunteers/export Content-Type", f"Expected text/csv, got '{c_type}'")
                return
                
            c_disp = resp.headers.get("Content-Disposition", "")
            if "attachment" not in c_disp or "volunteers.csv" not in c_disp:
                results["caveats"].append(f"Content-Disposition header is '{c_disp}'")

            content = resp.read().decode("utf-8")
            lines = content.strip().splitlines()
            if not lines:
                record_fail("AC3: GET /volunteers/export empty", "CSV response is empty")
                return
                
            header_line = lines[0].strip()
            expected_header = "Name, Email, Phone, Role, Status, TotalHours, Center"
            if header_line != expected_header:
                record_fail("AC3: GET /volunteers/export header match", f"Header mismatch.\nExpected: '{expected_header}'\nGot:      '{header_line}'")
                return
                
            # Verify CSV parsing
            reader = csv.reader(io.StringIO(content))
            rows = list(reader)
            if len(rows) < 2:
                record_fail("AC3: GET /volunteers/export rows", f"Expected at least 1 header + 1 data row, got {len(rows)} rows")
                return
                
            record_pass("AC3: GET /volunteers/export", f"Valid CSV with header '{header_line}', {len(rows)-1} data rows ({elapsed_ms:.2f}ms)")
    except Exception as e:
        record_fail("AC3: GET /volunteers/export", str(e))

def test_csv_adversarial_escaping():
    # Insert volunteer with special CSV characters (comma, quotes)
    special_name = 'O\'Connor, "The Volunteer" & Co.'
    special_email = f"special_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "name": special_name,
        "email": special_email,
        "phone": "+1999888777",
        "role": "VOLUNTEER",
        "status": "ACTIVE"
    }
    
    # POST
    req = urllib.request.Request(f"{BASE_URL}/volunteers", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            pass
    except Exception as e:
        record_fail("Adversarial CSV insert", str(e))
        return
        
    # GET export
    req_exp = urllib.request.Request(f"{BASE_URL}/volunteers/export")
    try:
        with urllib.request.urlopen(req_exp) as resp:
            content = resp.read().decode("utf-8")
            reader = csv.reader(io.StringIO(content))
            header = next(reader)
            found = False
            for row in reader:
                # Due to spaces after commas in formatting, row elements might have leading space
                clean_row = [field.strip() for field in row]
                if clean_row[1] == special_email:
                    found = True
                    if clean_row[0] == special_name:
                        record_pass("Adversarial CSV Escaping", f"Escaped quotes and commas correctly: '{clean_row[0]}'")
                    else:
                        record_fail("Adversarial CSV Escaping", f"Parsed name '{clean_row[0]}' != original '{special_name}'")
                    break
            if not found:
                record_fail("Adversarial CSV Escaping", "Special record not found in export")
    except Exception as e:
        record_fail("Adversarial CSV Escaping", str(e))

def test_concurrent_stress():
    log("Running concurrent stress test (20 parallel requests)...")
    def worker(i):
        email = f"stress_{i}_{uuid.uuid4().hex[:6]}@example.com"
        payload = {"name": f"Stress {i}", "email": email, "phone": "1234567890"}
        req = urllib.request.Request(f"{BASE_URL}/volunteers", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                return resp.status == 201
        except Exception as e:
            if isinstance(e, urllib.error.HTTPError):
                body = e.read().decode('utf-8', errors='ignore')
                log(f"Stress worker {i} failed: {e} - Body: {body}")
            else:
                log(f"Stress worker {i} failed: {e}")
            return False

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(worker, i) for i in range(20)]
        results_list = [f.result() for f in futures]
        
    success_count = sum(1 for r in results_list if r)
    if success_count == 20:
        record_pass("Stress Test Concurrent Writes", "20/20 concurrent POST requests succeeded without database lock errors")
    else:
        record_fail("Stress Test Concurrent Writes", f"Only {success_count}/20 concurrent requests succeeded")

def main():
    log("Starting Empirical Challenger Test Suite...")
    test_db_direct()
    
    server_proc = None
    try:
        server_proc = start_go_server()
        test_health_endpoint()
        test_health_disallowed_methods()
        test_volunteers_post_and_get()
        test_volunteers_validation()
        test_volunteers_export()
        test_csv_adversarial_escaping()
        test_concurrent_stress()
    finally:
        if server_proc:
            log("Stopping Go server...")
            server_proc.terminate()
            server_proc.wait(timeout=3)

    log("\n--- TEST SUMMARY ---")
    log(f"Total Passed: {len(results['passed'])}")
    log(f"Total Failed: {len(results['failed'])}")
    
    summary_data = {
        "passed": results["passed"],
        "failed": results["failed"],
        "caveats": results["caveats"],
        "latencies": results["latencies"]
    }
    with open(os.path.join(os.path.dirname(__file__), "test_results.json"), "w") as f:
        json.dump(summary_data, f, indent=2)

    if results["failed"]:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
