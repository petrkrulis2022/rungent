import type { GeoProvider, GeoListener, GeoSample } from "./GeoProvider";

const STORAGE_KEY = "rundown:mock-geo";

/**
 * Fully scriptable stand-in for GPS + compass, used behind ?geo=mock.
 * Driven by the <MockGeoPanel/> UI (drag-on-map + WASD + heading slider) so
 * the entire hunter/deployer flow — including the AR anchoring math — can be
 * developed and demoed at a laptop before ever touching a phone.
 */
export class MockGeoProvider implements GeoProvider {
  readonly kind = "mock" as const;
  private listeners = new Set<GeoListener>();
  private last: GeoSample;

  constructor(initial?: Partial<GeoSample>) {
    const stored = MockGeoProvider.loadStored();
    this.last = {
      lat: initial?.lat ?? stored?.lat ?? 50.6404, // default: Teplice, CZ
      lng: initial?.lng ?? stored?.lng ?? 13.8245,
      alt: initial?.alt ?? stored?.alt ?? 230,
      accuracyM: 5,
      headingDeg: initial?.headingDeg ?? stored?.headingDeg ?? 0,
      ts: Date.now(),
    };
  }

  async requestPermission(): Promise<boolean> {
    return true; // no real permission needed
  }

  subscribe(listener: GeoListener): () => void {
    this.listeners.add(listener);
    listener(this.last);
    return () => this.listeners.delete(listener);
  }

  getLast(): GeoSample | null {
    return this.last;
  }

  /** Called by the mock control panel to move the puck. */
  setPosition(patch: Partial<Pick<GeoSample, "lat" | "lng" | "alt" | "headingDeg">>) {
    this.last = { ...this.last, ...patch, ts: Date.now() };
    MockGeoProvider.persist(this.last);
    for (const l of this.listeners) l(this.last);
  }

  /** Move by a meter offset along current heading-relative east/north — used by WASD. */
  stepMeters(east: number, north: number) {
    const dLat = north / 110540;
    const dLng = east / (111320 * Math.cos((this.last.lat * Math.PI) / 180));
    this.setPosition({ lat: this.last.lat + dLat, lng: this.last.lng + dLng });
  }

  private static loadStored(): GeoSample | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private static persist(sample: GeoSample) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
    } catch {
      // ignore
    }
  }
}
