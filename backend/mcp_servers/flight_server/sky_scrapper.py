"""Sky Scrapper (RapidAPI) client with a local file-based cache.

This module holds the pure business logic so it can be reused by both the MCP
server (``server.py``) and the test scripts. The two-step Sky Scrapper flow is:

    1. ``/api/v1/flights/searchAirport`` — resolve a human city/airport name into
       Skyscanner's ``skyId`` + ``entityId`` (these are NOT plain IATA codes).
    2. ``/api/v1/flights/searchFlights`` — run the actual search using those ids.

Both steps are cached on disk so development doesn't burn the monthly quota:
``search_flights`` results are keyed by the search parameters, and step 1's
airport resolutions are cached separately under ``airport_*`` keys. Step 1 runs
twice per search (origin + destination), so an uncached search costs three
requests; with airports cached that drops to one.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

RAPIDAPI_HOST = "sky-scrapper.p.rapidapi.com"
BASE_URL = f"https://{RAPIDAPI_HOST}"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
REQUEST_TIMEOUT = 30  # seconds


class SkyScrapperError(RuntimeError):
    """Raised when the Sky Scrapper API cannot fulfil a request."""


def _headers() -> dict[str, str]:
    key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not key or key == "your_rapidapi_key_here":
        raise SkyScrapperError(
            "RAPIDAPI_KEY is missing or still a placeholder. "
            "Set a real key in the .env file."
        )
    return {"x-rapidapi-key": key, "x-rapidapi-host": RAPIDAPI_HOST}


# --------------------------------------------------------------------------- #
# Local cache
# --------------------------------------------------------------------------- #
def _cache_key(params: dict[str, Any]) -> str:
    """Deterministic hash of the search parameters."""
    blob = json.dumps(params, sort_keys=True)
    return hashlib.sha256(blob.encode()).hexdigest()[:16]


def _cache_path(key: str) -> Path:
    return CACHE_DIR / f"{key}.json"


def _read_cache(key: str) -> dict[str, Any] | None:
    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None


def _write_cache(key: str, params: dict[str, Any], payload: dict[str, Any]) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    record = {"cached_at": time.time(), "params": params, "response": payload}
    _cache_path(key).write_text(json.dumps(record, indent=2), encoding="utf-8")


def _airport_cache_path(query: str) -> Path:
    """Cache file for one resolved airport lookup.

    Kept in a separate ``airport_`` namespace so these entries are easy to tell
    apart from cached flight searches when browsing the cache directory.
    """
    key = _cache_key({"airport_query": query.strip().lower()})
    return CACHE_DIR / f"airport_{key}.json"


# --------------------------------------------------------------------------- #
# Sky Scrapper API calls
# --------------------------------------------------------------------------- #
def _resolve_airport(query: str, *, use_cache: bool = True) -> dict[str, str]:
    """Return the top ``{skyId, entityId, name}`` match for a place name.

    Cached on disk. This lookup runs twice per search (origin + destination),
    so on the 20-requests/month BASIC plan it accounted for two of the three
    requests every uncached search burned. A city's skyId/entityId are stable
    identifiers, so entries are kept indefinitely — delete the ``airport_*``
    files in the cache directory to force a refresh.
    """
    path = _airport_cache_path(query)
    if use_cache and path.exists():
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            cached = record.get("resolved") or {}
            if cached.get("skyId") and cached.get("entityId"):
                return cached
        except (json.JSONDecodeError, OSError):
            pass  # unreadable/corrupt entry — fall through to a live lookup

    resp = requests.get(
        f"{BASE_URL}/api/v1/flights/searchAirport",
        headers=_headers(),
        params={"query": query, "locale": "en-US"},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    data = body.get("data") or []
    if not data:
        raise SkyScrapperError(f"No airport/city match for {query!r}.")
    top = data[0]
    # The ids Skyscanner needs live under navigation.relevantFlightParams;
    # fall back to any top-level fields just in case the shape varies.
    flight_params = (top.get("navigation") or {}).get("relevantFlightParams") or {}
    sky_id = flight_params.get("skyId") or top.get("skyId")
    entity_id = (
        flight_params.get("entityId")
        or (top.get("navigation") or {}).get("entityId")
        or top.get("entityId")
    )
    if not sky_id or not entity_id:
        raise SkyScrapperError(f"Airport match for {query!r} was missing ids: {top}")
    name = (top.get("presentation") or {}).get("title", query)

    resolved = {"skyId": sky_id, "entityId": entity_id, "name": name}
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {"cached_at": time.time(), "query": query, "resolved": resolved},
            indent=2,
        ),
        encoding="utf-8",
    )
    return resolved


def _summarize_itineraries(payload: dict[str, Any], limit: int = 5) -> list[dict[str, Any]]:
    """Flatten the verbose Sky Scrapper response into a few readable flights."""
    itineraries = (payload.get("data") or {}).get("itineraries") or []
    out: list[dict[str, Any]] = []
    for it in itineraries[:limit]:
        legs = it.get("legs") or []
        leg = legs[0] if legs else {}
        carriers = ((leg.get("carriers") or {}).get("marketing")) or []
        out.append(
            {
                "price": (it.get("price") or {}).get("formatted"),
                "airline": carriers[0].get("name") if carriers else None,
                "departure": leg.get("departure"),
                "arrival": leg.get("arrival"),
                "duration_minutes": leg.get("durationInMinutes"),
                "stops": leg.get("stopCount"),
            }
        )
    return out


def search_flights(
    origin: str,
    destination: str,
    date: str,
    *,
    adults: int = 1,
    currency: str = "INR",
    use_cache: bool = True,
) -> dict[str, Any]:
    """Search one-way flights from ``origin`` to ``destination`` on ``date``.

    ``origin`` / ``destination`` are human names or codes (e.g. "New York",
    "JFK", "London"); ``date`` is ``YYYY-MM-DD``. Returns a dict with a short
    ``flights`` summary list plus metadata. Results are cached on disk.
    """
    cache_params = {
        "origin": origin.strip().lower(),
        "destination": destination.strip().lower(),
        "date": date,
        "adults": adults,
        "currency": currency,
    }
    key = _cache_key(cache_params)

    if use_cache:
        cached = _read_cache(key)
        if cached is not None:
            summary = _summarize_itineraries(cached["response"])
            return {
                "source": "cache",
                "cache_key": key,
                "query": cache_params,
                "count": len(summary),
                "flights": summary,
            }

    origin_ap = _resolve_airport(origin, use_cache=use_cache)
    dest_ap = _resolve_airport(destination, use_cache=use_cache)

    resp = requests.get(
        f"{BASE_URL}/api/v1/flights/searchFlights",
        headers=_headers(),
        params={
            "originSkyId": origin_ap["skyId"],
            "destinationSkyId": dest_ap["skyId"],
            "originEntityId": origin_ap["entityId"],
            "destinationEntityId": dest_ap["entityId"],
            "date": date,
            "adults": adults,
            "currency": currency,
            "market": "en-IN",
            "countryCode": "IN",
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json()
    if not payload.get("status", False):
        raise SkyScrapperError(f"Sky Scrapper returned an error payload: {payload}")

    _write_cache(key, cache_params, payload)
    summary = _summarize_itineraries(payload)
    return {
        "source": "api",
        "cache_key": key,
        "query": cache_params,
        "resolved": {"origin": origin_ap, "destination": dest_ap},
        "count": len(summary),
        "flights": summary,
    }
