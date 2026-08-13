import pandas as pd
import json
from pathlib import Path
import math

PROJECT_DIR = Path(__file__).resolve().parent

INPUT = PROJECT_DIR / "data" / "virginia_data_centers.csv"
OUTPUT = PROJECT_DIR / "web" / "public" / "data" / "data_centers.json"

print("=" * 60)
print("DATAVATIA — WEB DATA PREPARATION")
print("=" * 60)

print("\nLoading data center dataset...")

df = pd.read_csv(INPUT)

print(f"Loaded {len(df):,} data centers.")

fields = [
    "OBJECTID",
    "PEC_ID",
    "Locality",
    "Name",
    "Owner_Applicant",
    "Street_Address",
    "Acres",
    "Building_Sq_Ft",
    "MW_reported",
    "Construction_Type",
    "Build_Status",
    "Notes",
    "Source_link",
    "Lat",
    "Long",
    "Date_Updated",
]

fields = [field for field in fields if field in df.columns]

df = df[fields]


# ------------------------------------------------------------
# Normalize known typos in the source dataset so locality
# grouping and filtering see one consistent name.
# ------------------------------------------------------------

LOCALITY_FIXES = {
    "Wyth County": "Wythe County",
}

if "Locality" in df.columns:
    df["Locality"] = df["Locality"].replace(
        LOCALITY_FIXES
    )


# ------------------------------------------------------------
# Convert every pandas NaN / infinity value into JSON null
# ------------------------------------------------------------

def clean_value(value):
    if pd.isna(value):
        return None

    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None

    return value


records = []

for record in df.to_dict(orient="records"):
    cleaned = {
        key: clean_value(value)
        for key, value in record.items()
    }

    records.append(cleaned)


# ------------------------------------------------------------
# Save VALID JSON
# ------------------------------------------------------------

OUTPUT.parent.mkdir(parents=True, exist_ok=True)

with open(OUTPUT, "w", encoding="utf-8") as f:
    json.dump(
        records,
        f,
        indent=2,
        allow_nan=False
    )

print(f"\nConverted {len(records):,} records.")

print("\nSaved valid JSON to:")
print(OUTPUT)

print("\n" + "=" * 60)
print("WEB DATA PREPARATION COMPLETE")
print("=" * 60)