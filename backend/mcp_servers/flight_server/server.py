"""Custom MCP server that wraps the Sky Scrapper flight API.

Built with the official MCP Python SDK (``mcp.server.fastmcp``). It exposes a
single tool, ``search_flights(origin, destination, date)``, and runs over stdio
so any MCP client (Claude Desktop, langchain-mcp-adapters, etc.) can launch it.

Run standalone:  python flight_server/server.py
"""

from __future__ import annotations

from typing import Any

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
    """
    try:
        return _search_flights(origin, destination, date)
    except SkyScrapperError as exc:
        return {"error": str(exc), "flights": []}


if __name__ == "__main__":
    mcp.run(transport="stdio")
