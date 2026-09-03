# Retail POS

Aplikasi Point of Sale (POS) web gratis untuk toko retail kecil-menengah (minimarket/kafe):
manajemen produk & stok, transaksi kasir dengan diskon/pajak/pembayaran/tahan-transaksi/scan
barcode, pembatalan transaksi, struk print-friendly dengan branding toko sendiri, riwayat &
laporan penjualan, notifikasi stok rendah untuk admin, dan ruang iklan Google AdSense opsional
supaya operatornya bisa menutup biaya hosting.

**Demo live**: https://retail-pos-demo.web.app (login: `admin`/`admin123` atau `kasir`/`kasir123`)
— lihat [Deployment](#deployment-live-demo) untuk detail & catatannya. Data di versi live ini
**persisten** (lihat bagian Deployment) — coba-coba di sana aman, tidak akan hilang.

## Tech stack

- **Backend**: Node.js + Express + TypeScript, [`node:sqlite`](https://nodejs.org/api/sqlite.html)
  (modul SQLite bawaan Node 22+, jadi **tidak ada dependency native yang perlu dikompilasi** —
  cukup `npm install`), JWT (`jsonwebtoken`) + `bcryptjs` untuk autentikasi, `zod` untuk validasi.
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS.
- **Testing**: Vitest, unit test untuk logic penting (perhitungan total/diskon/pajak, kembalian,
  validasi & pengurangan stok, hook sinkronisasi database) di `backend/tests/`.
- **Penyimpanan data**: file SQLite lokal (`backend/data.db`), dibuat otomatis dari
  `backend/src/db/schema.sql` saat backend pertama kali dijalankan. Berjalan lokal, tidak
  terhubung ke infrastruktur eksternal apa pun. Saat dideploy ke Cloud Functions (lihat
  [Deployment](#deployment-live-demo)), file yang sama otomatis disinkronkan ke Firebase Storage
  supaya tetap persisten walau instance-nya stateless.

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
  temp instance (`functions/src/index.ts`), TAPI setiap cold start sekarang me-restore file SQLite
  itu dari Firebase Storage (bucket proyek `ai-app-builder-7bf8e`, prefix `retail-pos-db/`,
  terisolasi dari data project lain di bucket yang sama) sebelum backend-nya jalan, dan setiap
  tulis (produk, transaksi, pembatalan, transaksi tertahan, pengaturan toko) memicu upload ulang
  file itu ke Storage (lihat `backend/src/db/persistenceHook.ts` + pemanggilnya di setiap route,
  dan `functions/src/index.ts` untuk mekanisme download/upload-nya). **Jadi data live tidak lagi
  hilang saat cold start** — instance pertama yang pernah jalan akan men-seed data demo awal lalu
  langsung mem-persist-kannya; instance berikutnya melanjutkan dari situ. Kalau memang perlu
  mereset ke kondisi awal, hapus object `retail-pos-db/data.db` di bucket itu secara manual (lewat
  Firebase Console atau `gsutil`/Admin SDK) — cold start berikutnya akan men-seed ulang dari nol.
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
3. **Transaksi penjualan** (kasir) — keranjang multi-item, pencarian produk cepat, **scan
   barcode** (SKU dipakai sebagai barcode — cukup fokus di halaman kasir lalu scan, alat scanner
   USB/Bluetooth terdeteksi otomatis lewat pola ketikan cepatnya, lihat
   `frontend/src/hooks/useBarcodeScanner.ts`), diskon per item, pajak per nota, metode pembayaran
   tunai/kartu/QRIS (simulasi), hitung kembalian otomatis untuk tunai, stok berkurang otomatis &
   atomik saat transaksi disimpan.
4. **Tahan transaksi** — kasir bisa menahan (park) keranjang yang sedang diisi dengan label bebas
   (mis. nomor meja), lalu melanjutkannya nanti dari tombol "Tertahan"; berguna kalau pelanggan
   belum siap bayar atau kasir perlu melayani orang lain dulu.
5. **Pembatalan transaksi (void)** (admin) — membatalkan transaksi yang sudah selesai
   mengembalikan stoknya secara otomatis dan menandai transaksi itu `voided` (bukan dihapus, agar
   jejak auditnya tetap ada); transaksi yang dibatalkan otomatis tidak dihitung di laporan
   pendapatan/produk terlaris. Konfirmasi dua-klik di UI untuk mencegah klik tidak sengaja.
6. **Struk** — ditampilkan setelah transaksi selesai, layout print-friendly (tombol "Cetak"
   memakai CSS khusus print), pakai nama toko & catatan kaki sesuai [Pengaturan](#pengaturan-toko).
7. **Riwayat & laporan** — riwayat transaksi dengan filter tanggal dan status (kasir hanya melihat
   transaksinya sendiri, admin melihat semua), laporan penjualan harian & bulanan (grafik batang
   sederhana), produk terlaris, total pendapatan.
8. **Notifikasi stok rendah** — ikon lonceng di header untuk admin, menampilkan jumlah & daftar
   produk yang stoknya di bawah ambang batas (polling tiap 30 detik).
9. **Pengaturan toko** (admin, halaman "Pengaturan") — nama/alamat/telepon toko dan catatan kaki
   struk (dipakai di header aplikasi & struk cetak), plus konfigurasi Google AdSense (lihat di
   bawah). Tersimpan di database, bukan file konfigurasi — jadi bisa diubah kapan saja tanpa
   redeploy.
10. **Ruang iklan Google AdSense** (opsional) — tiga slot siap pakai (footer semua halaman,
    halaman login, halaman laporan) lewat komponen `frontend/src/components/AdSlot.tsx`. Kosong
    secara default (tampil sebagai placeholder "Ruang iklan" yang jujur, bukan iklan palsu) sampai
    diisi Client ID + Slot ID dari akun AdSense-mu sendiri di halaman Pengaturan — lihat
    [Mengaktifkan iklan](#mengaktifkan-iklan-adsense).
11. **Kualitas kode** — struktur rapi (routes/lib/middleware terpisah), business logic penting
    (perhitungan harga, diskon, pajak, kembalian, validasi & pengurangan stok) sebagai fungsi
    murni dengan unit test.

## Mengaktifkan iklan AdSense

Aplikasi ini menyediakan tiga ruang iklan tapi tidak mendaftarkan situs ke AdSense untukmu — itu
harus dilakukan sendiri lewat akun Google AdSense-mu:

1. Daftar/masuk ke [Google AdSense](https://www.google.com/adsense/) dan tambahkan domain tempat
   aplikasi ini dideploy sebagai situsmu, tunggu sampai disetujui.
2. Buat unit iklan (mis. "Retail POS Footer", "Retail POS Login", "Retail POS Laporan") dan catat
   Client ID (`ca-pub-...`) serta Slot ID masing-masing.
3. Login sebagai admin di aplikasi ini → menu **Pengaturan** → isi Client ID dan Slot ID yang
   sesuai untuk tiap ruang iklan → **Simpan pengaturan**. Iklan sungguhan akan mulai tampil begitu
   AdSense selesai memverifikasi unit iklannya (bisa perlu beberapa jam).

## Catatan

- `npm audit` mungkin melaporkan advisory moderat/tinggi pada `esbuild` (transitif lewat
  `vite`/`vitest`, dev-only). Ini terkait dev server, bukan kode yang di-ship ke production, dan
  sengaja tidak di-force-fix karena akan menaikkan versi `vite`/`vitest` secara breaking.
- Metode pembayaran kartu/QRIS adalah **simulasi** (tidak terhubung ke payment gateway
  sungguhan), sesuai kebutuhan demo.
