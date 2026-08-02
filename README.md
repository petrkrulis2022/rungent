# RUNDOWN — demo

Throwaway "magic slice" proving: deploy a Rungent → hunt it in AR → on-chain payout.
**Testnet only.** Sepolia + testnet USDC. Never wire real funds.

## Quick start

```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # fill in your values
pnpm dev                                  # http://localhost:5173
```

## Two ways to run the hunter view

| Mode | URL | Uses |
|---|---|---|
| Mock geo (desktop dev) | `http://localhost:5173/?geo=mock` | WASD to walk, Q/E to turn, heading slider |
| Real device | `https://<ngrok>/?geo=device` | Real GPS + compass, needs HTTPS + a phone |

Mock is the default on desktop, device is the default on a phone. The rest of the
app cannot tell the difference — everything reads position through `GeoProvider`.

## Phone testing (HTTPS required)

`getUserMedia` and `DeviceOrientation` both require a secure context.

```bash
pnpm dev
ngrok http 5173     # open the https:// URL on the phone
```

On iOS, camera and compass permission must be triggered by a tap — the
"Grant access" button in the hunter view exists for exactly that reason.

## Database

Apply `supabase/schema.sql` to your Supabase project (SQL Editor → paste → run).

**Do not add a SELECT policy to `rungent_state`.** It has RLS on and zero
policies by design: the anon key is public, so RLS is the only thing stopping a
hunter from reading the Rungent's true position. Clients get position solely via
`get_rungent_for_hunter()`, which returns nulls when out of engagement range.

## Contracts

```bash
pnpm contracts:compile
pnpm contracts:test
pnpm --filter @rundown/contracts deploy:sepolia
```

## Tests

```bash
pnpm --filter @rundown/rungent-ai test   # movement simulator (13 tests)
pnpm contracts:test                       # LegCommit + PrizeEscrow
```

These two suites cover the only places where a bug costs money or breaks
fairness. Keep them green.

## Secrets

- `apps/web/.env` — client-visible by nature. The Maps key here **must** be
  restricted by HTTP referrer + API in the GCP console.
- `.env.server.example` — server-only keys. The Anthropic key and the Supabase
  `service_role` key must NEVER appear in `apps/web/`; anything there is
  extractable from the shipped bundle.

## Running a full demo

Three processes:

```bash
# 1. web app
pnpm dev

# 2. the Rungent brain + simulator (needs service_role key, see .env.server.example)
export SUPABASE_URL=https://odnxttczxgvejbcwextz.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...      # NEVER in apps/web
export ANTHROPIC_API_KEY=...              # optional; falls back to plain walking
pnpm --filter @rundown/rungent-ai start <legId>

# 3. adjudication (takedown + payout)
supabase functions deploy adjudicate --no-verify-jwt
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... ORACLE_PRIVATE_KEY=... \
                     SEPOLIA_RPC_URL=... PRIZE_ESCROW_ADDRESS=...
```

Flow: Deployer view → pins → plan route → Deploy → copy hunt link → start the
Rungent service with that legId → open the hunt link on Wallet B → START HUNT.

## Desktop rehearsal (no phone needed)

Open the hunt link with `?geo=mock` appended. WASD walks, Q/E turns. Walk to
within 75 m and the Rungent appears in the AR view over your webcam feed.
Everything below the `GeoProvider` seam behaves identically to a real phone.

## AR notes

- No WebXR — iOS Safari does not support it. Camera comes from `getUserMedia`,
  pose from Geolocation + DeviceOrientation.
- The Rungent is a **procedural** holographic humanoid built from primitives,
  so the demo renders with zero downloaded assets. Drop in a rigged Mixamo GLB
  later; the hologram material and walk cycle are written to apply to either.
- Compass is low-pass filtered (`smoothHeading`), and the anchored position is
  eased (`easeTowards`). Both are visual only — adjudication always uses raw
  server-side coordinates.
