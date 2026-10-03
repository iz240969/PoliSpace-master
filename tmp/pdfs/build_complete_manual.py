from pathlib import Path
from io import BytesIO

from PIL import Image as PILImage
from pypdf import PdfReader, PdfWriter
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Table, TableStyle


ROOT = Path(r"C:\laragon\www\PoliSpace-master")
BASE = ROOT / "output/pdf/PoliSpace_User_Manual_With_Screenshots.pdf"
OUT = ROOT / "output/pdf/PoliSpace_User_Manual_Complete.pdf"
SHOTS = ROOT / "tmp/pdfs/screenshots"
NAVY = colors.HexColor("#123047")
TEAL = colors.HexColor("#0b8c89")
INK = colors.HexColor("#213344")
MUTED = colors.HexColor("#587084")
PALE = colors.HexColor("#eaf5f5")
LINE = colors.HexColor("#d9e2e8")
WHITE = colors.white
W, H = A4

body = ParagraphStyle("body", fontName="Helvetica", fontSize=8.4, leading=12.3, textColor=INK, spaceAfter=0)
label = ParagraphStyle("label", parent=body, fontName="Helvetica-Bold", fontSize=8.5, leading=12)
small = ParagraphStyle("small", parent=body, fontSize=8, leading=11.5)


pages = [
    dict(title="Akaun, daftar masuk dan profil", image="staff-signup.jpg", note="Gunakan akaun sendiri. Kakitangan baharu perlu disahkan pentadbir sebelum pengecualian bayaran berkuat kuasa.", rows=[
        ("Daftar akaun awam", "Pilih Daftar. Isi nama, nombor telefon, e-mel, kata laluan dan pengesahan kata laluan. Pilih jenis akaun Orang Awam, kemudian hantar."),
        ("Daftar akaun kakitangan", "Dalam borang daftar, pilih Kakitangan dan isi nombor staf. Selepas daftar, tunggu pentadbir mengesahkan status kakitangan."),
        ("Log masuk", "Pilih Log Masuk, isi e-mel dan kata laluan, lalu tekan butang masuk. Gunakan akaun awam, kakitangan atau pentadbir mengikut peranan yang diberikan."),
        ("Edit profil", "Buka Papan Pemuka dan pilih Edit Profil. Ubah nama atau nombor telefon lalu simpan. E-mel dipaparkan sebagai maklumat akaun dan tidak disunting di sini."),
        ("Log keluar", "Pilih Log Keluar daripada menu akaun selepas selesai, khususnya pada komputer yang dikongsi."),
    ]),
    dict(title="Laman utama dan carian fasiliti", image="home.jpg", rows=[
        ("Laman utama", "Gunakan Buat Tempahan untuk membuka borang tempahan, atau Papan Pemuka untuk melihat tempahan sendiri selepas log masuk."),
        ("Kalendar umum", "Semak bulan semasa, kemudian gunakan kawalan bulan sebelumnya atau seterusnya untuk melihat tempahan pada tarikh lain."),
        ("Senarai fasiliti", "Teliti kad fasiliti, kadar harga, kapasiti, peralatan yang tersedia dan maklumat berkaitan sebelum memilih tempat."),
        ("Butiran fasiliti", "Buka fasiliti yang dikehendaki untuk membaca keterangan, kapasiti, kemudahan dan PIC yang dipaparkan."),
        ("Mula tempahan", "Pilih fasiliti daripada laman utama atau pada borang tempahan; sistem membawa pilihan tersebut ke aliran tempahan."),
    ]),
    dict(title="Borang tempahan biasa", image="booking-details.jpg", note="Tarikh mula perlu sekurang-kurangnya tiga hari dari hari permohonan. Ketersediaan dan kapasiti disemak sebelum permohonan dihantar.", rows=[
        ("Pilih fasiliti dan tarikh", "Pilih fasiliti, buka pemilih tarikh, dan tentukan tarikh yang tersedia. Semak jadual agar masa yang dipilih tidak bertindih."),
        ("Masa dan tempoh", "Isi masa mula dan tempoh. Mod jam menerima 1 hingga 24 jam; bagi fasiliti yang menyokongnya, mod hari menerima 1 hingga 30 hari."),
        ("Tujuan dan peserta", "Nyatakan tujuan penggunaan dan bilangan peserta. Bilangan peserta tidak boleh melebihi kapasiti fasiliti."),
        ("Peralatan", "Jika ada, tambah peralatan yang diperlukan, tetapkan kuantiti dan buang item yang tidak diperlukan sebelum hantar."),
        ("Anggaran bayaran", "Semak anggaran yang dikira daripada fasiliti dan tempoh. Amaun akhir tertakluk pada semakan pentadbir."),
        ("Maklumat PIC", "Rujuk nama dan hubungan PIC yang terpapar untuk penyelarasan fasiliti selepas tempahan diluluskan."),
        ("Hantar Permohonan", "Semak semua medan dan tekan Hantar Permohonan. Simpan nombor rujukan PS yang dipaparkan selepas permohonan berjaya."),
    ]),
    dict(title="Tempahan Asrama", image="admin-asrama.jpg", note="Nombor bilik dan aras ditentukan oleh PIC. Sistem ini menyemak kuota bilik mengikut tarikh dan jantina.", rows=[
        ("Pilih Asrama", "Pilih fasiliti Asrama. Tempahan Asrama menggunakan mod hari sahaja; isi tarikh mula dan bilangan hari."),
        ("Jantina dan bilik", "Pilih lelaki, perempuan atau kedua-duanya dan isi bilangan bilik untuk setiap kategori yang digunakan."),
        ("Semak kuota", "Rujuk bilangan bilik yang masih tersedia bagi tarikh pilihan. Permohonan yang melebihi had tidak boleh dihantar."),
        ("Tujuan dan peserta", "Lengkapkan tujuan serta bilangan peserta mengikut medan borang. Semak jumlah anggaran sebelum hantar."),
        ("Pengesahan", "Hantar permohonan dan simpan rujukan PS; pentadbir menyemak permohonan sebelum penggunaan."),
    ]),
    dict(title="Resit, pembayaran dan troli", image="booking-cart.jpg", note="Format resit yang diterima: JPG, PNG, GIF atau PDF sehingga 5 MB. Kakitangan yang telah disahkan dikecualikan daripada keperluan resit.", rows=[
        ("Resit tempahan tunggal", "Jika sudah membayar, pilih fail resit pada borang dan tekan Hantar Permohonan. Jika tiada resit, permohonan awam boleh muncul sebagai Belum Bayar; muat naik kemudian di Papan Pemuka."),
        ("Tambah ke Troli", "Lengkapkan borang tanpa resit, lalu pilih Tambah ke Troli untuk menyimpan item sementara. Ulang bagi fasiliti atau tarikh lain."),
        ("Resit dipilih ketika Tambah ke Troli", "Jika fail resit telah dipilih, tindakan ini terus menghantar tempahan tunggal dan memaparkan kejayaan; item itu tidak disimpan dalam troli."),
        ("Urus troli", "Buka troli untuk melihat item, sunting butiran atau buang item. Tempahan yang bertindih untuk fasiliti dan masa sama tidak diterima."),
        ("Hantar Semua", "Bagi akaun awam, lampirkan satu resit untuk troli dan tekan Hantar Semua. Simpan rujukan kumpulan TR dan setiap rujukan PS yang terhasil."),
        ("Kegagalan sebahagian", "Jika sebahagian item gagal dihantar, semak mesej ralat. Item yang gagal kekal dalam troli untuk dibaiki dan dihantar semula."),
    ]),
    dict(title="Papan Pemuka dan status tempahan", image="user-dashboard.jpg", rows=[
        ("Ringkasan", "Buka Papan Pemuka untuk melihat kiraan tempahan mengikut status dan tindakan pantas."),
        ("Cari, susun dan tapis", "Gunakan carian, susunan dan penapis status pada jadual untuk mencari tempahan. Kembangkan kumpulan apabila beberapa tempahan dihantar bersama."),
        ("Lihat butiran", "Pilih tempahan untuk melihat fasiliti, tarikh, masa, peserta, status, anggaran dan maklumat lain."),
        ("Muat naik resit", "Pada tempahan Belum Bayar, pilih Muat Naik Resit dan hantar fail yang sah. Semak perubahan status selepas proses berjaya."),
        ("Sunting tempahan", "Gunakan tindakan Sunting pada tempahan Belum Bayar atau Menunggu sahaja. Semak butiran terkini sebelum menyimpan."),
        ("Batal tempahan", "Pilih Batal pada tempahan Belum Bayar atau Menunggu, baca pengesahan, kemudian sahkan. Rekod kekal dalam sejarah sebagai dibatalkan."),
        ("Semak Status", "Buka Semak Status dan masukkan rujukan PS atau TR untuk melihat rekod, butiran dan garis masa status."),
    ]),
    dict(title="Kakitangan dan hubungan dengan pentadbir", image="staff-exemption.jpg", rows=[
        ("Pengesahan kakitangan", "Daftar dengan nombor staf; pentadbir menyemak akaun. Papan Pemuka memaparkan penanda Kakitangan - Disahkan apabila status telah disahkan."),
        ("Tempahan kakitangan", "Kakitangan disahkan boleh menghantar tempahan tanpa resit. Permohonan masih perlu melalui semakan dan kelulusan pentadbir."),
        ("Akaun belum disahkan", "Selagi akaun kakitangan belum disahkan, semak keperluan pembayaran yang ditunjukkan sistem dan hubungi pentadbir jika status tidak tepat."),
        ("Hubungi pentadbir", "Di Papan Pemuka, buka Hubungi Pentadbir. Isi tajuk dan mesej, kemudian hantar. Semak sejarah mesej untuk membaca balasan."),
    ]),
    dict(title="Pentadbir: ringkasan dan tempahan", image="admin-overview.jpg", rows=[
        ("Ringkasan pentadbir", "Buka Ringkasan untuk melihat statistik, tempahan terkini, dan pautan Lihat Semua atau Tambah Tempahan."),
        ("Senarai tempahan", "Buka Tempahan. Gunakan carian, susunan dan penapis status; kembangkan kumpulan untuk melihat tempahan berkaitan."),
        ("Butiran permohonan", "Buka rekod untuk menyemak pemohon, fasiliti, tarikh/masa, peserta, resit bayaran dan PIC sebelum membuat keputusan."),
        ("Lulus", "Pada permohonan yang menunggu, pilih Lulus selepas butiran disemak. Status bertukar kepada Diluluskan."),
        ("Tolak", "Pilih Tolak pada permohonan menunggu, isi sebab yang diminta dan hantar keputusan supaya pemohon dapat melihat alasannya."),
        ("Batal kelulusan", "Bagi tempahan yang telah diluluskan, pilih Batal, isi sebab dan sahkan dialog. Slot dilepaskan; sistem cuba menghantar makluman kepada PIC."),
    ]),
    dict(title="Pentadbir: tambah tempahan", image="admin-create-booking.jpg", note="Tempahan yang dibuat melalui borang pentadbir dicipta sebagai Diluluskan selepas semakan borang berjaya.", rows=[
        ("Buka borang", "Pilih Tambah Tempahan pada Ringkasan atau halaman Tempahan."),
        ("Maklumat pelanggan", "Isi nama, nombor telefon dan e-mel pelanggan yang menerima tempahan."),
        ("Butiran penggunaan", "Pilih fasiliti, tarikh, masa dan tempoh; isi tujuan, peserta dan peralatan jika berkenaan."),
        ("Asrama", "Jika fasiliti Asrama dipilih, isi bilik lelaki/perempuan berdasarkan ketersediaan dan had yang dipaparkan."),
        ("Kaedah bayaran", "Pilih muat naik resit atau bayaran fizikal mengikut keadaan. Semak medan yang diminta sebelum hantar."),
        ("Dokumen bayaran fizikal", "Bagi bayaran fizikal, gunakan tindakan cetak yang menghasilkan dokumen A4 melalui dialog cetak pelayar."),
    ]),
    dict(title="Pentadbir: pelanggan", image="admin-clients-controls.jpg", rows=[
        ("Cari dan tapis pelanggan", "Buka Pelanggan; gunakan carian, susunan dan penapis jenis akaun Awam/Kakitangan."),
        ("Lihat pelanggan", "Buka butiran pelanggan untuk melihat maklumat akaun serta sejarah tempahan mereka."),
        ("Sahkan kakitangan", "Semak nombor staf pada permohonan kakitangan, kemudian pilih tindakan sahkan jika layak."),
        ("Tukar kepada kakitangan", "Pada akaun awam yang layak, gunakan Jadikan Staf. Sistem menetapkan akaun itu sebagai kakitangan disahkan."),
        ("Sekat atau nyahsekat", "Gunakan tindakan Sekat/Nyahsekat untuk kawal akses akaun. Tempahan terdahulu tidak dibatalkan secara automatik."),
        ("Tetap semula kata laluan", "Gunakan tindakan set semula pada pelanggan, isi kata laluan baharu sekurang-kurangnya enam aksara, kemudian simpan."),
    ]),
    dict(title="Pentadbir: mesej dan fasiliti", image="admin-messages.jpg", rows=[
        ("Peti mesej", "Buka Mesej, susun senarai atau muat semula untuk melihat mesej baharu daripada pengguna."),
        ("Baca dan balas", "Buka mesej, baca butiran dan sejarah perbualan, isi balasan dan hantar. Sistem juga cuba menghantar e-mel balasan."),
        ("Senarai fasiliti", "Buka Fasiliti untuk menyemak nama, kapasiti, kadar, status ketersediaan, peralatan dan PIC."),
        ("Tambah fasiliti", "Isi nama, ikon, kapasiti, harga, keterangan, peralatan dan PIC; masukkan had bilik jika jenis fasiliti memerlukannya."),
        ("Edit fasiliti", "Buka borang edit untuk mengubah butiran fasiliti dan simpan perubahan."),
        ("Tukar ketersediaan", "Gunakan suis ketersediaan bagi membuka atau menutup fasiliti daripada tempahan baharu."),
        ("Urus bilik Asrama", "Dari fasiliti Asrama, pilih Urus Bilik untuk membuka tetapan kuota bilik."),
    ]),
    dict(title="Pentadbir: pegawai bertanggungjawab (PIC)", image="admin-pic-form.jpg", rows=[
        ("Cari PIC", "Buka PIC dan gunakan carian untuk mencari pegawai tertentu."),
        ("Tambah PIC", "Pilih Tambah PIC; isi nama, telefon, e-mel jika ada, serta fasiliti yang ditugaskan. Simpan."),
        ("Edit PIC", "Buka rekod PIC untuk membetulkan maklumat hubungan atau penugasan fasiliti, kemudian simpan."),
        ("Hantar e-mel ujian", "Gunakan tindakan Hantar E-mel pada PIC yang mempunyai alamat e-mel untuk menguji penghantaran notifikasi."),
        ("Padam PIC", "Gunakan Padam selepas menyemak penugasan. Tindakan ini membuang hubungan PIC dengan fasiliti; fasiliti tidak dipadam."),
    ]),
    dict(title="Pentadbir: Asrama dan kalendar", images=["admin-asrama.jpg", "admin-calendar.jpg"], rows=[
        ("Had bilik biasa", "Pada Urus Bilik Asrama, tetapkan had bilik lelaki dan perempuan. Setiap nilai biasa ialah 0 hingga 30; semak bilik telah ditempah dan baki."),
        ("Mod cuti", "Hidupkan mod cuti jika perlu, pilih tarikh mula/akhir dan tetapkan had bilik lelaki/perempuan untuk tempoh itu, sehingga 100 setiap kategori."),
        ("Simpan tetapan", "Simpan had selepas meneliti tarikh dan kuota. Semakan ketersediaan tempahan Asrama menggunakan tetapan ini."),
        ("Kalendar pentadbir", "Buka Kalendar dan gunakan kawalan bulan sebelumnya, semasa atau seterusnya untuk melihat penanda tempahan."),
        ("Semak tarikh", "Pilih tarikh atau rekod berkaitan apabila tersedia untuk merujuk tempahan yang muncul dalam kalendar."),
    ]),
    dict(title="Pentadbir: laporan dan bukti bayaran", image="admin-reports.jpg", note="Angka kewangan dalam laporan ialah anggaran tempahan, bukan pengesahan bahawa bayaran telah diterima.", rows=[
        ("Pilih tempoh", "Buka Laporan dan pilih Semua Masa, Bulan Ini atau Tahun Ini."),
        ("Susun bukti", "Susun senarai bukti mengikut yang terkini atau tarikh tempahan menaik/menurun; gunakan Muat Semula untuk mendapatkan data semasa."),
        ("Analisis", "Baca ringkasan status, trend tempahan, fasiliti teratas dan anggaran kewangan dalam bahagian analisis."),
        ("Bukti bayaran", "Lihat senarai bukti dan buka pautan fail resit apabila tersedia. Kembangkan rekod untuk butiran tambahan."),
        ("Cetak rekod", "Gunakan tindakan cetak pada bukti atau tempahan untuk membuka dokumen melalui dialog cetak pelayar."),
        ("Cetak laporan", "Pilih Cetak Laporan dan gunakan pilihan cetak atau simpan sebagai PDF pada pelayar."),
    ]),
]


def p(text, style=body):
    return Paragraph(text, style)


def page_frame(c, number, title):
    c.setFillColor(NAVY)
    c.rect(0, H - 63, W, 63, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(WHITE)
    c.drawString(47, H - 38, "POLISPACE  |  PANDUAN PENGGUNA")
    c.setFillColor(TEAL)
    c.rect(47, H - 89, 38, 3, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 16)
    c.setFillColor(NAVY)
    c.drawString(47, H - 118, title)
    c.setStrokeColor(LINE)
    c.line(47, 43, W - 47, 43)
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 8)
    c.drawString(47, 29, "PoliSpace  |  Panduan fungsi sistem")
    c.drawRightString(W - 47, 29, str(number))


def draw_shot(c, path, x, y_top, width, max_height=250):
    im = PILImage.open(path)
    iw, ih = im.size
    h = min(max_height, width * ih / iw)
    w = h * iw / ih
    x = x + (width - w) / 2
    c.setStrokeColor(LINE)
    c.roundRect(x - 4, y_top - h - 4, w + 8, h + 8, 6, stroke=1, fill=0)
    c.drawImage(str(path), x, y_top - h, width=w, height=h, preserveAspectRatio=True)
    return h


def draw_detail_page(c, cfg, num):
    page_frame(c, num, cfg["title"])
    y = H - 145
    rows = [[p("FUNGSI", label), p("CARA GUNA", label)]]
    rows += [[p(a, label), p(b)] for a, b in cfg["rows"]]
    table = Table(rows, colWidths=[145, W - 239], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#f8fbfc")]),
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    tw, th = table.wrap(W - 94, H)
    table.drawOn(c, 47, y - th)
    y -= th + 13
    if cfg.get("note"):
        note = p("<b>Nota:</b> " + cfg["note"], small)
        _, nh = note.wrap(W - 110, H)
        c.setFillColor(PALE)
        c.roundRect(47, y - nh - 14, W - 94, nh + 16, 6, stroke=0, fill=1)
        note.drawOn(c, 55, y - nh - 7)
        y -= nh + 25
    shots = cfg.get("images") or ([cfg["image"]] if cfg.get("image") else [])
    if shots:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(MUTED)
        c.drawString(47, y, "TANGKAPAN SKRIN SISTEM")
        y -= 13
        if len(shots) == 1:
            available = y - 61
            h = draw_shot(c, SHOTS / shots[0], 55, y, W - 110, min(236, available))
            y -= h + 8
        else:
            width = (W - 118) / 2
            h1 = draw_shot(c, SHOTS / shots[0], 55, y, width, min(140, y - 61))
            h2 = draw_shot(c, SHOTS / shots[1], 63 + width, y, width, min(140, y - 61))
            y -= max(h1, h2) + 8
    if y < 50:
        raise ValueError(f"Page {num} content overflows by {50-y:.1f} pt: {cfg['title']}")
    c.showPage()


def make_toc():
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=A4)
    page_frame(c, 2, "Kandungan manual")
    entries = [
        ("Pengenalan dan laman utama", 3),
        ("Akaun dan log masuk", 4),
        ("Tempahan fasiliti", 5),
        ("Pembayaran dan troli", 6),
        ("Papan Pemuka dan status", 7),
        ("Kakitangan", 8),
        ("Pentadbir: tempahan", 9),
        ("Pentadbir: pelanggan dan mesej", 10),
        ("Fasiliti dan PIC", 11),
        ("Kalendar dan laporan", 12),
        ("Status dan bantuan", 13),
        ("Akaun, daftar masuk dan profil", 14),
        ("Laman utama dan carian fasiliti", 15),
        ("Borang tempahan biasa", 16),
        ("Tempahan Asrama", 17),
        ("Resit, pembayaran dan troli", 18),
        ("Papan Pemuka dan status tempahan", 19),
        ("Kakitangan dan hubungan pentadbir", 20),
        ("Pentadbir: ringkasan dan tempahan", 21),
        ("Pentadbir: tambah tempahan", 22),
        ("Pentadbir: pelanggan", 23),
        ("Pentadbir: mesej dan fasiliti", 24),
        ("Pentadbir: PIC", 25),
        ("Pentadbir: Asrama dan kalendar", 26),
        ("Pentadbir: laporan dan bukti", 27),
        ("Indeks liputan fungsi", 28),
    ]
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(47, H - 143, "Ringkasan visual")
    c.drawString(307, H - 143, "Langkah fungsi terperinci")
    for j, subset in enumerate((entries[:11], entries[11:])):
        x = 47 if j == 0 else 307
        y = H - 169
        for title, no in subset:
            c.setStrokeColor(LINE)
            c.line(x, y - 6, x + 236, y - 6)
            c.setFillColor(INK)
            c.setFont("Helvetica", 9)
            c.drawString(x, y, title)
            c.setFont("Helvetica-Bold", 9)
            c.setFillColor(TEAL)
            c.drawRightString(x + 236, y, str(no))
            y -= 36
    c.setFillColor(PALE)
    c.roundRect(47, 145, W - 94, 53, 8, stroke=0, fill=1)
    n = p("<b>Skop:</b> semua tindakan yang kelihatan dalam antara muka pengguna awam, kakitangan dan pentadbir. Bahagian 14-28 memperincikan langkah dan had penting bagi setiap fungsi.", small)
    _, nh = n.wrap(W - 116, 53)
    n.drawOn(c, 58, 168 - nh / 2)
    c.showPage()
    c.save()
    stream.seek(0)
    return PdfReader(stream).pages[0]


def make_appendix():
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=A4)
    for i, cfg in enumerate(pages, start=14):
        draw_detail_page(c, cfg, i)
    page_frame(c, 28, "Indeks liputan fungsi")
    intro = p("Indeks ini membantu anda mencari setiap tindakan utama mengikut peranan. Rujuk halaman langkah terperinci yang disenaraikan.")
    _, ih = intro.wrap(W - 94, H)
    intro.drawOn(c, 47, H - 147 - ih)
    index_rows = [
        ("Semua pengguna", "Laman utama; kalendar; fasiliti; daftar; log masuk; edit profil; log keluar", "14-15"),
        ("Pemohon", "Pilih fasiliti/tarikh/masa/tempoh; tujuan; peserta; peralatan; PIC; anggaran; hantar", "16"),
        ("Pemohon Asrama", "Mod hari; bilik lelaki/perempuan; kuota; hantar", "17"),
        ("Bayaran/troli", "Resit; tambah; lihat; sunting; buang; hantar semua; rujukan PS/TR", "18"),
        ("Tempahan saya", "Ringkasan; carian; susunan; tapis; kumpulan; butiran; resit; sunting; batal; status", "19"),
        ("Kakitangan", "Daftar nombor staf; pengesahan; pengecualian resit; hubungi pentadbir", "20"),
        ("Admin tempahan", "Ringkasan; cari/susun/tapis; butiran; lulus; tolak; batal", "21"),
        ("Admin tambah", "Isi pelanggan/fasiliti/jadual; Asrama; resit/fizikal; cetak", "22"),
        ("Admin pelanggan", "Cari/susun/tapis; lihat sejarah; sahkan staf; tukar staf; sekat; kata laluan", "23"),
        ("Admin mesej", "Susun; muat semula; baca; balas", "24"),
        ("Admin fasiliti", "Tambah; edit; ketersediaan; urus bilik", "24"),
        ("Admin PIC", "Cari; tambah; edit; tugaskan; e-mel ujian; padam", "25"),
        ("Admin Asrama", "Had biasa; mod cuti; tarikh; simpan; semak baki", "26"),
        ("Admin kalendar", "Bulan sebelum/semasa/selepas; semak rekod", "26"),
        ("Admin laporan", "Tempoh; susunan; muat semula; analisis; bukti; cetak", "27"),
    ]
    rows = [[p("PERANAN / MODUL", label), p("FUNGSI", label), p("HAL.", label)]]
    rows += [[p(a, label), p(b, small), p(d, label)] for a,b,d in index_rows]
    table = Table(rows, colWidths=[115, 346, 40], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#f8fbfc")]),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    _, th = table.wrap(W - 94, H)
    bottom = H - 160 - ih - th
    if bottom < 55:
        raise ValueError(f"Index overflow {bottom}")
    table.drawOn(c, 47, bottom)
    c.showPage()
    c.save()
    stream.seek(0)
    return PdfReader(stream)


def main():
    source = PdfReader(BASE)
    assert len(source.pages) == 13
    appendix = make_appendix()
    assert len(appendix.pages) == 15
    writer = PdfWriter()
    writer.add_page(source.pages[0])
    writer.add_page(make_toc())
    for page in source.pages[2:]:
        writer.add_page(page)
    for page in appendix.pages:
        writer.add_page(page)
    writer.add_metadata({
        "/Title": "PoliSpace User Manual - Complete Functions and Screenshots",
        "/Author": "Muhammad Izzat Hanis bin Ahmad; Amirul Asyraf bin Ahmad Nasharudin; Muhammad Aidil Afiq bin Idil Iskandar",
        "/Subject": "Panduan lengkap pengguna awam, kakitangan dan pentadbir PoliSpace",
    })
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("wb") as f:
        writer.write(f)
    print(f"Created {OUT} ({len(writer.pages)} pages)")


if __name__ == "__main__":
    main()
