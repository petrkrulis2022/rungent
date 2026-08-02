import type { GeoProvider, GeoListener, GeoSample } from "./GeoProvider";

// Raw compass readings are noisy (can jitter ±10-20deg between samples).
// A low-pass filter on the circular heading value keeps the Rungent from
// visibly "swimming" as the hunter holds the phone still.
function lowPassHeading(prev: number | null, next: number, alpha = 0.15): number {
  if (prev === null) return next;
  // shortest angular distance, handling the 0/360 wrap
  let diff = ((next - prev + 540) % 360) - 180;
  return (prev + alpha * diff + 360) % 360;
}

export class DeviceGeoProvider implements GeoProvider {
  readonly kind = "device" as const;
  private listeners = new Set<GeoListener>();
  private last: GeoSample | null = null;
  private smoothedHeading: number | null = null;
  private orientationHandler: ((e: DeviceOrientationEvent) => void) | null = null;
  public hasHeading = false;
  /** Why the last permission request failed, for display on a phone. */
  public lastError: string | null = null;

  async requestPermission(): Promise<boolean> {
    // iOS requires these to be called from a user gesture (a button tap).
    // Caller is responsible for invoking requestPermission() inside one.
    try {
      const DOE = (window as any).DeviceOrientationEvent;
      if (DOE && typeof DOE.requestPermission === "function") {
        const res = await DOE.requestPermission();
        if (res !== "granted") return false;
      }
      if (!navigator.geolocation) {
        this.lastError =
          "This browser exposes no geolocation. Open the link in Safari or Chrome rather than an in-app browser.";
        return false;
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          // A cold GPS fix outdoors regularly takes longer than 10s, and a
          // timeout here is indistinguishable from a dead button.
          timeout: 25000,
        })
      );
      this.applyPosition(pos);
      this.startWatching();
      return true;
    } catch (err) {
      const code = (err as GeolocationPositionError)?.code;
      this.lastError =
        code === 1
          ? "Location permission was refused. Allow it for this site, then tap again."
          : code === 2
            ? "Position unavailable. Move somewhere with a clearer view of the sky."
            : code === 3
              ? "Timed out waiting for a GPS fix. Tap again, ideally outdoors."
              : `Could not start location or motion access: ${(err as Error)?.message ?? err}`;
      console.error("[DeviceGeoProvider] permission failed", err);
      return false;
    }
  }

  private startWatching() {
    navigator.geolocation.watchPosition(
      (pos) => this.applyPosition(pos),
      (err) => console.error("[DeviceGeoProvider] watch error", err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
    );

    this.orientationHandler = (e: DeviceOrientationEvent) => {
      this.hasHeading = true;
      // iOS Safari exposes true compass heading via webkitCompassHeading.
      // Android exposes alpha (relative to device init, roughly usable for a demo).
      const raw =
        (e as any).webkitCompassHeading !== undefined
          ? (e as any).webkitCompassHeading
          : e.alpha ?? 0;
      this.smoothedHeading = lowPassHeading(this.smoothedHeading, raw);
      this.emit();
    };
    window.addEventListener(
      "deviceorientation",
      this.orientationHandler as EventListener,
      true
    );
  }

  private applyPosition(pos: GeolocationPosition) {
    this.last = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      alt: pos.coords.altitude,
      accuracyM: pos.coords.accuracy,
      headingDeg: this.smoothedHeading ?? 0,
      ts: pos.timestamp,
    };
    this.emit();
  }

  private emit() {
    if (!this.last) return;
    this.last = { ...this.last, headingDeg: this.smoothedHeading ?? this.last.headingDeg };
    for (const l of this.listeners) l(this.last);
  }

  subscribe(listener: GeoListener): () => void {
    this.listeners.add(listener);
    if (this.last) listener(this.last);
    return () => this.listeners.delete(listener);
  }

  getLast(): GeoSample | null {
    return this.last;
  }
}
