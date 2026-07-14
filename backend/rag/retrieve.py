import logging

from services.chroma_service import vector_store

logger = logging.getLogger(__name__)


def destination_exists(destination: str) -> bool:
    """Return True if any documents for this destination are stored in Chroma."""
    results = vector_store.get(where={"destination": destination})
    exists = len(results["ids"]) > 0
    if exists:
        logger.info(
            f"[retrieve] '{destination}' already indexed ({len(results['ids'])} docs)."
        )
    return exists


def retrieve_context(query: str, destination: str, k: int = 10) -> str:
    """
    Retrieve the k most semantically relevant attraction docs for a destination.

    Returns a formatted string of Markdown sections, one per attraction:
        ## Attraction Name [Category]
        ...description...
    """
    docs = vector_store.similarity_search(
        query=query,
        k=k,
        filter={"destination": destination},
    )

    if not docs:
        logger.warning(f"[retrieve] No documents found for: {destination}")
        return "No local attraction data available."

    sections = [
        f"## {doc.metadata.get('attraction_name', 'Unknown')} [{doc.metadata.get('category', 'Attraction')}]\n{doc.page_content}"
        for doc in docs
    ]

    logger.info(
        f"[retrieve] Retrieved {len(docs)} docs for '{destination}' | query: '{query[:50]}'"
    )
    return "\n\n---\n\n".join(sections)