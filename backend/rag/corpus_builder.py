import logging

from rag.attraction_selector import select_attractions
from rag.data_fetcher import fetch_attraction

logger = logging.getLogger(__name__)


def build_corpus(destination: str) -> list[dict]:
    """
    Build the RAG corpus for a destination.

    Returns a list of attraction dicts:
        {"attraction_name", "description", "category", "destination"}

    Attractions for which Wikipedia returns no usable content are skipped.
    """
    logger.info(f"[corpus_builder] Generating attraction seed list for: {destination}")
    attraction_names = select_attractions(destination)
    logger.info(f"[corpus_builder] Seed list ({len(attraction_names)}): {attraction_names}")

    corpus: list[dict] = []
    for name in attraction_names:
        logger.info(f"[corpus_builder] Fetching: {name}")
        doc = fetch_attraction(name, destination)
        if doc:
            corpus.append(doc)
            logger.info(f"[corpus_builder] OK: {name} -> {doc['category']}")
        else:
            logger.warning(f"[corpus_builder] SKIP: {name}")

    logger.info(
        f"[corpus_builder] Done: {len(corpus)}/{len(attraction_names)} fetched."
    )
    return corpus
