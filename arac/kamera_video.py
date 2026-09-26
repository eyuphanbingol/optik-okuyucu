# Sahte kamera videosu (MJPEG): masa -> kâğıt 1 (3.5 sn) -> masa -> kâğıt 2 ... (Chromium döngüyle tekrar oynatır)
import json, sys
from pathlib import Path
import numpy as np
import cv2
import sentetik2 as S

kok = Path(sys.argv[1])
B = json.loads((kok / "beklenen.json").read_text())
secilen = [o for o in B["ogrenciler"] if not o["zor"]][:5]
rng = np.random.default_rng(99)
FPS = 30
kareler = []
masa = np.full((1920, 1080, 3), (70, 95, 125), np.uint8)
masa_jpg = cv2.imencode(".jpg", masa, [cv2.IMWRITE_JPEG_QUALITY, 80])[1].tobytes()
for _ in range(20):
    kareler.append(masa_jpg)
for o in secilen:
    duz = cv2.imread(str(kok / f"duz_{o['dosya'][:-4]}.png"), cv2.IMREAD_GRAYSCALE)
    while True:
        jpg, kesik = S.fotograf(duz, rng, "video")
        im = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
        if not kesik and im.shape[:2] == (1920, 1080) and S.fotograf.bukum < 12:   # öğretmen kâğıdı düz tutuyor
            break
    for i in range(int(3.5 * FPS)):
        # küçük titreşim + gürültü (gerçek video gibi her kare biraz farklı)
        M = np.float32([[1, 0, rng.normal(0, 0.6)], [0, 1, rng.normal(0, 0.6)]])
        k = cv2.warpAffine(im, M, (1080, 1920), borderMode=cv2.BORDER_REPLICATE)
        k = np.clip(k.astype(np.int16) + rng.normal(0, 2, k.shape).astype(np.int16), 0, 255).astype(np.uint8)
        kareler.append(cv2.imencode(".jpg", k, [cv2.IMWRITE_JPEG_QUALITY, 85])[1].tobytes())
    for _ in range(int(0.7 * FPS)):
        kareler.append(masa_jpg)
(kok / "kamera.mjpeg").write_bytes(b"".join(kareler))
(kok / "kamera_beklenen.json").write_text(json.dumps([o["dosya"] for o in secilen]))
print(len(kareler), "kare,", round(len(kareler) / FPS, 1), "sn; öğrenciler:", [o["dosya"] for o in secilen])
