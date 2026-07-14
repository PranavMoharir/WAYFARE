import time
import requests

_WIKI_SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary/{title}"
_WIKI_SEARCH_URL = "https://en.wikipedia.org/w/api.php"

_HEADERS = {
    "User-Agent": "WayfareLocalCurator/1.0 (travel-planner; educational)"
}

_CATEGORY_KEYWORDS: list[tuple[list[str], str]] = [
    (["museum", "gallery", "exhibit", "art"],                                   "Museum"),
    (["park", "garden", "reserve", "nature", "forest", "wildlife"],             "Park"),
    (["cathedral", "church", "mosque", "temple", "shrine", "basilica"],         "Religious Site"),
    (["palace", "castle", "fort", "fortress", "citadel"],                       "Historic Landmark"),
    (["tower", "bridge", "monument", "memorial", "statue", "ruins", "ancient"], "Landmark"),
    (["market", "bazaar", "district", "neighbourhood",
      "neighborhood", "quarter", "canal", "boulevard"],                         "Local Experience"),
    (["beach", "lake", "river", "waterfall", "island", "bois", "buttes"],       "Nature"),
    (["restaurant", "cafe", "food", "cuisine"],                                 "Food & Drink"),
]


def _infer_category(title: str, extract: str) -> str:
    text = (title + " " + extract).lower()
    for keywords, category in _CATEGORY_KEYWORDS:
        if any(kw in text for kw in keywords):
            return category
    return "Attraction"


def _fetch_summary(title: str) -> dict | None:
    encoded = requests.utils.quote(title.replace(" ", "_"), safe="")
    url = _WIKI_SUMMARY_URL.format(title=encoded)
    try:
        response = requests.get(url, headers=_HEADERS, timeout=10)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        return response.json()
    except requests.RequestException:
        return None


def _search_wikipedia(attraction_name: str) -> str | None:
    params = {
        "action": "query",
        "list": "search",
        "srsearch": attraction_name,
        "srlimit": 1,
        "format": "json",
        "origin": "*",
    }
    try:
        response = requests.get(
            _WIKI_SEARCH_URL, params=params, headers=_HEADERS, timeout=10
        )
        response.raise_for_status()
        results = response.json().get("query", {}).get("search", [])
        if results:
            return results[0]["title"]
    except requests.RequestException:
        pass
    return None


def _parse_summary(data: dict, attraction_name: str, destination: str) -> dict | None:
    extract: str = data.get("extract", "").strip()
    if not extract or len(extract) < 60 or data.get("type") == "disambiguation":
        return None
    if len(extract) > 1200:
        extract = extract[:1200].rsplit(" ", 1)[0] + "..."
    title = data.get("title", attraction_name)
    return {
        "attraction_name": title,
        "description": extract,
        "category": _infer_category(title, extract),
        "destination": destination,
    }


def fetch_attraction(attraction_name: str, destination: str) -> dict | None:
    """
    Fetch structured attraction data from Wikipedia.

    Tries direct REST lookup first (Wikipedia handles redirects automatically),
    then falls back to a fuzzy MediaWiki search if the direct lookup fails.

    Returns:
        {"attraction_name", "description", "category", "destination"} or None.
    """
    data = _fetch_summary(attraction_name)
    if data:
        result = _parse_summary(data, attraction_name, destination)
        if result:
            time.sleep(0.3)
            return result

    canonical_title = _search_wikipedia(attraction_name)
    if canonical_title and canonical_title.lower() != attraction_name.lower():
        data = _fetch_summary(canonical_title)
        if data:
            result = _parse_summary(data, attraction_name, destination)
            if result:
                time.sleep(0.3)
                return result

    time.sleep(0.3)
    return None