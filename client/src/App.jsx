import React, { useState, useEffect, useRef } from "react";
import {
    MapPin,
    Satellite,
    User,
    Settings,
    Shield,
    PhoneCall,
    Volume2,
    DollarSign,
    Compass,
    Play,
    Crosshair,
    Award,
    PlusCircle,
    Hash,
    Activity,
    Zap,
    Target
} from "lucide-react";
import CameraView from "./components/CameraView";
import AR3DScene from "./components/AR3DScene";

// Sample local default start coordinates (Prague coordinates for testing)
const DEFAULT_LAT = 50.0755;
const DEFAULT_LNG = 14.4378;

export default function App() {
    // Navigation / Views: 'hunter' | 'admin' | 'instant'
    const [activeTab, setActiveTab] = useState("hunter");

    // Web3 Connection State
    const [walletConnected, setWalletConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState("");
    const [usdcBalance, setUsdcBalance] = useState("0");

    // Geolocation Coordinates
    const [hunterGps, setHunterGps] = useState({
        lat: DEFAULT_LAT,
        lng: DEFAULT_LNG,
        alt: 250,
        wallet: ""
    });

    // Game running state
    const [activeLeg, setActiveLeg] = useState(null);
    const [rungent, setRungent] = useState({
        name: "Rungent-Alpha",
        story: "AI fugitive seeking escape through cybersecurity gridlines.",
        lat: DEFAULT_LAT + 0.0008, // A few meters away
        lng: DEFAULT_LNG + 0.0008,
        alt: 250,
        speed: 0,
        heading: 45,
        mode: "walk",
        status: "resting"
    });

    // Action status
    const [logs, setLogs] = useState(["[System] Initialized security network..."]);
    const [isCatching, setIsCatching] = useState(false);
    const [voiceConnected, setVoiceConnected] = useState(false);
    const [voiceSubtitle, setVoiceSubtitle] = useState("");
    const [voiceActive, setVoiceActive] = useState(false);
    const [shootLock, setShootLock] = useState(0); // 0 to 100% lock-on

    // Admin Creation Form
    const [adminForm, setAdminForm] = useState({
        name: "Rungent-Agent 007",
        story: "Deliver cryptographic files from Sector A to Sector B before deadline.",
        startLat: DEFAULT_LAT,
        startLng: DEFAULT_LNG,
        endLat: DEFAULT_LAT + 0.005,
        endLng: DEFAULT_LNG + 0.005,
        prizeAmount: "250",
        skills: "endurance:80, streetwise:95"
    });

    // Simulator Interval
    const simulatorTimer = useRef(null);

    // Add system logs helper
    const addLog = (text) => {
        setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev.slice(0, 15)]);
    };

    // Mock MetaMask Login
    const connectWallet = async () => {
        if (walletConnected) {
            setWalletConnected(false);
            setWalletAddress("");
            addLog("Wallet connection terms terminated.");
            return;
        }

        addLog("MetaMask authentication handshake started...");
        // Simulate web3 wallet hooks
        setTimeout(() => {
            const mockAddr = "0x7F...c394";
            setWalletConnected(true);
            setWalletAddress(mockAddr);
            setUsdcBalance("1250.00");
            setHunterGps(prev => ({ ...prev, wallet: mockAddr }));
            addLog(`Authenticated as ${mockAddr}. Network: Sepolia Testnet.`);
            addLog("PrizeEscrow release tokens signed.");
        }, 800);
    };

    // Geolocation tracker
    useEffect(() => {
        if (!navigator.geolocation) {
            addLog("Warning: Geolocation API unsupported. Mock coordinates engaged.");
            return;
        }

        addLog("Registering GPS tracking nodes...");
        const watcher = navigator.geolocation.watchPosition(
            (pos) => {
                setHunterGps((prev) => ({
                    ...prev,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    alt: pos.coords.altitude || 250
                }));
            },
            (err) => {
                console.warn(err);
                addLog("GPS Error: Permission denied. Locked coordinates fallback.");
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );

        return () => navigator.geolocation.clearWatch(watcher);
    }, []);

    // Voice Interaction - two-way chat loop stub
    const triggerVoiceChat = () => {
        if (voiceConnected) {
            setVoiceConnected(false);
            setVoiceSubtitle("");
            setVoiceActive(false);
            addLog("Voice channel severed.");
            return;
        }

        setVoiceConnected(true);
        addLog("WebRTC Peer connection initialized on LiveKit node...");
        setTimeout(() => {
            setVoiceSubtitle("Rungent: 'Who's tracking me? State your business...'");
            setVoiceActive(true);
        }, 1200);
    };

    // Combat Simulation: Capture mechanisms
    // Tactile collision catch
    const handleTouchCatch = () => {
        if (!walletConnected) {
            alert("Unauthorized: Connect wallet to claim prize.");
            return;
        }

        setIsCatching(true);
        addLog("Deploying containment net... Clamping coordinates...");

        setTimeout(() => {
            setIsCatching(false);
            // Success check: distance <= 25m
            const distance = getDistance(hunterGps.lat, hunterGps.lng, rungent.lat, rungent.lng);
            if (distance > 25) {
                addLog(`Catch failed: Target is at ${distance.toFixed(1)}m. Proximity must be <25m.`);
            } else {
                triggerWinnerContracts(walletAddress);
            }
        }, 2000);
    };

    // Weapon locks & firing
    const handleShoot = () => {
        if (!walletConnected) {
            alert("Connect wallet to claim prize.");
            return;
        }

        addLog("Target lock acquired. Charging pulse-rifle...");
        let timer = setInterval(() => {
            setShootLock((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    addLog("Lock-on 100%! Pulse fire triggered...");
                    triggerWinnerContracts(walletAddress);
                    return 0;
                }
                return prev + 25;
            });
        }, 400);
    };

    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371000; // Radius of local earth in meters
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Smart Contract Release Trigger
    const triggerWinnerContracts = (winner) => {
        addLog("Sovereign catch attested by oracle!");
        addLog("Broadcasting transaction to LegCommit.sol...");
        addLog("Triggering PrizeEscrow.sol.settleCatch()...");

        // Simulate transaction delay
        setTimeout(() => {
            addLog(`Success! Tx 0x8a3c...eef7 confirmed on Sepolia.`);
            addLog(`Prize pool USDC released to: ${winner}.`);
            setRungent(prev => ({ ...prev, status: "caught", speed: 0 }));
            alert("CONGRATULATIONS! Target neutralized. USDC funded to wallet.");
        }, 1500);
    };

    // Admin creations
    const createRungentDetails = (e) => {
        e.preventDefault();
        addLog("Constructing target parameters (LegCommit)...");

        const legId = "0x" + Math.random().toString(16).substring(2, 10) + "00000000000000";

        // Mock EVM contract write calls
        addLog(`Calling LegCommit.commit(${legId.substring(0, 10)}...)`);
        addLog(`Deploying PrizeEscrow.sol with prize ${adminForm.prizeAmount} USDC...`);

        setTimeout(() => {
            setActiveLeg({
                id: legId,
                name: adminForm.name,
                prize: adminForm.prizeAmount
            });

            setRungent({
                name: adminForm.name,
                story: adminForm.story,
                lat: parseFloat(adminForm.startLat),
                lng: parseFloat(adminForm.startLng),
                alt: 250,
                speed: 0,
                heading: 45,
                mode: "walk",
                status: "resting"
            });

            addLog(`Leg ${adminForm.name} committed on-chain. status: committed.`);
            setActiveTab("hunter");
        }, 1000);
    };

    // Start Leg simulation ticker
    const toggleSimulatorRoute = () => {
        if (simulatorTimer.current) {
            clearInterval(simulatorTimer.current);
            simulatorTimer.current = null;
            setRungent(prev => ({ ...prev, speed: 0, status: "resting" }));
            addLog("Route physics simulator suspended.");
            return;
        }

        addLog("Starting Directions routing engine... speeds capped (walk 6 / run 10 km/h)");
        setRungent(prev => ({ ...prev, speed: 8.5, status: "moving", mode: "run" }));

        // Every 2s, Rungent moves closer to target end point
        simulatorTimer.current = setInterval(() => {
            setRungent((prev) => {
                const destLat = activeLeg ? parseFloat(adminForm.endLat) : DEFAULT_LAT + 0.005;
                const destLng = activeLeg ? parseFloat(adminForm.endLng) : DEFAULT_LNG + 0.005;

                const deltaLat = destLat - prev.lat;
                const deltaLng = destLng - prev.lng;
                const distance = Math.sqrt(deltaLat ** 2 + deltaLng ** 2);

                if (distance < 0.0001) {
                    clearInterval(simulatorTimer.current);
                    simulatorTimer.current = null;
                    addLog("Rungent reached destination point safely. Escrow returned to operating nodes.");
                    return { ...prev, speed: 0, status: "arrived" };
                }

                // Calculate heading to target
                const bearingRad = Math.atan2(deltaLng, deltaLat);
                const headingDeg = (bearingRad * 180) / Math.PI;

                // Move a bit toward target
                const step = 0.00015; // Simulated movement speed increment
                return {
                    ...prev,
                    lat: prev.lat + (deltaLat / distance) * step,
                    lng: prev.lng + (deltaLng / distance) * step,
                    heading: (headingDeg + 360) % 360,
                    speed: 10.0 // capped run max
                };
            });
        }, 1500);
    };

    // Instant mode deployment
    const dropInstantRungent = (lat, lng) => {
        addLog(`Instant node spawn at coordinates: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setRungent(prev => ({
            ...prev,
            lat: lat,
            lng: lng,
            status: "resting",
            speed: 0
        }));
        setActiveTab("hunter");
    };

    return (
        <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#000" }}>

            {/* 1. Camera View base layer */}
            <CameraView active={activeTab === "hunter"} />

            {/* 2. Three.js / R3F Overlay sheet */}
            {activeTab === "hunter" && (
                <AR3DScene
                    rungent={rungent}
                    hunterGps={hunterGps}
                    activeLeg={activeLeg}
                    shootGun={handleShoot}
                    onInteract={() => addLog("Direct interaction with target.")}
                />
            )}

            {/* 3. Cyber Glass Controls Layer */}
            <div
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 20,
                    pointerEvents: "none",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: "16px"
                }}
            >
                {/* Header HUD status */}
                <header
                    className="cyber-panel"
                    style={{
                        pointerEvents: "auto",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 16px",
                        width: "100%"
                    }}
                >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Activity style={{ color: "hsl(var(--neon-green))" }} className="animate-pulse" />
                        <h1 style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase" }}>
                            RUNDOWN <span style={{ color: "hsl(var(--neon-green))" }}>:: DEMO</span>
                        </h1>
                    </div>

                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={() => setActiveTab("hunter")}
                            className="cyber-btn cyber-btn-green"
                            style={{
                                padding: "4px 10px",
                                fontSize: "10px",
                                background: activeTab === "hunter" ? "hsl(var(--neon-green))" : "transparent",
                                color: activeTab === "hunter" ? "black" : ""
                            }}
                        >
                            Hunter
                        </button>
                        <button
                            onClick={() => setActiveTab("admin")}
                            className="cyber-btn cyber-btn-cyan"
                            style={{
                                padding: "4px 10px",
                                fontSize: "10px",
                                background: activeTab === "admin" ? "hsl(var(--neon-cyan))" : "transparent",
                                color: activeTab === "admin" ? "black" : ""
                            }}
                        >
                            Admin Config
                        </button>
                        <button
                            onClick={() => setActiveTab("instant")}
                            className="cyber-btn cyber-btn-magenta"
                            style={{
                                padding: "4px 10px",
                                fontSize: "10px",
                                background: activeTab === "instant" ? "hsl(var(--neon-magenta))" : "transparent",
                                color: activeTab === "instant" ? "black" : ""
                            }}
                        >
                            Instant Drop
                        </button>
                    </div>
                </header>

                {/* Dynamic Panels */}
                <div style={{ pointerEvents: "auto", width: "100%", maxWidth: "450px", alignSelf: "center", margin: "auto 0" }}>

                    {/* A. ADMIN CONFIG PANEL */}
                    {activeTab === "admin" && (
                        <div className="cyber-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", borderTop: "2px solid hsl(var(--neon-cyan))" }}>
                            <h2 style={{ fontSize: "14px", color: "hsl(var(--neon-cyan))", fontWeight: "bold", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                                LEGCOMMIT / ADMIN INTERFACE
                            </h2>
                            <form onSubmit={createRungentDetails} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "10px", color: "#aaa", marginBottom: "4px" }}>Rungent Name</label>
                                    <input
                                        type="text"
                                        value={adminForm.name}
                                        onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                                        style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "6px", color: "#fff", fontSize: "12px", borderRadius: "4px" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "10px", color: "#aaa", marginBottom: "4px" }}>Story / Personality Prompt</label>
                                    <textarea
                                        value={adminForm.story}
                                        onChange={(e) => setAdminForm({ ...adminForm, story: e.target.value })}
                                        style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "6px", color: "#fff", fontSize: "12px", borderRadius: "4px", minHeight: "50px" }}
                                    />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "9px", color: "#aaa" }}>Start Lat/Lng</label>
                                        <input
                                            type="text"
                                            value={`${adminForm.startLat}, ${adminForm.startLng}`}
                                            onChange={(e) => {
                                                const parts = e.target.value.split(",");
                                                setAdminForm({ ...adminForm, startLat: parseFloat(parts[0]) || 0, startLng: parseFloat(parts[1]) || 0 });
                                            }}
                                            style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "4px", color: "#fff", fontSize: "11px" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "9px", color: "#aaa" }}>Destination Lat/Lng</label>
                                        <input
                                            type="text"
                                            value={`${adminForm.endLat}, ${adminForm.endLng}`}
                                            onChange={(e) => {
                                                const parts = e.target.value.split(",");
                                                setAdminForm({ ...adminForm, endLat: parseFloat(parts[0]) || 0, endLng: parseFloat(parts[1]) || 0 });
                                            }}
                                            style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "4px", color: "#fff", fontSize: "11px" }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "9px", color: "#aaa" }}>Prize (Testnet USDC)</label>
                                        <input
                                            type="number"
                                            value={adminForm.prizeAmount}
                                            onChange={(e) => setAdminForm({ ...adminForm, prizeAmount: e.target.value })}
                                            style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "4px", color: "#fff", fontSize: "11px" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "9px", color: "#aaa" }}>Skills Config</label>
                                        <input
                                            type="text"
                                            value={adminForm.skills}
                                            onChange={(e) => setAdminForm({ ...adminForm, skills: e.target.value })}
                                            style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "4px", color: "#fff", fontSize: "11px" }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="cyber-btn cyber-btn-cyan" style={{ marginTop: "8px", width: "100%" }}>
                                    <PlusCircle size={14} /> Commit Leg On-Chain
                                </button>
                            </form>

                            {activeLeg && (
                                <div style={{ background: "rgba(0,0,0,0.5)", border: "1px dashed hsl(var(--neon-green))", padding: "10px", marginTop: "10px", borderRadius: "4px" }}>
                                    <div style={{ fontSize: "11px", color: "hsl(var(--neon-green))", fontWeight: "bold" }}>⚡ COMMITTED LEG ACTIVE</div>
                                    <div style={{ fontSize: "11px", margin: "4px 0" }}>Name: {activeLeg.name}</div>
                                    <div style={{ fontSize: "11px" }}>Reward: {activeLeg.prize} USDC</div>
                                    <button
                                        onClick={toggleSimulatorRoute}
                                        className="cyber-btn cyber-btn-green"
                                        style={{ width: "100%", padding: "6px", fontSize: "10px", marginTop: "8px" }}
                                    >
                                        <Play size={10} /> {simulatorTimer.current ? "HALT SIMULATOR" : "TRIGGER MOVEMENT TICK"}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* B. INSTANT DROP PANEL */}
                    {activeTab === "instant" && (
                        <div className="cyber-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", borderTop: "2px solid hsl(var(--neon-magenta))" }}>
                            <h2 style={{ fontSize: "14px", color: "hsl(var(--neon-magenta))", fontWeight: "bold", borderBottom: "1px solid #222", paddingBottom: "6px" }}>
                                INSTANT LOCAL SPAWNER (INVESTOR MODE)
                            </h2>
                            <p style={{ fontSize: "11px", color: "#aaa" }}>
                                Anchor a temporary simulated Rungent at coordinates instantly for demonstration testing.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                <button
                                    onClick={() => dropInstantRungent(hunterGps.lat + 0.0006, hunterGps.lng + 0.0006)}
                                    className="cyber-btn cyber-btn-magenta"
                                    style={{ width: "100%" }}
                                >
                                    📍 Spawn 50m North-East of my GPS
                                </button>
                                <button
                                    onClick={() => dropInstantRungent(DEFAULT_LAT, DEFAULT_LNG)}
                                    className="cyber-btn"
                                    style={{ width: "100%", borderColor: "#555" }}
                                >
                                    Spawn at Default Prague Central Node
                                </button>
                            </div>
                        </div>
                    )}

                    {/* C. HUNTER HUD PANEL */}
                    {activeTab === "hunter" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

                            {/* Voice Subtitles Overlay */}
                            {voiceConnected && voiceSubtitle && (
                                <div
                                    className="cyber-panel hologram-effect"
                                    style={{
                                        padding: "12px",
                                        background: "rgba(0, 255, 106, 0.07)",
                                        borderColor: "hsl(var(--neon-green))",
                                        color: "#fff",
                                        fontSize: "12px",
                                        textAlign: "center",
                                        textShadow: "0 0 4px #00ff6a",
                                        borderLeft: "4px solid hsl(var(--neon-green))"
                                    }}
                                >
                                    {voiceSubtitle}
                                </div>
                            )}

                            {/* Aiming Reticle details */}
                            {shootLock > 0 && (
                                <div
                                    className="cyber-panel"
                                    style={{
                                        padding: "8px",
                                        textAlign: "center",
                                        color: "hsl(var(--neon-magenta))",
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}
                                >
                                    [ LOCK CHARGING: {shootLock}% ]
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Bottom controls panel */}
                <footer style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>

                    {/* Action Row for Hunters */}
                    {activeTab === "hunter" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", width: "100%", maxWidth: "600px", margin: "0 auto" }}>
                            <button
                                onClick={triggerVoiceChat}
                                className="cyber-btn cyber-btn-green"
                                style={{ height: "46px" }}
                            >
                                <PhoneCall size={18} /> {voiceConnected ? "HANG UP" : "VOICE OVERLINK"}
                            </button>

                            <button
                                onClick={handleTouchCatch}
                                disabled={isCatching}
                                className="cyber-btn cyber-btn-cyan"
                                style={{ height: "46px" }}
                            >
                                <Target size={18} /> {isCatching ? "DEPLOYING..." : "COLLISION CATCH"}
                            </button>

                            <button
                                onClick={handleShoot}
                                className="cyber-btn cyber-btn-magenta"
                                style={{ height: "46px" }}
                            >
                                <Crosshair size={18} /> PULSE SHOOT
                            </button>
                        </div>
                    )}

                    {/* Lower Terminal Logs */}
                    <div
                        className="cyber-panel"
                        style={{
                            padding: "10px 14px",
                            fontFamily: "monospace",
                            fontSize: "10px",
                            maxHeight: "120px",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column-reverse",
                            gap: "4px",
                            background: "rgba(0,0,0,0.85)"
                        }}
                    >
                        {logs.map((log, idx) => (
                            <div key={idx} style={{ color: log.includes("Success") || log.includes("released") ? "hsl(var(--neon-green))" : "#bbb" }}>
                                {log}
                            </div>
                        ))}
                    </div>

                    {/* Network Web3 status bar */}
                    <div style={{ display: "flex", justifySelf: "flex-end", justifyContent: "space-between", fontSize: "10px", color: "#888", gap: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Satellite size={12} style={{ color: walletConnected ? "hsl(var(--neon-cyan))" : "#555" }} />
                            <span>
                                Hunter GPS: {hunterGps.lat.toFixed(5)}, {hunterGps.lng.toFixed(5)}
                            </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {walletConnected ? (
                                <>
                                    <span style={{ color: "hsl(var(--neon-green))" }}>USDC: {usdcBalance}</span>
                                    <span style={{ cursor: "pointer", color: "hsl(var(--neon-cyan))" }} onClick={connectWallet}>
                                        Wallet: {walletAddress}
                                    </span>
                                </>
                            ) : (
                                <button
                                    onClick={connectWallet}
                                    style={{
                                        background: "transparent",
                                        color: "hsl(var(--neon-cyan))",
                                        border: "none",
                                        fontSize: "10px",
                                        cursor: "pointer",
                                        textDecoration: "underline",
                                        fontFamily: "monospace"
                                    }}
                                >
                                    [ CONNECT WALLET ]
                                </button>
                            )}
                        </div>
                    </div>
                </footer>
            </div>

            {/* Neon Scanline Aesthetic filter */}
            <div
                className="hologram-effect"
                style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    zIndex: 15,
                    pointerEvents: "none"
                }}
            />
        </div>
    );
}
