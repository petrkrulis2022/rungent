import { createClient } from "@supabase/supabase-js";

// Note: Under Vite, env variables must use the VITE_ prefix to be exposed to client-side code details
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder-url.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

if (supabaseUrl.includes("placeholder-url")) {
  console.warn("⚠️ Warning: VITE_SUPABASE_URL is not set. Supabase connections will revert to offline fallback mocks.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Service to sync hunter coordinate signals to Postgres geography schema.
 */
export const updateHunterLocation = async (legId, wallet, lat, lng, alt) => {
  if (supabaseUrl.includes("placeholder-url")) return null;

  try {
    const { data, error } = await supabase
      .from("hunters")
      .upsert(
        {
          leg_id: legId,
          wallet_addr: wallet,
          last_lat: lat,
          last_lng: lng,
          last_alt: alt,
          last_seen_at: new Date().toISOString()
        },
        { onConflict: "leg_id,wallet_addr" }
      )
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Failed to push hunter telemetry coordinates:", error);
    return null;
  }
};

/**
 * Service to retrieve delayed breadcrumbs coordinates of active Rungents.
 */
export const fetchRungentTrail = async (legId) => {
  if (supabaseUrl.includes("placeholder-url")) return [];

  try {
    const { data, error } = await supabase
      .from("rungent_breadcrumbs")
      .select("*")
      .eq("leg_id", legId)
      .order("ts", { ascending: false });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("❌ Failed to fetch breadcrumbs:", error);
    return [];
  }
};

/**
 * Subscribes to real-time events, such as Rungent alerts or items deployed nearby.
 */
export const subscribeToLegEvents = (legId, onEvent) => {
  if (supabaseUrl.includes("placeholder-url")) {
    return { unsubscribe: () => {} };
  }

  return supabase
    .channel(`leg-events:${legId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "events",
        filter: `leg_id=eq.${legId}`
      },
      (payload) => {
        onEvent(payload.new);
      }
    )
    .subscribe();
};
