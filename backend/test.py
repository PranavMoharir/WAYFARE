import sys
import json
import logging

sys.stdout.reconfigure(encoding="utf-8")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from agents.curator import recommend_activities

result = recommend_activities(
    destination="Paris",
    preferences=["art", "history", "local food"],
    days=3,
)

print("\n" + "=" * 60)
print("CURATOR AGENT OUTPUT")
print("=" * 60)
print(json.dumps(result, indent=2, ensure_ascii=False))
print("=" * 60)
print(f"\nDONE: {len(result.get('activities', []))} activities for {result.get('destination')}.")
