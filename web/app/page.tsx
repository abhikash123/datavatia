"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import MapGL, {
  NavigationControl,
  ScaleControl,
  Marker,
  Source,
  Layer,
} from "react-map-gl/maplibre";
import type {
  MapRef,
  MapLayerMouseEvent,
} from "react-map-gl/maplibre";
import type { GeoJSONSource } from "maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import type {
  AnalysisMode,
  CommunityProps,
  CommunityStatus,
  DataCenter,
  FacilityFilters,
  ImpactRecord,
  LocalityStat,
  Selection,
  VaStats,
} from "./lib/types";
import {
  COMMUNITY_DATA_URL,
  COMMUNITY_FILL_ID,
  COMMUNITY_QUERY_ID,
  COMMUNITY_SOURCE_ID,
  FACILITY_CLUSTER_ID,
  FACILITY_POINT_ID,
  FACILITY_SOURCE_ID,
  RADIUS_SOURCE_ID,
  INITIAL_VIEW,
  MAP_STYLE,
  communityFillLayer,
  communityOutlineLayer,
  communityQueryLayer,
  communitySelectLayer,
  facilityClusterLayer,
  facilityCountLayer,
  facilityPointLayer,
  facilitySelectLayer,
  radiusFillLayer,
  radiusLineLayer,
} from "./lib/mapConfig";
import {
  facilitiesNear,
  boundsOfCenters,
  circlePolygonMiles,
} from "./lib/geo";
import { withBase } from "./lib/basePath";
import {
  zoomForKind,
  type GeocodeResult,
} from "./lib/geocode";

import SearchBar from "./components/SearchBar";
import LocalityRankings from "./components/LocalityRankings";
import CivicActionPanel from "./components/CivicActionPanel";
import FacilityPopup from "./components/FacilityPopup";
import ContextPanel from "./components/ContextPanel";
import AnalyticsPanel from "./components/AnalyticsPanel";
import InfrastructurePanel from "./components/InfrastructurePanel";
import StatsHeader from "./components/StatsHeader";
import MethodologyOverlay from "./components/MethodologyOverlay";

// MapLibre normally finds its worker script relative to its own
// module URL, which stops working once the library is bundled —
// the worker silently never starts and GeoJSON sources hang
// forever. Point it at the copy served from public/ instead
// (kept in sync by scripts/sync-maplibre-worker.js).
setWorkerUrl(withBase("/maplibre/maplibre-gl-worker.mjs"));

const DEFAULT_FILTERS: FacilityFilters = {
  showProposed: true,
  showExisting: true,
  locality: null,
  query: "",
  minMW: null,
};

export default function Home() {
  const mapRef = useRef<MapRef | null>(null);

  const [dataCenters, setDataCenters] = useState<
    DataCenter[]
  >([]);

  const [impactById, setImpactById] = useState<Map<
    number,
    ImpactRecord
  > | null>(null);

  const [stats, setStats] =
    useState<VaStats | null>(null);

  const [localityStats, setLocalityStats] =
    useState<LocalityStat[]>([]);

  const [showRadius, setShowRadius] =
    useState(false);

  const [loading, setLoading] = useState(true);

  const [analysisMode, setAnalysisMode] =
    useState<AnalysisMode>("none");

  const [communityStatus, setCommunityStatus] =
    useState<CommunityStatus>("idle");

  const [communityAttempt, setCommunityAttempt] =
    useState(0);

  const [filters, setFilters] =
    useState<FacilityFilters>(DEFAULT_FILTERS);

  const [selection, setSelection] =
    useState<Selection | null>(null);

  const [searchMarker, setSearchMarker] =
    useState<GeocodeResult | null>(null);

  const [methodologyOpen, setMethodologyOpen] =
    useState(false);

  const [mobilePanel, setMobilePanel] = useState<
    "none" | "filters" | "analyze"
  >("none");

  const [cursor, setCursor] = useState<
    string | undefined
  >(undefined);

  // ----------------------------------------------------------
  // Data loading
  // ----------------------------------------------------------

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch(
          withBase("/data/data_centers.json")
        );

        if (!response.ok) {
          throw new Error(
            `HTTP ${response.status}`
          );
        }

        setDataCenters(await response.json());
      } catch (error) {
        console.error(
          "Failed to load data:",
          error
        );
      } finally {
        setLoading(false);
      }
    }

    async function loadImpact() {
      try {
        const response = await fetch(
          withBase("/data/impact_scores.json")
        );

        if (!response.ok) return;

        const records =
          (await response.json()) as ImpactRecord[];

        setImpactById(
          new Map(
            records.map((r) => [r.OBJECTID, r])
          )
        );
      } catch (error) {
        console.error(
          "Failed to load impact scores:",
          error
        );
      }
    }

    async function loadStats() {
      try {
        const response = await fetch(
          withBase("/data/community/virginia_stats.json")
        );

        if (!response.ok) return;

        setStats(await response.json());
      } catch {
        // Header simply omits the extra stats.
      }
    }

    async function loadLocalities() {
      try {
        const response = await fetch(
          withBase("/data/community/locality_stats.json")
        );

        if (!response.ok) return;

        setLocalityStats(await response.json());
      } catch {
        // Rankings panel simply stays empty.
      }
    }

    loadData();
    loadImpact();
    loadStats();
    loadLocalities();
  }, []);

  // ----------------------------------------------------------
  // Community (choropleth) source state machine
  // ----------------------------------------------------------

  const ensureCommunityData = useCallback(() => {
    setCommunityStatus((status) => {
      if (
        status === "idle" ||
        status === "error"
      ) {
        // Remounts the source so a failed load is retried.
        setCommunityAttempt(
          (attempt) => attempt + 1
        );
        return "loading";
      }
      return status;
    });
  }, []);

  function selectAnalysis(mode: AnalysisMode) {
    if (mode !== "none") {
      ensureCommunityData();
    }

    setAnalysisMode(mode);
    setMobilePanel("none");
  }

  // ----------------------------------------------------------
  // Facility filtering
  // ----------------------------------------------------------

  const visibleCenters = useMemo(() => {
    const query = filters.query
      .trim()
      .toLowerCase();

    return dataCenters.filter((center) => {
      if (
        typeof center.Lat !== "number" ||
        typeof center.Long !== "number"
      ) {
        return false;
      }

      if (
        center.Build_Status === "Proposed" &&
        !filters.showProposed
      ) {
        return false;
      }

      if (
        center.Build_Status === "Existing" &&
        !filters.showExisting
      ) {
        return false;
      }

      if (
        filters.locality &&
        center.Locality !== filters.locality
      ) {
        return false;
      }

      if (
        filters.minMW !== null &&
        (center.MW_reported ?? 0) <
          filters.minMW
      ) {
        return false;
      }

      if (query) {
        const haystack = `${center.Name ?? ""} ${
          center.Owner_Applicant ?? ""
        }`.toLowerCase();

        if (!haystack.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [dataCenters, filters]);

  const localities = useMemo(() => {
    const counts = new Map<string, number>();

    for (const center of dataCenters) {
      if (!center.Locality) continue;
      counts.set(
        center.Locality,
        (counts.get(center.Locality) ?? 0) + 1
      );
    }

    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) =>
        a.name.localeCompare(b.name)
      );
  }, [dataCenters]);

  function handleFiltersChange(
    next: FacilityFilters
  ) {
    if (
      next.locality &&
      next.locality !== filters.locality
    ) {
      const bounds = boundsOfCenters(
        dataCenters.filter(
          (c) => c.Locality === next.locality
        )
      );

      if (bounds) {
        mapRef.current?.fitBounds(bounds, {
          padding: 90,
          maxZoom: 11.5,
          duration: 900,
        });
      }
    }

    setFilters(next);
  }

  const facilityGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: visibleCenters.map((center) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [
            center.Long as number,
            center.Lat as number,
          ],
        },
        properties: {
          objectId: center.OBJECTID,
          status:
            center.Build_Status ?? "Unknown",
        },
      })),
    }),
    [visibleCenters]
  );

  // ----------------------------------------------------------
  // Map interactions
  // ----------------------------------------------------------

  const selectedFacility =
    selection?.kind === "facility"
      ? selection.center
      : null;

  // Geodesic 3-mile circle around the selected facility;
  // follows the selection while the toggle stays on.
  const radiusCircle = useMemo(() => {
    if (
      !showRadius ||
      !selectedFacility ||
      typeof selectedFacility.Long !==
        "number" ||
      typeof selectedFacility.Lat !== "number"
    ) {
      return null;
    }

    return circlePolygonMiles(
      selectedFacility.Long,
      selectedFacility.Lat,
      3
    );
  }, [showRadius, selectedFacility]);

  const selectedGeoid =
    selection?.kind === "community"
      ? selection.props.GEOID
      : null;

  const interactiveLayerIds = useMemo(() => {
    const ids = [
      FACILITY_CLUSTER_ID,
      FACILITY_POINT_ID,
    ];

    if (analysisMode !== "none") {
      ids.push(COMMUNITY_FILL_ID);
    }

    return ids;
  }, [analysisMode]);

  const handleMapClick = useCallback(
    (event: MapLayerMouseEvent) => {
      const features = event.features ?? [];
      const map = mapRef.current?.getMap();

      const cluster = features.find(
        (f) =>
          f.layer?.id === FACILITY_CLUSTER_ID
      );

      if (cluster && map) {
        const clusterId =
          cluster.properties?.cluster_id;
        const source = map.getSource(
          FACILITY_SOURCE_ID
        ) as GeoJSONSource | undefined;

        if (
          source &&
          typeof clusterId === "number" &&
          "getClusterExpansionZoom" in source
        ) {
          Promise.resolve(
            source.getClusterExpansionZoom(
              clusterId
            )
          )
            .then((zoom) => {
              const [lng, lat] = (
                cluster.geometry as unknown as {
                  coordinates: [number, number];
                }
              ).coordinates;

              map.easeTo({
                center: [lng, lat],
                zoom: zoom + 0.4,
                duration: 500,
              });
            })
            .catch(() => {});
        }

        return;
      }

      const point = features.find(
        (f) => f.layer?.id === FACILITY_POINT_ID
      );

      if (point) {
        const objectId =
          point.properties?.objectId;

        const center = dataCenters.find(
          (c) => c.OBJECTID === objectId
        );

        if (center) {
          setSelection({
            kind: "facility",
            center,
          });

          // Nudge the facility toward the lower half of the
          // viewport so the popup clears the header.
          if (
            map &&
            typeof center.Long === "number" &&
            typeof center.Lat === "number"
          ) {
            map.easeTo({
              center: [center.Long, center.Lat],
              offset: [0, 150],
              duration: 450,
            });
          }
        }

        return;
      }

      const community = features.find(
        (f) => f.layer?.id === COMMUNITY_FILL_ID
      );

      if (community) {
        setSelection({
          kind: "community",
          props:
            community.properties as CommunityProps,
        });
      }
    },
    [dataCenters]
  );

  const handleMouseMove = useCallback(
    (event: MapLayerMouseEvent) => {
      const next = event.features?.length
        ? "pointer"
        : undefined;

      setCursor((prev) =>
        prev === next ? prev : next
      );
    },
    []
  );

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------

  const runLocationLookup = useCallback(
    (result: GeocodeResult) => {
      const map = mapRef.current?.getMap();

      let community: CommunityProps | null =
        null;

      if (map) {
        try {
          const point = map.project([
            result.lng,
            result.lat,
          ]);

          const found =
            map.queryRenderedFeatures(point, {
              layers: [COMMUNITY_QUERY_ID],
            });

          if (found.length) {
            community = found[0]
              .properties as CommunityProps;
          }
        } catch {
          // Query layer not mounted yet; leave null.
        }
      }

      const nearby = facilitiesNear(
        dataCenters,
        result.lng,
        result.lat,
        3
      );

      setSelection((prev) =>
        prev?.kind === "search"
          ? {
              ...prev,
              community,
              nearby,
              pending: false,
            }
          : prev
      );
    },
    [dataCenters]
  );

  const handleSearchSelect = useCallback(
    (result: GeocodeResult) => {
      ensureCommunityData();
      setSearchMarker(result);
      setSelection({
        kind: "search",
        label: result.detail
          ? `${result.label}, ${result.detail}`
          : result.label,
        lng: result.lng,
        lat: result.lat,
        community: null,
        nearby: [],
        pending: true,
      });

      const map = mapRef.current?.getMap();

      if (!map) return;

      map.flyTo({
        center: [result.lng, result.lat],
        zoom: Math.max(
          map.getZoom(),
          zoomForKind(result.kind)
        ),
        duration: 1600,
      });

      // The block-group lookup needs the community tiles for
      // the destination rendered; idle fires once movement and
      // source loading settle.
      map.once("idle", () =>
        runLocationLookup(result)
      );
    },
    [ensureCommunityData, runLocationLookup]
  );

  const handleSearchClear = useCallback(() => {
    setSearchMarker(null);
    setSelection((prev) =>
      prev?.kind === "search" ? null : prev
    );
  }, []);

  const toggleRadius = useCallback(() => {
    setShowRadius((shown) => {
      const next = !shown;

      // When enabling, fit the view so the whole 3-mile
      // circle is visible.
      if (
        next &&
        selection?.kind === "facility" &&
        typeof selection.center.Long ===
          "number" &&
        typeof selection.center.Lat === "number"
      ) {
        const ring = circlePolygonMiles(
          selection.center.Long,
          selection.center.Lat,
          3
        ).geometry.coordinates[0];

        const lngs = ring.map((p) => p[0]);
        const lats = ring.map((p) => p[1]);

        mapRef.current?.fitBounds(
          [
            [
              Math.min(...lngs),
              Math.min(...lats),
            ],
            [
              Math.max(...lngs),
              Math.max(...lats),
            ],
          ],
          { padding: 70, duration: 700 }
        );
      }

      return next;
    });
  }, [selection]);

  const handleLocalitySelect = useCallback(
    (locality: LocalityStat) => {
      if (locality.bounds) {
        mapRef.current?.fitBounds(
          [
            [
              locality.bounds[0],
              locality.bounds[1],
            ],
            [
              locality.bounds[2],
              locality.bounds[3],
            ],
          ],
          { padding: 60, duration: 900 }
        );
      }

      // Highlight the locality's facilities via the existing
      // filter (does not touch the analysis layer).
      setFilters((prev) => ({
        ...prev,
        locality: locality.name,
      }));
    },
    []
  );

  function resetView() {
    mapRef.current?.getMap().easeTo({
      center: [
        INITIAL_VIEW.longitude,
        INITIAL_VIEW.latitude,
      ],
      zoom: INITIAL_VIEW.zoom,
      duration: 900,
    });
  }

  // Community source stays mounted once requested so mode
  // switches and searches reuse the parsed data.
  const communityMounted =
    communityStatus !== "idle";

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#d8ddd8] text-slate-900">

      {/* ================================================== */}
      {/* MAP */}
      {/* ================================================== */}

      <div className="absolute inset-0">

        <MapGL
          ref={(instance) => {
            mapRef.current = instance;

            // Deliberate debugging handle; also used by the
            // browser test suite.
            if (typeof window !== "undefined") {
              (
                window as {
                  __datavatiaMap?: unknown;
                }
              ).__datavatiaMap =
                instance?.getMap();
            }
          }}
          initialViewState={INITIAL_VIEW}
          mapStyle={MAP_STYLE}
          style={{
            width: "100%",
            height: "100%",
          }}
          cursor={cursor}
          interactiveLayerIds={
            interactiveLayerIds
          }
          onClick={handleMapClick}
          onMouseMove={handleMouseMove}

          onSourceData={(event) => {
            // Removing a source also fires sourcedata with
            // isSourceLoaded true; only a still-registered
            // source may mark the data ready.
            if (
              event.sourceId ===
                COMMUNITY_SOURCE_ID &&
              event.isSourceLoaded &&
              event.target.getSource(
                COMMUNITY_SOURCE_ID
              )
            ) {
              setCommunityStatus("ready");
            }
          }}

          onError={(event) => {
            if (
              (event as { sourceId?: string })
                .sourceId ===
              COMMUNITY_SOURCE_ID
            ) {
              console.error(
                "Failed to load community data:",
                event.error
              );

              setCommunityStatus("error");
            } else {
              // Keep the library's default behavior of
              // surfacing unrelated map errors.
              console.error(event.error);
            }
          }}
        >

          <NavigationControl
            position="bottom-right"
            showZoom={true}
            showCompass={true}
          />

          <ScaleControl position="bottom-left" />

          {/* ================================================== */}
          {/* COMMUNITY ANALYSIS LAYERS */}
          {/* ================================================== */}

          {communityMounted && (
            <Source
              key={communityAttempt}
              id={COMMUNITY_SOURCE_ID}
              type="geojson"
              data={COMMUNITY_DATA_URL}
            >

              {/* Always queryable (for search lookups), never
                  visible. */}
              <Layer {...communityQueryLayer} />

              {analysisMode !== "none" && (
                <Layer
                  {...communityFillLayer(
                    analysisMode
                  )}
                />
              )}

              {analysisMode !== "none" && (
                <Layer
                  {...communityOutlineLayer}
                />
              )}

              {analysisMode !== "none" && (
                <Layer
                  {...communitySelectLayer(
                    selectedGeoid
                  )}
                />
              )}

            </Source>
          )}

          {/* ================================================== */}
          {/* FACILITY LAYERS (CLUSTERED) */}
          {/* ================================================== */}

          <Source
            id={FACILITY_SOURCE_ID}
            type="geojson"
            data={facilityGeoJSON}
            cluster={true}
            clusterMaxZoom={11}
            clusterRadius={42}
            clusterProperties={{
              proposed_count: [
                "+",
                [
                  "case",
                  [
                    "==",
                    ["get", "status"],
                    "Proposed",
                  ],
                  1,
                  0,
                ],
              ],
            }}
          >
            <Layer {...facilityClusterLayer} />
            <Layer {...facilityCountLayer} />
            <Layer {...facilityPointLayer} />
            <Layer
              {...facilitySelectLayer(
                selectedFacility?.OBJECTID ??
                  null
              )}
            />
          </Source>

          {/* ================================================== */}
          {/* 3-MILE FACILITY RADIUS */}
          {/* ================================================== */}

          {radiusCircle && (
            <Source
              id={RADIUS_SOURCE_ID}
              type="geojson"
              data={radiusCircle}
            >
              <Layer {...radiusFillLayer} />
              <Layer {...radiusLineLayer} />
            </Source>
          )}

          {/* ================================================== */}
          {/* SEARCH MARKER */}
          {/* ================================================== */}

          {searchMarker && (
            <Marker
              longitude={searchMarker.lng}
              latitude={searchMarker.lat}
              anchor="bottom"
            >
              <div
                aria-hidden="true"
                className="flex flex-col items-center"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 shadow-xl ring-2 ring-white">
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
                    />
                  </svg>
                </span>
                <span className="-mt-px h-2.5 w-0.5 bg-slate-900" />
              </div>
            </Marker>
          )}

          {/* ================================================== */}
          {/* FACILITY POPUP */}
          {/* ================================================== */}

          {selectedFacility && (
            <FacilityPopup
              center={selectedFacility}
              onClose={() => setSelection(null)}
            />
          )}

        </MapGL>

      </div>

      {/* ================================================== */}
      {/* HEADER */}
      {/* ================================================== */}

      <StatsHeader
        dataCenters={dataCenters}
        stats={stats}
        onOpenMethodology={() =>
          setMethodologyOpen(true)
        }
      />

      {/* ================================================== */}
      {/* SEARCH */}
      {/* ================================================== */}

      <div className="pointer-events-none absolute left-1/2 top-[4.4rem] z-30 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 sm:top-[5.9rem]">
        <SearchBar
          onSelect={handleSearchSelect}
          onClear={handleSearchClear}
        />
      </div>

      {/* ================================================== */}
      {/* LEFT PANEL (desktop) */}
      {/* ================================================== */}

      <div className="pointer-events-none absolute left-5 top-36 z-20 hidden max-h-[calc(100vh-10rem)] flex-col gap-3 overflow-y-auto md:flex">
        <InfrastructurePanel
          filters={filters}
          localities={localities}
          visibleCount={visibleCenters.length}
          totalCount={dataCenters.length}
          onChange={handleFiltersChange}
        />

        {localityStats.length > 0 && (
          <LocalityRankings
            localities={localityStats}
            onSelect={handleLocalitySelect}
          />
        )}
      </div>

      {/* ================================================== */}
      {/* RIGHT COLUMN (desktop) */}
      {/* ================================================== */}

      <div className="pointer-events-none absolute right-5 top-24 z-20 hidden max-h-[calc(100vh-7rem)] w-72 flex-col gap-3 overflow-y-auto md:flex">

        <AnalyticsPanel
          analysisMode={analysisMode}
          communityStatus={communityStatus}
          onSelect={selectAnalysis}
        />

        {selection && (
          <ContextPanel
            selection={selection}
            impact={
              selection.kind === "facility"
                ? (impactById?.get(
                    selection.center.OBJECTID
                  ) ?? null)
                : null
            }
            radiusShown={showRadius}
            onToggleRadius={
              selection.kind === "facility"
                ? toggleRadius
                : undefined
            }
            onDismiss={() => setSelection(null)}
          />
        )}

        {selection && (
          <CivicActionPanel
            selection={selection}
            impact={
              selection.kind === "facility"
                ? (impactById?.get(
                    selection.center.OBJECTID
                  ) ?? null)
                : null
            }
          />
        )}

      </div>

      {/* ================================================== */}
      {/* MOBILE PANELS */}
      {/* ================================================== */}

      <div className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 gap-2 md:hidden">

        <button
          type="button"
          onClick={() =>
            setMobilePanel((p) =>
              p === "filters"
                ? "none"
                : "filters"
            )
          }
          className="rounded-full border border-slate-300 bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          Filters
        </button>

        <button
          type="button"
          onClick={() =>
            setMobilePanel((p) =>
              p === "analyze"
                ? "none"
                : "analyze"
            )
          }
          className="rounded-full border border-slate-300 bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          Analyze
        </button>

        <button
          type="button"
          onClick={() => {
            setMethodologyOpen(true);
            setMobilePanel("none");
          }}
          className="rounded-full border border-slate-300 bg-white/95 px-4 py-2 text-xs font-bold text-slate-700 shadow-xl backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          About
        </button>

      </div>

      {mobilePanel !== "none" && (
        <div
          className="absolute inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setMobilePanel("none")}
        >
          <div
            className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-2xl bg-white/98 p-4 pb-20 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="mx-auto w-fit space-y-3">
              {mobilePanel === "filters" ? (
                <>
                  <InfrastructurePanel
                    filters={filters}
                    localities={localities}
                    visibleCount={
                      visibleCenters.length
                    }
                    totalCount={
                      dataCenters.length
                    }
                    onChange={
                      handleFiltersChange
                    }
                  />
                  {localityStats.length > 0 && (
                    <LocalityRankings
                      localities={localityStats}
                      onSelect={(locality) => {
                        handleLocalitySelect(
                          locality
                        );
                        setMobilePanel("none");
                      }}
                    />
                  )}
                </>
              ) : (
                <AnalyticsPanel
                  analysisMode={analysisMode}
                  communityStatus={
                    communityStatus
                  }
                  onSelect={selectAnalysis}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile context sheet */}
      {selection && (
        <div className="absolute inset-x-3 bottom-16 z-30 max-h-[75vh] overflow-y-auto md:hidden">
          <div className="mx-auto w-fit space-y-3">
            <ContextPanel
              selection={selection}
              impact={
                selection.kind === "facility"
                  ? (impactById?.get(
                      selection.center.OBJECTID
                    ) ?? null)
                  : null
              }
              radiusShown={showRadius}
              onToggleRadius={
                selection.kind === "facility"
                  ? toggleRadius
                  : undefined
              }
              onDismiss={() =>
                setSelection(null)
              }
            />

            <CivicActionPanel
              selection={selection}
              impact={
                selection.kind === "facility"
                  ? (impactById?.get(
                      selection.center.OBJECTID
                    ) ?? null)
                  : null
              }
            />
          </div>
        </div>
      )}

      {/* ================================================== */}
      {/* RESET VIEW */}
      {/* ================================================== */}

      <button
        type="button"
        aria-label="Reset map view to Virginia"
        onClick={resetView}
        className="absolute bottom-28 right-[9px] z-20 rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 shadow-md hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-500"
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 12a9 9 0 1018 0 9 9 0 00-18 0zm9-5v5l3 3"
          />
        </svg>
      </button>

      {/* ================================================== */}
      {/* METHODOLOGY */}
      {/* ================================================== */}

      {methodologyOpen && (
        <MethodologyOverlay
          onClose={() =>
            setMethodologyOpen(false)
          }
        />
      )}

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
