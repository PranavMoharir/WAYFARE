# WAYFARE Backend — Setup Guide for Teammates

This document explains how to get the WAYFARE backend running on your own machine so you can test it locally before we wire it up to the frontend.

## What this backend does

WAYFARE is a multi-agent travel-itinerary planner. Given an origin, destination, dates, budget, and preferences, it runs a LangGraph pipeline of three agents:

1. **Researcher agent** — calls two MCP tool servers (flight search via RapidAPI's Sky Scrapper, hotel search via RapidAPI's Booking.com API) to gather real flight and hotel options. Uses Groq (`openai/gpt-oss-20b`) for tool-calling.
2. **Curator agent** — uses a RAG pipeline (Groq + local embeddings + ChromaDB, built over Wikipedia data) to recommend activities for the destination, then estimates a cost for each based on its category.
3. **Budget-enforcer agent** — pure Python, no LLM. Checks the total cost (cheapest flight + cheapest hotel + activities) against the budget. If it's over, it drops the single most expensive activity and retries, repeating until the trip fits the budget or it's provably infeasible (even with zero activities, the flight+hotel floor exceeds budget).

The whole thing is a compiled LangGraph `app` object (`backend/graph.py`) that you can call with `app.invoke(input_dict)`. A FastAPI layer wrapping this for the frontend is planned next — this guide covers getting the underlying agent pipeline running and testable on its own first.

> Note: this project originally used Gemini for both agents, then migrated fully to Groq (`openai/gpt-oss-20b`) — Groq's free tier is far more generous and the model responds roughly 13x faster on the raw LLM call. If you see any references to Gemini/`GEMINI_API_KEY` elsewhere (old commits, stale comments), they're leftover from before the migration and no longer apply.

## Prerequisites

* Python 3.11 or newer
* Git
* A free [RapidAPI](https://rapidapi.com/) account
* A free [Groq](https://console.groq.com/) account (no credit card required)
* ~500MB free disk space (for the local embedding model and vector DB cache)

### 1. Clone and enter the backend folder

```bash
git clone <repo-url>
cd WAYFARE/backend
```

### 2. Create and activate a virtual environment

Windows:

```bash
python -m venv venv
venv\Scripts\activate
```

Mac/Linux:

```bash
python3 -m venv venv
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

This pulls in LangGraph, the MCP adapters, `langchain-groq`, sentence-transformers, and ChromaDB. The first time sentence-transformers runs, it downloads the `BAAI/bge-small-en-v1.5` embedding model (~34MB) automatically from HuggingFace — no action needed, just don't be alarmed by the download progress bar on first run.

### 4. Get your API keys

You need your own keys — do not reuse anyone else's, and never commit real keys to the repo.

**Groq API key** (powers both the researcher's tool-calling and the curator's activity recommendations):

1. Go to [console.groq.com](https://console.groq.com/)
2. Sign up (no credit card needed) and generate an API key
3. Groq's free tier is generous (30 requests/minute, 14,400 requests/day per model) — you're unlikely to hit limits during normal testing.

**RapidAPI key** (powers real flight and hotel search):

1. Sign up at [rapidapi.com](https://rapidapi.com/)
2. Subscribe (free tier) to the flight search API ("Sky Scrapper") and the hotel search API (Booking.com via the DataCrawler provider) — check `mcp_servers/flight_server/sky_scrapper.py` and `mcp_servers/hotel_server/booking_com.py` for the exact API names/hosts they call if you need to find the right listing.
3. Copy your RapidAPI key from your dashboard.

### 5. Set up your `.env` file

Copy the example file and fill in your own keys:

```bash
cp .env.example .env
```

Then edit `backend/.env`:

```
GROQ_API_KEY=your_key_here
RAPIDAPI_KEY=your_key_here
```

(If `.env.example` doesn't exist yet in your checkout, check `mcp_servers/flight_server/sky_scrapper.py`, `mcp_servers/hotel_server/booking_com.py`, and `services/groq_service.py` for the exact `os.getenv(...)` calls — those are the authoritative list of what's actually required.)

Optional: `HF_TOKEN` (a free HuggingFace token) isn't required, but without it you'll see a rate-limit warning when the embedding model downloads. Get one at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) if you want to silence that.

### 6. Run the smoke test

```bash
python test_graph.py
```

This runs the full pipeline once with a sample trip (Mumbai → Goa) and prints the final state. Expect:

* First run: slower (~60-90 seconds) — the curator has to build and index the RAG corpus for the destination the first time. The Groq calls themselves are fast (well under a second each); the delay is the corpus build (Wikipedia fetch + embedding), not the LLM.
* Subsequent runs for the same destination: faster (~20-30 seconds) — the corpus is cached on disk in `backend/chroma_db/`.

You should see real flight options, real hotel options, a list of recommended activities with categories and estimated costs, and a final `budget_check_passed` / `budget_infeasible` / `round_count` summary.

## Known limitations (so you're not surprised)

* Activity costs are category-based estimates, not live prices (Museum → ₹300, Local Experience → ₹800, most public sites → ₹0, etc.) — there's no reliable free API for real per-attraction ticket prices, so this is a documented, deliberate simplification.
* The RAG corpus build (first call per destination) depends on Wikipedia being reachable — if you're on a restricted network, that step will fail.
* `gpt-oss-20b` occasionally returns empty content on higher reasoning effort — the curator's Groq calls are configured with `reasoning_effort="low"` to avoid this; if you see empty/malformed activity lists, that setting is the first thing to check.

## Questions

Ping the team channel if any of these steps don't match what's actually in the repo when you pull it — this guide was written alongside the code, so it should be accurate, but folder layout may keep shifting until the FastAPI wrapper lands.
