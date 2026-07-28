import logging
import os
from concurrent.futures import ThreadPoolExecutor

from rag.attraction_selector import select_attractions
from rag.data_fetcher import fetch_attraction

logger = logging.getLogger(__name__)

# The attraction fetches are independent, network-bound Wikipedia lookups, so we
# run them in a bounded thread pool instead of serially. This is the dominant
# cost of a first-time corpus build; overlapping the I/O cuts it substantially
# while staying polite to Wikipedia (each fetch keeps its own small delay).
# Tunable via CORPUS_FETCH_WORKERS.
_FETCH_WORKERS = int(os.getenv("CORPUS_FETCH_WORKERS", "8"))


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
    if not attraction_names:
        return corpus

    # Fetch in parallel; ThreadPoolExecutor.map preserves input order, so the
    # corpus stays deterministic. fetch_attraction only does thread-safe HTTP +
    # sleeps, so no shared state to guard.
    workers = min(_FETCH_WORKERS, len(attraction_names))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        docs = pool.map(lambda name: fetch_attraction(name, destination), attraction_names)
        for name, doc in zip(attraction_names, docs):
            if doc:
                corpus.append(doc)
                logger.info(f"[corpus_builder] OK: {name} -> {doc['category']}")
            else:
                logger.warning(f"[corpus_builder] SKIP: {name}")

    logger.info(
        f"[corpus_builder] Done: {len(corpus)}/{len(attraction_names)} fetched."
    )
    return corpus
