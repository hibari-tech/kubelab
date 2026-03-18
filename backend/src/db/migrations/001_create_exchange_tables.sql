-- Exchange tables for KubeLab crypto exchange MVP
-- All monetary amounts stored in satoshis (BIGINT, no floats)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS exchange_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(64) UNIQUE NOT NULL,
  display_name VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exchange_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES exchange_users(id) ON DELETE CASCADE,
  currency VARCHAR(8) NOT NULL DEFAULT 'BTC',
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, currency)
);

CREATE TABLE IF NOT EXISTS exchange_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES exchange_users(id),
  side VARCHAR(4) NOT NULL CHECK (side IN ('BUY', 'SELL')),
  type VARCHAR(6) NOT NULL CHECK (type IN ('LIMIT', 'MARKET')),
  price BIGINT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  amount_filled BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON exchange_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON exchange_orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_price ON exchange_orders(price);

CREATE TABLE IF NOT EXISTS exchange_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maker_order_id UUID NOT NULL REFERENCES exchange_orders(id),
  taker_order_id UUID NOT NULL REFERENCES exchange_orders(id),
  price BIGINT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trades_created ON exchange_trades(created_at DESC);

CREATE TABLE IF NOT EXISTS exchange_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES exchange_users(id),
  type VARCHAR(16) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRADE')),
  amount BIGINT NOT NULL,
  tx_hash TEXT,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON exchange_transactions(user_id);

CREATE TABLE IF NOT EXISTS exchange_balances (
  user_id UUID PRIMARY KEY REFERENCES exchange_users(id) ON DELETE CASCADE,
  available BIGINT NOT NULL DEFAULT 0,
  locked BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
