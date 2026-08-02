/**
 * Route planning against Google Maps.
 *
 * COST NOTE: Directions, Roads and Elevation are called EXACTLY ONCE per leg,
 * at deploy time, and the result is stored in `legs.route_polyline`. The
 * simulator then interpolates along that stored polyline locally at whatever
 * tick rate it likes. Calling these per tick (as a naive implementation would)
 * would multiply quota usage by ~1000x for a demo that is mostly one street.
 */

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string;

export interface PlannedRoutePoint {
  lat: number;
  lng: number;
  alt: number;
}

/** Decode a Google encoded polyline into lat/lng pairs. */
export function decodePolyline(encoded: string): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0,
    lat = 0,
    lng = 0;

  while (index < encoded.length) {
    let b: number,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/**
 * Plan a walking route from start to end, snapped to walkable paths and
 * sampled for ground elevation.
 *
 * NOTE: Directions/Elevation REST endpoints do not send CORS headers, so in
 * production these calls belong in an Edge Function using a server-side key.
 * For local dev the Vite proxy in vite.config.ts forwards them.
 */
export async function planWalkingRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number }
): Promise<PlannedRoutePoint[]> {
  // Routes API (Compute Routes). Works with the Maps Demo Key; legacy
  // Directions does not. POST + field mask; proxied to avoid CORS in dev.
  const res = await fetch(`/routes-api/directions/v2:computeRoutes?key=${MAPS_KEY}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": MAPS_KEY,
      "X-Goog-FieldMask": "routes.polyline.encodedPolyline,routes.distanceMeters",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: start.lat, longitude: start.lng } } },
      destination: { location: { latLng: { latitude: end.lat, longitude: end.lng } } },
      travelMode: "WALK",
      polylineEncoding: "ENCODED_POLYLINE",
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.routes?.length) {
    const msg = json?.error?.message ?? json?.status ?? `HTTP ${res.status}`;
    throw new Error(`Routes API: ${msg}`);
  }

  const encoded = json.routes[0].polyline.encodedPolyline as string;
  const flat = decodePolyline(encoded);

  // Elevation is best-effort; the Demo Key may not include it, in which case
  // fetchElevations falls back to 0 (a flat route still demos fine).
  const sampled = downsample(flat, 300);
  const elevations = await fetchElevations(sampled);

  return sampled.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    alt: elevations[i] ?? 0,
  }));
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const stride = Math.ceil(arr.length / max);
  const out = arr.filter((_, i) => i % stride === 0);
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1]);
  return out;
}

async function fetchElevations(
  points: Array<{ lat: number; lng: number }>
): Promise<number[]> {
  const locations = points.map((p) => `${p.lat},${p.lng}`).join("|");
  const url = `/maps-api/maps/api/elevation/json?locations=${encodeURIComponent(locations)}&key=${MAPS_KEY}`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== "OK") {
      console.warn("[maps] elevation lookup failed, falling back to 0", json.status);
      return points.map(() => 0);
    }
    return json.results.map((r: any) => r.elevation as number);
  } catch (err) {
    // Elevation is a nice-to-have; a flat route still demos fine.
    console.warn("[maps] elevation lookup errored, falling back to 0", err);
    return points.map(() => 0);
  }
}

/**
 * A local straight-line "route" between two points. Fallback for when the
 * Google Directions API is unavailable (e.g. the legacy API is not enabled on
 * the project). Produces a deployable polyline so the demo is not blocked on
 * GCP setup; the simulator walks it the same way. Not street-snapped.
 */
export function straightLineRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  steps = 60
): PlannedRoutePoint[] {
  const pts: PlannedRoutePoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      lat: start.lat + (end.lat - start.lat) * t,
      lng: start.lng + (end.lng - start.lng) * t,
      alt: 0,
    });
  }
  return pts;
}
