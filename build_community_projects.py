import pandas as pd
import geopandas as gpd
import numpy as np
from pathlib import Path

# ============================================================
# DATAVATIA — COMMUNITY / PROJECT CONNECTION ENGINE
# ============================================================

print("=" * 65)
print("DATAVATIA — COMMUNITY / PROJECT CONNECTION ENGINE")
print("=" * 65)

# ============================================================
# PATHS
# ============================================================

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"

DATA_CENTER_FILE = DATA_DIR / "virginia_data_centers.csv"
COMMUNITY_FILE = (
    DATA_DIR
    / "community_profiles"
    / "virginia_community_profiles.geojson"
)

OUTPUT_DIR = DATA_DIR / "community_profiles"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / "community_projects.csv"


# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading data centers...")

dc = pd.read_csv(DATA_CENTER_FILE)

print(f"Loaded {len(dc):,} data centers.")


print("\nLoading community profiles...")

communities = gpd.read_file(COMMUNITY_FILE)

print(f"Loaded {len(communities):,} communities.")


# ============================================================
# CLEAN DATA CENTER COORDINATES
# ============================================================

print("\nCleaning coordinates...")

dc["Lat1"] = pd.to_numeric(
    dc["Lat1"],
    errors="coerce"
)

dc["Long"] = pd.to_numeric(
    dc["Long"],
    errors="coerce"
)

dc = dc.dropna(
    subset=["Lat1", "Long"]
).copy()

print(
    f"Data centers with coordinates: "
    f"{len(dc):,}"
)


# ============================================================
# CREATE DATA CENTER GEOMETRIES
# ============================================================

print("\nCreating project geometries...")

dc_geo = gpd.GeoDataFrame(
    dc,
    geometry=gpd.points_from_xy(
        dc["Long"],
        dc["Lat1"]
    ),
    crs="EPSG:4326"
)


# ============================================================
# PROJECT TO METRIC CRS
# ============================================================

print("\nProjecting geographic data...")

dc_geo = dc_geo.to_crs("EPSG:32618")
communities = communities.to_crs("EPSG:32618")


# ============================================================
# CREATE 3-MILE COMMUNITY ZONES
# ============================================================

print("\nCreating community search zones...")

# Instead of calculating distance from the entire
# block-group polygon, use its representative point.

communities["community_point"] = (
    communities.geometry.representative_point()
)

communities["community_point"] = (
    gpd.GeoSeries(
        communities["community_point"],
        crs=communities.crs
    )
)


# ============================================================
# CONNECT PROJECTS TO COMMUNITIES
# ============================================================

print("\nConnecting data centers to nearby communities...")

results = []

total = len(communities)

for i, community in communities.iterrows():

    if i % 250 == 0:
        print(
            f"Processing community "
            f"{i:,}/{total:,}..."
        )

    point = community["community_point"]

    # 3 mile radius
    distances = dc_geo.geometry.distance(point)

    nearby_mask = distances <= 4828.032

    nearby = dc_geo.loc[
        nearby_mask
    ].copy()

    nearby_distances = distances.loc[
        nearby_mask
    ]

    # --------------------------------------------------------
    # Create one record per community-project relationship
    # --------------------------------------------------------

    for index, project in nearby.iterrows():

        results.append({

            # Community
            "GEOID": community["GEOID"],

            "community_population": (
                community.get("population")
            ),

            "community_housing_units": (
                community.get("housing_units")
            ),

            "community_impact_score": (
                community.get(
                    "development_pressure_score"
                )
            ),

            "community_impact_level": (
                community.get(
                    "impact_level"
                )
            ),

            # Project
            "PEC_ID": project.get(
                "PEC_ID"
            ),

            "Name": project.get(
                "Name"
            ),

            "Locality": project.get(
                "Locality"
            ),

            "Owner_Applicant": project.get(
                "Owner_Applicant"
            ),

            "Street_Address": project.get(
                "Street_Address"
            ),

            "Build_Status": project.get(
                "Build_Status"
            ),

            "Construction_Type": project.get(
                "Construction_Type"
            ),

            "Acres": project.get(
                "Acres"
            ),

            "Building_Sq_Ft": project.get(
                "Building_Sq_Ft"
            ),

            "MW_reported": project.get(
                "MW_reported"
            ),

            "Notes": project.get(
                "Notes"
            ),

            "Source_link": project.get(
                "Source_link"
            ),

            "Lat": project.get(
                "Lat1"
            ),

            "Long": project.get(
                "Long"
            ),

            # Distance
            "distance_miles": (
                nearby_distances.loc[index]
                / 1609.344
            )
        })


# ============================================================
# CREATE DATAFRAME
# ============================================================

projects = pd.DataFrame(results)

print("\nConnection complete.")

print(
    f"Community-project relationships: "
    f"{len(projects):,}"
)


# ============================================================
# SORT
# ============================================================

projects = projects.sort_values(
    [
        "GEOID",
        "distance_miles"
    ]
)


# ============================================================
# SAVE
# ============================================================

print("\nSaving community-project dataset...")

projects.to_csv(
    OUTPUT_FILE,
    index=False
)

print(
    f"\nSaved to:\n"
    f"{OUTPUT_FILE.resolve()}"
)


# ============================================================
# EXAMPLE
# ============================================================

print("\n" + "=" * 65)
print("EXAMPLE COMMUNITY")
print("=" * 65)

if len(projects) > 0:

    example_geoid = (
        projects.iloc[0]["GEOID"]
    )

    example = projects[
        projects["GEOID"] == example_geoid
    ]

    print(
        example[
            [
                "GEOID",
                "Name",
                "Build_Status",
                "Locality",
                "distance_miles"
            ]
        ]
        .head(10)
        .to_string(index=False)
    )


print("\n" + "=" * 65)
print("COMMUNITY / PROJECT ENGINE COMPLETE")
print("=" * 65)