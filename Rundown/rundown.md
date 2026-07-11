# RUNDOWN — The AI Running Man · Product Specification

**Platform / show:** RUNDOWN · **The AI runner (character/type):** Rungent
**Version:** 0.1 (Concept)
**Date:** June 29, 2026
**Status:** Concept / Pre-Development
**Built by:** Intangible Tech · sibling product to UnrealPay / CubePay / P2P Cube

---

## Table of Contents

1. [Concept](#1-concept)
2. [The Rungent (the AI runner)](#2-the-rungent-the-ai-runner)
3. [Roles & Actors](#3-roles--actors)
4. [Game Structure — a "Leg"](#4-game-structure--a-leg)
5. [The Game Loop](#5-the-game-loop)
6. [Hunter Mechanics](#6-hunter-mechanics)
7. [Rungent AI & Movement Logic](#7-rungent-ai--movement-logic)
8. [Catching & Shooting](#8-catching--shooting)
9. [Item Economy](#9-item-economy)
10. [Geofencing & Player Safety](#10-geofencing--player-safety)
11. [Anti-Cheat / Anti-Spoofing](#11-anti-cheat--anti-spoofing)
12. [Prize Pool & Monetization](#12-prize-pool--monetization)
13. [Backing / Betting (deferred)](#13-backing--betting-deferred)
14. ["Through Rungent's Eyes" & Spectator Broadcast](#14-through-rungents-eyes--spectator-broadcast)
15. [Two Flagship Demos](#15-two-flagship-demos)
16. [Future: Celebrity IP & "Next Rungent"](#16-future-celebrity-ip--next-rungent)
17. [Key Design Decisions](#17-key-design-decisions)
18. [Roadmap / Phases](#18-roadmap--phases)
19. [Legal & Regulatory Notes](#19-legal--regulatory-notes)
20. [Open Questions](#20-open-questions)

---

## 1. Concept

**Rungent** = **Run** + **Agent**. It is a real-world, AR-native pursuit game where a fully
**autonomous AI character** — the Rungent — goes on the run across a real geographic area,
and real people ("Hunters") use their phones (or AR glasses) to physically track it down and
**catch or shoot it** before it reaches a destination tied to a story.

### Elevator pitch

> A cunning AI fugitive is loose in your city. It moves like a real human — on foot, by bike,
> by train — and you can only see it through your phone's camera, in AR, when you get close.
> Hunt it down before it disappears, and split a real prize pool. It's *The Running Man*,
> except the runner is an AI and the arena is the real world.

### Why it's different

- The target is a **fully synthetic AI agent** — no human is ever physically hunted (safe,
  scalable, controllable, and it unlocks celebrity-likeness licensing later).
- It's **AR-native**: the Rungent and every Hunter are only visible through the device camera.
- It runs on a **real economy** — the Rungent carries a crypto wallet, players deploy paid AR
  items into its path, sponsors fund prize pools, and the whole thing is a live broadcast.
- It is built on the **CubePay / AgentSphere stack** — agent-with-wallet, AR object deployment,
  GPS anchoring, movement, real-time sync, and multi-chain payments already exist (see
  `rundown-tech.md`).

---

## 2. The Rungent (the AI runner)

The Rungent is an **AI agent rendered as a running human figure in AR**, with:

- **A story & personality** (e.g., a wrongly-accused fugitive proving their innocence; a thief
  recovering hidden heist money; a defector). Personality drives its taunts, behaviour, risk
  appetite, and public comms.
- **A crypto wallet** — it can receive payments (e.g., a sponsor's bounty) and pay for items
  (rent a bike, buy a decoy) from players along its route.
- **Human-bounded capabilities** — it can only do what a real human could: walk/run, cycle,
  drive, take public transport. **No flight.** Speeds capped per mode. It needs rest.
- **Skills tuned to the story** — e.g., "streetwise" (better at slipping crowds), "endurance"
  (longer active window), "hacker" (can briefly jam Hunter pings).
- **A goal** — reach a **destination** within the **leg duration**, optionally via **checkpoints**.

The Rungent's position is **server-authoritative** (the backend is the single source of truth
for where it really is), and revealed to Hunters on a **deliberate delay** (see §6).

---

## 3. Roles & Actors

| Role | Who | What they do | How they pay / earn |
|------|-----|--------------|---------------------|
| **Rungent** | AI agent (v1) | Evades, navigates, uses items, survives the leg | Holds a wallet; pays item providers; bounty if it wins |
| **Hunter** | Real player + compulsory AR avatar | Tracks, intercepts, catches/shoots the Rungent | Buys avatar/gear/weapons (app revenue); shares prize if they catch it |
| **Item Provider** | Any user | Deploys AR items (bikes, cars, decoys, intel) into the area | Charges the Rungent or takes a cut of the pot; platform takes a rake |
| **Spectator** | Anyone, anywhere | Watches the live map / AR streams / Rungent-POV | Ads, premium views; may become a Backer |
| **Backer** (deferred) | Spectator | Backs the Rungent or a Hunter | Shares glory (v1) / pool (later, if licensed) |
| **Sponsor** | Brand / business | Funds prize pool, owns checkpoints/safe-zones/branded items | Pays for footfall + exposure |
| **Showrunner** | Intangible Tech staff | Authors the story, sets area/dates, (beta) operates the Rungent | Operates the platform |

---

## 4. Game Structure — a "Leg"

A single game instance is a **Leg**. Each Leg has:

- **Story** — published in advance to build hype (who the Rungent is, why it's running).
- **Area** — a bounded real-world region (a city or metro), published in advance.
- **Start point** — **approximate**, released **just before** start (e.g., "near the old
  prison"). Tied to the story.
- **Destination** — where the Rungent must reach, and **why** (story-driven).
- **Checkpoints (optional)** — points it must pass, which create predictable catch windows
  and are prime sponsor inventory.
- **Duration** — **1–2 weeks** per Leg (one month is too long to hold attention).
- **Active window** — the Rungent only moves during set hours (e.g., 08:00–22:00) so Hunters
  aren't expected to chase at 3 a.m. and the AI gets realistic "rest." Off-window = it's hidden.
- **Prize pool** — split between (a) the Rungent's bounty if it survives, or (b) the Hunter(s)
  who catch it, plus Backer shares.

---

## 5. The Game Loop

```
PRE-LEG (days before)
  Showrunner publishes: story, area, dates, prize pool, sponsors
  Players in the area pre-register, create Hunter avatars, buy gear
  Item providers stage AR items around the area
        │
START (T0)
  Approximate start point revealed
  Rungent spawns, begins moving (server-authoritative true position)
        │
DURING THE LEG (1–2 weeks, active windows only)
  Rungent navigates toward destination, choosing routes + transport,
    avoiding Hunter clusters, using items, taunting via comms
  Hunters see DELAYED Rungent pings (breadcrumbs) + LIVE positions of
    each other; they triangulate, predict, intercept
  When a Hunter gets within range → AR view shows the Rungent live →
    Hunter tries to COLLIDE (catch) or SHOOT (aim) it
  Item providers earn as the Rungent rents/buys their items
  Spectators watch the live map + AR streams + Rungent-POV
        │
END
  WIN-RUNGENT: it reaches destination uncaught → bounty to Rungent's
    backers + treasury; story resolves
  WIN-HUNTERS: a Hunter catches/shoots it → prize to that Hunter +
    their backers; story resolves (capture ending)
  Leg recap published; clips cut for marketing; next Leg teased
```

---

## 6. Hunter Mechanics

- **Compulsory AR avatar.** Every Hunter creates a character that is **locked to their device**
  and follows them in the real world. It is **visible in AR to other Hunters and to the
  Rungent** when within visual range. This is core to anti-cheat (§11) *and* a revenue line
  (avatars, skins, scopes, weapons).
- **The map / radar.** Hunters get a map showing:
  - **Live** positions of other Hunters (and optionally their own team).
  - **Delayed** Rungent breadcrumbs (e.g., 10–20 min old) + its **live transport mode**
    (walking / bike / car / train) inferred from speed and rails — a key tactical tell.
  - Checkpoints, safe zones, geofenced no-go areas, and staged AR items.
- **Closing in.** Within an engagement radius (e.g., 75 m), the Rungent appears in the Hunter's
  AR camera view, live. Inside the **catch radius** (e.g., 15–25 m) they can act.
- **Teams / lone wolves.** Support both. Teams can coordinate a pincer; lone wolves keep more
  of the prize. Cooperative "herding" (forcing the Rungent toward a checkpoint) is encouraged.
- **Mutual visibility.** Because Hunters carry visible avatars, the Rungent's AI can *see* the
  Hunters near it and react (flee, feint, use a decoy) — making the hunt feel alive.

---

## 7. Rungent AI & Movement Logic

This is the heart of the product. The Rungent must feel **smart, cunning, and human-bounded** —
not a dot taking the Google-Maps shortest path (which any Hunter could trivially predict).

### 7.1 Two-layer brain

1. **Strategy layer (LLM agent, e.g. Claude).** Given the current situation (its position,
   distance/time to destination, Hunter density and headings nearby, time-of-day/active window,
   energy/rest state, available items, personality prompt "be cunning but human"), it decides
   *intent*: which general direction, whether to feint/double-back, whether to switch transport,
   whether to lie low, whether to buy an item or jam pings.
2. **Movement/physics layer (deterministic).** Given the intent, a routing engine computes a
   **real, legal path** on actual roads / cycle lanes / transit (Directions + transit schedules),
   and a simulator advances the Rungent at **mode-capped human speeds** with realistic dwell
   (waiting for a train, resting). The server commits the **true position** each tick.

### 7.2 Transport modes & speed caps (illustrative)

| Mode | Max speed | Constraints |
|------|-----------|-------------|
| Walk | ~6 km/h | anywhere pedestrian-legal |
| Run | ~12 km/h (bursts) | drains energy; can't sustain |
| Bicycle | ~25 km/h | needs a bike item / bike-share node |
| Car | ~50 km/h urban | needs a car item; roads only |
| Train/Bus | route+schedule | only on real lines/timetables; predictable = risky |

Mode choice is part of the deception: a train is fast but its stations are obvious ambush
points; a bike is flexible but slower; walking is invisible but slow.

### 7.3 Deception & "fairness"

- It must **never reveal live position** — only delayed breadcrumbs — so cleverness has room.
- It should **avoid the shortest obvious route**, use **feints** (head one way, double back),
  and **exploit Hunter blind spots** (areas with no live Hunters).
- It is **bounded**: can't teleport, can't exceed human speed, can't leave the area, must rest.
- **Energy/biology model**: running and long days cost energy; it must rest in the off-window,
  which is when it's hidden (and Hunters regroup).

### 7.4 Beta bootstrapping

In the first money beta, a **staff Showrunner secretly operates** the Rungent (moves a device /
drives its position through the city). Every operator decision + outcome becomes **training and
evaluation data** for the autonomous router. Goal: graduate to **fully synthetic** movement.

---

## 8. Catching & Shooting

Two ways to take down the Rungent. Both require the Hunter to be **physically, verifiably close**.

- **Catch (collision).** Hunter's verified position enters the catch radius of the Rungent's
  **true** position **and** holds an AR "tag" on the visible figure for N seconds (kills
  drive-by/teleport catches). Server-authoritative.
- **Shoot (aim).** A simple AR aiming reticle; the Hunter must have line-of-engagement within a
  shooting radius and the reticle locked on the Rungent for a moment. Server validates distance,
  bearing, and that the lock target is the Rungent object.
  - **Guardrail:** the reticle can lock **only** onto the Rungent (and, in optional PvP, a
    consenting Hunter) — **never** an arbitrary real person. Misses cost ammo/cooldown.
- **Counterplay.** The Rungent can't shoot back (v1), but can **evade**: decoys (fake pings),
  smoke (breaks AR lock briefly), ping-jam (skill), or simply outmanoeuvre using items.

Anti-spoof note: because both the Rungent's true position and the Hunter's avatar position are
**server-authoritative and continuously validated** (§11), a faked catch is rejected.

---

## 9. Item Economy

Any user can deploy **AR items** into the Leg area — this is **AgentSphere agent deployment
re-skinned**, and every item can carry a wallet.

| Item | Effect for Rungent | Provider earns |
|------|--------------------|----------------|
| Bicycle | unlocks bike speed | rental fee from Rungent / pot share |
| Car | unlocks car speed (roads) | rental fee / pot share |
| Sleeping bag / safehouse | rest faster, hide | fee / pot share |
| Decoy | emits a fake breadcrumb | fee / pot share |
| Intel drop | reveals nearby Hunter cluster | fee / pot share |
| Disguise | shrinks AR visibility radius | fee / pot share |

- The Rungent's AI decides whether an item is worth its wallet's spend.
- Providers either **charge the Rungent** (instant payment) or **stake for a share of the pot**
  if the Rungent wins. **Platform takes a rake** on every transaction — pure CubePay reuse.
- This turns the whole city into a living board where bystanders influence the hunt for profit.

---

## 10. Geofencing & Player Safety

Real-world movement = real-world risk. Both the Rungent **and** Hunters are constrained:

- **No-go geofences:** motorways, rail tracks, private property, water, mountains/wilderness,
  airports, sensitive sites. The Rungent cannot route through them; Hunters get hard warnings /
  no engagement credit inside them.
- **Safe play nudges:** no engagement while moving at vehicle speed (don't play while driving);
  "look up" reminders; no night chasing outside the active window.
- **Age-gating, waivers, insurance, local permits** per Leg city.
- **Curfew = active window.** Outside it, the hunt pauses.
- The Rungent's `mountains/wilderness` exclusion doubles as a **marketing surface**: those are
  exactly the zones we can render "through its eyes" cinematically (§14) without inviting Hunters
  into danger.

---

## 11. Anti-Cheat / Anti-Spoofing

Real money ⇒ cheating is existential. Layers:

1. **Server-authoritative state.** Clients never assert "I caught it" — they request, the server
   decides using its own truth for both positions.
2. **Compulsory continuous avatar.** A Hunter's avatar must move **plausibly and continuously**;
   teleports, 300 km/h jumps, impossible accelerations, and indoor/under-bridge GPS anomalies are
   flagged. A continuous track is far harder to fake than a single ping.
3. **Device attestation.** Play Integrity / App Attest to detect rooted devices, mock-location
   apps, emulators.
4. **Plausibility model.** Speed/acceleration limits, map-matching to walkable paths, sensor
   cross-checks (accelerometer/step counter vs. claimed motion).
5. **Catch confirmation.** Proximity **+** sustained AR lock **+** recent continuous track, all
   server-validated, before a catch counts.
6. **We learn from prior art.** Pokémon Go's spoofing arms race is documented; we adopt its known
   mitigations and iterate.

---

## 12. Prize Pool & Monetization

> Target headline: a **$100k pool per 2-week Leg** is a powerful magnet — but it must be
> **covered by sponsors, not self-funded**. Recommendation: launch v1 with a **$5–10k sponsored
> pool** to prove the loop, scale to $100k once a title sponsor + audience numbers exist.

Revenue lines, strongest/cleanest first:

1. **Sponsored checkpoints & locations (the proven model).** Niantic sold PokéStops/Gyms to
   brands **per visit** (McDonald's, Starbucks). Our checkpoints, safe zones, and item-drop
   nodes drive **measurable footfall** to a sponsor's door. #1 line, non-gambling, scalable.
2. **Title + tiered Leg sponsorship.** A headline sponsor funds the pool as a marketing spend;
   minor sponsors get checkpoints/branded items (a bike brand = the bike item).
3. **Spectator / broadcast.** The live map + AR + Rungent-POV **is** a show (it's literally the
   movie's premise). Streams, in-app ads, premium spectator features, media rights for big Legs.
4. **In-app purchases.** Hunter avatars, skins, scopes, weapons, battle-pass — recurring,
   non-gambling, and it makes the compulsory-avatar requirement pay for itself.
5. **Item-marketplace rake.** A cut of every item rental/sale to the Rungent (CubePay reuse).
6. **Character NFTs / creator economy.** Tradeable Hunter and runner characters; creators of
   "qualified" AI runners earn (see §16).
7. **City / tourism / festival licensing.** A city or festival pays to **host a Leg** for
   visitor footfall — clean, high-value B2B.
8. **Token launch (high-risk, high-attention).** A pump.fun-style launch can bootstrap funds +
   attention (see §15) — but carries **securities/regulatory risk**; treat as a marketing/
   community instrument with legal review, not the core business model.
9. **Backing/betting rake (deferred).** Real upside, gated behind licensing (§13, §19).

---

## 13. Backing / Betting (deferred)

- **v1 (no money):** Spectators **back** the Rungent or a specific Hunter for **glory/leaderboard
  points** and a share of a **non-cash** reward — closer to a sweepstakes/fantasy mechanic.
- **Later (licensed):** real-money backing where Backers share the pool if their pick succeeds.
  This is **parimutuel betting / a prediction market** and is regulated (Polymarket, Kalshi,
  Betfair are all licensed/enforced). "We're just P2P rails" is a **lawyered, jurisdiction-locked
  module**, not a v1 feature.
- Keep it **off the critical path** so it can never block the game's launch.

---

## 14. "Through Rungent's Eyes" & Spectator Broadcast

A signature surface — and a marketing weapon.

- **Rungent-POV.** Render a first-person/cinematic view of where the Rungent is using
  **Google Photorealistic 3D Tiles** and/or **Google Earth Studio** flythroughs, plus
  **Street View** for ground-level POV. (The Google Earth "flight simulator" itself isn't an API,
  but Photorealistic 3D Tiles + Earth Studio are the productizable equivalents.)
- **Three camera vantages for content:**
  1. **Hunter POV** — phone AR, chasing.
  2. **Spectator** — the live war-room map + picture-in-picture AR streams.
  3. **Rungent POV** — synthetic "fugitive's eye" cinematic.
- For v1 the Rungent-POV can be **non-realtime / marketing-only**; later it becomes a live
  spectator feature.

---

## 15. Two Flagship Demos

### Demo A — "Hunt it yourself" (investor & VIP persuasion)

- In a meeting/pitch, ask the investor to **share their location**; we **spawn a temporary
  Rungent** near them and let them **catch/shoot it on their own phone** within minutes.
- Visceral, personal, and shows the full stack live (AR object, GPS, aim/catch, payment wallet).
- **Must be in the dev plan as a first-class "instant local Rungent" mode** (drop a Rungent at
  any lat/lng on demand, no Leg setup). Reuses on-the-fly agent deployment we already have.

### Demo B — "Founder hunts live" (attention + token fundraising)

- The founder **live-streams on pump.fun / Kick / Twitch** short, high-energy clips of **shooting
  / catching the Rungent** in the real world.
- Purpose: attention, community, and a **token launch** (pump.fun on Solana) to bootstrap funds.
- **Content kit:** vertical clips for TikTok/Reels/Shorts; the three vantages from §14;
  recurring "catch of the day" highlights; a public leaderboard.
- **Strategy:** seed with Demo A clips of recognizable people hunting → drop the token alongside a
  public "first city Leg" announcement → use checkpoint sponsors as co-marketing.
- ⚠️ **Token caution:** a launchpad token can be deemed a security and pump.fun mechanics carry
  reputational + regulatory risk. Position the token as a **community/utility** instrument with
  legal review; never promise returns. (Not legal advice.)

> Both demos are specced into the roadmap (§18) because they double as the **product's smallest
> testable slice**: spawn a Rungent anywhere, see it in AR, catch/shoot it. If that one loop is
> magic, everything else is content and scale.

---

## 16. Future: Celebrity IP & "Next Rungent"

- **Celebrity-likeness Rungent.** Because the runner is **fully synthetic**, we can license a
  star's **look, voice, and personality** (e.g., approach Arnold Schwarzenegger for a
  *Running Man*-flavoured Rungent). AI-likeness licensing is an emerging, real market. The same
  framework works for **any** personality — athletes, streamers, fictional characters.
- **"Compete to be the next Rungent."** Users **build and train their own AI runner characters**
  on our platform (personality, skills, evasion strategy). A **qualifier / community vote /
  performance ladder** selects which user's AI becomes the **next official Rungent** for a Leg —
  and that **creator earns** a share. This is the safe, on-brand version of your original
  "qualify to be the Running Man" idea: it's an **AI character**, not a physical human, so there's
  no one to put in harm's way, and it creates a **creator economy** around runner agents.

---

## 17. Key Design Decisions

- ✅ **Rungent is AI-only, always.** No human is ever physically hunted.
- ✅ **Compulsory Hunter AR avatar** — anti-cheat anchor + revenue + mutual visibility.
- ✅ **Server-authoritative positions**; clients never assert outcomes.
- ✅ **Delayed Rungent breadcrumbs, live everything-else** — the core tension.
- ✅ **Human-bounded movement** (modes, speed caps, rest, no flight, geofences).
- ✅ **Hunters shoot/catch; Rungent only evades** (v1). Reticle locks only on the Rungent.
- ✅ **Daily active window** for rest, safety, and rhythm.
- ✅ **Beta = staff operator → train → fully synthetic AI** as the goal.
- ✅ **Prize pool sponsor-funded**, right-sized for v1.
- ✅ **Betting deferred & lawyered**; glory-only backing first.

---

## 18. Roadmap / Phases

### Phase 0 — The Magic Slice (Demo A) (Weeks 1–4)
- [ ] "Instant local Rungent": drop an AR Rungent at any lat/lng on demand
- [ ] AR view: see it through the camera, walk up to it
- [ ] Catch (collision + AR tag) and Shoot (aim reticle), server-validated
- [ ] Basic anti-spoof (continuous track + plausibility + attestation)
- [ ] Capture clips from Hunter POV → marketing kit
- **Goal:** prove the one loop that sells the whole product.

### Phase 1 — A Real Leg, Staff-Operated (Weeks 5–12)
- [ ] Leg setup: story, area, start/destination, checkpoints, active window
- [ ] Hunter avatars (compulsory) + map/radar with delayed breadcrumbs + live transport mode
- [ ] Staff Showrunner operates the Rungent; collect training data
- [ ] Geofencing + safety nudges + waivers
- [ ] Small **sponsored prize pool** ($5–10k) + prize-pool escrow contract
- [ ] Spectator live map (broadcast surface)

### Phase 2 — Economy & Autonomy (Months 4–6)
- [ ] Item economy (AR items with wallets, Rungent pays, platform rake)
- [ ] In-app purchases (avatars, gear, weapons)
- [ ] Autonomous AI router v1 (strategy LLM + deterministic movement) replacing the operator
- [ ] Rungent-POV cinematic (Photorealistic 3D Tiles / Earth Studio) for content
- [ ] Sponsored checkpoints (footfall model)

### Phase 3 — Scale & Show (Months 7–10)
- [ ] Multi-city Legs, larger sponsored pools, title sponsor
- [ ] Spectator monetization (streams, premium, media rights)
- [ ] Glory-only backing leaderboard
- [ ] Token / community program (with legal review)
- [ ] "Build your own runner" creator beta (→ §16)

### Phase 4 — IP & Creator Economy (Months 10+)
- [ ] Celebrity-likeness Rungent (licensed)
- [ ] "Compete to be the next Rungent" qualifier + creator payouts
- [ ] Licensed real-money backing module (jurisdiction-locked)
- [ ] AR-glasses-first experience

---

## 19. Legal & Regulatory Notes

*Not legal advice — get counsel before any money/token goes live.*

- **Player safety / liability:** real-world movement game → waivers, insurance, age-gating,
  geofencing, permits per city.
- **Gambling:** money backing/betting is regulated (most jurisdictions, hard-blocked in the US
  without a license). Keep it deferred and lawyered. Glory-only mechanics are lower-risk but
  still rule-bound.
- **Token launch:** securities risk; pump.fun mechanics carry reputational/regulatory exposure.
  Treat as community/utility with legal review; never promise returns.
- **Privacy:** Hunters share precise location continuously — clear consent, data-minimization,
  retention limits. (Consistent with the Intangible Tech privacy stance.)
- **IP:** celebrity likeness requires explicit licensing (rights of publicity / AI-likeness).
- **"The Running Man" name/marks:** that title is owned IP — use it as *inspiration/reference*
  only; ship under our own brand ("Rungent") unless/until licensed.

---

## 20. Open Questions

1. **AI routing realism vs. fairness** — how cunning is too cunning? Need playtests to tune the
   delay window, speed caps, and deception so Hunters can win ~30–50% of Legs.
2. **Engine choice for AR** — WebXR/8th Wall (fast, web, reuses our stack) vs. Unity + Niantic
   Lightship / AR Foundation (richer, glasses-ready). See `rundown-tech.md`.
3. **Real-time scale** — Supabase Realtime for a city of Hunters, or a dedicated game-state
   service (Colyseus/Ably/PubNub + PostGIS)? See `rundown-tech.md`.
4. **Catch vs. shoot balance** — do both end the Leg, or does "shot" wound/slow and "caught" end?
5. **Team economics** — how is a shared prize split among a Hunter team + their backers?
6. **Energy/rest model** — how visible is it to Hunters (do they know when it's resting)?
7. **Item abuse** — preventing collusion (provider feeds the Rungent cheap escapes for a kickback).
8. **City selection** — dense walkable transit cities first (best chase dynamics + safety).

---

**Sibling docs:** `rundown-tech.md` (full stack), `rundown-design.md` (design-tool prompts).
**Related:** `../CUBE_PAY_PROJECT_OVERVIEW.md`, `../p2p.md`, `../P2P_CUBE_FUNDRAISING_OVERVIEW.md`.
