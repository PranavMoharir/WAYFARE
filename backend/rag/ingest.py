import logging

from langchain_core.documents import Document
from services.chroma_service import vector_store

logger = logging.getLogger(__name__)


def ingest(destination: str, corpus: list[dict]) -> None:
    """
    Store a list of attraction dicts in Chroma as individual documents.

    Each dict must have keys: attraction_name, description, category, destination.
    """
    if not corpus:
        logger.warning(f"[ingest] Empty corpus for {destination}. Nothing to ingest.")
        return

    documents = [
        Document(
            page_content=f"{item['attraction_name']} - {item['category']}\n\n{item['description']}",
            metadata={
                "attraction_name": item["attraction_name"],
                "category": item["category"],
                "destination": item["destination"],
            },
        )
        for item in corpus
    ]

    vector_store.add_documents(documents)
    logger.info(f"[ingest] Stored {len(documents)} documents for: {destination}")