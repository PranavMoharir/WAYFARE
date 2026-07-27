import logging
import os
import time

from langchain_core.documents import Document
from services.chroma_service import vector_store

logger = logging.getLogger(__name__)

# Cap how many destination corpora are retained. Each newly-searched
# destination adds ~15-20 docs to the shared vector store forever; without a
# cap the on-disk index grows without bound. When the number of distinct
# destinations exceeds this, the least-recently-indexed ones are evicted.
# Tunable via MAX_CACHED_DESTINATIONS.
MAX_CACHED_DESTINATIONS = int(os.getenv("MAX_CACHED_DESTINATIONS", "50"))


def _evict_oldest_destinations() -> None:
    """Evict the least-recently-indexed destinations when over the cap."""
    try:
        stored = vector_store.get()  # ids + metadatas for everything
    except Exception:  # defensive: never let eviction break an ingest
        logger.exception("[ingest] Could not read store for eviction; skipping.")
        return

    # Most recent indexed_at seen per destination (0 for pre-timestamp docs).
    latest: dict[str, float] = {}
    for meta in stored.get("metadatas") or []:
        dest = (meta or {}).get("destination")
        if dest is None:
            continue
        latest[dest] = max(latest.get(dest, 0), (meta or {}).get("indexed_at", 0) or 0)

    if len(latest) <= MAX_CACHED_DESTINATIONS:
        return

    # Oldest first; drop just enough to get back under the cap.
    ordered = sorted(latest, key=lambda d: latest[d])
    for dest in ordered[: len(latest) - MAX_CACHED_DESTINATIONS]:
        victims = vector_store.get(where={"destination": dest})
        ids = victims.get("ids") or []
        if ids:
            vector_store.delete(ids=ids)
        logger.info(
            f"[ingest] Evicted cached corpus for '{dest}' "
            f"(destination cap {MAX_CACHED_DESTINATIONS})."
        )


def ingest(destination: str, corpus: list[dict]) -> None:
    """
    Store a list of attraction dicts in Chroma as individual documents.

    Each dict must have keys: attraction_name, description, category, destination.
    """
    if not corpus:
        logger.warning(f"[ingest] Empty corpus for {destination}. Nothing to ingest.")
        return

    indexed_at = time.time()
    documents = [
        Document(
            page_content=f"{item['attraction_name']} - {item['category']}\n\n{item['description']}",
            metadata={
                "attraction_name": item["attraction_name"],
                "category": item["category"],
                "destination": item["destination"],
                # Recency marker used by _evict_oldest_destinations().
                "indexed_at": indexed_at,
            },
        )
        for item in corpus
    ]

    vector_store.add_documents(documents)
    logger.info(f"[ingest] Stored {len(documents)} documents for: {destination}")
    _evict_oldest_destinations()
