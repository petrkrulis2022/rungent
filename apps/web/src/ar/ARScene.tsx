import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Rungent } from "./Rungent";
import { geoToScene, headingToWorldRotation, easeTowards } from "./anchoring";
import type { LatLng } from "@rundown/shared";

interface Props {
  hunter: LatLng & { alt?: number };
  headingDeg: number;
  rungent: (LatLng & { alt?: number }) | null;
  rungentHeadingDeg: number;
  mode: "idle" | "walk" | "run";
  locked: boolean;
  down: boolean;
  /** Camera height above the ground the Rungent walks on. */
  eyeHeightM: number;
  /** Downward tilt of the camera, positive when looking down at the street. */
  pitchDeg: number;
  /**
   * Place the Rungent straight ahead at its true distance instead of on its
   * real bearing. Some handsets expose no orientation to the browser at all,
   * leaving nothing to anchor a bearing against; distance and scale stay
   * honest, only the direction is surrendered.
   */
  faceForward: boolean;
  /**
   * Where the Rungent lands on screen, so the DOM can draw a marker for it.
   * At the far end of engagement range the figure is only a few pixels tall
   * and is effectively impossible to find by eye.
   */
  onScreenPos?: (p: { xPct: number; yPct: number; onScreen: boolean } | null) => void;
  onTapRungent: () => void;
}

/**
 * The world group is rotated by the compass heading so that scene-north aligns
 * with true north. Rotating the world rather than the camera keeps the camera
 * at identity, which makes screen-space raycasting (tap-to-interact, aim
 * reticle) straightforward.
 */
function World({ hunter, headingDeg, rungent, rungentHeadingDeg, mode, locked, down, eyeHeightM, pitchDeg, faceForward, onScreenPos, onTapRungent }: Props) {
  const worldRef = useRef<THREE.Group>(null);
  const pitchRef = useRef<THREE.Group>(null);
  const smoothPos = useRef<{ x: number; y: number; z: number } | null>(null);
  const projected = useRef(new THREE.Vector3());
  const lastReport = useRef(0);

  const placement = rungent ? geoToScene(hunter, rungent, eyeHeightM) : null;
  const scenePos = placement
    ? faceForward
      ? { x: 0, y: placement.y, z: -placement.distanceM }
      : { x: placement.x, y: placement.y, z: placement.z }
    : null;

  useFrame(({ camera }, dt) => {
    if (pitchRef.current) {
      // Tilting the world up is what a camera angled down at the street sees.
      pitchRef.current.rotation.x = (pitchDeg * Math.PI) / 180;
    }
    if (onScreenPos && worldRef.current && pitchRef.current) {
      const now = performance.now();
      // Throttled: this drives React state, and a per-frame update would
      // re-render the whole HUD sixty times a second for no visible gain.
      if (now - lastReport.current > 80) {
        lastReport.current = now;
        const p = smoothPos.current;
        if (!p) {
          onScreenPos(null);
        } else {
          // Mirror the group nesting: heading inside, pitch outside.
          projected.current.set(p.x, p.y + 1.0, p.z);
          projected.current.applyEuler(new THREE.Euler(0, worldRef.current.rotation.y, 0));
          projected.current.applyEuler(new THREE.Euler(pitchRef.current.rotation.x, 0, 0));
          projected.current.project(camera);
          const behind = projected.current.z > 1;
          const xPct = ((projected.current.x + 1) / 2) * 100;
          const yPct = ((1 - projected.current.y) / 2) * 100;
          onScreenPos({
            xPct: behind ? 100 - xPct : xPct,
            yPct,
            onScreen: !behind && xPct > 2 && xPct < 98 && yPct > 2 && yPct < 98,
          });
        }
      }
    }
    if (worldRef.current) {
      const target = faceForward ? 0 : headingToWorldRotation(headingDeg);
      const cur = worldRef.current.rotation.y;
      const diff = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      // ease rather than snap; the heading is already low-pass filtered but
      // GPS-driven position changes still arrive in steps
      worldRef.current.rotation.y = cur + diff * Math.min(1, dt * 6);
    }
  });

  // visual smoothing of the anchored position (server truth is unaffected)
  if (scenePos) {
    const target = { x: scenePos.x, y: scenePos.y, z: scenePos.z };
    smoothPos.current = smoothPos.current
      ? easeTowards(smoothPos.current, target, 0.08)
      : target;
  } else {
    smoothPos.current = null;
  }

  // Pitch is applied outside heading so the two compose as tilt-after-turn
  // rather than skewing the horizon as the hunter rotates.
  return (
    <group ref={pitchRef}>
      <group ref={worldRef}>
        <ambientLight intensity={0.6} />
        {smoothPos.current && (
          <Rungent
            position={[smoothPos.current.x, smoothPos.current.y, smoothPos.current.z]}
            headingDeg={rungentHeadingDeg}
            mode={mode}
            locked={locked}
            down={down}
            onTap={onTapRungent}
          />
        )}
      </group>
    </group>
  );
}

export function ARScene(props: Props) {
  return (
    <Canvas
      style={{ position: "fixed", inset: 0, zIndex: 1 }}
      gl={{ alpha: true, antialias: true }}
      camera={{ fov: 70, near: 0.1, far: 1000, position: [0, 0, 0] }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <World {...props} />
    </Canvas>
  );
}
