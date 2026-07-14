"""Booking.com (RapidAPI, booking-com15) client with a local file-based cache.

Mirrors the structure of ``flight_server/sky_scrapper.py``: the pure business
logic lives here so it can be reused by both the MCP server (``server.py``) and
the test scripts. The two-step Booking.com flow is:

    1. ``/api/v1/hotels/searchDestination`` — resolve a human city name into a
       Booking.com ``dest_id`` (+ its ``search_type``).
    2. ``/api/v1/hotels/searchHotels`` — run the actual search using that id,
       with ``currency_code`` explicitly set to INR.

Every successful ``search_hotels`` result is cached on disk keyed by the search
parameters, so repeated identical searches during development don't burn the
free RapidAPI quota.

Note: the endpoint paths given match the DataCrawler ``booking-com15`` API
(host ``booking-com15.p.rapidapi.com``), which is what this module targets.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv

load_dotenv()

RAPIDAPI_HOST = "booking-com15.p.rapidapi.com"
BASE_URL = f"https://{RAPIDAPI_HOST}"
CACHE_DIR = Path(__file__).resolve().parent.parent / "cache"
REQUEST_TIMEOUT = 30  # seconds


class BookingComError(RuntimeError):
    """Raised when the Booking.com API cannot fulfil a request."""


def _headers() -> dict[str, str]:
    key = os.getenv("RAPIDAPI_KEY", "").strip()
    if not key or key == "your_rapidapi_key_here":
        raise BookingComError(
            "RAPIDAPI_KEY is missing or still a placeholder. "
            "Set a real key in the .env file."
        )
    return {"x-rapidapi-key": key, "x-rapidapi-host": RAPIDAPI_HOST}


# --------------------------------------------------------------------------- #
# Local cache (same pattern as the flight server)
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


# --------------------------------------------------------------------------- #
# Booking.com API calls
# --------------------------------------------------------------------------- #
def _resolve_destination(query: str) -> dict[str, str]:
    """Return the top ``{dest_id, search_type, name}`` match for a place name."""
    resp = requests.get(
        f"{BASE_URL}/api/v1/hotels/searchDestination",
        headers=_headers(),
        params={"query": query},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    body = resp.json()
    data = body.get("data") or []
    if not data:
        raise BookingComError(f"No destination match for {query!r}.")
    top = data[0]
    dest_id = top.get("dest_id")
    search_type = top.get("search_type") or top.get("dest_type")
    if not dest_id or not search_type:
        raise BookingComError(f"Destination match for {query!r} was missing ids: {top}")
    name = top.get("name") or top.get("label") or query
    return {"dest_id": str(dest_id), "search_type": str(search_type), "name": name}


def _nights_between(checkin: str, checkout: str) -> int:
    """Number of nights between two YYYY-MM-DD dates (minimum 1)."""
    try:
        d1 = datetime.strptime(checkin, "%Y-%m-%d").date()
        d2 = datetime.strptime(checkout, "%Y-%m-%d").date()
        return max((d2 - d1).days, 1)
    except (ValueError, TypeError):
        return 1


def _summarize_hotels(payload: dict[str, Any], nights: int) -> list[dict[str, Any]]:
    """Flatten the verbose Booking.com response into a clean list of hotels."""
    hotels = ((payload.get("data") or {}).get("hotels")) or []
    out: list[dict[str, Any]] = []
    for h in hotels:
        prop = h.get("property") or {}

        # Price: Booking returns a gross price for the whole stay; derive per-night.
        price_block = prop.get("priceBreakdown") or h.get("priceBreakdown") or {}
        gross = (price_block.get("grossPrice") or {}).get("value")
        price_per_night = round(gross / nights) if isinstance(gross, (int, float)) else None

        # Distance from city centre is only present on some results.
        distance = prop.get("distanceFromCentre") or prop.get("distance") or h.get("distance")

        out.append(
            {
                "name": prop.get("name") or h.get("name"),
                "price_per_night": price_per_night,
                "rating": prop.get("reviewScore"),
                "distance": distance,
            }
        )
    return out


def search_hotels(
    destination: str,
    checkin: str,
    checkout: str,
    adults: int = 2,
    currency: str = "INR",
    use_cache: bool = True,
) -> dict[str, Any]:
    """Search hotels in ``destination`` between ``checkin`` and ``checkout``.

    ``destination`` is a city name (e.g. "Goa"); ``checkin`` / ``checkout`` are
    ``YYYY-MM-DD`` dates. Prices are requested in ``currency`` (INR by default).
    Returns a dict with a ``hotels`` summary list plus metadata. Results are
    cached on disk.
    """
    cache_params = {
        "destination": destination.strip().lower(),
        "checkin": checkin,
        "checkout": checkout,
        "adults": adults,
        "currency": currency,
    }
    key = _cache_key(cache_params)
    nights = _nights_between(checkin, checkout)

    if use_cache:
        cached = _read_cache(key)
        if cached is not None:
            summary = _summarize_hotels(cached["response"], nights)
            return {
                "source": "cache",
                "cache_key": key,
                "query": cache_params,
                "currency": currency,
                "nights": nights,
                "count": len(summary),
                "hotels": summary,
            }

    dest = _resolve_destination(destination)

    resp = requests.get(
        f"{BASE_URL}/api/v1/hotels/searchHotels",
        headers=_headers(),
        params={
            "dest_id": dest["dest_id"],
            "search_type": dest["search_type"],
            "arrival_date": checkin,
            "departure_date": checkout,
            "adults": adults,
            "room_qty": 1,
            "page_number": 1,
            "currency_code": currency,  # explicitly INR, not USD
            "languagecode": "en-us",
            "units": "metric",
        },
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    payload = resp.json()
    if not payload.get("status", False):
        raise BookingComError(f"Booking.com returned an error payload: {payload}")

    _write_cache(key, cache_params, payload)
    summary = _summarize_hotels(payload, nights)
    return {
        "source": "api",
        "cache_key": key,
        "query": cache_params,
        "resolved": dest,
        "currency": currency,
        "nights": nights,
        "count": len(summary),
        "hotels": summary,
    }
