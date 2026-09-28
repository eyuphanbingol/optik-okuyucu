# Sınav hazırla -> Yazdır -> optik formlar, gerçek okuyucu çekirdeğiyle doğrulanır.
#
#   Sınav (.sinav) üretilir ve uygulamaya içe aktarılır -> Yazdır penceresi: öğrenci sayısı kadar kâğıt + optik form
#   (kitapçık türü işaretli) + optikte işaretli cevap anahtarları -> tarayıcının PDF çıktısı -> 200 dpi görüntü
#   -> düz / tarayıcı / telefon / whatsapp / video bozulmaları -> src/omr/okuyucu.js (tarayıcıdakiyle aynı kod)
#
# Doğrulananlar:
#   - Anahtar formları: CEVAP ANAHTARI yuvarlağı, kitapçık türü ve N sorunun her biri, KÂĞITTA BASILI şık sırasıyla aynı
#     (beklenen anahtar PDF'teki soru metinlerinden çıkarılır; uygulamanın kendi hesabına güvenilmez).
#   - Öğrenci formları: kitapçık türü öğrencinin kâğıdının grubu; formda başka işaret yok.
#   - Öğrenci formları kurşun kalemle doldurulunca (sentetik): kitapçık, cevaplar ve puan birebir doğru.
#   - Hiçbir okumada sessiz hata yok (okunamayan fotoğraf "tekrar okut" der, yanlış sonuç vermez).
#
# Kullanım: npm run build && npx vite preview  ->  python3 arac/optik_baski_test.py [adres] [çıktı klasörü] [--hizli]
import json, re, subprocess, sys, tempfile, time
from pathlib import Path
import numpy as np
import cv2
from pypdf import PdfReader
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sentetik2 as S

KOK = Path(__file__).resolve().parent.parent
URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:4173/").split("#")[0]
CIKTI = Path(next((a for a in sys.argv[1:] if not a.startswith("http") and not a.startswith("--")), "") or tempfile.gettempdir() + "/optik-baski")
HIZLI = "--hizli" in sys.argv
HARF = "ABCDE"
GEO = S.GEO

# (soru, şık, grup, öğrenci, çift taraflı)
SENARYOLAR = [
    (80, 5, 4, 8, False),
    (40, 4, 4, 8, True),
    (25, 5, 3, 6, False),
    (12, 3, 2, 4, False),
    (17, 5, 1, 3, False),
    (1, 2, 2, 2, False),
]
if HIZLI:
    SENARYOLAR = SENARYOLAR[1:2] + SENARYOLAR[4:5]
MODLAR = ["duz", "tarayici", "telefon", "whatsapp", "video"]

hatalar = []
def kontrol(kosul, mesaj):
    print(("  ✔ " if kosul else "  ✘ ") + mesaj, flush=True)
    if not kosul:
        hatalar.append(mesaj)


def sinav_uret(N, K, G, tohum):
    rng = np.random.default_rng(tohum)
    dogru = [int(rng.integers(0, K)) for _ in range(N)]
    ogeler = []
    for i in range(N):
        ogeler.append({
            "id": f"q{i}", "tur": "coktan", "puan": round(100 / N, 4), "konu": "", "metin": f"Soru {i + 1} metni",
            "gorsel": None, "siklar": [{"id": f"q{i}s{j}", "metin": f"S{i + 1}-{'abcde'[j]}", "gorsel": None} for j in range(K)],
            "dogru": f"q{i}s{dogru[i]}", "sikKilit": False, "duzen": "alt",
        })
    ad = f"Optik Deneme {N}-{K}-{G}"
    sinav = {
        "id": f"x{tohum}", "surum": 1, "olusturma": 0, "guncelleme": 0,
        "baslik": {"okul": "Deneme Lisesi", "ogretimYili": "2026-2027", "ders": "Fen", "sinif": "9/A", "sinavAdi": ad,
                   "tarih": "", "sure": "", "ogretmen": "", "yonerge": ""},
        "ayar": {"grupSayisi": G, "soruKaristir": True, "sikKaristir": True, "tohum": int(tohum) * 7919 + 13, "karistirma": 2, "sutun": 1,
                 "yaziTipi": "modern", "yaziBoyutu": 11, "puanGoster": True, "ogrenciBilgisi": True, "puanTablosu": False,
                 "altBilgi": "Başarılar dilerim.", "sayfaNo": True, "sikDuzeni": "alt"},
        "ogeler": ogeler,
    }
    return {"tur": "optik-okuyucu-sinav", "surum": 1, "tarih": "2026-09-27T00:00:00Z", "sinav": sinav, "gorseller": {}}, ad, dogru


def kagittan_anahtar(metin, dogru, N):
    """Basılı kâğıdın metninden anahtar: şıkların basılış sırasına göre doğru şıkkın harfi (soru görünüş sırasıyla)"""
    siralar, son = [], None
    for harf, soru, sik in re.findall(r"([A-E])\)\s*S(\d+)-([a-e])", metin):
        q = int(soru) - 1
        if q != son:
            siralar.append((q, []))
            son = q
        siralar[-1][1].append((harf, "abcde".index(sik)))
    anahtar = []
    for q, siklar in siralar:
        harfler = [h for h, s in siklar if s == dogru[q]]
        anahtar.append(HARF.index(harfler[0]) if len(harfler) == 1 else None)
    return anahtar if len(anahtar) == N else None


def ogrenci_doldur(img, rng, N, K):
    """Basılı öğrenci formunu kurşun kalemle doldur (ad, soyad, numara, cevaplar). Kitapçık zaten basılı."""
    S.KOPYA["olcek"], S.KOPYA["ofs"] = 1.0, (0.0, 0.0)
    ad, soyad = str(rng.choice(S.ADLAR)), str(rng.choice(S.SOYADLAR))
    no = str(int(rng.integers(1, 10))) + "".join(str(int(rng.integers(0, 10))) for _ in range(int(rng.integers(3, 8))))
    for alan, metin in (("ad", ad), ("soyad", soyad)):
        kod, _ = S.isim_kodla(metin, 13)
        for s, h in enumerate(kod):
            if h is not None:
                S.kalem(img, *GEO[alan]["merkez"][s][h], GEO[alan]["r"], rng, "tam")
    for i, d in enumerate(no):
        S.kalem(img, *GEO["no"]["merkez"][i][int(d)], GEO["no"]["r"], rng, "tam")
    cevap = []
    for q in range(N):
        k = None if rng.random() < 0.12 else int(rng.integers(0, K))
        if k is not None:
            S.kalem(img, *GEO["cevap"]["merkez"][q][k], GEO["cevap"]["r"], rng, "tam")
        cevap.append(k)
    return {"ad": ad, "soyad": soyad, "no": no, "cevap": cevap}


def fotograf(duz, rng, mod):
    if mod == "duz":
        return cv2.imencode(".png", duz)[1].tobytes(), ".png"
    for _ in range(30):
        jpg, kesik = S.fotograf(duz, rng, mod)
        if not kesik:
            return jpg, ".jpg"
    raise RuntimeError("kesiksiz fotoğraf üretilemedi")


def okut(klasor, dosyalar):
    (klasor / "liste.json").write_text(json.dumps(dosyalar))
    subprocess.run(["node", str(KOK / "arac" / "optik_oku.mjs"), str(klasor)], check=True, cwd=KOK, capture_output=True)
    return json.loads((klasor / "sonuc.json").read_text())


def main():
    CIKTI.mkdir(parents=True, exist_ok=True)
    konsol = []
    toplam = {"okuma": 0, "red": 0, "sessiz": 0}
    with sync_playwright() as p:
        tarayici = p.chromium.launch()
        ctx = tarayici.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
        s = ctx.new_page()
        s.on("console", lambda m: konsol.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        s.on("pageerror", lambda e: konsol.append(f"pageerror: {e}"))

        for si, (N, K, G, OGR, CIFT) in enumerate(SENARYOLAR):
            print(f"\n== {N} soru · {K} şık · {G} grup · {OGR} öğrenci{' · çift taraflı' if CIFT else ''}", flush=True)
            d = CIKTI / f"s{si + 1}_{N}_{K}_{G}"
            d.mkdir(exist_ok=True)
            yedek, ad, dogru = sinav_uret(N, K, G, 1000 + si)
            (d / "sinav.sinav").write_text(json.dumps(yedek, ensure_ascii=False))

            # ---- içe aktar, önizlemeye git
            s.goto(URL + "#/sinav")
            s.wait_for_selector(".sh-liste-sayfa")
            s.locator("input[type=file][accept*='.sinav']").set_input_files(str(d / "sinav.sinav"))
            kart = s.locator(".sh-sinav-karti", has_text=ad)
            kart.first.wait_for(timeout=10000)
            sid = kart.first.locator("a.sh-kart-baglanti").get_attribute("href").split("#/sinav/")[1]
            s.goto(URL + f"#/sinav/{sid}/yazdir")
            s.wait_for_selector(".sh-sayfalar .bs-sayfa:not(.bs-yukleniyor)")

            # ---- yazdırma penceresi
            s.click(".sh-yazdir-dugme")
            s.wait_for_selector(".sh-yazdir-pencere")
            def anahtar(metin, deger):
                kutu = s.locator(f".sh-yazdir-pencere label.sh-anahtar:has-text('{metin}') input")
                if kutu.is_checked() != deger:
                    s.locator(f".sh-yazdir-pencere label.sh-anahtar:has-text('{metin}')").click()
                assert kutu.is_checked() == deger, metin
            s.locator(".sh-yazdir-pencere .sh-secici button:has-text('Öğrenci sayısı kadar')").click()
            ogr = s.locator(".sh-yazdir-pencere input[aria-label='Öğrenci sayısı']")
            ogr.fill(str(OGR)); ogr.press("Enter")
            anahtar("Sınav kâğıtları", True)
            anahtar("Her öğrenciye optik form", True)
            if G > 1:
                anahtar("Kitapçık türü işaretli olsun", True)
            anahtar("Optikte işaretli cevap anahtarları", True)
            anahtar("Cevap anahtarı", True)
            anahtar("Çift taraflı yazıcı", CIFT)
            s.wait_for_selector(".sh-yazdir-onay:not([disabled])", timeout=30000)
            ozet = s.locator(".sh-yazdir-ozet").inner_text()
            s.evaluate("() => { window.__yazdir = 0; window.print = () => { window.__yazdir++ } }")
            s.click(".sh-yazdir-onay")
            s.wait_for_function("() => window.__yazdir > 0", timeout=60000)
            sayfalar = s.evaluate("""() => Array.from(document.querySelectorAll('.bs-baski-alani .bs-sayfa')).map(e => ({
                optik: e.dataset.optik || null, kitapcik: e.dataset.kitapcik || null, grup: e.dataset.grup || null, sayfa: e.dataset.sayfa ? +e.dataset.sayfa : null,
                bos: !!e.dataset.bos, akan: !!e.closest('.akan'), kisi: e.dataset.kisi ? +e.dataset.kisi : null }))""")
            pdf = d / "baski.pdf"
            s.pdf(path=str(pdf), prefer_css_page_size=True)
            s.evaluate("() => window.dispatchEvent(new Event('afterprint'))")

            r = PdfReader(str(pdf))
            metinler = [pg.extract_text() or "" for pg in r.pages]
            sabit = [x for x in sayfalar if not x["akan"]]
            kontrol(len(r.pages) >= len(sabit) and len(sabit) >= 1, f"PDF {len(r.pages)} sayfa; pencere özeti: {ozet.strip()}")
            kontrol(all(abs(float(pg.mediabox.width) - 595.3) < 2 and abs(float(pg.mediabox.height) - 841.9) < 2 for pg in r.pages), "tüm sayfalar A4")
            n_optik = sum(1 for x in sabit if x["optik"] == "ogrenci")
            n_anahtar = sum(1 for x in sabit if x["optik"] == "anahtar")
            kontrol(n_optik == OGR, f"öğrenci sayısı kadar optik form: {n_optik}")
            kontrol(n_anahtar == G, f"her grup için işaretli anahtar formu: {n_anahtar}")
            # kâğıt kopyaları (her kopya 1. sayfasından başlar) ve öğrencilerin optik formları
            kopyalar = []            # [(grup, [sayfa indeksleri])]
            ogrenci_grubu = []       # [(kâğıt grubu, optik sayfa indeksi)]
            for i, x in enumerate(sabit):
                if x["grup"] and not x["optik"]:
                    if x["sayfa"] == 1:
                        kopyalar.append((x["grup"], []))
                    kopyalar[-1][1].append(i)
                elif x["optik"] == "ogrenci":
                    ogrenci_grubu.append((kopyalar[-1][0] if kopyalar and kopyalar[-1][1][-1] < i else None, i))
            kontrol(len(kopyalar) == OGR, f"öğrenci sayısı kadar sınav kâğıdı: {len(kopyalar)}")
            kontrol([g for g, _ in kopyalar] == [("ABCD"[k % G]) for k in range(OGR)], "gruplar sırayla dağıtılmış (A, B, C, …)")
            if CIFT:
                kontrol(all(i % 2 == 0 for _, s_ in kopyalar for i in s_[:1]) and all(i % 2 == 0 for _, i in ogrenci_grubu),
                        "çift taraflı: her kâğıt ve optik form yeni yaprakta başlıyor")

            # ---- her grubun beklenen anahtarı: basılı kâğıttan (uygulamanın kendi hesabı kullanılmaz)
            beklenen = {}
            for harf, sayfa_i in kopyalar:
                a_ = kagittan_anahtar("\n".join(metinler[i] for i in sayfa_i), dogru, N)
                if harf in beklenen and beklenen[harf] != a_:
                    kontrol(False, f"{harf} grubunun kopyaları birbirinden farklı")
                beklenen.setdefault(harf, a_)
            kontrol(len(beklenen) == G and all(v is not None for v in beklenen.values()), f"basılı kâğıtlardan {G} grubun anahtarı çıkarıldı")
            kontrol(all(((x["kitapcik"] or "") == (g if G > 1 else "")) for g, i in ogrenci_grubu for x in [sabit[i]]), "her optik form, hemen önündeki kâğıdın grubuyla işaretli")

            # ---- görüntüler
            rst = d / "raster"
            rst.mkdir(exist_ok=True)
            hedef = [i for i, x in enumerate(sabit) if x["optik"]]
            for i in hedef:
                subprocess.run(["pdftoppm", "-r", "200", "-gray", "-png", "-f", str(i + 1), "-l", str(i + 1), "-singlefile", str(pdf), str(rst / f"s{i + 1:03d}")], check=True)
            rng = np.random.default_rng(77 + si)
            okuma = d / "okuma"
            okuma.mkdir(exist_ok=True)
            beklenti = {}
            dosyalar = []
            for i in hedef:
                x = sabit[i]
                duz = cv2.imread(str(rst / f"s{i + 1:03d}.png"), cv2.IMREAD_GRAYSCALE)
                assert abs(duz.shape[0] - 2339) <= 2 and abs(duz.shape[1] - 1654) <= 2, duz.shape
                if x["optik"] == "anahtar":
                    harf = x["kitapcik"]
                    b = {"tur": "anahtar", "kitapcik": harf, "cevap": beklenen[harf]}
                    cesit = [("", duz, b)]
                else:
                    grup = next(g for g, j in ogrenci_grubu if j == i)
                    b = {"tur": "bos", "kitapcik": grup if G > 1 else None, "cevap": [None] * N}
                    dolu = duz.copy()
                    ogr_bilgi = ogrenci_doldur(dolu, rng, N, K)
                    bd = {"tur": "ogrenci", "kitapcik": grup if G > 1 else None, "cevap": ogr_bilgi["cevap"], "grup": grup,
                          "ad": ogr_bilgi["ad"], "soyad": ogr_bilgi["soyad"], "no": ogr_bilgi["no"]}
                    cesit = [("", duz, b), ("d", dolu, bd)]
                for ek, img, b in cesit:
                    for mod in MODLAR:
                        veri, uz = fotograf(img, rng, mod)
                        ad_ = f"s{i + 1:03d}{ek}_{mod}{uz}"
                        (okuma / ad_).write_bytes(veri)
                        dosyalar.append(ad_)
                        beklenti[ad_] = {**b, "mod": mod}
            t0 = time.time()
            sonuc = okut(okuma, dosyalar)
            print(f"  {len(dosyalar)} görüntü okundu ({time.time() - t0:.0f} sn)", flush=True)

            red = {}
            sessiz = []
            for ad_, b in beklenti.items():
                r_ = sonuc[ad_]
                toplam["okuma"] += 1
                if not r_["tamam"]:
                    red.setdefault(b["mod"], []).append(ad_)
                    toplam["red"] += 1
                    continue
                sorun = []
                if r_["kitapcik"] != b["kitapcik"] or r_["kitapcikCift"]:
                    sorun.append(f"kitapçık {r_['kitapcik']} (beklenen {b['kitapcik']})")
                if r_["kitapcikNot"]:
                    sorun.append(f"kitapçık notu: {r_['kitapcikNot']}")
                beklenen_anahtar = "evet" if b["tur"] == "anahtar" else "hayir"
                if r_["anahtar"] != beklenen_anahtar:
                    sorun.append(f"anahtar yuvarlağı {r_['anahtar']}")
                okunan = r_["cevaplar"][:N]
                if okunan != b["cevap"]:
                    farklar = [q + 1 for q in range(N) if okunan[q] != b["cevap"][q]]
                    sorun.append(f"cevap farkı: {farklar[:8]}")
                if any(c is not None for c in r_["cevaplar"][N:]):
                    sorun.append("N'den sonra işaret var")
                if b["tur"] == "ogrenci":
                    if (r_["ad"], r_["soyad"], r_["no"]) != (b["ad"], b["soyad"], b["no"]):
                        sorun.append(f"kimlik {r_['ad']} {r_['soyad']} {r_['no']}")
                    # puan: optik okuyucunun hesabı (eşit puan, 100/N) = kâğıttaki puan
                    a = beklenen[b["grup"]]
                    dg = sum(1 for q in range(N) if okunan[q] is not None and okunan[q] == a[q])
                    bek = sum(1 for q in range(N) if b["cevap"][q] is not None and b["cevap"][q] == a[q])
                    if dg != bek:
                        sorun.append(f"doğru sayısı {dg} (beklenen {bek})")
                if r_["notlar"] and b["mod"] in ("duz", "tarayici"):
                    sorun.append(f"uyarı: {r_['notlar'][:3]}")
                if sorun:
                    if r_["notlar"] and b["mod"] not in ("duz", "tarayici") and all("cevap farkı" in x for x in sorun):
                        # okuyucu şüpheli işareti öğretmene soruyor (sessiz değil)
                        continue
                    sessiz.append((ad_, sorun))
            toplam["sessiz"] += len(sessiz)
            for ad_, sorun in sessiz[:10]:
                print("    !!", ad_, sorun)
            red_ozet = {m: len(v) for m, v in red.items()}
            kontrol(not red.get("duz") and not red.get("tarayici"), f"düz ve tarayıcı görüntülerinin hepsi okundu (okunamayan: {red_ozet or 'yok'})")
            kontrol(not sessiz, f"sessiz hata yok ({len(beklenti) - sum(red_ozet.values())} okuma karşılaştırıldı)")
            n_anahtar_okunan = sum(1 for a_, b in beklenti.items() if b["tur"] == "anahtar" and sonuc[a_]["tamam"])
            kontrol(n_anahtar_okunan >= G * (len(MODLAR) - 2), f"işaretli anahtar formları okundu ({n_anahtar_okunan}/{G * len(MODLAR)})")

        tarayici.close()

    print(f"\nToplam {toplam['okuma']} okuma · okunamayan (tekrar okut) {toplam['red']} · sessiz hata {toplam['sessiz']}")
    kontrol(not konsol, "tarayıcı konsolunda hata yok" + ("" if not konsol else ": " + " | ".join(konsol[:4])))
    print(f"Çıktılar: {CIKTI}")
    print("SONUÇ:", "BAŞARILI" if not hatalar else f"{len(hatalar)} HATA")
    return 1 if hatalar else 0


if __name__ == "__main__":
    sys.exit(main())
