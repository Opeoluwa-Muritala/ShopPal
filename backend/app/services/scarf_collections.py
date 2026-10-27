"""Reviewed Avaia category metadata, loaded once from a versioned local file."""

import csv
import re
from functools import lru_cache
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "data" / "scarf_collections.csv"

# Decode buttons already sent by the previous release. New replies carry names
# so adding/reordering CSV categories cannot silently select another category.
LEGACY_COLLECTIONS = (
    "Printed scarves", "Ombre scarves", "Asma scarves", "Gold Dust Chiffon",
    "silky scarves", "Snake Scarves", "Two-toned scarves", "Chiffon scarves",
    "Shadow Jersey", "Crinkled scarves", "2 in 1 Jersey scarves", "Flower Bouquet",
    "Rainbow scarves", "Vintage scarf", "Cotton Printed Scarf", "Mini Jersey",
)


@lru_cache(maxsize=1)
def category_map() -> dict[str, tuple[str, ...]]:
    result: dict[str, list[str]] = {}
    with SOURCE.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            name, category = row["Name"].strip(), row["Category"].strip()
            if name and category:
                values = result.setdefault(name.casefold(), [])
                if category not in values:
                    values.append(category)
    return {name: tuple(values) for name, values in result.items()}


def collection_names() -> list[str]:
    return list(dict.fromkeys(
        category for values in category_map().values() for category in values
        if category != "Unplaced"
    ))


def is_avaia(business_name: str | None) -> bool:
    return re.sub(r"[^a-z0-9]", "", (business_name or "").casefold()) == "avaiabyaminat"


def collection_for_reply(value: str) -> str:
    if value.startswith("name:"):
        name = value[5:]
    else:
        index = int(value)
        if not 0 <= index < len(LEGACY_COLLECTIONS):
            raise ValueError("Unknown collection")
        name = LEGACY_COLLECTIONS[index]
    for known in collection_names():
        if known.casefold() == name.casefold():
            return known
    raise ValueError("Unknown collection")


def product_collections(business_name: str | None, name: str | None, raw: dict) -> list[str]:
    # Never apply this shop-specific map to another merchant with similar names.
    if is_avaia(business_name):
        known = category_map().get((name or "").strip().casefold())
        if known:
            return list(known)
    stored = raw.get("collections")
    return [value for value in stored if isinstance(value, str)] if isinstance(stored, list) else []
