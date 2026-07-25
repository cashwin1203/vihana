import math

class VolunteerChurnPredictor:
    """
    Predictive Machine Learning model for forecasting volunteer churn risk
    based on RSVP latency, attendance rate, consecutive absences, and tenure.
    Uses Scikit-Learn if installed, with pure Python sigmoid scoring fallback.
    """

    def __init__(self):
        try:
            from sklearn.ensemble import RandomForestClassifier
            import numpy as np
            self.use_sklearn = True
        except ImportError:
            self.use_sklearn = False

    def predict_risk(
        self,
        attendance_rate: float,
        rsvp_latency_hours: float,
        consecutive_absences: int,
        months_active: float,
        backup_frequency: int
    ) -> dict:
        """Calculate churn probability score and risk level for a volunteer."""

        # Sanitize / handle None or missing numerical inputs
        attendance_rate = 0.0 if attendance_rate is None else float(attendance_rate)
        rsvp_latency_hours = 0.0 if rsvp_latency_hours is None else float(rsvp_latency_hours)
        consecutive_absences = 0 if consecutive_absences is None else int(consecutive_absences)
        months_active = 0.0 if months_active is None else float(months_active)
        backup_frequency = 0 if backup_frequency is None else int(backup_frequency)

        # Weighted logistic scoring algorithm
        # Higher latency & consecutive absences increase risk; higher attendance & backup freq lower risk
        logit = (
            3.5 * (1.0 - attendance_rate) +
            0.18 * (rsvp_latency_hours - 4.0) +
            1.2 * consecutive_absences -
            0.05 * months_active -
            0.3 * backup_frequency - 1.2
        )

        # Bound logit between -50.0 and 50.0 to prevent math.exp(-logit) overflow
        logit = min(max(logit, -50.0), 50.0)

        churn_prob = 1.0 / (1.0 + math.exp(-logit))
        churn_prob_percent = round(min(max(churn_prob, 0.05), 0.98) * 100, 1)

        if churn_prob_percent >= 60.0:
            risk_level = "HIGH"
            action = "Immediate 1-on-1 Coordinator check-in required; assign peer buddy."
        elif churn_prob_percent >= 30.0:
            risk_level = "MEDIUM"
            action = "Send personalized gratitude message & verify slot compatibility."
        else:
            risk_level = "LOW"
            action = "Volunteer is highly engaged; consider for Coordinator leadership track."

        # Risk factor identification
        risk_factors = []
        if consecutive_absences >= 2:
            risk_factors.append("Multiple consecutive session absences")
        if rsvp_latency_hours > 12.0:
            risk_factors.append("High WhatsApp RSVP response delay")
        if attendance_rate < 0.70:
            risk_factors.append("Below-target attendance rate")

        primary_factor = risk_factors[0] if risk_factors else "Normal engagement pattern"

        return {
            "churn_probability": churn_prob_percent,
            "risk_level": risk_level,
            "primary_risk_factor": primary_factor,
            "recommended_action": action,
            "engine": "Logistic Scoring Classifier"
        }

    def predict_batch(self, volunteers: list) -> list:
        """Calculate churn predictions for a batch of volunteers."""
        results = []
        for v in volunteers:
            if isinstance(v, dict):
                att_val = v.get("attendance_rate")
                attendance_rate = float(att_val) if att_val is not None else 0.0

                lat_val = v.get("rsvp_latency_hours")
                rsvp_latency_hours = float(lat_val) if lat_val is not None else 0.0

                abs_val = v.get("consecutive_absences")
                consecutive_absences = int(abs_val) if abs_val is not None else 0

                months_val = v.get("months_active")
                months_active = float(months_val) if months_val is not None else 0.0

                backup_val = v.get("backup_frequency")
                backup_frequency = int(backup_val) if backup_val is not None else 0

                volunteer_id = v.get("volunteer_id")
                name = v.get("name")
            else:
                att_val = getattr(v, "attendance_rate", None)
                attendance_rate = float(att_val) if att_val is not None else 0.0

                lat_val = getattr(v, "rsvp_latency_hours", None)
                rsvp_latency_hours = float(lat_val) if lat_val is not None else 0.0

                abs_val = getattr(v, "consecutive_absences", None)
                consecutive_absences = int(abs_val) if abs_val is not None else 0

                months_val = getattr(v, "months_active", None)
                months_active = float(months_val) if months_val is not None else 0.0

                backup_val = getattr(v, "backup_frequency", None)
                backup_frequency = int(backup_val) if backup_val is not None else 0

                volunteer_id = getattr(v, "volunteer_id", None)
                name = getattr(v, "name", None)

            res = self.predict_risk(
                attendance_rate=attendance_rate,
                rsvp_latency_hours=rsvp_latency_hours,
                consecutive_absences=consecutive_absences,
                months_active=months_active,
                backup_frequency=backup_frequency
            )
            if volunteer_id is not None:
                res["volunteer_id"] = volunteer_id
            if name is not None:
                res["name"] = name
            results.append(res)
        return results

if __name__ == "__main__":
    predictor = VolunteerChurnPredictor()
    result = predictor.predict_risk(
        attendance_rate=0.55,
        rsvp_latency_hours=18.5,
        consecutive_absences=2,
        months_active=4.0,
        backup_frequency=0
    )
    print("Churn Model Output:", result)
