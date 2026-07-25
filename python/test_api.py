import pytest
from fastapi.testclient import TestClient
from churn_model import VolunteerChurnPredictor
from main import app, ChurnRequest

client = TestClient(app)

def test_churn_model_high_risk():
    predictor = VolunteerChurnPredictor()
    result = predictor.predict_risk(
        attendance_rate=0.45,
        rsvp_latency_hours=20.0,
        consecutive_absences=3,
        months_active=2.0,
        backup_frequency=0
    )
    assert result["risk_level"] == "HIGH"
    assert result["churn_probability"] == 98.0
    assert result["primary_risk_factor"] == "Multiple consecutive session absences"
    assert "recommended_action" in result

def test_churn_model_batch():
    predictor = VolunteerChurnPredictor()
    volunteers = [
        {"volunteer_id": "v1", "name": "Alice", "attendance_rate": 0.45, "rsvp_latency_hours": 20, "consecutive_absences": 3, "months_active": 2, "backup_frequency": 0},
        {"volunteer_id": "v2", "name": "Bob", "attendance_rate": 0.95, "rsvp_latency_hours": 2, "consecutive_absences": 0, "months_active": 12, "backup_frequency": 2},
        {"volunteer_id": "v3", "name": "Charlie", "attendance_rate": 0.65, "rsvp_latency_hours": 10, "consecutive_absences": 1, "months_active": 6, "backup_frequency": 1},
        {"volunteer_id": "v4", "name": "David", "attendance_rate": 0.30, "rsvp_latency_hours": 30, "consecutive_absences": 4, "months_active": 1, "backup_frequency": 0},
        {"volunteer_id": "v5", "name": "Eve", "attendance_rate": 0.85, "rsvp_latency_hours": 4, "consecutive_absences": 0, "months_active": 8, "backup_frequency": 1}
    ]
    results = predictor.predict_batch(volunteers)
    assert len(results) == 5
    assert results[0]["risk_level"] == "HIGH"
    assert results[0]["volunteer_id"] == "v1"
    assert results[1]["risk_level"] == "LOW"
    assert results[1]["volunteer_id"] == "v2"

def test_api_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_api_predict_churn_ac_high_risk():
    payload = {
        "attendance_rate": 0.45,
        "rsvp_latency_hours": 20,
        "consecutive_absences": 3,
        "months_active": 2,
        "backup_frequency": 0
    }
    response = client.post("/predict-churn", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "HIGH"
    assert data["churn_probability"] == 98.0
    assert "primary_risk_factor" in data
    assert "recommended_action" in data

def test_api_predict_churn_with_metadata():
    payload = {
        "volunteer_id": "vol-101",
        "name": "Jane Doe",
        "attendance_rate": 0.90,
        "rsvp_latency_hours": 3.0,
        "consecutive_absences": 0,
        "months_active": 10.0,
        "backup_frequency": 2
    }
    response = client.post("/predict-churn", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_level"] == "LOW"
    assert data["volunteer_id"] == "vol-101"
    assert data["name"] == "Jane Doe"

def test_api_batch_predict_array():
    volunteers = [
        {"volunteer_id": "v1", "attendance_rate": 0.45, "rsvp_latency_hours": 20, "consecutive_absences": 3, "months_active": 2, "backup_frequency": 0},
        {"volunteer_id": "v2", "attendance_rate": 0.95, "rsvp_latency_hours": 2, "consecutive_absences": 0, "months_active": 12, "backup_frequency": 2},
        {"volunteer_id": "v3", "attendance_rate": 0.65, "rsvp_latency_hours": 10, "consecutive_absences": 1, "months_active": 6, "backup_frequency": 1},
        {"volunteer_id": "v4", "attendance_rate": 0.30, "rsvp_latency_hours": 30, "consecutive_absences": 4, "months_active": 1, "backup_frequency": 0},
        {"volunteer_id": "v5", "attendance_rate": 0.85, "rsvp_latency_hours": 4, "consecutive_absences": 0, "months_active": 8, "backup_frequency": 1}
    ]
    response = client.post("/batch-predict", json=volunteers)
    assert response.status_code == 200
    data = response.json()
    predictions = data.get("predictions", []) if isinstance(data, dict) else data
    assert len(predictions) == 5
    assert predictions[0]["risk_level"] == "HIGH"
    assert predictions[0]["volunteer_id"] == "v1"

def test_api_batch_predict_object():
    payload = {
        "volunteers": [
            {"volunteer_id": "v1", "attendance_rate": 0.45, "rsvp_latency_hours": 20, "consecutive_absences": 3, "months_active": 2, "backup_frequency": 0},
            {"volunteer_id": "v2", "attendance_rate": 0.95, "rsvp_latency_hours": 2, "consecutive_absences": 0, "months_active": 12, "backup_frequency": 2},
            {"volunteer_id": "v3", "attendance_rate": 0.65, "rsvp_latency_hours": 10, "consecutive_absences": 1, "months_active": 6, "backup_frequency": 1},
            {"volunteer_id": "v4", "attendance_rate": 0.30, "rsvp_latency_hours": 30, "consecutive_absences": 4, "months_active": 1, "backup_frequency": 0},
            {"volunteer_id": "v5", "attendance_rate": 0.85, "rsvp_latency_hours": 4, "consecutive_absences": 0, "months_active": 8, "backup_frequency": 1}
        ]
    }
    response = client.post("/batch-predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    predictions = data.get("predictions", []) if isinstance(data, dict) else data
    assert len(predictions) == 5
    assert predictions[0]["risk_level"] == "HIGH"

def test_churn_model_engine_metadata():
    predictor = VolunteerChurnPredictor()
    result = predictor.predict_risk(
        attendance_rate=0.8,
        rsvp_latency_hours=2.0,
        consecutive_absences=0,
        months_active=6.0,
        backup_frequency=1
    )
    assert result["engine"] == "Logistic Scoring Classifier"

def test_churn_model_none_inputs_handling():
    predictor = VolunteerChurnPredictor()
    # Test predict_risk directly with None inputs
    res_single = predictor.predict_risk(
        attendance_rate=None,
        rsvp_latency_hours=None,
        consecutive_absences=None,
        months_active=None,
        backup_frequency=None
    )
    assert res_single["engine"] == "Logistic Scoring Classifier"
    assert "churn_probability" in res_single

    # Test predict_batch with None numerical inputs in dicts
    batch_data = [
        {
            "volunteer_id": "v_none_1",
            "attendance_rate": None,
            "rsvp_latency_hours": None,
            "consecutive_absences": None,
            "months_active": None,
            "backup_frequency": None
        }
    ]
    res_batch = predictor.predict_batch(batch_data)
    assert len(res_batch) == 1
    assert res_batch[0]["volunteer_id"] == "v_none_1"
    assert res_batch[0]["engine"] == "Logistic Scoring Classifier"

def test_churn_model_logit_overflow_protection():
    predictor = VolunteerChurnPredictor()
    # Extremely large positive logit
    res_high = predictor.predict_risk(
        attendance_rate=0.0,
        rsvp_latency_hours=10000.0,
        consecutive_absences=100,
        months_active=0.0,
        backup_frequency=0
    )
    assert res_high["churn_probability"] == 98.0

    # Extremely negative logit
    res_low = predictor.predict_risk(
        attendance_rate=1.0,
        rsvp_latency_hours=0.0,
        consecutive_absences=0,
        months_active=1000.0,
        backup_frequency=100
    )
    assert res_low["churn_probability"] == 5.0

if __name__ == "__main__":
    test_churn_model_high_risk()
    test_churn_model_batch()
    test_api_health()
    test_api_predict_churn_ac_high_risk()
    test_api_predict_churn_with_metadata()
    test_api_batch_predict_array()
    test_api_batch_predict_object()
    test_churn_model_engine_metadata()
    test_churn_model_none_inputs_handling()
    test_churn_model_logit_overflow_protection()
    print("ALL API AND MODEL TESTS PASSED SUCCESSFULLY!")
