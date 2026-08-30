# Retail POS

Aplikasi Point of Sale (POS) web untuk toko retail kecil-menengah (minimarket/kafe): manajemen
produk & stok, transaksi kasir dengan diskon/pajak/pembayaran, struk print-friendly, riwayat &
laporan penjualan, serta notifikasi stok rendah untuk admin.

**Demo live**: https://retail-pos-demo.web.app (login: `admin`/`admin123` atau `kasir`/`kasir123`)
— lihat [Deployment](#deployment-live-demo) untuk detail & catatannya.

## Tech stack

- **Backend**: Node.js + Express + TypeScript, [`node:sqlite`](https://nodejs.org/api/sqlite.html)
  (modul SQLite bawaan Node 22+, jadi **tidak ada dependency native yang perlu dikompilasi** —
  cukup `npm install`), JWT (`jsonwebtoken`) + `bcryptjs` untuk autentikasi, `zod` untuk validasi.
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS.
- **Testing**: Vitest, unit test untuk logic penting (perhitungan total/diskon/pajak, kembalian,
  validasi & pengurangan stok) di `backend/tests/`.
- **Penyimpanan data**: file SQLite lokal (`backend/data.db`), dibuat otomatis dari
  `backend/src/db/schema.sql` saat backend pertama kali dijalankan. Tidak terhubung ke
  infrastruktur eksternal apa pun — semua data ada di file lokal ini.

## Prasyarat

- Node.js **22 atau lebih baru** (dibutuhkan untuk modul `node:sqlite`).
- npm.

## Setup & menjalankan (development)

```bash
# 1. Install semua dependency (backend + frontend)
npm run install:all

# 2. Seed data demo (buat ulang skema + isi user & produk contoh)
npm run seed

# 3. Jalankan backend (port 4000) dan frontend (port 5173) di dua terminal terpisah
npm run dev:backend
npm run dev:frontend
```

Buka `http://localhost:5173` di browser. Frontend (Vite dev server) mem-proxy semua request
`/api/*` ke backend di port 4000 — lihat `frontend/vite.config.ts`.

### Kredensial demo (dibuat oleh `npm run seed`)

| Username | Password   | Role  |
|----------|-----------|-------|
| `admin`  | `admin123` | admin |
| `kasir`  | `kasir123` | kasir |

- **Admin**: akses penuh — kelola produk & stok, lihat laporan & notifikasi stok rendah, plus
  bisa bertransaksi seperti kasir.
- **Kasir**: hanya bisa membuat transaksi baru dan melihat riwayat transaksi **miliknya sendiri**
  (dijamin di backend, bukan cuma disembunyikan di UI — lihat `backend/src/routes/transactions.ts`).

## Seed & reset data

Data disimpan di `backend/data.db` (SQLite, di-gitignore). Untuk reset ke kondisi awal (hapus
semua transaksi, kembalikan produk & user demo):

```bash
npm run seed
```

Script ini (`backend/src/db/seed.ts`) menjalankan ulang `schema.sql` (`DROP TABLE IF EXISTS` lalu
`CREATE TABLE`) dan mengisi ulang: 2 user demo (admin & kasir) dan 7 produk contoh — salah
satunya (`SKU-007`, Mie Instan Goreng) sengaja diberi stok rendah (3, di bawah ambang batas 5)
untuk mendemokan notifikasi stok rendah.

Untuk memakai lokasi file database lain, set env var `DB_PATH` sebelum menjalankan backend/seed
(misalnya `DB_PATH=./data-lain.db npm run seed`).

## Menjalankan test

```bash
npm test
```

Menjalankan 18 unit test (Vitest) untuk logic pricing (`backend/tests/pricing.test.ts`: subtotal,
diskon per item, pajak, kembalian) dan stock (`backend/tests/stock.test.ts`: validasi ketersediaan
stok, pengurangan stok, deteksi stok rendah).

## Build production

```bash
npm run build
```

Meng-compile backend (`backend/dist/`, jalankan dengan `node dist/server.js`) dan build frontend
statis (`frontend/dist/`, sajikan dengan static file server atau reverse proxy apa pun ke backend
di path `/api`).

## Deployment (live demo)

Project ini otomatis di-deploy ke Firebase (Hosting + Cloud Functions) supaya bisa langsung
dicoba tanpa setup lokal: **https://retail-pos-demo.web.app**

- **Frontend** (`frontend/dist`) di-serve dari Firebase Hosting site `retail-pos-demo`.
- **Backend** dibungkus jadi satu Cloud Function 2nd-gen (`functions/`, region
  `asia-southeast2`) yang meng-import langsung `backend/src` (di-mirror otomatis ke
  `functions/src/backend` oleh `functions/scripts/copy-backend.js` saat build — `backend/`
  tetap satu-satunya sumber kode, bukan salinan yang diedit manual). Firebase Hosting me-rewrite
  `/api/**` ke function ini, jadi frontend tetap memanggil `/api/...` origin yang sama seperti di
  dev (tidak ada masalah CORS).
- **Database**: karena Cloud Functions tidak punya disk permanen, `DB_PATH` diarahkan ke direktori
  temp instance (`functions/src/index.ts`) dan data di-seed ulang otomatis di setiap cold start.
  **Konsekuensi: data demo di versi live ini reset setiap kali instance-nya cold-start** (biasanya
  setelah idle beberapa menit) — cocok untuk coba-coba/demo, tapi jangan dipakai untuk data yang
  perlu awet. Untuk data yang persist, jalankan lokal (lihat bagian Setup di atas).
- Project Firebase yang dipakai (`ai-app-builder-7bf8e`) sama dengan dashboard AI App Builder,
  tapi terisolasi lewat Hosting site & Cloud Functions codebase (`retailpos`) sendiri — tidak
  berbagi data/kode dengan project lain di situ.

Untuk re-deploy setelah ada perubahan:

```bash
npm run build                              # build backend, frontend
npx firebase-tools deploy --only hosting,functions
```

## Variabel lingkungan (backend, opsional)

| Variabel     | Default                          | Keterangan                                   |
|--------------|-----------------------------------|-----------------------------------------------|
| `PORT`       | `4000`                            | Port HTTP backend.                            |
| `DB_PATH`    | `backend/data.db`                 | Lokasi file SQLite.                           |
| `JWT_SECRET` | nilai dev bawaan (lihat kode)      | **Wajib diganti** kalau dideploy sungguhan.   |

Untuk deploy Firebase, `JWT_SECRET` di-set lewat `functions/.env` (di-gitignore; salin dari
`functions/.env.example` dan isi string acak sendiri) — dibaca otomatis oleh Cloud Functions saat
cold start.

## Fitur

1. **Autentikasi & peran** — login JWT, role `admin`/`kasir` dengan hak akses berbeda (route
   frontend dan endpoint backend sama-sama menegakkan pembatasan ini).
2. **Manajemen produk** (admin) — CRUD produk: SKU, nama, kategori, harga, stok, deskripsi, dan
   ambang batas stok rendah per produk.
3. **Transaksi penjualan** (kasir) — keranjang multi-item, pencarian produk cepat, diskon per
   item, pajak per nota, metode pembayaran tunai/kartu/QRIS (simulasi), hitung kembalian
   otomatis untuk tunai, stok berkurang otomatis & atomik saat transaksi disimpan.
4. **Struk** — ditampilkan setelah transaksi selesai, layout print-friendly (tombol "Cetak"
   memakai CSS khusus print).
5. **Riwayat & laporan** — riwayat transaksi dengan filter tanggal (kasir hanya melihat
   transaksinya sendiri, admin melihat semua), laporan penjualan harian & bulanan (grafik batang
   sederhana), produk terlaris, total pendapatan.
6. **Notifikasi stok rendah** — ikon lonceng di header untuk admin, menampilkan jumlah & daftar
   produk yang stoknya di bawah ambang batas (polling tiap 30 detik).
7. **Kualitas kode** — struktur rapi (routes/lib/middleware terpisah), business logic penting
   (perhitungan harga, diskon, pajak, kembalian, validasi & pengurangan stok) sebagai fungsi
   murni dengan unit test.

## Catatan

- `npm audit` mungkin melaporkan advisory moderat/tinggi pada `esbuild` (transitif lewat
  `vite`/`vitest`, dev-only). Ini terkait dev server, bukan kode yang di-ship ke production, dan
  sengaja tidak di-force-fix karena akan menaikkan versi `vite`/`vitest` secara breaking.
- Metode pembayaran kartu/QRIS adalah **simulasi** (tidak terhubung ke payment gateway
  sungguhan), sesuai kebutuhan demo.
