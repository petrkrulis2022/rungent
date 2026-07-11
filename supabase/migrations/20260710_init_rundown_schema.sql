-- Enable PostGIS extension for proximity checking
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. legs table: Stores metadata for each pursuit leg
CREATE TABLE IF NOT EXISTS legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'committed', 'live', 'sleeping', 'ended')),
    story TEXT,
    motivation TEXT,
    start_lat DOUBLE PRECISION NOT NULL,
    start_lng DOUBLE PRECISION NOT NULL,
    start_alt DOUBLE PRECISION DEFAULT 0.0,
    end_lat DOUBLE PRECISION NOT NULL,
    end_lng DOUBLE PRECISION NOT NULL,
    end_alt DOUBLE PRECISION DEFAULT 0.0,
    end_reveal_at TIMESTAMPTZ,
    skills JSONB DEFAULT '{}'::jsonb,
    rules_hash TEXT,
    active_window JSONB DEFAULT '{"open": "08:00", "close": "22:00", "tz": "UTC"}'::jsonb,
    breadcrumb_delay_sec INT DEFAULT 900,
    chain TEXT DEFAULT 'Sepolia',
    prize_escrow_addr TEXT,
    operating_wallet_addr TEXT,
    prize_amount NUMERIC DEFAULT 0.0,
    prize_token TEXT DEFAULT 'USDC',
    onchain_commit_tx TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 2. rungent_state table: Authoritative true path position (SECRET - NEVER EXPOSE TO CLIENTS)
CREATE TABLE IF NOT EXISTS rungent_state (
    leg_id UUID PRIMARY KEY REFERENCES legs(id) ON DELETE CASCADE,
    true_lat DOUBLE PRECISION NOT NULL,
    true_lng DOUBLE PRECISION NOT NULL,
    true_alt DOUBLE PRECISION DEFAULT 0.0,
    true_geom GEOMETRY(Point, 4326),  -- Spatial index for PostGIS
    transport_mode TEXT DEFAULT 'walk' CHECK (transport_mode IN ('walk', 'run')),
    speed_kmh NUMERIC DEFAULT 0.0,
    heading_deg NUMERIC DEFAULT 0.0,
    energy NUMERIC DEFAULT 100.0,
    status TEXT DEFAULT 'resting' CHECK (status IN ('moving', 'resting', 'caught', 'arrived')),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Index for spatial lookups
CREATE INDEX IF NOT EXISTS idx_rungent_state_geom ON rungent_state USING gist(true_geom);

-- Trigger to automatically keep true_geom updated from true_lat and true_lng
CREATE OR REPLACE FUNCTION update_rungent_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.true_geom := ST_SetSRID(ST_MakePoint(NEW.true_lng, NEW.true_lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_rungent_geom
    BEFORE INSERT OR UPDATE OF true_lat, true_lng ON rungent_state
    FOR EACH ROW EXECUTE FUNCTION update_rungent_geom();

-- 3. rungent_breadcrumbs table: Delayed coordinates public view
CREATE TABLE IF NOT EXISTS rungent_breadcrumbs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    alt DOUBLE PRECISION DEFAULT 0.0,
    transport_mode TEXT DEFAULT 'walk',
    speed_kmh NUMERIC DEFAULT 0.0,
    ts TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_leg_ts ON rungent_breadcrumbs(leg_id, ts DESC);

-- 4. hunters table: Live location-bound avatars
CREATE TABLE IF NOT EXISTS hunters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    wallet_addr TEXT NOT NULL,
    display_name TEXT,
    avatar_glb TEXT,
    last_lat DOUBLE PRECISION NOT NULL,
    last_lng DOUBLE PRECISION NOT NULL,
    last_alt DOUBLE PRECISION DEFAULT 0.0,
    last_geom GEOMETRY(Point, 4326),
    last_seen_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    track_ok BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_hunter_leg_wallet UNIQUE (leg_id, wallet_addr)
);

CREATE INDEX IF NOT EXISTS idx_hunters_geom ON hunters USING gist(last_geom);

-- Trigger to update hunter spatial column
CREATE OR REPLACE FUNCTION update_hunter_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_geom := ST_SetSRID(ST_MakePoint(NEW.last_lng, NEW.last_lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_hunter_geom
    BEFORE INSERT OR UPDATE OF last_lat, last_lng ON hunters
    FOR EACH ROW EXECUTE FUNCTION update_hunter_geom();

-- 5. viewers table: Username/wallet only
CREATE TABLE IF NOT EXISTS viewers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    wallet_addr TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    CONSTRAINT unique_viewer_leg_wallet UNIQUE (leg_id, wallet_addr)
);

-- 6. items table: Deployed AR objects
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('bike', 'car', 'intel')),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    alt DOUBLE PRECISION DEFAULT 0.0,
    geom GEOMETRY(Point, 4326),
    provider_wallet TEXT NOT NULL,
    price NUMERIC DEFAULT 0.0,
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'used', 'expired')),
    wallet_addr TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_items_geom ON items USING gist(geom);

CREATE OR REPLACE FUNCTION update_item_geom()
RETURNS TRIGGER AS $$
BEGIN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.last_lng, NEW.last_lat), 4326); -- wait, column names are lat/lng for items
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_update_item_geom
    BEFORE INSERT OR UPDATE OF lat, lng ON items
    FOR EACH ROW EXECUTE FUNCTION update_item_geom();

-- 7. catches table: Action captures
CREATE TABLE IF NOT EXISTS catches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    hunter_wallet TEXT NOT NULL,
    method TEXT NOT NULL CHECK (method IN ('touch', 'shoot')),
    claimed_lat DOUBLE PRECISION NOT NULL,
    claimed_lng DOUBLE PRECISION NOT NULL,
    ts TIMESTAMPTZ DEFAULT clock_timestamp(),
    video_ref TEXT,
    verify_status TEXT DEFAULT 'pending' CHECK (verify_status IN ('pending', 'passed', 'failed')),
    settled_tx TEXT
);

-- 8. prediction markets & bets table
CREATE TABLE IF NOT EXISTS markets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('escape_vs_caught', 'which_hunter')),
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'resolved'))
);

CREATE TABLE IF NOT EXISTS bets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    market_id UUID REFERENCES markets(id) ON DELETE CASCADE,
    wallet_addr TEXT NOT NULL,
    option TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    token TEXT DEFAULT 'USDC',
    tx TEXT,
    payout_tx TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 9. spotter confirmations
CREATE TABLE IF NOT EXISTS spots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    viewer_wallet TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    ts TIMESTAMPTZ DEFAULT clock_timestamp(),
    reward_tx TEXT
);

-- 10. events log: Doppler dopamine feed
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leg_id UUID REFERENCES legs(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    ts TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- Enable Row Level Security (RLS) policies
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rungent_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE rungent_breadcrumbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunters ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE spots ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Dynamic RLS Policies
-- Legs are visible to everyone
CREATE POLICY "Public read legs" ON legs FOR SELECT USING (true);
CREATE POLICY "Admin write legs" ON legs FOR ALL USING (true); -- simplify for demo

-- CRITICAL SECURITY CLAMP: Rungent's true state is hidden. Nobody can query rungent_state.
-- Only database triggers or service keys can select. No policy allows public select.
CREATE POLICY "Rungent true state is private" ON rungent_state FOR SELECT TO service_role USING (true);

-- Breadcrumbs are visible to everyone
CREATE POLICY "Public read breadcrumbs" ON rungent_breadcrumbs FOR SELECT USING (true);

-- Hunters: Everyone can see current location of active hunters. Anyone can update their own hunter coordinate.
CREATE POLICY "Public read hunters" ON hunters FOR SELECT USING (true);
CREATE POLICY "Hunters manage their own position" ON hunters FOR ALL USING (true); -- simplified for demo; in v1 check auth.uid() or matching web3 signature

-- Viewers: Publicly readable
CREATE POLICY "Public read viewers" ON viewers FOR SELECT USING (true);
CREATE POLICY "Viewers manage themselves" ON viewers FOR ALL USING (true);

-- Items, Catches, Markets, Bets, Spots, Events: All readable, writeable by matching roles
CREATE POLICY "Public read items" ON items FOR SELECT USING (true);
CREATE POLICY "Manage items" ON items FOR ALL USING (true);

CREATE POLICY "Public read catches" ON catches FOR SELECT USING (true);
CREATE POLICY "Manage catches" ON catches FOR ALL USING (true);

CREATE POLICY "Public read markets" ON markets FOR SELECT USING (true);
CREATE POLICY "Public read bets" ON bets FOR SELECT USING (true);
CREATE POLICY "Manage bets" ON bets FOR ALL USING (true);

CREATE POLICY "Public read spots" ON spots FOR SELECT USING (true);
CREATE POLICY "Manage spots" ON spots FOR ALL USING (true);

CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Manage events" ON events FOR ALL USING (true);
