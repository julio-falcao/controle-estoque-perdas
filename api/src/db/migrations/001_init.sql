-- Produtos: o saldo atual fica na própria tabela e nunca pode ficar negativo.
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  sku           VARCHAR(30)  NOT NULL UNIQUE,
  name          VARCHAR(120) NOT NULL,
  category      VARCHAR(60)  NOT NULL,
  unit_cost     NUMERIC(12,2) NOT NULL CHECK (unit_cost >= 0),
  min_stock     INTEGER NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
  current_stock INTEGER NOT NULL DEFAULT 0 CHECK (current_stock >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Toda alteração de saldo vira uma movimentação (histórico auditável).
-- quantity é com sinal: positivo entra, negativo sai.
CREATE TABLE IF NOT EXISTS stock_movements (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  type       VARCHAR(10) NOT NULL CHECK (type IN ('ENTRADA', 'SAIDA', 'AJUSTE', 'PERDA')),
  quantity   INTEGER NOT NULL CHECK (quantity <> 0),
  unit_cost  NUMERIC(12,2) NOT NULL,
  reason     VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_type_date ON stock_movements(type, created_at);

CREATE TABLE IF NOT EXISTS inventories (
  id         SERIAL PRIMARY KEY,
  status     VARCHAR(10) NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO')),
  notes      VARCHAR(200),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at  TIMESTAMPTZ
);

-- system_qty é a foto do saldo no momento em que o inventário foi aberto.
CREATE TABLE IF NOT EXISTS inventory_items (
  inventory_id INTEGER NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id),
  system_qty   INTEGER NOT NULL,
  counted_qty  INTEGER CHECK (counted_qty >= 0),
  PRIMARY KEY (inventory_id, product_id)
);
