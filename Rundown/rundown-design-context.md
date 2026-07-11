# RUNDOWN — Design Context (attach this single file to Claude design)

> This one file gives the designer everything it needs: the brand system + the product facts +
> the build story. Attach it, then paste the per-template prompt from `rundown-design.md`.
> (Condensed from `rundown.md` and `rundown-tech.md`.)

---

## BRAND BRIEF

**PRODUCT:** RUNDOWN — "The AI Running Man." A real-world augmented-reality pursuit game. A
cunning, fully-synthetic AI character (the "Rungent") goes on the run across a real city, moving
like a real human (on foot, bike, train — never flight). Real people ("Hunters") use their phones
/ AR glasses to physically track it down and **CATCH (collide)** or **SHOOT (AR aim)** it before
it reaches a story destination. There is a real crypto prize pool. The Rungent is only visible
through the device camera, in AR. It's *The Running Man*, but the runner is an AI and the arena is
the real world.

**MAKER:** Intangible Tech — builders of UnrealPay / CubePay (payment infrastructure for the
spatial web). RUNDOWN reuses that AR + crypto-wallet + agent stack.

**AUDIENCE:** (1) gamers / urban explorers / crypto-native early adopters; (2) investors & sponsors.

**PERSONALITY:** cinematic, high-adrenaline, dystopian-game-show, neon-cyberpunk, futuristic, a
little dangerous, premium. Blade Runner × Pokémon Go × a live manhunt broadcast.

**VISUAL SYSTEM**
- Mood: dark mode, night city, glowing AR overlays, scan-lines, HUD/radar aesthetic.
- Colors — Primary green `#00FF6A`, secondary cyan `#00E5FF`, accent magenta `#FF2E9A`, warning
  amber `#FFB020`, base near-black `#07090C`, panel `#11151B`, text `#E8FFF4`.
- Type: bold condensed/technical display for headlines (uppercase, tight); mono/grotesk for
  HUD/data; readable sans for body.
- Motifs: targeting reticle/crosshair, radar pulse, breadcrumb dots, map contours, AR glow,
  countdown timers, "LIVE" tags, glitch.
- Imagery: first-person phone-AR view of a glowing runner figure on a real night street; war-room
  map with moving dots; a crosshair locking on.

**MESSAGES:** "An AI is on the run. Hunt it in the real world." · "You can only see it through
your lens." · "Catch it or shoot it. Split the pool." · "Safe by design — the target is an AI,
never a real person."

**WORDMARK:** "RUNDOWN" (show logo; runner in-scene = a "Rungent") — bold, technical, subtle motion-streak or reticle accent. Tagline:
"THE AI RUNNING MAN."

**RUNGENT VISUAL (the runner character — ALWAYS render it in AR shots, never omit it):** a glowing
neon-green `#00FF6A` humanoid **runner silhouette** in a mid-stride sprint pose — solid filled
figure, bright emissive outline, soft outer glow/bloom, faint cyan `#00E5FF` rim light, motion-
streak trails, a subtle dark contact shadow, and a thin scanline/hologram shimmer so it reads as an
AR overlay (not a real person). Clearly a running human; ~35–45% of frame height when close; built
in pure CSS/SVG. **AR layering:** back = night-street background, middle = the Rungent figure (focal
point), front = the HUD (reticle/distance/HOLD-TO-CATCH ring/FIRE button). The reticle locks onto
the figure; never hide it behind the street or HUD.

---

## PRODUCT FACTS (use for copy & structure)

**The Rungent:** an AI agent shown as a running human in AR; has a story + personality, a crypto
wallet (pays for items / earns a bounty), human-bounded movement (modes + speed caps + rest, no
flight), and a goal: reach a destination within the leg.

**A "Leg" (one game):** Story → Area (a city/metro) → approximate Start point (revealed just
before start) → optional Checkpoints → Destination. Lasts **1–2 weeks**, with a **daily active
window** (e.g. 08:00–22:00); outside it the Rungent rests/hides.

**The hunt loop:** Hunters get a map showing other Hunters **live** but the Rungent only as
**delayed breadcrumbs** ("last seen 14 min ago") plus its **live transport mode** ("🚲 cycling").
They triangulate, intercept, and within range see it **live in AR** to catch (collide + hold) or
shoot (AR reticle). Server-authoritative; anti-spoof via a compulsory continuously-tracked Hunter
avatar.

**Hunter avatar:** every Hunter has a character locked to their device, visible in AR to others
and to the Rungent — it's both the anti-cheat anchor and a store (skins, scopes, weapons, gear).

**Item economy:** anyone can drop AR items into the area (bike, car, decoy, intel, disguise); the
Rungent's AI pays to use them; providers earn / share the pot; platform takes a rake.

**Prize pool:** a magnet — headline "$100k per 2-week Leg" — **funded by sponsors, not us**;
right-sized to ~$5–10k for v1. Revenue: sponsored checkpoints (footfall, the Niantic model), leg
sponsorship, spectator/broadcast, in-app purchases, item rake, licensing.

**Three broadcast POVs:** Hunter (phone AR), Spectator (war-room map + AR streams), Rungent's-eye
(cinematic "fugitive's view"). It's a live show — and the founder live-streams catches to launch a
community token.

**Safe by design:** the target is always an AI (no human is ever hunted); plus geofencing
(no motorways/tracks/wilderness), active windows, and player-safety nudges.

**Big vision:** license a celebrity likeness (e.g. a Running-Man-style icon) as the synthetic
runner; users build & train their own AI runner characters and **compete to be the next Rungent**
(creator economy).

**Build story (for the "Built on our stack" slide):** RUNDOWN reuses CubePay/AgentSphere —
AR agents rendered over the camera, GPS anchoring, real-time sync, and multi-chain crypto wallets/
payments already exist. The new build is the real-time game server, the AI routing brain (a Claude
strategy agent + a deterministic human-speed movement simulator), hardened anti-cheat, mapping/
transit routing, and the broadcast/POV layer. Moat = spatial-payments tech + real-world AR game
tech combined.

---

## THE 7 HUNTER-APP SCREENS (for prototype/wireframe)

1. **Splash / Login** — "RUNDOWN — THE AI RUNNING MAN", CTA "Enter the Hunt", anonymous/wallet.
2. **Leg Brief** — Rungent portrait + backstory, area map, start countdown, teased destination,
   glowing prize pool, sponsor logos. CTA "Join this Leg".
3. **Create Hunter Avatar** — character + name + loadout (scope/weapon/gear) with a store feel
   (some premium/locked). CTA "Deploy Avatar".
4. **Map / Radar (home)** — dark city map: me (center), Hunters (live cyan dots), Rungent (delayed
   fading green breadcrumbs), transport-mode chip, checkpoints, no-go zones (amber hatch), items
   (magenta). Bottom bar: Map · AR · Items · Store · Leaderboard. Top HUD: leg timer + prize pool.
5. **AR Camera** — night street through the camera, the **Rungent figure as the clear focal point**
   (render per the RUNGENT VISUAL spec — it must be visibly present), reticle locked on it, distance
   "23 m", "HOLD TO CATCH" ring, "FIRE" button, another Hunter's avatar visible.
6. **Catch/Shoot Result** — "RUNGENT DOWN" / "CAUGHT!", green spark burst, prize-share summary,
   "Share clip" (TikTok/Reels/Kick).
7. **Spectate / Back** — war-room map + "LIVE" + PiP AR stream + "Back the Rungent / Back a Hunter"
   (glory points).

Primary path to emphasize: **Map → AR → Catch → Result.**
