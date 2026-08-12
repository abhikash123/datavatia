import geopandas as gpd
import pandas as pd
import numpy as np
from pathlib import Path

# ============================================================
# DATAVATIA — COMMUNITY IMPACT ENGINE
# Area-weighted population exposure + transparent impact score
# ============================================================

print("=" * 65)
print("DATAVATIA — COMMUNITY IMPACT ENGINE")
print("=" * 65)

# ============================================================
# PATHS
# ============================================================

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"

DATA_CENTER_FILE = DATA_DIR / "virginia_data_centers.csv"
BLOCK_GROUP_FILE = DATA_DIR / "virginia_block_groups_population.geojson"

OUTPUT_DIR = DATA_DIR / "data_center_community"
OUTPUT_FILE = OUTPUT_DIR / "datavatia_impact_scores.csv"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# CONFIGURATION
# ============================================================

RADII_MILES = [0.5, 1.0, 3.0]

# Virginia geographic data -> metric projection
METRIC_CRS = "EPSG:26918"

# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading data centers...")

centers = pd.read_csv(DATA_CENTER_FILE)

print(f"Loaded {len(centers):,} data centers.")

print("\nLoading Census block groups...")

blocks = gpd.read_file(BLOCK_GROUP_FILE)

print(f"Loaded {len(blocks):,} Census block groups.")

# ============================================================
# CLEAN DATA CENTER DATA
# ============================================================

print("\nCleaning data center records...")

centers["Lat1"] = pd.to_numeric(
    centers["Lat1"],
    errors="coerce"
)

centers["Long"] = pd.to_numeric(
    centers["Long"],
    errors="coerce"
)

before = len(centers)

centers = centers.dropna(
    subset=["Lat1", "Long"]
).copy()

print(
    f"Facilities without coordinates removed: "
    f"{before - len(centers)}"
)

centers["Name"] = (
    centers["Name"]
    .fillna("Unnamed facility")
)

centers["Locality"] = (
    centers["Locality"]
    .fillna("Unknown")
)

centers["Build_Status"] = (
    centers["Build_Status"]
    .fillna("Unknown")
    .astype(str)
    .str.strip()
)

for column in [
    "Acres",
    "Building_Sq_Ft",
    "MW_reported"
]:

    if column in centers.columns:

        centers[column] = pd.to_numeric(
            centers[column],
            errors="coerce"
        )

# ============================================================
# CREATE DATA CENTER GEOMETRIES
# ============================================================

print("\nCreating data center geometries...")

center_gdf = gpd.GeoDataFrame(
    centers,
    geometry=gpd.points_from_xy(
        centers["Long"],
        centers["Lat1"]
    ),
    crs="EPSG:4326"
)

# ============================================================
# PREPARE CENSUS DATA
# ============================================================

print("\nPreparing Census data...")

if blocks.crs is None:
    raise RuntimeError(
        "Census block groups have no CRS."
    )

blocks = blocks.to_crs("EPSG:4326")

blocks["population"] = pd.to_numeric(
    blocks["population"],
    errors="coerce"
).fillna(0)

blocks["housing_units"] = pd.to_numeric(
    blocks["housing_units"],
    errors="coerce"
).fillna(0)

# ============================================================
# PROJECT EVERYTHING TO METERS
# ============================================================

print("Projecting geographic data...")

center_gdf = center_gdf.to_crs(METRIC_CRS)
blocks = blocks.to_crs(METRIC_CRS)

# Remove bad geometries

blocks = blocks[
    blocks.geometry.notna()
].copy()

blocks = blocks[
    ~blocks.geometry.is_empty
].copy()

# Calculate block-group area

blocks["block_area_m2"] = (
    blocks.geometry.area
)

# ============================================================
# AREA-WEIGHTED EXPOSURE
# ============================================================

def calculate_exposure(
    point,
    blocks_gdf,
    radius_m
):

    """
    Estimate population/housing exposure
    within a radius.

    Instead of assigning the entire population
    of an intersecting block group, we weight
    population by the fraction of the block group
    that lies inside the radius.

    Example:

        Block group population = 1,000

        20% of block group inside radius

        Estimated exposure = 200
    """

    circle = point.buffer(radius_m)

    candidates = blocks_gdf[
        blocks_gdf.geometry.intersects(circle)
    ].copy()

    if candidates.empty:
        return 0.0, 0.0

    intersections = (
        candidates.geometry
        .intersection(circle)
    )

    valid = (
        intersections.notna()
        & ~intersections.is_empty
        & (candidates["block_area_m2"] > 0)
    )

    candidates = candidates.loc[
        valid
    ]

    intersections = intersections.loc[
        valid
    ]

    if candidates.empty:
        return 0.0, 0.0

    intersection_area = (
        intersections.area
    )

    area_fraction = (
        intersection_area /
        candidates["block_area_m2"]
    ).clip(
        lower=0,
        upper=1
    )

    estimated_population = (
        candidates["population"] *
        area_fraction
    ).sum()

    estimated_housing = (
        candidates["housing_units"] *
        area_fraction
    ).sum()

    return (
        float(estimated_population),
        float(estimated_housing)
    )

# ============================================================
# CALCULATE POPULATION EXPOSURE
# ============================================================

print("\nCalculating area-weighted community exposure...")

results = []

total = len(center_gdf)

for counter, (_, facility) in enumerate(
    center_gdf.iterrows(),
    start=1
):

    if counter % 25 == 0 or counter == 1:

        print(
            f"Processing facility "
            f"{counter:,}/{total:,}..."
        )

    result = {
        "OBJECTID": facility.get(
            "OBJECTID"
        ),

        "PEC_ID": facility.get(
            "PEC_ID"
        ),

        "Name": facility["Name"],

        "Locality": facility["Locality"],

        "Build_Status":
            facility["Build_Status"],

        "Lat":
            facility["Lat1"],

        "Long":
            facility["Long"],

        "Acres":
            facility.get("Acres", np.nan),

        "Building_Sq_Ft":
            facility.get(
                "Building_Sq_Ft",
                np.nan
            ),

        "MW_reported":
            facility.get(
                "MW_reported",
                np.nan
            )
    }

    # ----------------------------------------
    # POPULATION / HOUSING
    # ----------------------------------------

    for miles in RADII_MILES:

        radius_m = miles * 1609.344

        population, housing = (
            calculate_exposure(
                facility.geometry,
                blocks,
                radius_m
            )
        )

        suffix = str(miles).replace(
            ".",
            "_"
        )

        result[
            f"Population_{suffix}mi"
        ] = round(
            population,
            1
        )

        result[
            f"Housing_{suffix}mi"
        ] = round(
            housing,
            1
        )

    results.append(result)

impact = pd.DataFrame(results)

# ============================================================
# DEVELOPMENT DENSITY
# ============================================================

print("\nCalculating nearby facility density...")

# Data-center points

all_points = center_gdf[
    [
        "Build_Status",
        "geometry"
    ]
].copy()

for miles in [1.0, 3.0]:

    radius_m = miles * 1609.344

    suffix = str(miles).replace(
        ".",
        "_"
    )

    total_counts = []
    proposed_counts = []
    existing_counts = []

    for _, facility in center_gdf.iterrows():

        nearby = all_points[
            all_points.geometry.distance(
                facility.geometry
            ) <= radius_m
        ].copy()

        # Exclude the facility itself
        nearby = nearby[
            nearby.geometry.distance(
                facility.geometry
            ) > 1
        ]

        total_counts.append(
            len(nearby)
        )

        proposed_counts.append(
            (
                nearby["Build_Status"]
                == "Proposed"
            ).sum()
        )

        existing_counts.append(
            (
                nearby["Build_Status"]
                == "Existing"
            ).sum()
        )

    impact[
        f"Facilities_{suffix}mi"
    ] = total_counts

    impact[
        f"Proposed_{suffix}mi"
    ] = proposed_counts

    impact[
        f"Existing_{suffix}mi"
    ] = existing_counts

# ============================================================
# POWER DATA
# ============================================================

impact["MW_reported"] = pd.to_numeric(
    impact["MW_reported"],
    errors="coerce"
)

impact["MW_available"] = (
    impact["MW_reported"]
    .notna()
)

impact["MW_missing"] = (
    impact["MW_reported"]
    .isna()
)

# ============================================================
# PERCENTILE SCORING
# ============================================================

print("\nCalculating transparent impact scores...")

def percentile_score(series):

    values = pd.to_numeric(
        series,
        errors="coerce"
    ).fillna(0)

    low = values.quantile(0.05)
    high = values.quantile(0.95)

    if high <= low:

        return pd.Series(
            0.0,
            index=values.index
        )

    score = (
        (values - low) /
        (high - low)
    )

    return (
        score
        .clip(0, 1)
        * 100
    )

# ============================================================
# COMPONENTS
# ============================================================

community_score = percentile_score(
    impact["Population_1_0mi"]
)

development_score = percentile_score(
    impact["Facilities_3_0mi"]
)

proposed_score = percentile_score(
    impact["Proposed_3_0mi"]
)

land_score = percentile_score(
    impact["Acres"]
)

power_score = percentile_score(
    impact["MW_reported"].fillna(0)
)

# ============================================================
# WEIGHTED SCORE
# ============================================================

impact["Community_Component"] = (
    community_score * 0.30
)

impact["Development_Component"] = (
    development_score * 0.25
)

impact["Proposed_Component"] = (
    proposed_score * 0.20
)

impact["Land_Component"] = (
    land_score * 0.10
)

impact["Power_Component"] = (
    power_score * 0.15
)

impact["Impact_Score"] = (
    impact["Community_Component"]
    + impact["Development_Component"]
    + impact["Proposed_Component"]
    + impact["Land_Component"]
    + impact["Power_Component"]
).round(1)

# ============================================================
# IMPACT CATEGORY
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

impact["Impact_Level"] = (
    impact["Impact_Score"]
    .apply(classify_score)
)

# ============================================================
# DATA COMPLETENESS
# ============================================================

print("\nCalculating data confidence...")

fields = pd.DataFrame({

    "coordinates":
        impact["Lat"].notna()
        & impact["Long"].notna(),

    "status":
        impact["Build_Status"].notna(),

    "acres":
        impact["Acres"].notna(),

    "building_sq_ft":
        impact["Building_Sq_Ft"].notna(),

    "power":
        impact["MW_reported"].notna()

})

impact["Data_Completeness"] = (
    fields.mean(axis=1)
    * 100
).round(0)

def confidence(score):

    if score >= 80:
        return "High"

    elif score >= 50:
        return "Medium"

    else:
        return "Low"

impact["Data_Confidence"] = (
    impact["Data_Completeness"]
    .apply(confidence)
)

# ============================================================
# SORT
# ============================================================

impact = impact.sort_values(
    "Impact_Score",
    ascending=False
)

# ============================================================
# SAVE
# ============================================================

impact.to_csv(
    OUTPUT_FILE,
    index=False
)

# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 65)
print("DATAVATIA IMPACT RESULTS")
print("=" * 65)

print(
    f"\nFacilities analyzed: "
    f"{len(impact):,}"
)

print("\n--- AREA-WEIGHTED POPULATION ---")

print(
    "Average population within 0.5 mile: "
    f"{impact['Population_0_5mi'].mean():,.0f}"
)

print(
    "Average population within 1 mile: "
    f"{impact['Population_1_0mi'].mean():,.0f}"
)

print(
    "Average population within 3 miles: "
    f"{impact['Population_3_0mi'].mean():,.0f}"
)

print("\n--- DEVELOPMENT ---")

print(
    "Average facilities within 3 miles: "
    f"{impact['Facilities_3_0mi'].mean():,.1f}"
)

print(
    "Average proposed facilities within 3 miles: "
    f"{impact['Proposed_3_0mi'].mean():,.1f}"
)

print("\n--- POWER ---")

reported = (
    impact["MW_reported"]
    .notna()
    .sum()
)

print(
    f"Facilities with reported MW: "
    f"{reported:,}/{len(impact):,}"
)

print(
    "Reported MW total: "
    f"{impact['MW_reported'].sum(skipna=True):,.1f} MW"
)

print("\n--- IMPACT LEVELS ---")

print(
    impact["Impact_Level"]
    .value_counts()
)

print("\n--- TOP 10 FACILITIES ---")

columns = [
    "Name",
    "Locality",
    "Build_Status",
    "Population_1_0mi",
    "Facilities_3_0mi",
    "Proposed_3_0mi",
    "Impact_Score",
    "Impact_Level",
    "Data_Confidence"
]

print(
    impact[columns]
    .head(10)
    .to_string(index=False)
)

print("\nSaved to:")

print(
    OUTPUT_FILE.resolve()
)

print("\n" + "=" * 65)
print("DATAVATIA IMPACT ENGINE COMPLETE")
print("=" * 65)

