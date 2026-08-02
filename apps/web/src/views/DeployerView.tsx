import { useEffect, useState } from "react";
import { useWallet } from "../lib/wallet";
import { useGeo } from "../geo/GeoContext";
import { MapPicker, type Pin } from "../components/MapPicker";
import { planWalkingRoute, straightLineRoute, type PlannedRoutePoint } from "../lib/maps";
import { createLeg, huntLinkFor, setLegStatus, getLegStatus } from "../lib/legs";
import { haversineMeters, WALK_KMH } from "@rundown/shared";

interface Props {
  onBack: () => void;
}

const TEPLICE: Pin = { lat: 50.6404, lng: 13.8245 };

export function DeployerView({ onBack }: Props) {
  const { address, connecting, error: walletError, connect } = useWallet();
  const { sample, permissionGranted, requestPermission, provider } = useGeo();

  const [start, setStart] = useState<Pin>(TEPLICE);
  const [end, setEnd] = useState<Pin>({ lat: TEPLICE.lat + 0.004, lng: TEPLICE.lng });
  const [name, setName] = useState("NULLPOINTER");
  const [story, setStory] = useState("An escaped process, walking home.");
  const [personality, setPersonality] = useState("Cocky. Taunts hunters who miss.");
  const [prize, setPrize] = useState("10");

  const [route, setRoute] = useState<PlannedRoutePoint[] | null>(null);
  const [routeLen, setRouteLen] = useState(0);
  const [planning, setPlanning] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [huntLink, setHuntLink] = useState<string | null>(null);
  const [deployedLegId, setDeployedLegId] = useState<string | null>(null);
  const [movement, setMovement] = useState<string | null>(null);

  // Prefill pins from GPS once available, as a convenience.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (sample && !prefilled) {
      setStart({ lat: sample.lat, lng: sample.lng });
      setEnd({ lat: sample.lat + 0.004, lng: sample.lng });
      setPrefilled(true);
    }
  }, [sample, prefilled]);

  // Poll the leg's movement status so Start/Stop reflect reality.
  useEffect(() => {
    if (!deployedLegId) return;
    const t = setInterval(async () => {
      const st = await getLegStatus(deployedLegId);
      if (st) setMovement(st);
    }, 3000);
    return () => clearInterval(t);
  }, [deployedLegId]);

  const straightLineM = haversineMeters(start, end);

  async function handlePlanRoute() {
    setPlanning(true);
    setErr(null);
    try {
      const pts = await planWalkingRoute(start, end);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += haversineMeters(pts[i - 1], pts[i]);
      setRoute(pts);
      setRouteLen(len);
    } catch (e: any) {
      // Directions unavailable (e.g. legacy API not enabled). Fall back to a
      // straight-line route so the demo can still deploy; not street-snapped.
      const pts = straightLineRoute(start, end);
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += haversineMeters(pts[i - 1], pts[i]);
      setRoute(pts);
      setRouteLen(len);
      setErr(
        `Directions unavailable (${e.message}). Using a straight line - enable the Routes API for street routing.`
      );
    } finally {
      setPlanning(false);
    }
  }

  async function handleDeploy() {
    if (!address || !route) return;
    setDeploying(true);
    setErr(null);
    try {
      const { leg } = await createLeg({
        name,
        story,
        personality,
        deployerWallet: address,
        start,
        end,
        route,
        routeLengthM: routeLen,
        prizeAmount: prize,
      });
      setHuntLink(huntLinkFor(leg.id));
      setDeployedLegId(leg.id);
      setMovement(leg.status);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="view">
      <button className="back-link" onClick={onBack}>
        &larr; back
      </button>
      <h2>Deployer (Wallet A)</h2>
      <span className="status-pill">M1b &mdash; deploy a leg</span>

      {!address ? (
        <div style={{ marginTop: 20 }}>
          <button className="primary-btn" onClick={connect} disabled={connecting}>
            {connecting ? "Connecting..." : "Connect Wallet A"}
          </button>
          {walletError && <p className="warn-banner">{walletError}</p>}
        </div>
      ) : (
        <p style={{ fontSize: "0.85rem" }}>
          Deploying as <code>{address}</code>
        </p>
      )}

      {provider.kind === "device" && !permissionGranted && (
        <button className="primary-btn" style={{ marginTop: 12 }} onClick={requestPermission}>
          Use my location
        </button>
      )}

      <div style={{ marginTop: 20 }}>
        <MapPicker
          start={start}
          end={end}
          routePreview={route ?? undefined}
          onChange={(n) => {
            setStart(n.start);
            setEnd(n.end);
            setRoute(null); // pins moved - previous route is stale
          }}
        />
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label>Or paste coordinates — start lat,lng then end lat,lng</label>
        <input
          placeholder="50.647593, 13.836550  ->  50.646776, 13.835226"
          onChange={(e) => {
            // Dragging pins cannot reliably put a route on one particular
            // street, which is what decides whether the Rungent walks past
            // the hunter or straight at them.
            const n = e.target.value.match(/-?\d+\.\d+/g)?.map(Number);
            if (n && n.length >= 4) {
              setStart({ lat: n[0], lng: n[1] });
              setEnd({ lat: n[2], lng: n[3] });
              setRoute(null);
            }
          }}
        />
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <button className="primary-btn" onClick={handlePlanRoute} disabled={planning}>
          {planning ? "Planning..." : "Plan walking route"}
        </button>
        <span style={{ alignSelf: "center", fontSize: "0.8rem", color: "#8fa3a0" }}>
          straight line {straightLineM.toFixed(0)} m
          {route &&
            ` / walking route ${routeLen.toFixed(0)} m / ~${(
              (routeLen / 1000 / WALK_KMH) *
              60
            ).toFixed(0)} min at ${WALK_KMH} km/h`}
        </span>
      </div>

      <div className="field" style={{ marginTop: 20 }}>
        <label>Rungent name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Story</label>
        <textarea rows={2} value={story} onChange={(e) => setStory(e.target.value)} />
      </div>
      <div className="field">
        <label>Personality (drives its dialogue)</label>
        <textarea rows={2} value={personality} onChange={(e) => setPersonality(e.target.value)} />
      </div>
      <div className="field">
        <label>Prize (testnet USDC)</label>
        <input value={prize} onChange={(e) => setPrize(e.target.value)} inputMode="decimal" />
      </div>

      {err && <p className="warn-banner">{err}</p>}

      <button
        className="primary-btn"
        onClick={handleDeploy}
        disabled={!address || !route || deploying}
        style={{ marginTop: 8 }}
      >
        {deploying ? "Deploying..." : "Deploy Rungent"}
      </button>
      {!route && (
        <p style={{ fontSize: "0.75rem", color: "#8fa3a0", marginTop: 8 }}>
          Plan a route first - the polyline is part of the committed rules hash.
        </p>
      )}

      {deployedLegId && (
        <div style={{ marginTop: 20, padding: 12, border: "1px solid #1e2b28", borderRadius: 8 }}>
          <div style={{ fontSize: "0.85rem", marginBottom: 8 }}>
            Rungent movement:{" "}
            <b style={{ color: movement === "active" ? "#00FF6A" : "#8fa3a0" }}>
              {movement === "active" ? "MOVING" : "stopped"}
            </b>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="primary-btn"
              disabled={movement === "active"}
              onClick={async () => {
                await setLegStatus(deployedLegId, "active");
                setMovement("active");
              }}
            >
              &#9654; Start moving
            </button>
            <button
              className="primary-btn"
              disabled={movement !== "active"}
              onClick={async () => {
                await setLegStatus(deployedLegId, "draft");
                setMovement("draft");
              }}
            >
              &#9209; Stop
            </button>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#8fa3a0", marginTop: 8 }}>
            Start sets status=active; the runner service picks it up within ~4s and walks the route.
          </p>
        </div>
      )}

      {huntLink && (
        <div style={{ marginTop: 24 }}>
          <div className="field">
            <label>Shareable hunt link - open on Wallet B</label>
            <input readOnly value={huntLink} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <button className="primary-btn" onClick={() => navigator.clipboard?.writeText(huntLink)}>
            Copy link
          </button>
        </div>
      )}

      <p style={{ color: "#8fa3a0", marginTop: 24, fontSize: "0.8rem" }}>
        Next: escrow funding + the on-chain LegCommit signature, once contracts
        are deployed to Sepolia and their addresses are in .env.
      </p>
    </div>
  );
}
