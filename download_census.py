import requests
import geopandas as gpd
from pathlib import Path
from io import BytesIO
import zipfile
import shutil


# ============================================================
# CONFIGURATION
# ============================================================

YEAR = 2020
STATE_FIPS = "51"  # Virginia

PROJECT_DIR = Path(__file__).resolve().parent
DATA_DIR = PROJECT_DIR / "data"
TEMP_DIR = DATA_DIR / "census_bg_temp"

OUTPUT_FILE = DATA_DIR / "virginia_block_groups.geojson"


# ============================================================
# SETUP
# ============================================================

DATA_DIR.mkdir(exist_ok=True)

print("=" * 60)
print("DATAVATIA — CENSUS BLOCK GROUP DOWNLOADER")
print("=" * 60)

print("\nDownloading Virginia Census block groups...")


# ============================================================
# DOWNLOAD TIGER/LINE DATA
# ============================================================

URL = (
    f"https://www2.census.gov/geo/tiger/TIGER{YEAR}/BG/"
    f"tl_{YEAR}_{STATE_FIPS}_bg.zip"
)

print(f"URL: {URL}")

response = requests.get(URL, timeout=60)
response.raise_for_status()

print("Download complete.")


# ============================================================
# EXTRACT ZIP
# ============================================================

print("\nExtracting files...")

if TEMP_DIR.exists():
    shutil.rmtree(TEMP_DIR)

TEMP_DIR.mkdir(parents=True)

with zipfile.ZipFile(BytesIO(response.content)) as z:
    z.extractall(TEMP_DIR)

print("Extraction complete.")


# ============================================================
# FIND SHAPEFILE
# ============================================================

shapefiles = list(TEMP_DIR.glob("*.shp"))

if not shapefiles:
    raise RuntimeError(
        "Could not find the Census block-group shapefile."
    )

shapefile = shapefiles[0]

print(f"\nShapefile found:")
print(shapefile)


# ============================================================
# LOAD WITH GEOPANDAS
# ============================================================

print("\nLoading Census block groups...")

gdf = gpd.read_file(shapefile)

print(f"Loaded {len(gdf):,} Virginia block groups.")


# ============================================================
# SHOW AVAILABLE FIELDS
# ============================================================

print("\nAvailable fields:")

for column in gdf.columns:
    print(f"  - {column}")


# ============================================================
# SAVE GEOJSON
# ============================================================

print("\nSaving GeoJSON...")

gdf.to_file(
    OUTPUT_FILE,
    driver="GeoJSON"
)

print("\nSaved to:")
print(OUTPUT_FILE.resolve())


# ============================================================
# CLEAN TEMPORARY FILES
# ============================================================

shutil.rmtree(TEMP_DIR)

print("\nTemporary files removed.")

print("\n" + "=" * 60)
print("DOWNLOAD COMPLETE")
print("=" * 60)
