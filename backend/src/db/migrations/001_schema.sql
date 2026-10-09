-- =========================================================
-- WMS SCHEMA — PostgreSQL
-- Sesuai WMS-Blueprint.md bagian 8.2
-- Dijalankan oleh: npm run migrate (src/db/runMigrations.js)
-- =========================================================

-- =========================================================
-- EXTENSION & ENUM
-- =========================================================
CREATE TYPE user_role AS ENUM ('admin','supervisor','operator_inbound','operator_outbound','viewer');
CREATE TYPE location_type AS ENUM ('storage','receiving','staging','reject','hold');
CREATE TYPE stock_status AS ENUM ('available','hold','rejected','reserved');
CREATE TYPE movement_type AS ENUM ('inbound','putaway','outbound','transfer','adjustment','reject','opname');
CREATE TYPE inbound_status AS ENUM ('draft','open','receiving','qc','putaway','completed','cancelled');
CREATE TYPE outbound_status AS ENUM ('draft','allocated','picking','packing','ready_to_ship','shipped','cancelled');
CREATE TYPE opname_status AS ENUM ('draft','counting','review','approved','cancelled');

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          user_role NOT NULL DEFAULT 'viewer',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================
-- MASTER DATA
-- =========================================================
CREATE TABLE items (
  id           SERIAL PRIMARY KEY,
  sku          VARCHAR(50) UNIQUE NOT NULL,
  name         VARCHAR(200) NOT NULL,
  category     VARCHAR(100),
  uom          VARCHAR(20) NOT NULL DEFAULT 'pcs',
  length_cm    NUMERIC(10,2),
  width_cm     NUMERIC(10,2),
  height_cm    NUMERIC(10,2),
  weight_kg    NUMERIC(10,3),
  min_stock    INTEGER NOT NULL DEFAULT 0,
  barcode      VARCHAR(100) UNIQUE,
  is_batch     BOOLEAN NOT NULL DEFAULT FALSE,
  has_expiry   BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE locations (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(50) UNIQUE NOT NULL,      -- contoh: A-01-02-03
  zone        VARCHAR(20) NOT NULL,
  rack        VARCHAR(20),
  level       VARCHAR(20),
  bin         VARCHAR(20),
  type        location_type NOT NULL DEFAULT 'storage',
  capacity    INTEGER,                          -- kapasitas (satuan bebas, mis. pcs/pallet)
  pos_x       NUMERIC(8,2),                     -- untuk visualisasi 2D/3D
  pos_y       NUMERIC(8,2),
  pos_z       NUMERIC(8,2),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE suppliers (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(30) UNIQUE NOT NULL,
  name      VARCHAR(150) NOT NULL,
  phone     VARCHAR(30),
  address   TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE customers (
  id        SERIAL PRIMARY KEY,
  code      VARCHAR(30) UNIQUE NOT NULL,
  name      VARCHAR(150) NOT NULL,
  phone     VARCHAR(30),
  address   TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- =========================================================
-- INVENTORY
-- =========================================================
CREATE TABLE stocks (
  id           SERIAL PRIMARY KEY,
  item_id      INTEGER NOT NULL REFERENCES items(id),
  location_id  INTEGER NOT NULL REFERENCES locations(id),
  batch_no     VARCHAR(50),
  expiry_date  DATE,
  status       stock_status NOT NULL DEFAULT 'available',
  qty          INTEGER NOT NULL DEFAULT 0 CHECK (qty >= 0),
  received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- dasar FIFO
  reserved_ref INTEGER,                                -- penanda outbound order saat reservasi
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Unique index dengan COALESCE karena batch_no bisa NULL:
-- dua NULL tidak dianggap sama oleh constraint UNIQUE biasa.
CREATE UNIQUE INDEX uq_stocks_item_loc_batch_status
  ON stocks (item_id, location_id, COALESCE(batch_no, ''), status);

CREATE INDEX idx_stocks_item ON stocks(item_id);
CREATE INDEX idx_stocks_location ON stocks(location_id);
CREATE INDEX idx_stocks_reserved_ref ON stocks(reserved_ref) WHERE status = 'reserved';

CREATE TABLE stock_movements (
  id             BIGSERIAL PRIMARY KEY,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  from_location  INTEGER REFERENCES locations(id),
  to_location    INTEGER REFERENCES locations(id),
  qty            INTEGER NOT NULL CHECK (qty > 0),
  type           movement_type NOT NULL,
  batch_no       VARCHAR(50),
  ref_type       VARCHAR(30),           -- 'inbound','outbound','opname', dll
  ref_id         INTEGER,
  note           TEXT,
  user_id        INTEGER REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_movements_item_date ON stock_movements(item_id, created_at DESC);

-- =========================================================
-- INBOUND
-- =========================================================
CREATE TABLE inbound_orders (
  id           SERIAL PRIMARY KEY,
  doc_no       VARCHAR(40) UNIQUE NOT NULL,      -- IN-20261008-0001
  supplier_id  INTEGER REFERENCES suppliers(id),
  status       inbound_status NOT NULL DEFAULT 'draft',
  expected_at  DATE,
  note         TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE inbound_items (
  id            SERIAL PRIMARY KEY,
  inbound_id    INTEGER NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES items(id),
  qty_expected  INTEGER NOT NULL CHECK (qty_expected > 0),
  qty_received  INTEGER NOT NULL DEFAULT 0,
  qty_accepted  INTEGER NOT NULL DEFAULT 0,
  qty_hold      INTEGER NOT NULL DEFAULT 0,
  qty_rejected  INTEGER NOT NULL DEFAULT 0,
  qty_putaway   INTEGER NOT NULL DEFAULT 0,
  batch_no      VARCHAR(50),
  expiry_date   DATE,
  reject_reason TEXT
);

-- =========================================================
-- OUTBOUND
-- =========================================================
CREATE TABLE outbound_orders (
  id           SERIAL PRIMARY KEY,
  doc_no       VARCHAR(40) UNIQUE NOT NULL,      -- OUT-20261008-0001
  customer_id  INTEGER REFERENCES customers(id),
  status       outbound_status NOT NULL DEFAULT 'draft',
  due_date     DATE,
  priority     SMALLINT NOT NULL DEFAULT 3,      -- 1 = mendesak
  note         TEXT,
  created_by   INTEGER REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outbound_items (
  id             SERIAL PRIMARY KEY,
  outbound_id    INTEGER NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  qty_ordered    INTEGER NOT NULL CHECK (qty_ordered > 0),
  qty_allocated  INTEGER NOT NULL DEFAULT 0,
  qty_picked     INTEGER NOT NULL DEFAULT 0,
  qty_packed     INTEGER NOT NULL DEFAULT 0,
  qty_shipped    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE picking_tasks (
  id             SERIAL PRIMARY KEY,
  outbound_id    INTEGER NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  item_id        INTEGER NOT NULL REFERENCES items(id),
  location_id    INTEGER NOT NULL REFERENCES locations(id),
  batch_no       VARCHAR(50),
  qty_plan       INTEGER NOT NULL,
  qty_picked     INTEGER NOT NULL DEFAULT 0,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, done
  picked_by      INTEGER REFERENCES users(id),
  picked_at      TIMESTAMPTZ
);

CREATE TABLE order_timeline (
  id          BIGSERIAL PRIMARY KEY,
  order_type  VARCHAR(10) NOT NULL,              -- 'inbound' / 'outbound'
  order_id    INTEGER NOT NULL,
  stage       VARCHAR(30) NOT NULL,              -- created, allocated, picking, ...
  user_id     INTEGER REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_timeline_order ON order_timeline(order_type, order_id);

-- =========================================================
-- STOCK OPNAME
-- =========================================================
CREATE TABLE stock_opname_sessions (
  id          SERIAL PRIMARY KEY,
  doc_no      VARCHAR(40) UNIQUE NOT NULL,
  status      opname_status NOT NULL DEFAULT 'draft',
  note        TEXT,
  created_by  INTEGER REFERENCES users(id),
  approved_by INTEGER REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE stock_opname_items (
  id            SERIAL PRIMARY KEY,
  session_id    INTEGER NOT NULL REFERENCES stock_opname_sessions(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES items(id),
  location_id   INTEGER NOT NULL REFERENCES locations(id),
  qty_system    INTEGER NOT NULL,
  qty_counted   INTEGER,
  note          TEXT,
  CONSTRAINT uq_opname_line UNIQUE (session_id, item_id, location_id)
);

-- =========================================================
-- AUDIT LOG
-- =========================================================
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      VARCHAR(50) NOT NULL,              -- create, update, delete, login
  entity      VARCHAR(50) NOT NULL,              -- items, locations, ...
  entity_id   VARCHAR(50),
  detail      JSONB,
  ip_address  VARCHAR(50),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity, entity_id);
