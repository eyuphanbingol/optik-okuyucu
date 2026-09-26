# Optik form v3 için sahte kâğıt üretici (ad/soyad/9 haneli numara kodlamalı) + fotoğraf/video/fotokopi simülasyonu
import json, math, os, shutil, sys
from pathlib import Path
import numpy as np
import cv2
import pymupdf

GEO = json.loads((Path(__file__).resolve().parent.parent / "src" / "omr" / "geometri.json").read_text())
PDF = Path(__file__).resolve().parent.parent / "public" / "optik_formu.pdf"
DPI = 200
S = DPI / 25.4

ADLAR = ["AYŞE", "MEHMET", "ZEYNEP", "ALİ", "ELİF", "CAN", "ECE", "ÖMER", "ŞEYMA", "İBRAHİM", "ÇAĞLA", "GÜL",
         "IŞIL", "UĞUR", "BÜŞRA", "YİĞİT", "HÜSEYİN", "FATMA", "EMRE", "SEDA", "DOĞA", "İREM", "ÖZGÜR", "ŞÜKRÜ",
         "MUHAMMED", "KÜBRA", "TUĞBA", "ÇİĞDEM", "IRMAK", "BERK"]
IKINCI = ["NUR", "ALİ", "EMİN", "SU", "CAN", "ZEHRA", "EFE"]
SOYADLAR = ["YILMAZ", "KAYA", "DEMİR", "ŞAHİN", "ÇELİK", "YILDIZ", "ÖZTÜRK", "AYDIN", "ÖZDEMİR", "ARSLAN",
            "DOĞAN", "KILIÇ", "ÇETİN", "KARA", "KOÇ", "KURT", "ÖZKAN", "ŞİMŞEK", "POLAT", "ÜNAL", "GÜNEŞ",
            "KARAMUSTAFAOĞLU", "İNCE", "IŞIK", "BOZKURT", "AKGÜL", "ERDOĞAN", "ÇAKIR", "GÜLER", "TÜRKMEN"]


def bos_form():
    d = pymupdf.open(str(PDF))
    p = d[0].get_pixmap(dpi=DPI, colorspace=pymupdf.csGRAY)
    return np.frombuffer(p.samples, np.uint8).reshape(p.height, p.width).copy()


KOPYA = {"olcek": 1.0, "ofs": (0.0, 0.0)}


def mm2px(x, y):
    return x * S * KOPYA["olcek"] + KOPYA["ofs"][0], y * S * KOPYA["olcek"] + KOPYA["ofs"][1]


def fotokopi_form(rng):
    g = bos_form()
    h, w = g.shape
    f = float(rng.uniform(0.93, 0.97))
    k = cv2.resize(g, None, fx=f, fy=f, interpolation=cv2.INTER_AREA)
    out = np.full_like(g, 255)
    y0, x0 = (h - k.shape[0]) // 2, (w - k.shape[1]) // 2
    out[y0:y0 + k.shape[0], x0:x0 + k.shape[1]] = k
    out = cv2.erode(out, np.ones((2, 2), np.uint8))
    out = cv2.GaussianBlur(out, (0, 0), 0.9)
    out = np.where(out > 200, int(rng.uniform(228, 242)), out * 0.8).astype(np.uint8)
    out[rng.random(out.shape) < 0.0004] = 40
    KOPYA["olcek"], KOPYA["ofs"] = f, (float(x0), float(y0))
    return out


def kalem(img, x_mm, y_mm, r_mm, rng, tur="tam", koyu=None):
    j = 0.18 * r_mm / 2.0
    cx, cy = mm2px(x_mm + rng.normal(0, j), y_mm + rng.normal(0, j))
    r = r_mm * S * KOPYA["olcek"]
    h, w = img.shape
    pad = int(r * 1.6) + 3
    x0, y0 = max(int(cx) - pad, 0), max(int(cy) - pad, 0)
    x1, y1 = min(int(cx) + pad, w), min(int(cy) + pad, h)
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    lc = (int(cx - x0), int(cy - y0))
    if tur == "tam":
        cv2.ellipse(m, lc, (int(r * rng.uniform(0.85, 1.12)), int(r * rng.uniform(0.8, 1.1))), rng.uniform(0, 180), 0, 360, 255, -1)
    elif tur == "kismi":
        cv2.ellipse(m, lc, (int(r * rng.uniform(0.7, 0.85)), int(r * rng.uniform(0.65, 0.85))), rng.uniform(0, 180), 0, 360, 255, -1)
    elif tur == "tasmis":
        cv2.ellipse(m, lc, (int(r * rng.uniform(1.1, 1.3)), int(r * rng.uniform(0.9, 1.12))), rng.uniform(-20, 20), 0, 360, 255, -1)
    elif tur == "nokta":
        cv2.circle(m, lc, max(int(r * 0.25), 1), 255, -1)
    if koyu is None:
        koyu = rng.uniform(35, 115)
    doku = koyu + rng.normal(0, 14, m.shape).astype(np.float32)
    for _ in range(5):
        a = rng.uniform(0, math.pi)
        p0 = (lc[0] + math.cos(a) * r * 1.2, lc[1] + math.sin(a) * r * 1.2)
        cv2.line(doku, (int(p0[0]), int(p0[1])), (int(2 * lc[0] - p0[0]), int(2 * lc[1] - p0[1])), float(koyu + rng.uniform(15, 45)), 1)
    bolge = img[y0:y1, x0:x1]
    sec = m > 0
    bolge[sec] = np.minimum(bolge[sec], np.clip(doku[sec], 0, 255)).astype(np.uint8)


def silgi(img, x_mm, y_mm, r_mm, rng):
    cx, cy = mm2px(x_mm, y_mm)
    r = r_mm * S * KOPYA["olcek"]
    h, w = img.shape
    pad = int(r * 1.5) + 3
    x0, y0, x1, y1 = max(int(cx) - pad, 0), max(int(cy) - pad, 0), min(int(cx) + pad, w), min(int(cy) + pad, h)
    m = np.zeros((y1 - y0, x1 - x0), np.uint8)
    cv2.ellipse(m, (int(cx - x0), int(cy - y0)), (int(r * rng.uniform(0.8, 1.2)), int(r * rng.uniform(0.7, 1.1))), rng.uniform(0, 180), 0, 360, 255, -1)
    ton = rng.uniform(185, 225)
    doku = ton + rng.normal(0, 8, m.shape)
    bolge = img[y0:y1, x0:x1]
    sec = m > 0
    bolge[sec] = np.minimum(bolge[sec], np.clip(doku[sec], 0, 255)).astype(np.uint8)


def isim_kodla(metin, sutun):
    """'AYŞE NUR' -> sütun listesi (harf indeksi ya da None). 13 sütuna sığmayan kısım kesilir."""
    s = metin[:sutun]
    return [None if ch == " " else GEO["harfler"].index(ch) for ch in s], s.strip()


def el_yazisi(img, x_mm, y_mm, metin, rng):
    for i, ch in enumerate(metin):
        if ch == " ":
            continue
        tr = ch.translate(str.maketrans("ÇĞİÖŞÜ", "CGIOSU"))
        px, py = mm2px(x_mm + i * 3.5 - 1.2, y_mm)
        cv2.putText(img, tr, (int(px), int(py)), cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    int(rng.uniform(40, 90)), 1, cv2.LINE_AA)


def kagit_uret(rng, zor=True, anahtar=None, kitapcik="A", anahtar_mi=False, soru_n=80, fotokopi=False):
    KOPYA["olcek"], KOPYA["ofs"] = 1.0, (0.0, 0.0)
    img = fotokopi_form(rng) if fotokopi else bos_form()
    g = GEO
    gercek = {"kitapcik": kitapcik}
    # --- ad/soyad/no
    if not anahtar_mi:
        ad = rng.choice(ADLAR)
        if rng.random() < 0.3:
            ad = ad + " " + rng.choice(IKINCI)
        soyad = rng.choice(SOYADLAR)
        NO_SUT = len(g["no"]["merkez"])
        nh = NO_SUT if rng.random() < 0.7 else int(rng.integers(1, NO_SUT))
        no = "".join(str(int(rng.integers(0, 10))) for _ in range(nh))
        if nh > 1 and no[0] == "0":
            no = str(int(rng.integers(1, 10))) + no[1:]
        ad_kod, ad_g = isim_kodla(ad, 13)
        soyad_kod, soyad_g = isim_kodla(soyad, 13)
        gercek.update({"ad": ad_g, "soyad": soyad_g, "no": no, "ad_zor": False, "soyad_zor": False, "no_zor": False})
        for alan, kod in (("ad", ad_kod), ("soyad", soyad_kod)):
            merkez = g[alan]["merkez"]
            r = g[alan]["r"]
            for s, h in enumerate(kod):
                if h is None:
                    continue
                t = rng.random()
                tur = "tam"
                if zor:
                    if t < 0.08: tur = "kismi"
                    elif t < 0.14: tur = "tasmis"
                kalem(img, *merkez[s][h], r, rng, tur)
                if zor and rng.random() < 0.03:   # yanlış harfi silip düzeltmiş
                    silgi(img, *merkez[s][(h + int(rng.integers(1, 5))) % 29], r, rng)
            if zor and rng.random() < 0.04 and len(kod) > 0:   # bir sütuna iki harf (uyarı beklenir)
                s = int(rng.integers(0, len(kod)))
                if kod[s] is not None:
                    kalem(img, *merkez[s][(kod[s] + 3) % 29], r, rng, "tam")
                    gercek[alan + "_zor"] = True
        # numara: sola ya da sağa yaslı
        sag = rng.random() < 0.4
        bas = NO_SUT - len(no) if sag else 0
        for i, d in enumerate(no):
            kalem(img, *g["no"]["merkez"][bas + i][int(d)], g["no"]["r"], rng, "tam")
        if zor and rng.random() < 0.03:
            s = bas + int(rng.integers(0, len(no)))
            kalem(img, *g["no"]["merkez"][s][(int(no[s - bas]) + 4) % 10], g["no"]["r"], rng, "tam")
            gercek["no_zor"] = True
        el_yazisi(img, g["ad"]["merkez"][0][0][0], 36.3, ad[:13], rng)
        el_yazisi(img, g["soyad"]["merkez"][0][0][0], 36.3, soyad[:13], rng)
    # --- kitapçık / anahtar
    if kitapcik:
        kalem(img, *g["kitapcik"]["merkez"]["ABCD".index(kitapcik)], g["kitapcik"]["r"], rng, "tam")
    if anahtar_mi:
        kalem(img, *g["anahtar"]["merkez"], g["anahtar"]["r"], rng, "tam")
    # --- cevaplar
    cevaplar = {}
    R = g["cevap"]["r"]
    for q in range(80):
        m = g["cevap"]["merkez"][q]
        if anahtar_mi:
            if q < soru_n:
                kalem(img, *m[anahtar[q]], R, rng, "tam")
                cevaplar[q] = {"tur": "tam", "k": anahtar[q]}
            continue
        dogru = anahtar.get(q, int(rng.integers(0, 5))) if anahtar else int(rng.integers(0, 5))
        r = rng.random()
        k = dogru if r < 0.62 else (int((dogru + rng.integers(1, 5)) % 5) if r < 0.84 else None)
        d = {"tur": "bos", "k": None}
        if k is not None:
            t = rng.random()
            tur = "tam"
            if zor:
                if t < 0.10: tur = "kismi"
                elif t < 0.18: tur = "tasmis"
                elif t < 0.22: tur = "hafif"
            d = {"tur": tur, "k": k}
        if zor:
            t = rng.random()
            if t < 0.03:
                a, b = rng.choice(5, 2, replace=False)
                d = {"tur": "cift", "k": (int(a), int(b))}
            elif t < 0.10:
                d["silgi"] = int(((d["k"] if d["k"] is not None else 0) + rng.integers(1, 5)) % 5)
            elif t < 0.12:
                nk = int(rng.integers(0, 5))
                if nk != d["k"]:
                    d["nokta"] = nk
        if d["tur"] in ("tam", "kismi", "tasmis", "hafif"):
            kalem(img, *m[d["k"]], R, rng, "tam" if d["tur"] == "hafif" else d["tur"],
                  koyu=rng.uniform(140, 165) if d["tur"] == "hafif" else None)
        elif d["tur"] == "cift":
            for kk in d["k"]:
                kalem(img, *m[kk], R, rng, "tam")
        if d.get("silgi") is not None:
            silgi(img, *m[d["silgi"]], R, rng)
        if d.get("nokta") is not None:
            kalem(img, *m[d["nokta"]], R, rng, "nokta")
        cevaplar[q] = d
    gercek["cevaplar"] = {str(q): v for q, v in cevaplar.items()}
    return img, gercek


def fotograf(gray, rng, mod):
    """mod: tarayici | telefon | whatsapp | video"""
    img = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR).astype(np.float32)
    h, w = gray.shape
    kesik = False
    fotograf.bukum = 0.0
    if mod == "tarayici":
        dpi = rng.choice([150, 200, 300])
        f = dpi / DPI
        M = cv2.getRotationMatrix2D((w / 2, h / 2), rng.uniform(-2, 2), 1.0)
        img = cv2.warpAffine(img, M, (w, h), borderValue=(255, 255, 255))
        img = cv2.resize(img, None, fx=f, fy=f, interpolation=cv2.INTER_AREA if f < 1 else cv2.INTER_LINEAR)
        if rng.random() < 0.3:
            img = np.rot90(img, 2).copy()
        img += rng.normal(0, 3, img.shape)
        q = 90
    else:
        A = rng.uniform(0, 12) if rng.random() < 0.7 else rng.uniform(12, 35)   # %30 güçlü kıvrım (4.4 mm'ye kadar)
        fotograf.bukum = float(A)
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        mapx = xx + A * 0.5 * np.sin(np.pi * yy / h * rng.uniform(0.8, 2))
        mapy = yy + A * np.sin(np.pi * xx / w)
        img = cv2.remap(img, mapx, mapy, cv2.INTER_LINEAR, borderValue=(255, 255, 255))
        if mod == "video":
            W, H = (1080, 1920) if rng.random() < 0.7 else (2160, 3840)   # 1080p ya da 4K kamera
            dol = rng.uniform(0.58, 0.72)   # dikey karede A4 en fazla ~%75 sığar
            aci = rng.choice([0, 0, 0, 180]) + rng.uniform(-6, 6)
            pj = 0.04
        else:
            uzun = rng.choice([1280, 1600]) if mod == "whatsapp" else rng.choice([1600, 2000, 3000, 4000])
            W, H = int(uzun * 3 / 4), uzun
            dol = rng.uniform(0.65, 0.9)
            aci = rng.choice([0, 0, 0, 90, 180, 270]) + rng.uniform(-12, 12)
            pj = 0.07
        ph = H * dol
        pw = ph * w / h
        if int(round(aci / 90)) % 2 == 1:
            sc = min(1, W / ph / 1.05)
            ph, pw = ph * sc, pw * sc
        merkez = np.array([W / 2 + rng.uniform(-0.04, 0.04) * W, H / 2 + rng.uniform(-0.04, 0.04) * H])
        kos = np.array([[-pw / 2, -ph / 2], [pw / 2, -ph / 2], [pw / 2, ph / 2], [-pw / 2, ph / 2]])
        t = math.radians(aci)
        R = np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])
        kos = kos @ R.T + merkez + rng.uniform(-pj, pj, (4, 2)) * pw
        Hm = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), kos.astype(np.float32))
        mk = np.float32([[(x + dx) * S, (y + dy) * S] for (x, y) in GEO["markerlar"].values() for dx in (-2, 16) for dy in (-2, 16)])
        pm = cv2.perspectiveTransform(mk.reshape(-1, 1, 2), Hm).reshape(-1, 2)
        kesik = bool(((pm < 2) | (pm > [W - 2, H - 2])).any())
        masa = np.array(rng.choice([[60, 80, 110], [40, 40, 40], [150, 160, 170], [90, 120, 150]]), np.float32)
        img = cv2.warpPerspective(img, Hm, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT, borderValue=masa.tolist())
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        a = rng.uniform(0, 2 * math.pi)
        isik = 1 - rng.uniform(0.1, 0.45) * ((np.cos(a) * xx / W + np.sin(a) * yy / H) % 1.0)
        isik *= 1 - rng.uniform(0, 0.25) * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2
        if rng.random() < 0.5:
            poly = np.array([[rng.uniform(0, W), 0], [rng.uniform(0, W), 0], [rng.uniform(0, W), H], [rng.uniform(0, W), H]], np.int32)
            gm = np.zeros((H, W), np.float32)
            cv2.fillConvexPoly(gm, poly, 1.0)
            gm = cv2.GaussianBlur(gm, (0, 0), rng.uniform(5, 40))
            isik *= 1 - rng.uniform(0.2, 0.4) * gm
        img *= isik[..., None]
        img *= rng.uniform(0.92, 1.08, 3)[None, None, :]
        if mod == "video":
            sig = rng.uniform(0.4, 1.1)
            img = cv2.GaussianBlur(img, (0, 0), sig)
            if rng.random() < 0.4:   # hafif titreme
                k = np.zeros((5, 5), np.float32); k[2, :] = 1 / 5
                M = cv2.getRotationMatrix2D((2, 2), rng.uniform(0, 180), 1)
                k = cv2.warpAffine(k, M, (5, 5)); k /= k.sum()
                img = cv2.filter2D(img, -1, k)
            img += rng.normal(0, rng.uniform(3, 7), img.shape)
            q = int(rng.uniform(70, 88))
        else:
            sig = rng.uniform(0, 1.6) * H / 3000
            if sig > 0.3:
                img = cv2.GaussianBlur(img, (0, 0), sig)
            img += rng.normal(0, rng.uniform(2, 7), img.shape)
            q = int(rng.uniform(50, 70)) if mod == "whatsapp" else int(rng.uniform(60, 90))
    img = np.clip(img, 0, 255).astype(np.uint8)
    ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
    return buf.tobytes(), kesik


def _is(arg):
    i, tohum, kok, anahtarlar, modlar, zor = arg
    rng = np.random.default_rng([tohum, i])
    kit = "A" if rng.random() < 0.6 else "B"
    kit_isaretli = rng.random() > 0.03
    fk = rng.random() < 0.2
    img, gercek = kagit_uret(rng, zor=zor, anahtar=anahtarlar[kit], kitapcik=kit if kit_isaretli else None, fotokopi=fk)
    gercek["kitapcik_gercek"] = kit
    gercek["fotokopi"] = bool(fk)
    mod = modlar[i % len(modlar)]
    while True:
        jpg, kesik = fotograf(img, rng, mod)
        if not kesik or rng.random() < 0.15:
            break
    ad = f"k{i:04d}_{mod}.jpg"
    (kok / "kagitlar" / ad).write_bytes(jpg)
    gercek["kesik"] = kesik
    gercek["mod"] = mod
    gercek["bukum"] = round(fotograf.bukum, 1)
    return ad, gercek


def uret(kok, n, tohum, modlar, zor=True, soru_n=(80, 60)):
    from multiprocessing import Pool
    kok = Path(kok)
    if kok.exists():
        shutil.rmtree(kok)
    (kok / "kagitlar").mkdir(parents=True)
    rng = np.random.default_rng(tohum)
    anahtarlar = {"A": {q: int(rng.integers(0, 5)) for q in range(soru_n[0])},
                  "B": {q: int(rng.integers(0, 5)) for q in range(soru_n[1])}}
    for kit, a in anahtarlar.items():
        img, _ = kagit_uret(rng, zor=False, anahtar=a, kitapcik=kit, anahtar_mi=True, soru_n=len(a))
        while True:
            jpg, kesik = fotograf(img, rng, "video")
            if not kesik:
                break
        (kok / "kagitlar" / f"anahtar_{kit}.jpg").write_bytes(jpg)
    with Pool() as p:
        sonuc = dict(p.map(_is, [(i, tohum, kok, anahtarlar, modlar, zor) for i in range(n)]))
    (kok / "gercek.json").write_text(json.dumps({"anahtarlar": {k: {str(q): v for q, v in a.items()} for k, a in anahtarlar.items()},
                                                 "kagitlar": sonuc}, ensure_ascii=False, default=int))


if __name__ == "__main__":
    kok, n, tohum = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    modlar = sys.argv[4].split(",") if len(sys.argv) > 4 else ["video", "telefon", "tarayici", "whatsapp"]
    zor = (sys.argv[5] != "kolay") if len(sys.argv) > 5 else True
    uret(kok, n, tohum, modlar, zor)
    print("üretildi:", n)
