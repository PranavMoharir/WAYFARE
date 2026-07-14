"""Smoke test for the WAYFARE graph skeleton.

Runs the compiled graph once with sample input and prints the final state,
confirming the researcher -> curator -> budget_enforcer pipeline runs end to end.
"""

import sys

from graph import app

# Prices come back with the ₹ symbol; force UTF-8 so printing the final state
# does not crash on Windows' default cp1252 console encoding.
sys.stdout.reconfigure(encoding="utf-8")


def main():
    sample_input = {
        "origin": "Mumbai",
        "destination": "Goa",
        "dates": "2026-09-15 to 2026-09-18",
        "budget": 10000.0,
        "preferences": ["sightseeing", "local food", "beaches"],
        "flight_options": [],
        "hotel_options": [],
        "activities": [],
        "current_proposal": None,
        "budget_check_passed": False,
        "round_count": 0,
    }

    print("Running graph with sample input...\n")
    final_state = app.invoke(sample_input)

    print("\nFinal state:")
    for key, value in final_state.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()
