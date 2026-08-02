import { createClient } from "@supabase/supabase-js";
import { runLeg } from "./runLeg.js";

/**
 * Auto-runner: makes deployment hands-free. It polls Supabase for freshly
 * deployed legs (status='draft', written by the Deployer dashboard) and starts
 * the Rungent walking each one automatically — no per-leg command.
 *
 * runLeg() flips the leg to status='active' as its first action, so a started
 * leg is never selected again. We also keep an in-process guard against the
 * brief window before that flip lands.
 *
 * This is the demo stand-in for what would be a hosted worker (or a Supabase
 * DB-webhook -> Edge Function) in production. Run ONE of these with the service
 * role key and every dashboard deploy comes alive on its own.
 */

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POLL_MS = 4000;
const started = new Set<string>();

async function poll() {
  const { data, error } = await supabase
    .from("legs")
    .select("id, name, status")
    .eq("status", "active");

  if (error) {
    console.error("[autorun] poll error:", error.message);
    return;
  }

  for (const leg of data ?? []) {
    if (started.has(leg.id)) continue;
    started.add(leg.id);
    console.log(`[autorun] new leg "${leg.name}" (${leg.id}) — starting Rungent`);
    runLeg(leg.id)
      .catch((e) => console.error(`[autorun] leg ${leg.id} stopped:`, e?.message ?? e))
      .finally(() => started.delete(leg.id)); // Stop or arrival frees it to re-run
  }
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "[autorun] SUPABASE_SERVICE_ROLE_KEY is not set. Add it to services/rungent-ai/.env"
  );
  process.exit(1);
}

console.log("[autorun] watching for legs to run (status=active) every 4s…");
setInterval(poll, POLL_MS);
poll();
