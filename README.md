# RUNDOWN — The Augmented Reality Pursuit Show

A real-world AR chase game where an AI-driven **Rungent** (fugitive agent) navigates city streets while **Hunters** track and catch it using their phones. Prizes are locked in on-chain escrow and released upon a verified capture.

## Architecture

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  PWA Client  │   │   Server     │   │  Blockchain  │
│  React + R3F │◄──┤  Simulator   ├──►│  Sepolia EVM │
│  Viem/Wagmi  │   │  Voice Relay │   │  LegCommit   │
└──────┬───────┘   └──────┬───────┘   │  PrizeEscrow │
       │                  │           └──────────────┘
       └────────┬─────────┘
          ┌─────▼─────┐
          │ Supabase   │
          │ Postgres + │
          │ PostGIS    │
          └────────────┘
```

## Quick Start

### Prerequisites
- Node.js 18+
- WSL/Linux (recommended)
- MetaMask browser extension (for Web3 features)

### 1. Smart Contracts
```bash
cd contracts
npm install
npx hardhat test     # Run tests (6 passing)
npx hardhat compile  # Compile contracts
```

### 2. Server (Simulator + Voice)
```bash
cd server
npm install
cp .env.example .env  # Configure your keys
node simulator.js     # Start route simulator (port 8000)
node voiceRelay.js    # Start voice relay (port 8001)
```

### 3. Client PWA
```bash
cd client
npm install --legacy-peer-deps
npm run dev           # Start dev server (port 5173)
```

## Environment Variables

### `client/.env`
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_LEG_COMMIT_ADDR=0xDeployedContractAddress
VITE_USE_LOCAL_CHAIN=false
```

### `server/.env`
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_MAPS_API_KEY=AIza...
SIMULATOR_PORT=8000
VOICE_PORT=8001
```

## Project Structure

| Directory | Purpose |
|-----------|---------|
| `contracts/` | Solidity smart contracts (Hardhat) |
| `supabase/` | PostgreSQL + PostGIS schema migrations |
| `server/` | Route simulator engine + Voice WebSocket relay |
| `client/` | React 19 + Vite PWA with Three.js AR overlay |
| `Rundown/` | Design specs and product documentation |

## Demo Flow

1. **Admin** opens Admin panel → configures Rungent name, route, and prize → commits leg on-chain
2. **Server simulator** starts ticking the Rungent along its route, writing secret coordinates to `rungent_state` and delayed breadcrumbs to `rungent_breadcrumbs`
3. **Hunter** connects wallet → sees holographic Rungent in AR camera view → tracks via delayed trail
4. **Capture** → Hunter enters 30m proximity → triggers `PrizeEscrow.settleCatch()` → USDC released

## License

MIT
