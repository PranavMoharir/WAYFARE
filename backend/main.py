import asyncio
import logging
import math
import os
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Import the compiled LangGraph app
from graph import app as graph_app

logger = logging.getLogger("wayfare")

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

# ── Concurrency + timeout ────────────────────────────────────────────────────
# graph_app.invoke() is a synchronous, 60-90s CPU/IO job. Run it in a bounded
# thread pool so at most PLAN_TRIP_MAX_CONCURRENCY plans run at once (extra
# requests get 503 rather than piling up and exhausting the server), and cap
# each with a wall-clock timeout (504) so a stuck upstream can't tie a slot up
# forever. Both are env-tunable.
PLAN_TRIP_MAX_CONCURRENCY = int(os.getenv("PLAN_TRIP_MAX_CONCURRENCY", "2"))
PLAN_TRIP_TIMEOUT_SECONDS = float(os.getenv("PLAN_TRIP_TIMEOUT_SECONDS", "150"))
_plan_executor = ThreadPoolExecutor(
    max_workers=PLAN_TRIP_MAX_CONCURRENCY, thread_name_prefix="plan-trip"
)
_plan_slots = asyncio.Semaphore(PLAN_TRIP_MAX_CONCURRENCY)

# ── CORS ─────────────────────────────────────────────────────────────────────
# Only allow the frontend origin(s) to call the API from a browser, rather than
# any site ("*"). Comma-separated allowlist; defaults to local dev. In
# production set ALLOWED_ORIGINS to your deployed frontend origin(s), e.g.
# "https://wayfare.example.com".
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:5174"
    ).split(",")
    if o.strip()
]

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="Wayfare Backend")
app.state.limiter = limiter
# Returns HTTP 429 (with a Retry-After header) when a client exceeds the limit.
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Restrict CORS to the known frontend origin(s). The frontend sends no cookies
# or auth headers, so credentials stay off; methods/headers are narrowed to
# what the app actually uses (GET / and POST /plan-trip with a JSON body).
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

class TripRequest(BaseModel):
    # Bound every field so a caller can't send absurd values (huge budgets,
    # thousands of travellers, megabyte strings) into the graph and the
    # downstream APIs/LLM prompts. Invalid input is rejected with HTTP 422.
    origin: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=100)
    dates: str = Field(min_length=1, max_length=100)
    budget: float = Field(gt=0, le=1_000_000_000)
    num_people: int = Field(default=1, ge=1, le=20)
    preferences: Optional[List[str]] = Field(default=None, max_length=20)

    @field_validator("origin", "destination", "dates")
    @classmethod
    def _stripped_nonblank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("must not be blank")
        return v

    @field_validator("budget")
    @classmethod
    def _finite_budget(cls, v: float) -> float:
        if not math.isfinite(v):
            raise ValueError("must be a finite number")
        return v

    @field_validator("preferences")
    @classmethod
    def _clean_preferences(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        cleaned = [p.strip() for p in v if isinstance(p, str) and p.strip()]
        if any(len(p) > 50 for p in cleaned):
            raise ValueError("each preference must be at most 50 characters")
        return cleaned


# Fields from the graph's final state that are safe to return to the client.
# Everything else (notably ``research_errors``, which holds raw upstream API
# error strings and endpoint URLs) stays server-side.
_PUBLIC_FIELDS = (
    "origin", "destination", "dates", "budget", "num_people", "preferences",
    "flight_options", "hotel_options", "activities", "current_proposal",
    "budget_check_passed", "budget_infeasible", "data_incomplete",
    "incomplete_reason", "round_count",
)

# Shown to users instead of the graph's detailed ``incomplete_reason`` (which
# echoes upstream HTTP errors and API URLs). The detail is logged, not returned.
_GENERIC_INCOMPLETE_REASON = (
    "We couldn't retrieve live flight or hotel data for this trip right now. "
    "Please try again in a little while."
)


def _public_response(state: dict) -> dict:
    """Return only client-safe fields, with a sanitised incomplete reason.

    Whitelisting (rather than returning the full state) keeps internal
    diagnostics — and any future internal fields — from leaking to the client.
    """
    if state.get("research_errors") or state.get("data_incomplete"):
        logger.warning(
            "plan-trip incomplete/errors: reason=%r research_errors=%r",
            state.get("incomplete_reason"),
            state.get("research_errors"),
        )
    public = {k: state[k] for k in _PUBLIC_FIELDS if k in state}
    if public.get("data_incomplete"):
        public["incomplete_reason"] = _GENERIC_INCOMPLETE_REASON
    return public

@app.get("/")
def root():
    return {
        "message": "Backend is running!"
    }

@app.post("/plan-trip")
@limiter.limit(PLAN_TRIP_RATE_LIMIT)
async def plan_trip(request: Request, payload: TripRequest):
    # ``request`` is required by slowapi to identify the caller (its IP); the
    # trip data comes in as ``payload``. The rate limit is checked before this
    # body runs, so a throttled request never triggers the expensive work.
    if _plan_slots.locked():
        raise HTTPException(
            status_code=503,
            detail="The trip planner is busy right now. Please try again shortly.",
        )

    initial_state = {
        "origin": payload.origin,
        "destination": payload.destination,
        "dates": payload.dates,
        "budget": payload.budget,
        "num_people": payload.num_people,
        "preferences": payload.preferences if payload.preferences else []
    }

    # Offload the blocking graph run to the bounded pool with a timeout, so a
    # single request can't hold a worker forever and concurrency stays capped.
    async with _plan_slots:
        loop = asyncio.get_running_loop()
        try:
            final_state = await asyncio.wait_for(
                loop.run_in_executor(_plan_executor, graph_app.invoke, initial_state),
                timeout=PLAN_TRIP_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("plan-trip timed out after %ss", PLAN_TRIP_TIMEOUT_SECONDS)
            raise HTTPException(
                status_code=504,
                detail="Trip planning took too long. Please try again.",
            )

    return _public_response(final_state)
