import { describe, it, expect } from "vitest";
import { haversineMeters } from "@rundown/shared";
import {
  buildRoute,
  sampleRoute,
  initialState,
  step,
  hasArrived,
  MODE_SPEED_KMH,
  type CommittedRoute,
} from "../src/simulator";

// A roughly 1km north-south straight route near Teplice, CZ.
function straightRoute(): CommittedRoute {
  return buildRoute([
    { lat: 50.64, lng: 13.8245, alt: 220 },
    { lat: 50.6445, lng: 13.8245, alt: 240 },
    { lat: 50.649, lng: 13.8245, alt: 230 },
  ]);
}

describe("buildRoute", () => {
  it("computes cumulative distances along the polyline", () => {
    const r = straightRoute();
    expect(r.points[0].distM).to.equal(0);
    expect(r.points[1].distM).toBeGreaterThan(400);
    expect(r.totalLengthM).toBeGreaterThan(900);
    expect(r.totalLengthM).toBeLessThan(1200);
  });

  it("rejects a route with fewer than 2 points", () => {
    expect(() => buildRoute([{ lat: 50.64, lng: 13.82 }])).toThrow();
  });
});

describe("speed caps", () => {
  it("never exceeds walking speed in walk mode", () => {
    const route = straightRoute();
    let state = initialState(route);
    const dt = 10;
    const prev = { lat: state.lat, lng: state.lng };
    state = step(route, state, { mode: "walk", direction: 1 }, dt);
    const moved = haversineMeters(prev, state);
    const maxAllowed = (MODE_SPEED_KMH.walk * 1000 / 3600) * dt;
    expect(moved).toBeLessThanOrEqual(maxAllowed + 0.01);
  });

  it("never exceeds running speed in run mode", () => {
    const route = straightRoute();
    let state = initialState(route);
    const dt = 30;
    const prev = { lat: state.lat, lng: state.lng };
    state = step(route, state, { mode: "run", direction: 1 }, dt);
    const moved = haversineMeters(prev, state);
    const maxAllowed = (MODE_SPEED_KMH.run * 1000 / 3600) * dt;
    expect(moved).toBeLessThanOrEqual(maxAllowed + 0.01);
  });

  it("does not move at all in idle mode", () => {
    const route = straightRoute();
    let state = initialState(route);
    state = step(route, state, { mode: "walk", direction: 1 }, 60);
    const before = state.progressM;
    state = step(route, state, { mode: "idle", direction: 1 }, 600);
    expect(state.progressM).to.equal(before);
    expect(state.speedKmh).to.equal(0);
  });

  it("treats an unknown mode as stationary rather than unlimited", () => {
    const route = straightRoute();
    let state = initialState(route);
    // deliberately bypass the type system, simulating a corrupt LLM response
    state = step(route, state, { mode: "sprint" as any, direction: 1 }, 60);
    expect(state.progressM).to.equal(0);
    expect(state.speedKmh).to.equal(0);
  });
});

describe("no teleporting", () => {
  it("cannot jump across the route no matter how large the intent", () => {
    const route = straightRoute();
    let state = initialState(route);
    // 100 successive one-second run ticks
    for (let i = 0; i < 100; i++) {
      const prev = { lat: state.lat, lng: state.lng };
      state = step(route, state, { mode: "run", direction: 1 }, 1);
      const moved = haversineMeters(prev, state);
      expect(moved).toBeLessThanOrEqual(MODE_SPEED_KMH.run * 1000 / 3600 + 0.01);
    }
  });

  it("rejects negative time deltas (no rewinding to dodge a catch)", () => {
    const route = straightRoute();
    const state = initialState(route);
    expect(() => step(route, state, { mode: "run", direction: 1 }, -30)).toThrow();
  });
});

describe("route bounds", () => {
  it("clamps at the end point and never overshoots", () => {
    const route = straightRoute();
    let state = initialState(route);
    for (let i = 0; i < 200; i++) {
      state = step(route, state, { mode: "run", direction: 1 }, 10);
    }
    expect(state.progressM).to.equal(route.totalLengthM);
    expect(hasArrived(route, state)).to.equal(true);
  });

  it("clamps at the start point when doubling back", () => {
    const route = straightRoute();
    let state = initialState(route);
    for (let i = 0; i < 50; i++) {
      state = step(route, state, { mode: "run", direction: -1 }, 10);
    }
    expect(state.progressM).to.equal(0);
  });

  it("stays on the polyline — every sampled point lies on a segment", () => {
    const route = straightRoute();
    let state = initialState(route);
    for (let i = 0; i < 40; i++) {
      state = step(route, state, { mode: "walk", direction: 1 }, 15);
      // all our test points share a longitude, so any drift off-route shows here
      expect(Math.abs(state.lng - 13.8245)).toBeLessThan(1e-9);
    }
  });
});

describe("altitude", () => {
  it("interpolates altitude from the sampled route rather than flying", () => {
    const route = straightRoute();
    const mid = sampleRoute(route, route.totalLengthM / 2);
    // route altitudes are 220 -> 240 -> 230; midpoint must lie inside that band
    expect(mid.alt).toBeGreaterThanOrEqual(220);
    expect(mid.alt).toBeLessThanOrEqual(240);
  });
});

describe("determinism", () => {
  it("produces identical results for identical inputs", () => {
    const route = straightRoute();
    const runOnce = () => {
      let s = initialState(route);
      for (let i = 0; i < 25; i++) {
        s = step(route, s, { mode: i % 3 === 0 ? "run" : "walk", direction: 1 }, 7);
      }
      return s;
    };
    expect(runOnce()).to.deep.equal(runOnce());
  });
});
