## 2026-07-25T00:40:10Z
<USER_REQUEST>
You are Implementer M1 Fix. Your working directory is `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os\.agents\implementer_m1_fix`.
Project root: `C:\Users\LENOVO\.gemini\antigravity\scratch\volunteer-os`

DO NOT CHEAT. All implementations must be genuine.

Task:
Apply 2 quick robustness fixes based on Reviewer M1 feedback to `python/churn_model.py` and `python/main.py`:
1. In `python/churn_model.py`:
   - Fix engine metadata string in `predict_risk` / `predict_batch` to accurately report `"Logistic Scoring Classifier"`.
   - Prevent `math.exp(-logit)` overflow by bounding `logit = min(max(logit, -50.0), 50.0)` before calling `math.exp(-logit)`.
   - Handle possible `None` numerical inputs in `predict_batch` by defaulting `None` inputs to reasonable fallback values (e.g. 0.0 or 0).
2. Run `python python/test_api.py` to confirm all tests pass.
3. Write `handoff.md` in your working directory and notify parent (`d900bdcd-fc29-418a-9bb4-bbb3b81aa5cf`).
</USER_REQUEST>
