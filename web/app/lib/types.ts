export type DataCenter = {
  OBJECTID: number;
  PEC_ID: string | null;
  Locality: string | null;
  Name: string | null;
  Owner_Applicant: string | null;
  Street_Address: string | null;
  Acres: number | null;
  Building_Sq_Ft: number | null;
  MW_reported: number | null;
  Construction_Type: string | null;
  Build_Status: string | null;
  Notes: string | null;
  Source_link: string | null;
  Lat: number | null;
  Long: number | null;
  Date_Updated: string | null;
};

/** Per-facility community context from impact_scores.json. */
export type ImpactRecord = {
  OBJECTID: number;
  Population_0_5mi: number | null;
  Housing_0_5mi: number | null;
  Population_1_0mi: number | null;
  Housing_1_0mi: number | null;
  Population_3_0mi: number | null;
  Housing_3_0mi: number | null;
  Facilities_1_0mi: number | null;
  Proposed_1_0mi: number | null;
  Existing_1_0mi: number | null;
  Facilities_3_0mi: number | null;
  Proposed_3_0mi: number | null;
  Existing_3_0mi: number | null;
  Impact_Score: number | null;
  Impact_Level: string | null;
  Data_Confidence: string | null;
};

/** Block-group properties in the community GeoJSON. */
export type CommunityProps = {
  GEOID: string;
  population: number | null;
  housing_units: number | null;
  data_centers_3mi: number | null;
  existing_centers_3mi: number | null;
  proposed_centers_3mi: number | null;
  reported_MW_3mi: number | null;
  development_pressure_score: number | null;
  impact_level: string | null;
  data_confidence: string | null;
  /** Composite impact score (0-100) and its weighted
   *  component contributions, which sum to the score. */
  impact_score: number | null;
  imp_pop: number | null;
  imp_density: number | null;
  imp_power: number | null;
  imp_proposed: number | null;
};

/** Locality aggregate from locality_stats.json. */
export type LocalityStat = {
  name: string;
  fips: string | null;
  facilities: number;
  proposed: number;
  existing: number;
  reported_MW: number;
  development_pressure: number | null;
  bounds:
    | [number, number, number, number]
    | null;
};

/** Statewide aggregates from virginia_stats.json. */
export type VaStats = {
  communities_total: number;
  communities_near_facilities: number;
  population_near_facilities: number;
  avg_development_pressure: number;
  max_reported_MW_3mi: number;
};

export type AnalysisMode =
  | "none"
  | "community"
  | "development"
  | "power"
  | "impact";

export type CommunityStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

export type NearbyFacility = {
  center: DataCenter;
  distanceMiles: number;
};

export type Selection =
  | { kind: "facility"; center: DataCenter }
  | { kind: "community"; props: CommunityProps }
  | {
      kind: "search";
      label: string;
      lng: number;
      lat: number;
      community: CommunityProps | null;
      nearby: NearbyFacility[];
      /** True while the block-group lookup is pending. */
      pending: boolean;
    };

export type FacilityFilters = {
  showProposed: boolean;
  showExisting: boolean;
  locality: string | null;
  query: string;
  minMW: number | null;
};
