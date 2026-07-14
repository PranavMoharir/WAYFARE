"""Custom MCP server exposing live Booking.com hotel search.

Built with the official MCP Python SDK (``mcp.server.fastmcp``), following the
same pattern as ``flight_server/server.py``. It exposes a single tool,
``search_hotels(destination, checkin, checkout, max_results)``, backed by the
RapidAPI Booking.com API, and runs over stdio so any MCP client can launch it.

Run standalone:  python hotel_server/server.py
"""

from __future__ import annotations

from typing import Any

from mcp.server.fastmcp import FastMCP

# Support running both as a module (python -m hotel_server.server) and as a
# script (python hotel_server/server.py).
try:
    from .booking_com import BookingComError, search_hotels as _search_hotels
except ImportError:  # pragma: no cover - script execution fallback
    import sys
    from pathlib import Path

    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from booking_com import BookingComError, search_hotels as _search_hotels

mcp = FastMCP("wayfare-hotels")


@mcp.tool()
def search_hotels(
    destination: str,
    checkin: str,
    checkout: str,
    max_results: int = 20,
) -> dict[str, Any]:
    """Search hotels for a destination via Booking.com.

    Args:
        destination: City name, e.g. "Goa", "Jaipur", "Mumbai", "Barcelona".
        checkin: Check-in date in YYYY-MM-DD format.
        checkout: Check-out date in YYYY-MM-DD format.
        max_results: Maximum number of hotels to return (default 20).

    Returns:
        A dict with a ``hotels`` list; each hotel has ``name``,
        ``price_per_night`` (INR), ``rating``, and ``distance``.
    """
    try:
        result = _search_hotels(destination, checkin, checkout)
        result["hotels"] = result.get("hotels", [])[:max_results]
        result["count"] = len(result["hotels"])
        return result
    except BookingComError as exc:
        return {"error": str(exc), "hotels": []}


if __name__ == "__main__":
    mcp.run(transport="stdio")
