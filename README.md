# Puskesmas Arbes — Sistem Informasi Manajemen Puskesmas

[![Puskesmas Arbes Logo](data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='18' fill='%230b3b34'/%3E%3Cpath d='M32 15v34M15 32h34' stroke='%237ce3c8' stroke-width='10' stroke-linecap='round'/%3E%3Ccircle cx='48' cy='17' r='6' fill='%23f3a47b'/%3E%3C/svg%3E)](https://puskesmas-arbes.id)

> **Melayani dengan hati, untuk masyarakat yang lebih sehat.**

## Deskripsi
Puskesmas Arbes adalah aplikasi web lengkap untuk pengelolaan puskesmas yang memungkinkan:
- Pendaftaran dan antrean pasien
- Rekam medis elektronik (EMR) dokter
- Manajemen farmasi & obat
- Pembayaran tagihan dan kasir
- Laporan & analitik terintegrasi
- Display antrean publik tanpa login

Aplikasi dibangun dengan **plain HTML, CSS, dan JavaScript** tanpa library eksternal, dan data disimpan di `localStorage` browser.

## Fitur Utama
- ✅ 6 peran pengguna: Administrator, Petugas Pendaftaran, Dokter, Perawat, Petugas Farmasi, Petugas Kasir
- ✅ Login/logout, pengelolaan pengguna, hak akses per role
- ✅ Pasien: registrasi, cari, edit, riwayat kunjungan, cetak kartu
- ✅ Antrean: nomor antrean per poli, priority queue, panggilan, estimasi waktu, batal
- ✅ EMR: vitals, diagnosis ICD-10, tindakan, resep elektronik, kontrol ulang, rujukan
- ✅ Farmasi: master obat, stok, penerimaan, pengeluaran, resep, alerts stok
- ✅ Pembayaran: tarif, verifikasi BPJS, pembayaran manual, kuitansi, riwayat
- ✅ Laporan: 6 tab (Ringkasan, Kunjungan, Poli, Penyakit, Obat, Petugas), filter, CSV export, print
- ✅ Display antrean publik: `#/display` tanpa autentikasi
- ✅ Responsive design, print styles, modern UI palette (deep teal/mint/coral)
- ✅ Demo accounts tersedia untuk semua peran

## Akun Demo
| Peran | Username | Password |
|-------|----------|----------|
| Administrator | admin | admin123 |
| Petugas Pendaftaran | pendaftaran | 123456 |
| Dokter | dokter | 123456 |
| Perawat | perawat | 123456 |
| Petugas Farmasi | farmasi | 123456 |
| Petugas Kasir | kasir | 123456 |
| Dokter Gigi | dokter.gigi | 123456 |
| Pendaftaran (non-aktif) | pendaftaran2 | 123456 |

## Branding
- **Nama**: Puskesmas Arbes
- **Instansi**: Puskesmas Arbes
- **Motto**: Melayani dengan hati, untuk masyarakat yang lebih sehat.
- **Warna Primer**: #0b3b34 (deep teal)
- **Warna Accent**: #7ce3c8 (mint), #f3a47b (coral)

## Struktur Proyek
```
puskesmas-arbes/
├── index.html          — Aplikasi shell & markup
├── css/
│   └── styles.css      — Semua style termasuk auth, print, responsive
├── js/
│   ├── data.js         — Domain layer, seed data, auth, permissions, API
│   ├── ui.js           — Shared UI helpers, icons, charts, print, CSV
│   ├── app.js          — Baru! Shell, router, auth, nav, notifications, clock
│   ├── dashboard.js    — Dashboard adaptif per role
│   ├── patients.js     — Pendaftaran & detail pasien
│   ├── queues.js       — Antrean, display publik, cleanup
│   ├── exams.js        — EMR dokter, vitals, resep
│   ├── pharmacy.js     — Farmasi, stok, mutasi, obat
│   ├── billing.js      — Tarif, tagihan, pembayaran, kuitansi
│   └── reports.js      — 6 tab laporan, ekspor, print
├── docs/
│   ├── SCRUM.md        — Dokumentasi sprint & user stories
│   ├── PANDUAN_PENGGUNAAN.md — Panduan pengguna lengkap
│   └── README.md       — File ini
└── package.json        — (opsional) untuk dev tools
```

## Cara Menjalankan Lokal
1. Pastikan sudah menginstall [Node.js](https://nodejs.org/) atau [Python](https://python.org)
2. Jalankan server static di folder proyek:
   - **Node**: `npx http-server` atau `python -m http.server 4173`
   - **Python**: `python -m http.server 4173 --bind 127.0.0.1`
3. Buka browser ke `http://127.0.0.1:4173`
4. Login dengan akun demo:
   - `admin / admin123` — Akses penuh
   - `pendaftaran / 123456` — Pendaftaran pasien & antrean
   - `dokter / 123456` — EMR dan pemeriksaan
   - `perawat / 123456` — Asesmen vital & antrean
   - `farmasi / 123456` — Obat, stok, resep
   - `kasir / 123456` — Tagihan & pembayaran
5. Akses display publik: `http://127.0.0.1:4173/#/display`

## Versi & Versi Data
- **Aplikasi**: v1.0.0
- **Sprint**: Sprint 4
- **Versi Data**: puskesmas-arbes.db.v1, SEED_VERSION = 1
- Jika ada perubahan skema database: clear `localStorage` atau bump `SEED_VERSION`

## Teknologi
- HTML5, CSS3 dengan warna `color-mix()` dan `:has()`
- Vanilla JavaScript (ES6+)
- Hash-based routing (`#/path`)
- localStorage persistence
- Tidak ada dependency eksternal (library CSS/JS)
- Modern browser expected (Chrome, Firefox, Edge, Safari terbaru)

## Lisensi
Aplikasi demonstrasi untuk sistem informasi puskesmas. Bebas digunakan untuk tujuan pelatihan dan demonstrasi.

---
*Dikembangkan sebagai proyek integrasi modul puskesmas management.*"# puskesmasarbes" 
