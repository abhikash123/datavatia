import argparse
import csv
import json
import urllib.request
from pathlib import Path

# ============================================================
# DATAVATIA — WEB COMMUNITY DATA BUILDER
# ============================================================
#
# Builds the GeoJSON the web map fetches for the Community
# Exposure layer:
#
#   web/public/data/community/virginia_community_profiles.geojson
#
# It joins the community profiles CSV produced by
# build_community_profiles.py onto 2020 cartographic-boundary
# block-group geometries. Cartographic boundary files are used
# instead of the full-resolution TIGER geometries because they
# are pre-simplified with consistent shared borders (no slivers
# between neighboring block groups) and small enough to serve
# to the browser.
#
# Boundary input: the Census Bureau's 1:500,000 cartographic
# boundary file for Virginia block groups (2020 vintage) as
# GeoJSON in WGS84 longitude/latitude. If the file is missing
# it is downloaded automatically from a GeoJSON mirror of the
# Census Bureau data; the original shapefile source is:
#
#   https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_51_bg_500k.zip
#
# Only stdlib is needed, so this runs anywhere Python does.

PROJECT_DIR = Path(__file__).resolve().parent

DEFAULT_BOUNDARIES = (
    PROJECT_DIR / "data" / "cb_2020_51_bg_500k.geojson"
)

BOUNDARY_URL = (
    "https://raw.githubusercontent.com/loganpowell/"
    "census-geojson/master/GeoJSON/500k/2020/51/"
    "block-group.json"
)

PROFILES_CSV = (
    PROJECT_DIR
    / "data"
    / "community_profiles"
    / "virginia_community_profiles.csv"
)

OUTPUT = (
    PROJECT_DIR
    / "web"
    / "public"
    / "data"
    / "community"
    / "virginia_community_profiles.geojson"
)

# Properties served to the browser, and the rounding applied
# to keep the file small. The map colors by "population";
# the remaining fields support popups and future analysis
# modes without another download.
COORDINATE_DECIMALS = 5  # ~1 meter


def parse_args():
    parser = argparse.ArgumentParser(
        description=(
            "Build the web community GeoJSON from the "
            "profiles CSV and cartographic boundaries."
        )
    )

    parser.add_argument(
        "--boundaries",
        type=Path,
        default=DEFAULT_BOUNDARIES,
        help=(
            "GeoJSON of 2020 Virginia block-group "
            "cartographic boundaries (WGS84) with a GEOID "
            "property. Default: %(default)s"
        ),
    )

    return parser.parse_args()


def num(value, decimals=None):
    """CSV field -> JSON number (int when whole), else None."""

    if value is None or value == "":
        return None

    number = float(value)

    if decimals is not None:
        number = round(number, decimals)

    if number == int(number):
        return int(number)

    return number


def round_coords(coords):
    if isinstance(coords, (int, float)):
        return round(coords, COORDINATE_DECIMALS)

    return [round_coords(part) for part in coords]


def main():
    args = parse_args()

    print("=" * 60)
    print("DATAVATIA — WEB COMMUNITY DATA BUILDER")
    print("=" * 60)

    if not args.boundaries.exists():
        if args.boundaries != DEFAULT_BOUNDARIES:
            raise FileNotFoundError(
                f"Boundary file not found:\n{args.boundaries}"
            )

        print(
            "\nBoundary file not found — downloading "
            "2020 cartographic boundaries..."
        )
        print(f"URL: {BOUNDARY_URL}")

        args.boundaries.parent.mkdir(
            parents=True, exist_ok=True
        )

        with urllib.request.urlopen(
            BOUNDARY_URL, timeout=120
        ) as response:
            payload = response.read()

        # Validate before saving so a failed or truncated
        # download never becomes a cached input.
        parsed = json.loads(payload)

        if parsed.get("type") != "FeatureCollection":
            raise RuntimeError(
                "Downloaded boundary file is not a "
                "GeoJSON FeatureCollection."
            )

        args.boundaries.write_bytes(payload)

        print(f"Saved to: {args.boundaries}")

    print("\nLoading boundaries...")

    with open(args.boundaries, encoding="utf-8") as f:
        boundaries = json.load(f)

    print(
        f"Loaded {len(boundaries['features']):,} "
        "block-group geometries."
    )

    print("\nLoading community profiles...")

    profiles = {}

    with open(PROFILES_CSV, encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            profiles[row["GEOID"]] = row

    print(f"Loaded {len(profiles):,} community profiles.")

    print("\nJoining profiles onto geometries...")

    features = []
    unmatched = []

    for feature in boundaries["features"]:
        geoid = feature["properties"]["GEOID"]
        profile = profiles.get(geoid)

        if profile is None:
            unmatched.append(geoid)
            continue

        properties = {
            "GEOID": geoid,
            "population": num(profile["population"]),
            "housing_units": num(profile["housing_units"]),
            "data_centers_3mi": num(
                profile["data_centers_3mi"]
            ),
            "existing_centers_3mi": num(
                profile["existing_centers_3mi"]
            ),
            "proposed_centers_3mi": num(
                profile["proposed_centers_3mi"]
            ),
            "reported_MW_3mi": num(
                profile["reported_MW_3mi"], 1
            ),
            "development_pressure_score": num(
                profile["development_pressure_score"], 2
            ),
            "impact_level": profile["impact_level"],
        }

        geometry = feature["geometry"]
        geometry.pop("bbox", None)
        geometry["coordinates"] = round_coords(
            geometry["coordinates"]
        )

        features.append(
            {
                "type": "Feature",
                "geometry": geometry,
                "properties": properties,
            }
        )

    if unmatched:
        print(
            f"WARNING: {len(unmatched)} geometries had no "
            f"profile row: {unmatched[:5]}..."
        )

    # Profiles without a geometry are expected: cartographic
    # boundary files omit water-only block groups, which carry
    # zero population.
    matched_geoids = {
        feature["properties"]["GEOID"]
        for feature in features
    }

    geometryless = [
        geoid
        for geoid in profiles
        if geoid not in matched_geoids
    ]

    if geometryless:
        print(
            f"Note: {len(geometryless)} profile rows have no "
            "cartographic geometry (water-only block groups)."
        )

    print("\nSaving web GeoJSON...")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    collection = {
        "type": "FeatureCollection",
        "features": features,
    }

    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(collection, f, separators=(",", ":"))

    size_mb = OUTPUT.stat().st_size / 1e6

    print(
        f"Saved {len(features):,} features "
        f"({size_mb:.1f} MB) to:\n{OUTPUT}"
    )

    print("\n" + "=" * 60)
    print("WEB COMMUNITY DATA COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
