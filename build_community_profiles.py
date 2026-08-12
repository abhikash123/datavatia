import pandas as pd
import geopandas as gpd
import numpy as np
from pathlib import Path

# ============================================================
# DATAVATIA — COMMUNITY PROFILE ENGINE
# ============================================================

print("=" * 65)
print("DATAVATIA — COMMUNITY PROFILE ENGINE")
print("=" * 65)

# ============================================================
# PATHS
# ============================================================

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"

DATA_CENTER_FILE = DATA_DIR / "virginia_data_centers.csv"
IMPACT_FILE = DATA_DIR / "data_center_community" / "datavatia_impact_scores.csv"
BLOCK_GROUP_FILE = DATA_DIR / "virginia_block_groups_population.geojson"

OUTPUT_DIR = DATA_DIR / "community_profiles"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_CSV = OUTPUT_DIR / "virginia_community_profiles.csv"
OUTPUT_GEOJSON = OUTPUT_DIR / "virginia_community_profiles.geojson"


# ============================================================
# LOAD DATA CENTER DATA
# ============================================================

print("\nLoading data center dataset...")

dc = pd.read_csv(DATA_CENTER_FILE)

print(f"Loaded {len(dc):,} data centers.")


# ============================================================
# LOAD IMPACT DATA
# ============================================================

print("\nLoading data center impact scores...")

impact = pd.read_csv(IMPACT_FILE)

print(f"Loaded {len(impact):,} impact records.")


# ============================================================
# LOAD CENSUS BLOCK GROUPS
# ============================================================

print("\nLoading Census block groups...")

communities = gpd.read_file(BLOCK_GROUP_FILE)

print(f"Loaded {len(communities):,} Census block groups.")


# ============================================================
# CLEAN DATA CENTER DATA
# ============================================================

print("\nCleaning data center records...")

dc["Lat1"] = pd.to_numeric(dc["Lat1"], errors="coerce")
dc["Long"] = pd.to_numeric(dc["Long"], errors="coerce")

dc["Acres"] = pd.to_numeric(dc["Acres"], errors="coerce")
dc["Building_Sq_Ft"] = pd.to_numeric(
    dc["Building_Sq_Ft"],
    errors="coerce"
)

dc["MW_reported"] = pd.to_numeric(
    dc["MW_reported"],
    errors="coerce"
)

dc = dc.dropna(
    subset=["Lat1", "Long"]
).copy()

print(f"Facilities with usable coordinates: {len(dc):,}")


# ============================================================
# CREATE DATA CENTER GEOMETRIES
# ============================================================

print("\nCreating data center geometries...")

dc_geo = gpd.GeoDataFrame(
    dc,
    geometry=gpd.points_from_xy(
        dc["Long"],
        dc["Lat1"]
    ),
    crs="EPSG:4326"
)


# ============================================================
# PROJECT BOTH DATASETS
# ============================================================

print("\nProjecting geographic data...")

communities = communities.to_crs("EPSG:32618")
dc_geo = dc_geo.to_crs("EPSG:32618")


# ============================================================
# CREATE 3-MILE BUFFERS
# ============================================================

print("\nCreating 3-mile development zones...")

# 3 miles = 4828.032 meters

dc_geo["buffer_3mi"] = dc_geo.geometry.buffer(
    4828.032
)


# ============================================================
# CALCULATE COMMUNITY DEVELOPMENT
# ============================================================

print("\nCalculating development surrounding each community...")

results = []

total = len(communities)

for i, community in communities.iterrows():

    if i % 250 == 0:
        print(f"Processing community {i:,}/{total:,}...")

    geometry = community.geometry

    # --------------------------------------------------------
    # Nearby facilities
    # --------------------------------------------------------

    nearby = dc_geo[
        dc_geo["buffer_3mi"].intersects(geometry)
    ]

    total_facilities = len(nearby)

    proposed = (
        nearby["Build_Status"]
        .astype(str)
        .str.lower()
        .eq("proposed")
        .sum()
    )

    existing = (
        nearby["Build_Status"]
        .astype(str)
        .str.lower()
        .eq("existing")
        .sum()
    )

    # --------------------------------------------------------
    # Power
    # --------------------------------------------------------

    reported_mw = nearby["MW_reported"].sum(
        skipna=True
    )

    facilities_with_mw = nearby[
        "MW_reported"
    ].notna().sum()

    # --------------------------------------------------------
    # Physical development
    # --------------------------------------------------------

    acres = nearby["Acres"].sum(
        skipna=True
    )

    building_sq_ft = nearby[
        "Building_Sq_Ft"
    ].sum(skipna=True)

    # --------------------------------------------------------
    # Development pressure
    # --------------------------------------------------------

    if total_facilities > 0:

        proposed_ratio = (
            proposed / total_facilities
        )

    else:

        proposed_ratio = 0

    # --------------------------------------------------------
    # Population
    # --------------------------------------------------------

    population = pd.to_numeric(
        community.get("population"),
        errors="coerce"
    )

    housing = pd.to_numeric(
        community.get("housing_units"),
        errors="coerce"
    )

    # --------------------------------------------------------
    # Save result
    # --------------------------------------------------------

    results.append({
        "GEOID": community["GEOID"],
        "population": population,
        "housing_units": housing,

        "data_centers_3mi": total_facilities,
        "existing_centers_3mi": existing,
        "proposed_centers_3mi": proposed,

        "proposed_ratio": proposed_ratio,

        "reported_MW_3mi": reported_mw,
        "facilities_with_MW": facilities_with_mw,

        "data_center_acres_3mi": acres,
        "building_sq_ft_3mi": building_sq_ft
    })


# ============================================================
# CREATE DATAFRAME
# ============================================================

profiles = pd.DataFrame(results)

print("\nCommunity calculations complete.")


# ============================================================
# DEVELOPMENT PRESSURE SCORE
# ============================================================

print("\nCalculating development pressure scores...")


def percentile_score(series):

    if series.max() == series.min():
        return pd.Series(
            0,
            index=series.index
        )

    return (
        series.rank(
            pct=True,
            method="average"
        ) * 100
    )


profiles["density_score"] = percentile_score(
    profiles["data_centers_3mi"]
)

profiles["proposed_score"] = percentile_score(
    profiles["proposed_centers_3mi"]
)

profiles["power_score"] = percentile_score(
    profiles["reported_MW_3mi"]
)


# ============================================================
# COMMUNITY PRESSURE SCORE
# ============================================================

# For now:
#
# 45% = total development density
# 35% = proposed development
# 20% = reported power
#
# Power is weighted less because MW data is
# incomplete in the source dataset.

profiles["development_pressure_score"] = (
    profiles["density_score"] * 0.45
    +
    profiles["proposed_score"] * 0.35
    +
    profiles["power_score"] * 0.20
)


# ============================================================
# IMPACT LEVEL
# ============================================================

def classify_score(score):

    if score >= 75:
        return "Very High"

    elif score >= 50:
        return "High"

    elif score >= 25:
        return "Moderate"

    else:
        return "Lower"


profiles["impact_level"] = (
    profiles["development_pressure_score"]
    .apply(classify_score)
)


# ============================================================
# DATA CONFIDENCE
# ============================================================

def confidence(row):

    score = 0

    if row["data_centers_3mi"] > 0:
        score += 1

    if row["proposed_centers_3mi"] > 0:
        score += 1

    if row["facilities_with_MW"] > 0:
        score += 1

    if pd.notna(row["population"]):
        score += 1

    if score >= 4:
        return "High"

    elif score >= 2:
        return "Moderate"

    else:
        return "Low"


profiles["data_confidence"] = profiles.apply(
    confidence,
    axis=1
)


# ============================================================
# MERGE BACK WITH GEOGRAPHIES
# ============================================================

print("\nJoining profiles to geographic boundaries...")

communities = communities.merge(
    profiles,
    on="GEOID",
    how="left"
)


# ============================================================
# SORT BY IMPACT
# ============================================================

profiles = profiles.sort_values(
    "development_pressure_score",
    ascending=False
)


# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 65)
print("DATAVATIA COMMUNITY PROFILE SUMMARY")
print("=" * 65)

print(
    f"\nCommunities analyzed: "
    f"{len(profiles):,}"
)

print(
    f"\nCommunities with data centers nearby: "
    f"{(profiles['data_centers_3mi'] > 0).sum():,}"
)

print(
    f"\nCommunities with proposed development: "
    f"{(profiles['proposed_centers_3mi'] > 0).sum():,}"
)

print("\nImpact levels:")

print(
    profiles["impact_level"]
    .value_counts()
)


# ============================================================
# TOP COMMUNITIES
# ============================================================

print("\nTOP 20 COMMUNITIES BY DEVELOPMENT PRESSURE")

display_columns = [
    "GEOID",
    "population",
    "data_centers_3mi",
    "proposed_centers_3mi",
    "reported_MW_3mi",
    "development_pressure_score",
    "impact_level",
    "data_confidence"
]

print(
    profiles[
        display_columns
    ].head(20).to_string(
        index=False
    )
)


# ============================================================
# SAVE CSV
# ============================================================

print("\nSaving community CSV...")

profiles.to_csv(
    OUTPUT_CSV,
    index=False
)

print(
    f"Saved to:\n{OUTPUT_CSV.resolve()}"
)


# ============================================================
# SAVE GEOJSON
# ============================================================

print("\nSaving geographic community dataset...")

communities.to_file(
    OUTPUT_GEOJSON,
    driver="GeoJSON"
)

print(
    f"Saved to:\n{OUTPUT_GEOJSON.resolve()}"
)


# ============================================================
# FINAL
# ============================================================

print("\n" + "=" * 65)
print("COMMUNITY PROFILE ENGINE COMPLETE")
print("=" * 65)