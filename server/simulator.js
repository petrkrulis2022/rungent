import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import cors from "cors";
import express from "express";

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-role-key";
const anthropicKey = process.env.ANTHROPIC_API_KEY || "";

const isSupabaseConfigured = !supabaseUrl.includes("placeholder-url");

// Initialize Supabase with service role key to bypass client RLS rules details
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Claude Client if key provided
const claude = anthropicKey ? new Anthropic({ apiKey: anthropicKey }) : null;

console.log("⚡ Rundown Pursuits Simulator Core powering up...");
if (!isSupabaseConfigured) {
    console.warn("⚠️ Warning: SUPABASE_URL not configured. Running offline simulator loops.");
}

// Global simulator repository of routing paths: legId => { pathArray[], currentIdx }
const activePaths = new Map();

/**
 * Generates coordinate array interpolation between start and endpoint.
 * Acts as a simulator fallback when Google Directions API is absent.
 */
const generateInterpolatedRoute = (startLat, startLng, endLat, endLng, stepSize = 0.00015) => {
    const points = [];
    const deltaLat = endLat - startLat;
    const deltaLng = endLng - startLng;
    const distance = Math.sqrt(deltaLat ** 2 + deltaLng ** 2);
    const stepsCount = Math.ceil(distance / stepSize);

    for (let i = 0; i <= stepsCount; i++) {
        const t = i / stepsCount;
        points.push({
            lat: startLat + deltaLat * t,
            lng: startLng + deltaLng * t,
            alt: 250 // constant elevation platform mock
        });
    }
    return points;
};

/**
 * Decides navigation moves utilizing Sonnet 3.5 AI decision rules
 */
const consultClaudeForIntent = async (rungentState, nearestHunterDistance) => {
    if (!claude) {
        // Default fallback simple behavior
        const speed = nearestHunterDistance < 100 ? 10.0 : 6.0; // run if hunter is close
        const mode = speed > 6.0 ? "run" : "walk";
        const dialogue = nearestHunterDistance < 100
            ? "Warning: Hunter signatures detected in close proximity. Increasing propulsion!"
            : "Navigating undetected. Remaining on route.";
        return { speed, mode, dialogue };
    }

    try {
        const response = await claude.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 250,
            messages: [
                {
                    role: "user",
                    content: `You are the AI orchestrator running a Rungent (cyberspace runner agent) inside an AR chase.
Current parameters:
- Position: Lat ${rungentState.true_lat}, Lng ${rungentState.true_lng}
- Current Energy: ${rungentState.energy}%
- Status: ${rungentState.status}
- Mode: ${rungentState.transport_mode} (current speed: ${rungentState.speed_kmh} km/h)
- Nearest Hunter Proximity: ${nearestHunterDistance.toFixed(1)} meters

Decide your next action. You can move at speed capped between walking (6 km/h) and running (10 km/h).
Provide your decision in JSON format:
{
  "speed": float,        // Target speed in km/h
  "mode": "walk" | "run", // Transport mode
  "dialogue": "phrase"    // A brief subtitle phrase the Rungent broadcasts to nearby hunters (in character, witty, hacking cyber jargon)
}`
                }
            ]
        });

        const body = JSON.parse(response.content[0].text);
        return body;
    } catch (error) {
        console.error("❌ Claude prompt query failed, applying fallback physics:", error.message);
        const speed = nearestHunterDistance < 100 ? 10.0 : 6.0;
        return { speed, mode: speed > 6.0 ? "run" : "walk", dialogue: "Optics jammed. Relying on default navigation vectors." };
    }
};

/**
 * Ticks routing logic for a live Leg. Run every 10-15 seconds.
 */
const processLegSimTick = async (leg) => {
    try {
        // 1. Get true Rungent position
        const { data: stateData, error: stateErr } = await supabase
            .from("rungent_state")
            .select("*")
            .eq("leg_id", leg.id)
            .maybeSingle();

        if (stateErr) throw stateErr;

        // Default setup if no active state table entries exist
        let currentRungent = stateData;
        if (!currentRungent) {
            const { data: newRow, error: initErr } = await supabase
                .from("rungent_state")
                .insert({
                    leg_id: leg.id,
                    true_lat: leg.start_lat,
                    true_lng: leg.start_lng,
                    true_alt: leg.start_alt || 250,
                    status: "resting",
                    energy: 100.0,
                    speed_kmh: 0.0,
                    heading_deg: 0.0
                })
                .select()
                .single();

            if (initErr) throw initErr;
            currentRungent = newRow;
            console.log(`[Rungent] Initialized state tracker for Leg: ${leg.name}`);
        }

        // Don't run movement logic if state is terminal
        if (["caught", "arrived"].includes(currentRungent.status)) {
            return;
        }

        // 2. Fetch routing path nodes
        let pathMeta = activePaths.get(leg.id);
        if (!pathMeta) {
            const points = generateInterpolatedRoute(
                leg.start_lat,
                leg.start_lng,
                leg.end_lat,
                leg.end_lng
            );
            pathMeta = { points, currentIdx: 0 };
            activePaths.set(leg.id, pathMeta);
        }

        // 3. Proximity check relative to nearest active hunters
        const { data: huntersList } = await supabase
            .from("hunters")
            .select("last_lat, last_lng, last_seen_at")
            .eq("leg_id", leg.id);

        let minDistance = 999999.0; // Dist to closest hunter
        if (huntersList && huntersList.length > 0) {
            huntersList.forEach((hunter) => {
                // Calculate standard meters offset distance
                const latM = (hunter.last_lat - currentRungent.true_lat) * 111139;
                const lngM = (hunter.last_lng - currentRungent.true_lng) * 111139 * Math.cos((hunter.last_lat * Math.PI) / 180);
                const dist = Math.sqrt(latM ** 2 + lngM ** 2);
                if (dist < minDistance) minDistance = dist;
            });
        }

        // 4. Feed parameters to decision engine
        const decision = await consultClaudeForIntent(currentRungent, minDistance);
        console.log(`[Decide] Rungent chooses speed ${decision.speed} km/h, mode: ${decision.mode}`);
        console.log(`[Radio] Broadcast text: "${decision.dialogue}"`);

        // 5. Update index progress based on speed
        // Higher speed advances index faster
        const idxAdvance = decision.speed > 6.0 ? 2 : 1;
        let nextIdx = pathMeta.currentIdx + idxAdvance;

        if (nextIdx >= pathMeta.points.length - 1) {
            nextIdx = pathMeta.points.length - 1;
            currentRungent.status = "arrived";
            console.log("🏁 Rungent arrived successfully to target destination!");
        } else {
            currentRungent.status = "moving";
        }

        const nextCoord = pathMeta.points[nextIdx];
        pathMeta.currentIdx = nextIdx;

        // Calculate heading angle
        const deltaLat = nextCoord.lat - currentRungent.true_lat;
        const deltaLng = nextCoord.lng - currentRungent.true_lng;
        const headingDeg = (Math.atan2(deltaLng, deltaLat) * 180 / Math.PI + 360) % 360;

        // Update coordinates variables
        currentRungent.true_lat = nextCoord.lat;
        currentRungent.true_lng = nextCoord.lng;
        currentRungent.true_alt = nextCoord.alt;
        currentRungent.heading_deg = headingDeg;
        currentRungent.speed_kmh = decision.speed;
        currentRungent.transport_mode = decision.mode;

        // Deplete fuel/energy slightly
        currentRungent.energy = Math.max(0, currentRungent.energy - (decision.mode === "run" ? 1.5 : 0.5));

        // Update real-time db state table
        const { error: updateErr } = await supabase
            .from("rungent_state")
            .update({
                true_lat: currentRungent.true_lat,
                true_lng: currentRungent.true_lng,
                true_alt: currentRungent.true_alt,
                heading_deg: currentRungent.heading_deg,
                speed_kmh: currentRungent.speed_kmh,
                transport_mode: currentRungent.transport_mode,
                status: currentRungent.status,
                energy: currentRungent.energy,
                updated_at: new Date().toISOString()
            })
            .eq("leg_id", leg.id);

        if (updateErr) throw updateErr;

        // 6. Doppler Alert Event Logger
        await supabase.from("events").insert({
            leg_id: leg.id,
            type: "rungent_radio",
            payload: {
                text: decision.dialogue,
                speed: currentRungent.speed_kmh,
                mode: currentRungent.transport_mode
            }
        });

        // 7. Write a delayed coord trail check to breadcrumbs
        // We log coords but lag they behind the Rungent's actual path index (e.g. log index - 4 points ago)
        const delayedIdx = Math.max(0, nextIdx - 4);
        const delayedCoord = pathMeta.points[delayedIdx];

        await supabase.from("rungent_breadcrumbs").insert({
            leg_id: leg.id,
            lat: delayedCoord.lat,
            lng: delayedCoord.lng,
            alt: delayedCoord.alt,
            speed_kmh: currentRungent.speed_kmh,
            transport_mode: currentRungent.transport_mode
        });

    } catch (error) {
        console.error(`❌ Process tick failure for Leg ${leg.id}:`, error.message);
    }
};

/**
 * Main cron loops fetching live games
 */
const runSimulatorLoop = async () => {
    if (!isSupabaseConfigured) return;

    try {
        const { data: liveLegs, error } = await supabase
            .from("legs")
            .select("*")
            .eq("status", "live");

        if (error) throw error;

        if (liveLegs) {
            for (const leg of liveLegs) {
                await processLegSimTick(leg);
            }
        }
    } catch (error) {
        console.error("❌ Failed to query database legs:", error.message);
    }
};

// Start route ticker loops every 15 seconds
setInterval(runSimulatorLoop, 15000);

// Initialize debugging HTTP helper server
const app = express();
app.use(cors());
const PORT = process.env.SIMULATOR_PORT || 8000;

app.get("/status", (req, res) => {
    res.json({
        status: "online",
        activeLegsCount: activePaths.size,
        monitoredLegs: Array.from(activePaths.keys())
    });
});

app.listen(PORT, () => {
    console.log(`📊 Diagnostic status dashboard running on http://localhost:${PORT}/status`);
});
