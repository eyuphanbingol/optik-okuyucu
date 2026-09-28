# Sınıf listesinden isimli optik form: liste yükle -> Yazdır -> PDF -> optik okuyucu (src/omr/okuyucu.js).
#
#   e-Okul benzeri bir liste (üstte okul bilgisi, "Öğrenci No / Adı / Soyadı", Türkçe Windows CSV ve .xlsx) yüklenir,
#   her öğrenciye kâğıt + adı, soyadı, numarası ve kitapçık türü hazır işaretli optik form basılır.
#
# Doğrulananlar:
#   - Listedeki her öğrenci için sırayla kâğıt ve optik form (gruplar A, B, C, A …), kâğıtta öğrencinin adı ve numarası.
#   - Okuyucu, basılı formu (öğrenci hiçbir şey doldurmadan da, cevapları doldurunca da) düz / tarayıcı / telefon / whatsapp /
#     video görüntülerinden okuyunca adı, soyadı, numarayı ve kitapçık türünü BİREBİR listedeki gibi okur (Türkçe harfler,
#     iki kelimeli ad ve soyad, formdan uzun ad, formda olmayan harf, 9 haneden uzun / boş numara, baştaki sıfırlar).
#   - Cevaplar ve doğru sayısı birebir; hiçbir okumada sessiz hata yok.
#
# Kullanım: npm run build && npx vite preview  ->  python3 arac/sinif_listesi_test.py [adres] [çıktı klasörü]
import json, subprocess, sys, tempfile, time
from pathlib import Path
import numpy as np
import cv2
from pypdf import PdfReader
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sentetik2 as S
from optik_baski_test import sinav_uret, kagittan_anahtar, fotograf, okut, MODLAR

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:4173/").split("#")[0]
CIKTI = Path(next((a for a in sys.argv[1:] if not a.startswith("http") and not a.startswith("--")), "") or tempfile.gettempdir() + "/sinif-listesi")
GEO = S.GEO

# (listedeki no, ad, soyad) -> formda beklenen (ad, soyad, no). Beklenenler elle yazıldı (uygulamanın hesabına güvenilmez).
LISTE = [
    (("1234", "Ayşe Nur", "Yılmaz"), ("AYŞE NUR", "YILMAZ", "1234")),
    (("45", "ismail", "çelik"), ("İSMAİL", "ÇELİK", "45")),
    (("123456789", "Muhammed Mustafa", "Karaosmanoğlu"), ("MUHAMMED MUST", "KARAOSMANOĞLU", "123456789")),
    (("77", "Edward", "Wilson"), ("EDVARD", "VİLSON", "77")),
    (("1234567890", "Gülşah", "Öztürk"), ("GÜLŞAH", "ÖZTÜRK", "")),
    (("9", "Can", "Işık"), ("CAN", "IŞIK", "9")),
    (("000123", "Zeynep Ece", "Ünal"), ("ZEYNEP ECE", "ÜNAL", "000123")),
    (("", "Çağla", "Doğan"), ("ÇAĞLA", "DOĞAN", "")),
    (("2026001", "Şükrü Can", "Ağaoğlu Er"), ("ŞÜKRÜ CAN", "AĞAOĞLU ER", "2026001")),
    (("31", "Mehmet Emin", "Yıldırımoğulları"), ("MEHMET EMİN", "YILDIRIMOĞULL", "31")),
    (("88", "Ayşe Gül Nur Fatma", "Karaosmanoğlu Yıldırım"), ("AYŞE GÜL NUR", "KARAOSMANOĞLU", "88")),
]
SENARYOLAR = [
    # (soru, şık, grup, dosya türü)
    (30, 5, 3, "csv"),
    (20, 4, 1, "xlsx"),
]

hatalar = []
def kontrol(kosul, mesaj):
    print(("  ✔ " if kosul else "  ✘ ") + mesaj, flush=True)
    if not kosul:
        hatalar.append(mesaj)


def liste_dosyasi(d, tur):
    ust = [["T.C. MİLLÎ EĞİTİM BAKANLIĞI"], ["DENEME ANADOLU LİSESİ 9. Sınıf / A Şubesi Sınıf Listesi"], []]
    baslik = ["S.No", "Öğrenci No", "Adı", "Soyadı", "Cinsiyeti", "Sınıfı"]
    satirlar = [[str(i + 1), no, ad, soyad, "K" if i % 2 else "E", "9/A"] for i, ((no, ad, soyad), _) in enumerate(LISTE)]
    if tur == "csv":
        yol = d / "sinif_listesi.csv"
        metin = "\r\n".join(";".join(r) for r in ust + [baslik] + satirlar)
        yol.write_bytes(metin.encode("cp1254"))           # Excel'in Türkçe Windows'ta kaydettiği CSV
    else:
        import openpyxl
        wb = openpyxl.Workbook()
        ws = wb.active
        for r in ust + [baslik]:
            ws.append(r)
        for r in satirlar:
            # numaralar Excel'de sayı olarak (baştaki sıfır ve uzun numara metin kalır)
            no = int(r[1]) if r[1] and not r[1].startswith("0") and len(r[1]) < 10 else r[1]
            ws.append([int(r[0]), no, *r[2:]])
        yol = d / "sinif_listesi.xlsx"
        wb.save(yol)
    return yol


def cevap_doldur(img, rng, N, K):
    S.KOPYA["olcek"], S.KOPYA["ofs"] = 1.0, (0.0, 0.0)
    cevap = []
    for q in range(N):
        k = None if rng.random() < 0.12 else int(rng.integers(0, K))
        if k is not None:
            S.kalem(img, *GEO["cevap"]["merkez"][q][k], GEO["cevap"]["r"], rng, "tam")
        cevap.append(k)
    return cevap


def main():
    CIKTI.mkdir(parents=True, exist_ok=True)
    konsol = []
    toplam = {"okuma": 0, "red": 0, "sessiz": 0}
    with sync_playwright() as p:
        tarayici = p.chromium.launch()
        ctx = tarayici.new_context(viewport={"width": 1440, "height": 900})
        s = ctx.new_page()
        s.on("console", lambda m: konsol.append(f"{m.type}: {m.text}") if m.type == "error" else None)
        s.on("pageerror", lambda e: konsol.append(f"pageerror: {e}"))

        for si, (N, K, G, TUR) in enumerate(SENARYOLAR):
            OGR = len(LISTE)
            print(f"\n== {N} soru · {K} şık · {G} grup · {OGR} öğrencilik liste ({TUR})", flush=True)
            d = CIKTI / f"l{si + 1}_{N}_{G}_{TUR}"
            d.mkdir(exist_ok=True)
            yedek, ad, dogru = sinav_uret(N, K, G, 3000 + si)
            (d / "sinav.sinav").write_text(json.dumps(yedek, ensure_ascii=False))
            dosya = liste_dosyasi(d, TUR)

            s.goto(URL + "#/sinav")
            s.wait_for_selector(".sh-liste-sayfa")
            s.locator("input[type=file][accept*='.sinav']").set_input_files(str(d / "sinav.sinav"))
            kart = s.locator(".sh-sinav-karti", has_text=ad)
            kart.first.wait_for(timeout=10000)
            sid = kart.first.locator("a.sh-kart-baglanti").get_attribute("href").split("#/sinav/")[1]
            s.goto(URL + f"#/sinav/{sid}/yazdir")
            s.wait_for_selector(".sh-sayfalar .bs-sayfa:not(.bs-yukleniyor)")

            s.click(".sh-yazdir-dugme")
            s.wait_for_selector(".sh-yazdir-pencere")
            s.locator(".sh-yazdir-pencere .sh-secici button:has-text('Sınıf listesinden')").click()
            kontrol("Önce sınıf listesini yükleyin" in s.locator(".sh-yazdir-ozet").inner_text() or not s.locator(".sh-yazdir-onay").is_enabled(),
                    "liste yüklenmeden yazdırılamıyor")
            s.locator(".sh-liste-yukle input[type=file]").set_input_files(str(dosya))
            s.wait_for_selector(".sh-liste-yuklu", timeout=15000)
            ozet_liste = s.locator(".sh-liste-ozet").inner_text()
            kontrol(f"{OGR} öğrenci" in ozet_liste, f"liste okundu: {ozet_liste.split(chr(10))[0]}")
            ilk = s.locator(".sh-liste-tablo tbody tr").first.inner_text()
            kontrol("AYŞE NUR YILMAZ" in ilk and "1234" in ilk, f"önizlemede ilk öğrenci: {ilk.strip()!r}")
            uyari = s.locator(".sh-liste-uyari")
            kontrol(uyari.count() == 1 and "5 öğrencinin" in uyari.inner_text(), "forma sığmayan bilgiler uyarıldı (uzun ad/soyad, W, 10 haneli numara)")
            s.screenshot(path=str(d / "pencere.png"))

            def anahtar(metin, deger):
                kutu = s.locator(f".sh-yazdir-pencere label.sh-anahtar:has-text('{metin}') input")
                if kutu.is_checked() != deger:
                    s.locator(f".sh-yazdir-pencere label.sh-anahtar:has-text('{metin}')").click()
                assert kutu.is_checked() == deger, metin
            anahtar("Sınav kâğıtları", True)
            anahtar("Her öğrenciye optik form", True)
            if G > 1:
                anahtar("Kitapçık türü işaretli olsun", True)
            anahtar("Optikte işaretli cevap anahtarları", False)
            anahtar("Cevap anahtarı", False)
            anahtar("Çift taraflı yazıcı", False)
            s.wait_for_selector(".sh-yazdir-onay:not([disabled])", timeout=30000)
            ozet = s.locator(".sh-yazdir-ozet").inner_text()
            s.evaluate("() => { window.__yazdir = 0; window.print = () => { window.__yazdir++ } }")
            s.click(".sh-yazdir-onay")
            s.wait_for_function("() => window.__yazdir > 0", timeout=60000)
            sayfalar = s.evaluate("""() => Array.from(document.querySelectorAll('.bs-baski-alani .bs-sayfa')).map(e => ({
                optik: e.dataset.optik || null, kitapcik: e.dataset.kitapcik || null, grup: e.dataset.grup || null, sayfa: e.dataset.sayfa ? +e.dataset.sayfa : null,
                akan: !!e.closest('.akan') }))""")
            pdf = d / "baski.pdf"
            s.pdf(path=str(pdf), prefer_css_page_size=True)
            s.evaluate("() => window.dispatchEvent(new Event('afterprint'))")

            r = PdfReader(str(pdf))
            metinler = [pg.extract_text() or "" for pg in r.pages]
            sabit = [x for x in sayfalar if not x["akan"]]
            kontrol(len(r.pages) == len(sabit), f"PDF {len(r.pages)} sayfa; özet: {ozet.strip()}")
            kopyalar, optikler = [], []
            for i, x in enumerate(sabit):
                if x["grup"] and not x["optik"]:
                    if x["sayfa"] == 1:
                        kopyalar.append((x["grup"], []))
                    kopyalar[-1][1].append(i)
                elif x["optik"] == "ogrenci":
                    optikler.append((kopyalar[-1][0], i, len(kopyalar) - 1))
            kontrol(len(kopyalar) == OGR and len(optikler) == OGR, f"listedeki her öğrenciye kâğıt ve optik form: {len(kopyalar)} / {len(optikler)}")
            kontrol([g for g, _ in kopyalar] == ["ABCD"[k % G] for k in range(OGR)], "gruplar listede sırayla (A, B, C, A …)")
            kontrol(all(jj == j for j, (_, _, jj) in enumerate(optikler)) and all(optikler[j][1] == kopyalar[j][1][-1] + 1 for j in range(OGR)),
                    "her optik form öğrencinin kâğıdının hemen arkasında")
            # kâğıtta öğrencinin adı soyadı ve numarası
            yazili = []
            for j, (g, sayfa_i) in enumerate(kopyalar):
                (no, a_, sa_), _ = LISTE[j]
                ilk_sayfa = "".join(metinler[sayfa_i[0]].split())       # PDF metninde Türkçe harflerin arasına boşluk girebiliyor
                beklenen_ad = " ".join([S_ for S_ in [a_.replace("i", "İ").replace("ı", "I").upper(), sa_.replace("i", "İ").replace("ı", "I").upper()]])
                if "".join(beklenen_ad.split()) not in ilk_sayfa or (no and f"Numarası{no}" not in ilk_sayfa):
                    yazili.append((j, beklenen_ad, no))
            kontrol(not yazili, "her kâğıdın başlığında öğrencinin adı soyadı ve numarası" + (f": eksik {yazili[:3]}" if yazili else ""))

            beklenen = {}
            for harf, sayfa_i in kopyalar:
                beklenen.setdefault(harf, kagittan_anahtar("\n".join(metinler[i] for i in sayfa_i), dogru, N))
            kontrol(all(v is not None for v in beklenen.values()), "basılı kâğıtlardan grup anahtarları çıkarıldı")

            rst = d / "raster"
            rst.mkdir(exist_ok=True)
            okuma = d / "okuma"
            okuma.mkdir(exist_ok=True)
            rng = np.random.default_rng(500 + si)
            beklenti, dosyalar = {}, []
            for grup, i, j in optikler:
                subprocess.run(["pdftoppm", "-r", "200", "-gray", "-png", "-f", str(i + 1), "-l", str(i + 1), "-singlefile", str(pdf), str(rst / f"s{i + 1:03d}")], check=True)
                duz = cv2.imread(str(rst / f"s{i + 1:03d}.png"), cv2.IMREAD_GRAYSCALE)
                _, (ead, esoyad, eno) = LISTE[j]
                temel = {"kitapcik": grup if G > 1 else None, "ad": ead, "soyad": esoyad, "no": eno, "grup": grup}
                dolu = duz.copy()
                cevap = cevap_doldur(dolu, rng, N, K)
                for ek, img, b in (("", duz, {**temel, "cevap": [None] * N}), ("d", dolu, {**temel, "cevap": cevap})):
                    for mod in MODLAR:
                        veri, uz = fotograf(img, rng, mod)
                        ad_ = f"s{i + 1:03d}{ek}_{mod}{uz}"
                        (okuma / ad_).write_bytes(veri)
                        dosyalar.append(ad_)
                        beklenti[ad_] = {**b, "mod": mod}
            t0 = time.time()
            sonuc = okut(okuma, dosyalar)
            print(f"  {len(dosyalar)} görüntü okundu ({time.time() - t0:.0f} sn)", flush=True)

            red, sessiz, kimlik_dogru = {}, [], 0
            for ad_, b in beklenti.items():
                r_ = sonuc[ad_]
                toplam["okuma"] += 1
                if not r_["tamam"]:
                    red.setdefault(b["mod"], []).append(ad_)
                    toplam["red"] += 1
                    continue
                sorun = []
                if (r_["ad"], r_["soyad"], r_["no"]) != (b["ad"], b["soyad"], b["no"]):
                    sorun.append(f"kimlik {r_['ad']!r} {r_['soyad']!r} {r_['no']!r} (beklenen {b['ad']!r} {b['soyad']!r} {b['no']!r})")
                elif not r_["adSupheli"] and not r_["noSupheli"]:
                    kimlik_dogru += 1
                if r_["adSupheli"] or r_["noSupheli"]:
                    if b["mod"] in ("duz", "tarayici"):
                        sorun.append("kimlik şüpheli işaretlendi")
                if r_["kitapcik"] != b["kitapcik"] or r_["kitapcikCift"] or r_["kitapcikNot"]:
                    uyarili = bool(r_["kitapcikNot"] or r_["kitapcikCift"])
                    # telefon/video görüntüsünde okuyucu kitapçığı öğretmene soruyorsa sessiz hata değildir
                    if not (uyarili and b["mod"] not in ("duz", "tarayici") and r_["kitapcik"] in (None, b["kitapcik"])):
                        sorun.append(f"kitapçık {r_['kitapcik']} (beklenen {b['kitapcik']}) {r_['kitapcikNot'] or ''}")
                if r_["anahtar"] != "hayir":
                    sorun.append(f"anahtar yuvarlağı {r_['anahtar']}")
                okunan = r_["cevaplar"][:N]
                if okunan != b["cevap"]:
                    sorun.append(f"cevap farkı: {[q + 1 for q in range(N) if okunan[q] != b['cevap'][q]][:8]}")
                if any(c is not None for c in r_["cevaplar"][N:]):
                    sorun.append("N'den sonra işaret var")
                if r_["notlar"] and b["mod"] in ("duz", "tarayici"):
                    sorun.append(f"uyarı: {r_['notlar'][:3]}")
                if sorun:
                    if r_["notlar"] and b["mod"] not in ("duz", "tarayici") and all("cevap farkı" in x for x in sorun):
                        continue       # okuyucu şüpheli cevabı öğretmene soruyor (sessiz değil)
                    sessiz.append((ad_, sorun))
            toplam["sessiz"] += len(sessiz)
            for ad_, sorun in sessiz[:10]:
                print("    !!", ad_, sorun)
            red_ozet = {m: len(v) for m, v in red.items()}
            kontrol(not red.get("duz") and not red.get("tarayici"), f"düz ve tarayıcı görüntülerinin hepsi okundu (okunamayan: {red_ozet or 'yok'})")
            kontrol(not sessiz, f"sessiz hata yok; ad, soyad, numara, kitapçık ve cevaplar birebir ({len(beklenti) - sum(red_ozet.values())} okuma, {kimlik_dogru} kimlik uyarısız doğru)")

            # liste sınavla birlikte saklanır: pencere yeniden açılınca hazır
            s.goto(URL + f"#/sinav/{sid}/yazdir")
            s.wait_for_selector(".sh-sayfalar .bs-sayfa:not(.bs-yukleniyor)")
            s.click(".sh-yazdir-dugme")
            s.wait_for_selector(".sh-yazdir-pencere")
            kontrol(s.locator(".sh-liste-ozet").count() == 1 and f"{OGR} öğrenci" in s.locator(".sh-liste-ozet").inner_text(), "liste sınavla saklandı (pencere yeniden açılınca hazır)")
            s.keyboard.press("Escape")

        tarayici.close()

    print(f"\nToplam {toplam['okuma']} okuma · okunamayan (tekrar okut) {toplam['red']} · sessiz hata {toplam['sessiz']}")
    kontrol(not konsol, "tarayıcı konsolunda hata yok" + ("" if not konsol else ": " + " | ".join(konsol[:4])))
    print(f"Çıktılar: {CIKTI}")
    print("SONUÇ:", "BAŞARILI" if not hatalar else f"{len(hatalar)} HATA")
    return 1 if hatalar else 0


if __name__ == "__main__":
    sys.exit(main())
