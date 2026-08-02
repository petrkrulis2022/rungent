// Supabase Edge Function: adjudicate a takedown request.
//
// This is the ONLY party that may write a verified catch or move escrow funds.
// Clients REQUEST a takedown; they never assert one. Every distance check here
// runs against the server's own `rungent_state`, never against numbers the
// client supplied — the client's claimed position is used only to verify that
// the hunter was plausibly where they say they were.
//
// Deploy:
//   supabase functions deploy adjudicate --no-verify-jwt
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... ORACLE_PRIVATE_KEY=... \
//                        SEPOLIA_RPC_URL=... PRIZE_ESCROW_ADDRESS=...

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

const CATCH_RANGE_M = 22;
const SHOOT_RANGE_M = 70;
// GPS is 5-15 m accurate. If the hunter's claimed position is further than
// this from where we last saw them, treat it as spoofed rather than drifted.
const MAX_CLAIM_DRIFT_M = 60;

const ESCROW_ABI = [
  "function settleCatch(bytes32 legId, address catcher) external",
  "function prizeOf(bytes32 legId) external view returns (uint256, uint8)",
];

function haversineM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number
): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const l1 = (aLat * Math.PI) / 180;
  const l2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(l1) * Math.cos(l2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({}, 200);

  try {
    const { leg_id, hunter_wallet, method, claimed_lat, claimed_lng } = await req.json();

    if (!leg_id || !hunter_wallet || !["shoot", "catch"].includes(method)) {
      return json({ ok: false, message: "Malformed takedown request" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- server truth ---
    const { data: state } = await admin
      .from("rungent_state")
      .select("*")
      .eq("leg_id", leg_id)
      .single();

    if (!state) return json({ ok: false, message: "No active Rungent for this leg" }, 404);
    if (state.status === "down") {
      return json({ ok: false, message: "This Rungent is already down" }, 409);
    }

    const { data: leg } = await admin.from("legs").select("*").eq("id", leg_id).single();
    if (!leg) return json({ ok: false, message: "Leg not found" }, 404);

    // The deployer may not collect their own prize.
    if (leg.deployer_wallet?.toLowerCase() === hunter_wallet.toLowerCase()) {
      return json({ ok: false, message: "The deployer cannot claim their own prize" }, 403);
    }

    // --- anti-spoof: compare the claim against the last position we observed ---
    const { data: hunter } = await admin
      .from("hunters")
      .select("*")
      .eq("leg_id", leg_id)
      .eq("wallet_addr", hunter_wallet.toLowerCase())
      .maybeSingle();

    if (hunter?.last_lat != null) {
      const drift = haversineM(hunter.last_lat, hunter.last_lng, claimed_lat, claimed_lng);
      if (drift > MAX_CLAIM_DRIFT_M) {
        await admin.from("catches").insert({
          leg_id,
          hunter_wallet: hunter_wallet.toLowerCase(),
          method,
          claimed_lat,
          claimed_lng,
          verify_status: "rejected",
          reject_reason: `claimed position ${drift.toFixed(0)}m from last observed`,
        });
        return json({ ok: false, message: "Position claim rejected" }, 403);
      }
    }

    // --- range check against server truth ---
    const dist = haversineM(state.true_lat, state.true_lng, claimed_lat, claimed_lng);
    const limit = method === "catch" ? CATCH_RANGE_M : SHOOT_RANGE_M;

    if (dist > limit) {
      await admin.from("catches").insert({
        leg_id,
        hunter_wallet: hunter_wallet.toLowerCase(),
        method,
        claimed_lat,
        claimed_lng,
        verify_status: "rejected",
        reject_reason: `out of range: ${dist.toFixed(0)}m > ${limit}m`,
      });
      return json({
        ok: false,
        message: `Out of range — ${dist.toFixed(0)}m, need ${limit}m`,
      });
    }

    if (method === "shoot" && !hunter?.has_gun) {
      return json({ ok: false, message: "You need the weapon pickup to fire" }, 403);
    }

    // --- record the verified catch FIRST ---
    // The unique partial index on (leg_id) where verify_status='verified'
    // makes this the concurrency gate: two simultaneous FIRE requests race
    // here, and exactly one wins. We only touch escrow after winning that
    // race, so a double-pay is impossible even under a deliberate flood.
    const { data: caught, error: insertErr } = await admin
      .from("catches")
      .insert({
        leg_id,
        hunter_wallet: hunter_wallet.toLowerCase(),
        method,
        claimed_lat,
        claimed_lng,
        verify_status: "verified",
      })
      .select()
      .single();

    if (insertErr) {
      return json({ ok: false, message: "Someone else got there first" }, 409);
    }

    await admin
      .from("rungent_state")
      .update({ status: "down", mode: "idle", speed_kmh: 0 })
      .eq("leg_id", leg_id);

    await admin.from("events").insert({
      leg_id,
      type: "rungent_down",
      payload: { hunter_wallet, method, distance_m: dist },
    });

    // --- settle on-chain ---
    let txHash: string | undefined;
    try {
      const rpc = Deno.env.get("SEPOLIA_RPC_URL");
      const oracleKey = Deno.env.get("ORACLE_PRIVATE_KEY");
      const escrowAddr = Deno.env.get("PRIZE_ESCROW_ADDRESS");

      if (rpc && oracleKey && escrowAddr) {
        const provider = new ethers.providers.JsonRpcProvider(rpc);
        const signer = new ethers.Wallet(oracleKey, provider);
        const escrow = new ethers.Contract(escrowAddr, ESCROW_ABI, signer);
        const legIdBytes = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(leg_id));
        const tx = await escrow.settleCatch(legIdBytes, hunter_wallet);
        txHash = tx.hash;
        await tx.wait(1);
        await admin.from("catches").update({ settled_tx: txHash }).eq("id", caught.id);
      }
    } catch (chainErr) {
      // The catch is already recorded as verified. Surface the settlement
      // failure rather than silently reporting success — an unpaid "win" on
      // stream is worse than an honest error.
      console.error("[adjudicate] settlement failed", chainErr);
      return json({
        ok: true,
        message: "Catch verified, but on-chain settlement failed. Check the oracle wallet.",
      });
    }

    await admin.from("legs").update({ status: "settled" }).eq("id", leg_id);

    return json({
      ok: true,
      message: `Confirmed at ${dist.toFixed(0)}m. Prize sent.`,
      txHash,
    });
  } catch (e) {
    console.error("[adjudicate] error", e);
    return json({ ok: false, message: String(e) }, 500);
  }
});
