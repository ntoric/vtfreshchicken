-- Internal wallet system: per-tenant customer wallets with transaction history.
-- Customers can top up their wallet via any payment gateway and use the balance
-- to pay for orders.

CREATE TABLE IF NOT EXISTS customer_wallets (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance       NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency_code TEXT NOT NULL DEFAULT 'USD',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_wallets_tenant ON customer_wallets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_wallets_user ON customer_wallets(user_id);

CREATE TRIGGER trg_customer_wallets_updated
    BEFORE UPDATE ON customer_wallets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Wallet transactions: every credit (top-up, refund, admin adjustment) and
-- debit (purchase) is recorded here for audit and history.
CREATE TABLE IF NOT EXISTS wallet_transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    wallet_id        UUID NOT NULL REFERENCES customer_wallets(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,   -- set for purchase debits and order refunds
    payment_txn_id  UUID,                                              -- reference to payment_transactions row for top-ups
    type            TEXT NOT NULL,                                     -- 'credit' | 'debit'
    source          TEXT NOT NULL,                                     -- 'topup' | 'purchase' | 'refund' | 'admin_adjustment'
    amount          NUMERIC(12,2) NOT NULL,                            -- positive number; sign determined by type
    balance_after   NUMERIC(12,2) NOT NULL,                            -- wallet balance after this transaction
    currency_code   TEXT NOT NULL DEFAULT 'USD',
    description     TEXT,
    reference       TEXT,                                              -- human-readable reference (e.g., gateway txn id, order number)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tenant ON wallet_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_order ON wallet_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at DESC);
