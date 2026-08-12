import requests
import pandas as pd
from pathlib import Path
import re


# ============================================================
# CONFIGURATION
# ============================================================

URL = (
    "https://services3.arcgis.com/mTaShYKffyWc5uRb/"
    "arcgis/rest/services/Data_Centers_Virginia/"
    "FeatureServer/19/query"
)

# Always save relative to THIS Python file,
# not whatever folder the terminal happens to be in.
PROJECT_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = PROJECT_DIR / "data"
OUTPUT_FILE = OUTPUT_DIR / "virginia_data_centers.csv"


# ============================================================
# DOWNLOAD DATA
# ============================================================

params = {
    "where": "1=1",
    "outFields": "*",
    "returnGeometry": "true",
    "f": "json"
}

print("Downloading Virginia data center data...")

response = requests.get(URL, params=params, timeout=30)
response.raise_for_status()

data = response.json()

if "features" not in data:
    raise RuntimeError("ArcGIS response did not contain any features.")

print(f"Downloaded {len(data['features'])} records.")


# ============================================================
# CONVERT TO DATAFRAME
# ============================================================

rows = []

for feature in data["features"]:
    row = feature["attributes"].copy()
    rows.append(row)

df = pd.DataFrame(rows)


# ============================================================
# CLEAN NUMERIC COLUMNS
# ============================================================

def clean_number(value):
    """
    Convert values such as:
        1234567
        '1,234,567'
        '$1,234,567'
        '1,234,567 sq ft'
    
    into numeric values.
    """
    if pd.isna(value):
        return None

    value = str(value).strip()

    # Keep digits, decimal point, and minus sign
    cleaned = re.sub(r"[^0-9.\-]", "", value)

    if cleaned == "":
        return None

    try:
        return float(cleaned)
    except ValueError:
        return None


# Fields that should contain numbers
numeric_columns = [
    "Acres",
    "Building_Sq_Ft",
    "MW_reported",
    "Lat",
    "Long",
    "Lat1"
]

for column in numeric_columns:
    if column in df.columns:
        df[column] = df[column].apply(clean_number)


# ============================================================
# REMOVE EMPTY COLUMNS
# ============================================================

df = df.dropna(axis=1, how="all")


# ============================================================
# SAVE DATASET
# ============================================================

OUTPUT_DIR.mkdir(exist_ok=True)

df.to_csv(OUTPUT_FILE, index=False)

print("\nSaved cleaned dataset to:")
print(OUTPUT_FILE.resolve())


# ============================================================
# DATASET SUMMARY
# ============================================================

print("\n" + "=" * 60)
print("DATAVATIA DATASET SUMMARY")
print("=" * 60)


print("\nTotal records:")
print(len(df))


print("\nBuild Status:")
print(df["Build_Status"].value_counts(dropna=False))


print("\nTop Localities:")
print(df["Locality"].value_counts(dropna=False).head(15))


print("\nReported MW Statistics:")
print(df["MW_reported"].describe())


print(
    f"\nTotal Reported MW: "
    f"{df['MW_reported'].sum():,.1f} MW"
)


print(
    f"Records with reported MW: "
    f"{df['MW_reported'].notna().sum()}/{len(df)}"
)


print(
    f"Records with building square footage: "
    f"{df['Building_Sq_Ft'].notna().sum()}/{len(df)}"
)


print("\nConstruction Type:")
print(df["Construction_Type"].value_counts(dropna=False))


# ============================================================
# DATA QUALITY
# ============================================================

print("\n" + "=" * 60)
print("DATA QUALITY")
print("=" * 60)


print(
    f"\nMissing coordinates: "
    f"{df[['Lat1', 'Long']].isna().any(axis=1).sum()}"
)


print(
    f"Missing building square footage: "
    f"{df['Building_Sq_Ft'].isna().sum()}"
)


print(
    f"Missing reported MW: "
    f"{df['MW_reported'].isna().sum()}"
)


print(
    f"Missing developer/applicant: "
    f"{df['Owner_Applicant'].isna().sum()}"
)


print(
    f"Missing status: "
    f"{df['Build_Status'].isna().sum()}"
)


print("\nDone.")

