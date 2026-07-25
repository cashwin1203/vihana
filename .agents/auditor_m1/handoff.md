# Forensic Audit Handoff Report — Auditor M1

## Forensic Audit Report

**Work Product**: `python/main.py` and `python/churn_model.py`  
**Profile**: General Project / Integrity Forensics  
**Verdict**: **CLEAN**  

### Phase Results
- **Hardcoded Output Detection**: **PASS** — No hardcoded test results, expected return strings, or static value mappings exist.
- **Facade / Mock Object Detection**: **PASS** — No facade or dummy objects present; model uses continuous mathematical logistic activation functions.
- **Input Propagation & Dynamic Tracing**: **PASS** — API payloads in `/predict-churn` and `/batch-predict` map directly to `predict_risk()` and `predict_batch()`.
- **Pre-populated Artifact Detection**: **PASS** — Workspace contains no fake pre-generated log files or verification attestations.
- **Empirical Test Execution**: **PASS** — Executed `python python/test_api.py`; all 7 unit and API integration tests passed.

---

## 1. Observation

### Codebase Inspection (`python/main.py` & `python/churn_model.py`)
1. **`python/main.py` (lines 36–73)**:
   - Endpoint `/predict-churn` (lines 36–50) receives `ChurnRequest` Pydantic model (`attendance_rate`, `rsvp_latency_hours`, `consecutive_absences`, `months_active`, `backup_frequency`), passes parameters directly to `churn_predictor.predict_risk(...)`, and attaches optional `volunteer_id` / `name` metadata dynamically.
   - Endpoint `/batch-predict` (lines 54–73) receives batch requests, normalizes payloads, and delegates list execution directly to `churn_predictor.predict_batch(...)`.

2. **`python/churn_model.py` (lines 18–68)**:
   - `predict_risk()` dynamically computes logit score using feature weights (lines 30–36):
     ```python
     logit = (
         3.5 * (1.0 - attendance_rate) +
         0.18 * (rsvp_latency_hours - 4.0) +
         1.2 * consecutive_absences -
         0.05 * months_active -
         0.3 * backup_frequency - 1.2
     )
     ```
   - Churn probability is dynamically calculated via sigmoid transformation (lines 38–39):
     ```python
     churn_prob = 1.0 / (1.0 + math.exp(-logit))
     churn_prob_percent = round(min(max(churn_prob, 0.05), 0.98) * 100, 1)
     ```
   - Risk levels ("HIGH", "MEDIUM", "LOW") are assigned dynamically based on numeric thresholds (`>= 60.0`, `>= 30.0`).
   - Risk factors are evaluated dynamically via conditionals on features (`consecutive_absences >= 2`, `rsvp_latency_hours > 12.0`, `attendance_rate < 0.70`).

3. **`python/test_api.py` Execution**:
   - Command: `python python/test_api.py`
   - Result: `ALL API AND MODEL TESTS PASSED SUCCESSFULLY!` (7/7 tests passed).

4. **Dynamic Verification Script**:
   - Command: `python -c "from python.churn_model import VolunteerChurnPredictor; p = VolunteerChurnPredictor(); print(p.predict_risk(0.9, 2.0, 0, 12.0, 3)); print(p.predict_risk(0.1, 48.0, 5, 1.0, 0)); print(p.predict_risk(0.7, 8.0, 1, 6.0, 1))"`
   - Output:
     - `(0.9, 2.0, 0, 12.0, 3)` -> `6.2%` churn probability, `LOW` risk.
     - `(0.1, 48.0, 5, 1.0, 0)` -> `98.0%` churn probability, `HIGH` risk.
     - `(0.7, 8.0, 1, 6.0, 1)` -> `76.3%` churn probability, `HIGH` risk.

---

## 2. Logic Chain

1. **Static Analysis Step**: Source code analysis of `python/main.py` and `python/churn_model.py` was conducted line by line. No conditional branches matching specific test inputs (e.g. `if attendance_rate == 0.45: return "HIGH"`) or constant return values were found.
2. **Dynamic Tracing Step**: Tracing confirmed that request data entering `/predict-churn` and `/batch-predict` flows directly without hardcoded overrides into `VolunteerChurnPredictor.predict_risk` and `VolunteerChurnPredictor.predict_batch`.
3. **Algorithmic Evaluation Step**: The model uses a real weighted logistic formula with a sigmoid activation function `1 / (1 + exp(-logit))` to produce continuous floating point churn risk percentages for any arbitrary input combinations.
4. **Empirical Execution Step**: Execution of the test suite and custom parameter combinations proved that varying inputs produce mathematically corresponding output variations without hardcoding or shortcuts.

---

## 3. Caveats

- Scikit-learn fallback: `VolunteerChurnPredictor` checks if `sklearn` is installed (`use_sklearn`). When `sklearn` is absent in the local environment, it cleanly falls back to the pure Python weighted logistic engagement classifier formula. Both paths perform authentic, genuine dynamic mathematical inference.
- No caveats regarding code integrity or compliance.

---

## 4. Conclusion

**Verdict: CLEAN**

The implementation in `python/main.py` and `python/churn_model.py` is authentic, mathematically sound, dynamically traced, and free of hardcoded returns or facade objects.

---

## 5. Verification Method

To independently verify this audit:
1. Run the test suite:
   ```powershell
   python python/test_api.py
   ```
2. Run custom dynamic predictions:
   ```powershell
   python -c "from python.churn_model import VolunteerChurnPredictor; p = VolunteerChurnPredictor(); print(p.predict_risk(0.8, 5.0, 0, 10.0, 2))"
   ```
3. Inspect `python/churn_model.py` lines 30–68 to confirm mathematical weighted logistic scoring.
