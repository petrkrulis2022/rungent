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
  onTapRungent: () => void;
}

/**
 * The world group is rotated by the compass heading so that scene-north aligns
 * with true north. Rotating the world rather than the camera keeps the camera
 * at identity, which makes screen-space raycasting (tap-to-interact, aim
 * reticle) straightforward.
 */
function World({ hunter, headingDeg, rungent, rungentHeadingDeg, mode, locked, down, eyeHeightM, pitchDeg, onTapRungent }: Props) {
  const worldRef = useRef<THREE.Group>(null);
  const pitchRef = useRef<THREE.Group>(null);
  const smoothPos = useRef<{ x: number; y: number; z: number } | null>(null);

  const placement = rungent ? geoToScene(hunter, rungent, eyeHeightM) : null;
  const scenePos = placement
    ? { x: placement.x, y: placement.y, z: placement.z }
    : null;

  useFrame((_, dt) => {
    if (pitchRef.current) {
      // Tilting the world up is what a camera angled down at the street sees.
      pitchRef.current.rotation.x = (pitchDeg * Math.PI) / 180;
    }
    if (worldRef.current) {
      const target = headingToWorldRotation(headingDeg);
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
