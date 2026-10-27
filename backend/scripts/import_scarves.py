"""Apply the reviewed Avaia scarf category map to both product caches."""

from __future__ import annotations

import argparse
import csv
import sys
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import get_settings  # noqa: E402
from app.db.models import ProductCache, Vendor  # noqa: E402
from app.db.session import database_url  # noqa: E402


MAX_CSV_BYTES = 1_000_000
MAX_ROWS = 1_000


def read_categories(path: Path) -> dict[str, tuple[str, list[str]]]:
    if not path.is_file() or path.stat().st_size > MAX_CSV_BYTES:
        raise ValueError("CSV is missing or exceeds the 1 MB limit")
    products: dict[str, tuple[str, list[str]]] = {}
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != ["Category", "Name", "Note"]:
            raise ValueError("CSV headers must be exactly: Category,Name,Note")
        for number, row in enumerate(reader, start=2):
            if number - 2 >= MAX_ROWS:
                raise ValueError(f"CSV exceeds the {MAX_ROWS}-row limit")
            category = (row.get("Category") or "").strip()
            name = (row.get("Name") or "").strip()
            if not category or not name or len(category) > 80 or len(name) > 120:
                raise ValueError(f"Invalid Category or Name at row {number}")
            key = name.casefold()
            original, categories = products.setdefault(key, (name, []))
            if category not in categories:
                categories.append(category)
            products[key] = (original, categories)
    if not products:
        raise ValueError("CSV has no product rows")
    return products


def apply_categories(raw_url: str, products: dict[str, tuple[str, list[str]]]) -> tuple[int, list[str]]:
    engine = create_engine(
        database_url(raw_url), poolclass=NullPool, hide_parameters=True,
        connect_args={"connect_timeout": 10},
    )
    try:
        with Session(engine) as session, session.begin():
            vendor = session.scalar(select(Vendor).where(
                Vendor.business_name.ilike("avaiabyaminat")
            ))
            if vendor is None:
                raise ValueError("Avaia by Aminat vendor not found")
            cached = list(session.scalars(select(ProductCache).where(
                ProductCache.merchant_id == vendor.id
            )))
            by_name: dict[str, list[ProductCache]] = {}
            for product in cached:
                by_name.setdefault((product.name or "").strip().casefold(), []).append(product)
            matched = 0
            missing: list[str] = []
            for key, (name, categories) in products.items():
                matches = by_name.get(key, [])
                if not matches:
                    missing.append(name)
                    continue
                for product in matches:
                    raw = dict(product.raw or {})
                    raw["collections"] = categories
                    product.raw = raw
                matched += 1
            return matched, missing
    finally:
        engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("csv_path", type=Path)
    args = parser.parse_args()
    products = read_categories(args.csv_path.resolve())
    settings = get_settings()
    urls = [str(value) for value in (settings.database_url, settings.database_url_2) if value]
    failures = 0
    for index, raw_url in enumerate(urls, start=1):
        try:
            matched, missing = apply_categories(raw_url, products)
            print(f"database_{index}: categorized={matched} unmatched={len(missing)}")
            if missing:
                print(f"database_{index}: unmatched_names={missing}")
        except Exception as exc:
            failures += 1
            detail = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
            if isinstance(exc, DBAPIError):
                detail = getattr(getattr(exc.orig, "diag", None), "message_primary", None) or detail
            print(f"database_{index}: failed ({detail})", file=sys.stderr)
    print(f"unique_csv_products={len(products)}")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
