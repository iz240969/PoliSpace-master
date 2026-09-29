# Panduan Istilah Bahasa Melayu PoliSpace

Gunakan panduan ini apabila menambah teks pada halaman, mesej, e-mel atau dokumen cetakan PoliSpace. Pilih perkataan mengikut konteks sebenar, bukan terjemahan perkataan demi perkataan.

## Istilah pilihan

| Maksud | Istilah |
| --- | --- |
| Akaun orang awam | Orang Awam |
| Akaun kakitangan | Kakitangan |
| Pentadbir sistem | Pentadbir |
| Orang yang menghantar permohonan | Pemohon |
| Modul akaun dalam paparan pentadbir | Pelanggan |
| Permintaan menggunakan fasiliti | Permohonan atau Tempahan, mengikut konteks |
| Fail yang dimuat naik sebagai bukti pembayaran | Bukti Bayaran |
| Medan e-mel | Alamat E-mel |
| Medan telefon | No. Telefon |
| Nombor pengenal tempahan | No. Rujukan Tempahan |
| Pegawai yang mengurus fasiliti | Pegawai Bertanggungjawab (PIC), kemudian PIC |

Kekalkan nama PoliSpace, PIC, RM, nama rasmi fasiliti, serta nilai teknikal seperti `pending`, `approved`, `staff` dan `admin`.

## Status mengikut aliran kerja

Jangan ubah nilai status yang disimpan oleh sistem. Terjemahkan status ketika dipaparkan:

| Nilai sistem | Label paparan |
| --- | --- |
| `unpaid` | Belum Bayar |
| `pending` untuk tempahan yang memerlukan bayaran | Menunggu Semakan Bayaran |
| `pending` untuk permohonan kakitangan yang disahkan | Menunggu Kelulusan |
| `approved` | Diluluskan |
| `rejected` | Ditolak |
| `cancelled` | Dibatalkan |

Pengesahan akaun kakitangan ialah proses berasingan daripada kelulusan tempahan. Bukti bayaran yang dimuat naik belum bermaksud bayaran telah disahkan atau tempahan telah diluluskan.

## PIC: tugasan dan rekod

- Jika fasiliti tiada PIC, paparkan **Tiada PIC**.
- Apabila menetapkan PIC, gunakan **Tetapkan PIC** dan pilihan **Pilih PIC**.
- Mengosongkan pilihan PIC hanya menanggalkan tugasan daripada fasiliti; rekod PIC dan fasiliti kekal. Terangkan kesan ini pada bantuan atau dialog.
- Memadam rekod PIC akan mengosongkan tugasan pada fasiliti berkaitan, tetapi rekod fasiliti kekal. Nyatakan kedua-dua kesan dalam pengesahan.
- Jangan gunakan **Tidak Aktif** untuk bermaksud tiada PIC; status tidak aktif dan tugasan kosong membawa maksud berbeza.

## Bayaran, e-mel dan cetakan

- **Bukti Bayaran** ialah fail yang dimuat naik; ia bukan **Resit Rasmi**.
- Bezakan anggaran caj tempahan daripada jumlah bayaran yang direkodkan.
- Gunakan **Sahkan** pada butang dan **Hantar E-mel** untuk tindakan menghantar templat e-mel sedia ada.
- Nyatakan bahawa e-mel telah dihantar hanya jika fungsi penghantaran melaporkan kejayaan. Jangan dakwa penerima telah menerimanya.
- Dalam notis pembatalan kepada PIC, sertakan tempahan, fasiliti, tarikh dan sebab pembatalan yang direkodkan.

## Butang dan dialog

- Gunakan **Simpan**, **Simpan Perubahan**, **Kembali**, **Tutup**, **Lihat Butiran**, **Muat Naik** dan **Cuba Lagi** jika sepadan dengan tindakan.
- Bezakan menutup dialog daripada membatalkan tempahan. Gunakan **Kembali** atau **Tutup** untuk dialog dan **Batalkan Tempahan** untuk pembatalan sebenar.
- Pastikan teks butang, `title`, label aksesibiliti dan mesej pengesahan menerangkan tindakan yang sama.

## Contoh nada

- **Data tidak dapat dimuatkan. Sila cuba lagi.**
- **Tidak dapat menghubungi pelayan. Sila cuba lagi.**
- **Belum ada tempahan.**
- **Tiada rekod yang sepadan dengan carian anda.**
- **Tempahan berjaya disahkan, tetapi e-mel kepada PIC tidak dapat dihantar.**

Gunakan ayat ringkas dan sopan. Jangan menterjemah kandungan yang ditaip pengguna seperti nama, tujuan tempahan, mesej, nota atau nama fasiliti.
