# Optik Okuyucu

Ana sayfada iki ayrı bölüm var: **Sınav hazırla** (Word gibi sınav kâğıdı hazırlama, A–D grupları, cevap anahtarı, yazdırma / PDF / Word)
ve **Optik okuma** (aşağıda anlatılan kamerayla okuma). İkisi birbirinden bağımsızdır; hazırlanan test sınavının anahtarları
tek tıkla optik okuyucuya aktarılabilir.

Öğretmen telefondan siteyi açar, sınav ayarlarını girer, cevap anahtarını okutur, sonra optik formları kameraya sırayla gösterir.
Her kâğıt okunduğunda ekrana **✅ Ad Soyad — puan** düşer, altta canlı **SINAV SONUÇLARI** listesi oluşur.
Bitince sonuçlar Excel'e dökülür ve istenen adrese e-postayla gönderilir.

- Giriş / kayıt yok. Veriler öğretmenin tarayıcısında durur; sayfa yenilense ya da kapansa bile kaybolmaz.
- Kâğıt görüntüleri hiçbir sunucuya gitmez; okuma telefonun kendisinde yapılır. Sunucuya giden tek şey e-postayla gönderilen Excel dosyasıdır.
- Form: `public/optik_formu.pdf` — ad (13 harf) ve soyad (13 harf) kodlamalı, **9 haneli öğrenci numarası** kodlamalı,
  kitapçık türü (A–D), cevap anahtarı yuvarlağı, 80 soru (A–E). A4, siyah-beyaz yazıcı ya da fotokopi uygundur.

---

## Yayına alma (GitHub + Vercel, ücretsiz)

### 1. GitHub'a yükleme
1. https://github.com adresinde hesabınızla giriş yapın → sağ üstte **+ → New repository**.
2. Ad verin (ör. `optik-okuyucu`), **Private** ya da **Public** seçin → **Create repository**.
3. Açılan sayfada **uploading an existing file** bağlantısına tıklayın.
4. Bu klasörün **içindeki her şeyi** (klasörün kendisini değil; `package.json` en üst seviyede olmalı) sürükleyip bırakın.
   Gizli dosyalar (`.gitignore`, `.env.example`) görünmüyorsa da sorun değil, zorunlu değiller.
5. **Commit changes**.

> Bilgisayarınızda git varsa: `git init && git add . && git commit -m "ilk sürüm"` sonra GitHub'ın gösterdiği `git remote add ... && git push` komutları.

### 2. Vercel'de yayına alma
1. https://vercel.com → **Continue with GitHub** ile giriş.
2. **Add New… → Project** → listeden deponuzu seçin → **Import**.
3. Ayarlara dokunmayın (Framework: **Vite** otomatik seçilir) → **Deploy**.
4. 1–2 dakika sonra `https://optik-okuyucu-xxx.vercel.app` adresiniz hazır. Telefonda açıp deneyin.

### 3. E-posta gönderimini açma
1. Sadece bu iş için bir Gmail hesabı açın (ör. `okulumuz.optik@gmail.com`).
2. Google Hesabı → **Güvenlik** → **2 Adımlı Doğrulama**'yı açın → **Uygulama şifreleri** → yeni şifre (16 harf) oluşturun.
3. Vercel → projeniz → **Settings → Environment Variables** bölümüne ekleyin:

   | Ad | Değer |
   |---|---|
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `465` |
   | `SMTP_USER` | `okulumuz.optik@gmail.com` |
   | `SMTP_PASS` | 16 harflik uygulama şifresi (boşluksuz) |
   | `MAIL_FROM` | `Optik Okuyucu <okulumuz.optik@gmail.com>` *(isteğe bağlı)* |
   | `IZINLI_ALAN_ADLARI` | ör. `meb.k12.tr,gmail.com` *(isteğe bağlı; boşsa her adrese gönderir)* |

4. **Deployments** → en üstteki kaydın **⋯** menüsü → **Redeploy**.

E-posta ayarlanmasa da site çalışır; Excel **İndir** ya da **Paylaş** ile alınır.

---

## Öğretmen için kullanım

1. **Ayarlar:** sınav adı, soru sayısı (1–80), her soru kaç puan (boş bırakılırsa toplam 100 olacak şekilde hesaplanır),
   yanlış doğruyu götürsün mü, çift işaretli soru yanlış mı boş mu sayılsın.
2. **Cevap anahtarı:** boş bir formu doldurup "CEVAP ANAHTARI" yuvarlağını ve kitapçık türünü kodlayın, okutun.
   Okunan anahtar ekranda gösterilir; kontrol edip kaydedin. Birden fazla kitapçık varsa her biri için ayrı anahtar okutun
   (ya da **Elle gir**).
3. **Okut:** kâğıdı masaya koyun; dört köşedeki kare işaretler ekranda görünsün. Köşeler yeşil olunca kâğıt **iki ayrı karede**
   okunur, karşılaştırılır ve kaydedilir. Sıradaki kâğıdı üstüne koymanız yeterli; aynı kâğıt iki kez sayılmaz.
4. **Sonuç:** e-posta adresinizi yazıp gönderin ya da Excel'i indirin.
   Excel sayfaları: Sonuçlar, Sıralama, Cevaplar (renkli), Soru Analizi, Cevap Anahtarı, Bilgi.

### Sınav hazırla

1. **Yeni sınav:** şablon (Test, Yazılı, Karma, Boş sayfa), soru sayısı, şık sayısı (A–C / A–D / A–E), grup sayısı
   (tek, A–B, A–C, A–D) ve kâğıt başlığı (okul, ders, sınıf, sınav adı). Hepsi sonradan değiştirilebilir.
2. **Yazma:** sorular doğrudan kâğıdın üzerinde yazılır. Soru türleri: çoktan seçmeli, açık uçlu (klasik; çizgili ya da boş cevap alanı),
   kısa cevaplı, doğru / yanlış, boşluk doldurma (kelimeyi seçip **Boşluk yap** ya da `[köşeli parantez]`; isteğe bağlı kelime havuzu),
   eşleştirme ve numarasız bölüm başlıkları. Kalın / italik / altı çizili, üs / indis, liste, matematik sembolleri.
   Görsel: soruya ya da şıkka ekle, yapıştır ya da sürükle-bırak; boyut, hizalama, metnin yanında.
   Sorular sol panelden sürüklenerek sıralanır; her sorunun puanı ve kazanımı ayarlanır. Geri al / yinele (Ctrl+Z / Ctrl+Y), otomatik kayıt.
3. **Önizle ve yazdır:** A4 sayfalar gerçek ölçüsünde; sorular sayfa arasında bölünmez. B, C, D gruplarında sorular (bölüm içinde)
   ve şıklar karıştırılır, eşleştirmenin sağ sütunu ve kelime havuzu her grupta ayrı sıradadır. Her grubun cevap anahtarı otomatik çıkar.
   **Yazdır / PDF**, **Word (.docx)** (Word'de açıp düzenlenebilir) ve cevap anahtarı.
4. **Optiğe aktar:** sınav yalnızca çoktan seçmeli sorulardan oluşuyorsa (en çok 80 soru, A–E) anahtarlar optik okuyucuya aktarılır;
   gruplar kitapçık türü olur (A grubu → A kitapçığı).
5. Sınavlar bu cihazda saklanır (IndexedDB). Başka cihaza taşımak için **Yedek dosyası indir** (.sinav) → **İçe aktar**.

---

## Sıfır hata için tasarım

Okuyucu **emin olmadığı hiçbir şeyi tahminle okumaz**: ya doğru okur ya da durup öğretmene sorar.

- **Çift okuma onayı:** canlı kamerada her kâğıt iki ayrı karede okunur; emin olunan her şey birebir aynı değilse tekrar okunur.
- **Kontrol penceresi:** çift işaret, yarım silinmiş / çok hafif işaret, net okunamayan harf veya rakam, işaretlenmemiş kitapçık
  durumunda okuma durur; öğrencinin elle yazdığı ad/numara ve ilgili soru satırının görüntüsü gösterilir, öğretmen karar verir.
- **Ölçülmüş eşikler:** "işaretli / boş / emin değil" sınırları, binlerce sahte kâğıtta gerçek işaretlerin, silgi izlerinin,
  çok hafif kalemin ve boş yuvarlakların koyuluk dağılımları ölçülerek, aralarında güvenlik payı bırakılarak belirlendi.
- **Okumayı reddetme:** köşe işareti görünmüyor, görüntü uzak/bulanık ya da kâğıt aşırı kıvrıksa kâğıt hiç okunmaz ve
  ne yapılacağı söylenir. Eski / farklı bir form okutulursa "form tanınamadı" denir.
- **Satır kayması kilidi:** formdaki 28 sabit noktayla kâğıdın kıvrımı ölçülür; kabarcık bölgeleri buna göre hizalanır ve
  her bölge komşularıyla tutarlılık kontrolünden geçer. Sık ad-soyad ızgarasının bir satır kayması tasarım gereği engellenir.
- **Karışmayı önleme:** aynı kâğıt tekrar okutulursa eklenmez; aynı numara farklı cevaplarla gelirse öğretmene sorulur;
  kitapçığı işaretsiz kâğıt (birden fazla anahtar varken) sorulmadan puanlanmaz; öğrenci "CEVAP ANAHTARI"nı işaretlerse uyarılır.
- **Yükleme güvenliği:** okuyucu ayrı dosya olarak ilerleme çubuğuyla indirilir; arka plan iş parçacığı çalışmayan
  tarayıcılarda otomatik olarak ana ekranda çalışır; bir sorun olursa hangi adımda olduğu yazılır ve "Tekrar dene" çıkar.

### Test sonuçları

Okuyucu, telefonda çalışan kodun **aynısıyla** sahte kâğıtlar üzerinde test edildi. Koşullar: eğik/perspektifli telefon fotoğrafı,
gölge, ışık farkı, bulanıklık, 1080p ve 4K canlı kamera karesi, WhatsApp sıkıştırması, tarayıcı (150–300 dpi, ters),
**fotokopi** (küçültülmüş, gri zemin, kalın çizgi, toner lekesi), 4 mm'ye kadar kıvrık kâğıt, yarım dolu / taşmış / silinmiş /
çok hafif / çift işaret, Türkçe karakterli ve iki isimli öğrenciler, 1–9 haneli numaralar.

**Son doğrulama** (eşik ayarlarında hiç kullanılmamış kâğıtlar):

| Set | Okunan kâğıt | Cevap | Ad/Soyad | Numara | Sessiz hata |
|---|---|---|---|---|---|
| Karışık koşullar (104'ü fotokopi) | 259 | 20.720 | 518 | 259 | **0** |
| Canlı kamera karesi | 194 | 15.520 | 388 | 194 | **0** |

*Sessiz hata* = uyarı vermeden yanlış okuma. Okunamayan kâğıtlar (kadraj dışı köşe, çok uzak çekim, aşırı kıvrık) hiç okunmadı;
"tekrar çekin / yaklaştırın / düzleştirin" dendi. Tarayıcıda uçtan uca testler de geçti: anahtar okutma, 12 öğrenci (aynı adlı iki öğrenci
dahil), kontrol pencereleri, yeniden çekme, sayfa yenileme, aynı kâğıdı tekrar okutma, Excel içeriği, e-posta eki, sahte kamera
videosuyla canlı okuma, iş parçacığı olmayan tarayıcıda yedek yol, okuyucu dosyası eksikken anlaşılır hata.

### Dürüst sınırlar
- Testler sahte kâğıtlarla yapıldı. **Gerçek sınavda kullanmadan önce** formu yazdırıp 15–20 kâğıdı gerçek kurşun kalemle
  doldurun, kendi telefonunuzla okutun ve sonuçları elle karşılaştırın.
- El yazısı okunmaz; kodlama esastır (el yazısı sadece kontrol penceresinde öğretmene gösterilir).
- Ad ve soyad 13'er harfe sığar; uzun adlar kesilir (listeden düzeltilebilir).
- Veriler tarayıcıda durur: başka cihazda görünmez, tarayıcı verileri silinirse kaybolur. Sınav bitince Excel'i alın.
- İlk açılışta ~4 MB okuyucu indirilir (sonra önbellekten gelir). Eski telefonlarda kâğıt başına birkaç saniye sürebilir.

## Sorun giderme

| Mesaj | Anlamı / Çözüm |
|---|---|
| *Okuyucu yüklenemedi … sunucuda bulunamadı (HTTP 404)* | Site eksik yüklenmiş. Vercel'de **Redeploy** yapın; GitHub'a `package.json` en üst seviyede yüklenmeli. |
| *Okuyucu yüklenemedi … indirilemedi* | İnternet bağlantısı koptu. **Tekrar dene**. |
| *Kamera izni verilmedi* | Tarayıcı ayarlarından siteye kamera izni verin. Site `https://` ile açılmalı. |
| *Form tanınamadı* | Farklı/eski bir form ya da kâğıdın büyük kısmı görünmüyor. Bu sitedeki PDF'i kullanın. |
| *Kâğıt çok uzakta / çözünürlük düşük* | Kamerayı yaklaştırın; kâğıt kesikli çerçeveyi doldursun. |
| *Kâğıt kıvrık görünüyor* | Kâğıdı düz bir masaya koyun. |

---

## Geliştirici notları

```
src/omr/okuyucu.js     okuma çekirdeği (OpenCV.js): köşe işareti, düzeltme, sabit noktalar, hizalama, işaret kararı
src/omr/hizli-duzelt.js  perspektif düzeltmenin WebAssembly SIMD sürümü (OpenCV ile bit düzeyinde aynı; kaynak: arac/warp_simd.c)
src/omr/worker.js      çekirdeği arka plan iş parçacığında çalıştırır (klasik worker, importScripts)
src/omr/istemci.js     yükleme (ilerleme, zaman aşımı, ana ekran yedeği, hızlı sürüm -> tek parça yedeği) ve çağrılar
src/omr/geometri.json  form ölçüleri — arac/form_uret.py üretir (PDF ve referans görüntüyle birlikte)
src/bilesenler/        Kamera (otomatik yakalama + çift okuma), Kontrol penceresi, Anahtar düzenleyici, Simge (ikonlar)
src/yazitipi/          Geist yazı tipi (siteyle birlikte gelir, SIL OFL lisansı)
src/mantik.js          puanlama, iki okumayı birleştirme, tekrar kontrolü
src/excel.js           Excel çıktısı · api/eposta.js  e-posta sunucu fonksiyonu
src/Kok.jsx            adresler: #/ ana sayfa · #/optik optik okuma · #/sinav sınavlarım · #/sinav/<id> düzenleyici · #/sinav/<id>/yazdir
src/AnaSayfa.jsx       iki modülün seçildiği ana sayfa
src/sinav/             sınav hazırlama modülü (ayrı yüklenir; optik kodunu kullanmaz, değiştirmez)
  model.js / karistir.js   veri modeli, puanlar, eksik kontrolü · gruplar (tohumlu, her açılışta aynı) ve cevap anahtarları
  Duzenleyici.jsx, Ogeler.jsx, Ozellikler.jsx, Duzenlenebilir.jsx   Word benzeri düzenleyici
  Baski.jsx / Onizleme.jsx  A4 sayfalama, yazdırma, cevap anahtarı · word.js  .docx çıktısı (docx kütüphanesi, tıklanınca yüklenir)
  depo.js / gorsel.js / yedek.js   IndexedDB kayıt, görseller, .sinav yedek dosyası · optikAktar.js  optiğe anahtar aktarımı
scripts/opencv-kopyala.mjs  derlemeden önce OpenCV'yi public/opencv/ altına kopyalar (+ hızlı iki parçalı sürüm)
arac/                  form üretici, sahte kâğıt üretici ve tüm test araçları
```

### Hız

Okuma sonuçları değişmeden (aynı kâğıtlarda bayt bayt aynı çıktı) şu hızlandırmalar yapıldı:

- **Okuyucu açılışı:** `opencv.js` içindeki gömülü WebAssembly kodu derlemede ayrı bir `.wasm` dosyasına çıkarılır; tarayıcı 13 MB'lık
  metni ayrıştırıp çözmek zorunda kalmaz. Hızlı sürümde herhangi bir sorun olursa tek parça dosyaya otomatik dönülür.
  Referans görüntü ve iş parçacığı indirme sırasında paralel hazırlanır.
- **Okuyucu kurulumu:** referans görüntü döngüsünde her piksel için yeniden oluşturulan bellek görünümü döngü dışına alındı.
- **Kâğıt başına okuma:** perspektif düzeltme WebAssembly SIMD ile ~4 kat hızlı. OpenCV'nin kendi kodunun işlem sırasını birebir
  izler; okuyucu her açılışta sonucu OpenCV ile karşılaştırır, en küçük farkta (ya da SIMD olmayan tarayıcıda) OpenCV'ye döner.
- **Arayüz:** yazı tipi siteyle birlikte gelir (Google Fonts beklenmez), indirme ilerlemesi ekranı her parçada yeniden çizmez,
  kamera karesi için ayrı tuval (her okumada büyük bellek ayırma yok), Excel modülü sonuç ekranı açılınca önceden yüklenir.

| Ölçüm (masaüstü, aynı makine) | Önce | Sonra |
|---|---|---|
| Okuyucu hazır (sayfa açılışından) | 2,4–3,1 sn | 0,7 sn |
| Okuyucu kurulumu (`okuyucuOlustur`) | ~500 ms | ~90 ms |
| Bir kâğıt okuma (`oku`, 242 kâğıt ort.) | 491 ms | 341 ms |
| Perspektif düzeltme | ~210 ms | ~55 ms |

```bash
npm install
npm run dev            # yerel geliştirme (http://localhost:5173)
npm run build          # dist/ klasörüne derler
npm test               # puanlama / karar mantığı + sınav hazırlama (gruplar, anahtar, puan) birim testleri

# okuyucu testleri (python3 + opencv-python + pymupdf + reportlab + numpy gerekir)
python3 arac/form_uret.py                                    # formu / geometriyi / referansı yeniden üret
python3 arac/sentetik2.py /tmp/deneme 200 1 video,telefon,tarayici,whatsapp
node arac/js_test.mjs /tmp/deneme                            # sessiz hata sayısını raporlar
# tarayıcı testleri (playwright): önce `npm run build && npx vite preview`
python3 arac/e2e_veri.py /tmp/e2e && python3 arac/e2e_video.py /tmp/e2e
python3 arac/e2e_kamera_test.py /tmp/e2e http://localhost:4173/   # anahtar + öğrenciler canlı kamerayla, Excel
python3 arac/yukleme_test.py http://localhost:4173/
python3 arac/e2e_sinav_test.py http://localhost:4173/             # sınav hazırla: tüm soru türleri, görsel, A–D grupları,
                                                                  # anahtar doğrulaması, PDF, Word, yedek, optiğe aktarma
# (arac/e2e_test.py ve arac/kamera_test.py kaldırılan "fotoğraftan okut" düğmesini kullanır; yerlerine e2e_kamera_test.py)
```
