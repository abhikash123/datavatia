import type {
  DataCenter,
  NearbyFacility,
} from "./types";

const EARTH_RADIUS_MILES = 3958.8;

export function haversineMiles(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_MILES *
    Math.asin(Math.min(1, Math.sqrt(a)))
  );
}

/** Facilities within `radiusMiles` of a point, nearest first. */
export function facilitiesNear(
  centers: DataCenter[],
  lng: number,
  lat: number,
  radiusMiles: number
): NearbyFacility[] {
  const out: NearbyFacility[] = [];

  for (const center of centers) {
    if (
      typeof center.Lat !== "number" ||
      typeof center.Long !== "number"
    ) {
      continue;
    }

    const distanceMiles = haversineMiles(
      lng,
      lat,
      center.Long,
      center.Lat
    );

    if (distanceMiles <= radiusMiles) {
      out.push({ center, distanceMiles });
    }
  }

  out.sort(
    (a, b) => a.distanceMiles - b.distanceMiles
  );

  return out;
}

/** [[minLng, minLat], [maxLng, maxLat]] of facility points. */
export function boundsOfCenters(
  centers: DataCenter[]
):
  | [[number, number], [number, number]]
  | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const center of centers) {
    if (
      typeof center.Lat !== "number" ||
      typeof center.Long !== "number"
    ) {
      continue;
    }

    minLng = Math.min(minLng, center.Long);
    minLat = Math.min(minLat, center.Lat);
    maxLng = Math.max(maxLng, center.Long);
    maxLat = Math.max(maxLat, center.Lat);
  }

  if (!Number.isFinite(minLng)) {
    return null;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
