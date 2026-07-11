# RUNDOWN — Full Technical Stack & Architecture

**Platform / show:** RUNDOWN · **The AI runner (character/type):** Rungent
**Version:** 0.1
**Date:** June 29, 2026
**Audience:** engineering team building RUNDOWN (runner: Rungent) in a **separate codebase** (this doc
is self-contained so it can be lifted out wholesale).

> Rungent reuses the **CubePay / AgentSphere** primitives (agent-with-wallet, AR object
> deployment, GPS anchoring, movement, real-time sync, multi-chain payments) but adds a large new
> surface: **server-authoritative real-time multiplayer, an AI routing brain, hardened anti-cheat,
> mapping/transit routing, and a broadcast/POV layer.** Treat it as a new app that **shares the
> CubePay backend + wallet stack** rather than a fork of the AR Viewer.

---

## 1. What we REUSE from CubePay / AgentSphere

| Capability | Where it lives today | How Rungent uses it |
|------------|----------------------|---------------------|
| **Agent = AR object with a wallet** | AgentSphere `deployed_objects` + payment services | The Rungent *and* every AR item is an agent with a wallet |
| **AR rendering of 3D models over camera** | `Enhanced3DAgent.jsx`, `AR3DScene.jsx` (React Three Fiber + Three.js) | Renders the Rungent figure + Hunter avatars + items |
| **GPS + screen positioning + movement** | `positioning_mode` (gps/screen), `latitude/longitude`, move scripts | Rungent + Hunter + item world positions |
| **Real-time position sync** | Supabase Realtime | Live Hunter positions, delayed Rungent breadcrumbs |
| **Tap-to-interact** | agent modals / CubePaymentEngine | Catch/shoot trigger + item rental UI |
| **Multi-chain payments** | `hederaPaymentService`, `solanaPaymentService`, `evmPaymentService`, ENS, etc. | Rungent pays item providers; prize-pool payouts |
| **Per-trade escrow pattern** | `../contracts/P2PEscrow.sol` (P2P Cube) | Prize-pool escrow + item stake-for-pot-share |
| **Agent hash filter** | `ARViewer.jsx` filter logic | Show only the relevant Rungent/items to a Hunter |
| **On-the-fly agent deployment** | AgentSphere deploy flow | "Instant local Rungent" demo (drop at any lat/lng) |

**Net:** roughly the entire *client AR + payments + agent data model* is reusable. The new build
is the **game server, AI brain, anti-cheat, mapping/transit, and broadcast.**

---

## 2. NEW tech we need (by subsystem)

### 2.1 Real-time multiplayer game state (the biggest new piece)

The Rungent loop is a **server-authoritative real-time game**. Supabase Realtime is fine for a
small beta but won't carry a city of concurrent Hunters with sub-second authoritative updates.

| Option | Notes |
|--------|-------|
| **Supabase Realtime + PostGIS** (start) | Reuses our backend; good to ~hundreds of clients/Leg; Postgres `LISTEN/NOTIFY` + `ST_DWithin` proximity. Use for Phase 0–1. |
| **Colyseus** (self-host authoritative rooms) | Purpose-built authoritative game server (rooms = Legs); great fit; Node/TS. **Recommended** for Phase 2+. |
| **Ably / PubNub** (managed pub/sub + presence) | Managed scale, geospatial presence; less authoritative logic, pair with our own state service. |
| **SpacetimeDB / Hathora / Photon** | Heavier game-infra options if we go Unity. |

**Geospatial:** **PostGIS** for proximity/geofence queries; **H3** (Uber hex grid) for spatial
bucketing of Hunters/items and efficient "who's near whom" lookups.

### 2.2 AR client

| Option | Pros | Cons | When |
|--------|------|------|------|
| **WebXR + React Three Fiber** (extend current stack) | Reuses everything; no install; fastest | Weaker world-tracking, no occlusion, iOS WebXR gaps | Phase 0 demos |
| **8th Wall** (web AR, markerless, VPS) | Web, strong tracking, location AR, shareable links | Paid; still web-perf bound | Phase 1 public web AR |
| **Niantic Lightship ARDK / Studio** | Built *for* this exact genre (real-world AR, VPS, meshing, semantics) | Unity; new codebase/skillset | Phase 2 native |
| **Unity + AR Foundation (ARKit/ARCore)** | Richest AR, occlusion, glasses-ready | Heaviest; separate engine | Phase 2–3 / glasses |

**Recommendation:** Phase 0/1 on **WebXR/8th Wall** to reuse the stack and ship fast; plan a
**Unity + Lightship** native track for Phase 2 when AR fidelity and AR-glasses matter.

### 2.3 Mapping, routing & transit (the Rungent's "legal moves")

- **Google Maps Platform**: **Directions API** (walk/bike/drive/transit routes), **Roads API**
  (snap-to-road, plausibility), **Routes API**, **Places**, **Street View Static** (POV),
  **Photorealistic 3D Tiles** (Rungent-POV cinematic).
- **Alternatives / cost control**: **Mapbox** (already a dependency — `mapbox-gl`, `react-map-gl`)
  for display; **OSRM / Valhalla** (self-host) for routing; **OpenTripPlanner + GTFS** for real
  transit timetables.
- **Transit realism**: ingest **GTFS** feeds per city so the Rungent only "takes" trains/buses
  that actually run, at real times → predictable stations = ambush points (good game design).

### 2.4 The Rungent AI brain

Two layers (see `rundown.md` §7):

1. **Strategy layer — LLM agent.** Use **Claude (latest, e.g. `claude-opus-4-8`)** as the
   decision-maker: a tool-using agent that, each decision tick, is given structured state
   (position, time-to-goal, nearby Hunter density/headings, energy, items, personality) and
   returns an *intent*. Implement with the **Claude API / Agent SDK** (tool use for "query route",
   "check hunters nearby", "buy item", "use skill"). Prompt encodes personality + "cunning but
   human-bounded."
   - Refer to `../claude-api` reference for model IDs, tool use, and caching. Cache the static
     system prompt (personality/rules) to cut cost on every tick.
2. **Movement/physics layer — deterministic.** Converts intent → a real route (routing engine) →
   advances position at **mode-capped speeds** with dwell/rest. **Server commits true position.**
   This layer is plain TypeScript, fully testable, and is what enforces fairness.

**Training/eval:** staff-operator beta logs (state → human decision → outcome) become an offline
eval set; later, reinforcement-style tuning of the strategy prompt/policy against "did Hunters get
an interesting hunt + fair win-rate."

### 2.5 Anti-cheat / integrity

- **Device attestation:** Google **Play Integrity API** (Android), Apple **App Attest / DeviceCheck**
  (iOS); detect mock-location, rooting, emulators.
- **Movement plausibility service:** speed/accel caps, map-matching (Roads API/OSRM), sensor
  cross-checks (step counter / IMU vs claimed motion), continuity checks on the compulsory avatar.
- **Server-authoritative everything:** catches/shots are *requests*; the server adjudicates.
- **Telemetry + anomaly detection:** flag teleports, GPS jitter exploits, indoor spoofs.

### 2.6 Broadcast & "Rungent POV"

- **Spectator live map:** Mapbox/Maps web app fed by the game-state service.
- **Live video:** **LiveKit** (self-host/managed WebRTC) or **Mux** for ingest/streaming; **Twitch
  / Kick / YouTube / pump.fun** via their stream/RTMP for founder streams.
- **Rungent-POV cinematic:** **Google Photorealistic 3D Tiles** (render via **CesiumJS** or Maps
  JS 3D), **Google Earth Studio** for pre-rendered flythroughs, **Street View** for ground POV.
- **Clip pipeline:** auto-cut vertical highlights (catch-of-the-day) for TikTok/Reels/Shorts.

### 2.7 Crypto / economy

- **Reuse:** CubePay multi-chain wallet + payment services; the `P2PEscrow.sol` pattern for the
  **prize-pool escrow** and **item stake-for-pot-share**.
- **Prize-pool contract:** holds sponsor funds; pays out to winner(s)/backers on the
  server-attested leg result (oracle/multisig-gated release).
- **Token launch (optional):** **Solana** + **pump.fun** for the community token (Demo B). Keep it
  isolated from prize custody. (Legal review — see `rundown.md` §19.)
- **Backing/prediction market (deferred):** licensed module; could be on-chain (Polymarket-style)
  but jurisdiction-locked.

### 2.8 Mobile & client delivery

- **Phase 0/1:** **PWA / mobile web** (reuses React stack, instant shareable links — great for the
  investor demo "open this link, hunt it now").
- **Phase 2+:** **React Native** (shared TS/business logic) wrapping native AR, or **Unity** for
  the AR-heavy native client. AR glasses (Phase 4) → Unity/Lightship or vendor SDKs.

### 2.9 Backend services (new)

- **Game-state authority** (Colyseus/Node) — rooms = Legs, authoritative positions, catch/shot
  adjudication.
- **AI orchestrator** — runs the Rungent strategy ticks (Claude) + movement simulator.
- **Leg scheduler** — story/area/start/destination/checkpoints, active-window timer, spawn/expire.
- **Anti-cheat service** — attestation + plausibility.
- **Payout engine** — escrow funding, result attestation, distribution + platform rake.
- **Geo service** — PostGIS/H3 proximity, geofence enforcement, GTFS transit.
- **Broadcast service** — spectator feed, clip generation.
- **Shared:** Supabase (Postgres + Auth + Storage) as today; the Rungent app reads/writes the same
  agent/wallet model.

### 2.10 AR-glasses track — Google XR Blocks (v2/v3 north star, NOT v1)

Our long-term "best way to play" is **AR glasses**. When we get there, adopt **Google XR Blocks**
(`github.com/google/xrblocks`) — an open-source **WebXR + Three.js + Gemini** framework for AI+XR.

**Why it fits the glasses future:**
- **Same 3D stack** — Three.js + WebXR (we're React Three Fiber, a Three.js wrapper), so the glowing
  Rungent model/shader and skills port over with low switching cost.
- **The hard glasses UX is pre-built:** its "Reality Model" gives **gaze + gesture aiming** (shoot the
  Rungent by looking/pointing), **occlusion** (Rungent ducks behind real buildings), **avatars**,
  depth/lighting, and **remote-peer multi-user**.
- **Agent-native:** its `ai` module treats an AI character as a first-class **Intelligent entity** —
  exactly the Rungent (swap Gemini for our Claude brain; Gemini Live could drive in-range voice).
- Aligns with our all-Google maps/infra choice; the **XR Blocks Gem** (vibe-coding IDE) is good for a
  fast headset marketing spike.

**Why it is NOT the v1 foundation (do not build the phone demo on it):**
- **No geolocation / outdoor world anchoring** — it's device-relative, room-scale, depth-based; RUNDOWN
  needs city-scale GPS+altitude anchoring (still ours / ARCore Geospatial / Niantic VPS regardless).
- **Headset-first; WebXR AR does NOT run on iOS Safari** — v1 is phone-first incl. iPhones, so the
  R3F + `getUserMedia` + Geolocation approach stays for v1.
- Research-grade framework tied to just-launching Android XR hardware (Galaxy XR / Project Aura).

**Borrow now, even on phone v1:** adopt its **Reality Model vocabulary** to structure the code —
Rungent = *Intelligent entity*, hunters = *Social entities/avatars*, items = *Virtual assets* — and its
**agent-as-scene-entity** pattern (matches our two-layer brain).

---

## 3. Reference architecture

```
┌─────────────────────── CLIENTS ───────────────────────┐
│ Hunter app (PWA → Unity/RN)        Spectator web app   │
│  • AR camera + 3D (R3F/WebXR/Unity) • live war-room map │
│  • map/radar (Mapbox)               • AR/POV streams    │
│  • aim/catch UI, avatar, store      • highlights/clips  │
└───────────────┬───────────────────────────┬────────────┘
                │ realtime (WS)              │ realtime / video
        ┌───────▼───────────────────────────▼────────┐
        │        GAME-STATE AUTHORITY (Colyseus)      │
        │  rooms = Legs · authoritative positions ·   │
        │  catch/shot adjudication · presence         │
        └───┬───────────┬──────────────┬─────────┬────┘
            │           │              │         │
   ┌────────▼──┐ ┌──────▼──────┐ ┌─────▼─────┐ ┌─▼─────────────┐
   │ AI ORCH.  │ │ ANTI-CHEAT  │ │ GEO SVC   │ │ BROADCAST SVC │
   │ Claude +  │ │ attest +    │ │ PostGIS/  │ │ LiveKit/Mux + │
   │ movement  │ │ plausibility│ │ H3 + GTFS │ │ 3D Tiles POV  │
   │ simulator │ │             │ │ + geofence│ │               │
   └────┬──────┘ └─────────────┘ └─────┬─────┘ └───────────────┘
        │ routes                       │ proximity/geofence
   ┌────▼────────────┐          ┌──────▼───────────────┐
   │ ROUTING/MAPS    │          │  SHARED BACKEND       │
   │ Google Directions│         │  Supabase (Postgres,  │
   │ /Routes/Roads,  │          │  Auth, Storage) +     │
   │ OSRM/Valhalla,  │          │  CubePay wallet &     │
   │ Street View,    │          │  payment services     │
   │ 3D Tiles        │          │                       │
   └─────────────────┘          └──────┬───────────────┘
                                       │ payouts/escrow
                                ┌──────▼───────────────┐
                                │ BLOCKCHAIN            │
                                │ Prize-pool escrow     │
                                │ (P2PEscrow pattern),  │
                                │ multi-chain pay,      │
                                │ Solana/pump.fun token │
                                └──────────────────────┘
```

---

## 4. Build-vs-buy summary

| Subsystem | Recommendation |
|-----------|----------------|
| Agent/wallet/payments | **Reuse** CubePay/AgentSphere |
| AR client (v1) | **Buy/reuse**: WebXR/8th Wall |
| AR client (native) | **Buy**: Unity + Niantic Lightship |
| Real-time game state | **Build on** Colyseus (start: Supabase Realtime) |
| Geospatial | **Buy/OSS**: PostGIS + H3 |
| Routing/transit | **Buy**: Google Maps Platform; **OSS** OSRM/OTP+GTFS for cost |
| AI brain | **Build**: Claude strategy agent + deterministic movement sim |
| Anti-cheat | **Build on** Play Integrity / App Attest + plausibility service |
| Broadcast/POV | **Buy**: LiveKit/Mux + Google 3D Tiles / Earth Studio |
| Prize escrow | **Reuse** `P2PEscrow.sol` pattern |
| Token | **Buy**: Solana + pump.fun (isolated, lawyered) |

---

## 5. Proposed repo layout (separate codebase)

```
rungent/
├── apps/
│   ├── hunter-web/        # PWA: AR + map + store (R3F/WebXR, Mapbox)
│   ├── spectator-web/     # live map + streams
│   └── hunter-native/     # (Phase 2) Unity/RN AR client
├── services/
│   ├── game-state/        # Colyseus authoritative rooms
│   ├── ai-orchestrator/   # Claude strategy + movement simulator
│   ├── anti-cheat/        # attestation + plausibility
│   ├── geo/               # PostGIS/H3, geofence, GTFS
│   ├── leg-scheduler/     # story/area/window lifecycle
│   ├── payout/            # escrow funding + distribution
│   └── broadcast/         # spectator feed + clip pipeline
├── contracts/
│   ├── PrizePoolEscrow.sol      # adapted from ../P2PEscrow.sol
│   └── ItemStake.sol            # stake-for-pot-share
├── packages/
│   ├── shared-types/      # TS types shared across apps/services
│   ├── cubepay-sdk/       # wallet/payment adapters (from CubePay)
│   └── ar-kit/            # R3F/AR components (from AR Viewer)
└── infra/                 # IaC, env, CI
```

---

## 6. Key technical risks

1. **Anti-spoof at money scale** — the hardest problem; gate real prizes behind a proven
   plausibility + attestation stack. The compulsory continuous avatar is the main lever.
2. **AI fairness tuning** — too smart = unwinnable/boring; too dumb = no challenge. Needs
   instrumented playtests and a tunable delay/speed/deception policy.
3. **AR fidelity on web** — WebXR limits may force the Unity/Lightship track sooner than planned.
4. **Real-time cost/scale** — a popular Leg in a dense city is a lot of concurrent geo-presence;
   plan the Colyseus/PostGIS/H3 path early even if v1 uses Supabase Realtime.
5. **Mapping cost** — Google Maps Platform calls per Rungent tick add up; cache routes, batch,
   and consider OSRM/OTP self-host for the movement layer.

---

**Sibling docs:** `rundown.md` (product), `rundown-design.md` (design prompts).
**Reuse sources:** `../CUBE_PAY_PROJECT_OVERVIEW.md`, `../p2p.md`, `../contracts/P2PEscrow.sol`,
`../src/components/Enhanced3DAgent.jsx`, `../src/components/ARViewer.jsx`, `../src/services/`.
