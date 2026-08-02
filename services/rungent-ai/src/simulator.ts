import { haversineMeters, WALK_KMH, RUN_KMH, type LatLng, type RungentMode } from "@rundown/shared";

/**
 * DETERMINISTIC MOVEMENT SIMULATOR
 *
 * This file — not the LLM — is what enforces fairness. The strategy layer
 * (Claude) can only return an *intent*; it can never write a position.
 *
 * KEY DESIGN DECISION (deviation from the original spec, flagged deliberately):
 * The spec described intent as {heading, mode} and then validating that the
 * result didn't teleport or leave route bounds. Validation-after-the-fact is
 * fragile — every new code path is a new chance to forget a check.
 *
 * Instead the Rungent's position is represented as a single scalar: distance
 * travelled along the committed route polyline (`progressM`). Latitude and
 * longitude are *derived* from that scalar. This makes the illegal states
 * unrepresentable rather than merely rejected:
 *   - It cannot leave the route, because off-route positions have no encoding.
 *   - It cannot teleport, because progress advances by at most vMax * dt.
 *   - It cannot fly, because altitude is interpolated from the sampled route.
 * Heading is derived from the polyline tangent, so it is always consistent
 * with actual motion.
 *
 * The LLM retains meaningful agency: choose mode (idle/walk/run) and choose
 * direction along the route (forward toward the end point, or double back to
 * evade a hunter). That is enough for interesting behaviour without ever
 * handing it the ability to cheat.
 */

export interface RoutePoint extends LatLng {
  /** Cumulative distance from the route start, in meters. */
  distM: number;
  alt: number;
}

/** A committed route: snapped to roads and elevation-sampled ONCE at plan time. */
export interface CommittedRoute {
  points: RoutePoint[];
  totalLengthM: number;
}

export interface RungentIntent {
  mode: RungentMode;
  /** +1 = advance toward the end point, -1 = double back. */
  direction: 1 | -1;
}

export interface SimState {
  progressM: number;
  mode: RungentMode;
  speedKmh: number;
  headingDeg: number;
  lat: number;
  lng: number;
  alt: number;
}

export const MODE_SPEED_KMH: Record<RungentMode, number> = {
  idle: 0,
  walk: WALK_KMH,
  run: RUN_KMH,
};

/** Build a committed route from a raw polyline, computing cumulative distances. */
export function buildRoute(raw: Array<LatLng & { alt?: number }>): CommittedRoute {
  if (raw.length < 2) {
    throw new Error("A route needs at least 2 points");
  }
  const points: RoutePoint[] = [];
  let cum = 0;
  for (let i = 0; i < raw.length; i++) {
    if (i > 0) cum += haversineMeters(raw[i - 1], raw[i]);
    points.push({
      lat: raw[i].lat,
      lng: raw[i].lng,
      alt: raw[i].alt ?? 0,
      distM: cum,
    });
  }
  return { points, totalLengthM: cum };
}

/** Interpolate a position + heading at a given distance along the route. */
export function sampleRoute(
  route: CommittedRoute,
  progressM: number
): { lat: number; lng: number; alt: number; headingDeg: number } {
  const clamped = Math.max(0, Math.min(progressM, route.totalLengthM));
  const pts = route.points;

  // find the segment containing `clamped`
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].distM < clamped) i++;
  const a = pts[i];
  const b = pts[i + 1];

  const segLen = b.distM - a.distM;
  const t = segLen === 0 ? 0 : (clamped - a.distM) / segLen;

  const lat = a.lat + (b.lat - a.lat) * t;
  const lng = a.lng + (b.lng - a.lng) * t;
  const alt = a.alt + (b.alt - a.alt) * t;

  // heading from the segment tangent
  const latRad = (a.lat * Math.PI) / 180;
  const east = (b.lng - a.lng) * Math.cos(latRad);
  const north = b.lat - a.lat;
  let headingDeg = (Math.atan2(east, north) * 180) / Math.PI;
  if (headingDeg < 0) headingDeg += 360;

  return { lat, lng, alt, headingDeg };
}

export function initialState(route: CommittedRoute): SimState {
  const s = sampleRoute(route, 0);
  return {
    progressM: 0,
    mode: "idle",
    speedKmh: 0,
    headingDeg: s.headingDeg,
    lat: s.lat,
    lng: s.lng,
    alt: s.alt,
  };
}

/**
 * Advance the simulation by `dtSeconds`, applying an intent.
 * This is the ONLY function permitted to change the Rungent's position.
 */
export function step(
  route: CommittedRoute,
  state: SimState,
  intent: RungentIntent,
  dtSeconds: number
): SimState {
  if (dtSeconds < 0) throw new Error("dtSeconds must be non-negative");

  // Hard speed cap by mode. Even if a caller passes a bogus mode, the lookup
  // yields undefined -> treated as 0 rather than as "unlimited".
  const speedKmh = MODE_SPEED_KMH[intent.mode] ?? 0;
  const speedMs = (speedKmh * 1000) / 3600;
  const maxStepM = speedMs * dtSeconds;

  let progressM = state.progressM + intent.direction * maxStepM;
  // Clamp to route bounds — the Rungent can never run past either endpoint.
  progressM = Math.max(0, Math.min(progressM, route.totalLengthM));

  const sampled = sampleRoute(route, progressM);

  // When doubling back, the visual heading is the reverse of the tangent.
  const headingDeg =
    intent.direction === -1 ? (sampled.headingDeg + 180) % 360 : sampled.headingDeg;

  return {
    progressM,
    mode: intent.mode,
    speedKmh,
    headingDeg: intent.mode === "idle" ? state.headingDeg : headingDeg,
    lat: sampled.lat,
    lng: sampled.lng,
    alt: sampled.alt,
  };
}

/** True once the Rungent has reached the end of its committed route. */
export function hasArrived(route: CommittedRoute, state: SimState): boolean {
  return state.progressM >= route.totalLengthM - 0.5;
}
