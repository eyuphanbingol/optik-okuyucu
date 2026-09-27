# Uçtan uca: Sınav hazırla -> yazdır (kitapçığı işaretli öğrenci optik formları + optikte işaretli cevap anahtarları)
#   -> kâğıtlar kameraya gösterilir (sahte kamera videosu) -> Optik Okuyucu anahtarları kamerayla okur
#   -> öğrenci formları (kurşun kalemle doldurulmuş) kamerayla okunur -> puanlar ve Excel birebir doğru
#   -> aynı sınav "Optik okuyucuya aktar" ile de aktarılır: kameradan okunan anahtarlarla birebir aynı olmalı.
#
# Kullanım: npm run build && npx vite preview  ->  python3 arac/e2e_optik_baski_kamera.py [adres] [çıktı klasörü]
import json, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path
import numpy as np
import cv2
import openpyxl
from pypdf import PdfReader
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sentetik2 as S
from optik_baski_test import sinav_uret, kagittan_anahtar, ogrenci_doldur   # noqa: E402  (aynı yardımcılar)

URL = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:4173/").split("#")[0]
CIKTI = Path(next((a for a in sys.argv[1:] if not a.startswith("http") and not a.startswith("--")), tempfile.mkdtemp(prefix="optik-kamera-")))
CIKTI.mkdir(parents=True, exist_ok=True)
N, K, G, OGR = 30, 5, 3, 6
HARF = "ABCDE"
FPS = 30

hatalar = []
def kontrol(kosul, mesaj):
    print(("  ✔ " if kosul else "  ✘ ") + mesaj, flush=True)
    if not kosul:
        hatalar.append(mesaj)


def tr_baslik(s):
    out = []
    for k in s.replace("I", "ı").replace("İ", "i").lower().split():
        ilk = k[0]
        out.append(("İ" if ilk == "i" else "I" if ilk == "ı" else ilk.upper()) + k[1:])
    return " ".join(out)


profil = Path(tempfile.mkdtemp(prefix="optik-kamera-profil-"))
konsol = []


def ac(p, video=None):
    args = ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
    if video:
        args.append(f"--use-file-for-fake-video-capture={video}")
    ctx = p.chromium.launch_persistent_context(str(profil), viewport={"width": 430, "height": 920}, accept_downloads=True, permissions=["camera"], args=args)
    s = ctx.pages[0] if ctx.pages else ctx.new_page()
    s.on("console", lambda m: konsol.append(f"{m.type}: {m.text}") if m.type == "error" else None)
    s.on("pageerror", lambda e: konsol.append(f"pageerror: {e}"))
    s.on("dialog", lambda d: d.accept())
    return ctx, s


rng = np.random.default_rng(2026)
masa = np.full((1920, 1080, 3), (70, 95, 125), np.uint8)
masa_jpg = cv2.imencode(".jpg", masa, [cv2.IMWRITE_JPEG_QUALITY, 80])[1].tobytes()


def video(ad, duzler, sure=3.5):
    kareler = [masa_jpg] * 20
    for duz in duzler:
        while True:
            jpg, kesik = S.fotograf(duz, rng, "video")
            im = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
            if not kesik and im.shape[:2] == (1920, 1080) and S.fotograf.bukum < 12:
                break
        for _ in range(int(sure * FPS)):
            M = np.float32([[1, 0, rng.normal(0, 0.6)], [0, 1, rng.normal(0, 0.6)]])
            k = cv2.warpAffine(im, M, (1080, 1920), borderMode=cv2.BORDER_REPLICATE)
            k = np.clip(k.astype(np.int16) + rng.normal(0, 2, k.shape).astype(np.int16), 0, 255).astype(np.uint8)
            kareler.append(cv2.imencode(".jpg", k, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes())
        kareler += [masa_jpg] * int(0.7 * FPS)
    (CIKTI / ad).write_bytes(b"".join(kareler))
    return CIKTI / ad


with sync_playwright() as p:
    # ------------------------------------------------------------ 0) sınavı hazırla ve yazdır
    print("0) Sınav hazırla -> yazdır (PDF)")
    yedek, ad, dogru = sinav_uret(N, K, G, 4242)
    (CIKTI / "sinav.sinav").write_text(json.dumps(yedek, ensure_ascii=False))
    ctx, s = ac(p)
    s.set_viewport_size({"width": 1440, "height": 900})
    s.goto(URL + "#/sinav")
    s.wait_for_selector(".sh-liste-sayfa")
    s.locator("input[type=file][accept*='.sinav']").set_input_files(str(CIKTI / "sinav.sinav"))
    kart = s.locator(".sh-sinav-karti", has_text=ad).first
    kart.wait_for(timeout=10000)
    sid = kart.locator("a.sh-kart-baglanti").get_attribute("href").split("#/sinav/")[1]
    s.goto(URL + f"#/sinav/{sid}/yazdir")
    s.wait_for_selector(".sh-sayfalar .bs-sayfa:not(.bs-yukleniyor)")
    s.click(".sh-yazdir-dugme")
    def anahtar(metin, deger):
        kutu = s.locator(f".sh-yazdir-pencere label.sh-anahtar:has-text('{metin}') input")
        if kutu.is_checked() != deger:
            s.locator(f".sh-yazdir-pencere label.sh-anahtar:has-text('{metin}')").click()
    s.locator(".sh-yazdir-pencere .sh-secici button:has-text('Öğrenci sayısı kadar')").click()
    o_ = s.locator(".sh-yazdir-pencere input[aria-label='Öğrenci sayısı']"); o_.fill(str(OGR)); o_.press("Enter")
    anahtar("Her öğrenciye optik form", True)
    anahtar("Kitapçık türü işaretli olsun", True)
    anahtar("Optikte işaretli cevap anahtarları", True)
    s.wait_for_selector(".sh-yazdir-onay:not([disabled])", timeout=30000)
    s.evaluate("() => { window.__yazdir = 0; window.print = () => { window.__yazdir++ } }")
    s.click(".sh-yazdir-onay")
    s.wait_for_function("() => window.__yazdir > 0", timeout=60000)
    sayfalar = s.evaluate("""() => Array.from(document.querySelectorAll('.bs-baski-alani .bs-sayfa')).map(e => ({
        optik: e.dataset.optik || null, kitapcik: e.dataset.kitapcik || null, grup: e.dataset.grup || null, sayfa: e.dataset.sayfa ? +e.dataset.sayfa : null }))""")
    pdf = CIKTI / "baski.pdf"
    s.pdf(path=str(pdf), prefer_css_page_size=True)
    ctx.close()

    metinler = [pg.extract_text() or "" for pg in PdfReader(str(pdf)).pages]
    kopyalar, ogr_sayfa, anahtar_sayfa = [], [], {}
    for i, x in enumerate(sayfalar):
        if x["grup"] and not x["optik"]:
            if x["sayfa"] == 1:
                kopyalar.append((x["grup"], []))
            kopyalar[-1][1].append(i)
        elif x["optik"] == "ogrenci":
            ogr_sayfa.append((kopyalar[-1][0], i))
        elif x["optik"] == "anahtar":
            anahtar_sayfa[x["kitapcik"]] = i
    beklenen = {}
    for harf, idx in kopyalar:
        beklenen.setdefault(harf, kagittan_anahtar("\n".join(metinler[i] for i in idx), dogru, N))
    kontrol(len(beklenen) == G and all(beklenen.values()), f"basılı kâğıtlardan {G} grubun anahtarı çıkarıldı")

    def raster(i):
        yol = CIKTI / f"s{i + 1:03d}"
        subprocess.run(["pdftoppm", "-r", "200", "-gray", "-png", "-f", str(i + 1), "-l", str(i + 1), "-singlefile", str(pdf), str(yol)], check=True)
        return cv2.imread(str(yol) + ".png", cv2.IMREAD_GRAYSCALE)

    anahtar_video = {h: video(f"v_anahtar_{h}.mjpeg", [raster(i)]) for h, i in anahtar_sayfa.items()}
    ogrenciler, duzler = [], []
    for grup, i in ogr_sayfa:
        img = raster(i)
        b = ogrenci_doldur(img, rng, N, K)
        a = beklenen[grup]
        d = sum(1 for q in range(N) if b["cevap"][q] is not None and b["cevap"][q] == a[q])
        bos = sum(1 for q in range(N) if b["cevap"][q] is None)
        ogrenciler.append({**b, "grup": grup, "d": d, "b": bos, "y": N - d - bos, "puan": round(d * 100 / N + 1e-9, 2)})
        duzler.append(img)
        cv2.imwrite(str(CIKTI / f"ogr_{len(ogrenciler)}.png"), img)
    ogr_video = video("v_ogrenci.mjpeg", duzler)
    print(f"  videolar hazır: {len(anahtar_video)} anahtar, {len(ogrenciler)} öğrenci")

    # ------------------------------------------------------------ 1) optik: anahtarları kamerayla okut
    print("1) Optik okuyucu: işaretli anahtar formları kamerayla")
    okunan_anahtar = {}
    for i_, (harf, v) in enumerate(sorted(anahtar_video.items())):
        ctx, s = ac(p, v)
        s.goto(URL + "#/optik")
        if i_ == 0:
            s.evaluate("() => localStorage.removeItem('optik-okuyucu.sinav.v1')")
            s.reload()
            s.fill('input[placeholder^="Örn."]', "Kamera ile anahtar")
            s.fill('label:has-text("Soru sayısı") input', str(N))
            s.click("text=Devam: Cevap anahtarı")
        s.wait_for_selector('button:has-text("Anahtarı kamerayla okut"):not([disabled])', timeout=180000)
        s.click('button:has-text("Anahtarı kamerayla okut")')
        s.wait_for_selector("text=Anahtarı kaydet", timeout=90000)
        secili = s.locator(".anahtar-satir").evaluate_all("els => els.map(e => { const s = e.querySelector('.sik.secili'); return s ? s.textContent.trim() : null })")
        kit = s.locator(".pencere .sec.secili").first.inner_text().strip()
        okunan_anahtar[harf] = secili[:N]
        kontrol(kit == harf, f"{harf} anahtar formunda kitapçık {kit} okundu")
        kontrol(secili[:N] == [HARF[k] for k in beklenen[harf]], f"{harf} anahtarının {N} sorusu kâğıttaki doğru şıklarla aynı")
        s.screenshot(path=str(CIKTI / f"anahtar_{harf}.png"))
        s.click("text=Anahtarı kaydet")
        s.wait_for_selector(f"text=Kitapçık {harf}")
        ctx.close()
    ctx, s = ac(p)
    s.goto(URL + "#/optik")
    kamera_durum = s.evaluate("() => JSON.parse(localStorage.getItem('optik-okuyucu.sinav.v1'))")
    ctx.close()

    # ------------------------------------------------------------ 2) öğrenciler
    print("2) Öğrenci formları (kitapçık basılı, kurşun kalemle doldurulmuş) kamerayla")
    ctx, s = ac(p, ogr_video)
    s.goto(URL + "#/optik")
    if s.is_visible("text=Devam: Öğrenci kâğıtlarını okut"):
        s.click("text=Devam: Öğrenci kâğıtlarını okut")
    s.wait_for_selector('button:has-text("Kamerayla okut")', timeout=180000)
    s.wait_for_function("() => !document.querySelector('.yukleme')", timeout=180000)
    if s.is_visible("text=Kapat"):
        s.click("text=Kapat")
    s.click('button:has-text("Kamerayla okut")')
    s.wait_for_selector("video")
    t0 = time.time(); son = 0; t_bitti = None; pencere = 0
    while time.time() - t0 < 100:
        try:
            if s.is_visible("text=Onayla ve kaydet"):
                pencere += 1
                print("   · kontrol penceresi:", s.locator(".sorun-listesi").inner_text().strip().splitlines()[:2])
                s.click("text=Bu kâğıdı atla")
                continue
            sayi = int(s.locator(".sayac").inner_text(timeout=500).split()[0])
            if sayi != son:
                son = sayi
                if sayi == len(ogrenciler):
                    t_bitti = time.time()
            if t_bitti and time.time() - t_bitti > 6:
                break
        except Exception:
            pass
        time.sleep(0.2)
    s.click(".kamera-ekran-kapat")
    liste = s.locator(".sonuc-listesi li").evaluate_all(
        "els => els.map(e => [e.querySelector('.isim').childNodes[0].textContent.trim(), e.querySelector('.puan').textContent.trim(), e.querySelector('.isim small').textContent])")
    bek = {(tr_baslik(o["ad"] + " " + o["soyad"]), o["no"], f"{o['puan']:.2f}".replace(".", ",")) for o in ogrenciler}
    gor = {(a, (re.search(r"No (\d+)", k) or [None, None])[1], p_) for a, p_, k in liste}
    kontrol(len(liste) == len(ogrenciler), f"{len(ogrenciler)} öğrenci okundu (listede {len(liste)}, kontrol penceresi {pencere})")
    kontrol(gor == bek, "isimler, numaralar ve puanlar kâğıtlarla birebir aynı")
    if gor != bek:
        print("   eksik:", bek - gor); print("   fazla:", gor - bek)
    s.screenshot(path=str(CIKTI / "sonuclar.png"))
    s.click('button:has-text("Bitti")')
    with s.expect_download() as indir:
        s.click("text=Excel'i indir")
    xl = CIKTI / "sonuclar.xlsx"
    indir.value.save_as(str(xl))
    wb = openpyxl.load_workbook(xl)
    satirlar = list(wb["Sonuçlar"].iter_rows(min_row=2, values_only=True))
    ex = {(str(r[1]), r[4], r[5], r[6], r[7], round(r[9], 2)) for r in satirlar}
    bx = {(o["no"], o["grup"], o["d"], o["y"], o["b"], o["puan"]) for o in ogrenciler}
    kontrol(ex == bx, "Excel: numara, kitapçık, doğru/yanlış/boş ve puan birebir doğru")
    ctx.close()

    # ------------------------------------------------------------ 3) aynı sınav "Optik okuyucuya aktar" ile
    print("3) Sınav hazırla -> Optik okuyucuya aktar")
    ctx, s = ac(p)
    s.set_viewport_size({"width": 1440, "height": 900})
    s.goto(URL + f"#/sinav/{sid}/yazdir")
    s.wait_for_selector(".sh-optik-kart button:has-text('Optik okuyucuya aktar')")
    s.click(".sh-optik-kart button:has-text('Optik okuyucuya aktar')")
    if s.locator(".pencere .sh-onay input").count():
        s.locator(".pencere .sh-onay input").check()
    s.click(".sh-aktar-onay")
    s.wait_for_function("() => location.hash === '#/optik'")
    aktar_durum = s.evaluate("() => JSON.parse(localStorage.getItem('optik-okuyucu.sinav.v1'))")
    aktarilan = {k: "".join(HARF[x] for x in v[:N]) for k, v in aktar_durum["anahtarlar"].items()}
    kamerali = {k: "".join(HARF[x] for x in v[:N]) for k, v in kamera_durum["anahtarlar"].items()}
    kontrol(aktarilan == kamerali, f"aktarılan anahtarlar = kameradan okunan anahtarlar ({', '.join(sorted(aktarilan))})")
    kontrol(aktar_durum["ayar"]["soruSayisi"] == N and aktar_durum["ayar"]["soruPuani"] == 0, "aktarılan ayar: N soru, otomatik (100/N) puan")
    s.wait_for_selector("text=Kamerayla okut", timeout=60000)
    s.screenshot(path=str(CIKTI / "aktarim_sonrasi.png"))
    ctx.close()

shutil.rmtree(profil, ignore_errors=True)
kontrol(not konsol, "tarayıcı konsolunda hata yok" + ("" if not konsol else ": " + " | ".join(konsol[:4])))
print(f"Çıktılar: {CIKTI}")
print("SONUÇ:", "BAŞARILI" if not hatalar else f"{len(hatalar)} HATA")
sys.exit(1 if hatalar else 0)
