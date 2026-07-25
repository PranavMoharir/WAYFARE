import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Import the compiled LangGraph app
from graph import app as graph_app

# ── Rate limiting ────────────────────────────────────────────────────────────
# /plan-trip is expensive: each call burns RapidAPI quota (only 20 req/month)
# and Groq tokens, and can run a 60-90s RAG corpus build. Without a cap, a
# single client could exhaust the monthly quota or the server in minutes, so we
# throttle per client IP. Override the limit with the PLAN_TRIP_RATE_LIMIT env
# var (any slowapi limit string, e.g. "5/minute" or "3/minute;100/day").
#
# Storage is in-memory, i.e. per process. If you run multiple workers/replicas,
# point slowapi at a shared store (e.g. Redis via storage_uri) so the limit is
# enforced globally rather than per worker. Behind a reverse proxy, the client
# IP is the proxy's unless it forwards the real one — configure trusted
# X-Forwarded-For handling there for accurate per-client limits.
PLAN_TRIP_RATE_LIMIT = os.getenv("PLAN_TRIP_RATE_LIMIT", "10/minute")

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Wayfare Backend")
app.state.limiter = limiter
# Returns HTTP 429 (with a Retry-After header) when a client exceeds the limit.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
@limiter.limit(PLAN_TRIP_RATE_LIMIT)
def plan_trip(request: Request, payload: TripRequest):
    # ``request`` is required by slowapi to identify the caller (its IP); the
    # trip data comes in as ``payload``. The limit is checked before this body
    # runs, so a throttled request never triggers the expensive graph invoke.
    initial_state = {
        "origin": payload.origin,
        "destination": payload.destination,
        "dates": payload.dates,
        "budget": payload.budget,
        "num_people": payload.num_people,
        "preferences": payload.preferences if payload.preferences else []
    }

    # Run the graph synchronously and return the final state
    final_state = graph_app.invoke(initial_state)
    return final_state
