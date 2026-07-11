import React, { Canvas, useFrame } from "@react-three/fiber";
import { AmbientLight, DirectionalLight } from "three";
import { Sphere, Cylinder, Text, useGLTF } from "@react-three/drei";
import ReactThreeFiber, { useState, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";

/**
 * Custom Holographic Shader Material
 * Renders emissive green fresnel rim-glow, scanlines, and fluctuations.
 */
const HolographicMaterial = () => {
    const uniforms = useMemo(
        () => ({
            uTime: { value: 0 },
            uGlowColor: { value: new THREE.Color("#00FF6A") },
            uRimPower: { value: 2.0 }
        }),
        []
    );

    useFrame((state) => {
        uniforms.uTime.value = state.clock.getElapsedTime();
    });

    return (
        <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={uniforms}
            vertexShader={`
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vViewPosition = -mvPosition.xyz;
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * mvPosition;
        }
      `}
            fragmentShader={`
        uniform float uTime;
        uniform vec3 uGlowColor;
        uniform float uRimPower;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        varying vec3 vWorldPosition;
        void main() {
          vec3 normal = normalize(vNormal);
          vec3 viewDir = normalize(vViewPosition);

          // Fresnel Rim Light Effect
          float intensity = pow(1.0 - max(dot(viewDir, normal), 0.0), uRimPower);
          
          // Horizontal Holographic Scanlines
          float scanline = sin(vWorldPosition.y * 35.0 + uTime * 6.0) * 0.15 + 0.85;
          
          // Flicker / Fluctuations
          float flicker = sin(uTime * 85.0) * 0.03 + 0.97;

          float alpha = intensity * 0.7 * scanline * flicker;
          vec3 finalColor = uGlowColor * (intensity * 1.5 + 0.3) * scanline;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `}
        />
    );
};

/**
 * Holographic Rungent Runner Model
 */
const RungentRunner = ({ position, heading, isWalking, speed }) => {
    const meshRef = useRef();

    useFrame((state) => {
        if (meshRef.current) {
            // Gentle floating/levitation offset
            meshRef.current.position.y = position[1] + Math.sin(state.clock.getElapsedTime() * 2.0) * 0.05;

            // Rotate heading angle (heading_deg in degrees -> convert to radians)
            // Standard game convention: heading of 0 is North (negative Z).
            const headingRad = (heading * Math.PI) / 180;
            meshRef.current.rotation.y = headingRad;
        }
    });

    return (
        <group ref={meshRef} position={[position[0], position[1], position[2]]}>
            {/* Visual Avatar Geometry (Capsule torso + limbs mockup for demo) */}
            <mesh position={[0, 0.9, 0]}>
                <cylinderGeometry args={[0.25, 0.25, 1.2, 16]} />
                <HolographicMaterial />
            </mesh>

            {/* Head */}
            <mesh position={[0, 1.7, 0]}>
                <sphereGeometry args={[0.2, 16, 16]} />
                <HolographicMaterial />
            </mesh>

            {/* Direction Pointer / Facing visual cue */}
            <mesh position={[0, 1.1, 0.35]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.02, 0.1, 0.4, 8]} />
                <meshStandardMaterial color="#00ff6a" emissive="#00ff6a" />
            </mesh>

            {/* Orbit particles */}
            {[...Array(6)].map((_, i) => {
                const angle = (i / 6) * Math.PI * 2;
                return (
                    <OrbitingParticle key={i} angle={angle} radius={0.65} height={0.5 + (i * 0.2)} />
                );
            })}
        </group>
    );
};

const OrbitingParticle = ({ angle, radius, height }) => {
    const ref = useRef();

    useFrame((state) => {
        if (ref.current) {
            const time = state.clock.getElapsedTime();
            const currentAngle = angle + time * 1.5;
            ref.current.position.x = Math.cos(currentAngle) * radius;
            ref.current.position.z = Math.sin(currentAngle) * radius;
        }
    });

    return (
        <mesh ref={ref} position={[0, height, 0]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color="#00E5FF" transparent opacity={0.8} />
        </mesh>
    );
};

/**
 * Hunter Avatar (Rendered for other players)
 */
const HunterAvatar = ({ position }) => {
    return (
        <group position={position}>
            {/* Small cyan beacon shape */}
            <mesh position={[0, 0.8, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 0.8, 8]} />
                <meshStandardMaterial color="#00E5FF" transparent opacity={0.6} wireframe />
            </mesh>
            <mesh position={[0, 1.3, 0]}>
                <sphereGeometry args={[0.12, 8, 8]} />
                <meshBasicMaterial color="#00E5FF" />
            </mesh>
        </group>
    );
};

/**
 * Main 3D Canvas Scene
 */
export default function AR3DScene({
    rungent,
    hunterGps,
    activeLeg,
    hunters = [],
    shootGun,
    onInteract
}) {
    const [rungentCoords, setRungentCoords] = useState([0, 0, -3]); // Relative X, Y, Z
    const [relativeHunters, setRelativeHunters] = useState([]);

    // Calculate relative coordinate vectors: GPS coordinates onto meters
    // 1 degree latitude = 111,139 meters. 1 degree longitude = 111,139 * cos(lat) meters.
    useEffect(() => {
        if (!hunterGps || !rungent) return;

        const latMeters = (rungent.lat - hunterGps.lat) * 111139;
        const lngMeters = (rungent.lng - hunterGps.lng) * 111139 * Math.cos((hunterGps.lat * Math.PI) / 180);

        // Threejs coordinates:
        // +X is East, -X is West.
        // -Z is North, +Z is South.
        // Y is relative elevation height.
        const x = lngMeters;
        const z = -latMeters; // Negative Z because North is -Z
        const y = rungent.alt - hunterGps.alt; // Difference in height

        setRungentCoords([x, y, z]);
        console.log(`📡 Rungent relative AR coordinates: [X: ${x.toFixed(1)}m, Y: ${y.toFixed(1)}m, Z: ${z.toFixed(1)}m]`);

        // Process other hunters
        const relHunters = hunters
            .filter((h) => h.wallet !== hunterGps.wallet)
            .map((h, i) => {
                const hX = (h.lat - hunterGps.lat) * 111139;
                const hZ = -(h.lng - hunterGps.lng) * 111139 * Math.cos((hunterGps.lat * Math.PI) / 180);
                return {
                    id: h.wallet || i,
                    position: [hX, h.alt - hunterGps.alt, hZ]
                };
            });
        setRelativeHunters(relHunters);
    }, [rungent, hunterGps, hunters]);

    const rawDistance = useMemo(() => {
        return Math.sqrt(
            rungentCoords[0] ** 2 +
            rungentCoords[1] ** 2 +
            rungentCoords[2] ** 2
        );
    }, [rungentCoords]);

    return (
        <div
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                zIndex: 10,
                pointerEvents: "none" // Pass clicks to video beneath except for click triggers
            }}
        >
            {/* AR HUD Overlay details */}
            <div
                className="cyber-panel cyber-panel-green"
                style={{
                    position: "absolute",
                    top: "16px",
                    right: "16px",
                    padding: "12px",
                    color: "#fff",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    pointerEvents: "auto",
                    width: "220px",
                    zIndex: 50
                }}
            >
                <div style={{ color: "hsl(var(--neon-green))", fontWeight: "bold", marginBottom: "4px" }}>
                    📡 TARGET ACQUISITION
                </div>
                <div>Range: {rawDistance.toFixed(1)}m</div>
                <div>Mode: {rungent?.mode?.toUpperCase() || "WALK"}</div>
                <div>Speed: {rungent?.speed?.toFixed(1) || 0} km/h</div>
                <div style={{ marginTop: "6px", color: "hsl(var(--neon-cyan))" }}>
                    Direction: {rungent?.heading?.toFixed(0)}°
                </div>
            </div>

            <Canvas
                camera={{
                    position: [0, 1.6, 0], // Camera of hunter is placed at eye level 1.6m
                    fov: 70,
                    near: 0.1,
                    far: 1000
                }}
                style={{
                    width: "100%",
                    height: "100%",
                    pointerEvents: "auto" // Allow 3D canvas tap detections
                }}
                onCreated={({ gl }) => {
                    gl.alpha = true;
                    gl.setClearColor(0x000000, 0); // Transparent 3D layer for AR camera backing
                }}
            >
                <ambientLight intensity={0.7} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} />

                {/* The Rungent in 3D */}
                <RungentRunner
                    position={rungentCoords}
                    heading={rungent?.heading || 0}
                    isWalking={rungent?.speed > 0}
                    speed={rungent?.speed}
                />

                {/* Other hunters */}
                {relativeHunters.map((hunter) => (
                    <HunterAvatar key={hunter.id} position={hunter.position} />
                ))}
            </Canvas>
        </div>
    );
}
