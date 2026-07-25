import sys
import os
import json
from fastapi.testclient import TestClient

# Ensure python directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from main import app
from churn_model import VolunteerChurnPredictor

client = TestClient(app)

def run_all_empirical_tests():
    report_lines = []
    report_lines.append("=== EMPIRICAL TEST SUITE RESULTS ===")
    
    # Test 1: Health check endpoint
    resp = client.get("/health")
    assert resp.status_code == 200, f"Health check failed: {resp.status_code}"
    report_lines.append(f"[PASS] GET /health -> Status {resp.status_code}, Body: {resp.json()}")

    # Test 2: AC 1 - POST /predict-churn (High Risk)
    ac1_payload = {
        "attendance_rate": 0.45,
        "rsvp_latency_hours": 20,
        "consecutive_absences": 3,
        "months_active": 2,
        "backup_frequency": 0
    }
    resp = client.post("/predict-churn", json=ac1_payload)
    assert resp.status_code == 200, f"AC 1 failed with status {resp.status_code}"
    ac1_data = resp.json()
    assert ac1_data.get("risk_level") == "HIGH", f"Expected HIGH, got {ac1_data.get('risk_level')}"
    assert ac1_data.get("churn_probability") == 98.0, f"Expected 98.0, got {ac1_data.get('churn_probability')}"
    report_lines.append(f"[PASS] AC 1: POST /predict-churn -> risk_level='HIGH', churn_prob={ac1_data.get('churn_probability')}%")

    # Test 3: AC 2 - POST /batch-predict (Array of 5 volunteers)
    ac2_payload = [
        {"volunteer_id": "v1", "name": "Alice", "attendance_rate": 0.45, "rsvp_latency_hours": 20, "consecutive_absences": 3, "months_active": 2, "backup_frequency": 0},
        {"volunteer_id": "v2", "name": "Bob", "attendance_rate": 0.95, "rsvp_latency_hours": 2, "consecutive_absences": 0, "months_active": 12, "backup_frequency": 2},
        {"volunteer_id": "v3", "name": "Charlie", "attendance_rate": 0.65, "rsvp_latency_hours": 10, "consecutive_absences": 1, "months_active": 6, "backup_frequency": 1},
        {"volunteer_id": "v4", "name": "David", "attendance_rate": 0.30, "rsvp_latency_hours": 30, "consecutive_absences": 4, "months_active": 1, "backup_frequency": 0},
        {"volunteer_id": "v5", "name": "Eve", "attendance_rate": 0.85, "rsvp_latency_hours": 4, "consecutive_absences": 0, "months_active": 8, "backup_frequency": 1}
    ]
    resp = client.post("/batch-predict", json=ac2_payload)
    assert resp.status_code == 200, f"AC 2 failed with status {resp.status_code}"
    ac2_data = resp.json()
    predictions = ac2_data.get("predictions", [])
    assert len(predictions) == 5, f"Expected 5 predictions, got {len(predictions)}"
    report_lines.append(f"[PASS] AC 2: POST /batch-predict (5 items) -> Returned {len(predictions)} predictions. count={ac2_data.get('count')}")
    for idx, p in enumerate(predictions):
        report_lines.append(f"   Volunteer {p.get('volunteer_id', idx+1)} ({p.get('name', 'N/A')}): risk_level={p.get('risk_level')}, churn_prob={p.get('churn_probability')}%")

    # Test 4: Boundary value - attendance_rate = 0.0
    resp = client.post("/predict-churn", json={
        "attendance_rate": 0.0,
        "rsvp_latency_hours": 0.0,
        "consecutive_absences": 0,
        "months_active": 12.0,
        "backup_frequency": 0
    })
    assert resp.status_code == 200
    b1_data = resp.json()
    report_lines.append(f"[PASS] Boundary attendance_rate=0.0 -> risk_level={b1_data['risk_level']}, churn_prob={b1_data['churn_probability']}%")

    # Test 5: Boundary value - attendance_rate = 1.0 (perfect volunteer)
    resp = client.post("/predict-churn", json={
        "attendance_rate": 1.0,
        "rsvp_latency_hours": 1.0,
        "consecutive_absences": 0,
        "months_active": 24.0,
        "backup_frequency": 5
    })
    assert resp.status_code == 200
    b2_data = resp.json()
    report_lines.append(f"[PASS] Boundary attendance_rate=1.0 -> risk_level={b2_data['risk_level']}, churn_prob={b2_data['churn_probability']}%")

    # Test 6: Boundary value - consecutive_absences = 10
    resp = client.post("/predict-churn", json={
        "attendance_rate": 0.80,
        "rsvp_latency_hours": 5.0,
        "consecutive_absences": 10,
        "months_active": 6.0,
        "backup_frequency": 1
    })
    assert resp.status_code == 200
    b3_data = resp.json()
    report_lines.append(f"[PASS] Boundary consecutive_absences=10 -> risk_level={b3_data['risk_level']}, churn_prob={b3_data['churn_probability']}%")

    # Test 7: 50-item batch payload stress test
    batch_50 = [
        {
            "volunteer_id": f"vol_{i}",
            "name": f"Volunteer {i}",
            "attendance_rate": round(0.1 + (i % 9) * 0.1, 2),
            "rsvp_latency_hours": float(i % 24),
            "consecutive_absences": i % 5,
            "months_active": float((i % 12) + 1),
            "backup_frequency": i % 3
        } for i in range(1, 51)
    ]
    resp = client.post("/batch-predict", json=batch_50)
    assert resp.status_code == 200, f"50-item batch failed with status {resp.status_code}"
    batch_50_data = resp.json()
    assert len(batch_50_data.get("predictions", [])) == 50
    report_lines.append(f"[PASS] Stress test: 50-item batch payload processed successfully. count={batch_50_data.get('count')}")

    # Test 8: Batch predict with object payload `{"volunteers": [...]}`
    resp = client.post("/batch-predict", json={"volunteers": ac2_payload})
    assert resp.status_code == 200
    obj_batch_data = resp.json()
    assert len(obj_batch_data.get("predictions", [])) == 5
    report_lines.append("[PASS] Batch predict with object wrapper `{'volunteers': [...]}` processed successfully.")

    # Test 9: Empty batch `[]`
    resp = client.post("/batch-predict", json=[])
    assert resp.status_code == 200
    empty_batch_data = resp.json()
    assert len(empty_batch_data.get("predictions", [])) == 0
    report_lines.append(f"[PASS] Empty batch payload `[]` returned 0 predictions.")

    output_summary = "\n".join(report_lines)
    print(output_summary)
    return output_summary

if __name__ == "__main__":
    run_all_empirical_tests()
