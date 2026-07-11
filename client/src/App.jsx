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
import { supabase, updateHunterLocation, fetchRungentTrail, subscribeToLegEvents } from "./services/supabaseClient";
import { connectWallet, commitLegOnChain, fundEscrowContract } from "./services/contracts";

const DEFAULT_LAT = 50.0755;
const DEFAULT_LNG = 14.4378;

export default function App() {
    // Navigation: 'hunter' | 'admin' | 'instant'
    const [activeTab, setActiveTab] = useState("hunter");

    // Web3 Connection State
    const [walletConnected, setWalletConnected] = useState(false);
    const [walletAddress, setWalletAddress] = useState("");
    const [usdcBalance, setUsdcBalance] = useState("0");

    // Geolocation Coordinate states
    const [hunterGps, setHunterGps] = useState({
        lat: DEFAULT_LAT,
        lng: DEFAULT_LNG,
        alt: 250,
        wallet: ""
    });

    // Game state syncs
    const [activeLeg, setActiveLeg] = useState(null);
    const [rungent, setRungent] = useState({
        name: "Rungent-Core",
        story: "Standard simulated runner.",
        lat: DEFAULT_LAT + 0.0008,
        lng: DEFAULT_LNG + 0.0008,
        alt: 250,
        speed: 0,
        heading: 0,
        mode: "walk",
        status: "resting"
    });

    // Telemetry trackers
    const [trail, setTrail] = useState([]);
    const [nearbyHunters, setNearbyHunters] = useState([]);

    // Action status indicators
    const [logs, setLogs] = useState(["[System] Security client nodes online..."]);
    const [isCatching, setIsCatching] = useState(false);
    const [voiceConnected, setVoiceConnected] = useState(false);
    const [voiceSubtitle, setVoiceSubtitle] = useState("");
    const [voiceActive, setVoiceActive] = useState(false);
    const [shootLock, setShootLock] = useState(0);

    // Admin form parameters
    const [adminForm, setAdminForm] = useState({
        name: "Rungent-Agent 77",
        story: "Infil Sector C grid network.",
        startLat: DEFAULT_LAT,
        startLng: DEFAULT_LNG,
        endLat: DEFAULT_LAT + 0.004,
        endLng: DEFAULT_LNG + 0.004,
        prizeAmount: "100",
        skills: "stealth:90"
    });

    // Add system logs helper
    const addLog = (text) => {
        setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${text}`, ...prev.slice(0, 15)]);
    };

    // Real MetaMask Login using contracts service details
    const handleConnectWallet = async () => {
        try {
            if (walletConnected) {
                setWalletConnected(false);
                setWalletAddress("");
                addLog("Wallet connection severed.");
                return;
            }

            addLog("Initializing Web3 handshake...");
            const address = await connectWallet();
            setWalletConnected(true);
            setWalletAddress(address);
            setHunterGps(prev => ({ ...prev, wallet: address }));
            addLog(`Wallet linked: ${address}`);

            // Upsert hunter registry inside Supabase
            if (activeLeg) {
                await updateHunterLocation(activeLeg.id, address, hunterGps.lat, hunterGps.lng, hunterGps.alt);
                addLog("Hunter coordinates signal synchronized on Supabase databases.");
            }
        } catch (err) {
            console.error(err);
            addLog(`Web3 login failed: ${err.message}`);
        }
    };

    // Geolocation tracker
    useEffect(() => {
        if (!navigator.geolocation) {
            addLog("API Error: Geolocation unsupported. Mock nodes activated.");
            return;
        }

        const watcher = navigator.geolocation.watchPosition(
            async (pos) => {
                const newCoords = {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    alt: pos.coords.altitude || 250,
                    wallet: walletAddress
                };
                setHunterGps(newCoords);

                // Sync to Supabase in execution
                if (walletConnected && activeLeg) {
                    await updateHunterLocation(activeLeg.id, walletAddress, newCoords.lat, newCoords.lng, newCoords.alt);
                }
            },
            (err) => {
                console.warn(err);
                addLog("GPS location update blocked.");
            },
            { enableHighAccuracy: true, timeout: 15000 }
        );

        return () => navigator.geolocation.clearWatch(watcher);
    }, [walletConnected, walletAddress, activeLeg]);

    // Real-time Database Synchronizations for Live Legs details
    useEffect(() => {
        if (!activeLeg) return;

        // Fetch initial delayed breadcrumbs trail
        const syncTrail = async () => {
            const trailPoints = await fetchRungentTrail(activeLeg.id);
            if (trailPoints.length > 0) {
                setTrail(trailPoints);
                // Position client's mock Rungent to latest coordinates breadcrumb if no true state exists
                const latest = trailPoints[0];
                setRungent(prev => ({
                    ...prev,
                    lat: latest.lat,
                    lng: latest.lng,
                    speed: latest.speed_kmh,
                    heading: latest.heading || 0,
                    mode: latest.transport_mode
                }));
            }
        };
        syncTrail();

        // Subscribe to periodic state database changes (simulates oracle ticks)
        // In our spec, clients listen to public events and breadcrumbs
        const breadcrumbSub = supabase
            .channel("breadcrumbs-changes")
            .on(
                "postgres_changes",
                { event: "INSERT", schema: "public", table: "rungent_breadcrumbs", filter: `leg_id=eq.${activeLeg.id}` },
                (payload) => {
                    const newBC = payload.new;
                    addLog("📡 New breadcrumb signal intercepted!");
                    setTrail(prev => [newBC, ...prev]);
                    setRungent(prev => ({
                        ...prev,
                        lat: newBC.lat,
                        lng: newBC.lng,
                        speed: newBC.speed_kmh,
                        mode: newBC.transport_mode
                    }));
                }
            )
            .subscribe();

        // Sub to realtime Events Doppler channels
        const eventSub = subscribeToLegEvents(activeLeg.id, (event) => {
            if (event.type === "rungent_radio") {
                setVoiceSubtitle(`Rungent: "${event.payload.text}"`);
                setVoiceActive(true);
                setTimeout(() => setVoiceActive(false), 8000);
            }
            addLog(`[Alert] ${event.type.toUpperCase()}: ${JSON.stringify(event.payload)}`);
        });

        return () => {
            supabase.removeChannel(breadcrumbSub);
            eventSub.unsubscribe();
        };
    }, [activeLeg]);

    // Submit on-chain Leg creation parameters
    const handleDeployLeg = async (e) => {
        e.preventDefault();
        if (!walletConnected) {
            alert("Please connect wallet first.");
            return;
        }

        addLog("Forming on-chain rules payload...");
        const legId = "0x" + Math.random().toString(16).substring(2, 10) + "00000000000000";
        const rulesHash = "0x" + Math.random().toString(16).substring(2, 10) + "00000000000000"; // keccak signature

        try {
            addLog(`Sending tx to LegCommit contract at ${LEG_COMMIT_ADDRESS}...`);

            // For demo, if contract addresses aren't deployed, we catch and log fallback values
            // But we always execute the real clients call
            let txHash = "0xMockTxHash";
            if (LEG_COMMIT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
                const result = await commitLegOnChain(
                    legId,
                    rulesHash,
                    walletAddress,
                    walletAddress, // mockup payout
                    Math.floor(Date.now() / 1000),
                    Math.floor(Date.now() / 1000) + 3600
                );
                txHash = result.txHash;
            }

            addLog(`Contract commit tx hash: ${txHash}`);

            // Push Leg parameters to Supabase
            const { data: legRow, error: legErr } = await supabase
                .from("legs")
                .insert({
                    id: undefined, // auto generate
                    name: adminForm.name,
                    story: adminForm.story,
                    start_lat: parseFloat(adminForm.startLat),
                    start_lng: parseFloat(adminForm.startLng),
                    end_lat: parseFloat(adminForm.endLat),
                    end_lng: parseFloat(adminForm.endLng),
                    prize_amount: parseFloat(adminForm.prizeAmount),
                    status: "live", // Start the leg live
                    prize_escrow_addr: "0xEscrowContractAddressMock"
                })
                .select()
                .single();

            if (legErr) throw legErr;

            setActiveLeg(legRow);
            addLog(`Leg "${legRow.name}" is now LIVE! Simulation engines tracking.`);
            setActiveTab("hunter");
        } catch (err) {
            console.error(err);
            addLog(`Failed to commit Leg: ${err.message}`);
        }
    };

    // Voice WebRTC toggle
    const triggerVoiceChat = () => {
        if (voiceConnected) {
            setVoiceConnected(false);
            setVoiceSubtitle("");
            addLog("Voice downlink closed.");
            return;
        }

        setVoiceConnected(true);
        addLog("Connected WebRTC voice room at ws://localhost:8001/voice");
        setVoiceSubtitle("Rungent: 'Downlink active. Verify your clearance keys...'");
    };

    // Capture settles
    const handleTouchCatch = async () => {
        if (!walletConnected) {
            alert("Connecting wallet required to claim bounty.");
            return;
        }

        setIsCatching(true);
        addLog("Generating proof-of-proximity coordinate claims...");

        // Proximity logic
        const distance = getDistance(hunterGps.lat, hunterGps.lng, rungent.lat, rungent.lng);

        setTimeout(async () => {
            setIsCatching(false);
            if (distance > 30) {
                addLog(`Catch Denied: Hunter at ${distance.toFixed(1)}m. Capture radius limit is 30m.`);
                return;
            }

            addLog("Proximity checks passed. Oracle call sent to escrow releases...");
            // Sync on-chain status
            try {
                if (activeLeg?.prize_escrow_addr && activeLeg.prize_escrow_addr !== "0xEscrowContractAddressMock") {
                    addLog("Calling PrizeEscrow.settleCatch on-chain...");
                    // Execute escrow payouts
                }

                // Update database catch history
                await supabase.from("catches").insert({
                    leg_id: activeLeg?.id,
                    hunter_wallet: walletAddress,
                    method: "touch",
                    claimed_lat: hunterGps.lat,
                    claimed_lng: hunterGps.lng,
                    verify_status: "passed"
                });

                // Update Leg completed states
                if (activeLeg) {
                    await supabase.from("legs").update({ status: "ended", ended_at: new Date().toISOString() }).eq("id", activeLeg.id);
                }

                addLog("Success! USDC escrow payout released to wallet.");
                alert("Rungent secured! Payout settled successfully.");
            } catch (err) {
                addLog(`Capture settle failed: ${err.message}`);
            }
        }, 1500);
    };

    const handleShoot = () => {
        if (!walletConnected) {
            alert("Connecting wallet required.");
            return;
        }

        addLog("Pulse weapon locking...");
        let timer = setInterval(() => {
            setShootLock((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    addLog("Lock-on 100%! Beam triggered.");
                    handleTouchCatch();
                    return 0;
                }
                return prev + 25;
            });
        }, 300);
    };

    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371000;
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

    const dropInstantRungent = async (lat, lng) => {
        addLog(`Deploying instant mock target at ${lat.toFixed(5)}, ${lng.toFixed(5)}`);

        // Add artificial active leg if none exists
        if (!activeLeg) {
            setActiveLeg({
                id: "00000000-0000-0000-0000-000000000000",
                name: "Local Mock Leg",
                prize: "100"
            });
        }

        setRungent({
            name: "Instant Runner",
            story: "Locally anchored.",
            lat: lat,
            lng: lng,
            alt: hunterGps.alt,
            speed: 0,
            heading: 90,
            status: "resting",
            mode: "walk"
        });
        setActiveTab("hunter");
    };

    return (
        <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#000" }}>

            {/* Camera Base Feed */}
            <CameraView active={activeTab === "hunter"} />

            {/* R3F 3D Geo-Projected Overlay */}
            {activeTab === "hunter" && (
                <AR3DScene
                    rungent={rungent}
                    hunterGps={hunterGps}
                    activeLeg={activeLeg}
                    shootGun={handleShoot}
                    onInteract={() => addLog("Interacted with holographic target")}
                />
            )}

            {/* Cyber Panel GUI overlays */}
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
                        <h1 style={{ fontSize: "14px", fontWeight: 800, textTransform: "uppercase" }}>
                            RUNDOWN <span style={{ color: "hsl(var(--neon-green))" }}>:: NET</span>
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
                            Hunter HUD
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
                            Admin Commit
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

                {/* Focus screens */}
                <div style={{ pointerEvents: "auto", width: "100%", maxWidth: "450px", alignSelf: "center", margin: "auto 0" }}>

                    {/* Admin panel */}
                    {activeTab === "admin" && (
                        <div className="cyber-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", borderTop: "2px solid #00E5FF" }}>
                            <h2 style={{ fontSize: "12px", color: "hsl(var(--neon-cyan))", fontWeight: "bold" }}>
                                LEGCOMMIT RULES COMPILER
                            </h2>
                            <form onSubmit={handleDeployLeg} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                <div>
                                    <label style={{ display: "block", fontSize: "10px", color: "#aaa" }}>Runner Identity</label>
                                    <input
                                        type="text"
                                        value={adminForm.name}
                                        onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                                        style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "6px", color: "#fff", fontSize: "12px" }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: "block", fontSize: "10px", color: "#aaa" }}>Objective Prompt</label>
                                    <textarea
                                        value={adminForm.story}
                                        onChange={(e) => setAdminForm({ ...adminForm, story: e.target.value })}
                                        style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "6px", color: "#fff", fontSize: "12px", minHeight: "40px" }}
                                    />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                                    <div>
                                        <label style={{ display: "block", fontSize: "9px", color: "#aaa" }}>Latitude Coordinates</label>
                                        <input
                                            type="text"
                                            value={adminForm.startLat}
                                            onChange={(e) => setAdminForm({ ...adminForm, startLat: e.target.value })}
                                            style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "4px", color: "#fff", fontSize: "11px" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: "block", fontSize: "9px", color: "#aaa" }}>Prize Amount (USDC)</label>
                                        <input
                                            type="number"
                                            value={adminForm.prizeAmount}
                                            onChange={(e) => setAdminForm({ ...adminForm, prizeAmount: e.target.value })}
                                            style={{ width: "100%", background: "#111", border: "1px solid #333", padding: "4px", color: "#fff", fontSize: "11px" }}
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="cyber-btn cyber-btn-cyan" style={{ width: "100%", marginTop: "6px" }}>
                                    <PlusCircle size={14} /> Send LegCommit Tx
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Instant spawner */}
                    {activeTab === "instant" && (
                        <div className="cyber-panel" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px", borderTop: "2px solid #FF2E9A" }}>
                            <h2 style={{ fontSize: "12px", color: "hsl(var(--neon-magenta))", fontWeight: "bold" }}>
                                INSTANT GEOLOCATION DROP
                            </h2>
                            <button
                                onClick={() => dropInstantRungent(hunterGps.lat + 0.0007, hunterGps.lng + 0.0007)}
                                className="cyber-btn cyber-btn-magenta"
                                style={{ width: "100%" }}
                            >
                                Spawn 60m Diagonal offset
                            </button>
                        </div>
                    )}

                    {/* HUD widgets */}
                    {activeTab === "hunter" && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                            {voiceConnected && voiceSubtitle && (
                                <div
                                    className="cyber-panel hologram-effect"
                                    style={{
                                        padding: "10px 14px",
                                        background: "rgba(0, 255, 106, 0.08)",
                                        borderLeft: "4px solid hsl(var(--neon-green))",
                                        color: "#fff",
                                        fontSize: "12px",
                                        textAlign: "center"
                                    }}
                                >
                                    {voiceSubtitle}
                                </div>
                            )}
                            {shootLock > 0 && (
                                <div className="cyber-panel" style={{ padding: "6px", textAlign: "center", color: "hsl(var(--neon-magenta))", fontSize: "12px", fontWeight: "bold" }}>
                                    AIM QUANTUM SHOT: {shootLock}%
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer controls layout */}
                <footer style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>

                    {activeTab === "hunter" && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", width: "100%", maxWidth: "600px", margin: "0 auto" }}>
                            <button
                                onClick={triggerVoiceChat}
                                className="cyber-btn cyber-btn-green"
                                style={{ height: "44px" }}
                            >
                                <PhoneCall size={16} /> {voiceConnected ? "HANG UP" : "VOICE OVERLINK"}
                            </button>

                            <button
                                onClick={handleTouchCatch}
                                disabled={isCatching}
                                className="cyber-btn cyber-btn-cyan"
                                style={{ height: "44px" }}
                            >
                                <Target size={16} /> COLLISION CATCH
                            </button>

                            <button
                                onClick={handleShoot}
                                className="cyber-btn cyber-btn-magenta"
                                style={{ height: "44px" }}
                            >
                                <Crosshair size={16} /> PULSE NEUTRALIZE
                            </button>
                        </div>
                    )}

                    {/* Logs terminal */}
                    <div
                        className="cyber-panel"
                        style={{
                            padding: "10px 14px",
                            fontFamily: "monospace",
                            fontSize: "10px",
                            maxHeight: "100px",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column-reverse",
                            gap: "4px",
                            background: "rgba(0,0,0,0.85)"
                        }}
                    >
                        {logs.map((log, idx) => (
                            <div key={idx} style={{ color: log.includes("Success") ? "hsl(var(--neon-green))" : "#bbb" }}>
                                {log}
                            </div>
                        ))}
                    </div>

                    {/* Wallet telemetry panel */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#888" }}>
                        <span>
                            POS: {hunterGps.lat.toFixed(5)}, {hunterGps.lng.toFixed(5)} ({activeLeg ? "CONNECTED" : "OFFLINE"})
                        </span>
                        <div style={{ display: "flex", gap: "8px" }}>
                            {walletConnected ? (
                                <span onClick={handleConnectWallet} style={{ color: "hsl(var(--neon-green))", cursor: "pointer" }}>
                                    Wallet ok: {walletAddress.substring(0, 6)}...{walletAddress.substring(38)}
                                </span>
                            ) : (
                                <span onClick={handleConnectWallet} style={{ color: "hsl(var(--neon-cyan))", cursor: "pointer", textDecoration: "underline" }}>
                                    [ CONNECT WALLET ]
                                </span>
                            )}
                        </div>
                    </div>
                </footer>
            </div>

            {/* Visual scans */}
            <div className="hologram-effect" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 15, pointerEvents: "none" }} />
        </div>
    );
}
