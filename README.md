# Retail POS

Aplikasi Point of Sale (POS) web gratis dan **multi-toko** untuk retail kecil-menengah
(minimarket/kafe): manajemen produk & stok, transaksi kasir dengan
diskon/pajak/pembayaran/tahan-transaksi/scan barcode, pembatalan transaksi, struk print-friendly
dengan branding toko sendiri, riwayat & laporan penjualan, notifikasi stok rendah, manajemen kasir
dengan izin akses granular, tutorial bawaan, dan ruang iklan Google AdSense opsional supaya
operatornya bisa menutup biaya hosting.

Setiap pemilik toko masuk dengan **akun Google-nya sendiri** — login pertama otomatis membuatkan
toko baru yang sepenuhnya terisolasi dari toko lain di aplikasi ini (lihat
[Multi-toko](#multi-toko--login) untuk detail arsitekturnya).

**Demo live**: https://retail-pos-demo.web.app — lihat [Deployment](#deployment-live-demo) untuk
detail & catatannya. Data di versi live ini **persisten** (lihat bagian Deployment) — coba-coba di
sana aman, tidak akan hilang.

## Tech stack

- **Backend**: Node.js + Express + TypeScript, [`node:sqlite`](https://nodejs.org/api/sqlite.html)
  (modul SQLite bawaan Node 22+, jadi **tidak ada dependency native yang perlu dikompilasi** —
  cukup `npm install`), JWT (`jsonwebtoken`) + `bcryptjs` untuk sesi & password kasir,
  `firebase-admin` untuk memverifikasi ID token Google saat pemilik toko masuk, `zod` untuk
  validasi.
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS, `firebase` (client SDK, hanya dipakai
  untuk tombol "Masuk dengan Google" di halaman login).
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
| `admin`  | `admin123` | admin (pemilik toko demo) |
| `kasir`  | `kasir123` | kasir |

Keduanya milik satu "Toko Demo" bawaan (`store_id=1`) yang selalu ada — cara tercepat untuk
mencoba aplikasi tanpa akun Google. Lihat [Multi-toko](#multi-toko--login) untuk cara toko
sungguhan bekerja.

## Multi-toko & login

Aplikasi ini multi-tenant: setiap baris di `products`, `transactions`, `held_carts`, dll. punya
`store_id`, dan **setiap query di tiap route di-scope oleh `store_id` milik user yang sedang
login** (lihat `req.user!.storeId` di `backend/src/routes/*.ts`) — satu toko tidak bisa membaca,
menjual, atau membatalkan produk/transaksi milik toko lain, walau menebak ID-nya secara langsung
(sudah diverifikasi end-to-end, termasuk lewat percobaan cross-tenant manual).

- **Pemilik toko** masuk dengan tombol "Masuk dengan Google" di halaman login
  (`signInWithPopup` dari Firebase Auth — providernya sudah aktif di project Firebase ini, tidak
  perlu setup OAuth manual tambahan). ID token dari Google diverifikasi di backend
  (`backend/src/lib/googleAuth.ts`, lewat `firebase-admin`) lalu ditukar dengan JWT sesi milik
  aplikasi ini sendiri — dari titik itu, autentikasi berjalan persis seperti login kasir biasa
  (bearer token, bukan sesi Firebase). **Login Google pertama kali otomatis membuat toko baru yang
  kosong** (`backend/src/db/stores.ts`'s `createStore`) — bukan toko dengan data demo — dan
  langsung menjadikan akun itu admin/pemilik toko tersebut. Login berikutnya dengan akun Google
  yang sama masuk ke toko yang sama (dicocokkan lewat `google_uid`, bukan email).
- **Kasir** dibuat oleh pemiliknya sendiri lewat menu **Kelola Kasir** (username & password bebas
  pilih pemilik, bukan akun Google) — lihat bagian Fitur di bawah untuk izin akses granular yang
  bisa diatur per kasir.
- `users.username` unik secara global (lintas-toko), bukan cuma per-toko — pilihan sengaja supaya
  login kasir tetap cukup dengan username/password tanpa perlu tahu/memilih "toko yang mana"
  duluan.

**Test isolasi multi-tenant secara manual** (dari root repo, backend jalan di `:4000`):

```bash
# Terminal terpisah, langsung lewat REST API tanpa perlu Google OAuth sungguhan
curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

lalu coba akses `productId`/`transactionId` dari toko lain dengan token toko ini — semua akan
mengembalikan 404 "tidak ditemukan", bukan data toko lain.

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

| Variabel               | Default                     | Keterangan                                                    |
|-------------------------|------------------------------|-----------------------------------------------------------------|
| `PORT`                 | `4000`                      | Port HTTP backend.                                              |
| `DB_PATH`              | `backend/data.db`           | Lokasi file SQLite.                                              |
| `JWT_SECRET`           | nilai dev bawaan (lihat kode) | **Wajib diganti** kalau dideploy sungguhan.                    |
| `ADSENSE_CLIENT_ID`    | kosong                      | Lihat [Mengaktifkan iklan](#mengaktifkan-iklan-adsense) — platform-wide, bukan per-toko. |
| `ADSENSE_SLOT_FOOTER`  | kosong                      | Slot ID iklan footer.                                            |
| `ADSENSE_SLOT_REPORTS` | kosong                      | Slot ID iklan halaman laporan.                                   |

Untuk deploy Firebase, semua ini di-set lewat `functions/.env` (di-gitignore; salin dari
`functions/.env.example` dan isi nilainya sendiri) — dibaca otomatis oleh Cloud Functions saat
cold start.

## Fitur

1. **Multi-toko & autentikasi** — pemilik toko masuk dengan akun Google (lihat
   [Multi-toko](#multi-toko--login)), kasir dengan username/password yang dibuatkan pemiliknya;
   role `admin`/`kasir` plus empat izin akses granular untuk kasir (lihat poin 9) menegakkan
   pembatasan di frontend maupun backend.
2. **Manajemen produk** — CRUD produk: SKU, nama, kategori, harga, stok, deskripsi, dan
   ambang batas stok rendah per produk. Admin selalu bisa; kasir bisa kalau diberi izin
   "Kelola produk".
3. **Transaksi penjualan** (kasir) — keranjang multi-item, pencarian produk cepat, **scan
   barcode** (SKU dipakai sebagai barcode — cukup fokus di halaman kasir lalu scan, alat scanner
   USB/Bluetooth terdeteksi otomatis lewat pola ketikan cepatnya, lihat
   `frontend/src/hooks/useBarcodeScanner.ts`), stepper +/- untuk ubah qty per baris (lebih cepat
   dari mengetik di layar sentuh), diskon per item, pajak per nota (terisi otomatis dari
   [tarif pajak default](#pengaturan-toko), masih bisa diubah manual), metode pembayaran
   tunai/kartu/QRIS (simulasi) dengan **tombol cepat pecahan uang tunai** (mis. "+50rb", "Uang
   pas") supaya kasir tidak perlu mengetik nominal manual, hitung kembalian otomatis, tombol
   "Kosongkan" (konfirmasi dua-klik) untuk membatalkan seluruh keranjang, stok berkurang otomatis &
   atomik saat transaksi disimpan.
4. **Tahan transaksi** — kasir bisa menahan (park) keranjang yang sedang diisi dengan label bebas
   (mis. nomor meja), lalu melanjutkannya nanti dari tombol "Tertahan"; berguna kalau pelanggan
   belum siap bayar atau kasir perlu melayani orang lain dulu.
5. **Pembatalan transaksi (void)** — membatalkan transaksi yang sudah selesai mengembalikan
   stoknya secara otomatis dan menandai transaksi itu `voided` (bukan dihapus, agar jejak
   auditnya tetap ada); transaksi yang dibatalkan otomatis tidak dihitung di laporan
   pendapatan/produk terlaris. Konfirmasi dua-klik di UI untuk mencegah klik tidak sengaja. Admin
   selalu bisa; kasir bisa kalau diberi izin "Batalkan transaksi".
6. **Struk** — ditampilkan setelah transaksi selesai, layout print-friendly (tombol "Cetak"
   memakai CSS khusus print), pakai nama toko, alamat, telepon, catatan kaki, dan
   [logo usaha](#pengaturan-toko) (kalau sudah diunggah di perangkat itu) sesuai
   [Pengaturan](#pengaturan-toko).
7. **Riwayat & laporan** — riwayat transaksi dengan filter tanggal dan status (kasir hanya melihat
   transaksinya sendiri kecuali diberi izin "Lihat semua transaksi"), laporan penjualan harian &
   bulanan (grafik batang sederhana), produk terlaris, total pendapatan — laporan sendiri butuh
   izin "Lihat laporan" untuk kasir (admin selalu bisa).
8. **Notifikasi stok rendah** — ikon lonceng di header, menampilkan jumlah & daftar produk yang
   stoknya di bawah ambang batas (polling tiap 30 detik) — terbuka untuk semua role, bukan cuma
   admin, karena informasinya berguna buat siapa pun yang sedang jaga kasir.
9. **Kelola Kasir** (admin, halaman "Kelola Kasir") — buat akun kasir (username/password bebas
   pilih admin, bukan akun Google), nonaktifkan kasir yang tidak lagi bekerja (bukan hapus — riwayat
   transaksinya tetap tersimpan), dan atur empat izin akses per kasir secara independen: lihat
   semua transaksi, lihat laporan, kelola produk, batalkan transaksi. Backend menegakkan semuanya
   lewat `requirePermission` (`backend/src/middleware/auth.ts`), bukan cuma disembunyikan di UI.
10. **Pengaturan toko** (admin, halaman "Pengaturan") — nama/alamat/telepon toko dan catatan kaki
    struk (dipakai di header aplikasi & struk cetak), **tarif pajak default** (otomatis mengisi
    field pajak di setiap transaksi baru di halaman Kasir), dan **tema warna** (6 pilihan — warna
    aksen tombol & navigasi berlaku untuk semua kasir toko itu). Semua tersimpan di database
    per-toko, bukan file konfigurasi — jadi bisa diubah kapan saja tanpa redeploy, dan tiap toko
    punya pengaturannya sendiri-sendiri.
    **Logo usaha** ada di kartu terpisah di halaman yang sama, tapi sengaja **disimpan di
    perangkat/browser itu sendiri** (localStorage, lewat `frontend/src/hooks/useStoreLogo.ts`),
    bukan di database — supaya tidak membengkakkan file SQLite yang disinkronkan ke Firebase
    Storage setiap kali ada tulisan (lihat [Deployment](#deployment-live-demo)). Konsekuensinya:
    logo perlu diunggah ulang di tiap perangkat/browser yang dipakai login, ini bukan bug.
11. **Ruang iklan Google AdSense** (opsional, dikontrol operator platform — lihat
    [Mengaktifkan iklan](#mengaktifkan-iklan-adsense)) — dua slot siap pakai (footer semua halaman
    dan halaman laporan) lewat komponen `frontend/src/components/AdSlot.tsx`, sama untuk semua
    toko. Kosong secara default (tampil sebagai placeholder "Ruang iklan" yang jujur, bukan iklan
    palsu) sampai diisi lewat env var Cloud Functions — **bukan** sesuatu yang bisa diatur pemilik
    toko dari halaman Pengaturan (itu monetisasi aplikasi ini sendiri, bukan kustomisasi per-toko).
12. **Bantuan** (halaman "Bantuan", `frontend/src/pages/HelpPage.tsx`) — tutorial dalam-aplikasi
    yang mencakup semua fitur di atas, bagiannya menyesuaikan otomatis dengan role yang sedang
    login (bagian khusus admin disembunyikan dari kasir).
13. **Kualitas kode** — struktur rapi (routes/lib/middleware terpisah), business logic penting
    (perhitungan harga, diskon, pajak, kembalian, validasi & pengurangan stok) sebagai fungsi
    murni dengan unit test.
14. **Aplikasi Android** — APK yang bisa langsung diinstal, dibungkus lewat
    [Capacitor](https://capacitorjs.com/) (`frontend/capacitor.config.json` + `frontend/android/`).
    Aplikasinya memuat live URL yang sama persis (bukan salinan offline terpisah), jadi selalu
    sinkron dengan versi web tanpa pipeline konten sendiri. Build APK-nya jalan lewat GitHub
    Actions (`.github/workflows/build-apk.yml`, dipicu manual — lihat tombol "Generate Android" di
    AI App Builder dashboard, bukan `npm run` biasa karena butuh Android SDK yang tidak perlu
    dipasang lokal), hasilnya debug-signed dan otomatis terbit sebagai
    [GitHub Release](https://github.com/dewatalaptop/retail-pos/releases/tag/android-latest).

## Mengaktifkan iklan AdSense

AdSense di sini adalah monetisasi **aplikasi ini sendiri** (milik siapa pun yang men-deploy-nya —
biasanya kamu, operator platform), bukan sesuatu yang tiap pemilik toko atur masing-masing. Karena
itu, konfigurasinya sengaja **tidak ada di halaman Pengaturan** (yang dilihat pemilik toko) — cuma
lewat env var backend (`backend/src/routes/settings.ts`'s `getPlatformAdsenseConfig`), sama untuk
semua toko yang pakai aplikasi ini:

1. Daftar/masuk ke [Google AdSense](https://www.google.com/adsense/) dan tambahkan domain tempat
   aplikasi ini dideploy sebagai situsmu, tunggu sampai disetujui.
2. Buat unit iklan (mis. "Retail POS Footer", "Retail POS Laporan") dan catat Client ID
   (`ca-pub-...`) serta Slot ID masing-masing.
3. Set `ADSENSE_CLIENT_ID`, `ADSENSE_SLOT_FOOTER`, `ADSENSE_SLOT_REPORTS` — lokal lewat env var
   biasa sebelum menjalankan backend, atau untuk deploy Firebase lewat `functions/.env` (lihat
   [Variabel lingkungan](#variabel-lingkungan-backend-opsional), sama seperti `JWT_SECRET`) lalu
   deploy ulang. Iklan sungguhan akan mulai tampil begitu AdSense selesai memverifikasi unit
   iklannya (bisa perlu beberapa jam).

## Catatan

- `npm audit` mungkin melaporkan advisory moderat/tinggi pada `esbuild` (transitif lewat
  `vite`/`vitest`, dev-only). Ini terkait dev server, bukan kode yang di-ship ke production, dan
  sengaja tidak di-force-fix karena akan menaikkan versi `vite`/`vitest` secara breaking.
- Metode pembayaran kartu/QRIS adalah **simulasi** (tidak terhubung ke payment gateway
  sungguhan), sesuai kebutuhan demo.
- **Belum ada integrasi Google Drive** untuk backup/ekspor data per-toko — sempat diminta di awal
  tapi arah akhirnya (lihat [Multi-toko](#multi-toko--login)) memilih database bersama per toko
  (bukan penyimpanan lokal per-device) supaya admin & kasir tetap melihat data real-time yang
  sama, jadi Drive belum jadi kebutuhan mendesak. Bisa ditambahkan sebagai fitur ekspor
  laporan/backup terpisah kalau memang masih diperlukan.
