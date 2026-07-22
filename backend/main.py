from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Import the compiled LangGraph app
from graph import app as graph_app

app = FastAPI(title="Wayfare Backend")

# The frontend sends no cookies or auth headers, so credentials stay off.
# "*" origins and allow_credentials=True are mutually exclusive per the CORS
# spec — browsers reject that pairing outright.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TripRequest(BaseModel):
    origin: str
    destination: str
    dates: str
    budget: float
    num_people: int = 1
    preferences: Optional[List[str]] = None

@app.get("/")
def root():
    return {
        "message": "Backend is running!"
    }

@app.post("/plan-trip")
def plan_trip(request: TripRequest):
    initial_state = {
        "origin": request.origin,
        "destination": request.destination,
        "dates": request.dates,
        "budget": request.budget,
        "num_people": request.num_people,
        "preferences": request.preferences if request.preferences else []
    }
    
    # Run the graph synchronously and return the final state
    final_state = graph_app.invoke(initial_state)
    return final_state