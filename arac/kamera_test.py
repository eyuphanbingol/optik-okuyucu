# Canlı kamera akışı testi: sahte kamera videosuyla öğrenciler otomatik okunmalı, döngüde tekrar sayılmamalı
import json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

KOK = Path(sys.argv[1])
URL = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:4173/"
B = json.loads((KOK / "beklenen.json").read_text())
secilen = json.loads((KOK / "kamera_beklenen.json").read_text())
N = B["N"]


def tr_baslik(s):
    kucuk = s.replace("I", "ı").replace("İ", "i").lower()
    out = []
    for k in kucuk.split():
        ilk = k[0]
        ilk = "İ" if ilk == "i" else "I" if ilk == "ı" else ilk.upper()
        out.append(ilk + k[1:])
    return " ".join(out)


hatalar = []
def kontrol(k, m):
    print(("  ✔ " if k else "  ✘ ") + m)
    if not k: hatalar.append(m)


with sync_playwright() as p:
    tarayici = p.chromium.launch(args=[
        "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
        f"--use-file-for-fake-video-capture={KOK / 'kamera.mjpeg'}",
    ])
    ctx = tarayici.new_context(viewport={"width": 430, "height": 920}, permissions=["camera"])
    s = ctx.new_page()
    konsol = []
    s.on("pageerror", lambda e: konsol.append(str(e)))
    s.on("dialog", lambda d: d.accept())
    s.goto(URL)
    s.evaluate("localStorage.clear()")
    s.reload()
    s.fill('label:has-text("Soru sayısı") input', str(N))
    s.click("text=Devam: Cevap anahtarı")
    s.wait_for_selector('button:has-text("Anahtarı kamerayla okut"):not([disabled])', timeout=180000)
    for kit in ("A", "B"):
        s.set_input_files('input[type=file]', str(KOK / "foto" / f"anahtar_{kit}.jpg"))
        s.wait_for_selector("text=Anahtarı kaydet", timeout=60000)
        s.click("text=Anahtarı kaydet")
        s.wait_for_selector(f"text=Kitapçık {kit}")
    s.click("text=Devam: Öğrenci kâğıtlarını okut")
    s.click("text=Kapat")   # "nasıl okutulur" kutusu
    s.wait_for_selector("video")
    cozunurluk = s.locator(".kamera-coz").inner_text(timeout=20000) if s.locator(".kamera-coz").count() else "?"
    print("  kamera çözünürlüğü:", cozunurluk)
    mesajlar = set()
    bildirimler = []
    t0 = time.time()
    # video ~22 sn; iki tur oynasın (tekrar sayılmamalı)
    while time.time() - t0 < 75:
        try:
            mesajlar.add(s.locator(".kamera-mesaj").inner_text(timeout=1000))
            if s.locator(".bildirim").count():
                b = s.locator(".bildirim").inner_text(timeout=500)
                if not bildirimler or bildirimler[-1] != b:
                    bildirimler.append(b)
            if s.is_visible("text=Onayla ve kaydet"):
                kontrol(False, "temiz kâğıtta kontrol penceresi açılmamalı: " + s.locator(".sorun-listesi").inner_text())
                s.click("text=Bu kâğıdı atla")
        except Exception:
            pass
        time.sleep(0.25)
    print("  görülen kamera mesajları:", sorted(mesajlar)[:12])
    print("  bildirimler:", bildirimler)
    liste = s.locator(".sonuc-listesi li").evaluate_all(
        "els => els.map(e => [e.querySelector('.isim').childNodes[0].textContent.trim(), e.querySelector('.puan').textContent.trim()])")
    bek = {(tr_baslik(o["ad"] + " " + o["soyad"]), f"{o['puan']:.2f}".replace(".", ",")) for o in B["ogrenciler"] if o["dosya"] in secilen}
    kontrol(len(liste) == len(secilen), f"kamerayla {len(secilen)} öğrenci okundu, tekrar sayılmadı (listede {len(liste)})")
    kontrol({tuple(x) for x in liste} == bek, "kamerayla okunan isim ve puanlar birebir doğru")
    if {tuple(x) for x in liste} != bek:
        print("   liste:", liste); print("   beklenen:", bek)
    kontrol(any("✅" in b for b in bildirimler), "okununca '✅ Ad Soyad — puan' bildirimi çıktı")
    kontrol(not konsol, f"sayfa hatası yok {konsol[:2]}")
    s.screenshot(path=str(KOK / "kamera_ekrani.png"))
    tarayici.close()

print("\nSONUÇ:", "TÜM KONTROLLER GEÇTİ" if not hatalar else f"{len(hatalar)} HATA: {hatalar}")
