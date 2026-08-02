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
import { CanvasBoundary } from "../ar/CanvasBoundary";

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

function CalRow({
  label,
  value,
  onDown,
  onUp,
  extra,
}: {
  label: string;
  value: string;
  onDown: () => void;
  onUp: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
      <span style={{ width: 30, color: "#8fa3a0", fontFamily: "monospace", fontSize: 10 }}>
        {label}
      </span>
      <button style={calBtn} onClick={onDown}>
        &#8722;
      </button>
      <span
        style={{ flex: 1, textAlign: "center", color: "#00E5FF", fontFamily: "monospace", fontSize: 11 }}
      >
        {value}
      </span>
      <button style={calBtn} onClick={onUp}>
        +
      </button>
      {extra}
    </div>
  );
}

interface Props {
  onBack: () => void;
  legId?: string | null;
}

export function HunterView({ onBack, legId }: Props) {
  const { address, connecting, error: walletError, connect } = useWallet();
  const { sample, permissionGranted, requestPermission, provider, hasHeading, relHeading, geoError } =
    useGeo();

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
  const [screenPos, setScreenPos] = useState<{
    xPct: number;
    yPct: number;
    onScreen: boolean;
  } | null>(null);
  const [frameTick, setFrameTick] = useState(0);
  const [arming, setArming] = useState(false);
  const [armError, setArmError] = useState<string | null>(null);

  // A laptop has no compass, so nothing tells us which way the camera actually
  // points — assuming true north puts the Rungent at a fixed wrong angle (it
  // appears to approach from behind). The hunter calibrates once; a webcam
  // does not move, so the value is worth persisting per device.
  const [manualHeading, setManualHeading] = useState<number | null>(() => {
    const v = localStorage.getItem("rundown.camHeading");
    return v === null ? null : Number(v);
  });
  // Where the device's relative rotation stood when the heading was last
  // pinned. Not persisted: the relative origin is reassigned on every page
  // load, so a stored value would be meaningless.
  const [refRel, setRefRel] = useState<number | null>(null);

  // Whether to give up on bearings and simply put the Rungent ahead. Left
  // undecided until the device has had a moment to prove it reports
  // orientation at all, because a handset that reports none can only ever
  // point the scene in one arbitrary direction.
  const [frontMode, setFrontMode] = useState<boolean | null>(() => {
    const v = localStorage.getItem("rundown.frontMode");
    return v === null ? null : v === "1";
  });
  const chooseFrontMode = (on: boolean) => {
    localStorage.setItem("rundown.frontMode", on ? "1" : "0");
    setFrontMode(on);
  };
  const front = frontMode ?? false;

  const clearCamHeading = () => {
    localStorage.removeItem("rundown.camHeading");
    setManualHeading(null);
    setRefRel(null);
  };
  const setCamHeading = (deg: number) => {
    const d = ((deg % 360) + 360) % 360;
    localStorage.setItem("rundown.camHeading", String(d));
    setManualHeading(d);
    setRefRel(relHeading);
  };

  // Height of the camera above the ground the Rungent walks on, and how far it
  // tilts down. Shooting from an upstairs window is the common case and both
  // differ wildly from the standing-in-the-street assumption of 1.6m/level.
  const [camHeight, setCamHeightState] = useState<number>(
    () => Number(localStorage.getItem("rundown.camHeight") ?? 1.6)
  );
  const [camPitch, setCamPitchState] = useState<number>(
    () => Number(localStorage.getItem("rundown.camPitch") ?? 0)
  );
  const setCamHeight = (m: number) => {
    const v = Math.max(0, Math.min(60, Math.round(m * 10) / 10));
    localStorage.setItem("rundown.camHeight", String(v));
    setCamHeightState(v);
  };
  const setCamPitch = (d: number) => {
    const v = Math.max(-45, Math.min(60, Math.round(d)));
    localStorage.setItem("rundown.camPitch", String(v));
    setCamPitchState(v);
  };

  useEffect(() => {
    if (manualHeading !== null && refRel === null && relHeading !== null) {
      setRefRel(relHeading);
    }
  }, [manualHeading, refRel, relHeading]);

  useEffect(() => {
    if (frontMode !== null) return;
    const t = setTimeout(() => {
      setFrontMode(!hasHeading && relHeading === null);
    }, 3000);
    return () => clearTimeout(t);
  }, [frontMode, hasHeading, relHeading]);

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

        {armError && <p className="warn-banner">{armError}</p>}

        <button
          className="primary-btn"
          style={{ marginTop: 8 }}
          disabled={!address || sameWallet || !legId || arming}
          onClick={async () => {
            setArmError(null);
            if (provider.kind === "device" && !permissionGranted) {
              // Waiting on a GPS fix can take many seconds, during which the
              // button previously gave no sign it had been pressed at all.
              setArming(true);
              const ok = await requestPermission();
              setArming(false);
              if (!ok) {
                setArmError(geoError ?? "Location or motion access was refused.");
                return;
              }
            }
            setArmed(true);
          }}
        >
          {arming ? "Waiting for GPS..." : "START HUNT"}
        </button>

        {!address && <p className="warn-banner">Connect a wallet first.</p>}
        {!legId && (
          <p className="warn-banner">No leg in the link, so there is nothing to hunt.</p>
        )}
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

  // A true compass wins where one exists. Otherwise a single calibration is
  // carried forward on the device's relative rotation, which knows nothing of
  // north but tracks turning accurately -- so the hunter pins the direction
  // once and can then turn on the spot as they would with a real compass.
  const debugOn = new URLSearchParams(window.location.search).has("debug");
  const effectiveHeading =
    manualHeading === null
      ? hasHeading
        ? sample?.headingDeg ?? 0
        : 0
      : relHeading !== null && refRel !== null
        ? (((manualHeading + (relHeading - refRel)) % 360) + 360) % 360
        : manualHeading;
  const aimTarget = rungentPos ?? devPos;

  return (
    <>
      <CameraFeed onError={setCamError} />
      <CanvasBoundary>
      <ARScene
        hunter={hunterPos}
        headingDeg={effectiveHeading}
        rungent={rungentPos}
        rungentHeadingDeg={rungent?.heading_deg ?? 0}
        mode={(rungent?.mode as any) ?? "walk"}
        locked={locked}
        down={rungent?.status === "down"}
        eyeHeightM={camHeight}
        pitchDeg={camPitch}
        faceForward={front}
        onScreenPos={(p) => {
          setScreenPos(p);
          if (debugOn) setFrameTick((t) => t + 1);
        }}
        onTapRungent={() => setSpeech("You found me. That was the easy part.")}
      />
      </CanvasBoundary>
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
        onCloseSpeech={() => setSpeech(null)}
        onFire={() => submitTakedown("shoot")}
        onCatchStart={handleCatchStart}
        onCatchEnd={handleCatchEnd}
      />
      <DownBurst active={burst} />
      {screenPos && rungent?.status !== "down" && (
        <div
          style={{
            position: "fixed",
            left: `${Math.min(96, Math.max(4, screenPos.xPct))}%`,
            top: `${Math.min(92, Math.max(8, screenPos.yPct))}%`,
            transform: "translate(-50%, -50%)",
            zIndex: 24,
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: screenPos.onScreen ? 44 : 30,
              height: screenPos.onScreen ? 44 : 30,
              margin: "0 auto",
              borderRadius: "50%",
              border: `2px solid ${locked ? "#FFB020" : "#00FF6A"}`,
              boxShadow: `0 0 12px ${locked ? "#FFB020" : "#00FF6A"}`,
              opacity: screenPos.onScreen ? 0.85 : 0.5,
            }}
          />
          <div
            style={{
              marginTop: 3,
              font: "11px/1 monospace",
              color: locked ? "#FFB020" : "#00FF6A",
              textShadow: "0 0 4px #000, 0 0 4px #000",
            }}
          >
            {rungent?.distance_m != null ? `${Math.round(rungent.distance_m)}m` : ""}
            {!screenPos.onScreen && " \u2192 turn"}
          </div>
        </div>
      )}
      {debugOn && (
        <pre
          style={{
            position: "fixed",
            top: 54,
            right: 8,
            zIndex: 30,
            margin: 0,
            padding: "6px 8px",
            background: "rgba(7,9,12,0.9)",
            border: "1px solid #1e2b28",
            borderRadius: 6,
            color: "#8fa3a0",
            font: "10px/1.45 monospace",
            maxWidth: 190,
            whiteSpace: "pre-wrap",
          }}
        >
          {[
            `geo      ${provider.kind}`,
            `perm     ${permissionGranted}`,
            `compass  ${hasHeading ? "yes" : "NO"}`,
            `raw hdg  ${sample?.headingDeg?.toFixed(0) ?? "-"}`,
            `manual   ${manualHeading ?? "-"}`,
            `rel/ref  ${relHeading?.toFixed(0) ?? "-"}/${refRel?.toFixed(0) ?? "-"}`,
            `using    ${Math.round(effectiveHeading)}`,
            `acc      ${sample?.accuracyM?.toFixed(0) ?? "-"} m`,
            `inRange  ${rungent?.in_range ?? "-"}`,
            `dist     ${rungent?.distance_m?.toFixed(0) ?? "-"} m`,
            `bearing  ${aimTarget ? Math.round(bearingDeg(hunterPos, aimTarget)) : "-"}`,
            `view     ${front ? "FRONT" : "GEO"}`,
            `frames   ${frameTick}`,
            `marker   ${screenPos ? `${screenPos.xPct.toFixed(0)},${screenPos.yPct.toFixed(0)} ${screenPos.onScreen ? "on" : "off"}` : "null"}`,
          ].join("\n")}
        </pre>
      )}
      <div
        style={{
          position: "fixed",
          left: 12,
          bottom: 60,
          zIndex: 26,
          width: 210,
          boxSizing: "border-box",
          background: "rgba(7,9,12,0.9)",
          border: "1px solid #1e2b28",
          borderRadius: 8,
          padding: "6px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <CalRow
          label="CAM"
          value={`${Math.round(effectiveHeading)}\u00B0`}
          onDown={() => setCamHeading(effectiveHeading - 5)}
          onUp={() => setCamHeading(effectiveHeading + 5)}
          extra={
            <>
              <button
                style={{ ...calBtn, color: aimTarget ? "#00FF6A" : "#3a4a47" }}
                disabled={!aimTarget}
                onClick={() => aimTarget && setCamHeading(bearingDeg(hunterPos, aimTarget))}
                title="Centre the Rungent in view, then press to calibrate"
              >
                AIM
              </button>
              <button
                style={{ ...calBtn, color: manualHeading === null ? "#3a4a47" : "#FFB020" }}
                disabled={manualHeading === null}
                onClick={clearCamHeading}
                title="Hand heading back to the device compass"
              >
                AUTO
              </button>
            </>
          }
        />
        <CalRow
          label="HGT"
          value={`${camHeight.toFixed(1)}m`}
          onDown={() => setCamHeight(camHeight - 0.5)}
          onUp={() => setCamHeight(camHeight + 0.5)}
        />
        <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ width: 30, color: "#8fa3a0", fontFamily: "monospace", fontSize: 10 }}>
            VIEW
          </span>
          <button
            style={{ ...calBtn, flex: 1, color: front ? "#8fa3a0" : "#00E5FF" }}
            onClick={() => chooseFrontMode(false)}
            title="Anchor the Rungent to its real compass bearing"
          >
            GEO
          </button>
          <button
            style={{ ...calBtn, flex: 1, color: front ? "#00FF6A" : "#8fa3a0" }}
            onClick={() => chooseFrontMode(true)}
            title="Always place the Rungent straight ahead at its true distance"
          >
            FRONT
          </button>
        </div>
        <CalRow
          label="TILT"
          value={`${camPitch}\u00B0`}
          onDown={() => setCamPitch(camPitch - 5)}
          onUp={() => setCamPitch(camPitch + 5)}
        />
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
