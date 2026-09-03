import { useAuth } from "../context/AuthContext";

interface Section {
  title: string;
  ownerOnly?: boolean;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    title: "Mulai dari mana?",
    body: (
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          Tambahkan produk pertamamu di menu <strong>Produk</strong> — SKU, nama, harga, dan stok
          awal.
        </li>
        <li>
          Kalau kamu punya kasir lain (bukan cuma kamu sendiri yang jaga toko), buat akun mereka di
          menu <strong>Kelola Kasir</strong> dan atur apa saja yang boleh mereka akses.
        </li>
        <li>
          Isi nama toko & catatan struk di menu <strong>Pengaturan</strong> supaya struk cetakmu
          terlihat profesional.
        </li>
        <li>
          Buka menu <strong>Kasir</strong> dan mulai transaksi pertamamu.
        </li>
      </ol>
    ),
  },
  {
    title: "Transaksi & kasir",
    body: (
      <div className="space-y-2">
        <p>Klik produk untuk menambahkannya ke keranjang. Untuk tiap baris keranjang, kamu bisa ubah jumlah (qty) dan diskon per item.</p>
        <p>
          <strong>Scan barcode:</strong> kalau punya alat pemindai barcode (USB/Bluetooth), cukup
          arahkan ke halaman Kasir lalu scan — produk dengan SKU yang cocok otomatis masuk
          keranjang, tanpa perlu klik apa pun. Alat pemindai terdeteksi otomatis dari kecepatan
          ketikannya, jadi tidak perlu pengaturan tambahan.
        </p>
        <p>
          <strong>Tahan transaksi:</strong> kalau pelanggan belum siap bayar atau kamu perlu
          melayani orang lain dulu, klik <em>Tahan</em> untuk menyimpan keranjang sementara (bisa
          diberi label, mis. nomor meja). Lanjutkan kapan saja lewat tombol <em>Tertahan</em> di
          pojok kanan atas daftar produk.
        </p>
        <p>
          Pilih metode pembayaran (Tunai/Kartu/QRIS). Untuk tunai, ketuk tombol pecahan uang (mis.
          "+50rb", "+5rb") sesuai lembar uang yang diterima dari pelanggan — bisa ditekan beberapa
          kali untuk menjumlahkan beberapa lembar, atau ketuk <em>Uang pas</em> kalau pas. Kembalian
          dihitung otomatis. Tombol <em>Kosongkan</em> di atas keranjang membatalkan seluruh
          transaksi yang sedang diketik (perlu diketuk dua kali untuk konfirmasi).
        </p>
      </div>
    ),
  },
  {
    title: "Riwayat & pembatalan transaksi",
    body: (
      <div className="space-y-2">
        <p>Menu <strong>Riwayat</strong> menampilkan semua transaksi, bisa difilter berdasarkan tanggal. Klik "Lihat struk" untuk membuka ulang struk transaksi mana pun.</p>
        <p>
          Kalau ada kesalahan input, transaksi bisa <strong>dibatalkan</strong> (bukan dihapus) —
          stok yang terpakai otomatis dikembalikan, dan transaksi tetap tercatat dengan status
          "Dibatalkan" untuk jejak audit, tapi tidak dihitung lagi di laporan pendapatan. Tombol
          "Batalkan" perlu diklik dua kali (klik pertama jadi "Yakin?") supaya tidak
          terbatalkan tidak sengaja.
        </p>
      </div>
    ),
  },
  {
    title: "Kelola Kasir & izin akses",
    ownerOnly: true,
    body: (
      <div className="space-y-2">
        <p>Sebagai pemilik toko, kamu bisa membuat akun kasir dengan username & password sendiri (bukan akun Google) lewat menu <strong>Kelola Kasir</strong>.</p>
        <p>Untuk tiap kasir, kamu bisa memilih akses apa saja yang mereka boleh punya:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>Lihat semua transaksi</strong> — kalau tidak diaktifkan, kasir cuma bisa lihat transaksi yang dia buat sendiri.</li>
          <li><strong>Lihat laporan</strong> — akses ke halaman Laporan (pendapatan, produk terlaris, dst.).</li>
          <li><strong>Kelola produk</strong> — bisa tambah/edit/hapus produk & ubah stok.</li>
          <li><strong>Batalkan transaksi</strong> — bisa membatalkan transaksi yang sudah selesai.</li>
        </ul>
        <p>Kasir yang tidak lagi bekerja bisa <em>dinonaktifkan</em> (bukan dihapus) — ini memblokir login mereka tapi tetap menyimpan riwayat transaksi yang pernah mereka buat.</p>
      </div>
    ),
  },
  {
    title: "Laporan",
    body: (
      <p>
        Menu <strong>Laporan</strong> menampilkan total pendapatan, jumlah transaksi, grafik
        penjualan harian/bulanan, dan produk terlaris — semuanya sudah mengecualikan transaksi
        yang dibatalkan.
      </p>
    ),
  },
  {
    title: "Pengaturan toko & iklan AdSense",
    ownerOnly: true,
    body: (
      <div className="space-y-2">
        <p>Di menu <strong>Pengaturan</strong>, atur nama, alamat, dan telepon toko (muncul di struk cetak), serta catatan kaki struk.</p>
        <p>
          <strong>Tarif pajak default</strong> otomatis terisi di setiap transaksi baru di halaman
          Kasir, jadi kasir tidak perlu mengetiknya berulang-ulang setiap transaksi (masih bisa
          diubah manual per transaksi kalau ada kasus khusus).
        </p>
        <p>
          <strong>Tema warna</strong> mengubah warna aksen tombol & navigasi di seluruh aplikasi —
          berlaku untuk semua kasir yang login ke tokomu.
        </p>
        <p>
          <strong>Logo usaha</strong> tampil di menu & struk. Berbeda dari pengaturan lain, logo ini
          disimpan langsung di perangkat/browser yang dipakai mengunggahnya, bukan di server — kalau
          kasir memakai HP atau komputer lain, logo perlu diunggah ulang di perangkat itu.
        </p>
        <p>
          Aplikasi ini gratis, dan ada beberapa ruang iklan Google AdSense yang bisa kamu
          aktifkan sendiri untuk membantu menutup biaya operasional — isi Client ID & Slot ID dari
          akun AdSense-mu sendiri. Sampai diisi, ruang itu tampil sebagai placeholder biasa, bukan
          iklan sungguhan.
        </p>
      </div>
    ),
  },
  {
    title: "Login dengan Google",
    body: (
      <p>
        Setiap pemilik toko masuk dengan akun Google masing-masing dari halaman login — login
        Google pertama kali otomatis membuatkan toko baru yang kosong untukmu (bukan toko demo
        dengan produk contoh). Data tiap toko sepenuhnya terpisah dari toko lain di aplikasi ini.
        Kasir yang kamu buat login dengan username/password, bukan Google.
      </p>
    ),
  },
];

export default function HelpPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3">
      <div>
        <h1 className="text-lg font-bold text-slate-900">Bantuan</h1>
        <p className="text-sm text-slate-500">Panduan lengkap menggunakan aplikasi ini.</p>
      </div>
      {SECTIONS.filter((s) => !s.ownerOnly || isAdmin).map((s) => (
        <details key={s.title} className="group rounded-lg border border-slate-200 bg-white shadow-sm" open>
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800 marker:content-none">
            <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
            {s.title}
          </summary>
          <div className="border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-600">
            {s.body}
          </div>
        </details>
      ))}
    </div>
  );
}
