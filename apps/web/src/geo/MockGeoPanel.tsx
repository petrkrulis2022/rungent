import { useEffect } from "react";
import { useGeo } from "./GeoContext";
import { MockGeoProvider } from "./MockGeoProvider";

/**
 * Only rendered when running behind ?geo=mock (i.e. desktop dev). Lets you
 * drive the "phone" position with WASD + a heading slider so the AR
 * anchoring math, engagement range, and takedown flows can all be exercised
 * without leaving the laptop. Not shipped in the phone build's normal path.
 */
export function MockGeoPanel() {
  const { provider, sample } = useGeo();
  if (provider.kind !== "mock") return null;
  const mock = provider as MockGeoProvider;

  useEffect(() => {
    const STEP_M = 3;
    const onKey = (e: KeyboardEvent) => {
      const heading = sample?.headingDeg ?? 0;
      const rad = (heading * Math.PI) / 180;
      // forward = direction the "compass" faces
      const fwd = { east: Math.sin(rad), north: Math.cos(rad) };
      const right = { east: Math.cos(rad), north: -Math.sin(rad) };
      switch (e.key.toLowerCase()) {
        case "w":
          mock.stepMeters(fwd.east * STEP_M, fwd.north * STEP_M);
          break;
        case "s":
          mock.stepMeters(-fwd.east * STEP_M, -fwd.north * STEP_M);
          break;
        case "a":
          mock.stepMeters(-right.east * STEP_M, -right.north * STEP_M);
          break;
        case "d":
          mock.stepMeters(right.east * STEP_M, right.north * STEP_M);
          break;
        case "q":
          mock.setPosition({ headingDeg: ((heading - 5) % 360 + 360) % 360 });
          break;
        case "e":
          mock.setPosition({ headingDeg: (heading + 5) % 360 });
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mock, sample]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: 12,
        zIndex: 1000,
        background: "rgba(7,9,12,0.9)",
        border: "1px solid #00E5FF",
        borderRadius: 8,
        padding: 12,
        color: "#00E5FF",
        fontFamily: "monospace",
        fontSize: 12,
        maxWidth: 260,
      }}
    >
      <div style={{ marginBottom: 6, color: "#00FF6A" }}>MOCK GEO (desktop dev)</div>
      <div>lat: {sample?.lat.toFixed(6)}</div>
      <div>lng: {sample?.lng.toFixed(6)}</div>
      <div>heading: {sample?.headingDeg.toFixed(0)}°</div>
      <div style={{ marginTop: 6, opacity: 0.8 }}>
        WASD move · Q/E turn · position persists across reloads
      </div>
      <input
        type="range"
        min={0}
        max={359}
        value={sample?.headingDeg ?? 0}
        onChange={(e) => mock.setPosition({ headingDeg: Number(e.target.value) })}
        style={{ width: "100%", marginTop: 8 }}
      />
    </div>
  );
}
