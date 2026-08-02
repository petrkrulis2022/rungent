// The single seam that makes this app buildable on a laptop before it ever
// touches a phone. Every AR/hunter component reads position + heading through
// this interface only — never window.navigator.geolocation or
// DeviceOrientationEvent directly. Swap the implementation with ?geo=mock.

export interface GeoSample {
  lat: number;
  lng: number;
  alt: number | null;
  accuracyM: number | null;
  headingDeg: number; // compass heading, 0 = north, smoothed
  ts: number;
}

export type GeoListener = (sample: GeoSample) => void;

export interface GeoProvider {
  readonly kind: "device" | "mock";
  /** Request whatever permissions this provider needs (GPS + compass on device). */
  requestPermission(): Promise<boolean>;
  subscribe(listener: GeoListener): () => void;
  getLast(): GeoSample | null;
}

export function pickGeoProvider(): "device" | "mock" {
  const params = new URLSearchParams(window.location.search);
  const forced = params.get("geo");
  if (forced === "mock" || forced === "device") return forced;
  // Default: mock on anything that clearly isn't a phone touch device, so
  // `pnpm dev` on a laptop just works without query params.
  const isTouchPhoneLike =
    "ontouchstart" in window && /iphone|android/i.test(navigator.userAgent);
  return isTouchPhoneLike ? "device" : "mock";
}
