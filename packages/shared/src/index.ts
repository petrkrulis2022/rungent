// Shared types across web, services, and contracts scripts.

export type WalletAddress = `0x${string}`;

export type RungentMode = "idle" | "walk" | "run";
export type LegStatus = "draft" | "committed" | "active" | "settled";

export interface LatLng {
  lat: number;
  lng: number;
  alt?: number;
}

export interface SkillsConfig {
  // v1 demo scope: keep this open-ended but minimal.
  personality: string; // short system-prompt flavor text, e.g. "cocky, taunts hunters"
  pingJam?: boolean; // the one v1-scoped skill carried over from the RUNDOWN concept doc
}

export interface Leg {
  id: string;
  name: string;
  story: string;
  deployerWallet: WalletAddress;
  start: LatLng;
  end: LatLng;
  skills: SkillsConfig;
  rulesHash: string;
  prizeEscrowAddr: WalletAddress;
  operatingWalletAddr: WalletAddress;
  prizeAmount: string; // decimal string, USDC units
  onchainCommitTx?: string;
  status: LegStatus;
}

export interface RungentState {
  legId: string;
  truLat: number; // NOTE: never exposed to clients directly except via range-gated RPC
  trueLng: number;
  trueAlt: number;
  mode: RungentMode;
  speedKmh: number;
  headingDeg: number;
  status: "alive" | "down";
  updatedAt: string;
}

export interface Hunter {
  legId: string;
  walletAddr: WalletAddress;
  displayName: string;
  avatarGlb?: string;
  lastLat?: number;
  lastLng?: number;
  lastAlt?: number;
  lastSeenAt?: string;
}

export type ItemKind = "gun";
export interface Item {
  legId: string;
  kind: ItemKind;
  lat: number;
  lng: number;
  alt?: number;
  status: "available" | "held" | "consumed";
  ownerWallet?: WalletAddress;
}

export type CatchMethod = "shoot" | "catch";
export interface CatchRecord {
  legId: string;
  hunterWallet: WalletAddress;
  method: CatchMethod;
  claimedLat: number;
  claimedLng: number;
  ts: string;
  verifyStatus: "pending" | "verified" | "rejected";
  settledTx?: string;
}

// --- Geo constants shared between the AR client and the movement simulator ---
export const ENGAGEMENT_RANGE_M = 75;
export const CATCH_RANGE_M = 22;
export const SHOOT_LOCK_RANGE_M = 70;
export const SHOOT_LOCK_MS = 1000;
export const CATCH_HOLD_MS = 3000;
// Doubled from real-world walking/running pace (6/10) so a demo does not
// spend minutes waiting for the Rungent to come into range.
export const WALK_KMH = 12;
export const RUN_KMH = 20;

/** Equirectangular offset approximation, meters. Good enough at demo scale (<2km legs). */
export function geoOffsetMeters(from: LatLng, to: LatLng): { east: number; north: number } {
  const latRad = (from.lat * Math.PI) / 180;
  const east = (to.lng - from.lng) * Math.cos(latRad) * 111320;
  const north = (to.lat - from.lat) * 110540;
  return { east, north };
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
