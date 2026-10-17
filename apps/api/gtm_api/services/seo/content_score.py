"""Score a Markdown/plain-text draft against a target keyword (deterministic, no LLM)."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field

TITLE_RANGE = (30, 60)
DESCRIPTION_RANGE = (70, 160)

_WEIGHTS = {"keyword": 25, "structure": 20, "meta": 20, "length": 15, "readability": 10, "links": 10}


@dataclass
class ContentScore:
    score: int
    components: dict[str, int]
    word_count: int
    keyword_density: float
    reading_ease: float
    suggestions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


def _syllables(word: str) -> int:
    groups = re.findall(r"[aeiouy]+", word.lower())
    n = len(groups)
    if word.lower().endswith("e") and n > 1:
        n -= 1
    return max(1, n)


def flesch_reading_ease(text: str) -> float:
    sentences = [s for s in re.split(r"[.!?]+\s", text) if s.strip()]
    words = re.findall(r"[A-Za-z][A-Za-z'’-]*", text)
    if not words or not sentences:
        return 0.0
    syl = sum(_syllables(w) for w in words)
    return round(206.835 - 1.015 * (len(words) / len(sentences)) - 84.6 * (syl / len(words)), 1)


def score_content(
    markdown: str,
    keyword: str,
    meta_title: str = "",
    meta_description: str = "",
    internal_link_hosts: tuple[str, ...] = (),
) -> ContentScore:
    kw = keyword.strip().lower()
    text = markdown or ""
    plain = re.sub(r"[#>*_`\[\]()]", " ", re.sub(r"```.*?```", " ", text, flags=re.S))
    words = re.findall(r"\b[\w'’-]+\b", plain)
    wc = len(words)
    lower = plain.lower()
    kw_count = len(re.findall(re.escape(kw), lower)) if kw else 0
    density = round(100 * kw_count * max(1, len(kw.split())) / wc, 2) if wc and kw else 0.0

    headings = re.findall(r"^(#{1,6})\s+(.+)$", text, flags=re.M)
    h1 = [t for h, t in headings if len(h) == 1]
    h2 = [t for h, t in headings if len(h) == 2]
    suggestions: list[str] = []
    comp: dict[str, int] = {}

    # keyword: in H1/title, in first 100 words, sensible density (0.5-2.5%).
    k = 0
    first = " ".join(words[:100]).lower()
    if kw:
        if any(kw in t.lower() for t in h1) or kw in meta_title.lower():
            k += 10
        else:
            suggestions.append(f'Put "{keyword}" in the H1 or title.')
        if kw in first:
            k += 7
        else:
            suggestions.append(f'Mention "{keyword}" in the first 100 words.')
        if 0.5 <= density <= 2.5:
            k += 8
        elif density > 2.5:
            suggestions.append(f"Keyword density is {density}% - reduce repetition (keyword stuffing).")
        else:
            suggestions.append(f"Keyword density is {density}% - use the keyword and close variants more naturally.")
    else:
        suggestions.append("Choose a target keyword to score keyword usage.")
    comp["keyword"] = round(_WEIGHTS["keyword"] * k / 25)

    s = 0
    if len(h1) == 1:
        s += 10
    else:
        suggestions.append("Use exactly one H1.")
    if len(h2) >= 2:
        s += 10
    else:
        suggestions.append("Break the piece into at least two H2 sections.")
    comp["structure"] = round(_WEIGHTS["structure"] * s / 20)

    m = 0
    if TITLE_RANGE[0] <= len(meta_title) <= TITLE_RANGE[1]:
        m += 10
    else:
        suggestions.append(f"Meta title should be {TITLE_RANGE[0]}-{TITLE_RANGE[1]} characters (now {len(meta_title)}).")
    if DESCRIPTION_RANGE[0] <= len(meta_description) <= DESCRIPTION_RANGE[1]:
        m += 10
    else:
        suggestions.append(f"Meta description should be {DESCRIPTION_RANGE[0]}-{DESCRIPTION_RANGE[1]} characters (now {len(meta_description)}).")
    comp["meta"] = round(_WEIGHTS["meta"] * m / 20)

    ln = 15 if wc >= 800 else 10 if wc >= 500 else 5 if wc >= 300 else 0
    if ln < 15:
        suggestions.append(f"Only {wc} words; long-form pieces that cover the topic fully tend to rank better (800+).")
    comp["length"] = ln

    ease = flesch_reading_ease(plain)
    rd = 10 if 40 <= ease <= 80 else 5 if 25 <= ease < 40 or 80 < ease <= 90 else 0
    if rd < 10:
        suggestions.append(f"Reading ease is {ease}; aim for 40-80 for a professional audience.")
    comp["readability"] = rd

    links = re.findall(r"\[[^\]]+\]\((https?://[^)\s]+|/[^)\s]*)\)", text)
    if internal_link_hosts:
        internal = [u for u in links if u.startswith("/") or any(h in u for h in internal_link_hosts)]
    else:
        internal = [u for u in links if u.startswith("/")]
    lk = 10 if len(internal) >= 2 else 5 if len(internal) == 1 else 0
    if lk < 10:
        suggestions.append("Link to at least two related pages on your site.")
    comp["links"] = lk

    return ContentScore(
        score=min(100, sum(comp.values())), components=comp, word_count=wc,
        keyword_density=density, reading_ease=ease, suggestions=suggestions,
    )
