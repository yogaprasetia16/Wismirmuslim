# Cadangan otomatis Google Sheet WISMIR

Skrip `Code.gs` di folder ini menyalin Sheet dashboard/kasir dan Sheet katalog "web" ke folder Google Drive **setiap tanggal 1, sekitar jam 02.00**. Skrip ini proyek Apps Script **terpisah**, jadi tidak memperlambat kasir, dashboard, atau website.

## Memasang (sekitar 10 menit, sekali saja)
1. Buka https://script.google.com → **New project**. Beri nama `Cadangan WISMIR`.
2. Hapus isi `Code.gs` bawaan, lalu tempel seluruh isi `Code.gs` dari folder ini.
3. Klik ikon **roda gigi (Project Settings)** di kiri:
   - Ubah **Time zone** menjadi Jakarta (GMT+07:00), supaya jadwal "jam 02.00" memakai waktu Jakarta.
   - Di bagian **Script properties** klik **Add script property**:
     - `SHEET_DASHBOARD` = ID Google Sheet dashboard/kasir
     - `SHEET_WEB` = ID Google Sheet katalog "web"
     - (opsional) `FOLDER_NAME` = nama folder cadangan. Bawaan: `Cadangan WISMIR`
   - **ID Sheet** = teks panjang di alamat Sheet antara `/d/` dan `/edit`.
4. Kembali ke editor, pilih fungsi **pasangJadwal** di menu atas, klik **Run**, dan beri izin (akses Google Drive, Sheets, dan email). Ini memasang jadwal bulanan.
5. **Uji sekarang:** pilih fungsi **cadangkanSekarang**, klik **Run**. Cek Google Drive: folder `Cadangan WISMIR` berisi `Cadangan Dashboard <tanggal>` dan `Cadangan Web <tanggal>`.

## Aturan
- Disimpan **6 salinan terakhir** per Sheet. Yang lebih lama masuk **Sampah** Drive (bisa dipulihkan 30 hari).
- Kalau satu cadangan gagal, kamu dapat email "Cadangan WISMIR gagal".
- Jangan bagikan folder cadangan ke orang lain: isinya data keuangan.
- Jangan menaruh ID Sheet di kode atau di GitHub. Isi hanya di Script properties.

## Memulihkan
Buka salinan di Drive → **File → Make a copy** untuk memakai datanya, atau salin tab/baris yang hilang ke Sheet asli. Untuk mengganti Sheet yang dipakai aplikasi, jangan ubah alamatnya; salin isinya ke Sheet asli.
