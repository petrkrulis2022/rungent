import { useEffect, useRef, useState } from "react";
import { useWallet, isSameWallet } from "../lib/wallet";
import { useGeo } from "../geo/GeoContext";
import { CameraFeed } from "../ar/CameraFeed";
import { ARScene } from "../ar/ARScene";
import { HUD, DownBurst, type TakedownResult } from "../ar/HUD";
import {
  fetchLeg,
  fetchRungent,
  pushHunterPosition,
  requestTakedown,
  fetchDevPosition,
  type RungentView,
  type DevPosition,
} from "../lib/rungentClient";
import { SHOOT_LOCK_RANGE_M, SHOOT_LOCK_MS, CATCH_HOLD_MS, ENGAGEMENT_RANGE_M, haversineMeters } from "@rundown/shared";
import { Minimap } from "../ar/Minimap";

/** Compass bearing from a to b, in degrees clockwise from true north. */
function bearingDeg(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const p = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * p) * Math.cos(b.lat * p);
  const x =
    Math.cos(a.lat * p) * Math.sin(b.lat * p) -
    Math.sin(a.lat * p) * Math.cos(b.lat * p) * Math.cos((b.lng - a.lng) * p);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const calBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid #1e2b28",
  borderRadius: 4,
  color: "#8fa3a0",
  fontFamily: "monospace",
  fontSize: 11,
  padding: "2px 6px",
  cursor: "pointer",
};

interface Props {
  onBack: () => void;
  legId?: string | null;
}

export function HunterView({ onBack, legId }: Props) {
  const { address, connecting, error: walletError, connect } = useWallet();
  const { sample, permissionGranted, requestPermission, provider, hasHeading } = useGeo();

  const [leg, setLeg] = useState<any>(null);
  const [legErr, setLegErr] = useState<string | null>(null);
  const [rungent, setRungent] = useState<RungentView | null>(null);
  const [devPos, setDevPos] = useState<DevPosition | null>(null);
  const [armed, setArmed] = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const [result, setResult] = useState<TakedownResult>(null);
  const [speech, setSpeech] = useState<string | null>(null);
  const [lockProgress, setLockProgress] = useState(0);
  const [catchProgress, setCatchProgress] = useState(0);
  const [burst, setBurst] = useState(false);

  // A laptop has no compass, so nothing tells us which way the camera actually
  // points — assuming true north puts the Rungent at a fixed wrong angle (it
  // appears to approach from behind). The hunter calibrates once; a webcam
  // does not move, so the value is worth persisting per device.
  const [manualHeading, setManualHeading] = useState<number | null>(() => {
    const v = localStorage.getItem("rundown.camHeading");
    return v === null ? null : Number(v);
  });
  const setCamHeading = (deg: number) => {
    const d = ((deg % 360) + 360) % 360;
    localStorage.setItem("rundown.camHeading", String(d));
    setManualHeading(d);
  };

  const lockStart = useRef<number | null>(null);
  const catchStart = useRef<number | null>(null);

  const sameWallet = isSameWallet(address, leg?.deployer_wallet ?? null);

  // load the leg
  useEffect(() => {
    if (!legId) return;
    fetchLeg(legId).then(setLeg).catch((e) => setLegErr(e.message));
  }, [legId]);

  // poll the range-gated position + push our own
  useEffect(() => {
    if (!armed || !legId || !address || !sample) return;
    let alive = true;
    const tick = async () => {
      if (!alive || !sample) return;
      const view = await fetchRungent(legId, sample.lat, sample.lng);
      if (!alive) return;
      setRungent(view);
      pushHunterPosition(legId, address, sample.lat, sample.lng, sample.alt);
      fetchDevPosition(legId).then((d) => {
        if (alive) setDevPos(d);
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [armed, legId, address, sample?.lat, sample?.lng]);

  // aim lock: hold the reticle on the Rungent within range for SHOOT_LOCK_MS
  useEffect(() => {
    const inLockRange =
      rungent?.in_range && rungent.distance_m !== null && rungent.distance_m <= SHOOT_LOCK_RANGE_M;
    if (!inLockRange || rungent?.status === "down") {
      lockStart.current = null;
      setLockProgress(0);
      return;
    }
    if (lockStart.current === null) lockStart.current = Date.now();
    const id = setInterval(() => {
      if (lockStart.current === null) return;
      const p = Math.min(1, (Date.now() - lockStart.current) / SHOOT_LOCK_MS);
      setLockProgress(p);
    }, 50);
    return () => clearInterval(id);
  }, [rungent?.in_range, rungent?.distance_m, rungent?.status]);

  const locked = lockProgress >= 1;

  function handleCatchStart() {
    catchStart.current = Date.now();
    const id = setInterval(() => {
      if (catchStart.current === null) {
        clearInterval(id);
        setCatchProgress(0);
        return;
      }
      const p = Math.min(1, (Date.now() - catchStart.current) / CATCH_HOLD_MS);
      setCatchProgress(p);
      if (p >= 1) {
        clearInterval(id);
        catchStart.current = null;
        submitTakedown("catch");
      }
    }, 50);
  }

  function handleCatchEnd() {
    catchStart.current = null;
    setCatchProgress(0);
  }

  async function submitTakedown(method: "shoot" | "catch") {
    if (!legId || !address || !sample) return;
    const res = await requestTakedown({
      legId,
      wallet: address,
      method,
      lat: sample.lat,
      lng: sample.lng,
    });
    setResult(res);
    if (res.ok) {
      setBurst(true);
      setTimeout(() => setBurst(false), 1200);
    }
  }

  // ---------- gate: not yet armed ----------
  if (!armed) {
    return (
      <div className="view">
        <button className="back-link" onClick={onBack}>
          &larr; back
        </button>
        <h2>Hunter (Wallet B)</h2>

        {legErr && <p className="warn-banner">{legErr}</p>}
        {!legId && (
          <p className="warn-banner">
            No leg specified. Open the shareable hunt link from the Deployer view.
          </p>
        )}
        {leg && (
          <p style={{ fontSize: "0.85rem" }}>
            Hunting <b style={{ color: "#00FF6A" }}>{leg.name}</b> &mdash; {leg.prize_amount} testnet
            USDC
          </p>
        )}

        {!address ? (
          <button className="primary-btn" onClick={connect} disabled={connecting}>
            {connecting ? "Connecting..." : "Connect Wallet B"}
          </button>
        ) : (
          <p style={{ fontSize: "0.8rem" }}>
            Connected as <code>{address}</code>
          </p>
        )}
        {walletError && <p className="warn-banner">{walletError}</p>}

        {sameWallet && (
          <p className="warn-banner">
            This is the deployer's own wallet. Connect a different wallet &mdash; the demo requires
            two distinct wallets.
          </p>
        )}

        <p style={{ fontSize: "0.8rem", color: "#8fa3a0", marginTop: 16 }}>
          Starting the hunt requests camera, location and compass access. On iOS these can only be
          granted from a tap, which is what the button below is for.
        </p>

        <button
          className="primary-btn"
          style={{ marginTop: 8 }}
          disabled={!address || sameWallet || !legId}
          onClick={async () => {
            if (provider.kind === "device" && !permissionGranted) {
              const ok = await requestPermission();
              if (!ok) return;
            }
            setArmed(true);
          }}
        >
          START HUNT
        </button>
      </div>
    );
  }

  // ---------- armed: full-screen AR ----------
  const hunterPos = sample
    ? { lat: sample.lat, lng: sample.lng, alt: sample.alt ?? 0 }
    : { lat: 0, lng: 0, alt: 0 };

  const rungentPos =
    rungent?.in_range && rungent.lat !== null && rungent.lng !== null
      ? { lat: rungent.lat, lng: rungent.lng, alt: rungent.alt ?? 0 }
      : null;

  // A calibrated heading always wins: a desktop "compass" reading is either
  // absent or meaningless, and on a phone this lets the hunter correct drift.
  const effectiveHeading = manualHeading ?? (hasHeading ? sample?.headingDeg ?? 0 : 0);
  const aimTarget = rungentPos ?? devPos;

  return (
    <>
      <CameraFeed onError={setCamError} />
      <ARScene
        hunter={hunterPos}
        headingDeg={effectiveHeading}
        rungent={rungentPos}
        rungentHeadingDeg={rungent?.heading_deg ?? 0}
        mode={(rungent?.mode as any) ?? "walk"}
        locked={locked}
        down={rungent?.status === "down"}
        onTapRungent={() => setSpeech("You found me. That was the easy part.")}
      />
      <HUD
        distanceM={rungent?.distance_m ?? null}
        inRange={!!rungent?.in_range}
        hasGun={true}
        locked={locked}
        lockProgress={lockProgress}
        catchProgress={catchProgress}
        prizeAmount={leg?.prize_amount ?? "0"}
        rungentName={leg?.name ?? "RUNGENT"}
        down={rungent?.status === "down"}
        result={result}
        speech={speech}
        onFire={() => submitTakedown("shoot")}
        onCatchStart={handleCatchStart}
        onCatchEnd={handleCatchEnd}
      />
      <DownBurst active={burst} />
      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 88,
          zIndex: 26,
          width: 210,
          boxSizing: "border-box",
          display: "flex",
          gap: 6,
          alignItems: "center",
          background: "rgba(7,9,12,0.9)",
          border: "1px solid #1e2b28",
          borderRadius: 8,
          padding: "6px 8px",
        }}
      >
        <button style={calBtn} onClick={() => setCamHeading(effectiveHeading - 5)}>
          &#9664;
        </button>
        <span
          style={{ flex: 1, textAlign: "center", color: "#00E5FF", fontFamily: "monospace", fontSize: 11 }}
        >
          CAM {Math.round(effectiveHeading)}&deg;
        </span>
        <button style={calBtn} onClick={() => setCamHeading(effectiveHeading + 5)}>
          &#9654;
        </button>
        <button
          style={{ ...calBtn, color: aimTarget ? "#00FF6A" : "#3a4a47" }}
          disabled={!aimTarget}
          onClick={() => aimTarget && setCamHeading(bearingDeg(hunterPos, aimTarget))}
          title="Point the camera at the Rungent, then press to calibrate"
        >
          AIM
        </button>
      </div>
      <Minimap
        route={(leg?.route_polyline as any[]) ?? []}
        hunter={hunterPos}
        rungent={devPos}
        rangeM={ENGAGEMENT_RANGE_M}
        distanceM={rungent?.distance_m ?? (devPos ? haversineMeters(hunterPos, devPos) : null)}
      />
      {camError && (
        <div
          style={{
            position: "fixed",
            bottom: 120,
            left: 20,
            right: 20,
            zIndex: 20,
            background: "rgba(7,9,12,0.9)",
            border: "1px solid #FF2E9A",
            color: "#FF2E9A",
            padding: 12,
            borderRadius: 8,
            fontSize: 12,
          }}
        >
          {camError}
        </div>
      )}
      <button
        onClick={() => setArmed(false)}
        style={{
          position: "fixed",
          top: "calc(env(safe-area-inset-top, 12px) + 44px)",
          left: 16,
          zIndex: 20,
          background: "rgba(7,9,12,0.7)",
          border: "1px solid #2a3138",
          color: "#8fa3a0",
          borderRadius: 6,
          padding: "6px 10px",
          fontSize: 11,
        }}
      >
        EXIT
      </button>
    </>
  );
}
