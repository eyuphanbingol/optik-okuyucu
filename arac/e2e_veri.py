# Uçtan uca test verisi: 40 soruluk sınav, A ve B anahtarı, 12 öğrenci (10 temiz + 2 zor), beklenen puanlar
import json, sys
from pathlib import Path
import numpy as np
import cv2
import sentetik2 as S

kok = Path(sys.argv[1])
(kok / "foto").mkdir(parents=True, exist_ok=True)
N = 40
rng = np.random.default_rng(2024)
anahtarlar = {"A": {q: int(rng.integers(0, 5)) for q in range(N)}, "B": {q: int(rng.integers(0, 5)) for q in range(N)}}
kareler = {}   # kamera videosu için düz (gri) kâğıt görüntüleri
for kit, a in anahtarlar.items():
    img, _ = S.kagit_uret(rng, zor=False, anahtar=a, kitapcik=kit, anahtar_mi=True, soru_n=N)
    while True:
        jpg, kesik = S.fotograf(img, rng, "telefon")
        if not kesik:
            break
    (kok / "foto" / f"anahtar_{kit}.jpg").write_bytes(jpg)
    cv2.imwrite(str(kok / f"duz_anahtar_{kit}.png"), img)

ogrenciler = []
for i in range(12):
    zor = i >= 10
    kit = "A" if i % 3 else "B"
    while True:
        img, g = S.kagit_uret(rng, zor=zor, anahtar=anahtarlar[kit], kitapcik=kit)
        # temiz öğrencilerde numaralar benzersiz ve boş olmasın
        if g["no"] not in [o["no"] for o in ogrenciler]:
            break
    while True:
        jpg, kesik = S.fotograf(img, rng, "telefon")
        if not kesik:
            break
    ad = f"ogr_{i + 1:02d}.jpg"
    (kok / "foto" / ad).write_bytes(jpg)
    cv2.imwrite(str(kok / f"duz_{ad[:-4]}.png"), img)
    # beklenen puan (öğretmen zor soruda gerçeği seçerse): çift -> yanlış
    a = anahtarlar[kit]
    d = y = b = 0
    for q in range(N):
        c = g["cevaplar"][str(q)]
        if c["tur"] == "bos": b += 1
        elif c["tur"] == "cift": y += 1
        elif c["k"] == a[q]: d += 1
        else: y += 1
    ogrenciler.append({"dosya": ad, "ad": g["ad"], "soyad": g["soyad"], "no": g["no"], "kitapcik": kit, "zor": zor,
                       "d": d, "y": y, "b": b, "puan": round(d * 100 / N, 2), "cevaplar": g["cevaplar"]})

(kok / "beklenen.json").write_text(json.dumps({"N": N, "anahtarlar": anahtarlar, "ogrenciler": ogrenciler}, ensure_ascii=False))
print("hazır:", len(ogrenciler), "öğrenci")
