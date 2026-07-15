"""Groq chat client for the curator/RAG pipeline.

Replaces the former ``gemini_service`` (google.genai). Exposes a single
``generate_text(prompt)`` helper backed by Groq's ``openai/gpt-oss-20b`` so the
curator (``agents/curator.py``) and the corpus seed generator
(``rag/attraction_selector.py``) can send a prompt and get back the model's raw
text — each caller keeps doing its own JSON stripping/parsing, exactly as before.
"""

import os

from dotenv import load_dotenv
from langchain_groq import ChatGroq

load_dotenv()

_GROQ_MODEL = "openai/gpt-oss-20b"
_PLACEHOLDER_GROQ_KEYS = {"", "your_groq_api_key_here", "your-groq-api-key-here"}

# Built lazily on first use so importing this module never fails; a missing key
# surfaces at call time (matching the old google.genai client's behaviour).
_client: ChatGroq | None = None


def _get_client() -> ChatGroq:
    global _client
    if _client is None:
        key = os.getenv("GROQ_API_KEY", "").strip()
        if key in _PLACEHOLDER_GROQ_KEYS:
            raise RuntimeError(
                "GROQ_API_KEY is missing or still a placeholder. Put a real "
                "Groq key in the .env file and re-run "
                "(get one at https://console.groq.com/keys)."
            )
        # reasoning_effort="low": these are extraction/JSON-formatting prompts
        # that need no deep reasoning. gpt-oss-20b left unconstrained
        # occasionally spends the whole turn in its reasoning channel and
        # returns an empty content string (breaking json.loads downstream);
        # capping reasoning eliminated that in testing and is faster too.
        _client = ChatGroq(
            model=_GROQ_MODEL,
            temperature=0,
            api_key=key,
            reasoning_effort="low",
        )
    return _client


def generate_text(prompt: str) -> str:
    """Send a single prompt to Groq and return the model's text response."""
    return _get_client().invoke(prompt).content
