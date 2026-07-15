import json
import logging

from services.groq_service import generate_text
from rag.corpus_builder import build_corpus
from rag.ingest import ingest
from rag.retrieve import retrieve_context, destination_exists

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)


def recommend_activities(
    destination: str,
    preferences: list[str],
    days: int,
) -> dict:
    """
    Return structured activity recommendations for a destination.

    First call for a destination builds and caches the RAG corpus (Wikipedia).
    Subsequent calls skip corpus build and go straight to retrieval.

    Args:
        destination: City or region name, e.g. "Paris", "Kyoto".
        preferences: User interest tags, e.g. ["art", "food", "hiking"].
        days:        Trip duration in days.

    Returns:
        {
            "destination": str,
            "days": int,
            "activities": [
                {"name": str, "reason": str, "estimated_duration": str, "category": str},
                ...
            ]
        }
    """
    if not destination_exists(destination):
        logger.info(f"[curator] Building corpus for new destination: {destination}")
        corpus = build_corpus(destination)
        ingest(destination, corpus)
    else:
        logger.info(f"[curator] Destination already indexed: {destination}")

    query = " ".join(preferences)
    context = retrieve_context(query=query, destination=destination, k=10)

    prompt = f"""You are an expert local experience curator and travel planner.

IMPORTANT: You must ONLY recommend activities that appear in the Travel Guide Context below.
Do NOT invent attractions or use your own knowledge.

Destination: {destination}
Trip Duration: {days} days
User Preferences: {", ".join(preferences)}

Travel Guide Context (retrieved from local knowledge base):
{context}

Based ONLY on the context above, recommend the best activities for this trip.
Aim for {days * 2} to {days * 3} activities spread across the trip duration.

Return ONLY valid JSON matching this schema exactly. No markdown. No explanations.

{{
    "destination": "{destination}",
    "days": {days},
    "activities": [
        {{
            "name": "attraction name exactly as it appears in the context",
            "reason": "1-2 sentence personalised explanation referencing the user preferences",
            "estimated_duration": "e.g. 2-3 hours",
            "category": "category label from the context"
        }}
    ]
}}
"""

    text = generate_text(prompt).strip()
    if text.startswith("```"):
        text = text.replace("```json", "").replace("```", "").strip()

    result = json.loads(text)
    logger.info(
        f"[curator] Returning {len(result.get('activities', []))} activities "
        f"for {destination} ({days} days)."
    )
    return result