# WMS (Warehouse Management System) — Blueprint Lengkap

Dokumen perencanaan untuk membangun WMS sendiri dengan **semua tools gratis**.

**Stack:** Node.js + Express · PostgreSQL · React.js + Tailwind CSS

---

## Daftar Isi

1. [Tujuan & Ruang Lingkup](#1-tujuan--ruang-lingkup)
2. [Daftar Teknologi](#2-daftar-teknologi)
3. [Arsitektur Sistem](#3-arsitektur-sistem)
4. [Struktur Folder](#4-struktur-folder)
5. [Role & Hak Akses](#5-role--hak-akses)
6. [Modul & Fitur](#6-modul--fitur)
7. [Alur Proses Bisnis](#7-alur-proses-bisnis)
8. [Rancangan Database](#8-rancangan-database)
9. [Rancangan REST API](#9-rancangan-rest-api)
10. [Rancangan Halaman Frontend](#10-rancangan-halaman-frontend)
11. [Setup Awal (Langkah demi Langkah)](#11-setup-awal-langkah-demi-langkah)
12. [Keamanan](#12-keamanan)
13. [Testing](#13-testing)
14. [Deployment Gratis](#14-deployment-gratis)
15. [Roadmap Pengerjaan](#15-roadmap-pengerjaan)
16. [Ide Pengembangan Lanjutan](#16-ide-pengembangan-lanjutan)
17. [Checklist Akhir](#17-checklist-akhir)

---

## 1. Tujuan & Ruang Lingkup

### Tujuan
Membangun sistem yang membantu gudang mengelola:
- Barang masuk (inbound), penyimpanan (putaway), dan barang keluar (outbound).
- Posisi dan jumlah stok secara akurat per lokasi.
- Pencatatan semua pergerakan barang (audit trail).
- Laporan dan dashboard operasional.

### Dalam ruang lingkup (MVP)
- Login dan manajemen user/role.
- Master data: barang, lokasi, supplier, customer.
- Inbound: PO/ASN, receiving, QC, putaway.
- Inventory: stok per lokasi, pindah lokasi, stock opname.
- Outbound: sales order, picking, packing, pengiriman.
- Penanganan barang reject/hold.
- Laporan dan export Excel.
- Scan barcode/QR lewat kamera HP.

### Di luar ruang lingkup awal
- Integrasi ERP / marketplace / kurir.
- Optimasi rute picking otomatis.
- Prediksi kebutuhan stok.
- Aplikasi native Android/iOS (cukup PWA).

---

## 2. Daftar Teknologi

### Backend
| Library | Fungsi |
|---|---|
| Node.js + Express | Server dan REST API |
| pg | Koneksi PostgreSQL |
| Knex (opsional) / Prisma (opsional) | Query builder dan migrasi |
| dotenv | Konfigurasi `.env` |
| cors | Izin akses lintas origin |
| jsonwebtoken | Token autentikasi (JWT) |
| bcrypt | Hash password |
| zod | Validasi input |
| exceljs | Export/import Excel |
| helmet | Header keamanan HTTP |
| express-rate-limit | Batasi jumlah request |
| morgan | Log request |
| nodemon | Auto-restart saat development |
| jest + supertest | Testing API |

### Database
| Tool | Fungsi |
|---|---|
| PostgreSQL | Database utama |
| DBeaver / pgAdmin | Kelola dan lihat data |

### Frontend
| Library | Fungsi |
|---|---|
| React.js (Vite) | UI |
| Tailwind CSS | Styling |
| React Router | Navigasi halaman |
| Axios | Panggil API |
| TanStack Query (opsional) | Cache dan sinkronisasi data API |
| React Hook Form + zod | Form dan validasi |
| Recharts / Chart.js | Grafik dashboard |
| html5-qrcode | Scan barcode/QR via kamera |
| JsBarcode / qrcode | Generate label barcode/QR |
| Three.js (opsional) | Visualisasi gudang 3D |
| vite-plugin-pwa (opsional) | Mode PWA |

### Tools Pendukung
| Tool | Fungsi |
|---|---|
| VS Code | Editor |
| Git + GitHub | Version control |
| Postman / Bruno | Tes API |
| Figma | Desain UI |
| dbdiagram.io | Diagram database |
| draw.io | Diagram alur |

### Hosting Gratis (saat siap demo)
| Bagian | Pilihan |
|---|---|
| Frontend | Vercel, Netlify, Cloudflare Pages |
| Backend | Render, Railway |
| Database | Supabase, Neon |

> Kuota paket gratis bisa berubah. Cek syarat terbaru sebelum dipakai.

---

## 3. Arsitektur Sistem

```
┌──────────────┐    HTTPS/JSON     ┌────────────────┐     SQL      ┌────────────┐
│ React (SPA)  │ ◄───────────────► │ Express API    │ ◄──────────► │ PostgreSQL │
│ + Tailwind   │   (JWT di header) │ (REST)         │              │            │
└──────────────┘                   └────────────────┘              └────────────┘
       │
       └── Kamera HP (html5-qrcode) untuk scan barcode
```

### Pola backend (berlapis)
```
Request → Route → Middleware (auth, validasi) → Controller → Service → Repository/Query → DB
```
- **Route**: mendaftarkan endpoint.
- **Controller**: menerima request, memanggil service, mengirim response.
- **Service**: logika bisnis (misal: hitung stok, aturan putaway).
- **Query/Repository**: akses database.

### Prinsip penting
1. **Setiap perubahan stok wajib lewat service** yang menulis ke `stock_movements`.
2. **Gunakan transaction** untuk operasi yang mengubah banyak tabel.
3. **Stok tidak boleh minus**: validasi di service dan constraint di database.
4. **Soft delete** untuk data master (kolom `is_active`), jangan hapus permanen.

---

## 4. Struktur Folder

```
wms/
├── backend/
│   ├── src/
│   │   ├── config/          # env, koneksi db
│   │   ├── db/
│   │   │   ├── migrations/  # file SQL/knex migrasi
│   │   │   └── seeds/       # data awal (admin, contoh barang)
│   │   ├── middlewares/     # auth, role, validate, errorHandler
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── items/
│   │   │   ├── locations/
│   │   │   ├── suppliers/
│   │   │   ├── customers/
│   │   │   ├── inbound/
│   │   │   ├── inventory/
│   │   │   ├── outbound/
│   │   │   ├── reports/
│   │   │   └── ...          # tiap modul: routes, controller, service, schema
│   │   ├── utils/           # helper (generate nomor dokumen, dll)
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/             # axios instance + fungsi per modul
│   │   ├── components/      # tombol, tabel, modal, scanner
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── context/         # AuthContext
│   │   ├── routes/          # protected route
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
│
├── docs/
├── .gitignore
└── README.md
```

---

## 5. Role & Hak Akses

| Role | Deskripsi | Akses utama |
|---|---|---|
| **admin** | Pengelola sistem | Semua modul, kelola user |
| **supervisor** | Pengawas gudang | Approve opname, lihat semua laporan, kelola master data |
| **operator_inbound** | Petugas penerimaan | Receiving, QC, putaway |
| **operator_outbound** | Petugas pengeluaran | Picking, packing, pengiriman |
| **viewer** | Hanya lihat | Dashboard dan laporan (read-only) |

### Matriks akses ringkas
| Modul | admin | supervisor | op. inbound | op. outbound | viewer |
|---|:-:|:-:|:-:|:-:|:-:|
| User | ✅ | ❌ | ❌ | ❌ | ❌ |
| Master data | ✅ | ✅ | 👁 | 👁 | 👁 |
| Inbound | ✅ | ✅ | ✅ | 👁 | 👁 |
| Inventory | ✅ | ✅ | 👁 | 👁 | 👁 |
| Outbound | ✅ | ✅ | 👁 | ✅ | 👁 |
| Stock opname | ✅ | ✅ | ✅ | ✅ | ❌ |
| Laporan | ✅ | ✅ | 👁 | 👁 | 👁 |

(✅ penuh · 👁 hanya lihat · ❌ tidak ada akses)

---

## 6. Modul & Fitur

### 6.1 Autentikasi & User
- Login (email/username + password), logout, refresh token.
- Ganti password.
- CRUD user dan penetapan role (admin).

### 6.2 Master Data
- **Barang (items)**: SKU, nama, kategori, satuan, dimensi, berat, minimum stok, barcode, flag batch/expired.
- **Lokasi (locations)**: zona → rak → level → bin, kapasitas, tipe (storage, receiving, staging, reject, hold).
- **Supplier** dan **Customer**.
- Import data massal dari Excel, export ke Excel.

### 6.3 Inbound
- Buat PO / ASN (Advance Shipping Notice).
- Receiving: input qty diterima per item, scan barcode.
- QC / inspeksi: lolos, hold, atau reject.
- Putaway: tempatkan barang ke lokasi (manual atau saran sistem).
- Cetak label barcode lokasi/pallet.

### 6.4 Inventory
- Stok per barang, per lokasi, per status (available, hold, rejected, reserved).
- Pindah lokasi (relokasi).
- Penyesuaian stok (adjustment) dengan alasan dan approval.
- **Stock opname / cycle count**: buat sesi hitung, input hasil, bandingkan dengan sistem, approve selisih.
- Kartu stok (riwayat mutasi per barang).
- Peringatan stok minimum dan barang mendekati expired.

### 6.5 Outbound
- Buat sales order (SO).
- Alokasi stok (reserve) otomatis berdasarkan FIFO/FEFO.
- Picking: daftar tugas picking, scan lokasi dan barang.
- Packing: verifikasi hasil picking, jumlah koli.
- Pengiriman: surat jalan, status kirim.
- **Timeline proses** per order (created → allocated → picking → packing → shipped, lengkap dengan waktu tiap tahap).

### 6.6 Barang Reject / Hold
- Alur khusus: barang reject dipindah ke lokasi reject, dicatat alasan, diproses (retur ke supplier / scrap / re-QC).

### 6.7 Laporan & Dashboard
- Dashboard: total SKU, total stok, utilisasi lokasi, order hari ini, order terlambat, throughput harian.
- Laporan: kartu stok, stok per lokasi, aging stok, mutasi harian, performa picking, akurasi opname.
- Export Excel/PDF.

### 6.8 Fitur Pendukung
- **Scan barcode/QR** via kamera HP.
- **Audit log**: siapa mengubah apa dan kapan.
- **Notifikasi** (Telegram bot) untuk stok minimum / order mendesak.
- **Visualisasi gudang 2D/3D** dengan indikator isi bin.

---

## 7. Alur Proses Bisnis

### 7.1 Inbound
```
Buat PO/ASN → Barang datang → Receiving (scan, input qty)
   → QC ──► Lolos  → Putaway ke lokasi storage → Stok "available"
        ├─► Hold   → Lokasi hold → menunggu keputusan
        └─► Reject → Lokasi reject → retur/scrap
```

### 7.2 Outbound
```
Buat SO → Alokasi stok (FIFO/FEFO) → Buat tugas picking
   → Picking (scan lokasi + barang) → Packing (verifikasi, koli)
   → Pengiriman (surat jalan) → Stok berkurang → Status "shipped"
```

### 7.3 Stock Opname
```
Buat sesi opname → Hitung fisik per lokasi → Input hasil
   → Bandingkan dengan sistem → Ada selisih? → Supervisor approve
   → Adjustment otomatis tercatat di stock_movements
```

### 7.4 Relokasi
```
Pilih barang & lokasi asal → pilih lokasi tujuan + qty
   → Validasi kapasitas → Kurangi asal, tambah tujuan (1 transaction)
   → Catat di stock_movements
```

---

## 8. Rancangan Database

### 8.1 Diagram relasi (ringkas)
```
users
items ──< stocks >── locations
items ──< inbound_items >── inbound_orders >── suppliers
items ──< outbound_items >── outbound_orders >── customers
stocks / semua perubahan ──► stock_movements
stock_opname_sessions ──< stock_opname_items
outbound_orders ──< picking_tasks
outbound_orders ──< order_timeline
audit_logs
```

### 8.2 Skema SQL (PostgreSQL)

```sql
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
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (item_id, location_id, batch_no, status)
);
CREATE INDEX idx_stocks_item ON stocks(item_id);
CREATE INDEX idx_stocks_location ON stocks(location_id);

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
  id            SERIAL PRIMARY KEY,
  outbound_id   INTEGER NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
  item_id       INTEGER NOT NULL REFERENCES items(id),
  qty_ordered   INTEGER NOT NULL CHECK (qty_ordered > 0),
  qty_allocated INTEGER NOT NULL DEFAULT 0,
  qty_picked    INTEGER NOT NULL DEFAULT 0,
  qty_packed    INTEGER NOT NULL DEFAULT 0,
  qty_shipped   INTEGER NOT NULL DEFAULT 0
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
  note          TEXT
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
```

### 8.3 Aturan database penting
- `qty >= 0` di `stocks` mencegah stok minus.
- `UNIQUE (item_id, location_id, batch_no, status)` mencegah baris stok ganda.
- Semua perubahan stok **harus** disertai baris di `stock_movements`.
- Format nomor dokumen: `PREFIX-YYYYMMDD-NNNN` (dibuat di service, reset urutan per hari).

---

## 9. Rancangan REST API

Base URL: `/api/v1` · Autentikasi: header `Authorization: Bearer <token>`

Format response sukses:
```json
{ "success": true, "data": { }, "meta": { "page": 1, "limit": 20, "total": 100 } }
```
Format response error:
```json
{ "success": false, "message": "Stok tidak mencukupi", "errors": [] }
```

### 9.1 Auth & User
| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/auth/login` | Login, mengembalikan token |
| POST | `/auth/logout` | Logout |
| GET | `/auth/me` | Profil user login |
| PUT | `/auth/change-password` | Ganti password |
| GET/POST | `/users` | List / buat user (admin) |
| PUT/DELETE | `/users/:id` | Ubah / nonaktifkan user |

### 9.2 Master Data
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | `/items` | List (search, filter, paging) / tambah |
| GET/PUT/DELETE | `/items/:id` | Detail / ubah / nonaktifkan |
| GET | `/items/barcode/:code` | Cari barang via scan |
| POST | `/items/import` | Import Excel |
| GET | `/items/export` | Export Excel |
| GET/POST | `/locations` | List / tambah lokasi |
| GET/PUT/DELETE | `/locations/:id` | Detail / ubah / nonaktifkan |
| GET | `/locations/code/:code` | Cari lokasi via scan |
| GET | `/locations/:id/stocks` | Isi lokasi |
| GET/POST/PUT | `/suppliers`, `/customers` | CRUD |

### 9.3 Inbound
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | `/inbound` | List / buat PO/ASN |
| GET/PUT | `/inbound/:id` | Detail / ubah (saat masih draft) |
| POST | `/inbound/:id/receive` | Input qty diterima |
| POST | `/inbound/:id/qc` | Hasil QC (lolos/hold/reject) |
| POST | `/inbound/:id/putaway` | Putaway ke lokasi |
| POST | `/inbound/:id/cancel` | Batalkan |
| GET | `/inbound/:id/timeline` | Riwayat proses |

### 9.4 Inventory
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/inventory/stocks` | Stok (filter item, lokasi, status) |
| GET | `/inventory/stocks/summary` | Total per barang |
| POST | `/inventory/transfer` | Pindah lokasi |
| POST | `/inventory/adjustment` | Penyesuaian stok |
| GET | `/inventory/movements` | Riwayat mutasi |
| GET | `/inventory/stock-card/:itemId` | Kartu stok |
| GET | `/inventory/low-stock` | Barang di bawah minimum |
| GET | `/inventory/expiring` | Barang mendekati expired |
| GET/POST | `/opname` | List / buat sesi opname |
| POST | `/opname/:id/count` | Input hasil hitung |
| POST | `/opname/:id/submit` | Kirim untuk review |
| POST | `/opname/:id/approve` | Approve (supervisor) |

### 9.5 Outbound
| Method | Endpoint | Keterangan |
|---|---|---|
| GET/POST | `/outbound` | List / buat SO |
| GET/PUT | `/outbound/:id` | Detail / ubah |
| POST | `/outbound/:id/allocate` | Alokasi stok (FIFO/FEFO) |
| GET | `/outbound/:id/picking-tasks` | Daftar tugas picking |
| POST | `/outbound/:id/pick` | Konfirmasi picking (scan) |
| POST | `/outbound/:id/pack` | Konfirmasi packing |
| POST | `/outbound/:id/ship` | Kirim, kurangi stok |
| POST | `/outbound/:id/cancel` | Batalkan, lepas alokasi |
| GET | `/outbound/:id/timeline` | Timeline proses |

### 9.6 Laporan & Dashboard
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/dashboard/summary` | Angka ringkas |
| GET | `/dashboard/throughput` | Grafik masuk/keluar per hari |
| GET | `/dashboard/utilization` | Utilisasi lokasi |
| GET | `/reports/stock-aging` | Aging stok |
| GET | `/reports/daily-activity` | Aktivitas harian |
| GET | `/reports/opname-accuracy` | Akurasi opname |
| GET | `/reports/:name/export` | Export Excel |

### 9.7 Contoh payload

**Login**
```json
POST /api/v1/auth/login
{ "email": "admin@wms.local", "password": "admin123" }
```

**Buat inbound**
```json
POST /api/v1/inbound
{
  "supplier_id": 1,
  "expected_at": "2026-10-10",
  "items": [
    { "item_id": 5, "qty_expected": 100 },
    { "item_id": 8, "qty_expected": 40 }
  ]
}
```

**Putaway**
```json
POST /api/v1/inbound/12/putaway
{ "item_id": 5, "location_id": 33, "qty": 60, "batch_no": "B2610" }
```

**Transfer**
```json
POST /api/v1/inventory/transfer
{ "item_id": 5, "from_location": 33, "to_location": 40, "qty": 20 }
```

---

## 10. Rancangan Halaman Frontend

| Halaman | Isi utama |
|---|---|
| Login | Form login |
| Dashboard | Kartu ringkasan, grafik throughput, daftar order terlambat, stok minimum |
| Barang | Tabel + cari + filter, form tambah/ubah, import/export Excel |
| Lokasi | Tabel lokasi, form, cetak label QR |
| Supplier / Customer | Tabel dan form |
| Inbound — list | Daftar PO/ASN, filter status |
| Inbound — detail | Item, tombol receiving/QC/putaway, timeline |
| Receiving (mobile) | Scan barang, input qty |
| Putaway (mobile) | Scan barang lalu scan lokasi tujuan |
| Stok | Stok per barang/lokasi/status |
| Kartu stok | Riwayat mutasi per barang |
| Transfer / Adjustment | Form pindah lokasi dan penyesuaian |
| Stock Opname | Sesi, input hitung, review selisih |
| Outbound — list | Daftar SO, filter status/prioritas |
| Outbound — detail | Item, alokasi, timeline tahapan |
| Picking (mobile) | Daftar tugas, scan lokasi lalu scan barang |
| Packing | Verifikasi hasil picking, jumlah koli |
| Peta Gudang | Visual 2D/3D, warna bin menurut isi/status |
| Laporan | Pilih laporan, filter tanggal, export |
| Manajemen User | Admin saja |

### Komponen reusable
- `DataTable` (paging, sort, search)
- `Modal`, `ConfirmDialog`
- `BarcodeScanner` (pakai html5-qrcode)
- `StatusBadge`
- `Timeline`
- `ProtectedRoute` (cek login dan role)
- `FormField` (terhubung React Hook Form)

---

## 11. Setup Awal (Langkah demi Langkah)

### 11.1 Prasyarat
- Node.js versi LTS, npm
- PostgreSQL terpasang (atau Docker)
- Git

### 11.2 Database
```bash
# masuk psql
psql -U postgres
CREATE DATABASE wms_db;
```
Jalankan skema SQL pada bagian 8.2 ke `wms_db`.

### 11.3 Backend
```bash
mkdir wms && cd wms
mkdir backend && cd backend
npm init -y
npm i express pg dotenv cors jsonwebtoken bcrypt zod exceljs helmet express-rate-limit morgan
npm i -D nodemon jest supertest
```

`package.json` (bagian scripts):
```json
"scripts": {
  "dev": "nodemon src/server.js",
  "start": "node src/server.js",
  "test": "jest"
}
```

`.env.example`
```
PORT=4000
DATABASE_URL=postgres://postgres:password@localhost:5432/wms_db
JWT_SECRET=ganti_dengan_string_acak_panjang
JWT_EXPIRES_IN=8h
CORS_ORIGIN=http://localhost:5173
```

`src/config/db.js`
```js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
```

`src/app.js`
```js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/v1/health', (req, res) => res.json({ success: true, data: 'ok' }));

// app.use('/api/v1/auth', require('./modules/auth/auth.routes'));
// app.use('/api/v1/items', require('./modules/items/items.routes'));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ success: false, message: err.message });
});

module.exports = app;
```

`src/server.js`
```js
require('dotenv').config();
const app = require('./app');

app.listen(process.env.PORT || 4000, () =>
  console.log(`API jalan di port ${process.env.PORT || 4000}`)
);
```

### 11.4 Contoh pola transaction (pindah stok)
```js
const pool = require('../../config/db');

async function transferStock({ itemId, fromLoc, toLoc, qty, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const dec = await client.query(
      `UPDATE stocks SET qty = qty - $1, updated_at = NOW()
       WHERE item_id = $2 AND location_id = $3 AND status = 'available' AND qty >= $1
       RETURNING id`,
      [qty, itemId, fromLoc]
    );
    if (dec.rowCount === 0) throw Object.assign(new Error('Stok tidak mencukupi'), { status: 400 });

    await client.query(
      `INSERT INTO stocks (item_id, location_id, status, qty)
       VALUES ($1, $2, 'available', $3)
       ON CONFLICT (item_id, location_id, batch_no, status)
       DO UPDATE SET qty = stocks.qty + EXCLUDED.qty, updated_at = NOW()`,
      [itemId, toLoc, qty]
    );

    await client.query(
      `INSERT INTO stock_movements (item_id, from_location, to_location, qty, type, user_id)
       VALUES ($1, $2, $3, $4, 'transfer', $5)`,
      [itemId, fromLoc, toLoc, qty, userId]
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { transferStock };
```
> Catatan: karena `batch_no` bisa `NULL`, constraint UNIQUE pada PostgreSQL tidak menganggap dua `NULL` sama. Solusi: pakai `COALESCE(batch_no, '')` lewat unique index, atau isi batch default `'-'`.

### 11.5 Middleware auth & role
```js
const jwt = require('jsonwebtoken');

exports.auth = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token tidak valid' });
  }
};

exports.allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role)
    ? next()
    : res.status(403).json({ success: false, message: 'Akses ditolak' });
```

### 11.6 Frontend
```bash
cd ..
npm create vite@latest frontend -- --template react
cd frontend
npm i
npm i axios react-router-dom recharts html5-qrcode jsbarcode qrcode react-hook-form zod @tanstack/react-query
npm i -D tailwindcss @tailwindcss/vite
```

`vite.config.js`
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
```

`src/index.css`
```css
@import "tailwindcss";
```

`src/api/client.js`
```js
import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
```

`.env`
```
VITE_API_URL=http://localhost:4000/api/v1
```

### 11.7 Komponen scanner (contoh)
```jsx
import { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 }, false);
    scanner.render((text) => { onScan(text); scanner.clear(); }, () => {});
    return () => scanner.clear().catch(() => {});
  }, [onScan]);

  return <div id="reader" />;
}
```
> Akses kamera di browser membutuhkan **HTTPS** (kecuali `localhost`).

### 11.8 Seed data awal
Buat user admin dengan password ter-hash (bcrypt), contoh lokasi (zona A–C), dan beberapa barang contoh agar mudah dites.

---

## 12. Keamanan

- Hash password dengan **bcrypt** (minimal 10 salt rounds).
- JWT dengan masa berlaku pendek; simpan secret di `.env`.
- Validasi **semua input** dengan zod di backend.
- Gunakan **parameterized query** (`$1, $2`), jangan menyambung string SQL.
- Pasang **helmet** dan **rate limit**, terutama di endpoint login.
- Batasi CORS ke domain frontend saja.
- Cek **role** di backend untuk setiap endpoint, jangan hanya menyembunyikan menu di frontend.
- Jangan commit `.env`; sediakan `.env.example`.
- Catat aksi penting di `audit_logs`.
- Backup database berkala (`pg_dump`).

---

## 13. Testing

### Jenis tes
| Jenis | Tools | Contoh |
|---|---|---|
| Unit | Jest | Fungsi alokasi FIFO, generator nomor dokumen |
| Integrasi API | Jest + Supertest | Alur login lalu buat inbound lalu putaway |
| Manual | Postman/Bruno | Koleksi request per modul |
| UI | Manual / Playwright (opsional) | Alur scan di HP |

### Skenario uji penting
1. Transfer stok melebihi qty → harus ditolak.
2. Dua user mengambil stok yang sama bersamaan → tidak boleh minus (cek concurrency).
3. Receiving melebihi qty PO → peringatan/ditolak sesuai aturan.
4. Cancel outbound → alokasi terlepas, stok kembali available.
5. Opname dengan selisih → adjustment tercatat di `stock_movements`.
6. Role `viewer` mengakses endpoint tulis → 403.
7. FEFO: barang dengan expiry terdekat diambil lebih dulu.
8. Putaway ke lokasi melebihi kapasitas → ditolak.

---

## 14. Deployment Gratis

### Opsi A — Lokal (paling aman, tanpa batas)
- Jalankan PostgreSQL + backend + frontend di laptop/server kantor.
- Bisa pakai Docker Compose agar mudah dipindah.

### Opsi B — Cloud gratis
1. **Database**: buat project di Supabase atau Neon, salin `DATABASE_URL`, jalankan skema SQL.
2. **Backend**: deploy ke Render (web service Node), isi environment variable (`DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`).
3. **Frontend**: deploy ke Vercel/Netlify, set `VITE_API_URL` ke URL backend.
4. Pastikan `CORS_ORIGIN` backend = URL frontend.

### Catatan
- Layanan gratis kadang "tidur" saat tidak dipakai, request pertama bisa lambat.
- Ada batas ukuran database dan jam aktif; pantau pemakaian.
- Untuk demo/portofolio, opsi B sudah cukup.

### Contoh `docker-compose.yml` (lokal)
```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: wms_db
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]
volumes:
  pgdata:
```

---

## 15. Roadmap Pengerjaan

| Fase | Target | Isi |
|---|---|---|
| **0** | Persiapan | Install tools, buat repo, rancang tabel, setup project backend & frontend |
| **1** | Fondasi | Login JWT, role, layout dasar, CRUD user |
| **2** | Master data | CRUD items, locations, suppliers, customers; import/export Excel |
| **3** | Inbound | PO/ASN, receiving, QC, putaway, timeline |
| **4** | Inventory | Stok per lokasi, transfer, adjustment, kartu stok |
| **5** | Outbound | SO, alokasi FIFO/FEFO, picking, packing, shipping, timeline |
| **6** | Scan & mobile | Scanner barcode, halaman mobile, PWA, cetak label |
| **7** | Opname & reject | Stock opname, alur hold/reject |
| **8** | Laporan | Dashboard, laporan, export Excel/PDF |
| **9** | Penyempurnaan | Audit log, notifikasi Telegram, peta gudang 2D/3D |
| **10** | Rilis | Testing menyeluruh, perbaikan bug, deployment, dokumentasi |

Saran: selesaikan satu fase penuh (backend + frontend + tes) sebelum lanjut ke fase berikutnya.

---

## 16. Ide Pengembangan Lanjutan

- **Putaway cerdas**: saran lokasi berdasarkan ukuran barang, sisa kapasitas, dan perputaran barang.
- **Rute picking tercepat** dan batch/wave picking.
- **Notifikasi Telegram**: stok minimum, order mendesak, selisih opname.
- **Integrasi** marketplace, ERP, atau kurir melalui API.
- **Prediksi stok** berdasarkan histori keluar-masuk.
- **Multi-gudang** dan multi-perusahaan.
- **Serial number tracking** untuk barang bernilai tinggi.
- **Kitting / bundling**.
- **Retur pelanggan** (reverse logistics).
- **Dashboard real-time** dengan WebSocket (socket.io).
- **Mode offline** untuk scanner (PWA + sinkronisasi).

---

## 17. Checklist Akhir

### Teknis
- [ ] Semua perubahan stok memakai transaction
- [ ] Semua perubahan stok tercatat di `stock_movements`
- [ ] Validasi input di semua endpoint
- [ ] Role dicek di backend
- [ ] `.env` tidak masuk Git
- [ ] Index database untuk kolom yang sering dicari
- [ ] Pagination di semua daftar data
- [ ] Error handling seragam

### Fungsional
- [ ] Alur inbound lengkap (receiving → QC → putaway)
- [ ] Alur outbound lengkap (alokasi → picking → packing → kirim)
- [ ] Stock opname dan adjustment
- [ ] Penanganan reject/hold
- [ ] Scan barcode berfungsi di HP
- [ ] Export Excel berfungsi
- [ ] Dashboard dan laporan menampilkan data benar

### Rilis
- [ ] Data seed / akun admin awal
- [ ] Dokumentasi README (cara install dan menjalankan)
- [ ] Backup database terjadwal
- [ ] Sudah dites dengan data mendekati kondisi nyata

---

*Dokumen ini adalah titik awal. Sesuaikan modul, tabel, dan alur dengan kebutuhan gudang yang sebenarnya.*
