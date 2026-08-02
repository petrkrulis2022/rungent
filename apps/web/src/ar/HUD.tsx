import { CATCH_RANGE_M } from "@rundown/shared";
import { useEffect, useRef, useState } from "react";

export type TakedownResult = { ok: boolean; message: string; txHash?: string } | null;

interface HUDProps {
  distanceM: number | null;
  inRange: boolean;
  hasGun: boolean;
  locked: boolean;
  lockProgress: number; // 0..1
  catchProgress: number; // 0..1
  prizeAmount: string;
  rungentName: string;
  down: boolean;
  result: TakedownResult;
  speech: string | null;
  onCloseSpeech: () => void;
  onFire: () => void;
  onCatchStart: () => void;
  onCatchEnd: () => void;
}

export function HUD(props: HUDProps) {
  const {
    distanceM,
    inRange,
    hasGun,
    locked,
    lockProgress,
    catchProgress,
    prizeAmount,
    rungentName,
    down,
    result,
    speech,
    onCloseSpeech,
    onFire,
    onCatchStart,
    onCatchEnd,
  } = props;

  const canCatch = inRange && distanceM !== null && distanceM <= CATCH_RANGE_M;

  return (
    <div style={S.root}>
      {/* top bar */}
      <div style={S.topBar}>
        <div style={S.brand}>RUNDOWN</div>
        <div style={S.prize}>{prizeAmount} USDC</div>
      </div>

      {/* target status */}
      <div style={S.status}>
        {down ? (
          <span style={{ ...S.statusText, color: "#FF2E9A" }}>RUNGENT DOWN</span>
        ) : !inRange ? (
          <span style={{ ...S.statusText, color: "#8fa3a0" }}>NO CONTACT — KEEP MOVING</span>
        ) : locked ? (
          <span style={{ ...S.statusText, color: "#FFB020" }}>TARGET LOCKED — {rungentName}</span>
        ) : (
          <span style={{ ...S.statusText, color: "#00E5FF" }}>CONTACT — {rungentName}</span>
        )}
        {inRange && distanceM !== null && (
          <div style={S.distance}>{distanceM.toFixed(0)} m</div>
        )}
      </div>

      {/* reticle — only ever locks onto the Rungent, never a person */}
      {!down && (
        <div style={S.reticleWrap}>
          <svg width="120" height="120" viewBox="0 0 120 120" style={{ overflow: "visible" }}>
            <circle
              cx="60"
              cy="60"
              r="42"
              fill="none"
              stroke={locked ? "#FFB020" : "#00E5FF"}
              strokeWidth="1.5"
              opacity={inRange ? 0.9 : 0.3}
            />
            {/* lock progress arc */}
            {inRange && (
              <circle
                cx="60"
                cy="60"
                r="42"
                fill="none"
                stroke="#FFB020"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - lockProgress)}`}
                transform="rotate(-90 60 60)"
              />
            )}
            {/* catch hold ring */}
            {catchProgress > 0 && (
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#00FF6A"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 52}`}
                strokeDashoffset={`${2 * Math.PI * 52 * (1 - catchProgress)}`}
                transform="rotate(-90 60 60)"
              />
            )}
            {["M60 10v14", "M60 96v14", "M10 60h14", "M96 60h14"].map((d, i) => (
              <path key={i} d={d} stroke={locked ? "#FFB020" : "#00E5FF"} strokeWidth="2" />
            ))}
          </svg>
        </div>
      )}

      {/* speech bubble */}
      {speech && !down && (
        <div style={S.speech}>
          <div style={S.speechHead}>
            <span style={S.speechName}>{rungentName}</span>
            <button style={S.speechClose} onClick={onCloseSpeech} aria-label="Close">
              &times;
            </button>
          </div>
          <div style={S.speechMeta}>
            {distanceM !== null ? `${Math.round(distanceM)} m away` : "distance unknown"}
            {" \u00B7 "}
            {prizeAmount} USDC
            {" \u00B7 "}
            {locked ? "LOCKED" : inRange ? "IN RANGE" : "NO CONTACT"}
          </div>
          <div>{speech}</div>
        </div>
      )}

      {/* result */}
      {result && (
        <div style={{ ...S.result, borderColor: result.ok ? "#00FF6A" : "#FF2E9A" }}>
          <div style={{ color: result.ok ? "#00FF6A" : "#FF2E9A", fontWeight: 700 }}>
            {result.ok ? "RUNGENT DOWN" : "REJECTED"}
          </div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{result.message}</div>
          {result.txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
              style={S.txLink}
            >
              {result.txHash.slice(0, 10)}…{result.txHash.slice(-8)} ↗
            </a>
          )}
        </div>
      )}

      {/* controls */}
      <div style={S.controls}>
        <button
          style={{
            ...S.catchBtn,
            opacity: canCatch && !down ? 1 : 0.35,
            borderColor: catchProgress > 0 ? "#00FF6A" : "#2a3138",
          }}
          disabled={!canCatch || down}
          onPointerDown={onCatchStart}
          onPointerUp={onCatchEnd}
          onPointerLeave={onCatchEnd}
        >
          HOLD TO CATCH
        </button>
        <button
          style={{
            ...S.fireBtn,
            opacity: hasGun && locked && !down ? 1 : 0.35,
          }}
          disabled={!hasGun || !locked || down}
          onClick={onFire}
        >
          FIRE
        </button>
      </div>

      {!hasGun && (
        <div style={S.gunHint}>Find the weapon pickup on the map to enable FIRE</div>
      )}
    </div>
  );
}

/** Green particle burst on a successful takedown. */
export function DownBurst({ active }: { active: boolean }) {
  const [particles] = useState(() =>
    Array.from({ length: 40 }, () => ({
      angle: Math.random() * Math.PI * 2,
      dist: 40 + Math.random() * 160,
      delay: Math.random() * 0.25,
      size: 3 + Math.random() * 5,
    }))
  );
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active && ref.current) {
      ref.current.style.animation = "none";
      void ref.current.offsetHeight;
      ref.current.style.animation = "";
    }
  }, [active]);

  if (!active) return null;
  return (
    <div ref={ref} style={S.burstWrap}>
      {particles.map((p, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "#00FF6A",
            boxShadow: "0 0 8px #00FF6A",
            animation: `burst 900ms ease-out ${p.delay}s forwards`,
            ["--tx" as any]: `${Math.cos(p.angle) * p.dist}px`,
            ["--ty" as any]: `${Math.sin(p.angle) * p.dist}px`,
          }}
        />
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  root: {
    position: "fixed",
    inset: 0,
    zIndex: 10,
    pointerEvents: "none",
    fontFamily: "ui-monospace, monospace",
    color: "#e8fdf3",
  },
  topBar: {
    position: "absolute",
    top: "env(safe-area-inset-top, 12px)",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "space-between",
    padding: "12px 16px",
  },
  brand: { color: "#00FF6A", fontWeight: 800, letterSpacing: "0.18em", fontSize: 14 },
  prize: {
    color: "#FFB020",
    fontSize: 13,
    border: "1px solid #FFB020",
    borderRadius: 999,
    padding: "2px 10px",
  },
  status: { position: "absolute", top: 56, left: 0, right: 0, textAlign: "center" },
  statusText: { fontSize: 12, letterSpacing: "0.2em" },
  distance: { fontSize: 30, fontWeight: 700, marginTop: 2, color: "#fff" },
  reticleWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  },
  speech: {
    position: "absolute",
    // clears the minimap and calibration panel stacked in the bottom-left
    bottom: 345,
    pointerEvents: "auto",
    left: 20,
    right: 20,
    background: "rgba(7,9,12,0.86)",
    border: "1px solid #00E5FF",
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13,
    lineHeight: 1.5,
  },
  speechHead: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  speechName: {
    color: "#00E5FF",
    fontSize: 10,
    letterSpacing: "0.2em",
    marginBottom: 4,
  },
  speechClose: {
    background: "transparent",
    border: "none",
    color: "#8fa3a0",
    fontSize: 20,
    lineHeight: 1,
    cursor: "pointer",
    padding: "0 4px",
  },
  speechMeta: {
    color: "#8fa3a0",
    fontSize: 11,
    fontFamily: "monospace",
    marginBottom: 6,
  },
  result: {
    position: "absolute",
    top: "38%",
    left: 24,
    right: 24,
    background: "rgba(7,9,12,0.92)",
    border: "1px solid",
    borderRadius: 10,
    padding: 16,
    textAlign: "center",
    pointerEvents: "auto",
  },
  txLink: {
    display: "inline-block",
    marginTop: 8,
    color: "#00E5FF",
    fontSize: 11,
    textDecoration: "none",
  },
  controls: {
    position: "absolute",
    bottom: "calc(env(safe-area-inset-bottom, 16px) + 24px)",
    left: 0,
    right: 0,
    display: "flex",
    gap: 14,
    justifyContent: "center",
    padding: "0 20px",
  },
  catchBtn: {
    pointerEvents: "auto",
    flex: 1,
    maxWidth: 190,
    background: "rgba(7,9,12,0.8)",
    border: "2px solid #2a3138",
    color: "#00FF6A",
    padding: "16px 12px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "0.1em",
    touchAction: "none",
  },
  fireBtn: {
    pointerEvents: "auto",
    flex: 1,
    maxWidth: 130,
    background: "#FF2E9A",
    border: "none",
    color: "#07090C",
    padding: "16px 12px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.1em",
  },
  gunHint: {
    position: "absolute",
    bottom: "calc(env(safe-area-inset-bottom, 16px) + 96px)",
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 11,
    color: "#8fa3a0",
  },
  burstWrap: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 0,
    height: 0,
    zIndex: 12,
  },
};
