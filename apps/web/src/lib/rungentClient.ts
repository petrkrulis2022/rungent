import { supabase } from "./supabase";

export interface RungentView {
  lat: number | null;
  lng: number | null;
  alt: number | null;
  mode: "idle" | "walk" | "run" | null;
  heading_deg: number | null;
  status: "alive" | "down";
  distance_m: number | null;
  in_range: boolean;
}

/**
 * The ONLY way a client learns the Rungent's position.
 *
 * Note what this deliberately does not do: there is no `select` on
 * rungent_state anywhere in the client. That table has RLS on with zero
 * policies, so even a modified client holding the anon key gets nothing. Out
 * of range, this returns nulls for position — not a coarse or fuzzed value,
 * because a coarse value plus movement lets a hunter triangulate.
 */
export async function fetchRungent(
  legId: string,
  hunterLat: number,
  hunterLng: number
): Promise<RungentView | null> {
  const { data, error } = await supabase.rpc("get_rungent_for_hunter", {
    p_leg_id: legId,
    p_hunter_lat: hunterLat,
    p_hunter_lng: hunterLng,
  });

  if (error) {
    console.error("[rungent] rpc failed", error.message);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  return (row as RungentView) ?? null;
}

/** Push the hunter's live position so other hunters and the Rungent can see them. */
export async function pushHunterPosition(
  legId: string,
  wallet: string,
  lat: number,
  lng: number,
  alt: number | null
) {
  const { error } = await supabase.from("hunters").upsert(
    {
      leg_id: legId,
      wallet_addr: wallet.toLowerCase(),
      last_lat: lat,
      last_lng: lng,
      last_alt: alt ?? 0,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "leg_id,wallet_addr" }
  );
  if (error) console.error("[hunter] position push failed", error.message);
}

export async function fetchLeg(legId: string) {
  const { data, error } = await supabase.from("legs").select("*").eq("id", legId).single();
  if (error) throw new Error(`Leg not found: ${error.message}`);
  return data;
}

export async function fetchGunItem(legId: string) {
  const { data } = await supabase
    .from("items")
    .select("*")
    .eq("leg_id", legId)
    .eq("kind", "gun")
    .maybeSingle();
  return data;
}

/**
 * Request a takedown. This is a REQUEST, never an assertion — the Edge
 * Function re-validates distance and lock against the server's own truth and
 * is the only party that can write a verified catch or move escrow funds.
 */
export async function requestTakedown(params: {
  legId: string;
  wallet: string;
  method: "shoot" | "catch";
  lat: number;
  lng: number;
}): Promise<{ ok: boolean; message: string; txHash?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("adjudicate", {
      body: {
        leg_id: params.legId,
        hunter_wallet: params.wallet,
        method: params.method,
        claimed_lat: params.lat,
        claimed_lng: params.lng,
      },
    });
    if (error) return { ok: false, message: error.message };
    return data as { ok: boolean; message: string; txHash?: string };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? "Takedown request failed" };
  }
}

/**
 * DEV/TESTING ONLY: the Rungent's live position for the hunter minimap, read
 * from the (anon-readable) events feed the worker publishes. Bypasses the range
 * gate on purpose so you can find it on a laptop — delay/drop it for the game.
 */
export interface DevPosition {
  lat: number;
  lng: number;
  mode?: string;
}
export async function fetchDevPosition(legId: string): Promise<DevPosition | null> {
  const { data } = await supabase
    .from("events")
    .select("payload")
    .eq("leg_id", legId)
    .eq("type", "rungent_position")
    .order("ts", { ascending: false })
    .limit(1);
  const row = Array.isArray(data) ? data[0] : data;
  return (row?.payload as DevPosition) ?? null;
}
