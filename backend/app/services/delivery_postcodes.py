"""Small, explicit registry of legacy Ilorin delivery postcodes.

Sources and uncertainty are documented in docs/DELIVERY_POSTCODES.md.
Match an area, never assign one postcode to the entire city.
"""

import re

ILORIN_POSTCODES: tuple[tuple[tuple[str, ...], str], ...] = (
    (("taiwo road", "taiwo rd"), "240241"),
    (("adewole estate",), "240243"),
    (("gaa akanbi",), "240222"),
    (("baboko",), "240232"),
)


def registered_postcode(address: str, city: str, state: str) -> str | None:
    if city.casefold().strip() != "ilorin" or state.casefold().strip() != "kwara":
        return None
    normalized = " ".join(re.findall(r"[a-z0-9]+", address.casefold()))
    matches = {code for aliases, code in ILORIN_POSTCODES
               if any(re.search(r"\b" + re.escape(alias) + r"\b", normalized) for alias in aliases)}
    return next(iter(matches)) if len(matches) == 1 else None


def supplied_postcode(address: str) -> str | None:
    match = re.search(r"\b(?:postcode|postal\s+code|zip(?:code)?)\s*[:=-]?\s*([a-z0-9]{6,11})\b", address, re.I)
    if not match:
        return None
    value = match[1].upper()
    return value if re.fullmatch(r"\d{6}|[A-Z]{2}[A-Z0-9]{9}", value) else None
