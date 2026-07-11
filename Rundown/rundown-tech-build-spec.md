# RUNDOWN — Technical Specification & Build-Agent Prompt

**Platform / show:** RUNDOWN · **The AI runner (type):** Rungent · **Per-leg character:** admin-set story name
**Version:** 1.0 (build spec) · **Date:** June 29, 2026 · **Status:** Ready to build (Demo → v1)
**By:** Intangible Tech · reuses the CubePay / AgentSphere / AR Viewer stack · **built in a NEW codebase**

> This document is self-contained. It (1) explains exactly what to **reuse** from our existing
> CubePay stack, (2) captures every **locked product decision**, (3) gives the **architecture, data
> model, contracts, and AI design**, and (4) ends with a **copy-paste BUILD-AGENT PROMPT** (Part 15)
> for the coding agent that will build RUNDOWN in the new repo.
> Sibling docs: `rundown.md` (product), `rundown-tech.md` (stack overview), `rundown-design.md` +
> `rundown-design-context.md` (design), `rundown-visual-mock.html` (AR look), `rundown-video-prompts.md`.

---

## 1. TL;DR — what to build

**Deliverable order:**

1. **THROWAWAY DEMO (first, standalone).** Prove the magic in one recordable/streamable loop:
   - Admin creates a **Rungent** (character + story + **start & end point** + skills), committed **on-chain**.
   - The Rungent **walks/runs** start→end along real streets, rendered as a **rigged animated glowing
     GLB humanoid** in AR over the phone camera at its real GPS+altitude.
   - A user **logs in with a wallet (MetaMask)** as a **Hunter**, gets a **visible AR avatar** bound to
     their GPS.
   - When the Hunter is **in range**, the Rungent **notices them, turns to look, and can talk (two-way
     voice)**; the Rungent is **interactive** (tap/touch, like the CubePay cube).
   - The Hunter can **shoot** it (aim + lock + fire) or **touch/collide** to catch it.
   - Everything is **screen-recordable / streamable** (this is the pump.fun + investor demo).
2. **v1 (full show on testnet).** Multi-hunter legs, betting (testnet USDC), delayed curated stream,
   AI-autonomous Rungent, items economy, camera-verified catches, daily AI recap. All on **Sepolia +
   Solana devnet**.
3. **v2/v3 (deferred — documented so nothing is lost).** See §14.3.

---

## 2. What we REUSE from CubePay / AgentSphere / AR Viewer

The new codebase is fresh, but these **proven patterns** should be copied/adapted (not reinvented).
Point the build agent at these as reference implementations.

| Capability we already have | Reference (this repo) | How RUNDOWN uses it |
|---|---|---|
| **AR object at exact GPS + altitude** | `deployed_objects` table: `latitude`, `longitude`, `altitude`, `preciseAltitude`, `altitudeAccuracy`, `altitudeCorrection`; `positioning_mode` ('gps'/'screen') | Rungent, hunter avatars, and items are all geo-anchored objects. Altitude clamped to ground via Google Elevation API. |
| **RTK ~2 cm precision (optional)** | `src/services/rtkLocation.js` (`RTKLocationService`, Geodnet/NTRIP) | v1 uses **standard phone GPS** + generous radius; RTK is an optional later precision boost. |
| **3D model rendering over live camera** | `src/components/Enhanced3DAgent.jsx`, `AR3DScene.jsx`, `ARViewer.jsx`, `CameraView.jsx` (React Three Fiber + Three.js + `useGLTF`, `useFrame` loop) | Renders the **rigged GLB Rungent** + avatars + items in AR; `useFrame` drives walk/run animation + heading. |
| **Object filtering in the AR view** | `ARViewer.jsx` filter logic | Show only the relevant leg's Rungent/items to a hunter; hide others. |
| **Interactive tap object (the cube)** | `CubePaymentEngine.jsx`, `AgentInteractionModal.jsx` | The Rungent is **tappable/interactive** (talk, inspect) exactly like the cube. |
| **Object carries a wallet + multi-chain pay** | `wallet_address`/`agent_wallet_address`; `solanaPaymentService.js`, `evmPaymentService.js`, ENS | Rungent's **operating wallet** + **prize escrow**; items priced/paid; bet settlement. |
| **Per-trade escrow contract** | `contracts/P2PEscrow.sol` | Adapt into RUNDOWN's **PrizeEscrow** (release-to-catcher) — see §7. |
| **Supabase realtime + schema-extend habit** | `add_*_schema.sql` migrations, Supabase Realtime | Live hunter positions, delayed breadcrumbs, leg state, bet events. |
| **On-the-fly deployment** | AgentSphere deploy flow | The **"instant local Rungent"** demo mode: drop a Rungent at any lat/lng on demand. |

**Net:** the AR + wallet + geo layer is ~80% a known quantity. New work = the **on-chain commit +
two-wallet escrow**, the **AI Rungent brain**, **rigged-GLB locomotion + heading**, **two-way voice**,
**camera-verified catch anti-cheat**, **prediction-market betting**, and **delayed curated streaming**.

---

## 3. Locked product decisions (from design Q&A)

**Naming/roles**
- Platform = **RUNDOWN**; runner type = **Rungent**; each leg's character has an admin-set story name.
- **Roles are firewalled per leg — a wallet is exactly ONE of:**
  - **Rungent** (the AI, system-controlled) — cannot bet, cannot place items.
  - **Hunter** — hunts (catch/shoot); **cannot bet, cannot place items**; **must** have a location-bound AR avatar.
  - **Viewer/Backer** — **can bet AND place items** (bike/car/intel); cannot hunt.
  - **Spotter** — a local viewer physically within AR range who confirms a live ping for a small reward.
- Bettor-can-also-supply-items is **allowed in v1** (testnet, transparent). Flagged as a v2/mainnet
  integrity item (info-edge + position limits). Items must be **symmetric** (some help Rungent, some
  help hunters) so backing either side is legitimate strategy.

**The Rungent**
- **AI-only from day one** (no human operator). Autonomous route decisions.
- **On-chain immutable commit** per leg: name, story/motivation, start point, end point (approx,
  revealed late), skills config, prize-wallet, **rules hash**, optional check-ins. **The AI freely
  decides HOW to reach the end.**
- **Two wallets:** an **operating wallet** (Rungent spends on items during the run) and a **prize
  escrow** (released to the catcher, or to the Rungent on successful arrival). v1: our server holds the
  operating key (removable later so the Rungent is fully autonomous). **Catch → escrow pays the
  catcher.** (No literal raw-key handover.)
- **Movement v1:** walk **6 km/h**, run **10 km/h** (may go slower by choice). Walk/run only.
- **Voice:** **two-way** dialogue, **only with a hunter in AR range**; everyone else hears via the
  (delayed) stream. Character voice.
- **Appearance:** **rigged GLB humanoid** with walk/run animation, styled as the glowing muscular
  hologram (see `rundown-visual-mock.html`); rotates to face heading; **interactive** like the cube.
- **Daily 1-min recap:** a **real AI-generated talking video** of the character over a real background
  (2025-movie style), at end of each active day.

**Leg structure**
- Journey **A→B over ~1 week**; **active window 08:00–22:00**, then the Rungent "sleeps" (hidden) and
  posts the recap. **Destination approximate + revealed late.** Optional check-ins.
- Hunters/viewers see the Rungent's position on a **10–20 min delay** (breadcrumbs) + **live transport
  mode + speed** (hints). **No geofencing in v1** (AI picks any legal path).

**Money / chains**
- **Testnet only in v1:** **Sepolia (EVM)** + **Solana devnet**, both **USDC**. Admin funds the pool.
- **Betting in v1:** simple prediction markets — **"Rungent escapes / caught"** and **"which hunter
  catches it."** Real-money/mainnet betting is a later, gated milestone.

**Anti-cheat**
- **Basic** for v1: **server-authoritative** state + **standard GPS** + plausibility + **camera-verified
  catches** (final-approach footage must visually match claimed GPS — the strongest layer).
- **Hunter avatar + continuous location compulsory** (hunters only). Viewers need only a wallet/username.

**Streaming**
- **All public streams delayed** to the breadcrumb window (10–20 min).
- **One curated director channel** (human director whip-arounds 2–3 hunter feeds), **not** a grid.
- **Rungent tile = stylized live 3D map-cam** (its position gliding over Google 3D Tiles), not
  photorealistic POV. Cinematic POV = marketing content only.
- Private use first → **no face-blur yet** (add before any public launch).

**Tech**
- **Web PWA first** (phone + tablet); native app + AR glasses later.
- **Separate standalone Supabase** project.
- Rungent brain = **Claude Sonnet 5** (`claude-sonnet-5`) via the Anthropic API.
- Maps/geo = **all Google** (Maps Platform: Directions, Roads, **Elevation**, **Photorealistic 3D
  Tiles**, Street View).
- **Goal.live stays a separate project** (parallel, similar live-event-betting thesis; do not couple).

---

## 4. System architecture

```
┌──────────────────────────── CLIENTS (Web PWA) ────────────────────────────┐
│ HUNTER app                    VIEWER/BETTOR app          ADMIN console      │
│ • AR camera + rigged GLB      • curated stream (delayed) • create leg       │
│   Rungent + avatars + items   • prediction markets       • set story/skills │
│ • map/radar (delayed pings,   • deploy items (bike/car/  •   start/end      │
│   live transport mode)          intel)                   • fund prize       │
│ • catch (touch) / shoot (aim) • stylized Rungent map-cam • commit on-chain  │
│ • two-way VOICE in range      • place bets (testnet USDC)                   │
│ • compulsory located avatar                                                 │
└───────────────┬───────────────────────────────┬───────────────────────────┘
                │ realtime (Supabase channels)   │ REST/RPC
        ┌───────▼───────────────────────────────▼──────────────┐
        │                  RUNDOWN BACKEND                       │
        │  • Leg orchestrator (lifecycle, active window, recap)  │
        │  • Rungent AI service (Claude Sonnet 5 + movement sim) │
        │  • Catch/shoot adjudicator (server-authoritative)      │
        │  • Camera-verify service (footage ↔ GPS match)         │
        │  • Betting/market engine + settlement                  │
        │  • Stream director/relay (delayed) + map-cam feed      │
        │  • Voice bridge (STT ↔ Claude ↔ TTS)                   │
        └───┬────────────┬───────────────┬───────────┬───────────┘
            │            │               │           │
   ┌────────▼───┐ ┌──────▼──────┐ ┌──────▼──────┐ ┌──▼────────────────┐
   │ SUPABASE   │ │ GOOGLE      │ │ ANTHROPIC   │ │ VOICE / STREAM     │
   │ Postgres + │ │ Maps Plat.  │ │ Claude      │ │ Google STT/TTS,    │
   │ Realtime + │ │ Directions/ │ │ Sonnet 5    │ │ LiveKit/Mux (relay │
   │ Auth +     │ │ Roads/Elev/ │ │ (brain +    │ │ + delay), WebRTC   │
   │ Storage +  │ │ 3D Tiles/   │ │ dialogue +  │ │                    │
   │ PostGIS    │ │ Street View │ │ vision)     │ │                    │
   └────────────┘ └─────────────┘ └─────────────┘ └────────────────────┘
            │
   ┌────────▼─────────────────────────────────────────────┐
   │ BLOCKCHAIN (testnet)                                   │
   │ Sepolia: LegCommit + PrizeEscrow (Solidity)            │
   │ Solana devnet: mirror program (Anchor) + USDC          │
   │ Rungent operating wallet + prize escrow (two-wallet)   │
   └───────────────────────────────────────────────────────┘
```

---

## 5. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| **Frontend** | React 19 + Vite + **PWA** | Reuse AR Viewer patterns. Phone + tablet. |
| **AR / 3D** | React Three Fiber 9 + Three.js + `@react-three/drei` (`useGLTF`, `useAnimations`, `Billboard`) | Rigged GLB Rungent, avatars, items over `getUserMedia` camera. `useFrame` for locomotion + heading. |
| **Camera/AR** | `getUserMedia`, Geolocation API, Device Orientation API | Standard-GPS AR anchoring in v1 (WebXR optional). |
| **Maps/Geo** | **Google Maps Platform**: Directions, Roads, **Elevation**, **Photorealistic 3D Tiles** (via CesiumJS or Maps JS), Street View | Routing, ground-clamp altitude, map-cam, POV marketing. |
| **Backend/DB** | **Supabase** (Postgres + **PostGIS** + Realtime + Auth + Storage + Edge Functions) | Standalone project. Geo queries via PostGIS. |
| **AI brain + dialogue + vision** | **Anthropic API — `claude-sonnet-5`** (tool use for movement decisions; vision to help verify catch footage) | Text+vision only — no native audio (see voice). |
| **Voice** | Google Cloud **STT** + **TTS** (fits the all-Google choice) bridged through Claude for dialogue; **WebRTC** for the live in-range channel | Two-way, in-range hunters only. |
| **Streaming** | **LiveKit** (or Mux) for ingest + a **delay buffer** (10–20 min); a **director UI** to switch feeds; Rungent map-cam rendered server/client-side from position data | Delayed, curated single channel. |
| **Wallets/pay** | `ethers` v5 (EVM), `@solana/web3.js` + wallet-adapter (Solana); **MetaMask** login | Reuse CubePay payment services. |
| **Contracts** | **Solidity + Hardhat** (Sepolia); **Anchor** (Solana devnet) | LegCommit + PrizeEscrow. New toolchain (greenfield). |
| **Realtime scale** | Supabase Realtime v1; **Colyseus-ready** structure for later | One leg = bounded concurrency in v1. |

---

## 6. Data model (Supabase / Postgres)

Core tables (columns abbreviated; add `id uuid pk`, `created_at`, RLS policies):

```sql
-- one running event
legs(
  id, name, status,                    -- 'draft'|'committed'|'live'|'sleeping'|'ended'
  story text, motivation text,
  start_lat, start_lng, start_alt,     -- approximate start
  end_lat, end_lng, end_alt,           -- approximate destination (revealed late)
  end_reveal_at timestamptz,
  skills jsonb,                        -- {streetwise, endurance, ...} config
  rules_hash text,                     -- keccak of the immutable rule set
  active_window jsonb,                 -- {open:'08:00', close:'22:00', tz}
  breadcrumb_delay_sec int default 900,
  chain text, prize_escrow_addr text, operating_wallet_addr text,
  prize_amount numeric, prize_token text default 'USDC',
  onchain_commit_tx text,              -- proof of the immutable commit
  started_at, ended_at
)

-- the AI runner's authoritative + delayed state
rungent_state(
  leg_id fk, true_lat, true_lng, true_alt,     -- server-authoritative (secret)
  transport_mode text,                          -- 'walk'|'run' (v1)
  speed_kmh numeric, heading_deg numeric,
  energy numeric, status text,                  -- 'moving'|'resting'|'caught'|'arrived'
  updated_at
)
rungent_breadcrumbs(leg_id, lat, lng, transport_mode, speed_kmh, ts)  -- what hunters see (delayed)

-- players
hunters(leg_id, wallet_addr, display_name, avatar_glb text,
        last_lat, last_lng, last_alt, last_seen_at, track_ok bool)   -- located avatar (compulsory)
viewers(leg_id, wallet_addr, display_name)                           -- username/wallet only

-- world objects placed by viewers
items(leg_id, kind, lat, lng, alt, provider_wallet, price numeric,
      status text, wallet_addr text)             -- 'bike'|'car'|'intel'; helps rungent or hunters

-- takedowns
catches(leg_id, hunter_wallet, method text,      -- 'touch'|'shoot'
        claimed_lat, claimed_lng, ts,
        video_ref text, verify_status text,       -- camera-verify: 'pending'|'passed'|'failed'
        settled_tx text)

-- prediction markets
markets(leg_id, kind text, options jsonb, status text)   -- 'escape_vs_caught'|'which_hunter'
bets(market_id, wallet_addr, option text, amount numeric, token, tx, payout_tx)

-- spotter confirmations (local, in-AR-range)
spots(leg_id, viewer_wallet, lat, lng, ts, reward_tx)

-- event log for the 3-min dopamine feed + stream + recap
events(leg_id, type text, payload jsonb, ts)     -- near-miss, item used, checkpoint, mode-change...
```

Guardrails: `rungent_state.true_*` is **never** exposed to clients — clients only read
`rungent_breadcrumbs` (delayed). RLS: hunters see their own row + others' avatars; viewers see public
market/stream data.

---

## 7. Smart contracts (the trust core)

**Goal:** the leg's rules are **immutable once committed**, and the prize is **released trustlessly to
the catcher** (or to the Rungent on arrival). Two wallets, one escrow.

**EVM (Sepolia) — Solidity/Hardhat**

```solidity
// LegCommit.sol — immutable commitment of a leg's rules
contract LegCommit {
    struct Leg {
        bytes32 rulesHash;      // keccak of {story, start, end, skills, checkpoints, window, prize}
        address operatingWallet; // Rungent spends from here during the run
        address prizeEscrow;     // PrizeEscrow for this leg
        uint64  startAt;
        uint64  deadline;        // must arrive by
        bool    committed;
    }
    mapping(bytes32 => Leg) public legs;   // legId => Leg
    function commit(bytes32 legId, bytes32 rulesHash, address op, address escrow,
                    uint64 startAt, uint64 deadline) external onlyAdmin;
    // once committed, fields are immutable; only the escrow can change custody of funds
    event LegCommitted(bytes32 indexed legId, bytes32 rulesHash);
}

// PrizeEscrow.sol — holds prize USDC; releases to catcher or to Rungent on arrival
// (adapt contracts/P2PEscrow.sol: seller->none, buyer->catcher, arbiter->server oracle)
contract PrizeEscrow {
    address public token;        // USDC (testnet)
    uint256 public amount;
    address public oracle;       // RUNDOWN server (v1 attestation)
    bytes32 public legId;
    enum State { Funded, Caught, Arrived, Settled }
    State public state;

    function fund(uint256 amt) external;                 // admin funds prize
    // oracle attests a verified catch -> pays the catcher
    function settleCatch(address catcher) external onlyOracle inState(Funded);
    // oracle attests successful arrival -> pays the Rungent's designated address
    function settleArrival(address rungentPayout) external onlyOracle inState(Funded);
    // later: split with backers who bet correctly
    event Settled(bytes32 indexed legId, address to, uint256 amount);
}
```

**Solana (devnet) — Anchor:** a mirror program with `commit_leg`, `fund_prize`, `settle_catch`,
`settle_arrival`, using SPL USDC (devnet). Same oracle-attested release.

**Notes**
- v1 **oracle = our server** (fine on testnet); the escrow guarantees funds can only go to a catcher or
  the Rungent, never back to us arbitrarily.
- The **operating wallet** key is server-held in v1 but **designed to be removable** so the Rungent
  becomes fully autonomous (the operating wallet then signs its own item purchases via the AI service).
- Betting settlement (§11) can start as an **off-chain ledger** in the demo and move on-chain
  (escrowed markets) in v1.

---

## 8. The Rungent AI brain

Two layers (keep them separate — the movement layer enforces fairness deterministically):

**8.1 Strategy layer — `claude-sonnet-5` (Anthropic API, tool use).**
Every decision tick (e.g., every 30–60 s of active window), send structured state and get an *intent*:
- **Input:** current true position, time/energy, distance+bearing to (approx) destination, **nearby
  hunter avatar positions/headings**, available items in range + operating-wallet balance, personality
  + skills from the leg's committed config, active-window clock.
- **Tools the model can call:** `get_route(from,to,mode)`, `list_nearby_hunters(radius)`,
  `list_nearby_items(radius)`, `buy_item(itemId)`, `use_skill(name)`, `set_intent({heading, mode,
  target})`, `say(text)` (voice), `post_recap()`.
- **Output = intent** ("head toward waypoint W at run pace, avoid the hunter cluster NE, buy the bike").
- Cache the static system prompt (personality + rules) to cut cost per tick.
- **Vision use:** the same model can score **catch-verification footage** (does the scene match the
  claimed GPS?) as a cheap first-pass filter (§10).

**8.2 Movement/physics layer — deterministic (TypeScript).**
Turns intent into a **real path** (Google Directions walking route, snapped to Roads), advances the
Rungent at **capped human speed** (walk 6 / run 10 km/h; may slow), **clamps altitude** to ground via
**Google Elevation API**, updates `rungent_state` (true) and appends to `rungent_breadcrumbs`
**delayed** by `breadcrumb_delay_sec`. Enforces: no teleport, no leaving bounds, rest in off-window.

**8.3 Personality, voice, recap.**
- Character/skills come from the leg's admin config (§ admin console). Personality drives `say()` lines,
  taunts, risk appetite.
- **Voice loop (in-range hunter):** hunter speaks → **Google STT** → text → **Claude Sonnet 5** (in
  character) → **Google TTS** → played back over the **WebRTC** channel. Sub-2s target.
- **Daily recap:** at window close, generate a **1-min AI talking-head video** of the character (script
  by Claude; talking-head via an avatar-video generator) composited over a **real background** near the
  Rungent's resting area; post to `events` + the stream.

---

## 9. AR client (hunter + viewer)

- **Rungent render:** load the **rigged GLB** with `useGLTF`+`useAnimations`; play `walk`/`run` clips
  keyed to `transport_mode`/`speed`; rotate model to `heading_deg`; apply the **holographic shader/bloom**
  (green emissive + fresnel rim + scanlines) to match `rundown-visual-mock.html`. Anchor at
  `true_lat/lng/alt` **only when the hunter is within engagement range** (else it's off-camera/on the
  delayed map).
- **Interactivity:** tap opens an interaction panel (inspect, talk) — mirror `AgentInteractionModal` /
  the cube. When a hunter enters range, the Rungent AI is notified → it **turns to look** at the
  hunter's avatar and may `say()` a line.
- **Hunter avatar:** a GLB avatar anchored to the hunter's live GPS, **visible to the Rungent and to
  other hunters** in AR/map. This is the mutual-visibility + anti-spoof anchor.
- **Catch (touch):** hunter's verified GPS within **catch radius** (v1 generous, e.g. 20–25 m) of the
  true position **+** hold an AR tag for N seconds → request to server.
- **Shoot:** requires possessing the **gun item** (found or bought, deployed by us/other users). Aim
  reticle, lock on the Rungent for a moment within **shoot radius** (e.g. 60–75 m), fire (v1 = infinite
  ammo, no reload). Server validates distance/bearing/lock.
- **Items:** bike/car (unlock speed for the Rungent when it buys them), intel (reveals nearby hunter
  cluster). Rendered as tappable AR objects with wallets.

---

## 10. Anti-cheat (v1 = basic + the strong one)

1. **Server-authoritative** catch/shoot adjudication (client never asserts a takedown).
2. **Compulsory located hunter avatar** with **continuous plausibility** (no teleports / impossible
   speed; standard GPS).
3. **Camera-verified catch (the key layer):** on a catch/shoot claim, the client submits a short
   **final-approach video/clip**; the server matches it to the claimed GPS (scene/landmarks via Claude
   vision + Street View/3D-Tiles cross-check). Pass → escrow settles; fail → rejected. This is far
   harder to spoof than GPS and is your best integrity guarantee.
4. Device attestation, RTK precision, and richer sensor cross-checks are **v2**.

---

## 11. Betting (prediction markets)

- **Markets in v1:** `escape_vs_caught` (Rungent Yes/No) and `which_hunter` (per-hunter). **Testnet
  USDC.**
- **Roles firewall (enforced in code):** hunters and the Rungent cannot hold bets; viewers/backers can
  bet **and** deploy items (symmetric items so either side can be backed).
- **Settlement:** on leg end, resolve markets from the authoritative outcome; pay winners
  (off-chain ledger in the demo → escrowed on-chain markets in v1). **Backer share of the prize pool**
  is a documented **v2** addition (K39).
- **Mainnet/real-money = later, gated.** v1 stays testnet, which sidesteps licensing for now.
- **v2 integrity items to write down now:** position limits; info-edge of item-deployers who learn the
  true position; optional stricter bettor≠supplier firewall.

---

## 12. Streaming (delayed, curated)

- **Ingest:** hunter phones stream (opt-in) to LiveKit/Mux.
- **Delay buffer:** all public output delayed to `breadcrumb_delay_sec` (10–20 min) so streams can't be
  used as a live wallhack.
- **Curated channel:** a **director UI** whip-arounds 2–3 hottest hunter feeds; **not** a 12-grid (grid
  is a later premium desktop feature).
- **Rungent tile:** a **stylized live 3D map-cam** — its (delayed) position gliding over **Google
  Photorealistic 3D Tiles** — always present. Cinematic "through-its-eyes" POV stays **marketing
  content** (see `rundown-video-prompts.md`), not a live v1 render.
- **Monetization surface:** this is the pump.fun / token-launch stream and the ad surface.

---

## 13. Real-time & geo

- **Supabase Realtime** channels: `leg:{id}:breadcrumbs` (delayed), `leg:{id}:hunters` (live avatars),
  `leg:{id}:events`, `leg:{id}:markets`.
- **PostGIS** for proximity (`ST_DWithin`) — "hunter in range?", "items nearby?", "spotter in range?".
- **Google Elevation API** to clamp every Rungent/avatar/item altitude to ground (Q7c) — nothing floats
  or sinks; store in `*_alt`.

---

## 14. Build phases

### 14.1 DEMO (first, throwaway) — the must-haves
1. Admin: create a Rungent (name, story, **start+end on my street**, skills), **commit on-chain**
   (LegCommit on Sepolia; fund a small testnet prize into PrizeEscrow).
2. Movement: Rungent walks/runs start→end along the real route (Directions + speed cap + elevation
   clamp); rendered as **rigged glowing GLB** in AR at real GPS.
3. Login as **Hunter** (MetaMask) with a **visible located AR avatar**.
4. **In-range:** Rungent notices the hunter, turns to look, **two-way voice**; Rungent is tappable.
5. **Shoot** (with gun item) or **touch** to catch → server attests → **PrizeEscrow pays the catcher**.
6. All **screen-recordable / streamable** (the pump.fun + investor clip).
   *Plus the "instant local Rungent" flavor: drop it at any lat/lng on demand for VIP demos.*

### 14.2 v1 (full show, testnet)
Multi-hunter legs; AI-autonomous week-long journey (8–22 window, sleep, **daily AI recap**); **delayed
curated stream** + Rungent map-cam; **betting** (2 markets, testnet USDC) with **role firewall**;
**items economy** (bike/car/intel, viewer-deployed); **camera-verified catches**; **local spotter** role;
Sepolia + Solana devnet.

### 14.3 v2 / v3 (deferred — do NOT lose these)
Teams; reload/ammo; weapon variety + gear store; passive-watcher accounts & optional viewer avatars
(cosmetic); backer share of the prize pool; mainnet real-money markets (licensed, position limits,
stricter firewall); face-blurring + T&S; RTK precision + device attestation; native app + **AR glasses
via Google XR Blocks** (WebXR+Three.js+Gemini — gaze/gesture aiming, occlusion, avatars; NOT for phone
v1 — no GPS anchoring + no iOS WebXR; see `rundown-tech.md` §2.10); photorealistic live Rungent-POV; the
multi-stream premium mosaic; **"compete to be the next Rungent"** creator economy; celebrity-likeness legs.

---

## 15. BUILD-AGENT PROMPT (copy-paste into the new repo's coding agent)

```
You are building RUNDOWN — a real-world augmented-reality pursuit SHOW where an autonomous AI runner
(a "Rungent") travels from a start point to an end point through real streets, and real people
("Hunters") use their phones to find it in AR and CATCH (touch) or SHOOT it for an on-chain crypto
prize. Build in THIS new repo. A companion product called CubePay/AgentSphere already solved the
AR-object + wallet + geo layer; replicate those patterns (described below) — you do not have its code,
so build fresh but follow the same approach.

GOAL FOR THIS MILESTONE = the DEMO (see "Demo scope" below). Architect it to grow into v1, but ship
the demo first.

STACK (use exactly this):
- Frontend: React 19 + Vite, as an installable PWA (phone + tablet). React Three Fiber 9 + Three.js +
  @react-three/drei for AR. Camera via getUserMedia; Geolocation + DeviceOrientation for anchoring.
- Backend/DB: a NEW standalone Supabase project (Postgres + PostGIS + Realtime + Auth + Storage + Edge
  Functions).
- AI: Anthropic API, model `claude-sonnet-5`, using tool use for the Rungent's movement decisions and
  vision for catch-verification. (Anthropic is text+vision only — no audio.)
- Voice: Google Cloud Speech-to-Text + Text-to-Speech, bridged through Claude for in-character dialogue,
  over a WebRTC channel; two-way, ONLY when a hunter is within AR range.
- Maps/Geo: Google Maps Platform — Directions (walking routes), Roads (snap), Elevation (clamp altitude
  to ground), Photorealistic 3D Tiles (map-cam), Street View (verification/marketing).
- Chains (TESTNET ONLY): Sepolia (ethers v5) + Solana devnet (@solana/web3.js + wallet-adapter), both
  USDC. Login with MetaMask (EVM) / wallet-adapter (Solana).
- Contracts: Solidity + Hardhat (Sepolia): LegCommit.sol (immutable leg rules) + PrizeEscrow.sol
  (holds USDC, oracle-attested release to the catcher or to the Rungent on arrival). Mirror later on
  Solana with Anchor.

REUSE THESE PATTERNS (from the CubePay stack):
- Geo-anchored AR object: a DB row with latitude, longitude, altitude (+ altitude accuracy/correction)
  and a positioning_mode; render its GLB over the live camera with React Three Fiber; drive per-frame
  motion with useFrame; filter which objects are visible to a given user.
- Object-with-wallet: every object (Rungent, hunter avatar, item) can carry a wallet address and
  send/receive USDC on EVM/Solana.
- Interactive tap object: tapping an AR object opens an interaction panel (like CubePay's cube) — use
  this for "talk to the Rungent / inspect."

CORE MODEL & RULES (non-negotiable):
- The Rungent's TRUE position is server-authoritative and SECRET. Clients only ever receive DELAYED
  breadcrumbs (10–20 min old) plus the Rungent's LIVE transport mode + speed. Never leak true position
  to clients (including via streams — streams are delayed too).
- Two wallets: an OPERATING wallet (Rungent spends on items during the run; server-held key in v1, but
  isolate it so it can later be handed to an autonomous signer) and a PRIZE ESCROW contract (pays the
  catcher on a verified catch, or the Rungent on verified arrival). Never a raw private-key handover.
- Per-leg, commit ON-CHAIN and treat as IMMUTABLE: name, story, start, (approx) end, skills config,
  rules hash, optional check-ins, prize wallet. The AI then FREELY decides how to reach the end
  (walking route via Directions), capped at walk 6 km/h / run 10 km/h (may go slower), altitude clamped
  to ground via Elevation API. No geofencing in v1.
- Roles are firewalled per leg: Rungent (system) and Hunters CANNOT bet or place items; Viewers/Backers
  CAN bet and place items. Hunters MUST have a continuously-located, AR-visible avatar (anti-spoof).
- Catch = touch (verified GPS within ~20–25 m + hold AR tag N seconds) OR shoot (must possess the gun
  item; aim + lock within ~60–75 m; v1 infinite ammo). Server adjudicates. Add camera-verified catch:
  client submits final-approach footage; server matches it to claimed GPS (Claude vision + Street View)
  before the escrow settles.

DEMO SCOPE (build this first, make it screen-recordable/streamable):
1. Admin console: create a Rungent (name, story, start+end points on a map, skills) → commit on-chain
   (LegCommit on Sepolia) → fund a small testnet USDC prize into PrizeEscrow.
2. The Rungent walks/runs the real route start→end, rendered as a RIGGED GLB humanoid with walk/run
   animation, rotated to heading, styled as a glowing green hologram (emissive + bloom + fresnel rim +
   scanlines). Anchor it at its true GPS/altitude when a hunter is in range; otherwise show it on the
   delayed map.
3. User logs in with MetaMask as a Hunter → gets a visible, located AR avatar (GLB).
4. When the hunter is in range: notify the Rungent AI → it turns to look at the hunter's avatar and can
   hold a two-way VOICE conversation in character (STT→Claude→TTS over WebRTC). The Rungent is tappable.
5. The hunter can SHOOT it (with the gun item; aim+lock+fire) or TOUCH it to catch → server attests →
   PrizeEscrow releases the prize to the hunter's wallet.
6. Provide an "instant local Rungent" mode: drop a Rungent at any given lat/lng on demand (no full leg
   setup) for VIP/investor demos.

RUNGENT AI (two layers, keep separate):
- Strategy (claude-sonnet-5, tool use): each tick, given true position, distance/bearing to end, nearby
  hunter avatars, nearby items + wallet balance, skills/personality, and the active-window clock, return
  an intent. Tools: get_route, list_nearby_hunters, list_nearby_items, buy_item, use_skill, set_intent,
  say, post_recap. Cache the static system prompt.
- Movement (deterministic TS): convert intent → real walking route (Directions, snapped to Roads),
  advance at capped human speed, clamp altitude (Elevation API), write server-authoritative true state
  and append DELAYED breadcrumbs. Enforce no-teleport / bounds / rest.

DATA MODEL: implement the tables in the spec's §6 (legs, rungent_state, rungent_breadcrumbs, hunters,
viewers, items, catches, markets, bets, spots, events) with RLS so clients never read rungent_state.true_*.

DELIVERABLES: the PWA (hunter + admin views for the demo), the Supabase schema + Edge Functions, the
Rungent AI service, the two contracts + deploy scripts (Sepolia), and a README on running the demo
locally over HTTPS (ngrok) on a phone. Keep v1/v2 features (betting, streaming, multi-hunter,
camera-verify at scale, daily recap) stubbed behind clear interfaces so they slot in next.

STYLE: match the RUNDOWN brand (dark neon-cyberpunk; green #00FF6A, cyan #00E5FF, magenta #FF2E9A,
amber #FFB020). Ask me before choosing anything that affects cost (Maps quota, streaming, avatar-video
generation). Do not couple to any other project (Goal.live is separate). Testnet only — never wire real
funds.
```

---

## 16. Assumptions & open items (flagged)
- **Betting on testnet sidesteps licensing** in v1; mainnet real-money markets need legal structure
  (position limits, firewall, jurisdiction) — treat as a gated v2 milestone. (Not legal advice.)
- **AI talking-head recap** needs an avatar-video generator (cost/quality TBD) — demo can stub with a
  scripted voiceover if needed.
- **Camera-verify** accuracy needs tuning; start lenient on testnet, tighten before real money.
- **Voice latency** target <2 s; if Google STT/TTS round-trips too slow, consider streaming STT.
- **Map/streaming costs** (Google 3D Tiles, LiveKit) should be confirmed before scaling beyond the demo.

---

**Related:** `rundown.md`, `rundown-tech.md`, `rundown-design.md`, `rundown-design-context.md`,
`rundown-visual-mock.html`, `rundown-video-prompts.md`, `../contracts/P2PEscrow.sol`,
`../CUBE_PAY_PROJECT_OVERVIEW.md`.
