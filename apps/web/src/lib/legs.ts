import { ethers } from "ethers";
import { supabase } from "./supabase";
import type { PlannedRoutePoint } from "./maps";

export interface LegDraft {
  name: string;
  story: string;
  personality: string;
  deployerWallet: string;
  start: { lat: number; lng: number };
  end: { lat: number; lng: number };
  route: PlannedRoutePoint[];
  routeLengthM: number;
  prizeAmount: string;
}

/**
 * The rules hash committed on-chain. Everything that defines how the leg is
 * played goes in here, so that after commit nobody — including the deployer —
 * can quietly change the terms and still match the on-chain record.
 *
 * Order matters: this must be reproducible byte-for-byte by any verifier.
 */
export function computeRulesHash(draft: LegDraft): string {
  const canonical = JSON.stringify({
    name: draft.name,
    story: draft.story,
    personality: draft.personality,
    start: { lat: round7(draft.start.lat), lng: round7(draft.start.lng) },
    end: { lat: round7(draft.end.lat), lng: round7(draft.end.lng) },
    routeLengthM: Math.round(draft.routeLengthM),
    // The full polyline is hashed too — otherwise the operator could swap in
    // a shorter route after commit and the on-chain record wouldn't notice.
    route: draft.route.map((p) => [round7(p.lat), round7(p.lng)]),
    speedCaps: { walkKmh: 6, runKmh: 10 },
    engagementRangeM: 75,
    catchRangeM: 22,
    prizeAmount: draft.prizeAmount,
  });
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(canonical));
}

function round7(n: number): number {
  return Math.round(n * 1e7) / 1e7;
}

/** legId for the on-chain commit: a bytes32 derived from the Supabase row id. */
export function legIdToBytes32(uuid: string): string {
  return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(uuid));
}

export async function createLeg(draft: LegDraft) {
  const rulesHash = computeRulesHash(draft);

  const { data, error } = await supabase
    .from("legs")
    .insert({
      name: draft.name,
      story: draft.story,
      deployer_wallet: draft.deployerWallet.toLowerCase(),
      start_lat: draft.start.lat,
      start_lng: draft.start.lng,
      start_alt: draft.route[0]?.alt ?? 0,
      end_lat: draft.end.lat,
      end_lng: draft.end.lng,
      end_alt: draft.route[draft.route.length - 1]?.alt ?? 0,
      skills: { personality: draft.personality },
      route_polyline: draft.route,
      route_length_m: draft.routeLengthM,
      rules_hash: rulesHash,
      prize_amount: draft.prizeAmount,
      status: "draft",
    })
    .select()
    .single();

  if (error) throw new Error(`Supabase insert failed: ${error.message}`);
  return { leg: data, rulesHash };
}

/** Shareable hunt link — the whole point of the demo being a web app. */
export function huntLinkFor(legId: string): string {
  // Copy-paste-ready hunter link: the hunter dev port (5174) with real device
  // GPS (not the deployer port, not mock geo).
  const u = new URL(window.location.origin);
  u.port = "5174";
  return `${u.origin}/?role=hunter&leg=${legId}&geo=device`;
}

/** Deployer control: start (status=active) or stop (back to draft) the walk. */
export async function setLegStatus(legId: string, status: "active" | "draft") {
  const { error } = await supabase.from("legs").update({ status }).eq("id", legId);
  if (error)
    throw new Error(
      `Could not ${status === "active" ? "start" : "stop"} the Rungent: ${error.message}`
    );
}

export async function getLegStatus(legId: string): Promise<string | null> {
  const { data } = await supabase.from("legs").select("status").eq("id", legId).single();
  return data?.status ?? null;
}
