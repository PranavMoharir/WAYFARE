import logging
import os
from concurrent.futures import ThreadPoolExecutor

from rag.attraction_selector import select_attractions
from rag.data_fetcher import fetch_attraction, search_titles

logger = logging.getLogger(__name__)

# The attraction fetches are independent, network-bound Wikipedia lookups, so we
# run them in a bounded thread pool instead of serially. This is the dominant
# cost of a first-time corpus build; overlapping the I/O cuts it substantially
# while staying polite to Wikipedia (each fetch keeps its own small delay).
# Tunable via CORPUS_FETCH_WORKERS.
_FETCH_WORKERS = int(os.getenv("CORPUS_FETCH_WORKERS", "8"))

# Overall cap on seed names we attempt to fetch per destination, after merging
# the LLM-guessed list with the Wikipedia-search-derived list. Keeps the build
# bounded (and polite to Wikipedia) no matter how many seeds the sources yield.
_MAX_SEEDS = int(os.getenv("CORPUS_MAX_SEEDS", "30"))


# Wikipedia search surfaces topic/overview articles alongside real attractions.
# These prefixes mark articles that are about a place rather than a thing to do
# there, so we drop them from the search-derived seeds (the LLM seeds, which are
# already attraction-focused, are not filtered).
_NON_ATTRACTION_PREFIXES = (
    "economy of", "climate change", "politics of", "demographics of",
    "geography of", "history of", "transport in", "transportation in",
    "education in", "industries in", "industry of", "ministry of",
    "government of", "outline of", "list of", "tourism in", "tourism -",
    "culture of", "religion in", "healthcare in",
)


def _is_attraction_like(title: str, destination: str) -> bool:
    """Heuristic: keep concrete attractions, drop country/topic overview pages."""
    t = title.strip().lower()
    if not t or t == destination.strip().lower():
        return False
    if t.endswith(" university"):
        return False
    return not t.startswith(_NON_ATTRACTION_PREFIXES)


def _wikipedia_seed_names(destination: str) -> list[str]:
    """Real Wikipedia page titles for a destination's attractions.

    The LLM seed list hallucinates non-existent pages for less-documented
    destinations (e.g. "Maldive National Zoo"), so we also pull titles straight
    from Wikipedia's search index. Every title here is a real article, which
    guarantees a usable corpus even when the LLM guesses badly.
    """
    queries = [
        f"tourist attractions in {destination}",
        f"things to do in {destination}",
        f"landmarks in {destination}",
        f"Tourism in {destination}",
    ]
    names: list[str] = []
    for q in queries:
        names.extend(search_titles(q, limit=8))
    return [n for n in names if _is_attraction_like(n, destination)]


def build_corpus(destination: str) -> list[dict]:
    """
    Build the RAG corpus for a destination.

    Returns a list of attraction dicts:
        {"attraction_name", "description", "category", "destination"}

    Attractions for which Wikipedia returns no usable content are skipped.
    """
    logger.info(f"[corpus_builder] Generating attraction seed list for: {destination}")
    try:
        llm_names = select_attractions(destination)
    except Exception as exc:  # LLM/JSON failure must not sink the whole build
        logger.warning(f"[corpus_builder] LLM seed list failed ({exc!r}); using search only.")
        llm_names = []

    # Merge LLM guesses with real Wikipedia-search titles. Search-derived titles
    # go first so genuine pages are preferred when we hit the seed cap, then
    # dedupe case-insensitively while preserving order.
    merged = _wikipedia_seed_names(destination) + llm_names
    seen: set[str] = set()
    attraction_names: list[str] = []
    for name in merged:
        key = name.strip().lower()
        if key and key not in seen:
            seen.add(key)
            attraction_names.append(name.strip())
    attraction_names = attraction_names[:_MAX_SEEDS]
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
