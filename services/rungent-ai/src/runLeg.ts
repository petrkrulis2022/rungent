import { createClient } from "@supabase/supabase-js";
import { buildRoute, initialState, step, hasArrived, type SimState, type CommittedRoute } from "./simulator.js";
import { haversineMeters, ENGAGEMENT_RANGE_M } from "@rundown/shared";
import ws from "ws";

// Node < 22 has no native WebSocket; @supabase realtime needs one at client init.
if (!(globalThis as any).WebSocket) (globalThis as any).WebSocket = ws as unknown as typeof WebSocket;

/**
 * The Rungent service: a strategy layer (Claude) wrapped around the
 * deterministic simulator.
 *
 * The separation is the whole point. Claude returns an INTENT; the simulator
 * decides what actually happens to the position. Even a fully adversarial or
 * malfunctioning model cannot make the Rungent teleport, exceed the speed cap,
 * or leave its committed route — those states have no representation.
 *
 * Runs with the SERVICE ROLE key. `rungent_state` has RLS on with zero
 * policies, so nothing else can write here.
 */

const TICK_MS = 1000;
const BRAIN_INTERVAL_MS = 30_000;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Intent {
  mode: "idle" | "walk" | "run";
  direction: 1 | -1;
  say?: string;
}

/** Ask Claude for an intent. Falls back to a sane default on any failure. */
async function think(params: {
  legName: string;
  personality: string;
  story: string;
  progressM: number;
  totalM: number;
  nearbyHunters: Array<{ distanceM: number }>;
  justSpotted: boolean;
}): Promise<Intent> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { mode: "walk", direction: 1 };
  }

  const closest = params.nearbyHunters.length
    ? Math.min(...params.nearbyHunters.map((h) => h.distanceM))
    : null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: [
          {
            type: "text",
            // Cached: this block is static per leg, so we avoid paying for it
            // on every 30s tick.
            text:
              `You are ${params.legName}, an autonomous runner in the game RUNDOWN.\n` +
              `Story: ${params.story}\nPersonality: ${params.personality}\n\n` +
              `You travel on foot along a fixed route. Hunters try to find you.\n` +
              `You may walk (6km/h), run (10km/h), or idle. You may move forward ` +
              `along your route (direction 1) or double back (direction -1).\n` +
              `Running is faster but you should not run constantly — it is not ` +
              `interesting to watch. Respond ONLY with JSON, no prose, no markdown:\n` +
              `{"mode":"walk|run|idle","direction":1|-1,"say":"optional short line in character"}`,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content:
              `Progress: ${params.progressM.toFixed(0)}m of ${params.totalM.toFixed(0)}m.\n` +
              `Hunters within ${ENGAGEMENT_RANGE_M}m: ${params.nearbyHunters.length}` +
              (closest !== null ? ` (closest ${closest.toFixed(0)}m)` : "") +
              `.\n${params.justSpotted ? "A hunter just came into range for the first time." : ""}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = (data.content ?? [])
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());

    return {
      mode: ["idle", "walk", "run"].includes(parsed.mode) ? parsed.mode : "walk",
      direction: parsed.direction === -1 ? -1 : 1,
      say: typeof parsed.say === "string" ? parsed.say.slice(0, 200) : undefined,
    };
  } catch (e) {
    console.error("[brain] falling back to default intent", e);
    return { mode: "walk", direction: 1 };
  }
}

export async function runLeg(legId: string) {
  const { data: leg, error } = await supabase.from("legs").select("*").eq("id", legId).single();
  if (error || !leg) throw new Error(`Leg ${legId} not found`);

  const route: CommittedRoute = buildRoute(leg.route_polyline);
  let state: SimState = initialState(route);
  let intent: Intent = { mode: "walk", direction: 1 };
  let lastBrain = 0;
  let lastPosPublish = 0;
  const seenHunters = new Set<string>();

  console.log(`[rungent] ${leg.name} starting — ${route.totalLengthM.toFixed(0)}m route`);

  await supabase.from("legs").update({ status: "active" }).eq("id", legId);

  while (true) {
    const { data: live } = await supabase
      .from("rungent_state")
      .select("status")
      .eq("leg_id", legId)
      .maybeSingle();
    if (live?.status === "down") {
      console.log("[rungent] down — stopping");
      break;
    }

    // Deployer pressed Stop (dashboard flipped the leg out of 'active') -> halt.
    const { data: legNow } = await supabase
      .from("legs")
      .select("status")
      .eq("id", legId)
      .maybeSingle();
    if (legNow && legNow.status !== "active") {
      console.log(`[rungent] leg no longer active (status=${legNow.status}) — stopping`);
      break;
    }

    // who is nearby?
    const { data: hunters } = await supabase
      .from("hunters")
      .select("wallet_addr,last_lat,last_lng")
      .eq("leg_id", legId);

    const nearby = (hunters ?? [])
      .filter((h) => h.last_lat != null)
      .map((h) => ({
        wallet: h.wallet_addr,
        distanceM: haversineMeters(
          { lat: state.lat, lng: state.lng },
          { lat: h.last_lat, lng: h.last_lng }
        ),
      }))
      .filter((h) => h.distanceM <= ENGAGEMENT_RANGE_M);

    const justSpotted = nearby.some((h) => !seenHunters.has(h.wallet));
    nearby.forEach((h) => seenHunters.add(h.wallet));

    // strategy tick — or immediately when a hunter first appears, so the
    // "it noticed me" beat lands without waiting up to 30s
    if (Date.now() - lastBrain > BRAIN_INTERVAL_MS || justSpotted) {
      lastBrain = Date.now();
      intent = await think({
        legName: leg.name,
        personality: leg.skills?.personality ?? "",
        story: leg.story ?? "",
        progressM: state.progressM,
        totalM: route.totalLengthM,
        nearbyHunters: nearby,
        justSpotted,
      });
      if (intent.say) {
        await supabase.from("events").insert({
          leg_id: legId,
          type: "rungent_speech",
          payload: { text: intent.say },
        });
      }
    }

    // movement tick — the LLM's intent is an input here, never a position
    state = step(route, state, { mode: intent.mode, direction: intent.direction }, TICK_MS / 1000);

    // When a hunter is in range, face them. This is the "it turns and looks
    // at me" beat, and it is purely cosmetic — heading never affects where
    // the simulator can move.
    let headingDeg = state.headingDeg;
    if (nearby.length) {
      const closest = nearby.reduce((a, b) => (a.distanceM < b.distanceM ? a : b));
      const h = (hunters ?? []).find((x) => x.wallet_addr === closest.wallet);
      if (h?.last_lat != null) {
        const latRad = (state.lat * Math.PI) / 180;
        const east = (h.last_lng - state.lng) * Math.cos(latRad);
        const north = h.last_lat - state.lat;
        headingDeg = ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360;
      }
    }

    await supabase.from("rungent_state").upsert({
      leg_id: legId,
      true_lat: state.lat,
      true_lng: state.lng,
      true_alt: state.alt,
      route_progress_m: state.progressM,
      mode: state.mode,
      speed_kmh: state.speedKmh,
      heading_deg: headingDeg,
      status: "alive",
      updated_at: new Date().toISOString(),
    });

    // DEV/TESTING minimap feed: publish live position to the (anon-readable)
    // events table so the hunter minimap can show which way to walk. This
    // bypasses the range gate on purpose; delay or remove it for the real game.
    if (Date.now() - lastPosPublish > 2000) {
      lastPosPublish = Date.now();
      await supabase.from("events").insert({
        leg_id: legId,
        type: "rungent_position",
        payload: { lat: state.lat, lng: state.lng, mode: state.mode },
      });
    }

    if (hasArrived(route, state)) {
      console.log("[rungent] reached the end point uncaught");
      await supabase.from("events").insert({ leg_id: legId, type: "rungent_arrived", payload: {} });
      break;
    }

    await new Promise((r) => setTimeout(r, TICK_MS));
  }
}

const legId = process.argv[2];
if (legId) {
  runLeg(legId).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  console.log("Usage: pnpm --filter @rundown/rungent-ai start <legId>");
}
