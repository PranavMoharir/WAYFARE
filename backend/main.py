from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Import the compiled LangGraph app
from graph import app as graph_app

app = FastAPI(title="Wayfare Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TripRequest(BaseModel):
    origin: str
    destination: str
    dates: str
    budget: float
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
        "preferences": request.preferences if request.preferences else []
    }
    
    # Run the graph synchronously and return the final state
    final_state = graph_app.invoke(initial_state)
    return final_state