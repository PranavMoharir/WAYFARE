"""Custom MCP server that wraps the Sky Scrapper flight API.

Built with the official MCP Python SDK (``mcp.server.fastmcp``). It exposes a
single tool, ``search_flights(origin, destination, date)``, and runs over stdio
so any MCP client (Claude Desktop, langchain-mcp-adapters, etc.) can launch it.

Run standalone:  python flight_server/server.py
"""

from __future__ import annotations

from typing import Any

import requests
from mcp.server.fastmcp import FastMCP

# Support running both as a module (python -m flight_server.server) and as a
# script (python flight_server/server.py).
try:
    from .sky_scrapper import SkyScrapperError, search_flights as _search_flights
except ImportError:  # pragma: no cover - script execution fallback
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from sky_scrapper import SkyScrapperError, search_flights as _search_flights

mcp = FastMCP("wayfare-flights")


@mcp.tool()
def search_flights(origin: str, destination: str, date: str) -> dict[str, Any]:
    """Search one-way flights.

    Args:
        origin: Departure city or airport, e.g. "New York" or "JFK".
        destination: Arrival city or airport, e.g. "London" or "LHR".
        date: Departure date in YYYY-MM-DD format.

    Returns:
        A dict with a ``flights`` list (price, airline, times, stops), the
        resolved airport ids, and whether the result came from the API or the
        local dev cache.

        On failure the same shape is returned with an empty ``flights`` list
        plus ``error``/``error_kind``, so the caller can tell a broken call
        apart from a search that genuinely found nothing.
    """
    try:
        return _search_flights(origin, destination, date)
    except SkyScrapperError as exc:
        return {"error": str(exc), "error_kind": "api_error", "flights": []}
    except requests.HTTPError as exc:
        # raise_for_status() on a non-2xx. 429 is the RapidAPI monthly quota,
        # which is the failure this wrapper most often sees.
        status = exc.response.status_code if exc.response is not None else None
        return {
            "error": f"Sky Scrapper HTTP {status}: {exc}",
            "error_kind": "quota_exceeded" if status == 429 else "http_error",
            "status_code": status,
            "flights": [],
        }
    except requests.RequestException as exc:
        return {
            "error": f"Sky Scrapper request failed: {exc!r}",
            "error_kind": "network_error",
            "flights": [],
        }


if __name__ == "__main__":
    mcp.run(transport="stdio")
