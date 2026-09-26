# e2e_kamera_test.py için sahte kamera videoları (MJPEG): masa -> kâğıt (3.5 sn) -> masa -> ...
#   python3 arac/e2e_video.py <e2e_veri.py klasörü>
# Üretir: v_anahtarA.mjpeg, v_anahtarB.mjpeg, v_ogrenci.mjpeg (6 temiz + 1 zor öğrenci), video_ogrenciler.json
import json, sys
from pathlib import Path
import numpy as np
import cv2
import sentetik2 as S

kok = Path(sys.argv[1])
FPS = 30
rng = np.random.default_rng(99)
masa = np.full((1920, 1080, 3), (70, 95, 125), np.uint8)
masa_jpg = cv2.imencode(".jpg", masa, [cv2.IMWRITE_JPEG_QUALITY, 80])[1].tobytes()


def video(ad, duzler):
    kareler = [masa_jpg] * 20
    for d in duzler:
        duz = cv2.imread(str(kok / d), cv2.IMREAD_GRAYSCALE)
        while True:
            jpg, kesik = S.fotograf(duz, rng, "video")
            im = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
            if not kesik and im.shape[:2] == (1920, 1080) and S.fotograf.bukum < 12:   # öğretmen kâğıdı düz tutuyor
                break
        for _ in range(int(3.5 * FPS)):
            # küçük titreşim + gürültü (gerçek video gibi her kare biraz farklı)
            M = np.float32([[1, 0, rng.normal(0, 0.6)], [0, 1, rng.normal(0, 0.6)]])
            k = cv2.warpAffine(im, M, (1080, 1920), borderMode=cv2.BORDER_REPLICATE)
            k = np.clip(k.astype(np.int16) + rng.normal(0, 2, k.shape).astype(np.int16), 0, 255).astype(np.uint8)
            kareler.append(cv2.imencode(".jpg", k, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes())
        kareler += [masa_jpg] * int(0.7 * FPS)
    (kok / ad).write_bytes(b"".join(kareler))
    print(ad, len(kareler), "kare,", round(len(kareler) / FPS, 1), "sn")


B = json.loads((kok / "beklenen.json").read_text())
video("v_anahtarA.mjpeg", ["duz_anahtar_A.png"])
video("v_anahtarB.mjpeg", ["duz_anahtar_B.png"])
temiz = [o["dosya"] for o in B["ogrenciler"] if not o["zor"]][:6]
zor = [o["dosya"] for o in B["ogrenciler"] if o["zor"]][:1]
video("v_ogrenci.mjpeg", [f"duz_{d[:-4]}.png" for d in temiz + zor])
(kok / "video_ogrenciler.json").write_text(json.dumps(temiz + zor))
