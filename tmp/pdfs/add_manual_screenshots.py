from io import BytesIO
from pathlib import Path

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas


ROOT = Path(r"C:\laragon\www\PoliSpace-master")
SOURCE = ROOT / "output/pdf/PoliSpace_User_Manual_Reference_Edition.pdf"
DEST = ROOT / "output/pdf/PoliSpace_User_Manual_With_Screenshots.pdf"
SHOTS = ROOT / "tmp/pdfs/screenshots"

# Page number: image, width in points, top from page edge, caption.
FIGURES = {
    3: ("home.jpg", 380, 534, "Rajah 1: Laman utama PoliSpace dan akses tempahan."),
    4: ("login.jpg", 440, 481, "Rajah 2: Borang log masuk akaun pengguna."),
    5: ("booking-details.jpg", 440, 480, "Rajah 3: Butiran tarikh, masa dan tujuan tempahan."),
    7: ("user-dashboard.jpg", 380, 525, "Rajah 4: Dashboard pengguna dan pintasan tindakan."),
    9: ("admin-overview.jpg", 480, 486, "Rajah 5: Ringkasan operasi dalam portal pentadbir."),
    11: ("admin-facilities.jpg", 480, 494, "Rajah 6: Pengurusan fasiliti dan kawalan ketersediaan."),
    12: ("admin-reports.jpg", 440, 476, "Rajah 7: Penapis dan analitik laporan tempahan."),
    13: ("status-check.jpg", 330, 563, "Rajah 8: Semakan status menggunakan nombor rujukan."),
}


reader = PdfReader(str(SOURCE))
writer = PdfWriter()
assert len(reader.pages) == 13
for page_no, page in enumerate(reader.pages, 1):
    if page_no in FIGURES:
        name, width, top, caption = FIGURES[page_no]
        img_path = SHOTS / name
        with Image.open(img_path) as im:
            w, h = im.size
        height = width * h / w
        page_width = float(page.mediabox.width)
        page_height = float(page.mediabox.height)
        x = (page_width - width) / 2
        y = page_height - top - height
        assert y > 70, (page_no, y)

        packet = BytesIO()
        c = canvas.Canvas(packet, pagesize=(page_width, page_height))
        c.setFillColor(HexColor("#E8E5DF"))
        c.roundRect(x - 2, y - 2, width + 4, height + 4, 6, fill=1, stroke=0)
        c.drawImage(str(img_path), x, y, width=width, height=height, mask="auto")
        c.setFillColor(HexColor("#5F5B53"))
        c.setFont("Helvetica", 8.4)
        c.drawCentredString(page_width / 2, y - 15, caption)
        c.save()
        packet.seek(0)
        page.merge_page(PdfReader(packet).pages[0])
    writer.add_page(page)

writer.add_metadata({
    "/Title": "Panduan Pengguna PoliSpace - Edisi Bergambar",
    "/Author": "Muhammad Izzat Hanis bin ahmad; Amirul Asyraf bin ahmad nasharudin; Muhammad Aidil Afiq bin idil iskandar",
    "/Subject": "Panduan pengguna PoliSpace dengan tangkapan skrin laman diterbitkan",
})
with DEST.open("wb") as f:
    writer.write(f)
print(DEST)
