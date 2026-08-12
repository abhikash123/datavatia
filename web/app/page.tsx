"use client";

import { useEffect, useMemo, useState } from "react";
import Map, {
  NavigationControl,
  Popup,
  Marker,
  Source,
  Layer,
} from "react-map-gl/maplibre";

import "maplibre-gl/dist/maplibre-gl.css";

type DataCenter = {
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

type AnalysisMode =
  | "none"
  | "community"
  | "development"
  | "power"
  | "impact";

const MAP_STYLE = {
  version: 8,

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

const communityFillLayer = {
  id: "community-population-fill",
  type: "fill" as const,

  paint: {
    "fill-color": [
      "interpolate",
      ["linear"],
      ["get", "population"],

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

    "fill-opacity": 0.48,
  },
};

const communityOutlineLayer = {
  id: "community-population-outline",
  type: "line" as const,

  paint: {
    "line-color": "#ffffff",
    "line-width": 0.5,
    "line-opacity": 0.35,
  },
};

export default function Home() {
  const [dataCenters, setDataCenters] =
    useState<DataCenter[]>([]);

  const [selected, setSelected] =
    useState<DataCenter | null>(null);

  const [showProposed, setShowProposed] =
    useState(true);

  const [showExisting, setShowExisting] =
    useState(true);

  const [analysisMode, setAnalysisMode] =
    useState<AnalysisMode>("none");

  const [communityData, setCommunityData] =
    useState<any | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [communityLoading, setCommunityLoading] =
    useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(
          "/data/data_centers.json"
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        const data = await response.json();

        setDataCenters(data);
      } catch (error) {
        console.error(
          "Failed to load data:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  async function loadCommunityData() {
    if (communityData) {
      return;
    }

    setCommunityLoading(true);

    try {
      const response = await fetch(
        "/data/community/virginia_community_profiles.geojson"
      );

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}`
        );
      }

      const data = await response.json();

      setCommunityData(data);
    } catch (error) {
      console.error(
        "Failed to load community data:",
        error
      );
    } finally {
      setCommunityLoading(false);
    }
  }

  async function selectAnalysis(
    mode: AnalysisMode
  ) {
    if (mode === "community") {
      await loadCommunityData();
    }

    setAnalysisMode(mode);
  }

  const visibleCenters = useMemo(() => {
    return dataCenters.filter((center) => {
      if (
        typeof center.Lat !== "number" ||
        typeof center.Long !== "number"
      ) {
        return false;
      }

      if (
        center.Build_Status === "Proposed" &&
        !showProposed
      ) {
        return false;
      }

      if (
        center.Build_Status === "Existing" &&
        !showExisting
      ) {
        return false;
      }

      return true;
    });
  }, [
    dataCenters,
    showProposed,
    showExisting,
  ]);

  const proposedCount =
    dataCenters.filter(
      (d) => d.Build_Status === "Proposed"
    ).length;

  const existingCount =
    dataCenters.filter(
      (d) => d.Build_Status === "Existing"
    ).length;

  const totalMW = dataCenters.reduce(
    (sum, center) =>
      sum +
      (typeof center.MW_reported === "number"
        ? center.MW_reported
        : 0),
    0
  );

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#d8ddd8] text-slate-900">

      {/* ================================================== */}
      {/* MAP */}
      {/* ================================================== */}

      <div className="absolute inset-0">

        <Map
          initialViewState={{
            longitude: -78.5,
            latitude: 37.6,
            zoom: 7,
          }}

          mapStyle={MAP_STYLE}

          style={{
            width: "100%",
            height: "100%",
          }}

          attributionControl={true}
        >

          <NavigationControl
            position="bottom-right"
            showZoom={true}
            showCompass={true}
          />

          {/* ================================================== */}
          {/* COMMUNITY EXPOSURE LAYER */}
          {/* ================================================== */}

          {analysisMode === "community" &&
            communityData && (

              <Source
                id="community-source"
                type="geojson"
                data={communityData}
              >

                <Layer
                  {...communityFillLayer}
                />

                <Layer
                  {...communityOutlineLayer}
                />

              </Source>
            )}

          {/* ================================================== */}
          {/* DATA CENTER MARKERS */}
          {/* ================================================== */}

          {visibleCenters.map((center) => {
            const proposed =
              center.Build_Status ===
              "Proposed";

            return (
              <Marker
                key={center.OBJECTID}
                longitude={center.Long!}
                latitude={center.Lat!}
                anchor="center"
              >

                <button
                  type="button"
                  aria-label={
                    center.Name ??
                    "Data center"
                  }

                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(center);
                  }}

                  className="group relative"
                >

                  <span
                    className={`absolute -inset-2 rounded-full blur-sm ${
                      proposed
                        ? "bg-red-500/30"
                        : "bg-orange-500/30"
                    }`}
                  />

                  <span
                    className={`absolute -inset-[3px] rounded-full border ${
                      proposed
                        ? "border-red-500"
                        : "border-orange-500"
                    }`}
                  />

                  <span
                    className={`relative block h-3 w-3 rounded-full border-2 border-white shadow-xl transition-transform group-hover:scale-150 ${
                      proposed
                        ? "bg-red-600"
                        : "bg-orange-500"
                    }`}
                  />

                </button>

              </Marker>
            );
          })}

          {/* ================================================== */}
          {/* POPUP */}
          {/* ================================================== */}

          {selected &&
            typeof selected.Long ===
              "number" &&
            typeof selected.Lat ===
              "number" && (

              <Popup
                longitude={selected.Long}
                latitude={selected.Lat}
                anchor="bottom"
                closeButton={true}
                closeOnClick={false}
                onClose={() =>
                  setSelected(null)
                }
                maxWidth="360px"
              >

                <div className="w-[300px] p-2 text-slate-900">

                  <div
                    className={`mb-2 text-[10px] font-bold uppercase tracking-[0.2em] ${
                      selected.Build_Status ===
                      "Proposed"
                        ? "text-red-600"
                        : "text-orange-600"
                    }`}
                  >
                    {selected.Build_Status}
                  </div>

                  <h2 className="mb-4 text-lg font-bold leading-tight">
                    {selected.Name ??
                      "Unnamed Facility"}
                  </h2>

                  <div className="space-y-3 text-sm">

                    <div>
                      <div className="text-xs text-slate-500">
                        Locality
                      </div>

                      <div className="font-semibold">
                        {selected.Locality ??
                          "Unknown"}
                      </div>
                    </div>

                    {selected.Owner_Applicant && (
                      <div>
                        <div className="text-xs text-slate-500">
                          Developer / Applicant
                        </div>

                        <div className="font-semibold">
                          {
                            selected.Owner_Applicant
                          }
                        </div>
                      </div>
                    )}

                    {selected.Street_Address && (
                      <div>
                        <div className="text-xs text-slate-500">
                          Address
                        </div>

                        <div className="font-semibold">
                          {
                            selected.Street_Address
                          }
                        </div>
                      </div>
                    )}

                    {selected.MW_reported !==
                      null && (
                      <div>
                        <div className="text-xs text-slate-500">
                          Reported Power
                        </div>

                        <div className="font-semibold">
                          {selected.MW_reported.toLocaleString()}{" "}
                          MW
                        </div>
                      </div>
                    )}

                    {selected.Building_Sq_Ft !==
                      null && (
                      <div>
                        <div className="text-xs text-slate-500">
                          Building Area
                        </div>

                        <div className="font-semibold">
                          {Number(
                            selected.Building_Sq_Ft
                          ).toLocaleString()}{" "}
                          sq ft
                        </div>
                      </div>
                    )}

                    {selected.Construction_Type && (
                      <div>
                        <div className="text-xs text-slate-500">
                          Construction
                        </div>

                        <div className="font-semibold">
                          {
                            selected.Construction_Type
                          }
                        </div>
                      </div>
                    )}

                  </div>

                </div>

              </Popup>
            )}

        </Map>

      </div>

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <header className="pointer-events-none absolute left-0 right-0 top-0 z-30">

        <div className="flex items-center justify-between border-b border-slate-300/60 bg-white/92 px-7 py-4 shadow-md backdrop-blur">

          <div>

            <h1 className="text-xl font-black tracking-tight text-slate-900">
              DATAVATIA
            </h1>

            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-500">
              Mapping the hidden cost of data infrastructure
            </p>

          </div>

          <div className="pointer-events-auto flex items-center gap-8">

            <div>
              <div className="text-[9px] font-bold tracking-widest text-slate-500">
                FACILITIES
              </div>

              <div className="text-sm font-bold">
                {dataCenters.length}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-bold tracking-widest text-slate-500">
                PROPOSED
              </div>

              <div className="text-sm font-bold text-red-600">
                {proposedCount}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-bold tracking-widest text-slate-500">
                EXISTING
              </div>

              <div className="text-sm font-bold text-orange-600">
                {existingCount}
              </div>
            </div>

            <div>
              <div className="text-[9px] font-bold tracking-widest text-slate-500">
                REPORTED POWER
              </div>

              <div className="text-sm font-bold">
                {totalMW.toLocaleString()} MW
              </div>
            </div>

          </div>

        </div>

      </header>

      {/* ================================================== */}
      {/* LEFT PANEL */}
      {/* ================================================== */}

      <aside className="absolute left-5 top-24 z-30 w-64 rounded-2xl border border-slate-300/80 bg-white/95 p-5 shadow-2xl backdrop-blur">

        <div className="mb-5">

          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            VIRGINIA
          </div>

          <h2 className="mt-1 text-lg font-bold">
            Infrastructure
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Explore data center development
            across Virginia.
          </p>

        </div>

        {/* PROPOSED */}

        <button
          type="button"
          onClick={() =>
            setShowProposed(
              !showProposed
            )
          }

          className="mb-2 flex w-full items-center justify-between rounded-xl px-3 py-3 hover:bg-slate-100"
        >

          <div className="flex items-center gap-3">

            <span
              className={`h-3 w-3 rounded-full ${
                showProposed
                  ? "bg-red-600"
                  : "bg-slate-300"
              }`}
            />

            <span className="text-sm font-semibold">
              Proposed
            </span>

          </div>

          <span className="text-[10px] font-bold text-slate-400">
            {showProposed
              ? "ON"
              : "OFF"}
          </span>

        </button>

        {/* EXISTING */}

        <button
          type="button"
          onClick={() =>
            setShowExisting(
              !showExisting
            )
          }

          className="flex w-full items-center justify-between rounded-xl px-3 py-3 hover:bg-slate-100"
        >

          <div className="flex items-center gap-3">

            <span
              className={`h-3 w-3 rounded-full ${
                showExisting
                  ? "bg-orange-500"
                  : "bg-slate-300"
              }`}
            />

            <span className="text-sm font-semibold">
              Existing
            </span>

          </div>

          <span className="text-[10px] font-bold text-slate-400">
            {showExisting
              ? "ON"
              : "OFF"}
          </span>

        </button>

        {/* LEGEND */}

        <div className="mt-5 border-t border-slate-200 pt-4">

          <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
            Legend
          </div>

          <div className="space-y-2 text-xs text-slate-600">

            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
              Proposed
            </div>

            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
              Existing
            </div>

          </div>

        </div>

      </aside>

      {/* ================================================== */}
      {/* ANALYTICS PANEL */}
      {/* ================================================== */}

      <aside className="absolute right-5 top-24 z-30 w-72 rounded-2xl border border-slate-300/80 bg-white/95 shadow-2xl backdrop-blur">

        <div className="border-b border-slate-200 px-5 py-4">

          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            DATAVATIA ANALYTICS
          </div>

          <h2 className="mt-1 text-lg font-bold">
            Analyze Virginia
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Turn infrastructure data into
            measurable community impacts.
          </p>

        </div>

        <div className="space-y-1 p-3">

          {/* COMMUNITY */}

          <button
            type="button"
            onClick={() =>
              selectAnalysis("community")
            }

            className={`w-full rounded-xl px-4 py-3 text-left transition ${
              analysisMode === "community"
                ? "bg-green-700 text-white"
                : "hover:bg-slate-100"
            }`}
          >

            <div className="text-sm font-bold">
              Community Exposure
            </div>

            <div
              className={`mt-1 text-[11px] ${
                analysisMode === "community"
                  ? "text-green-100"
                  : "text-slate-500"
              }`}
            >
              Population surrounding facilities
            </div>

          </button>

          {/* DEVELOPMENT */}

          <button
            type="button"
            onClick={() =>
              selectAnalysis("development")
            }

            className={`w-full rounded-xl px-4 py-3 text-left transition ${
              analysisMode === "development"
                ? "bg-slate-900 text-white"
                : "hover:bg-slate-100"
            }`}
          >

            <div className="text-sm font-bold">
              Development Pressure
            </div>

            <div className="mt-1 text-[11px] text-slate-500">
              Facility density and proposals
            </div>

          </button>

          {/* POWER */}

          <button
            type="button"
            onClick={() =>
              selectAnalysis("power")
            }

            className={`w-full rounded-xl px-4 py-3 text-left transition ${
              analysisMode === "power"
                ? "bg-slate-900 text-white"
                : "hover:bg-slate-100"
            }`}
          >

            <div className="text-sm font-bold">
              Power Infrastructure
            </div>

            <div className="mt-1 text-[11px] text-slate-500">
              Reported electrical capacity
            </div>

          </button>

          {/* IMPACT */}

          <button
            type="button"
            onClick={() =>
              selectAnalysis("impact")
            }

            className={`w-full rounded-xl px-4 py-3 text-left transition ${
              analysisMode === "impact"
                ? "bg-slate-900 text-white"
                : "hover:bg-slate-100"
            }`}
          >

            <div className="text-sm font-bold">
              Impact Score
            </div>

            <div className="mt-1 text-[11px] text-slate-500">
              Composite community pressure
            </div>

          </button>

          {/* CLEAR */}

          <button
            type="button"
            onClick={() =>
              setAnalysisMode("none")
            }

            className="w-full rounded-xl px-4 py-2 text-center text-[11px] font-bold text-slate-400 hover:bg-slate-100"
          >
            Clear analysis
          </button>

        </div>

        {/* COMMUNITY LEGEND */}

        {analysisMode === "community" &&
          communityData && (

          <div className="border-t border-slate-200 px-5 py-4">

            <div className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Population density
            </div>

            <div className="space-y-2 text-xs">

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-[#e8f5e9]" />
                <span>Low</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-[#81c784]" />
                <span>Moderate</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-[#ff9800]" />
                <span>High</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-[#b71c1c]" />
                <span>Very high</span>
              </div>

            </div>

            <p className="mt-4 text-[11px] leading-5 text-slate-500">
              Census block groups are shaded
              according to population. Darker
              areas represent larger populations.
            </p>

          </div>
        )}

        {communityLoading && (

          <div className="border-t border-slate-200 px-5 py-4 text-center text-xs text-slate-500">
            Loading community data...
          </div>

        )}

      </aside>

      {/* ================================================== */}
      {/* LOADING */}
      {/* ================================================== */}

      {loading && (

        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#d8ddd8]">

          <div className="rounded-2xl bg-white p-8 text-center shadow-xl">

            <div className="mb-3 text-sm font-semibold text-slate-700">
              Loading Virginia infrastructure...
            </div>

            <div className="mx-auto h-1 w-32 overflow-hidden rounded-full bg-slate-200">

              <div className="h-full w-1/2 animate-pulse rounded-full bg-red-600" />

            </div>

          </div>

        </div>
      )}

    </main>
  );
}