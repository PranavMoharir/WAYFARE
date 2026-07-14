"""LangGraph implementation for the WAYFARE travel-planning agent.

This module defines the shared state schema and wires three nodes into a
simple linear pipeline:

    researcher_node -> curator_node -> budget_enforcer_node -> END

``researcher_node`` is now a real node: it launches the flight and hotel MCP
servers over stdio, exposes their ``search_flights`` / ``search_hotels`` tools
to a Gemini model, lets the model decide which tools to call, and parses the
results into ``flight_options`` / ``hotel_options``. The other two nodes are
still placeholders that pass the state through unchanged.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_mcp_adapters.client import MultiServerMCPClient
from langgraph.graph import StateGraph, END

load_dotenv()

# This module lives in backend/, so its parent *is* the backend root. The flight
# and hotel MCP servers live under backend/mcp_servers/, and Dhruv's curator agent
# (agents/, rag/, services/) sits alongside this file in backend/.
BACKEND_ROOT = Path(__file__).resolve().parent
# Prefer the same interpreter running this process so the MCP servers use the
# project's venv (where mcp/requests/etc. are installed).
PYTHON = sys.executable

# Dhruv's curator agent is imported on demand by curator_node (see
# INTEGRATION.md). Adding backend/ to sys.path lets us do
# ``from agents.curator import recommend_activities``.

# Used when the caller does not supply preferences in the state.
DEFAULT_PREFERENCES: List[str] = ["sightseeing", "local food"]

# Gemini model to drive tool selection. "gemini-flash-latest" always points at
# the current fast Flash model; the pinned "gemini-2.5-flash" name 404s for new
# API keys.
GEMINI_MODEL = "gemini-flash-latest"

_PLACEHOLDER_GOOGLE_KEYS = {"", "your_google_api_key_here", "your-google-api-key-here"}


class TravelState(TypedDict, total=False):
    """Shared state passed between nodes in the travel-planning graph."""

    origin: str
    destination: str
    dates: str
    budget: float
    preferences: List[str]
    flight_options: List[Dict[str, Any]]
    hotel_options: List[Dict[str, Any]]
    activities: List[Dict[str, Any]]
    current_proposal: Optional[Dict[str, Any]]
    budget_check_passed: bool
    budget_infeasible: bool
    round_count: int


# --------------------------------------------------------------------------- #
# MCP wiring
# --------------------------------------------------------------------------- #
def _mcp_connections() -> Dict[str, Dict[str, Any]]:
    """Stdio connection specs for the local flight and hotel MCP servers."""
    return {
        "flights": {
            "transport": "stdio",
            "command": PYTHON,
            "args": [str(BACKEND_ROOT / "mcp_servers" / "flight_server" / "server.py")],
            "cwd": str(BACKEND_ROOT),
        },
        "hotels": {
            "transport": "stdio",
            "command": PYTHON,
            "args": [str(BACKEND_ROOT / "mcp_servers" / "hotel_server" / "server.py")],
            "cwd": str(BACKEND_ROOT),
        },
    }


def _parse_tool_output(raw: Any) -> Dict[str, Any]:
    """Normalise a LangChain MCP tool result into a plain dict.

    The adapter can hand back a JSON string, a list of content blocks
    (``[{"type": "text", "text": "..."}]``), a ``(content, artifact)`` tuple,
    or already-parsed data. Reduce all of those to a dict.
    """
    if isinstance(raw, tuple):  # (content, artifact) response format
        raw = raw[0]

    if isinstance(raw, dict):
        return raw

    text = ""
    if isinstance(raw, str):
        text = raw
    elif isinstance(raw, list):
        parts: List[str] = []
        for block in raw:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        text = "".join(parts)

    text = text.strip()
    if not text:
        return {}
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return {"raw": text}
    return parsed if isinstance(parsed, dict) else {"data": parsed}


def _build_prompt(state: TravelState) -> str:
    """Instruction telling the model to find flights and hotels within budget."""
    origin = state.get("origin", "")
    destination = state.get("destination", "")
    dates = state.get("dates", "")
    budget = state.get("budget")
    budget_line = f"The total trip budget is {budget}." if budget is not None else ""

    return (
        f"Plan the travel research for a trip from {origin} to {destination}.\n"
        f"Travel dates: {dates}.\n"
        f"{budget_line}\n\n"
        "Use the available tools to find real options:\n"
        "- Call search_flights(origin, destination, date) for the outbound "
        "flight. Use the first (check-in) date from the travel dates, in "
        "YYYY-MM-DD format.\n"
        "- Call search_hotels(destination, checkin, checkout) for lodging, "
        "using the check-in and check-out dates from the travel dates in "
        "YYYY-MM-DD format.\n\n"
        "Find flight and hotel options that fit within the budget. Call both "
        "tools before finishing."
    )


async def _run_research(state: TravelState) -> Dict[str, List[Dict[str, Any]]]:
    """Drive Gemini + the MCP tools and collect flight/hotel options."""
    google_key = os.getenv("GOOGLE_API_KEY", "").strip()
    if google_key in _PLACEHOLDER_GOOGLE_KEYS:
        raise RuntimeError(
            "GOOGLE_API_KEY is missing or still a placeholder. Put a real "
            "Google Generative AI key in the .env file and re-run "
            "(get one at https://aistudio.google.com/app/apikey)."
        )

    client = MultiServerMCPClient(_mcp_connections())
    tools = await client.get_tools()
    tools_by_name = {t.name: t for t in tools}

    llm = ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        temperature=0,
        google_api_key=google_key,
    )
    llm_with_tools = llm.bind_tools(tools)

    messages: List[Any] = [
        SystemMessage(
            content=(
                "You are WAYFARE's travel researcher. You gather real flight "
                "and hotel options by calling the provided tools. Always call "
                "the tools rather than inventing data."
            )
        ),
        HumanMessage(content=_build_prompt(state)),
    ]

    flight_options: List[Dict[str, Any]] = []
    hotel_options: List[Dict[str, Any]] = []

    # Let the model call tools over a few turns until it stops requesting them.
    for _ in range(5):
        ai_message = await llm_with_tools.ainvoke(messages)
        messages.append(ai_message)

        tool_calls = getattr(ai_message, "tool_calls", None) or []
        if not tool_calls:
            break

        for call in tool_calls:
            name = call["name"]
            args = call.get("args", {})
            tool = tools_by_name.get(name)
            if tool is None:
                messages.append(
                    ToolMessage(
                        content=f"Unknown tool {name!r}.",
                        tool_call_id=call["id"],
                    )
                )
                continue

            raw = await tool.ainvoke(args)
            parsed = _parse_tool_output(raw)

            if name == "search_flights":
                flight_options.extend(parsed.get("flights", []) or [])
            elif name == "search_hotels":
                hotel_options.extend(parsed.get("hotels", []) or [])

            messages.append(
                ToolMessage(
                    content=json.dumps(parsed),
                    tool_call_id=call["id"],
                )
            )

    return {"flight_options": flight_options, "hotel_options": hotel_options}


# --------------------------------------------------------------------------- #
# Nodes
# --------------------------------------------------------------------------- #
def researcher_node(state: TravelState) -> TravelState:
    """Gather real flights and hotels via the MCP servers + Gemini."""
    print("researcher_node")
    result = asyncio.run(_run_research(state))
    state["flight_options"] = result["flight_options"]
    state["hotel_options"] = result["hotel_options"]
    print(
        f"  found {len(state['flight_options'])} flight option(s), "
        f"{len(state['hotel_options'])} hotel option(s)"
    )
    return state


def _compute_days(dates: str) -> int:
    """Parse the two ``YYYY-MM-DD`` dates from ``dates`` and return the day span.

    ``dates`` looks like ``"2026-09-15 to 2026-09-18"``; the difference between
    the check-in and check-out dates is 3 days. Falls back to 1 if the string
    does not contain two parseable dates.
    """
    found = re.findall(r"\d{4}-\d{2}-\d{2}", dates or "")
    if len(found) >= 2:
        start = datetime.strptime(found[0], "%Y-%m-%d")
        end = datetime.strptime(found[1], "%Y-%m-%d")
        return max((end - start).days, 1)
    return 1


def _flight_price(flight: Dict[str, Any]) -> float:
    """Best-effort numeric price for a flight option (price may be formatted)."""
    raw = flight.get("price")
    if isinstance(raw, (int, float)):
        return float(raw)
    digits = re.sub(r"[^\d.]", "", str(raw or ""))
    try:
        return float(digits)
    except ValueError:
        return float("inf")


def _hotel_price(hotel: Dict[str, Any]) -> float:
    """Best-effort numeric nightly price for a hotel option."""
    try:
        return float(hotel.get("price_per_night"))
    except (TypeError, ValueError):
        return float("inf")


def _recommend_local_activities(state: TravelState) -> List[Dict[str, Any]]:
    """Call Dhruv's curator agent and return its ``activities`` list.

    Follows the graceful-degradation pattern from backend/INTEGRATION.md: any
    failure (missing key, no internet, malformed JSON) yields an empty list so
    the graph keeps running.
    """
    destination = state.get("destination", "")
    preferences = state.get("preferences") or DEFAULT_PREFERENCES
    days = _compute_days(state.get("dates", ""))

    try:
        # backend/.env holds GEMINI_API_KEY; load it before importing the agent
        # (works regardless of the cwd the graph is run from).
        load_dotenv(BACKEND_ROOT / ".env")
        if str(BACKEND_ROOT) not in sys.path:
            sys.path.insert(0, str(BACKEND_ROOT))

        from agents.curator import recommend_activities

        result = recommend_activities(
            destination=destination,
            preferences=list(preferences),
            days=days,
        )
        return result.get("activities", []) or []
    except Exception as exc:  # graceful failure — see INTEGRATION.md
        print(f"  curator activities unavailable ({exc!r})")
        return []


def curator_node(state: TravelState) -> TravelState:
    """Assemble a proposal: the cheapest flight, cheapest hotel, and activities.

    Flight and hotel are always the cheapest available (the budget floor —
    nothing cheaper exists to retry with). The only lever the retry loop has is
    activities: on each round it drops the ``round_count`` most expensive
    activities, shedding cost while keeping flight/hotel fixed.
    """
    print("curator_node")

    flight_options = state.get("flight_options", []) or []
    hotel_options = state.get("hotel_options", []) or []
    round_count = state.get("round_count", 0)

    cheapest_flight = min(flight_options, key=_flight_price) if flight_options else None
    cheapest_hotel = min(hotel_options, key=_hotel_price) if hotel_options else None

    # Fetch the full activity list once (round 0) and cache it as the master
    # list; retries trim a view of it rather than re-calling Gemini.
    full_activities = state.get("activities") or []
    if round_count == 0 and not full_activities:
        full_activities = _recommend_local_activities(state)
    state["activities"] = full_activities

    # Drop the `round_count` most expensive activities to reduce cost on retries.
    by_cost_desc = sorted(full_activities, key=_activity_cost, reverse=True)
    kept_activities = by_cost_desc[round_count:]

    state["current_proposal"] = {
        "flight": cheapest_flight,
        "hotel": cheapest_hotel,
        "activities": kept_activities,
    }
    print(
        f"  round {round_count}: cheapest flight/hotel, "
        f"activities kept={len(kept_activities)}/{len(full_activities)} "
        f"(cost={_activities_total_cost(kept_activities)})"
    )
    return state


# Static per-category INR estimates. The curator's activities are Wikipedia/RAG
# sourced with no pricing, and a live pricing API (Tripadvisor via RapidAPI) turned
# out to be a poor fit: most attractions here are genuinely free (beaches, parks,
# religious sites) and the few "paid" ones only expose bundled multi-stop tour
# prices, not clean per-attraction entry fees. So these estimates are grounded in
# that research rather than pulled live. Tweak the numbers here as needed.
_CATEGORY_COST_INR: Dict[str, float] = {
    "Religious Site": 0.0,
    "Nature": 0.0,
    "Park": 0.0,
    "Landmark": 0.0,
    "Historic Landmark": 0.0,
    "Museum": 300.0,
    "Local Experience": 800.0,
    "Attraction": 200.0,
}
_DEFAULT_ACTIVITY_COST_INR = 200.0  # unrecognized/missing category -> same as "Attraction"


def _activity_cost(activity: Dict[str, Any]) -> float:
    """Best-effort cost of a single activity.

    An explicit numeric ``cost``/``price``/``estimated_cost`` field wins when one is
    present. Otherwise we fall back to a static estimate keyed off the curator's
    ``category`` field (see ``_CATEGORY_COST_INR``); a missing/None/unrecognized
    category falls back to the default so this never throws.
    """
    for key in ("cost", "price", "estimated_cost"):
        val = activity.get(key)
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            digits = re.sub(r"[^\d.]", "", val)
            if digits:
                return float(digits)

    category = activity.get("category")
    return _CATEGORY_COST_INR.get(category, _DEFAULT_ACTIVITY_COST_INR)


def _activities_total_cost(activities: List[Dict[str, Any]]) -> float:
    """Sum the per-activity costs (see ``_activity_cost``)."""
    return sum(_activity_cost(a) for a in activities or [])


def budget_enforcer_node(state: TravelState) -> TravelState:
    """Validate the current proposal's total cost against the budget.

    Total = cheapest flight + (cheapest hotel nightly x nights) + activity costs.
    The *floor* (flight + hotel, zero activities) is the cheapest trip possible;
    if even that exceeds the budget the trip is infeasible and no amount of
    activity trimming can help, so we flag it and stop instead of retrying.
    Otherwise, a failed check loops back to the curator to shed activities.
    """
    print("budget_enforcer_node")

    proposal = state.get("current_proposal") or {}
    flight = proposal.get("flight")
    hotel = proposal.get("hotel")
    activities = proposal.get("activities", [])

    nights = _compute_days(state.get("dates", ""))
    flight_cost = _flight_price(flight) if flight else 0.0
    hotel_cost = _hotel_price(hotel) * nights if hotel else 0.0
    activity_cost = _activities_total_cost(activities)
    total_cost = flight_cost + hotel_cost + activity_cost

    # Cheapest trip possible: flight + hotel with no activities.
    floor_cost = flight_cost + hotel_cost

    budget = state.get("budget")
    passed = budget is not None and total_cost <= budget
    infeasible = budget is not None and floor_cost > budget

    proposal["total_cost"] = total_cost
    proposal["floor_cost"] = floor_cost
    if infeasible:
        proposal["shortfall"] = floor_cost - budget
    state["current_proposal"] = proposal
    state["budget_check_passed"] = passed
    state["budget_infeasible"] = infeasible
    state["round_count"] = state.get("round_count", 0) + 1

    if infeasible:
        print(
            f"  INFEASIBLE: cheapest possible trip (flight={flight_cost} + "
            f"hotel={hotel_cost} [{nights} nights], zero activities) = "
            f"{floor_cost} exceeds budget={budget} by {floor_cost - budget}"
        )
    else:
        print(
            f"  flight={flight_cost} + hotel={hotel_cost} ({nights} nights) "
            f"+ activities={activity_cost} = total={total_cost} "
            f"vs budget={budget} -> passed={passed} (round_count={state['round_count']})"
        )
    return state


def _after_budget(state: TravelState) -> str:
    """Stop on success or infeasibility; otherwise retry via curator.

    Retrying only trims activities, which converges toward the (constant) floor
    cost, so the loop is naturally bounded by the number of activities.
    """
    if state.get("budget_check_passed") or state.get("budget_infeasible"):
        return "END"
    return "curator"


def build_graph():
    """Construct and compile the linear travel-planning graph."""
    graph = StateGraph(TravelState)

    graph.add_node("researcher", researcher_node)
    graph.add_node("curator", curator_node)
    graph.add_node("budget_enforcer", budget_enforcer_node)

    graph.set_entry_point("researcher")
    graph.add_edge("researcher", "curator")
    graph.add_edge("curator", "budget_enforcer")
    # Loop back to the curator for another proposal until the budget check passes
    # or we hit the round cap (handled inside ``_after_budget``).
    graph.add_conditional_edges(
        "budget_enforcer",
        _after_budget,
        {"curator": "curator", "END": END},
    )

    return graph.compile()


# Compiled graph, importable elsewhere.
app = build_graph()
