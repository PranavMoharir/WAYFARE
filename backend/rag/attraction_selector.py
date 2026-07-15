import json

from services.groq_service import generate_text

_SEED_COUNT = 20


def select_attractions(destination: str) -> list[str]:
    """
    Ask the LLM to generate a diverse list of attraction names for a destination.
    Returns names only — actual content is fetched from Wikipedia separately.
    """
    prompt = f"""You are a travel research assistant.

List the {_SEED_COUNT} most notable and diverse attractions in {destination}.

Cover ALL of these categories:
- Major museums and galleries
- Parks and gardens
- Landmarks and monuments
- Historic sites and palaces
- Local neighbourhood experiences
- Religious sites
- Nature spots

Return ONLY valid JSON with no markdown and no explanations.

Schema:
{{
    "attractions": [
        "Louvre Museum",
        "Eiffel Tower",
        "Montmartre"
    ]
}}
"""

    text = generate_text(prompt).strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()

    data = json.loads(text)
    return data.get("attractions", [])
