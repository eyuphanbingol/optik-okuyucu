import sys, time
from playwright.sync_api import sync_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:4173/"
def dene(ad, init_script=None, route_404=False, throttle=False):
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"])
        ctx = b.new_context(viewport={"width": 430, "height": 920})
        if init_script: ctx.add_init_script(init_script)
        s = ctx.new_page()
        konsol = []
        s.on("console", lambda m: konsol.append(m.text[:160]) if m.type in ("warning", "error") else None)
        if route_404: s.route("**/opencv/**", lambda r: r.fulfill(status=404, body="yok"))
        t = time.time()
        s.goto(URL)
        s.click("text=Devam: Cevap anahtarı")
        try:
            s.wait_for_function("() => document.body.innerText.includes('Anahtarı kamerayla okut') || document.body.innerText.includes('Okuyucu yüklenemedi.')", timeout=180000)
        except Exception as e:
            print(ad, "ZAMAN AŞIMI"); b.close(); return
        metin = s.locator("main").inner_text()
        hata = s.locator(".hata-kutu").all_inner_texts()
        hazir = s.locator('button:has-text("Anahtarı kamerayla okut"):not([disabled])').count() > 0
        mod = s.evaluate("() => window.__optikMod || null")
        print(f"{ad}: {'HAZIR' if hazir else 'HATA'} ({time.time()-t:.1f} sn) mod={mod} {hata[:1]} konsol={konsol[:2]}")
        b.close()
dene("1) normal")
dene("2) Worker yok (eski tarayıcı)", "delete window.Worker")
dene("3) Worker çöküyor", "window.Worker = class { constructor(){ setTimeout(() => this.onerror && this.onerror(new Event('error')), 50) } postMessage(){} terminate(){} }")
dene("4) OpenCV dosyası 404", route_404=True)
