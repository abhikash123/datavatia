import requests
import os
import geopandas as gpd
import pandas as pd
from pathlib import Path
from getpass import getpass


# ============================================================
# CONFIGURATION
# ============================================================

YEAR = 2020
STATE_FIPS = "51"  # Virginia

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"

BLOCK_GROUP_FILE = DATA_DIR / "virginia_block_groups.geojson"
OUTPUT_FILE = DATA_DIR / "virginia_block_groups_population.geojson"


# ============================================================
# LOAD BLOCK GROUP GEOMETRIES
# ============================================================

print("=" * 60)
print("DATAVATIA — CENSUS POPULATION DATA")
print("=" * 60)

print("\nLoading Virginia block groups...")

if not BLOCK_GROUP_FILE.exists():
    raise FileNotFoundError(
        f"Could not find:\n{BLOCK_GROUP_FILE}\n\n"
        "Make sure download_census.py has been run first."
    )

gdf = gpd.read_file(BLOCK_GROUP_FILE)

print(f"Loaded {len(gdf):,} block groups.")


# ============================================================
# GET CENSUS API KEY
# ============================================================

print("\nChecking Census API key...")

API_KEY = os.environ.get("CENSUS_API_KEY")

if not API_KEY:
    print("\nCensus API key is not set in PowerShell.")
    print("Enter your NEW Census API key below.")
    print("(Your key will not be printed back to the screen.)\n")

    API_KEY = getpass("Census API key: ")

if not API_KEY:
    raise RuntimeError(
        "No Census API key was provided."
    )

print("Census API key received.")


# ============================================================
# DOWNLOAD CENSUS DATA
# ============================================================

print("\nDownloading Census population and housing data...")

url = f"https://api.census.gov/data/{YEAR}/dec/pl"

params = [
    ("get", "NAME,P1_001N,H1_001N"),
    ("for", "block group:*"),
    ("in", f"state:{STATE_FIPS}"),
    ("in", "county:*"),
    ("in", "tract:*"),
    ("key", API_KEY)
]


response = requests.get(
    url,
    params=params,
    timeout=60
)

print(f"HTTP status: {response.status_code}")


# ============================================================
# HANDLE CENSUS API ERRORS
# ============================================================

if response.status_code != 200:
    print("\nCensus API returned an error:")
    print(response.text[:2000])
    response.raise_for_status()


# Make sure the response is actually JSON
content_type = response.headers.get("Content-Type", "")

if "json" not in content_type.lower():
    print("\nUnexpected Census API response:")
    print(response.text[:2000])

    raise RuntimeError(
        "Census API did not return JSON."
    )


data = response.json()


# ============================================================
# CONVERT RESPONSE TO DATAFRAME
# ============================================================

headers = data[0]
rows = data[1:]

census = pd.DataFrame(
    rows,
    columns=headers
)

print(f"Received {len(census):,} Census records.")


# ============================================================
# CREATE GEOID
# ============================================================

census["GEOID"] = (
    census["state"].astype(str).str.zfill(2)
    + census["county"].astype(str).str.zfill(3)
    + census["tract"].astype(str).str.zfill(6)
    + census["block group"].astype(str)
)


# ============================================================
# CONVERT NUMERIC DATA
# ============================================================

census["population"] = pd.to_numeric(
    census["P1_001N"],
    errors="coerce"
)

census["housing_units"] = pd.to_numeric(
    census["H1_001N"],
    errors="coerce"
)


# ============================================================
# KEEP ONLY REQUIRED FIELDS
# ============================================================

census = census[
    [
        "GEOID",
        "population",
        "housing_units"
    ]
]


# ============================================================
# JOIN CENSUS DATA TO BLOCK GROUPS
# ============================================================

print("\nJoining Census data to block-group boundaries...")

gdf["GEOID"] = gdf["GEOID"].astype(str)

gdf = gdf.merge(
    census,
    on="GEOID",
    how="left"
)


# ============================================================
# CHECK RESULTS
# ============================================================

matched = gdf["population"].notna().sum()
missing = gdf["population"].isna().sum()

print("\n" + "=" * 60)
print("CENSUS JOIN RESULTS")
print("=" * 60)

print(f"\nBlock groups: {len(gdf):,}")
print(f"Population matched: {matched:,}")
print(f"Population missing: {missing:,}")

print(
    f"\nTotal population represented: "
    f"{gdf['population'].sum():,.0f}"
)

print(
    f"Total housing units represented: "
    f"{gdf['housing_units'].sum():,.0f}"
)


# ============================================================
# SAVE
# ============================================================

print("\nSaving enriched GeoJSON...")

gdf.to_file(
    OUTPUT_FILE,
    driver="GeoJSON"
)

print("\nSaved to:")
print(OUTPUT_FILE.resolve())


# ============================================================
# COMPLETE
# ============================================================

print("\n" + "=" * 60)
print("CENSUS DATA COMPLETE")
print("=" * 60)