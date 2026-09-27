#!/usr/bin/env python3
"""Prepare Portland tree data for React map/chart visualization."""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import sys
import urllib.request
from collections import Counter
from typing import Any, Dict, Iterable, Optional, Tuple

DEFAULT_SOURCE = (
    "https://www.portlandmaps.com/arcgis/rest/services/Public/Parks/MapServer/13/"
    "query?where=1%3D1&outFields=*&f=geojson"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default=DEFAULT_SOURCE,
        help="GeoJSON URL or local file path for raw Portland tree data",
    )
    parser.add_argument(
        "--output-geojson",
        default="web/public/data/trees.geojson",
        help="Path for normalized GeoJSON output",
    )
    parser.add_argument(
        "--output-summary",
        default="web/public/data/summary.json",
        help="Path for summary metrics output",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional cap on number of features processed (0 = all)",
    )
    return parser.parse_args()


def load_geojson(source: str) -> Dict[str, Any]:
    if source.startswith(("http://", "https://")):
        with urllib.request.urlopen(source, timeout=90) as response:
            return json.load(response)

    source_path = pathlib.Path(source)
    with source_path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def pick_first_value(props: Dict[str, Any], keys: Iterable[str], default: str = "Unknown") -> str:
    for key in keys:
        value = props.get(key)
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def parse_float(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def parse_point(feature: Dict[str, Any]) -> Optional[Tuple[float, float]]:
    geometry = feature.get("geometry") or {}
    if geometry.get("type") != "Point":
        return None

    coordinates = geometry.get("coordinates") or []
    if len(coordinates) < 2:
        return None

    lon, lat = coordinates[0], coordinates[1]
    try:
        lon_f, lat_f = float(lon), float(lat)
    except (TypeError, ValueError):
        return None

    if not (-180 <= lon_f <= 180 and -90 <= lat_f <= 90):
        return None

    return lon_f, lat_f


def diameter_bucket(diameter: Optional[float]) -> str:
    if diameter is None or math.isnan(diameter):
        return "Unknown"
    if diameter < 6:
        return "<6 in"
    if diameter < 12:
        return "6-12 in"
    if diameter < 24:
        return "12-24 in"
    return "24+ in"


def normalize_feature(feature: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
    coords = parse_point(feature)
    if coords is None:
        return None

    props = feature.get("properties") or {}
    diameter = parse_float(
        props.get("diameter")
        or props.get("dbh")
        or props.get("diameter_in")
        or props.get("diameterin")
    )

    normalized_props = {
        "id": props.get("objectid") or props.get("id") or index,
        "species": pick_first_value(
            props,
            [
                "common_name",
                "species",
                "species_name",
                "treetype",
                "tree_type",
                "scientific_name",
                "botanical_name",
            ],
        ),
        "condition": pick_first_value(props, ["condition", "tree_condition", "health"]),
        "neighborhood": pick_first_value(
            props,
            [
                "neighborhood",
                "neighborhood_name",
                "district",
                "subdistrict",
            ],
        ),
        "address": pick_first_value(props, ["address", "site_address", "street"], default="N/A"),
        "diameter": diameter,
        "diameter_bucket": diameter_bucket(diameter),
    }

    return {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [coords[0], coords[1]]},
        "properties": normalized_props,
    }


def build_summary(features: list[Dict[str, Any]]) -> Dict[str, Any]:
    species_counts = Counter(item["properties"]["species"] for item in features)
    condition_counts = Counter(item["properties"]["condition"] for item in features)
    neighborhood_counts = Counter(item["properties"]["neighborhood"] for item in features)
    diameter_buckets = Counter(item["properties"]["diameter_bucket"] for item in features)

    return {
        "total_trees": len(features),
        "unique_species": len(species_counts),
        "top_species": species_counts.most_common(10),
        "condition_distribution": condition_counts.most_common(10),
        "top_neighborhoods": neighborhood_counts.most_common(10),
        "diameter_distribution": [
            ["<6 in", diameter_buckets.get("<6 in", 0)],
            ["6-12 in", diameter_buckets.get("6-12 in", 0)],
            ["12-24 in", diameter_buckets.get("12-24 in", 0)],
            ["24+ in", diameter_buckets.get("24+ in", 0)],
            ["Unknown", diameter_buckets.get("Unknown", 0)],
        ],
    }


def write_json(path: pathlib.Path, payload: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


def main() -> int:
    args = parse_args()

    try:
        raw_geojson = load_geojson(args.source)
    except Exception as error:  # pragma: no cover - useful for CLI diagnostics
        print(f"Error loading source '{args.source}': {error}", file=sys.stderr)
        return 1

    raw_features = raw_geojson.get("features") or []
    if args.limit and args.limit > 0:
        raw_features = raw_features[: args.limit]

    normalized_features = []
    for index, feature in enumerate(raw_features):
        normalized = normalize_feature(feature, index)
        if normalized is not None:
            normalized_features.append(normalized)

    feature_collection = {"type": "FeatureCollection", "features": normalized_features}
    summary = build_summary(normalized_features)

    output_geojson = pathlib.Path(args.output_geojson)
    output_summary = pathlib.Path(args.output_summary)

    write_json(output_geojson, feature_collection)
    write_json(output_summary, summary)

    print(f"Prepared {summary['total_trees']} tree records")
    print(f"GeoJSON: {output_geojson}")
    print(f"Summary: {output_summary}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
