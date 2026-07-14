"""End-to-end test for the custom Sky Scrapper MCP server.

Launches ``mcp_servers/flight_server/server.py`` over stdio via langchain-mcp-adapters,
discovers its tools, and calls ``search_flights`` for a sample route. Confirms
real flight results come back (or a cached copy, to protect the free quota).

Run:  python test_flights.py
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

# Flight prices come back with the ₹ symbol; force UTF-8 so printing them does
# not crash on Windows' default cp1252 console encoding.
sys.stdout.reconfigure(encoding="utf-8")

SERVER = str(Path(__file__).resolve().parent / "mcp_servers" / "flight_server" / "server.py")


def extract(result: object) -> object:
    """Normalize an MCP tool result into a Python object.

    langchain-mcp-adapters may hand back a dict, a JSON string, or a list of
    content blocks like ``[{"type": "text", "text": "<json>"}]``. Unwrap all
    three (recursively, since content text is sometimes itself JSON).
    """
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

# Sample route — change freely. Uses a fixed near-future date.
ORIGIN = "New York"
DESTINATION = "London"
DATE = "2026-09-15"


async def main() -> int:
    if os.getenv("RAPIDAPI_KEY", "").strip() in ("", "your_rapidapi_key_here"):
        print("RAPIDAPI_KEY is not set in .env — put your real key there first.")
        return 1

    client = MultiServerMCPClient(
        {
            "flights": {
                "command": sys.executable,
                "args": [SERVER],
                "transport": "stdio",
            }
        }
    )

    tools = await client.get_tools()
    print(f"Tools exposed by the flight MCP server: {[t.name for t in tools]}")

    tool = next((t for t in tools if t.name == "search_flights"), None)
    if tool is None:
        print("ERROR: search_flights tool not found on the server.")
        return 1

    print(f"\nSearching {ORIGIN} -> {DESTINATION} on {DATE} ...")
    raw = await tool.ainvoke(
        {"origin": ORIGIN, "destination": DESTINATION, "date": DATE}
    )
    result = extract(raw)

    if not isinstance(result, dict):
        print(f"Unexpected result shape: {result!r}")
        return 1

    if result.get("error"):
        print(f"Search returned an error: {result['error']}")
        return 1

    flights = result.get("flights", [])
    print(f"Source: {result.get('source')}   Results: {len(flights)}")
    for i, f in enumerate(flights, 1):
        print(f"  {i}. {f.get('price')} | {f.get('airline')} | "
              f"{f.get('stops')} stop(s) | {f.get('duration_minutes')} min")

    if flights:
        print("\nPASS: real flight results came back.")
        return 0
    print("\nFAIL: no flights returned (route/date may have no availability).")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
