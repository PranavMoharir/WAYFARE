# Curator Agent — LangGraph Integration Guide

This document is for the teammate building the LangGraph orchestration.
You only need to read this file — no knowledge of the internal RAG implementation is required.

---

## What the Curator Agent Does

Given a destination, a list of user preferences, and a trip duration, the agent returns a structured JSON list of recommended local activities grounded in real Wikipedia data.

It handles its own knowledge base — no setup required on your end.

---

## The One Import You Need

```python
from agents.curator import recommend_activities
```

Run this from the `backend/` directory (or add `backend/` to your Python path).

---

## Function Signature

```python
def recommend_activities(
    destination: str,        # e.g. "Paris", "Kyoto", "Cape Town"
    preferences: list[str],  # e.g. ["art", "history", "local food"]
    days: int,               # e.g. 3
) -> dict:
```

---

## Return Schema

```json
{
  "destination": "Paris",
  "days": 3,
  "activities": [
    {
      "name": "Musée d'Orsay",
      "reason": "Houses the world's largest Impressionist collection — ideal for art lovers.",
      "estimated_duration": "2-3 hours",
      "category": "Museum"
    },
    {
      "name": "Arc de Triomphe",
      "reason": "Iconic monument honouring those who fought in the Napoleonic Wars.",
      "estimated_duration": "1-2 hours",
      "category": "Landmark"
    }
  ]
}
```

### Activity fields

| Field | Type | Description |
|---|---|---|
| `name` | `str` | Attraction name as it appears in Wikipedia |
| `reason` | `str` | 1-2 sentence explanation personalised to the user preferences |
| `estimated_duration` | `str` | Human-readable time estimate |
| `category` | `str` | One of: Museum, Park, Landmark, Historic Landmark, Religious Site, Local Experience, Nature, Attraction |

---

## LangGraph Node Example

```python
from agents.curator import recommend_activities
from langgraph.graph import StateGraph
from typing import TypedDict

class TravelState(TypedDict):
    destination: str
    preferences: list[str]
    days: int
    local_activities: dict   # populated by the curator node


def curator_node(state: TravelState) -> TravelState:
    result = recommend_activities(
        destination=state["destination"],
        preferences=state["preferences"],
        days=state["days"],
    )
    return {**state, "local_activities": result}


# Wire into your graph
builder = StateGraph(TravelState)
builder.add_node("curator", curator_node)
# ... add your other nodes (flights, budget, booking) and edges
```

---

## Caching Behaviour

| Call | Behaviour | Typical Duration |
|---|---|---|
| First call for a destination | Builds Wikipedia corpus + ingests into ChromaDB | ~90 seconds |
| Any subsequent call | Skips corpus build, uses cached embeddings | ~20 seconds |

The cache is persistent on disk (`backend/chroma_db/`). It survives server restarts.
You do not need to pre-warm it — the agent handles corpus build automatically on first call.

---

## Combining with Other Agents

The curator output is a plain Python `dict`. Merge it into your LangGraph state alongside the flights and budget outputs:

```python
# Example combined state after all agents run
final_state = {
    "destination": "Paris",
    "days": 3,
    "flights": { ... },           # from Flights Agent
    "budget": { ... },            # from Budget Agent
    "local_activities": {         # from Curator Agent
        "destination": "Paris",
        "days": 3,
        "activities": [ ... ]
    }
}
```

---

## Environment Setup

The curator agent requires one environment variable. Create `backend/.env` from the provided template:

```bash
cp backend/.env.example backend/.env
# Then fill in your GEMINI_API_KEY
```

Install dependencies:

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
```

The embedding model (`BAAI/bge-small-en-v1.5`) downloads automatically from HuggingFace on first run (~34MB).

---

## Error Handling

The function raises:
- `google.genai.errors.ClientError` — if the Gemini API key is invalid or quota is exhausted
- `json.JSONDecodeError` — if Gemini returns malformed JSON (rare; handled by prompt constraints)
- `requests.exceptions.ConnectionError` — if the machine has no internet (Wikipedia fetch)

Wrap the call in a try/except in your node if you need graceful degradation:

```python
def curator_node(state: TravelState) -> TravelState:
    try:
        result = recommend_activities(
            destination=state["destination"],
            preferences=state["preferences"],
            days=state["days"],
        )
    except Exception as e:
        result = {"destination": state["destination"], "days": state["days"], "activities": [], "error": str(e)}
    return {**state, "local_activities": result}
```

---

## Quick Smoke Test

To verify the agent works before integrating:

```bash
cd backend
venv\Scripts\activate
python test.py
```

Expected: a JSON block with a non-empty `"activities"` list printed to stdout.
