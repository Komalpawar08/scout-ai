"""Quote verification and provenance mapping.

An LLM-provided quotation is only treated as evidence after it is located in the
original extracted source text. Offsets and page/section references come from that match.
"""

from __future__ import annotations

import re
import unicodedata

from app.schemas.research import PageSpan, QuoteMatch

_TRANSLATE = str.maketrans({
    "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
    " ": " ", "₹": "rs ",
})


def _norm_char(c: str) -> str:
    c = c.translate(_TRANSLATE)
    return unicodedata.normalize("NFKC", c).lower()


def normalize_with_map(text: str) -> tuple[str, list[int]]:
    """Lower-case, unify punctuation and collapse whitespace; keep a map back to original offsets."""
    out: list[str] = []
    index_map: list[int] = []
    prev_space = True
    for i, ch in enumerate(text):
        for n in _norm_char(ch):
            if n.isspace() or n in "*#_`|>":
                if not prev_space:
                    out.append(" ")
                    index_map.append(i)
                prev_space = True
            else:
                out.append(n)
                index_map.append(i)
                prev_space = False
    return "".join(out), index_map


def normalize_text(text: str) -> str:
    return normalize_with_map(text)[0].strip()


def locate_quote(source_text: str, quote: str) -> tuple[QuoteMatch, int | None, int | None]:
    """Find `quote` in `source_text`. Returns (match type, start, end) in original offsets."""
    quote = (quote or "").strip().strip('"').strip()
    if len(quote) < 8 or not source_text:
        return QuoteMatch.not_found, None, None
    idx = source_text.find(quote)
    if idx >= 0:
        return QuoteMatch.exact, idx, idx + len(quote)

    norm_text, index_map = normalize_with_map(source_text)
    candidates = [quote]
    # LLMs sometimes join fragments with ellipses; verify the longest fragment.
    if "..." in quote or "…" in quote:
        frags = [f.strip() for f in re.split(r"\.\.\.|…", quote) if len(f.strip()) >= 20]
        candidates.extend(sorted(frags, key=len, reverse=True))
    for cand in candidates:
        norm_quote = normalize_text(cand).rstrip(".")
        if len(norm_quote) < 8:
            continue
        pos = norm_text.find(norm_quote)
        if pos >= 0:
            start = index_map[pos]
            end = index_map[min(pos + len(norm_quote) - 1, len(index_map) - 1)] + 1
            return QuoteMatch.normalized, start, end
    return QuoteMatch.not_found, None, None


def span_for_offset(spans: list[PageSpan], offset: int | None) -> PageSpan | None:
    if offset is None:
        return None
    for span in spans:
        if span.start <= offset < max(span.end, span.start + 1):
            return span
    # offset may fall in a separator between spans; choose the closest preceding span
    preceding = [s for s in spans if s.start <= offset]
    return preceding[-1] if preceding else None


def chunk_text(text: str, chunk_chars: int, max_chunks: int) -> list[tuple[int, str]]:
    """Split text on paragraph boundaries into bounded chunks. Returns (offset, chunk)."""
    chunks: list[tuple[int, str]] = []
    start = 0
    n = len(text)
    while start < n and len(chunks) < max_chunks:
        end = min(n, start + chunk_chars)
        if end < n:
            cut = text.rfind("\n\n", start + chunk_chars // 2, end)
            if cut == -1:
                cut = text.rfind(". ", start + chunk_chars // 2, end)
            if cut != -1:
                end = cut + 1
        chunks.append((start, text[start:end]))
        start = end
    return chunks
