-- Seed data awal WMS
-- User: admin / supervisor / operator_inbound / operator_outbound / viewer
-- Password default: <nama_role>123 (hash bcrypt dibuat oleh runSeed.js)

INSERT INTO users (name, email, password_hash, role)
VALUES
  ('Administrator', 'admin@wms.local',        '__HASH_ADMIN__',        'admin'),
  ('Supervisor',    'supervisor@wms.local',   '__HASH_SUPERVISOR__',   'supervisor'),
  ('Inbound Ops',   'inbound@wms.local',      '__HASH_INBOUND__',      'operator_inbound'),
  ('Outbound Ops',  'outbound@wms.local',     '__HASH_OUTBOUND__',     'operator_outbound'),
  ('Viewer',        'viewer@wms.local',       '__HASH_VIEWER__',       'viewer')
ON CONFLICT (email) DO NOTHING;

-- Contoh lokasi: zona A (storage), B (storage), R (receiving), H (hold), X (reject)
INSERT INTO locations (code, zone, rack, level, bin, type, capacity, pos_x, pos_y)
VALUES
  ('RCV-01',  'R', 'RCV', '1', '1', 'receiving', 500, 1, 1),
  ('STG-01',  'S', 'STG', '1', '1', 'staging',   300, 2, 1),
  ('A-01-01', 'A', '01',  '01', NULL, 'storage', 1000, 3, 1),
  ('A-01-02', 'A', '01',  '02', NULL, 'storage', 1000, 3, 2),
  ('A-02-01', 'A', '02',  '01', NULL, 'storage', 1000, 4, 1),
  ('B-01-01', 'B', '01',  '01', NULL, 'storage', 800, 5, 1),
  ('B-01-02', 'B', '01',  '02', NULL, 'storage', 800, 5, 2),
  ('HOLD-01', 'H', 'HOLD','1', '1', 'hold',      200, 6, 1),
  ('REJ-01',  'X', 'REJ', '1', '1', 'reject',    200, 7, 1)
ON CONFLICT (code) DO NOTHING;

-- Contoh supplier & customer
INSERT INTO suppliers (code, name, phone, address) VALUES
  ('SUP-001', 'PT Sumber Makmur',       '021-555-0001', 'Jl. Industri No. 1, Jakarta'),
  ('SUP-002', 'CV Mitra Jaya',          '021-555-0002', 'Jl. Raya No. 22, Bogor'),
  ('SUP-003', 'UD Sentosa Bersama',     '021-555-0003', 'Jl. Pasar No. 5, Tangerang')
ON CONFLICT (code) DO NOTHING;

INSERT INTO customers (code, name, phone, address) VALUES
  ('CUS-001', 'Toko Bahagia',           '0812-0001-0001', 'Jl. Merdeka No. 10, Jakarta'),
  ('CUS-002', 'Supermarket Sejahtera',  '0812-0002-0002', 'Jl. Sudirman No. 88, Bandung'),
  ('CUS-003', 'Toko Online Kita',       '0812-0003-0003', 'Jl. Digital No. 3, Surabaya')
ON CONFLICT (code) DO NOTHING;

-- Contoh barang
INSERT INTO items (sku, name, category, uom, min_stock, barcode, is_batch, has_expiry, length_cm, width_cm, height_cm, weight_kg) VALUES
  ('SKU-001', 'Sabun Cuci Piring 800ml', 'Household', 'pcs', 20, '8990001000001', FALSE, FALSE, 8, 8, 20, 0.9),
  ('SKU-002', 'Detergen Bubuk 1.8kg',    'Household', 'pcs', 15, '8990001000002', FALSE, FALSE, 20, 30, 12, 1.8),
  ('SKU-003', 'Minyak Goreng 2L',        'Grocery',   'pcs', 30, '8990001000003', TRUE,  TRUE,  30, 12, 12, 1.9),
  ('SKU-004', 'Beras Premium 5kg',       'Grocery',   'pcs', 25, '8990001000004', TRUE,  FALSE, 35, 20, 15, 5.1),
  ('SKU-005', 'Susu UHT Full Cream 1L',  'Grocery',   'pcs', 40, '8990001000005', TRUE,  TRUE,  10, 10, 24, 1.05),
  ('SKU-006', 'Tisu Wajah 250s',         'Personal',  'pcs', 10, '8990001000006', FALSE, FALSE, 12, 12, 18, 0.4),
  ('SKU-007', 'Shampoo 340ml',           'Personal',  'pcs', 12, '8990001000007', FALSE, FALSE, 8, 8, 22, 0.4),
  ('SKU-008', 'Kopi Sachet 25x12g',      'Grocery',   'box', 8,  '8990001000008', TRUE,  TRUE,  25, 15, 10, 0.5)
ON CONFLICT (sku) DO NOTHING;
