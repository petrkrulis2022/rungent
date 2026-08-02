import { useRef, useMemo, useEffect, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import * as THREE from "three";

/**
 * Drop any rigged GLB in apps/web/public/models/ and point this at it; the
 * procedural figure below is used whenever it is unset, so the game runs with
 * no asset at all. Kept as config rather than an import so swapping the
 * character never needs a code change.
 */
const MODEL_URL = (import.meta.env.VITE_RUNGENT_MODEL_URL as string | undefined) ?? "";
/** Re-skin a downloaded model in the hologram shader instead of its own textures. */
const HOLOGRAM_SKIN = import.meta.env.VITE_RUNGENT_HOLOGRAM === "1";
const TARGET_HEIGHT_M = 1.8;

if (MODEL_URL) useGLTF.preload(MODEL_URL);

/**
 * The Rungent's holographic look.
 *
 * Fresnel rim in cyan over an emissive green core, with a vertical scanline
 * shimmer and a downward fade so the figure reads as projected light rather
 * than solid geometry. Written as a raw ShaderMaterial because the effect
 * needs view-direction data that the standard materials don't expose.
 */
function useHologramMaterial(color: string, rim: string) {
  return useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uRim: { value: new THREE.Color(rim) },
        uOpacity: { value: 1 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying vec3 vPosLocal;
        void main() {
          vPosLocal = position;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalW = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColor;
        uniform vec3 uRim;
        uniform float uOpacity;
        varying vec3 vNormalW;
        varying vec3 vViewDir;
        varying vec3 vPosLocal;

        void main() {
          // fresnel rim: bright where the surface turns away from the viewer
          float fres = pow(1.0 - clamp(dot(normalize(vNormalW), normalize(vViewDir)), 0.0, 1.0), 2.2);

          // horizontal scanlines drifting upward
          float scan = 0.5 + 0.5 * sin(vPosLocal.y * 46.0 - uTime * 3.4);
          scan = mix(0.72, 1.0, scan);

          // occasional glitch band
          float band = smoothstep(0.965, 1.0, sin(vPosLocal.y * 3.0 + uTime * 1.6));

          vec3 col = mix(uColor, uRim, fres * 0.85);
          col *= scan;
          col += uRim * band * 0.55;

          float alpha = (0.30 + fres * 0.85) * uOpacity;
          alpha *= smoothstep(-1.05, -0.55, vPosLocal.y) * 0.5 + 0.5;

          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
  }, [color, rim]);
}

/**
 * Procedural humanoid built from primitives.
 *
 * Deliberate: it means the demo renders correctly with ZERO downloaded
 * assets, so nothing blocks on sourcing a rigged GLB. Swap in a Mixamo model
 * later by passing `glbUrl` — the holographic material and the walk cycle
 * below are written to apply to either.
 */
function ProceduralRunner({
  material,
  mode,
}: {
  material: THREE.ShaderMaterial;
  mode: "idle" | "walk" | "run";
}) {
  const leftLeg = useRef<THREE.Mesh>(null);
  const rightLeg = useRef<THREE.Mesh>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const speed = mode === "run" ? 9 : mode === "walk" ? 5 : 0.8;
    const amp = mode === "run" ? 0.85 : mode === "walk" ? 0.5 : 0.06;
    const swing = Math.sin(t * speed) * amp;

    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (leftArm.current) leftArm.current.rotation.x = -swing * 0.8;
    if (rightArm.current) rightArm.current.rotation.x = swing * 0.8;
  });

  return (
    <group>
      {/* head */}
      <mesh position={[0, 1.62, 0]} material={material}>
        <sphereGeometry args={[0.13, 20, 16]} />
      </mesh>
      {/* torso */}
      <mesh position={[0, 1.18, 0]} material={material}>
        <capsuleGeometry args={[0.15, 0.42, 6, 14]} />
      </mesh>
      {/* hips */}
      <mesh position={[0, 0.9, 0]} material={material}>
        <capsuleGeometry args={[0.14, 0.1, 6, 12]} />
      </mesh>
      {/* arms — pivot at the shoulder so rotation reads correctly */}
      <group position={[-0.24, 1.38, 0]}>
        <mesh ref={leftArm} position={[0, -0.26, 0]} material={material}>
          <capsuleGeometry args={[0.055, 0.44, 5, 10]} />
        </mesh>
      </group>
      <group position={[0.24, 1.38, 0]}>
        <mesh ref={rightArm} position={[0, -0.26, 0]} material={material}>
          <capsuleGeometry args={[0.055, 0.44, 5, 10]} />
        </mesh>
      </group>
      {/* legs — pivot at the hip */}
      <group position={[-0.1, 0.85, 0]}>
        <mesh ref={leftLeg} position={[0, -0.4, 0]} material={material}>
          <capsuleGeometry args={[0.07, 0.6, 5, 10]} />
        </mesh>
      </group>
      <group position={[0.1, 0.85, 0]}>
        <mesh ref={rightLeg} position={[0, -0.4, 0]} material={material}>
          <capsuleGeometry args={[0.07, 0.6, 5, 10]} />
        </mesh>
      </group>
    </group>
  );
}

interface RungentProps {
  position: [number, number, number];
  headingDeg: number;
  mode: "idle" | "walk" | "run";
  locked?: boolean;
  down?: boolean;
  onTap?: () => void;
}

/**
 * A downloaded character — Mixamo, Quaternius, Ready Player Me and friends all
 * export wildly different units (Mixamo is often centimetres) and clip names,
 * so the model is scaled to a real human height rather than trusted, and the
 * walk/run clips are matched by name. That way a new character is a file swap.
 */
function GltfRunner({
  url,
  mode,
  skin,
}: {
  url: string;
  mode: "idle" | "walk" | "run";
  skin: THREE.ShaderMaterial | null;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, group);

  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const h = box.max.y - box.min.y;
    return h > 0 ? TARGET_HEIGHT_M / h : 1;
  }, [scene]);

  useEffect(() => {
    if (!skin) return;
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.material = skin;
    });
  }, [scene, skin]);

  useEffect(() => {
    if (names.length === 0) return;
    const find = (want: string[]) =>
      names.find((n) => want.some((w) => n.toLowerCase().includes(w)));
    const runClip = find(["run", "jog", "sprint"]);
    const walkClip = find(["walk"]);
    const name =
      mode === "run"
        ? runClip ?? walkClip ?? names[0]
        : mode === "walk"
          ? walkClip ?? names[0]
          : find(["idle", "stand"]) ?? walkClip ?? names[0];

    const action = actions[name];
    if (!action) return;
    // a character that only ships a walk can still run, just faster
    action.timeScale = mode === "run" && !runClip ? 1.8 : 1;
    action.reset().fadeIn(0.2).play();
    return () => {
      action.fadeOut(0.2);
    };
  }, [actions, names, mode]);

  return (
    <group ref={group} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

export function Rungent({ position, headingDeg, mode, locked, down, onTap }: RungentProps) {
  const groupRef = useRef<THREE.Group>(null);
  const material = useHologramMaterial(down ? "#FF2E9A" : "#00FF6A", locked ? "#FFB020" : "#00E5FF");

  useFrame((state, dt) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    // fade out when downed
    const targetOpacity = down ? 0.15 : 1;
    material.uniforms.uOpacity.value +=
      (targetOpacity - material.uniforms.uOpacity.value) * Math.min(1, dt * 2);

    if (groupRef.current) {
      // face the committed heading; ease so compass jitter doesn't spin it
      const target = -(headingDeg * Math.PI) / 180;
      const cur = groupRef.current.rotation.y;
      const diff = ((target - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      groupRef.current.rotation.y = cur + diff * Math.min(1, dt * 4);
      // slight bob so it never looks frozen
      groupRef.current.position.y =
        position[1] + (down ? 0 : Math.sin(state.clock.elapsedTime * 2) * 0.02);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onTap?.();
      }}
    >
      <Suspense fallback={<ProceduralRunner material={material} mode={down ? "idle" : mode} />}>
        {MODEL_URL ? (
          <GltfRunner
            url={MODEL_URL}
            mode={down ? "idle" : mode}
            skin={HOLOGRAM_SKIN ? material : null}
          />
        ) : (
          <ProceduralRunner material={material} mode={down ? "idle" : mode} />
        )}
      </Suspense>
      {/* soft contact shadow / ground glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial
          color={down ? "#FF2E9A" : "#00FF6A"}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      {/* invisible larger hit target — tapping a thin figure on a phone is hard */}
      <mesh position={[0, 1, 0]} visible={false}>
        <boxGeometry args={[0.9, 2, 0.9]} />
      </mesh>
    </group>
  );
}
