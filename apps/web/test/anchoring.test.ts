import { describe, it, expect } from "vitest";
import {
  geoToScene,
  headingToWorldRotation,
  smoothHeading,
  bearingDeg,
  easeTowards,
} from "../src/ar/anchoring";

const HUNTER = { lat: 50.6404, lng: 13.8245, alt: 230 };

describe("geoToScene", () => {
  it("places a point due north at negative z", () => {
    const p = geoToScene(HUNTER, { lat: HUNTER.lat + 0.001, lng: HUNTER.lng, alt: 230 });
    expect(p.z).toBeLessThan(0);
    expect(Math.abs(p.x)).toBeLessThan(0.01);
    expect(p.distanceM).toBeGreaterThan(100);
    expect(p.distanceM).toBeLessThan(120);
  });

  it("places a point due east at positive x", () => {
    const p = geoToScene(HUNTER, { lat: HUNTER.lat, lng: HUNTER.lng + 0.001, alt: 230 });
    expect(p.x).toBeGreaterThan(0);
    expect(Math.abs(p.z)).toBeLessThan(0.01);
  });

  it("places a point due south at positive z and west at negative x", () => {
    const s = geoToScene(HUNTER, { lat: HUNTER.lat - 0.001, lng: HUNTER.lng, alt: 230 });
    const w = geoToScene(HUNTER, { lat: HUNTER.lat, lng: HUNTER.lng - 0.001, alt: 230 });
    expect(s.z).toBeGreaterThan(0);
    expect(w.x).toBeLessThan(0);
  });

  it("subtracts eye height so a ground-level target sits below the camera", () => {
    const p = geoToScene(HUNTER, { lat: HUNTER.lat + 0.0005, lng: HUNTER.lng, alt: 230 }, 1.6);
    expect(p.y).toBeCloseTo(-1.6, 5);
  });

  it("reflects altitude differences", () => {
    const higher = geoToScene(HUNTER, { lat: HUNTER.lat, lng: HUNTER.lng, alt: 240 }, 1.6);
    expect(higher.y).toBeCloseTo(240 - 230 - 1.6, 5);
  });

  it("reports distance symmetric with the reverse direction", () => {
    const target = { lat: 50.6414, lng: 13.826, alt: 230 };
    const a = geoToScene(HUNTER, target).distanceM;
    const b = geoToScene(target, HUNTER).distanceM;
    expect(Math.abs(a - b)).toBeLessThan(0.5);
  });
});

describe("headingToWorldRotation", () => {
  it("is zero when facing north", () => {
    expect(headingToWorldRotation(0)).to.equal(0);
  });
  it("is a quarter turn when facing east", () => {
    expect(headingToWorldRotation(90)).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe("smoothHeading", () => {
  it("returns the raw value on first sample", () => {
    expect(smoothHeading(null, 137)).to.equal(137);
  });

  it("moves only partway toward the new reading", () => {
    const out = smoothHeading(0, 100, 0.1);
    expect(out).toBeGreaterThan(0);
    expect(out).toBeLessThan(100);
  });

  it("takes the short way across the 359->1 wrap", () => {
    // naive averaging would swing all the way back through 180
    const out = smoothHeading(359, 1, 0.5);
    expect(out === 0 || out > 359 || out < 1).to.equal(true);
  });

  it("converges to a stable reading when the phone is held still", () => {
    let h: number | null = null;
    // simulate noisy compass jittering +/-8 degrees around 90
    for (let i = 0; i < 400; i++) {
      const noisy = 90 + Math.sin(i) * 8;
      h = smoothHeading(h, noisy, 0.12);
    }
    expect(Math.abs((h as number) - 90)).toBeLessThan(4);
  });
});

describe("bearingDeg", () => {
  it("reads 0 for due north and 90 for due east", () => {
    expect(bearingDeg(HUNTER, { lat: HUNTER.lat + 0.001, lng: HUNTER.lng })).toBeCloseTo(0, 1);
    expect(bearingDeg(HUNTER, { lat: HUNTER.lat, lng: HUNTER.lng + 0.001 })).toBeCloseTo(90, 1);
  });

  it("always returns a value in [0,360)", () => {
    const b = bearingDeg(HUNTER, { lat: HUNTER.lat - 0.001, lng: HUNTER.lng - 0.001 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe("easeTowards", () => {
  it("converges on the target without overshooting", () => {
    let cur = { x: 0, y: 0, z: 0 };
    const target = { x: 10, y: 0, z: -5 };
    for (let i = 0; i < 200; i++) cur = easeTowards(cur, target, 0.15);
    expect(cur.x).toBeCloseTo(10, 3);
    expect(cur.z).toBeCloseTo(-5, 3);
  });
});
