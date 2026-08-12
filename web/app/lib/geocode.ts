// Geocoding via Photon (photon.komoot.io), an OpenStreetMap-
// based geocoder that permits search-as-you-type usage and
// needs no API key. Results are biased toward Virginia and
// filtered to it where the responses carry a state.

export type GeocodeResult = {
  id: string;
  label: string;
  detail: string;
  lng: number;
  lat: number;
  /** OSM feature kind, e.g. "house", "city", "postcode". */
  kind: string;
};

const PHOTON_URL = "https://photon.komoot.io/api/";

// Rough Virginia bounding box, used both to bias the
// geocoder and to reject far-away matches.
const VA_BBOX = {
  minLng: -83.8,
  minLat: 36.4,
  maxLng: -74.9,
  maxLat: 39.6,
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    osm_type?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    type?: string;
  };
};

function buildLabel(p: PhotonFeature["properties"]): {
  label: string;
  detail: string;
} {
  const street = [p.housenumber, p.street]
    .filter(Boolean)
    .join(" ");

  const label = p.name || street || p.postcode || "Unnamed";

  const detail = [
    p.name && street ? street : null,
    p.city,
    p.county,
    p.state,
    p.postcode,
  ]
    .filter(Boolean)
    .filter((part) => part !== label)
    .join(", ");

  return { label, detail };
}

export async function geocode(
  query: string,
  signal?: AbortSignal
): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "8",
    lat: "37.6",
    lon: "-78.5",
    bbox: `${VA_BBOX.minLng},${VA_BBOX.minLat},${VA_BBOX.maxLng},${VA_BBOX.maxLat}`,
  });

  const response = await fetch(
    `${PHOTON_URL}?${params.toString()}`,
    { signal }
  );

  if (!response.ok) {
    throw new Error(`Geocoding failed (HTTP ${response.status})`);
  }

  const data = (await response.json()) as {
    features?: PhotonFeature[];
  };

  const results: GeocodeResult[] = [];

  for (const feature of data.features ?? []) {
    const [lng, lat] = feature.geometry.coordinates;
    const p = feature.properties;

    if (
      lng < VA_BBOX.minLng ||
      lng > VA_BBOX.maxLng ||
      lat < VA_BBOX.minLat ||
      lat > VA_BBOX.maxLat
    ) {
      continue;
    }

    if (p.state && !/virginia/i.test(p.state)) {
      continue;
    }

    const { label, detail } = buildLabel(p);

    results.push({
      id: `${p.osm_type ?? "f"}-${p.osm_id ?? results.length}`,
      label,
      detail,
      lng,
      lat,
      kind: p.type ?? "place",
    });
  }

  return results.slice(0, 6);
}

/** Zoom level appropriate for a result's granularity. */
export function zoomForKind(kind: string): number {
  switch (kind) {
    case "house":
    case "street":
      return 14;
    case "district":
    case "locality":
    case "postcode":
      return 12;
    case "city":
    case "town":
    case "village":
      return 11.5;
    case "county":
      return 10;
    default:
      return 12;
  }
}
