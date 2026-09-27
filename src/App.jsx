import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Kamera from './bilesenler/Kamera.jsx'
import AnahtarDuzenle from './bilesenler/AnahtarDuzenle.jsx'
import KontrolPenceresi from './bilesenler/KontrolPenceresi.jsx'
import Simge, { Logo } from './bilesenler/Simge.jsx'
import { hazirla } from './omr/istemci.js'
import * as depo from './depo.js'
import { basariSesi, uyariSesi, sesiAc } from './ses.js'
import {
  varsayilanAyar, soruPuani, puanla, sayiTR, adSoyad, sorunlariBul, kitapcikSec,
  kayitOlustur, tekrarKontrol, anahtarTaslagi, SIKLAR,
} from './mantik.js'

const anahtarTamam = s => Object.keys(s.anahtarlar).length > 0 &&
  Object.values(s.anahtarlar).every(a => a.slice(0, s.ayar.soruSayisi).every(x => x != null))

const yeniSinav = () => ({ ayar: varsayilanAyar(), anahtarlar: {}, ogrenciler: [], ekran: 'ayar', olusturma: Date.now() })

const ADIMLAR = [['ayar', 'Ayarlar', 'Ayarlar'], ['anahtar', 'Cevap anahtarı', 'Anahtar'], ['okut', 'Okut', 'Okut'], ['sonuc', 'Sonuç', 'Sonuç']]

/** Ad soyadın baş harfleri (liste avatarı) */
const basHarf = o => {
  const t = adSoyad(o)
  if (t === 'İsimsiz') return '?'
  return t.split(' ').filter(Boolean).slice(0, 2).map(k => k[0]).join('').toLocaleUpperCase('tr-TR')
}

export default function App() {
  const [sinav, setSinav] = useState(() => {
    const d = depo.yukle()
    return d ? { ...d, ekran: d.ekran === 'ayar' ? 'ayar' : d.ekran } : yeniSinav()
  })
  const [devamSor] = useState(() => { const d = depo.yukle(); return !!(d && d.ogrenciler.length) })
  const [okuyucuDurum, setOkuyucuDurum] = useState('yukleniyor')
  const [yukleme, setYukleme] = useState({ oran: 0, mesaj: 'Okuyucu indiriliyor…' })
  const [kayitHatasi, setKayitHatasi] = useState(false)

  useEffect(() => { setKayitHatasi(!depo.kaydet(sinav)) }, [sinav])
  const okuyucuBaslat = useCallback(() => {
    setOkuyucuDurum('yukleniyor')
    hazirla((oran, mesaj) => setYukleme(y => (y.oran === oran && y.mesaj === (mesaj || y.mesaj) ? y : { oran, mesaj: mesaj || y.mesaj })))
      .then(() => setOkuyucuDurum('hazir'))
      .catch(e => setOkuyucuDurum('hata:' + e.message))
  }, [])
  useEffect(() => { okuyucuBaslat() }, [okuyucuBaslat])

  const git = ekran => setSinav(s => ({ ...s, ekran }))
  const ortak = { sinav, setSinav, git, okuyucuDurum, yukleme }
  const siraNo = ADIMLAR.findIndex(([e]) => e === sinav.ekran)
  const yuzde = Math.round(yukleme.oran * 100)

  return (
    <div className="uygulama" onPointerDown={sesiAc}>
      <header className="ust">
        <div className="ust-ic">
          <a className="marka" href="#/" title="Ana sayfa" aria-label="Ana sayfaya dön">
            <span className="marka-geri" aria-hidden="true"><Simge ad="geri" boyut={16} kalinlik={2.2} /></span>
            <Logo />
            <div className="logo">Optik Okuyucu</div>
          </a>
          <div className={'okuyucu-rozet ' + (okuyucuDurum === 'hazir' ? 'hazir' : okuyucuDurum === 'yukleniyor' ? 'yukleniyor' : 'hata')}
            title={okuyucuDurum === 'hazir' ? 'Okuyucu hazır' : okuyucuDurum === 'yukleniyor' ? yukleme.mesaj : 'Okuyucu yüklenemedi'}>
            <span className="rozet-nokta" aria-hidden="true" />
            <span>{okuyucuDurum === 'hazir' ? 'Hazır' : okuyucuDurum === 'yukleniyor' ? `%${yuzde}` : 'Hata'}</span>
          </div>
        </div>
        <nav className="adimlar" aria-label="Adımlar">
          {ADIMLAR.map(([e, ad, kisa], i) => {
            const bitti = i < siraNo
            return (
              <button key={e} type="button" className={(sinav.ekran === e ? 'aktif' : '') + (bitti ? ' bitti' : '')}
                aria-current={sinav.ekran === e ? 'step' : undefined}
                disabled={(e === 'okut' || e === 'sonuc') && !anahtarTamam(sinav)}
                onClick={() => git(e)}>
                <span className="adim-no" aria-hidden="true">{bitti ? <Simge ad="onay" boyut={11} kalinlik={3} /> : i + 1}</span>
                <span className="adim-ad"><span className="uzun">{ad}</span><span className="kisa" aria-hidden="true">{kisa}</span></span>
              </button>
            )
          })}
        </nav>
      </header>
      {kayitHatasi && <div className="hata-kutu ince"><Simge ad="uyari" />Tarayıcı veriyi kaydedemiyor (gizli sekme olabilir). Sayfayı yenilemeyin.</div>}
      {okuyucuDurum === 'yukleniyor' && (
        <div className="yukleme" role="status">
          <div className="yukleme-ust">
            <span className="yukleme-simge" aria-hidden="true"><span className="donen" /></span>
            <span className="yukleme-metin"><b>{yukleme.mesaj}</b><small className="kucuk-not">İlk açılışta bir kez indirilir, sonra önbellekten anında açılır</small></span>
            <span className="yukleme-yuzde">%{yuzde}</span>
          </div>
          <div className="yukleme-cubuk"><span style={{ width: `${yuzde}%` }} /></div>
        </div>
      )}
      {okuyucuDurum.startsWith('hata') && (
        <div className="hata-kutu ince">
          <Simge ad="uyari" />
          <div>
            <b>Okuyucu yüklenemedi.</b> {okuyucuDurum.slice(5)}
            <div className="dugmeler sol"><button type="button" className="ikincil" onClick={okuyucuBaslat}><Simge ad="yenile" />Tekrar dene</button></div>
          </div>
        </div>
      )}
      <main key={sinav.ekran}>
        {sinav.ekran === 'ayar' && <AyarEkrani {...ortak} devamSor={devamSor} />}
        {sinav.ekran === 'anahtar' && <AnahtarEkrani {...ortak} />}
        {sinav.ekran === 'okut' && <OkutEkrani {...ortak} />}
        {sinav.ekran === 'sonuc' && <SonucEkrani {...ortak} />}
      </main>
    </div>
  )
}

function EkranBaslik({ adim, baslik, children }) {
  return (
    <div className="ekran-baslik">
      <span className="ust-baslik">Adım {adim} / 4</span>
      <h1>{baslik}</h1>
      {children && <p className="aciklama">{children}</p>}
    </div>
  )
}

// =====================================================================
function AyarEkrani({ sinav, setSinav, git, devamSor }) {
  const a = sinav.ayar
  const [goster, setGoster] = useState(devamSor)
  const ayarla = (k, v) => setSinav(s => ({ ...s, ayar: { ...s.ayar, [k]: v } }))
  const N = Number(a.soruSayisi) || 0
  const gecerli = N >= 1 && N <= 80
  return (
    <section className="kart">
      {goster && (
        <div className="bilgi-kutu devam-kutu">
          <span className="kutu-simge"><Simge ad="bilgi" /></span>
          <div>
            <b>Yarım kalan sınav bulundu:</b> {sinav.ayar.sinavAdi || 'isimsiz sınav'}, {sinav.ogrenciler.length} öğrenci okunmuş.
            <div className="dugmeler sol">
              <button type="button" className="birincil" onClick={() => { setGoster(false); git(Object.keys(sinav.anahtarlar).length ? 'okut' : 'anahtar') }}>Kaldığım yerden devam et<Simge ad="ileri" /></button>
              <button type="button" className="ikincil" onClick={() => { if (confirm('Yarım kalan sınav silinsin mi? (Önce Excel almadıysanız veriler kaybolur.)')) { setSinav(yeniSinav()); setGoster(false) } }}>Yeni sınav başlat</button>
            </div>
          </div>
        </div>
      )}
      <EkranBaslik adim={1} baslik="Sınav ayarları">Puanlama kurallarını belirleyin; okutma sırasında her kâğıt bu kurallarla anında puanlanır.</EkranBaslik>
      <label className="alan"><span className="alan-ad">Sınav adı <span className="alan-not">isteğe bağlı</span></span>
        <input value={a.sinavAdi} onChange={e => ayarla('sinavAdi', e.target.value)} placeholder="Örn. 9-A Matematik 1. Yazılı" />
      </label>
      {sinav.ogrenciler.length > 0 && <div className="uyari-kutu"><Simge ad="uyari" />Bu sınavda {sinav.ogrenciler.length} kâğıt okundu. Ayarları değiştirirseniz tüm puanlar yeniden hesaplanır.</div>}
      <div className="alan-izgara">
        <label className="alan"><span className="alan-ad">Soru sayısı <span className="alan-not">1–80</span></span>
          <input type="number" min="1" max="80" inputMode="numeric" value={a.soruSayisi || ''}
            onChange={e => {
              const ham = e.target.value
              if (ham === '') { ayarla('soruSayisi', ''); return }
              const n = parseInt(ham, 10)
              if (Number.isNaN(n)) return
              ayarla('soruSayisi', Math.max(0, Math.min(80, n)))
            }} />
        </label>
        <label className="alan"><span className="alan-ad">Her soru kaç puan?</span>
          <div className="ekli-alan">
            <input type="number" step="0.01" min="0" inputMode="decimal" value={a.soruPuani || ''} placeholder={gecerli ? `Otomatik: ${sayiTR(100 / N)}` : ''}
              onChange={e => ayarla('soruPuani', parseFloat(String(e.target.value).replace(',', '.')) || 0)} />
            <span className="ek">puan</span>
          </div>
        </label>
      </div>
      <p className="alan-ipucu">
        <span>Puan boş bırakılırsa toplam 100 olacak şekilde hesaplanır.</span>
        <span className="toplam-rozet">Toplam: <b>{gecerli ? sayiTR(soruPuani(a) * N) : '-'}</b></span>
      </p>
      <div className="alan-izgara">
        <label className="alan"><span className="alan-ad">Yanlışlar doğruyu götürsün mü?</span>
          <select value={a.yanlisGoturur} onChange={e => ayarla('yanlisGoturur', Number(e.target.value))}>
            <option value={0}>Hayır</option>
            <option value={4}>4 yanlış 1 doğruyu götürsün</option>
            <option value={3}>3 yanlış 1 doğruyu götürsün</option>
          </select>
        </label>
        <label className="alan"><span className="alan-ad">Birden fazla şık işaretlenmiş soru</span>
          <select value={a.ciftIsaret} onChange={e => ayarla('ciftIsaret', e.target.value)}>
            <option value="yanlis">Yanlış sayılsın</option>
            <option value="bos">Boş sayılsın</option>
          </select>
        </label>
      </div>
      <div className="dugmeler ayrik">
        <a className="ikincil dugme" href="/optik_formu.pdf" download><Simge ad="dosya" />Boş optik formu indir (PDF)</a>
        <button type="button" className="birincil" disabled={!gecerli} onClick={() => git('anahtar')}>Devam: Cevap anahtarı<Simge ad="ileri" /></button>
      </div>
    </section>
  )
}

// =====================================================================
function AnahtarEkrani({ sinav, setSinav, git, okuyucuDurum, yukleme }) {
  const N = sinav.ayar.soruSayisi
  const [kamera, setKamera] = useState(false)
  const [duzenle, setDuzenle] = useState(null) // {baslangic, kitapcik, uyarilar}
  const anahtarlar = sinav.anahtarlar
  const eksikAnahtar = Object.entries(anahtarlar).filter(([, a]) => a.slice(0, N).some(x => x == null)).map(([k]) => k)

  const okundu = useCallback(r => {
    const t = anahtarTaslagi(r, N)
    const uyarilar = []
    if (!t.anahtarIsaretli) uyarilar.push('Bu kâğıtta "CEVAP ANAHTARI" yuvarlağı işaretli değil. Öğrenci kâğıdı okutmadığınızdan emin olun.')
    if (t.fazla > N) uyarilar.push(`Kâğıtta ${t.fazla}. soruya kadar işaret var ama sınav ${N} soru olarak ayarlı. Soru sayısını kontrol edin.`)
    if (t.eksik.length) uyarilar.push(`Şu sorular okunamadı ya da boş: ${t.eksik.map(q => q + 1).join(', ')}. Lütfen işaretleyin.`)
    uyariSesi()
    setKamera(false)
    setDuzenle({ baslangic: t.cevaplar, kitapcik: t.kitapcik || 'A', uyarilar })
  }, [N])

  useEffect(() => {
    if (!kamera) return
    const onceki = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = onceki }
  }, [kamera])

  function kaydet(kitapcik, cevaplar) {
    setSinav(s => ({ ...s, anahtarlar: { ...s.anahtarlar, [kitapcik]: cevaplar } }))
    setDuzenle(null)
    basariSesi()
  }

  return (
    <section className="kart">
      <EkranBaslik adim={2} baslik="Cevap anahtarı">
        Boş bir forma doğru cevapları işaretleyin, <b>CEVAP ANAHTARI</b> yuvarlağını ve kitapçık türünü kodlayın, sonra okutun.
        Birden fazla kitapçık varsa her biri için ayrı anahtar okutun.
      </EkranBaslik>
      {Object.keys(anahtarlar).length > 0 && (
        <div className="anahtar-liste">
          {Object.entries(anahtarlar).sort().map(([k, a]) => (
            <div key={k} className="anahtar-kart">
              <div className="anahtar-kart-ust">
                <span className="kitapcik-rozet">{k}</span>
                <div className="anahtar-kart-baslik">
                  <b>Kitapçık {k}</b>
                  {eksikAnahtar.includes(k)
                    ? <span className="etiket kirmizi">eksik soru var</span>
                    : <span className="etiket yesil"><Simge ad="onay" boyut={12} kalinlik={2.6} />{N} soru tamam</span>}
                </div>
                <div className="anahtar-kart-dugmeler">
                  <button type="button" className="ikincil kucuk" onClick={() => setDuzenle({ baslangic: a, kitapcik: k, uyarilar: [] })}><Simge ad="kalem" boyut={16} />Düzenle</button>
                  <button type="button" className="ikincil kucuk tehlike" onClick={() => { if (confirm(`${k} kitapçığı anahtarı silinsin mi?`)) setSinav(s => { const y = { ...s.anahtarlar }; delete y[k]; return { ...s, anahtarlar: y } }) }}><Simge ad="cop" boyut={16} />Sil</button>
                </div>
              </div>
              <div className="anahtar-harfler">{a.slice(0, N).map((x, i) => <span key={i} title={`${i + 1}. soru`} className={x == null ? 'bos' : ''}>{x == null ? '·' : SIKLAR[x]}</span>)}</div>
            </div>
          ))}
        </div>
      )}
      {kamera ? createPortal(
        <div className="kamera-ekran" role="dialog" aria-modal="true" aria-label="Kamera">
          <div className="kamera-ekran-ust">
            <span className="kamera-ekran-baslik"><Simge ad="anahtar" boyut={16} />Cevap anahtarı</span>
            <button type="button" className="kamera-ekran-kapat" onClick={() => setKamera(false)}><Simge ad="kapat" boyut={16} kalinlik={2.2} />Kapat</button>
          </div>
          <Kamera aktif={!duzenle} onKabul={okundu} ipucu="Cevap anahtarı kâğıdını okutun" />
        </div>,
        document.body,
      ) : (
        <div className="eylem-izgara">
          <button type="button" className="eylem-karti birincil" disabled={okuyucuDurum !== 'hazir'} onClick={() => setKamera(true)}>
            <span className="eylem-simge"><Simge ad="kamera" boyut={22} /></span>
            <span className="eylem-metin">
              <b>{okuyucuDurum === 'hazir' ? 'Anahtarı kamerayla okut' : okuyucuDurum === 'yukleniyor' ? `Okuyucu hazırlanıyor… %${Math.round(yukleme.oran * 100)}` : 'Okuyucu yüklenemedi'}</b>
              <small>Doldurulmuş anahtar formunu kameraya gösterin</small>
            </span>
          </button>
          <button type="button" className="eylem-karti ikincil" onClick={() => setDuzenle({ baslangic: null, kitapcik: 'A', uyarilar: [] })}>
            <span className="eylem-simge"><Simge ad="klavye" boyut={22} /></span>
            <span className="eylem-metin"><b>Elle gir</b><small>Cevapları ekrandan işaretleyin</small></span>
          </button>
        </div>
      )}
      <div className="dugmeler ayrik">
        <button type="button" className="ikincil" onClick={() => git('ayar')}><Simge ad="geri" />Ayarlar</button>
        <button type="button" className="birincil" disabled={!Object.keys(anahtarlar).length || eksikAnahtar.length > 0} onClick={() => git('okut')}>Devam: Öğrenci kâğıtlarını okut<Simge ad="ileri" /></button>
      </div>
      {duzenle && (
        <AnahtarDuzenle baslangic={duzenle.baslangic} soruSayisi={N} kitapcikVarsayilan={duzenle.kitapcik}
          mevcutKitapciklar={Object.keys(anahtarlar)} uyarilar={duzenle.uyarilar}
          onKaydet={kaydet} onIptal={() => setDuzenle(null)} />
      )}
    </section>
  )
}

// =====================================================================
function OkutEkrani({ sinav, setSinav, git, okuyucuDurum }) {
  const { ayar, anahtarlar, ogrenciler } = sinav
  const N = ayar.soruSayisi
  const [bekleyen, setBekleyen] = useState([])        // sırada bekleyen kontrol/çakışma işleri
  const [bildirim, setBildirim] = useState(null)       // {tur, metin, ad?, puan?}
  const [nasil, setNasil] = useState(() => !ogrenciler.length)
  const [detay, setDetay] = useState(null)
  const [kamera, setKamera] = useState(false)
  const sinavRef = useRef(sinav); sinavRef.current = sinav

  const aktifIs = bekleyen[0]
  const bildir = (tur, metin, ek = {}) => { setBildirim({ tur, metin, zaman: Date.now(), ...ek }); (tur === 'tamam' ? basariSesi : uyariSesi)() }

  const puanli = useMemo(() => ogrenciler.map((o, i) => ({ o, i, p: anahtarlar[o.kitapcik] ? puanla(o, anahtarlar[o.kitapcik], ayar) : null })), [ogrenciler, anahtarlar, ayar])
  const enYuksekPuan = soruPuani(ayar) * N

  function kaydetKayit(kayit, cakisma = null) {
    const s = sinavRef.current
    if (!cakisma) {
      const t = tekrarKontrol(kayit, s.ogrenciler, s.ayar.soruSayisi)
      if (t && t.tur === 'ayni') { bildir('uyari', `Bu kâğıt zaten okunmuş (${t.index + 1}. sırada). Tekrar eklenmedi.`); return }
      if (t) { setBekleyen(b => [...b, { tur: 'cakisma', kayit, t, id: Math.random().toString(36).slice(2) }]); uyariSesi(); return }
    }
    setSinav(x => ({ ...x, ogrenciler: [...x.ogrenciler, kayit] }))
    const p = puanla(kayit, s.anahtarlar[kayit.kitapcik], s.ayar)
    bildir('tamam', `✅ ${adSoyad(kayit)} — ${sayiTR(p.puan)}`, { ad: adSoyad(kayit), puan: sayiTR(p.puan) })
  }

  const okundu = useCallback(async (r) => {
    const s = sinavRef.current
    const sorunlar = sorunlariBul(r, s.ayar, s.anahtarlar)
    if (sorunlar.length) {
      setBekleyen(b => [...b, { tur: 'kontrol', r, sorunlar, id: Math.random().toString(36).slice(2) }])
      uyariSesi()
      return
    }
    kaydetKayit(kayitOlustur(r, { kitapcik: kitapcikSec(r, s.anahtarlar) }, s.ayar))
  }, [])

  function isBitti() { setBekleyen(b => b.slice(1)) }

  const sonBildirimYasi = bildirim ? Date.now() - bildirim.zaman : Infinity
  useEffect(() => { if (!bildirim) return; const t = setTimeout(() => setBildirim(null), 5000); return () => clearTimeout(t) }, [bildirim])
  useEffect(() => {
    if (!kamera) return
    const onceki = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = onceki }
  }, [kamera])

  const sonId = ogrenciler.length ? ogrenciler[ogrenciler.length - 1].id : null

  return (
    <section className="okut">
      <div className="okut-ust">
        <div className="okut-ozet">
          <span className="ust-baslik">Adım 3 / 4</span>
          <b>{ayar.sinavAdi || 'Sınav'}</b>
          <div className="cipler">
            <span className="cip">{N} soru</span>
            <span className="cip">soru başı {sayiTR(soruPuani(ayar))} puan</span>
            {Number(ayar.yanlisGoturur) > 0 && <span className="cip">{ayar.yanlisGoturur} yanlış 1 doğru</span>}
            <span className="cip">{Object.keys(anahtarlar).sort().join(', ')} kitapçık</span>
          </div>
        </div>
        <button type="button" className="kucuk-dugme" onClick={() => setNasil(v => !v)}>
          <Simge ad={nasil ? 'kapat' : 'soru'} boyut={15} />{nasil ? 'Kapat' : 'Nasıl okutulur?'}
        </button>
      </div>
      {nasil && (
        <div className="nasil">
          <b>Nasıl okutulur?</b>
          <ol>
            <li>Kâğıdı düz bir masaya koyun, telefonu kâğıda paralel tutun.</li>
            <li><b>Dört köşedeki kare işaretin</b> hepsi ekranda görünsün. Kâğıt kılavuz çerçeveyi doldursun.</li>
            <li>Telefonun ya da elinizin gölgesi kâğıda düşmesin. Işık azsa <b>Işık</b> düğmesini kullanın.</li>
            <li>Köşeler yeşil olunca kıpırdamadan bekleyin. Okuyucu kâğıdı <b>iki kez</b> okuyup karşılaştırır.</li>
            <li>Ad soyad ve puan ekranda görününce sıradaki kâğıdı üstüne koyun. Aynı kâğıt iki kez sayılmaz.</li>
            <li>Okuyucu emin olamadığı bir şey görürse durur ve size sorar.</li>
          </ol>
        </div>
      )}
      <button type="button" className="birincil kahraman" disabled={okuyucuDurum !== 'hazir'} onClick={() => setKamera(true)}>
        <span className="kahraman-simge"><Simge ad="kamera" boyut={24} /></span>
        <span className="kahraman-metin">
          <b>{okuyucuDurum === 'hazir' ? 'Kamerayla okut' : okuyucuDurum === 'yukleniyor' ? 'Okuyucu hazırlanıyor…' : 'Okuyucu yüklenemedi'}</b>
          <small>{ogrenciler.length ? 'Sıradaki kâğıtlarla devam edin' : 'Kâğıtları sırayla kameraya gösterin'}</small>
        </span>
        <Simge ad="ileri" boyut={20} className="kahraman-ok" />
      </button>
      <div className="dugmeler ayrik">
        <button type="button" className="ikincil" onClick={() => git('anahtar')}><Simge ad="geri" />Anahtar</button>
        <button type="button" className="ikincil vurgulu" onClick={() => git('sonuc')}>Bitti<Simge ad="ileri" boyut={16} />Excel</button>
      </div>

      {kamera && createPortal(
        <div className={'kamera-ekran' + (aktifIs ? ' kamera-ekran-beklemede' : '')} role="dialog" aria-modal="true" aria-label="Kamera" aria-hidden={!!aktifIs}>
          <div className="kamera-ekran-ust">
            <span className="kamera-ekran-baslik"><span className="sayi-rozet">{ogrenciler.length}</span>öğrenci okundu</span>
            <button type="button" className="kamera-ekran-kapat" onClick={() => setKamera(false)}><Simge ad="kapat" boyut={16} kalinlik={2.2} />Kapat</button>
          </div>
          <div className="okut-kamera">
            <Kamera aktif={!aktifIs && okuyucuDurum === 'hazir'} onKabul={okundu} />
            {bildirim && sonBildirimYasi < 5000 && (
              <div key={bildirim.zaman} className={'bildirim ' + bildirim.tur} role="status">
                {bildirim.ad != null ? (
                  <>
                    <span className="bildirim-sr">{bildirim.metin}</span>
                    <span className="bildirim-simge" aria-hidden="true"><Simge ad="onay" boyut={20} kalinlik={2.6} /></span>
                    <span className="bildirim-ad" aria-hidden="true">{bildirim.ad}</span>
                    <span className="bildirim-puan" aria-hidden="true">{bildirim.puan}</span>
                  </>
                ) : (
                  <>
                    <span className="bildirim-simge" aria-hidden="true"><Simge ad={bildirim.tur === 'tamam' ? 'onay' : 'uyari'} boyut={20} kalinlik={2.2} /></span>
                    <span className="bildirim-metin">{bildirim.metin.replace(/^✅\s*/, '')}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      <div className="liste-kart">
        <div className="liste-baslik">
          <span>SINAV SONUÇLARI</span>
          <span className="sayac">{ogrenciler.length} öğrenci</span>
        </div>
        {!ogrenciler.length && (
          <div className="bos-liste">
            <span className="bos-simge"><Simge ad="kagit" boyut={26} kalinlik={1.5} /></span>
            <b>Henüz kâğıt okunmadı.</b>
            <small>Okunan her kâğıt puanıyla birlikte burada görünür.</small>
          </div>
        )}
        <ol className="sonuc-listesi" reversed={false}>
          {[...puanli].reverse().map(({ o, i, p }) => (
            <li key={o.id} onClick={() => setDetay(i)} className={(o.notlar?.length ? 'notlu' : '') + (o.id === sonId ? ' yeni' : '')}>
              <span className="sira">{i + 1}.</span>
              <span className="avatar" aria-hidden="true">{basHarf(o)}</span>
              <span className="isim"><span className="isim-ad">{adSoyad(o)}</span><small>{o.no ? `No ${o.no} · ` : ''}{o.kitapcik}</small></span>
              <span className="puan-kutu">
                <span className="puan">{p ? sayiTR(p.puan) : '—'}</span>
                {p && <span className="puan-cubuk" aria-hidden="true"><span style={{ width: `${Math.min(100, enYuksekPuan ? p.puan / enYuksekPuan * 100 : 0)}%` }} /></span>}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {aktifIs && aktifIs.tur === 'kontrol' && createPortal(
        <KontrolPenceresi key={aktifIs.id} sonuc={aktifIs.r} sorunlar={aktifIs.sorunlar} ayar={ayar} anahtarlar={anahtarlar}
          onAtla={() => { isBitti(); bildir('uyari', 'Kâğıt atlandı. İsterseniz tekrar okutun.') }}
          onOnay={karar => { isBitti(); kaydetKayit(kayitOlustur(aktifIs.r, karar, ayar)) }} />,
        document.body,
      )}
      {aktifIs && aktifIs.tur === 'cakisma' && createPortal(
        <CakismaPenceresi key={aktifIs.id} is={aktifIs} ogrenciler={ogrenciler} anahtarlar={anahtarlar} ayar={ayar}
          onSec={secim => {
            const { kayit, t } = aktifIs
            isBitti()
            if (secim === 'degistir') {
              setSinav(x => ({ ...x, ogrenciler: x.ogrenciler.map((o, j) => (j === t.index ? { ...kayit, id: o.id } : o)) }))
              bildir('tamam', `✅ ${adSoyad(kayit)} güncellendi`)
            } else if (secim === 'ikisi') kaydetKayit(kayit, true)
            else bildir('uyari', 'Yeni okunan kâğıt kaydedilmedi.')
          }} />,
        document.body,
      )}
      {detay != null && ogrenciler[detay] && (
        <OgrenciDetay o={ogrenciler[detay]} sira={detay + 1} ayar={ayar} anahtarlar={anahtarlar} onKapat={() => setDetay(null)}
          onGuncelle={y => setSinav(x => ({ ...x, ogrenciler: x.ogrenciler.map((o, j) => (j === detay ? y : o)) }))}
          onSil={() => { setSinav(x => ({ ...x, ogrenciler: x.ogrenciler.filter((_, j) => j !== detay) })); setDetay(null) }} />
      )}
    </section>
  )
}

function CakismaPenceresi({ is, ogrenciler, anahtarlar, ayar, onSec }) {
  const eski = ogrenciler[is.t.index]
  const pe = anahtarlar[eski.kitapcik] ? puanla(eski, anahtarlar[eski.kitapcik], ayar) : null
  const py = anahtarlar[is.kayit.kitapcik] ? puanla(is.kayit, anahtarlar[is.kayit.kitapcik], ayar) : null
  return (
    <div className="pencere-arka">
      <div className="pencere" role="dialog" aria-modal="true">
        <div className="pencere-bas">
          <span className="pencere-simge uyari"><Simge ad="uyari" /></span>
          <h2>{is.t.tur === 'ayniNo' ? 'Aynı numara daha önce okundu' : 'Aynı isim daha önce okundu'}</h2>
        </div>
        <div className="pencere-govde">
          <table className="kiyas">
            <tbody>
              <tr><th></th><th>Önceki ({is.t.index + 1}. sıra)</th><th>Yeni okunan</th></tr>
              <tr><td>Ad Soyad</td><td>{adSoyad(eski)}</td><td>{adSoyad(is.kayit)}</td></tr>
              <tr><td>Numara</td><td>{eski.no || '-'}</td><td>{is.kayit.no || '-'}</td></tr>
              <tr><td>Kitapçık</td><td>{eski.kitapcik}</td><td>{is.kayit.kitapcik}</td></tr>
              <tr><td>Puan</td><td>{pe ? sayiTR(pe.puan) : '-'}</td><td>{py ? sayiTR(py.puan) : '-'}</td></tr>
            </tbody>
          </table>
          <p className="aciklama">İki kâğıdın cevapları farklı. Aynı öğrencinin kâğıdı yeniden mi okutuldu, yoksa iki öğrenci aynı numarayı mı yazdı?</p>
        </div>
        <div className="pencere-alt">
          <div className="dugmeler dikey">
            <button type="button" className="birincil" onClick={() => onSec('degistir')}>Öncekini sil, yenisini kaydet</button>
            <button type="button" className="ikincil" onClick={() => onSec('ikisi')}>İkisini de kaydet (farklı öğrenciler)</button>
            <button type="button" className="ikincil" onClick={() => onSec('iptal')}>Yeni okunanı kaydetme</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function OgrenciDetay({ o, sira, ayar, anahtarlar, onKapat, onGuncelle, onSil }) {
  const [ad, setAd] = useState(o.ad), [soyad, setSoyad] = useState(o.soyad), [no, setNo] = useState(o.no)
  const [kitapcik, setKitapcik] = useState(o.kitapcik)
  const a = anahtarlar[kitapcik]
  const p = a ? puanla({ ...o, kitapcik }, a, ayar) : null
  const degisti = ad !== o.ad || soyad !== o.soyad || no !== o.no || kitapcik !== o.kitapcik
  return (
    <div className="pencere-arka" onClick={onKapat}>
      <div className="pencere genis" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="pencere-bas">
          <span className="avatar buyuk" aria-hidden="true">{basHarf(o)}</span>
          <h2>{sira}. {adSoyad(o)}</h2>
          <button type="button" className="pencere-kapat" aria-label="Kapat" onClick={onKapat}><Simge ad="kapat" boyut={18} /></button>
        </div>
        <div className="pencere-govde">
          <div className="form-izgara">
            <label>Ad<input value={ad} onChange={e => setAd(e.target.value.toLocaleUpperCase('tr-TR'))} /></label>
            <label>Soyad<input value={soyad} onChange={e => setSoyad(e.target.value.toLocaleUpperCase('tr-TR'))} /></label>
            <label>Numara<input value={no} inputMode="numeric" onChange={e => setNo(e.target.value.replace(/\D/g, ''))} /></label>
            <label>Kitapçık<select value={kitapcik || ''} onChange={e => setKitapcik(e.target.value)}>
              {Object.keys(anahtarlar).map(k => <option key={k} value={k}>{k}</option>)}
            </select></label>
          </div>
          {p && (
            <div className="detay-ozet">
              <div className="d"><span>{p.d}</span>Doğru</div>
              <div className="y"><span>{p.y}</span>Yanlış</div>
              <div className="b"><span>{p.b}</span>Boş</div>
              <div><span>{sayiTR(p.net)}</span>Net</div>
              <div className="vurgu"><span>{sayiTR(p.puan)}</span>Puan</div>
            </div>
          )}
          <div className="cevap-izgara">
            {Array.from({ length: ayar.soruSayisi }, (_, q) => {
              const c = o.cevaplar[q]
              const d = p ? p.detay[q] : 'b'
              return (
                <div key={q} className={'cevap-hucre ' + d}>
                  <small>{q + 1}</small>
                  <b>{c.t === 'c' ? SIKLAR[c.k] : c.t === 'x' ? c.ks.map(k => SIKLAR[k]).join('') : '–'}</b>
                  {a && d !== 'd' && <small className="dogrusu">{SIKLAR[a[q]]}</small>}
                </div>
              )
            })}
          </div>
          {o.notlar?.length > 0 && <p className="kucuk-not">Not: {o.notlar.join('; ')}</p>}
        </div>
        <div className="pencere-alt">
          <div className="dugmeler">
            <button type="button" className="ikincil tehlike" onClick={() => { if (confirm('Bu öğrencinin kaydı silinsin mi?')) onSil() }}><Simge ad="cop" boyut={16} />Kaydı sil</button>
            <span className="bosluk" />
            <button type="button" className="ikincil" onClick={onKapat}>Kapat</button>
            <button type="button" className="birincil" disabled={!degisti} onClick={() => { onGuncelle({ ...o, ad, soyad, no, kitapcik }); onKapat() }}>Değişiklikleri kaydet</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
function Dagilim({ puanlar, enYuksek }) {
  // Puan dağılımı: en yüksek alınabilecek puana göre 10 dilim
  const dilim = Array(10).fill(0)
  for (const p of puanlar) dilim[Math.min(9, Math.max(0, Math.floor((enYuksek ? p / enYuksek : 0) * 10)))]++
  const maks = Math.max(1, ...dilim)
  return (
    <div className="dagilim" role="img" aria-label="Puan dağılımı">
      <div className="dagilim-baslik"><Simge ad="grafik" boyut={16} />Puan dağılımı</div>
      <div className="dagilim-cubuklar">
        {dilim.map((n, i) => (
          <div key={i} className="dagilim-sutun" title={`${sayiTR(enYuksek * i / 10, 0)}–${sayiTR(enYuksek * (i + 1) / 10, 0)}: ${n} öğrenci`}>
            <span className="dagilim-sayi">{n || ''}</span>
            <span className="dagilim-cubuk" style={{ height: `${n ? Math.max(8, n / maks * 100) : 3}%` }} data-dolu={n ? '1' : '0'} />
          </div>
        ))}
      </div>
      <div className="dagilim-eksen"><span>0</span><span>{sayiTR(enYuksek / 2, 0)}</span><span>{sayiTR(enYuksek, 0)}</span></div>
    </div>
  )
}

function SonucEkrani({ sinav, setSinav, git }) {
  const { ayar, anahtarlar, ogrenciler } = sinav
  const [durum, setDurum] = useState(null) // {tur, metin}
  const [mesgul, setMesgul] = useState(false)
  const [sirala, setSirala] = useState('sira')
  const puanli = ogrenciler.map((o, i) => ({ o, i, p: anahtarlar[o.kitapcik] ? puanla(o, anahtarlar[o.kitapcik], ayar) : null }))
  const puanlar = puanli.filter(x => x.p).map(x => x.p.puan)
  const ort = puanlar.length ? puanlar.reduce((a, b) => a + b, 0) / puanlar.length : 0
  const gorunen = [...puanli].sort((a, b) => sirala === 'puan' ? (b.p?.puan ?? -1) - (a.p?.puan ?? -1) : sirala === 'isim' ? adSoyad(a.o).localeCompare(adSoyad(b.o), 'tr') : a.i - b.i)
  const enYuksekPuan = soruPuani(ayar) * ayar.soruSayisi

  // Excel modülünü ekran açılır açılmaz arka planda hazırla: düğmeye basınca beklemeden oluşsun
  useEffect(() => { import('./excel.js').catch(() => {}) }, [])

  async function dosya() {
    const { excelOlustur, dosyaAdi } = await import('./excel.js')
    const buf = await excelOlustur(sinav)
    return { buf, ad: dosyaAdi(sinav) }
  }
  async function indir() {
    setMesgul(true)
    try {
      const { buf, ad } = await dosya()
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
      const a = document.createElement('a'); a.href = url; a.download = ad; document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      setDurum({ tur: 'tamam', metin: `${ad} indirildi.` })
    } catch (e) { setDurum({ tur: 'hata', metin: 'Excel oluşturulamadı: ' + e.message }) } finally { setMesgul(false) }
  }
  async function paylas() {
    setMesgul(true)
    try {
      const { buf, ad } = await dosya()
      const f = new File([buf], ad, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      if (!navigator.canShare || !navigator.canShare({ files: [f] })) throw new Error('Bu cihaz dosya paylaşımını desteklemiyor. "Excel\'i indir" kullanın.')
      await navigator.share({ files: [f], title: ad, text: `${ayar.sinavAdi || 'Sınav'} sonuçları` })
    } catch (e) { if (e.name !== 'AbortError') setDurum({ tur: 'hata', metin: e.message }) } finally { setMesgul(false) }
  }

  return (
    <section className="kart">
      <EkranBaslik adim={4} baslik="Sonuçlar">{ayar.sinavAdi || 'Sınav'} · {ayar.soruSayisi} soru</EkranBaslik>
      <div className="istatistik">
        <div><span>{ogrenciler.length}</span>öğrenci</div>
        <div className="vurgu"><span>{sayiTR(ort)}</span>ortalama</div>
        <div><span>{puanlar.length ? sayiTR(Math.max(...puanlar)) : '-'}</span>en yüksek</div>
        <div><span>{puanlar.length ? sayiTR(Math.min(...puanlar)) : '-'}</span>en düşük</div>
      </div>
      {puanlar.length > 0 && <Dagilim puanlar={puanlar} enYuksek={enYuksekPuan} />}

      <div className="aktar-kart">
        <div className="aktar-baslik">Sonuçları al</div>
        <div className="dugmeler sol">
          <button type="button" className="birincil" disabled={mesgul || !ogrenciler.length} onClick={indir}>{mesgul ? <span className="donen kucuk" aria-hidden="true" /> : <Simge ad="indir" />}Excel'i indir</button>
          {typeof navigator !== 'undefined' && navigator.share && <button type="button" className="ikincil" disabled={mesgul || !ogrenciler.length} onClick={paylas}><Simge ad="paylas" />Paylaş</button>}
        </div>
        {durum && <div className={durum.tur === 'hata' ? 'hata-kutu' : durum.tur === 'tamam' ? 'basari-kutu' : 'bilgi-kutu'}><Simge ad={durum.tur === 'hata' ? 'uyari' : durum.tur === 'tamam' ? 'onayDaire' : 'bilgi'} /><span>{durum.metin.replace(/^✅\s*/, '')}</span></div>}
      </div>

      <div className="liste-kart">
        <div className="liste-baslik">
          <span>SINAV SONUÇLARI</span>
          <label className="secici"><Simge ad="sirala" boyut={15} />
            <select value={sirala} onChange={e => setSirala(e.target.value)} aria-label="Sıralama">
              <option value="sira">Okutma sırası</option>
              <option value="puan">Puana göre</option>
              <option value="isim">İsme göre</option>
            </select>
          </label>
        </div>
        {!ogrenciler.length && (
          <div className="bos-liste">
            <span className="bos-simge"><Simge ad="kisiler" boyut={26} kalinlik={1.5} /></span>
            <b>Henüz öğrenci yok.</b>
            <small>Okutma ekranında kâğıtları okuttukça sonuçlar burada toplanır.</small>
          </div>
        )}
        <ol className="sonuc-listesi">
          {gorunen.map(({ o, i, p }, j) => (
            <li key={o.id}>
              <span className="sira">{(sirala === 'sira' ? i : j) + 1}.</span>
              <span className="avatar" aria-hidden="true">{basHarf(o)}</span>
              <span className="isim"><span className="isim-ad">{adSoyad(o)}</span><small>{o.no ? `No ${o.no} · ` : ''}{o.kitapcik}{p ? ` · D${p.d} Y${p.y} B${p.b}` : ''}</small></span>
              <span className="puan-kutu">
                <span className="puan">{p ? sayiTR(p.puan) : '—'}</span>
                {p && <span className="puan-cubuk" aria-hidden="true"><span style={{ width: `${Math.min(100, enYuksekPuan ? p.puan / enYuksekPuan * 100 : 0)}%` }} /></span>}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="dugmeler ayrik">
        <button type="button" className="ikincil" onClick={() => git('okut')}><Simge ad="geri" />Okutmaya dön</button>
        <button type="button" className="ikincil tehlike" onClick={() => {
          if (confirm('Bu sınavın tüm verileri silinip yeni sınava başlanacak. Excel\'i aldınız mı?')) { depo.sil(); setSinav(yeniSinav()) }
        }}><Simge ad="yenile" />Yeni sınav</button>
      </div>
    </section>
  )
}
