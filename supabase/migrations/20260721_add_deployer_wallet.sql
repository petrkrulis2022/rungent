-- Add deployer_wallet to legs: the wallet (Wallet A) that deployed/committed the leg.
-- Used for the two-wallet demo + the hunter firewall (a hunter cannot be the deployer).

ALTER TABLE legs
    ADD COLUMN IF NOT EXISTS deployer_wallet TEXT;

CREATE INDEX IF NOT EXISTS idx_legs_deployer_wallet ON legs (deployer_wallet);

COMMENT ON COLUMN legs.deployer_wallet IS 'Address (Wallet A) that deployed/owns this leg; recorded on commit. Cannot hunt this leg.';
