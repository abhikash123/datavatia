import type { LayerProps } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import type { AnalysisMode } from "./types";

export const INITIAL_VIEW = {
  longitude: -78.5,
  latitude: 37.6,
  zoom: 7,
};

// Passed to the source as a URL so MapLibre's worker fetches
// and parses it off the main thread. Handing the source a
// pre-parsed object stalls the worker on a file this large.
export const COMMUNITY_DATA_URL =
  "/data/community/virginia_community_profiles.geojson";

export const COMMUNITY_SOURCE_ID = "community-source";
export const COMMUNITY_FILL_ID = "community-population-fill";
export const COMMUNITY_OUTLINE_ID =
  "community-population-outline";
export const COMMUNITY_QUERY_ID = "community-query-fill";
export const COMMUNITY_SELECT_ID = "community-selected";

export const FACILITY_SOURCE_ID = "facilities";
export const FACILITY_CLUSTER_ID = "facility-clusters";
export const FACILITY_COUNT_ID = "facility-cluster-count";
export const FACILITY_POINT_ID = "facility-points";
export const FACILITY_SELECT_ID = "facility-selected";

export const MAP_STYLE: StyleSpecification = {
  version: 8,

  // The glyphs endpoint provides the fontstack used by the
  // cluster-count symbol layer.
  glyphs:
    "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",

  sources: {
    "esri-topo": {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution:
        "Tiles &copy; Esri — Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCAN, METI, TomTom",
    },
  },

  layers: [
    {
      id: "background",
      type: "background",
      paint: {
        "background-color": "#d8ddd8",
      },
    },

    {
      id: "esri-topo-layer",
      type: "raster",
      source: "esri-topo",
      minzoom: 0,
      maxzoom: 19,
      paint: {
        "raster-opacity": 1,
      },
    },
  ],
};

// ------------------------------------------------------------
// Analysis-mode choropleth paints. All four modes share one
// fill layer on the cached community source; switching modes
// only calls setPaintProperty — no layer or source recreation.
// ------------------------------------------------------------

type ModeConfig = {
  title: string;
  subtitle: string;
  fillColor: unknown;
  legendTitle: string;
  legend: { color: string; label: string }[];
  note?: string;
};

export const MODE_CONFIG: Record<
  Exclude<AnalysisMode, "none">,
  ModeConfig
> = {
  community: {
    title: "Community Exposure",
    subtitle: "Population surrounding facilities",
    fillColor: [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "population"], 0],
      0,
      "#e8f5e9",
      250,
      "#c8e6c9",
      500,
      "#81c784",
      1000,
      "#4caf50",
      2500,
      "#ffeb3b",
      5000,
      "#ff9800",
      10000,
      "#f44336",
      20000,
      "#b71c1c",
    ],
    legendTitle: "Population density",
    legend: [
      { color: "#e8f5e9", label: "Under 250 people" },
      { color: "#81c784", label: "500 – 1,000" },
      { color: "#ffeb3b", label: "2,500 – 5,000" },
      { color: "#ff9800", label: "5,000 – 10,000" },
      { color: "#b71c1c", label: "Over 10,000" },
    ],
    note: "Census block groups shaded by 2020 population.",
  },

  development: {
    title: "Development Pressure",
    subtitle: "Facility density and proposals",
    fillColor: [
      "interpolate",
      ["linear"],
      [
        "coalesce",
        ["get", "development_pressure_score"],
        0,
      ],
      0,
      "#f2f0f7",
      25,
      "#cbc9e2",
      50,
      "#9e9ac8",
      75,
      "#756bb1",
      100,
      "#54278f",
    ],
    legendTitle: "Development pressure score",
    legend: [
      { color: "#f2f0f7", label: "0 – 25 (lower)" },
      { color: "#cbc9e2", label: "25 – 50" },
      { color: "#9e9ac8", label: "50 – 75" },
      { color: "#54278f", label: "75 – 100 (highest)" },
    ],
    note: "Percentile score combining facility density (45%), proposed development (35%), and reported power (20%) within 3 miles.",
  },

  power: {
    title: "Power Infrastructure",
    subtitle: "Reported electrical capacity",
    fillColor: [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "reported_MW_3mi"], 0],
      0,
      "#f7fbff",
      50,
      "#deebf7",
      150,
      "#9ecae1",
      300,
      "#4292c6",
      600,
      "#2171b5",
      1100,
      "#084594",
    ],
    legendTitle: "Reported MW within 3 miles",
    legend: [
      { color: "#f7fbff", label: "0 MW" },
      { color: "#9ecae1", label: "150 – 300 MW" },
      { color: "#4292c6", label: "300 – 600 MW" },
      { color: "#084594", label: "600 – 1,100 MW" },
    ],
    note: "Sum of publicly reported facility capacity within 3 miles of each block group. Many facilities do not report capacity, so real totals are higher.",
  },

  impact: {
    title: "Impact Score",
    subtitle: "Composite community pressure",
    fillColor: [
      "match",
      ["coalesce", ["get", "impact_level"], ""],
      "Lower",
      "#c6dbef",
      "Moderate",
      "#fdd835",
      "High",
      "#fb8c00",
      "Very High",
      "#c62828",
      "#e2e8f0",
    ],
    legendTitle: "Impact level (proxy)",
    legend: [
      { color: "#c6dbef", label: "Lower (score < 25)" },
      { color: "#fdd835", label: "Moderate (25 – 50)" },
      { color: "#fb8c00", label: "High (50 – 75)" },
      { color: "#c62828", label: "Very High (75+)" },
    ],
    note: "Proxy metric: classified from the development pressure score, not a validated composite impact model. See Data & Methodology.",
  },
};

export function communityFillLayer(
  mode: Exclude<AnalysisMode, "none">
): LayerProps {
  return {
    id: COMMUNITY_FILL_ID,
    type: "fill",
    paint: {
      // Cast: the expression trees above are typed loosely so
      // MODE_CONFIG stays readable.
      "fill-color": MODE_CONFIG[mode]
        .fillColor as never,
      "fill-opacity": 0.48,
    },
  };
}

export const communityOutlineLayer: LayerProps = {
  id: COMMUNITY_OUTLINE_ID,
  type: "line",
  paint: {
    "line-color": "#ffffff",
    "line-width": 0.5,
    "line-opacity": 0.35,
  },
};

// Invisible fill that keeps block groups queryable (for the
// search lookup) even when no analysis mode is active.
export const communityQueryLayer: LayerProps = {
  id: COMMUNITY_QUERY_ID,
  type: "fill",
  paint: {
    "fill-color": "#000000",
    "fill-opacity": 0,
  },
};

export function communitySelectLayer(
  geoid: string | null
): LayerProps {
  return {
    id: COMMUNITY_SELECT_ID,
    type: "line",
    filter: [
      "==",
      ["get", "GEOID"],
      geoid ?? "__none__",
    ],
    paint: {
      "line-color": "#0f172a",
      "line-width": 2.5,
      "line-opacity": 0.9,
    },
  };
}

// ------------------------------------------------------------
// Facility layers (clustered).
// ------------------------------------------------------------

export const facilityClusterLayer: LayerProps = {
  id: FACILITY_CLUSTER_ID,
  type: "circle",
  filter: ["has", "point_count"],
  paint: {
    // Color scales with the share of proposed facilities in
    // the cluster: mostly-existing = orange, mostly-proposed
    // = red.
    "circle-color": [
      "interpolate",
      ["linear"],
      [
        "/",
        ["get", "proposed_count"],
        ["get", "point_count"],
      ],
      0,
      "#f97316",
      1,
      "#dc2626",
    ],
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["get", "point_count"],
      2,
      14,
      25,
      22,
      100,
      30,
    ],
    "circle-stroke-width": 2,
    "circle-stroke-color": "#ffffff",
    "circle-opacity": 0.9,
  },
};

export const facilityCountLayer: LayerProps = {
  id: FACILITY_COUNT_ID,
  type: "symbol",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["get", "point_count_abbreviated"],
    "text-size": 12,
    "text-font": ["Noto Sans Regular"],
  },
  paint: {
    "text-color": "#ffffff",
  },
};

export const facilityPointLayer: LayerProps = {
  id: FACILITY_POINT_ID,
  type: "circle",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": [
      "match",
      ["get", "status"],
      "Proposed",
      "#dc2626",
      "#f97316",
    ],
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      6,
      4,
      10,
      6.5,
      14,
      9,
    ],
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#ffffff",
  },
};

export function facilitySelectLayer(
  objectId: number | null
): LayerProps {
  return {
    id: FACILITY_SELECT_ID,
    type: "circle",
    filter: [
      "==",
      ["get", "objectId"],
      objectId ?? -1,
    ],
    paint: {
      "circle-color": "rgba(0,0,0,0)",
      "circle-radius": 12,
      "circle-stroke-width": 2.5,
      "circle-stroke-color": "#0f172a",
    },
  };
}
