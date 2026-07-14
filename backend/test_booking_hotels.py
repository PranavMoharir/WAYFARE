"""End-to-end test for the Booking.com-backed hotel MCP server.

Launches ``mcp_servers/hotel_server/server.py`` over stdio via langchain-mcp-adapters,
discovers its tools, and calls ``search_hotels`` for a sample destination.
Confirms real hotel data with INR pricing comes back (or a cached copy, to
protect the free RapidAPI quota).

Run:  python test_booking_hotels.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from langchain_mcp_adapters.client import MultiServerMCPClient

load_dotenv()

# Hotel names/prices can contain non-cp1252 characters (₹, accented letters);
# force UTF-8 so printing them does not crash or mangle on Windows' console.
sys.stdout.reconfigure(encoding="utf-8")

SERVER = str(Path(__file__).resolve().parent / "mcp_servers" / "hotel_server" / "server.py")

# Sample search — change freely.
DESTINATION = "Goa"
CHECKIN = "2026-09-15"
CHECKOUT = "2026-09-18"
MAX_RESULTS = 10


def extract(result: object) -> object:
    """Normalize an MCP tool result (dict, JSON string, or content-block list)."""
    if isinstance(result, str):
        try:
            return extract(json.loads(result))
        except (json.JSONDecodeError, ValueError):
            return result
    if isinstance(result, list):
        for block in result:
            if isinstance(block, dict) and block.get("type") == "text":
                return extract(block.get("text"))
        return result
    return result


async def main() -> int:
    if os.getenv("RAPIDAPI_KEY", "").strip() in ("", "your_rapidapi_key_here"):
        print("RAPIDAPI_KEY is not set in .env — put your real key there first.")
        return 1

    client = MultiServerMCPClient(
        {
            "hotels": {
                "command": sys.executable,
                "args": [SERVER],
                "transport": "stdio",
            }
        }
    )

    tools = await client.get_tools()
    print(f"Tools exposed by the hotel MCP server: {[t.name for t in tools]}")

    tool = next((t for t in tools if t.name == "search_hotels"), None)
    if tool is None:
        print("ERROR: search_hotels tool not found on the server.")
        return 1

    print(f"\nSearching hotels in {DESTINATION} ({CHECKIN} -> {CHECKOUT}) ...")
    result = extract(
        await tool.ainvoke(
            {
                "destination": DESTINATION,
                "checkin": CHECKIN,
                "checkout": CHECKOUT,
                "max_results": MAX_RESULTS,
            }
        )
    )

    if not isinstance(result, dict):
        print(f"Unexpected result shape: {result!r}")
        return 1

    if result.get("error"):
        print(f"Search returned an error: {result['error']}")
        return 1

    hotels = result.get("hotels", [])
    print(f"Source: {result.get('source')}   Currency: {result.get('currency')}   "
          f"Nights: {result.get('nights')}   Results: {len(hotels)}")
    for i, h in enumerate(hotels, 1):
        price = h.get("price_per_night")
        price_str = f"INR {price:>7,}/night" if isinstance(price, (int, float)) else "price N/A"
        dist = h.get("distance")
        dist_str = f" | {dist}" if dist else ""
        print(f"  {i}. {str(h.get('name'))[:38]:<38} {price_str} | "
              f"rating {h.get('rating')}{dist_str}")

    # Confirm we actually got INR-priced results back.
    has_inr_price = any(isinstance(h.get("price_per_night"), (int, float)) for h in hotels)
    if hotels and result.get("currency") == "INR" and has_inr_price:
        print("\nPASS: real hotel results with INR pricing came back.")
        return 0
    if hotels:
        print("\nPARTIAL: hotels returned but no INR price parsed — inspect the payload.")
        return 1
    print("\nFAIL: no hotels returned.")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
