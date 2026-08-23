import json
import os
import re
import sys
from typing import Any


def main() -> int:
    try:
        payload = json.loads(sys.stdin.read())
        seed = payload["seed"]
        source_url = source_url_for_seed(seed)
        result = run_scrapegraph(seed, source_url)
        print(json.dumps(normalize_result(result, source_url), ensure_ascii=True))
        return 0
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


def run_scrapegraph(seed: dict[str, Any], source_url: str) -> Any:
    try:
        from scrapegraphai.graphs import SmartScraperGraph
    except ImportError as error:
        raise RuntimeError(
            "ScrapeGraph is not installed. Run: py -3 -m pip install -r requirements-scrapegraph.txt && py -3 -m playwright install chromium"
        ) from error

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured")

    prompt = (
        "Extract public OSINT-relevant facts from this page for the search seed "
        f"{seed.get('type')}:{seed.get('value')}. Return only JSON with an observations array. "
        "Each observation must have entity, type, value, evidence, confidence, and source_url. "
        "Prioritize emails, phone numbers, fax numbers, contact forms, contact/about/team/staff URLs, "
        "domains, social/profile links, organization names, locations, technologies, aliases, page titles, "
        "and concise descriptions. Normalize phone numbers exactly as displayed when possible. "
        "Do not invent facts. If the page has little usable data, return a short summary."
    )
    graph_config = {
        "llm": {
            "api_key": api_key,
            "model": os.environ.get("SCRAPEGRAPH_OPENAI_MODEL", "openai/gpt-4o-mini"),
        },
        "verbose": False,
        "headless": True,
    }
    graph = SmartScraperGraph(prompt=prompt, source=source_url, config=graph_config)
    return graph.run()


def source_url_for_seed(seed: dict[str, Any]) -> str:
    raw_value = str(seed.get("value", "")).strip()
    if not raw_value:
        raise ValueError("Search seed value is empty")
    if re.match(r"^https?://", raw_value, re.IGNORECASE):
        return raw_value
    if seed.get("type") == "domain":
        return f"https://{raw_value}"
    return f"https://www.google.com/search?q={quote_search(raw_value)}"


def quote_search(value: str) -> str:
    from urllib.parse import quote_plus

    return quote_plus(value)


def normalize_result(result: Any, source_url: str) -> dict[str, Any]:
    if isinstance(result, dict):
        observations = result.get("observations")
        if isinstance(observations, list):
            return {"source_url": source_url, "observations": observations}
        return {"source_url": source_url, "observations": flatten_dict_result(result), "summary": string_or_none(result.get("summary"))}
    if isinstance(result, list):
        return {"source_url": source_url, "observations": result}
    return {"source_url": source_url, "observations": [], "summary": str(result)}


def flatten_dict_result(result: dict[str, Any]) -> list[dict[str, Any]]:
    observations: list[dict[str, Any]] = []
    for key, value in result.items():
        if key in {"summary", "source_url"}:
            continue
        for item in value_to_strings(value):
            observations.append(
                {
                    "entity": "scrapegraph",
                    "type": f"scrapegraph-{key}",
                    "value": item,
                    "evidence": key,
                    "confidence": 0.7,
                }
            )
    return observations


def value_to_strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, (int, float, bool)):
        return [str(value)]
    if isinstance(value, list):
        values: list[str] = []
        for item in value:
            values.extend(value_to_strings(item))
        return values
    if isinstance(value, dict):
        return [json.dumps(value, ensure_ascii=True, sort_keys=True)]
    return []


def string_or_none(value: Any) -> str | None:
    return value if isinstance(value, str) else None


if __name__ == "__main__":
    raise SystemExit(main())
