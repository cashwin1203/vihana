from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import Optional, List, Union, Any
from churn_model import VolunteerChurnPredictor
from voice_processor import VoiceNoteNLUProcessor

app = FastAPI(
    title="Volunteer OS AI & ML Microservice",
    description="Python microservice providing predictive churn analytics and WhatsApp voice note NLU processing.",
    version="1.0.0"
)

# Initialize ML Model & NLU Processor
churn_predictor = VolunteerChurnPredictor()
voice_processor = VoiceNoteNLUProcessor()

class ChurnRequest(BaseModel):
    attendance_rate: Optional[float] = 0.0
    rsvp_latency_hours: Optional[float] = 0.0
    consecutive_absences: Optional[int] = 0
    months_active: Optional[float] = 0.0
    backup_frequency: Optional[int] = 0
    volunteer_id: Optional[Union[str, int]] = None
    name: Optional[str] = None

class BatchChurnRequest(BaseModel):
    volunteers: List[ChurnRequest]

class VoiceNoteRequest(BaseModel):
    transcript: str

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "Volunteer OS Python ML Engine"}

@app.post("/predict-churn")
def predict_churn(req: ChurnRequest):
    try:
        result = churn_predictor.predict_risk(
            attendance_rate=req.attendance_rate,
            rsvp_latency_hours=req.rsvp_latency_hours,
            consecutive_absences=req.consecutive_absences,
            months_active=req.months_active,
            backup_frequency=req.backup_frequency
        )
        if req.volunteer_id is not None:
            result["volunteer_id"] = req.volunteer_id
        if req.name is not None:
            result["name"] = req.name
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/batch-predict")
def batch_predict(payload: Union[BatchChurnRequest, List[ChurnRequest]] = Body(...)):
    try:
        if isinstance(payload, BatchChurnRequest):
            items = payload.volunteers
        elif isinstance(payload, list):
            items = payload
        elif isinstance(payload, dict) and "volunteers" in payload:
            items = [ChurnRequest(**v) if isinstance(v, dict) else v for v in payload["volunteers"]]
        else:
            items = []

        predictions = churn_predictor.predict_batch(items)

        return {
            "predictions": predictions,
            "count": len(predictions)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/process-voice-note")
def process_voice_note(req: VoiceNoteRequest):
    try:
        result = voice_processor.process_transcript(req.transcript)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
