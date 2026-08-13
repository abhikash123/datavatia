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

STATS_OUTPUT = (
    PROJECT_DIR
    / "web"
    / "public"
    / "data"
    / "community"
    / "virginia_stats.json"
)

LOCALITY_OUTPUT = (
    PROJECT_DIR
    / "web"
    / "public"
    / "data"
    / "community"
    / "locality_stats.json"
)

FACILITIES_JSON = (
    PROJECT_DIR
    / "web"
    / "public"
    / "data"
    / "data_centers.json"
)

# Weights of the composite community impact score. Components
# are average-rank percentiles (0-100, mirroring
# build_community_profiles.py) of the raw metrics, so the
# composite never double-counts the development_pressure_score
# (which already blends density, proposed, and power).
IMPACT_WEIGHTS = {
    "population": 0.30,  # population exposure
    "data_centers_3mi": 0.30,  # facility density
    "reported_MW_3mi": 0.20,  # power infrastructure
    "proposed_centers_3mi": 0.20,  # proposed development
}

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


def avg_rank_percentile(values):
    """Average-rank percentile (0-100) per value, mirroring
    pandas rank(pct=True, method="average") as used by
    build_community_profiles.py."""

    n = len(values)

    if n == 0 or max(values) == min(values):
        return [0.0] * n

    order = sorted(range(n), key=lambda i: values[i])

    ranks = [0.0] * n
    i = 0

    while i < n:
        j = i
        while (
            j + 1 < n
            and values[order[j + 1]] == values[order[i]]
        ):
            j += 1

        avg_rank = (i + j) / 2 + 1  # 1-based average rank

        for k in range(i, j + 1):
            ranks[order[k]] = avg_rank

        i = j + 1

    return [r / n * 100 for r in ranks]


def point_in_ring(lng, lat, ring):
    """Ray casting: is (lng, lat) inside the ring?"""

    inside = False
    j = len(ring) - 1

    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]

        if (yi > lat) != (yj > lat):
            x_cross = (xj - xi) * (lat - yi) / (yj - yi) + xi
            if lng < x_cross:
                inside = not inside

        j = i

    return inside


def point_in_geometry(lng, lat, geometry):
    polygons = (
        [geometry["coordinates"]]
        if geometry["type"] == "Polygon"
        else geometry["coordinates"]
    )

    for polygon in polygons:
        if not polygon:
            continue
        if point_in_ring(lng, lat, polygon[0]):
            # Inside the outer ring; holes are negligible for
            # census block groups at this scale.
            return True

    return False


def geometry_bounds(geometry):
    min_lng = min_lat = float("inf")
    max_lng = max_lat = float("-inf")

    def visit(coords):
        nonlocal min_lng, min_lat, max_lng, max_lat
        if isinstance(coords[0], (int, float)):
            min_lng = min(min_lng, coords[0])
            max_lng = max(max_lng, coords[0])
            min_lat = min(min_lat, coords[1])
            max_lat = max(max_lat, coords[1])
        else:
            for part in coords:
                visit(part)

    visit(geometry["coordinates"])
    return min_lng, min_lat, max_lng, max_lat


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

    # --------------------------------------------------------
    # Composite impact score (percentile components).
    # --------------------------------------------------------

    print("\nCalculating composite impact scores...")

    geoids = list(profiles.keys())

    component_pct = {}

    for metric in IMPACT_WEIGHTS:
        values = [
            num(profiles[g][metric]) or 0 for g in geoids
        ]
        component_pct[metric] = dict(
            zip(geoids, avg_rank_percentile(values))
        )

    impact = {}

    for g in geoids:
        parts = {
            metric: round(
                IMPACT_WEIGHTS[metric]
                * component_pct[metric][g],
                1,
            )
            for metric in IMPACT_WEIGHTS
        }
        impact[g] = {
            "score": round(sum(parts.values()), 1),
            "parts": parts,
        }

    # --------------------------------------------------------
    # Locality aggregates (rankings). County FIPS for each
    # locality is found by locating its facilities in block
    # groups (GEOID prefix); development pressure is the
    # population-weighted mean of the county's block groups.
    # --------------------------------------------------------

    print("\nAggregating locality statistics...")

    with open(FACILITIES_JSON, encoding="utf-8") as f:
        facilities = json.load(f)

    feature_bboxes = []

    for feature in boundaries["features"]:
        geometry = feature["geometry"]
        bbox = geometry.get("bbox") or geometry_bounds(
            geometry
        )
        feature_bboxes.append((feature, bbox))

    def county_of(lng, lat):
        for feature, (
            min_lng,
            min_lat,
            max_lng,
            max_lat,
        ) in feature_bboxes:
            if (
                min_lng <= lng <= max_lng
                and min_lat <= lat <= max_lat
                and point_in_geometry(
                    lng, lat, feature["geometry"]
                )
            ):
                return feature["properties"]["GEOID"][:5]
        return None

    localities = {}

    for facility in facilities:
        name = facility.get("Locality")
        lat = facility.get("Lat")
        lng = facility.get("Long")

        if not name or not isinstance(lat, (int, float)):
            continue

        entry = localities.setdefault(
            name,
            {
                "name": name,
                "facilities": 0,
                "proposed": 0,
                "existing": 0,
                "reported_MW": 0.0,
                "fips_votes": {},
            },
        )

        entry["facilities"] += 1

        status = facility.get("Build_Status")
        if status == "Proposed":
            entry["proposed"] += 1
        elif status == "Existing":
            entry["existing"] += 1

        mw = facility.get("MW_reported")
        if isinstance(mw, (int, float)):
            entry["reported_MW"] += mw

        fips = county_of(lng, lat)
        if fips:
            entry["fips_votes"][fips] = (
                entry["fips_votes"].get(fips, 0) + 1
            )

    county_bounds = {}

    for feature, bbox in feature_bboxes:
        fips = feature["properties"]["GEOID"][:5]
        prev = county_bounds.get(fips)
        if prev is None:
            county_bounds[fips] = list(bbox)
        else:
            prev[0] = min(prev[0], bbox[0])
            prev[1] = min(prev[1], bbox[1])
            prev[2] = max(prev[2], bbox[2])
            prev[3] = max(prev[3], bbox[3])

    locality_rows = []

    for entry in localities.values():
        votes = entry.pop("fips_votes")
        fips = (
            max(votes, key=lambda k: votes[k])
            if votes
            else None
        )

        pressure = None
        bounds = None

        if fips:
            rows = [
                p
                for g, p in profiles.items()
                if g.startswith(fips)
            ]

            weight_total = 0.0
            weighted = 0.0

            for p in rows:
                pop = num(p["population"]) or 0
                score = (
                    num(p["development_pressure_score"])
                    or 0
                )
                weight_total += pop
                weighted += pop * score

            if weight_total > 0:
                pressure = round(
                    weighted / weight_total, 1
                )
            elif rows:
                pressure = round(
                    sum(
                        num(
                            p[
                                "development_pressure_score"
                            ]
                        )
                        or 0
                        for p in rows
                    )
                    / len(rows),
                    1,
                )

            raw_bounds = county_bounds.get(fips)
            if raw_bounds:
                bounds = [
                    round(v, 4) for v in raw_bounds
                ]

        locality_rows.append(
            {
                "name": entry["name"],
                "fips": fips,
                "facilities": entry["facilities"],
                "proposed": entry["proposed"],
                "existing": entry["existing"],
                "reported_MW": round(
                    entry["reported_MW"], 1
                ),
                "development_pressure": pressure,
                "bounds": bounds,
            }
        )

    locality_rows.sort(
        key=lambda r: -r["facilities"]
    )

    with open(
        LOCALITY_OUTPUT, "w", encoding="utf-8"
    ) as f:
        json.dump(locality_rows, f, indent=1)

    print(
        f"Saved {len(locality_rows)} localities to:"
        f"\n{LOCALITY_OUTPUT}"
    )

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
            "data_confidence": profile["data_confidence"],
            # Composite impact score and its weighted
            # component contributions (they sum to the score).
            "impact_score": impact[geoid]["score"],
            "imp_pop": impact[geoid]["parts"][
                "population"
            ],
            "imp_density": impact[geoid]["parts"][
                "data_centers_3mi"
            ],
            "imp_power": impact[geoid]["parts"][
                "reported_MW_3mi"
            ],
            "imp_proposed": impact[geoid]["parts"][
                "proposed_centers_3mi"
            ],
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

    # --------------------------------------------------------
    # Statewide aggregates for the header statistics bar.
    # Computed over every profile row (including the water-only
    # block groups that have no cartographic geometry).
    # --------------------------------------------------------

    print("\nSaving statewide statistics...")

    near = [
        p
        for p in profiles.values()
        if (num(p["data_centers_3mi"]) or 0) > 0
    ]

    pressures = [
        num(p["development_pressure_score"]) or 0
        for p in profiles.values()
    ]

    mw_values = [
        num(p["reported_MW_3mi"]) or 0
        for p in profiles.values()
    ]

    stats = {
        "communities_total": len(profiles),
        "communities_near_facilities": len(near),
        "population_near_facilities": int(
            sum(num(p["population"]) or 0 for p in near)
        ),
        "avg_development_pressure": round(
            sum(pressures) / len(pressures), 1
        ),
        "max_reported_MW_3mi": round(max(mw_values), 1),
    }

    with open(STATS_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=2)

    print(f"Saved to:\n{STATS_OUTPUT}")
    print(f"Stats: {stats}")

    print("\n" + "=" * 60)
    print("WEB COMMUNITY DATA COMPLETE")
    print("=" * 60)


if __name__ == "__main__":
    main()
