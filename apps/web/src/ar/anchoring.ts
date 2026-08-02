import type { LatLng } from "@rundown/shared";

/**
 * GEO -> SCENE ANCHORING
 *
 * Three.js scene convention used throughout:
 *   +x = EAST, +z = SOUTH (so north is -z), +y = UP
 * The camera sits at the origin, representing the hunter's phone.
 *
 * We then rotate the whole world by the device's compass heading so that
 * scene-north lines up with true north. Rotating the world rather than the
 * camera keeps the camera at identity, which makes raycasting from screen
 * coordinates (for tap-to-interact and the aim reticle) far simpler.
 */

const EYE_HEIGHT_M = 1.6;

export interface ScenePlacement {
  x: number;
  y: number;
  z: number;
  distanceM: number;
}

/** Place a geo point in the scene relative to the hunter. */
export function geoToScene(
  hunter: LatLng & { alt?: number },
  target: LatLng & { alt?: number },
  eyeHeight = EYE_HEIGHT_M
): ScenePlacement {
  const latRad = (hunter.lat * Math.PI) / 180;
  const east = (target.lng - hunter.lng) * Math.cos(latRad) * 111320;
  const north = (target.lat - hunter.lat) * 110540;

  const x = east;
  const z = -north;
  const y = (target.alt ?? 0) - (hunter.alt ?? 0) - eyeHeight;

  return { x, y, z, distanceM: Math.hypot(east, north) };
}

/**
 * Compass heading -> world rotation, in radians.
 *
 * A heading of 0 means the phone faces true north. The camera looks down -z,
 * which we treat as scene-north, so at heading 0 the world needs no rotation.
 * At heading 90 (facing east) the world must rotate so that east-lying objects
 * appear straight ahead — hence a positive rotation about the Y axis.
 */
export function headingToWorldRotation(headingDeg: number): number {
  return (headingDeg * Math.PI) / 180;
}

/**
 * Low-pass filter for noisy compass values, operating on the circle so that
 * the 359 -> 1 wrap doesn't cause a 358-degree spin. Without this the Rungent
 * visibly "swims" while the phone is held still.
 */
export function smoothHeading(prev: number | null, next: number, alpha = 0.12): number {
  if (prev === null || Number.isNaN(prev)) return next;
  const diff = ((next - prev + 540) % 360) - 180;
  return (prev + alpha * diff + 360) % 360;
}

/**
 * Bearing from one geo point to another, in degrees clockwise from north.
 * Used to turn the Rungent to face a hunter ("it noticed me").
 */
export function bearingDeg(from: LatLng, to: LatLng): number {
  const latRad = (from.lat * Math.PI) / 180;
  const east = (to.lng - from.lng) * Math.cos(latRad);
  const north = to.lat - from.lat;
  let deg = (Math.atan2(east, north) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

/**
 * GPS is 5-15 m accurate and jumps. Snapping the rendered position straight to
 * each fix makes the Rungent teleport around. We ease toward the reported
 * position instead — visual smoothing only; the server's truth is unchanged
 * and all adjudication still uses real coordinates.
 */
export function easeTowards(
  current: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  alpha: number
): { x: number; y: number; z: number } {
  return {
    x: current.x + (target.x - current.x) * alpha,
    y: current.y + (target.y - current.y) * alpha,
    z: current.z + (target.z - current.z) * alpha,
  };
}
