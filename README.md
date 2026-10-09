# SISGUD — Sistem Manajemen Gudang

Aplikasi manajemen gudang (Warehouse Management System) dibangun dengan **semua tools gratis**:

- **Backend:** Node.js + Express + PostgreSQL (`pg`)
- **Frontend:** React.js (Vite) + Tailwind CSS

---

## Prasyarat

- Node.js LTS (≥ 18) dan npm
- PostgreSQL 15+ (atau Docker)
- Git

## Quick Start (Docker untuk database)

```bash
# 1. Jalankan PostgreSQL di Docker
docker compose up -d db

# 2. Setup backend
cd backend
npm install
copy .env.example .env     # Windows: copy .env.example .env
npm run migrate            # jalankan skema SQL
npm run seed               # data awal (admin: admin@wms.local / admin123)
npm run dev                # API di http://localhost:4000

# 3. Setup frontend (terminal lain)
cd frontend
npm install
copy .env.example .env
npm run dev                # UI di http://localhost:5173
```

> Di Windows PowerShell gunakan `copy .env.example .env`. Di Linux/macOS gunakan `cp`.

## Akun awal (hasil seed)

| Email | Password | Role |
|---|---|---|
| admin@wms.local | admin123 | admin |
| supervisor@wms.local | supervisor123 | supervisor |
| inbound@wms.local | inbound123 | operator_inbound |
| outbound@wms.local | outbound123 | operator_outbound |
| viewer@wms.local | viewer123 | viewer |

## Struktur Proyek

```
wms/
├── backend/          # Express API (REST, JWT)
│   ├── src/
│   │   ├── config/       # env & koneksi db
│   │   ├── db/           # migrasi & seed
│   │   ├── middlewares/  # auth, role, validasi, error
│   │   ├── modules/      # auth, users, items, locations, suppliers,
│   │   │                 # customers, inbound, inventory, opname,
│   │   │                 # outbound, dashboard, reports
│   │   ├── utils/        # nomor dokumen, pagination, response
│   │   ├── app.js
│   │   └── server.js
│   └── tests/            # jest + supertest
├── frontend/         # React SPA (Vite + Tailwind v4)
├── docker-compose.yml
└── WMS-Blueprint.md
```

## Perintah Umum

```bash
# backend
npm run dev        # nodemon
npm test           # jest + supertest (butuh database uji)
npm run migrate    # terapkan src/db/migrations/*.sql
npm run seed       # data awal

# frontend
npm run dev        # vite dev server
npm run build      # build produksi
```

## Konsep Penting (dari blueprint)

1. **Setiap perubahan stok wajib lewat service** yang menulis ke `stock_movements`.
2. **Transaction** untuk operasi yang mengubah banyak tabel.
3. **Stok tidak boleh minus** — divalidasi di service dan constraint di DB.
4. **Soft delete** untuk data master (kolom `is_active`).
5. Nomor dokumen format `PREFIX-YYYYMMDD-NNNN` (reset per hari).
6. Role selalu dicek di **backend** (`middlewares/auth.js`), bukan hanya disembunyikan di frontend.

## Deployment

Lihat bagian 14 blueprint: lokal (Docker Compose) atau cloud gratis (Supabase/Neon + Render + Vercel/Netlify).
