# -*- coding: utf-8 -*-
"""
Optik form v3 — geometri + PDF + referans görüntü üretici.
Tek doğruluk kaynağı: bu dosyadaki ölçüler -> geometri.json (okuyucu bunu kullanır) + optik_formu.pdf
Tüm ölçüler mm, orijin sol üst.
"""
import json
from pathlib import Path

KOK = Path(__file__).resolve().parent
UYGULAMA = KOK.parent   # depo kökü

SAYFA = (210.0, 297.0)
PX = 10
MARKER_BOY = 14.0
MARKERLAR = {0: (10.0, 10.0), 1: (186.0, 10.0), 2: (186.0, 273.0), 3: (10.0, 273.0)}

HARFLER = "ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"   # 29 Türkçe harf
AD_SUTUN, SOYAD_SUTUN = 13, 13
AD_X0, SOYAD_X0, ISIM_XARA = 17.3, 64.3, 3.5
ISIM_Y0, ISIM_YARA, ISIM_R = 40.0, 3.55, 1.42

NO_SUTUN, NO_X0, NO_XARA = 9, 113.0, 3.5      # 9 haneli öğrenci numarası
NO_Y0, NO_YARA, NO_R = 40.5, 4.3, 1.45
SAG_X0 = 145.5                                  # sağ panelin sol kenarı

CEVAP_R = 2.0
SORU = 80
SIKLAR = "ABCDE"
KOLON_X0, KOLON_W = 12.0, 37.2
SIK_X0, SIK_ARA = 10.0, 5.6
SATIR_Y0, SATIR_ARA, DORTLU_ARA = 155.5, 6.5, 2.2

KITAPCIK = "ABCD"
KITAPCIK_MERKEZ = {g: (152.5 + j * 11.0, 37.5) for j, g in enumerate(KITAPCIK)}
KITAPCIK_R = 2.0
ANAHTAR_MERKEZ, ANAHTAR_R = (190.0, 50.0), 2.2


def soru_merkez(q, k):
    c, i = divmod(q, 16)
    return (KOLON_X0 + c * KOLON_W + SIK_X0 + k * SIK_ARA,
            SATIR_Y0 + i * SATIR_ARA + (i // 4) * DORTLU_ARA)


def sabit_noktalar():
    s = [
        [28, 26.3, 48, 31.3],        # "ADI"
        [76, 26.3, 96, 31.3],        # "SOYADI"
        [115, 26.3, 139, 31.3],                    # "ÖĞRENCİ NO"
        [SAG_X0 - 1, 26.5, SAG_X0 + 23, 32.5],     # "KİTAPÇIK TÜRÜ"
        [SAG_X0 - 0.5, 44, SAG_X0 + 27, 53.5],     # "CEVAP ANAHTARI"
        [SAG_X0 - 0.5, 57, SAG_X0 + 23, 62.5],     # "SINIFI / ŞUBESİ"
        [SAG_X0 - 0.5, 73.5, SAG_X0 + 13, 79],     # "İMZA"
        [SAG_X0 + 1, 96, 197, 120],                # açıklamalar metni
        [111.5, 87, 142.5, 128],                   # işaretleme örnekleri
        [10.5, 38, 15.6, 62],        # satır harfleri (üst)
        [10.5, 70, 15.6, 100],       # satır harfleri (orta)
        [10.5, 108, 15.6, 141],      # satır harfleri (alt)
        [60, 265.5, 150, 272.5],     # alt bilgi metni
    ]
    for c in range(5):
        x0 = KOLON_X0 + c * KOLON_W
        s.append([x0 + 0.3, 145.6, x0 + 36.9, 152.3])   # kolon başlığı A B C D E
        s.append([x0 + 1.0, 154.0, x0 + 7.8, 205.0])    # soru numaraları (üst)
        s.append([x0 + 1.0, 205.0, x0 + 7.8, 262.5])    # soru numaraları (alt)
    return s


def geometri():
    ad = [[(AD_X0 + s * ISIM_XARA, ISIM_Y0 + h * ISIM_YARA) for h in range(len(HARFLER))] for s in range(AD_SUTUN)]
    soyad = [[(SOYAD_X0 + s * ISIM_XARA, ISIM_Y0 + h * ISIM_YARA) for h in range(len(HARFLER))] for s in range(SOYAD_SUTUN)]
    no = [[(NO_X0 + s * NO_XARA, NO_Y0 + d * NO_YARA) for d in range(10)] for s in range(NO_SUTUN)]
    cevap = [[soru_merkez(q, k) for k in range(5)] for q in range(SORU)]

    # Hizalama blokları: her blok kendi içinde yerel olarak hizalanır (kâğıt kıvrımı / baskı kayması için)
    bloklar = []
    for c in range(5):
        for g in range(4):
            qs = [c * 16 + g * 4 + i for i in range(4)]
            bloklar.append({"tur": "cevap", "r": CEVAP_R, "sorular": qs})
    satir_gruplari = [(0, 6), (6, 12), (12, 18), (18, 24), (24, 29)]
    sutun_gruplari = [(0, 5), (5, 9), (9, 13)]
    for alan in ("ad", "soyad"):
        for a, b in satir_gruplari:
            for c0, c1 in sutun_gruplari:
                bloklar.append({"tur": alan, "r": ISIM_R, "satirlar": [a, b], "sutunlar": [c0, c1]})
    for a, b in ((0, 5), (5, 10)):
        for c0, c1 in ((0, 5), (5, 9)):
            bloklar.append({"tur": "no", "r": NO_R, "satirlar": [a, b], "sutunlar": [c0, c1]})
    bloklar.append({"tur": "kitapcik", "r": KITAPCIK_R})

    return {
        "surum": 3,
        "sayfa": SAYFA, "px": PX,
        "markerBoy": MARKER_BOY, "markerlar": {str(k): v for k, v in MARKERLAR.items()},
        "harfler": HARFLER,
        "ad": {"r": ISIM_R, "merkez": ad},
        "soyad": {"r": ISIM_R, "merkez": soyad},
        "no": {"r": NO_R, "merkez": no},
        "cevap": {"r": CEVAP_R, "siklar": SIKLAR, "merkez": cevap},
        "kitapcik": {"r": KITAPCIK_R, "harfler": KITAPCIK, "merkez": [KITAPCIK_MERKEZ[g] for g in KITAPCIK]},
        "anahtar": {"r": ANAHTAR_R, "merkez": ANAHTAR_MERKEZ},
        "bloklar": bloklar,
        # Sabit noktalar: formun kendine özgü (tekrar etmeyen) basılı bölgeleri. Kâğıt kıvrımını ölçmek için
        # referans görüntüyle eşlenir; kabarcık bloklarının bir satır kaymasını imkânsız kılar.
        "sabitler": sabit_noktalar(),
        # öğretmen onay ekranında gösterilecek el yazısı şeritleri
        "kirp": {
            "adYazi": [AD_X0 - 2.0, 31.4, AD_X0 + (AD_SUTUN - 1) * ISIM_XARA + 2.0, 37.8],
            "soyadYazi": [SOYAD_X0 - 2.0, 31.4, SOYAD_X0 + (SOYAD_SUTUN - 1) * ISIM_XARA + 2.0, 37.8],
            "noYazi": [NO_X0 - 2.2, 31.4, NO_X0 + (NO_SUTUN - 1) * NO_XARA + 2.2, 37.8],
        },
    }


def pdf_uret(g, cikis):
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.pdfgen import canvas
    import cv2

    pdfmetrics.registerFont(TTFont("F", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    pdfmetrics.registerFont(TTFont("FB", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
    pdfmetrics.registerFont(TTFont("FC", "/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed.ttf"))
    W, H = SAYFA
    c = canvas.Canvas(str(cikis), pagesize=(W * mm, H * mm))
    c.setTitle("Optik Cevap Formu")
    Y = lambda y: (H - y) * mm  # noqa: E731
    X = lambda x: x * mm  # noqa: E731

    # köşe işaretleri (ArUco 4x4, id 0-3)
    sozluk = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    for mid, (mx, my) in MARKERLAR.items():
        bit = cv2.aruco.generateImageMarker(sozluk, mid, 6, borderBits=1)
        h = MARKER_BOY / 6
        c.setFillColorRGB(0, 0, 0)
        for r in range(6):
            for s in range(6):
                if bit[r, s] == 0:
                    c.rect(X(mx + s * h), Y(my + (r + 1) * h), h * mm + 0.2, h * mm + 0.2, stroke=0, fill=1)

    def yazi(x, y, t, f="F", s=7, hiza="sol"):
        c.setFont(f, s)
        {"sol": c.drawString, "orta": c.drawCentredString, "sag": c.drawRightString}[hiza](X(x), Y(y), t)

    def kutu(x0, y0, x1, y1, lw=0.8, rad=1.5):
        c.setLineWidth(lw)
        c.roundRect(X(x0), Y(y1), (x1 - x0) * mm, (y1 - y0) * mm, rad * mm, stroke=1, fill=0)

    def yuvarlak(x, y, r, harf=None, fs=4.5, dolu=False):
        c.setLineWidth(0.6)
        c.circle(X(x), Y(y), r * mm, stroke=1, fill=1 if dolu else 0)
        if harf:
            c.setFont("FC", fs)
            c.drawCentredString(X(x), Y(y) - fs * 0.36, harf)

    yazi(105, 16.5, "OPTİK CEVAP FORMU", "FB", 14, "orta")
    yazi(105, 22.5, "Yalnızca kurşun kalem kullanınız. Yuvarlakları taşırmadan ve tamamen doldurunuz.", "F", 7.5, "orta")

    # ---- AD / SOYAD
    for baslik, x0, sut in (("ADI", AD_X0, AD_SUTUN), ("SOYADI", SOYAD_X0, SOYAD_SUTUN)):
        kutu(x0 - 2.3, 27.5, x0 + (sut - 1) * ISIM_XARA + 2.3, 142.0)
        yazi(x0 + (sut - 1) * ISIM_XARA / 2, 30.6, baslik, "FB", 7, "orta")
        for s in range(sut):
            x = x0 + s * ISIM_XARA
            c.setLineWidth(0.4)
            c.rect(X(x - 1.6), Y(37.4), 3.2 * mm, 5.6 * mm, stroke=1, fill=0)
            for h, hrf in enumerate(HARFLER):
                yuvarlak(x, ISIM_Y0 + h * ISIM_YARA, ISIM_R, hrf, 3.7)
    # satır harfleri (sol kenar)
    for h, hrf in enumerate(HARFLER):
        yazi(13.2, ISIM_Y0 + h * ISIM_YARA + 1.0, hrf, "FB", 5.2, "orta")

    # ---- ÖĞRENCİ NO
    kutu(NO_X0 - 2.6, 27.5, NO_X0 + (NO_SUTUN - 1) * NO_XARA + 2.6, 84.0)
    yazi(NO_X0 + (NO_SUTUN - 1) * NO_XARA / 2, 30.6, "ÖĞRENCİ NO", "FB", 6.5, "orta")
    for s in range(NO_SUTUN):
        x = NO_X0 + s * NO_XARA
        c.setLineWidth(0.4)
        c.rect(X(x - 1.6), Y(37.4), 3.2 * mm, 5.6 * mm, stroke=1, fill=0)
        for d in range(10):
            yuvarlak(x, NO_Y0 + d * NO_YARA, NO_R, str(d), 4.0)

    # ---- işaretleme örneği (numara altında)
    kutu(NO_X0 - 2.6, 86.0, NO_X0 + (NO_SUTUN - 1) * NO_XARA + 2.6, 142.0)
    orta = NO_X0 + (NO_SUTUN - 1) * NO_XARA / 2
    yazi(orta, 90.5, "İŞARETLEME", "FB", 6.3, "orta")
    yazi(orta, 97, "DOĞRU", "FB", 6.3, "orta")
    yuvarlak(orta, 101.5, 2.0, dolu=True)
    yazi(orta, 110, "YANLIŞ", "FB", 6.3, "orta")
    for j, tur in enumerate(["tik", "carpi", "yarim", "nokta"]):
        x, y = orta + (-5.5 if j % 2 == 0 else 5.5), 116 + (j // 2) * 8
        yuvarlak(x, y, 2.0)
        c.setLineWidth(0.9)
        if tur == "tik":
            c.line(X(x - 1.1), Y(y), X(x - 0.3), Y(y + 1.0)); c.line(X(x - 0.3), Y(y + 1.0), X(x + 1.3), Y(y - 1.1))
        elif tur == "carpi":
            c.line(X(x - 1.2), Y(y - 1.2), X(x + 1.2), Y(y + 1.2)); c.line(X(x - 1.2), Y(y + 1.2), X(x + 1.2), Y(y - 1.2))
        elif tur == "yarim":
            p = c.beginPath(); p.moveTo(X(x), Y(y))
            p.arc(X(x) - 2 * mm, Y(y) - 2 * mm, X(x) + 2 * mm, Y(y) + 2 * mm, 90, 180)
            p.close(); c.drawPath(p, stroke=0, fill=1)
        else:
            c.circle(X(x), Y(y), 0.5 * mm, stroke=0, fill=1)

    # ---- sağ panel
    SX = SAG_X0
    kutu(SX, 27.5, 198, 42.5)
    yazi(SX + 2, 31, "KİTAPÇIK TÜRÜ", "FB", 6.5)
    for j, g in enumerate(KITAPCIK):
        yuvarlak(*KITAPCIK_MERKEZ[g], KITAPCIK_R, g, 5)
    kutu(SX, 44.5, 198, 55.5)
    yazi(SX + 2, 48.5, "CEVAP ANAHTARI", "FB", 6.5)
    yazi(SX + 2, 52.5, "(yalnızca öğretmen işaretler)", "F", 5)
    yuvarlak(*ANAHTAR_MERKEZ, ANAHTAR_R)
    kutu(SX, 57.5, 198, 72)
    yazi(SX + 2, 61, "SINIFI / ŞUBESİ", "FB", 6.5)
    kutu(SX, 74, 198, 92)
    yazi(SX + 2, 77.5, "İMZA", "FB", 6.5)
    kutu(SX, 94, 198, 142)
    yazi(SX + 2, 98, "AÇIKLAMALAR", "FB", 6.5)
    satirlar = [
        "• Adınızı ve soyadınızı üstteki kutulara",
        "  her kutuya bir harf gelecek şekilde",
        "  yazınız, altındaki harfi kodlayınız.",
        "• İki adınız varsa aralarında bir kutu",
        "  boş bırakınız.",
        "• 9 haneli numaranızı kutulara yazıp",
        "  altındaki rakamı kodlayınız.",
        "• Kitapçık türünüzü mutlaka kodlayınız.",
        "• Cevabınızı değiştirmek isterseniz",
        "  iz kalmayacak şekilde siliniz.",
        "• Kâğıdı katlamayınız; köşelerdeki kare",
        "  işaretlerin üzerine yazmayınız.",
    ]
    for i, s in enumerate(satirlar):
        yazi(SX + 2, 102.5 + i * 3.25, s, "F", 5.4)

    # ---- CEVAPLAR
    for kol in range(5):
        x0 = KOLON_X0 + kol * KOLON_W
        kutu(x0 + 0.5, 146.0, x0 + KOLON_W - 0.5, 263.5)
        for k, h in enumerate(SIKLAR):
            yazi(x0 + SIK_X0 + k * SIK_ARA, 150.8, h, "FB", 6.3, "orta")
        for i in range(16):
            q = kol * 16 + i
            _, y = soru_merkez(q, 0)
            yazi(x0 + 6.6, y + 1.05, str(q + 1), "FB", 7, "sag")
            for k, h in enumerate(SIKLAR):
                yuvarlak(soru_merkez(q, k)[0], y, CEVAP_R, h, 4.8)
            if i % 4 == 3 and i < 15:
                c.setLineWidth(0.3)
                c.setStrokeColorRGB(0.55, 0.55, 0.55)
                yy = y + SATIR_ARA / 2 + DORTLU_ARA / 2
                c.line(X(x0 + 2), Y(yy), X(x0 + KOLON_W - 2), Y(yy))
                c.setStrokeColorRGB(0, 0, 0)

    yazi(105, 268.3, "Okuturken dört köşedeki kare işaretlerin tamamı görünmelidir.", "F", 6.3, "orta")
    yazi(105, 271.6, "optik form v3", "F", 4.5, "orta")
    c.showPage()
    c.save()


if __name__ == "__main__":
    g = geometri()
    (UYGULAMA / "src" / "omr").mkdir(parents=True, exist_ok=True)
    (UYGULAMA / "src" / "omr" / "geometri.json").write_text(json.dumps(g, ensure_ascii=False))
    (UYGULAMA / "public").mkdir(parents=True, exist_ok=True)
    pdf_uret(g, UYGULAMA / "public" / "optik_formu.pdf")
    # referans (boş form) görüntüsü: 10 px/mm, gri — okuyucu sabit noktaları buradan keser
    import pymupdf, numpy as np, cv2
    pix = pymupdf.open(str(UYGULAMA / "public" / "optik_formu.pdf"))[0].get_pixmap(dpi=254, colorspace=pymupdf.csGRAY, alpha=False)
    img = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width)
    W, H = int(SAYFA[0] * PX), int(SAYFA[1] * PX)
    if img.shape != (H, W):
        img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(UYGULAMA / "src" / "omr" / "referans.png"), img, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    print("tamam")
