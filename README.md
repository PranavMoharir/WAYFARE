# Wayfare — AI Travel Agent

A Python project scaffold for an MCP-powered travel agent (LangGraph / LangChain).
It integrates two MCP servers:

1. **Apify Travel MCP** (`nexgendata/travel-mcp-server`) — hosted server for hotel
   search across Booking.com / Airbnb / TripAdvisor.
2. **Custom Flight MCP** — a local MCP server (official MCP SDK) wrapping the
   RapidAPI **Sky Scrapper** flight API, exposing one tool: `search_flights`.

## Setup

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Then edit `.env` and replace the placeholders with real credentials:

```
RAPIDAPI_KEY=...        # https://rapidapi.com/apiheya/api/sky-scrapper
APIFY_API_TOKEN=...     # https://console.apify.com/account/integrations
```

## Layout

| Path | Purpose |
|------|---------|
| `flight_server/sky_scrapper.py` | Sky Scrapper client + on-disk cache logic |
| `flight_server/server.py` | Custom MCP server exposing `search_flights(origin, destination, date)` |
| `test_apify_hotels.py` | Connects to Apify Travel MCP and searches hotels |
| `test_flights.py` | Launches the flight MCP server and searches flights |
| `cache/` | Local flight-search cache (git-ignored) |

## Running the tests

```powershell
.\venv\Scripts\python.exe test_apify_hotels.py
.\venv\Scripts\python.exe test_flights.py
```

Each prints the tools the server exposes and a summary of real results. They
exit early with a clear message if the relevant key is still a placeholder.

## Flight-search cache

`search_flights` hashes its parameters (origin, destination, date, adults,
currency) and caches the raw API response under `cache/<hash>.json`. Repeated
identical searches during development are served from disk, so they don't count
against Sky Scrapper's 100-requests/month free quota. Delete files in `cache/`
(or pass `use_cache=False`) to force a fresh call.

## Notes

- Sky Scrapper needs Skyscanner `skyId`/`entityId` values (not plain IATA codes),
  so `search_flights` first resolves each place name via the `searchAirport`
  endpoint, then runs `searchFlights`.
- The Apify Travel MCP endpoint authenticates via a `?token=` query parameter and
  is billed per tool call (~$0.02), so the test does a single sample search.
