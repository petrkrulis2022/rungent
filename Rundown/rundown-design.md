# RUNDOWN — Design Prompts (for Claude design / AI design tool)

This file contains **ready-to-paste prompts** for each template in the design tool
(**Prototype · Slides · Document · Wireframe · Animation**). Start a project, pick the template,
and paste the matching prompt. The **Shared Brand Brief** below should be pasted at the top of
*any* of them (or kept as project context) so every artifact looks consistent.

---

## 0. Shared Brand Brief (paste first / set as project context)

```
PRODUCT: RUNDOWN — "The AI Running Man." A real-world augmented-reality pursuit game.
A cunning, fully-synthetic AI character (the "Rungent") goes on the run across a real city,
moving like a real human (on foot, bike, train — never flight). Real people ("Hunters") use
their phones / AR glasses to physically track it down and CATCH (collide) or SHOOT (AR aim) it
before it reaches a story destination. There is a real crypto prize pool. The Rungent is only
visible through the device camera, in AR. It's The Running Man, but the runner is an AI and the
arena is the real world.

MAKER: Intangible Tech — builders of UnrealPay / CubePay (payment infrastructure for the spatial
web). RUNDOWN reuses that AR + crypto-wallet + agent stack.

AUDIENCE: (1) gamers / urban explorers / crypto-native early adopters; (2) investors & sponsors.

BRAND PERSONALITY: cinematic, high-adrenaline, dystopian-game-show, neon-cyberpunk, futuristic,
a little dangerous, premium. Think Blade Runner meets Pokémon Go meets a live manhunt broadcast.

VISUAL SYSTEM:
- Mood: dark mode, night city, glowing AR overlays, scan-lines, HUD/radar aesthetic.
- Primary color: electric green #00FF6A. Secondary: cyan #00E5FF. Accent: hot magenta #FF2E9A,
  warning amber #FFB020. Base: near-black #07090C, panel #11151B, text #E8FFF4.
- Typography: bold condensed/technical display for headlines (uppercase, tight), clean mono or
  grotesk for HUD/data, readable sans for body.
- Motifs: targeting reticle/crosshair, radar pulse, breadcrumb dots, map contours, AR cube/agent
  glow, countdown timers, "LIVE" tags, glitch.
- Imagery: first-person phone-AR view of a glowing runner figure on a real street at night;
  war-room map with moving dots; a crosshair locking on.

KEY MESSAGES:
- "An AI is on the run. Hunt it in the real world."
- "You can only see it through your lens."
- "Catch it or shoot it. Split the pool."
- Safe by design: the target is an AI — never a real person.

LOGO/WORDMARK: "RUNDOWN" (show/app logo; the runner rendered in-scene is a "Rungent") — bold, technical, with a subtle motion/streak or reticle on the "U" or
the dot of an "i"-like glyph. Tagline: "THE AI RUNNING MAN."

RUNGENT VISUAL (the runner character — ALWAYS render it; never omit it in AR shots):
a glowing neon-green (#00FF6A) humanoid RUNNER SILHOUETTE in a mid-stride sprint pose — solid
filled figure with a bright emissive outline, soft outer glow/bloom, faint cyan (#00E5FF) rim
light, motion-streak trails behind it, a subtle dark contact shadow on the ground, and a thin
scanline/hologram shimmer so it reads as an AR overlay (not a real person). It must be clearly
recognizable as a running human and ~35–45% of frame height when close. Build it in pure CSS/SVG.

AR LAYERING (any AR camera shot): BACK = dark night-street background; MIDDLE = the Rungent figure
(the focal point); FRONT = the HUD (reticle, distance, HOLD-TO-CATCH ring, FIRE button,
timer/prize). Never hide the figure behind the street or the HUD; the reticle locks onto it.
```

---

## 1. PROTOTYPE — interactive Hunter-app prototype

```
Create an interactive mobile-app prototype for RUNDOWN (use the Shared Brand Brief). Dark,
neon-cyberpunk, AR-game HUD aesthetic. Mobile portrait. Build these linked screens with tappable
flows:

1) SPLASH / LOGIN — "RUNDOWN — THE AI RUNNING MAN." CTA: "Enter the Hunt." Anonymous / wallet
   login chips.
2) LEG BRIEF — story card for the current Leg: the Rungent's name + portrait, its backstory, the
   AREA (map thumbnail), START DATE/countdown timer, DESTINATION (hidden/teased), PRIZE POOL
   ($ big, glowing), sponsor logos row. CTA: "Join this Leg."
3) CREATE HUNTER AVATAR — pick a character, name, loadout (scope/weapon/gear) with a "Buy"
   storefront feel (some items locked/premium). CTA: "Deploy Avatar."
4) MAP / RADAR (home) — full-screen dark city map: MY avatar (center), other Hunters (live cyan
   dots), DELAYED Rungent breadcrumbs (fading green dots, "last seen 14 min ago"), the Rungent's
   live TRANSPORT MODE chip ("🚲 cycling"), checkpoints, geofenced no-go zones (amber hatch),
   staged AR items (magenta). Bottom bar: Map · AR · Items · Store · Leaderboard.
5) AR CAMERA — simulated phone-camera night street with the RUNGENT figure as the clear focal
   point (render per the RUNGENT VISUAL + AR LAYERING spec — it must be visibly present) + a
   targeting reticle locked on it, distance "23 m", "HOLD TO CATCH" ring and a "FIRE" button.
   Show another player's Hunter avatar visible in-scene too.
6) CATCH/SHOOT RESULT — success state: "RUNGENT DOWN" / "CAUGHT!" with confetti of green sparks,
   prize-share summary, "Share clip" button (TikTok/Reels/Kick icons).
7) SPECTATE — a live war-room view: map of dots + "LIVE" tag + picture-in-picture AR stream +
   "Back the Rungent / Back a Hunter" (glory points) panel.

Make the bottom nav and the Map→AR→Catch→Result the primary clickable path. Use the brand colors,
glow, reticle and radar motifs throughout. Include a persistent top HUD with leg countdown timer
and prize pool.
```

---

## 2. SLIDES — investor / sponsor pitch deck

```
Create a 14-slide investor & sponsor pitch deck for RUNDOWN (use the Shared Brand Brief).
Cinematic dark cyberpunk, big bold type, one idea per slide, lots of negative space, neon accents,
HUD/reticle motifs. Slides:

1) TITLE — "RUNDOWN — THE AI RUNNING MAN." Tagline + a hero shot (phone-AR glowing runner on a
   night street). "by Intangible Tech."
2) THE HOOK — "An AI is on the run in your city. Hunt it. In real life. In AR."
3) PROBLEM / OPPORTUNITY — location-based AR games proved $ (Pokémon Go), but nothing has combined
   real-world AR, an AI antagonist, live-broadcast manhunt, and a real crypto economy.
4) THE GAME — how a Leg works (story → area → start → hunt → catch/shoot → prize) as a clean
   visual flow.
5) WHY IT'S SAFE & SCALABLE — the target is a fully-synthetic AI, never a real human. No one is
   ever physically hunted.
6) THE AI RUNGENT — cunning, human-bounded movement (walk/bike/train, no flight), personality,
   carries a crypto wallet.
7) THE TWIST — you only see it through your lens; delayed breadcrumbs vs. live hunters = tension.
8) BUILT ON OUR STACK — reuses CubePay/AgentSphere (AR agents + wallets + payments) → we ship
   faster; the moat is spatial-payments + game tech combined.
9) THE ECONOMY — item economy, hunter purchases, sponsored checkpoints (the Niantic footfall
   model), spectator/broadcast, licensing.
10) PRIZE POOL = MAGNET — "$100k per 2-week Leg" funded by sponsors, not us; right-sized for v1.
11) BROADCAST — three POVs (Hunter, Spectator, Rungent's-eye); a live show, clip engine,
    founder-streamed token moment.
12) ROADMAP — Magic Slice demo → staff-operated Leg → autonomous AI → IP & creator economy.
13) THE BIG VISION — license a celebrity likeness (e.g. a Running-Man-style icon) as the AI
    runner; users build & compete to be the next Rungent (creator economy).
14) ASK — funding use (build AI brain, anti-cheat, first sponsored Leg), prize-pool sponsor
    pipeline, the "hunt-it-yourself" investor demo offer.

Keep copy punchy (headline + 1–2 support lines per slide). Use the green/cyan/magenta palette,
glow, and reticle/radar accents. Include placeholder spots for hero images and sponsor logos.
```

---

## 3. DOCUMENT — one-page concept / sponsor one-pager

```
Create a polished one-page concept document (one-pager) for RUNDOWN (use the Shared Brand Brief),
designed for sponsors and partners. Dark premium layout with neon accents, scannable. Sections:

- HEADER: RUNDOWN wordmark + tagline "THE AI RUNNING MAN" + one-line description.
- WHAT IT IS: 2–3 sentences (AI fugitive, real city, AR, catch/shoot, real prize pool).
- HOW A LEG WORKS: a compact 5-step horizontal flow (Story → Area → Start → Hunt → Capture/Escape).
- WHY SPONSORS WIN: sponsored checkpoints drive real footfall to your door; branded items, safe
  zones, title sponsorship; a live broadcast audience; crypto/AI-native demographic.
- THE NUMBERS box: prize pool magnet, 1–2 week legs, three broadcast POVs, built on a proven
  AR + payments stack.
- SAFE BY DESIGN: the target is an AI — never a real person; geofencing + active windows.
- CALL TO ACTION: "Sponsor the first Leg" / "Host a Leg in your city" + contact placeholder.

Use a 2-column premium layout, icons for each benefit, the brand palette and HUD motifs, and
leave a sponsor-logo strip at the bottom.
```

---

## 4. WIREFRAME — Hunter app information architecture

```
Create clean low-fidelity wireframes (grayscale, boxes + labels, no final styling) for the RUNGENT
Hunter mobile app, to define structure before visual design. Mobile portrait frames + a simple
flow-arrow map between them:

1) Onboarding: Splash → Login (anonymous/wallet) → Permissions (location + camera, with safety
   note).
2) Leg Hub: current Leg brief (story, area map, countdown, prize, sponsors) → Join.
3) Avatar & Store: create avatar → loadout/gear grid → purchase sheet.
4) Main: bottom tab bar [Map | AR | Items | Store | Leaderboard]. Detail the MAP screen layout:
   header HUD (timer + prize), the map canvas with legend (me, hunters-live, rungent-delayed,
   checkpoints, no-go zones, items), a "transport mode" status chip, and a "Go AR" CTA.
5) AR screen: camera viewport area with a labeled "RUNGENT figure (running silhouette)"
   placeholder as the focal point, reticle locked on it, distance readout, HOLD-TO-CATCH control,
   FIRE button, ammo/cooldown indicator.
6) Result sheet: caught/escaped state, prize-share breakdown, Share-clip.
7) Spectate/Back: war-room map + stream slot + back-rungent/back-hunter (glory points) panel.

Annotate each frame with notes on data shown and the key interaction. Show the primary navigation
path Map → AR → Result as bold arrows. Keep it strictly low-fi: this is for IA/UX review.
```

---

## 5. ANIMATION — teaser / trailer storyboard + motion

```
Create a short (~20–30s) vertical (9:16) animated teaser/trailer for RUNDOWN (use the Shared Brand
Brief). Cinematic neon-cyberpunk, night city, fast cuts, HUD/glitch transitions, driving
electronic beat feel. Storyboard the sequence:

IMPORTANT: render the RUNGENT figure per the RUNGENT VISUAL + AR LAYERING spec and make it
CLEARLY VISIBLE as the focal point in beats 2, 4 and 5 — in front of the street, behind the HUD;
the reticle locks onto it. Do not leave the AR/shooting shots empty.

1) [0–3s] Black. A green glitch. Text types out: "AN AI IS ON THE RUN." Distant siren.
2) [3–7s] A phone rises; through its camera the RUNGENT figure (per spec — glowing green runner
   silhouette, motion streaks, the clear focal point) sprints across a dark street and vanishes
   around a corner. Reticle tries to follow, flickers "TARGET LOST."
3) [7–12s] Quick montage: a war-room map blooming with cyan hunter dots; fading green breadcrumb
   trail; a "🚲 CYCLING" mode chip; a train blurring past.
4) [12–17s] Multiple hunters (real people, phones up) converging down an alley; the RUNGENT figure
   (clearly visible, glowing) runs toward camera, FEINTS one way then DOUBLES BACK; the
   "HOLD TO CATCH" ring closes on it — then breaks as a smoke decoy puffs around it. Tension.
5) [17–23s] The crosshair LOCKS directly onto the RUNGENT figure (reticle snaps green) — "FIRE" —
   a green muzzle flash hits the figure, it staggers and dissolves into green particles —
   "RUNGENT DOWN" stamps over where it was. Prize pool number slams on screen ($100,000) with a
   coin-burst.
6) [23–28s] Logo reveal: "RUNDOWN — THE AI RUNNING MAN." Tagline: "You can only see it through
   your lens." End CTA: "Join the Hunt." + "by Intangible Tech."

Use the green/cyan/magenta palette, reticle/radar/breadcrumb/glitch motifs, kinetic uppercase
typography, and a countdown-timer + LIVE-tag HUD overlay throughout. Specify timing, transitions
(glitch cuts, radar wipes), and on-screen text for each beat.
```

---

## Notes for whoever runs these

- Paste **§0 Shared Brand Brief** first so palette, tone, and motifs stay consistent across all
  five artifacts.
- After generating, iterate with follow-ups like: "make it darker / more cinematic," "tighten the
  copy," "swap to a daytime variant," "add real sponsor logo slots," "make the prize pool the
  hero of slide 1."
- Keep the safety message visible (AI target, geofencing) — it's a differentiator *and* it
  pre-empts the obvious investor objection.
- Source content + facts from `rundown.md`; source the build story for slide 8 from
  `rundown-tech.md`.
```
