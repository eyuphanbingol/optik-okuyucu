import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Kamera from './bilesenler/Kamera.jsx'
import AnahtarDuzenle from './bilesenler/AnahtarDuzenle.jsx'
import KontrolPenceresi from './bilesenler/KontrolPenceresi.jsx'
import { hazirla, kagitOku, resimVerisi } from './omr/istemci.js'
import * as depo from './depo.js'
import { basariSesi, uyariSesi, sesiAc } from './ses.js'
import {
  varsayilanAyar, soruPuani, puanla, sayiTR, adSoyad, sorunlariBul, kitapcikSec,
  kayitOlustur, tekrarKontrol, anahtarTaslagi, SIKLAR, yuvarla,
} from './mantik.js'

const anahtarTamam = s => Object.keys(s.anahtarlar).length > 0 &&
  Object.values(s.anahtarlar).every(a => a.slice(0, s.ayar.soruSayisi).every(x => x != null))

const yeniSinav = () => ({ ayar: varsayilanAyar(), anahtarlar: {}, ogrenciler: [], ekran: 'ayar', olusturma: Date.now() })

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
    hazirla((oran, mesaj) => setYukleme({ oran, mesaj }))
      .then(() => setOkuyucuDurum('hazir'))
      .catch(e => setOkuyucuDurum('hata:' + e.message))
  }, [])
  useEffect(() => { okuyucuBaslat() }, [okuyucuBaslat])

  const git = ekran => setSinav(s => ({ ...s, ekran }))
  const ortak = { sinav, setSinav, git, okuyucuDurum, yukleme }

  return (
    <div className="uygulama" onPointerDown={sesiAc}>
      <header className="ust">
        <div className="logo">📝 Optik Okuyucu</div>
        <nav className="adimlar">
          {[['ayar', '1. Ayarlar'], ['anahtar', '2. Cevap anahtarı'], ['okut', '3. Okut'], ['sonuc', '4. Sonuç']].map(([e, ad]) => (
            <button key={e} type="button" className={sinav.ekran === e ? 'aktif' : ''}
              disabled={(e === 'okut' || e === 'sonuc') && !anahtarTamam(sinav)}
              onClick={() => git(e)}>{ad}</button>
          ))}
        </nav>
      </header>
      {kayitHatasi && <div className="hata-kutu ince">Tarayıcı veriyi kaydedemiyor (gizli sekme olabilir). Sayfayı yenilemeyin.</div>}
      {okuyucuDurum === 'yukleniyor' && (
        <div className="yukleme" role="status">
          <div className="yukleme-cubuk"><span style={{ width: `${Math.round(yukleme.oran * 100)}%` }} /></div>
          <small>{yukleme.mesaj} {Math.round(yukleme.oran * 100)}% <span className="kucuk-not">(ilk açılışta ~4 MB indirilir, sonra önbellekten gelir)</span></small>
        </div>
      )}
      {okuyucuDurum.startsWith('hata') && (
        <div className="hata-kutu ince">
          <b>Okuyucu yüklenemedi.</b> {okuyucuDurum.slice(5)}
          <div className="dugmeler sol"><button type="button" className="ikincil" onClick={okuyucuBaslat}>Tekrar dene</button></div>
        </div>
      )}
      <main>
        {sinav.ekran === 'ayar' && <AyarEkrani {...ortak} devamSor={devamSor} />}
        {sinav.ekran === 'anahtar' && <AnahtarEkrani {...ortak} />}
        {sinav.ekran === 'okut' && <OkutEkrani {...ortak} />}
        {sinav.ekran === 'sonuc' && <SonucEkrani {...ortak} />}
      </main>
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
        <div className="bilgi-kutu">
          <b>Yarım kalan sınav bulundu:</b> {sinav.ayar.sinavAdi || 'isimsiz sınav'}, {sinav.ogrenciler.length} öğrenci okunmuş.
          <div className="dugmeler sol">
            <button type="button" className="birincil" onClick={() => { setGoster(false); git(Object.keys(sinav.anahtarlar).length ? 'okut' : 'anahtar') }}>Kaldığım yerden devam et</button>
            <button type="button" className="ikincil" onClick={() => { if (confirm('Yarım kalan sınav silinsin mi? (Önce Excel almadıysanız veriler kaybolur.)')) { setSinav(yeniSinav()); setGoster(false) } }}>Yeni sınav başlat</button>
          </div>
        </div>
      )}
      <h1>Sınav ayarları</h1>
      <label className="alan">Sınav adı (isteğe bağlı)
        <input value={a.sinavAdi} onChange={e => ayarla('sinavAdi', e.target.value)} placeholder="Örn. 9-A Matematik 1. Yazılı" />
      </label>
      {sinav.ogrenciler.length > 0 && <div className="uyari-kutu">Bu sınavda {sinav.ogrenciler.length} kâğıt okundu. Ayarları değiştirirseniz tüm puanlar yeniden hesaplanır.</div>}
      <label className="alan">Soru sayısı (1-80)
        <input type="number" min="1" max="80" inputMode="numeric" value={a.soruSayisi}
          onChange={e => ayarla('soruSayisi', Math.max(0, Math.min(80, parseInt(e.target.value || '0', 10))))} />
      </label>
      <label className="alan">Her soru kaç puan?
        <div className="yan-yana">
          <input type="number" step="0.01" min="0" inputMode="decimal" value={a.soruPuani || ''} placeholder={gecerli ? `Otomatik: ${sayiTR(100 / N)}` : ''}
            onChange={e => ayarla('soruPuani', parseFloat(String(e.target.value).replace(',', '.')) || 0)} />
          <span className="kucuk-not">Boş bırakılırsa toplam 100 olacak şekilde hesaplanır. Toplam: <b>{gecerli ? sayiTR(soruPuani(a) * N) : '-'}</b></span>
        </div>
      </label>
      <label className="alan">Yanlışlar doğruyu götürsün mü?
        <select value={a.yanlisGoturur} onChange={e => ayarla('yanlisGoturur', Number(e.target.value))}>
          <option value={0}>Hayır</option>
          <option value={4}>4 yanlış 1 doğruyu götürsün</option>
          <option value={3}>3 yanlış 1 doğruyu götürsün</option>
        </select>
      </label>
      <label className="alan">Birden fazla şık işaretlenmiş soru
        <select value={a.ciftIsaret} onChange={e => ayarla('ciftIsaret', e.target.value)}>
          <option value="yanlis">Yanlış sayılsın</option>
          <option value="bos">Boş sayılsın</option>
        </select>
      </label>
      <div className="dugmeler">
        <a className="ikincil dugme" href="/optik_formu.pdf" download>📄 Boş optik formu indir (PDF)</a>
        <button type="button" className="birincil" disabled={!gecerli} onClick={() => git('anahtar')}>Devam: Cevap anahtarı →</button>
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

  function kaydet(kitapcik, cevaplar) {
    setSinav(s => ({ ...s, anahtarlar: { ...s.anahtarlar, [kitapcik]: cevaplar } }))
    setDuzenle(null)
    basariSesi()
  }

  return (
    <section className="kart">
      <h1>Cevap anahtarı</h1>
      <p className="aciklama">Boş bir forma doğru cevapları işaretleyin, <b>CEVAP ANAHTARI</b> yuvarlağını ve kitapçık türünü kodlayın, sonra okutun.
        Birden fazla kitapçık varsa her biri için ayrı anahtar okutun.</p>
      {Object.keys(anahtarlar).length > 0 && (
        <div className="anahtar-liste">
          {Object.entries(anahtarlar).sort().map(([k, a]) => (
            <div key={k} className="anahtar-kart">
              <div><b>Kitapçık {k}</b> {eksikAnahtar.includes(k) && <span className="etiket kirmizi">eksik soru var</span>}</div>
              <div className="anahtar-harfler">{a.slice(0, N).map((x, i) => <span key={i} title={`${i + 1}. soru`}>{x == null ? '·' : SIKLAR[x]}</span>)}</div>
              <div className="dugmeler sol">
                <button type="button" className="ikincil" onClick={() => setDuzenle({ baslangic: a, kitapcik: k, uyarilar: [] })}>Düzenle</button>
                <button type="button" className="ikincil tehlike" onClick={() => { if (confirm(`${k} kitapçığı anahtarı silinsin mi?`)) setSinav(s => { const y = { ...s.anahtarlar }; delete y[k]; return { ...s, anahtarlar: y } }) }}>Sil</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {kamera ? (
        <>
          <Kamera aktif={!duzenle} onKabul={okundu} ipucu="Cevap anahtarı kâğıdını okutun" />
          <div className="dugmeler"><button type="button" className="ikincil" onClick={() => setKamera(false)}>Kamerayı kapat</button></div>
        </>
      ) : (
        <div className="dugmeler">
          <button type="button" className="birincil" disabled={okuyucuDurum !== 'hazir'} onClick={() => setKamera(true)}>
            {okuyucuDurum === 'hazir' ? '📷 Anahtarı kamerayla okut' : okuyucuDurum === 'yukleniyor' ? `Okuyucu hazırlanıyor… %${Math.round(yukleme.oran * 100)}` : 'Okuyucu yüklenemedi'}
          </button>
          <FotoOkut okuyucuDurum={okuyucuDurum} onOkundu={okundu} coklu={false} etiket="🖼️ Fotoğraftan okut" />
          <button type="button" className="ikincil" onClick={() => setDuzenle({ baslangic: null, kitapcik: 'A', uyarilar: [] })}>⌨️ Elle gir</button>
        </div>
      )}
      <div className="dugmeler">
        <button type="button" className="ikincil" onClick={() => git('ayar')}>← Ayarlar</button>
        <button type="button" className="birincil" disabled={!Object.keys(anahtarlar).length || eksikAnahtar.length > 0} onClick={() => git('okut')}>Devam: Öğrenci kâğıtlarını okut →</button>
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
function FotoOkut({ okuyucuDurum, onOkundu, onHata, coklu = true, etiket = '🖼️ Fotoğraftan okut' }) {
  const ref = useRef(null)
  const [mesgul, setMesgul] = useState(false)
  async function sec(e) {
    const dosyalar = Array.from(e.target.files || [])
    e.target.value = ''
    setMesgul(true)
    try {
      for (const f of dosyalar) {
        let veri
        try { veri = await resimVerisi(f) } catch (err) { (onHata || alert)(`${f.name}: ${err.message}`); continue }
        const r = await kagitOku(veri, true)
        if (!r.tamam) { (onHata || alert)(`${f.name}: ${r.mesaj}`); continue }
        await onOkundu(r, f.name)
      }
    } finally { setMesgul(false) }
  }
  return (
    <>
      <button type="button" className="ikincil" disabled={okuyucuDurum !== 'hazir' || mesgul} onClick={() => ref.current.click()}>{mesgul ? 'Okunuyor…' : etiket}</button>
      <input ref={ref} type="file" accept="image/*" multiple={coklu} hidden onChange={sec} />
    </>
  )
}

// =====================================================================
function OkutEkrani({ sinav, setSinav, git, okuyucuDurum }) {
  const { ayar, anahtarlar, ogrenciler } = sinav
  const N = ayar.soruSayisi
  const [bekleyen, setBekleyen] = useState([])        // sırada bekleyen kontrol/çakışma işleri
  const [bildirim, setBildirim] = useState(null)       // {tur, metin}
  const [nasil, setNasil] = useState(() => !ogrenciler.length)
  const [detay, setDetay] = useState(null)
  const sinavRef = useRef(sinav); sinavRef.current = sinav

  const aktifIs = bekleyen[0]
  const bildir = (tur, metin) => { setBildirim({ tur, metin, zaman: Date.now() }); (tur === 'tamam' ? basariSesi : uyariSesi)() }

  const puanli = useMemo(() => ogrenciler.map((o, i) => ({ o, i, p: anahtarlar[o.kitapcik] ? puanla(o, anahtarlar[o.kitapcik], ayar) : null })), [ogrenciler, anahtarlar, ayar])

  function kaydetKayit(kayit, cakisma = null) {
    const s = sinavRef.current
    if (!cakisma) {
      const t = tekrarKontrol(kayit, s.ogrenciler, s.ayar.soruSayisi)
      if (t && t.tur === 'ayni') { bildir('uyari', `Bu kâğıt zaten okunmuş (${t.index + 1}. sırada). Tekrar eklenmedi.`); return }
      if (t) { setBekleyen(b => [...b, { tur: 'cakisma', kayit, t, id: Math.random().toString(36).slice(2) }]); uyariSesi(); return }
    }
    setSinav(x => ({ ...x, ogrenciler: [...x.ogrenciler, kayit] }))
    const p = puanla(kayit, s.anahtarlar[kayit.kitapcik], s.ayar)
    bildir('tamam', `✅ ${adSoyad(kayit)} — ${sayiTR(p.puan)}`)
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

  return (
    <section className="okut">
      <div className="okut-ust">
        <div>
          <b>{ayar.sinavAdi || 'Sınav'}</b> · {N} soru · soru başı {sayiTR(soruPuani(ayar))} puan
        </div>
        <button type="button" className="kucuk-dugme" onClick={() => setNasil(v => !v)}>{nasil ? 'Kapat' : 'Nasıl okutulur?'}</button>
      </div>
      {nasil && (
        <div className="nasil">
          <b>Nasıl okutulur?</b>
          <ol>
            <li>Kâğıdı düz bir masaya koyun, telefonu kâğıda paralel tutun.</li>
            <li><b>Dört köşedeki kare işaretin</b> hepsi ekranda görünsün. Kâğıt kesikli çerçeveyi doldursun.</li>
            <li>Telefonun ya da elinizin gölgesi kâğıda düşmesin. Işık azsa 🔦 düğmesini kullanın.</li>
            <li>Köşeler yeşil olunca kıpırdamadan bekleyin. Okuyucu kâğıdı <b>iki kez</b> okuyup karşılaştırır.</li>
            <li>“✅ Ad Soyad — puan” görününce sıradaki kâğıdı üstüne koyun. Aynı kâğıt iki kez sayılmaz.</li>
            <li>Okuyucu emin olamadığı bir şey görürse durur ve size sorar.</li>
          </ol>
        </div>
      )}
      <div className="okut-kamera">
        <Kamera aktif={!aktifIs && okuyucuDurum === 'hazir'} onKabul={okundu} />
        {bildirim && sonBildirimYasi < 5000 && <div className={'bildirim ' + bildirim.tur}>{bildirim.metin}</div>}
      </div>
      <div className="dugmeler">
        <FotoOkut okuyucuDurum={okuyucuDurum} onOkundu={okundu} onHata={m => bildir('uyari', m)} />
        <button type="button" className="ikincil" onClick={() => git('anahtar')}>← Anahtar</button>
        <button type="button" className="birincil" onClick={() => git('sonuc')}>Bitti → Excel</button>
      </div>

      <div className="liste-kart">
        <div className="liste-baslik">
          <span>SINAV SONUÇLARI</span>
          <span className="sayac">{ogrenciler.length} öğrenci</span>
        </div>
        {!ogrenciler.length && <div className="bos-liste">Henüz kâğıt okunmadı.</div>}
        <ol className="sonuc-listesi" reversed={false}>
          {[...puanli].reverse().map(({ o, i, p }) => (
            <li key={o.id} onClick={() => setDetay(i)} className={o.notlar?.length ? 'notlu' : ''}>
              <span className="sira">{i + 1}.</span>
              <span className="isim">{adSoyad(o)}<small>{o.no ? `No ${o.no} · ` : ''}{o.kitapcik}</small></span>
              <span className="puan">{p ? sayiTR(p.puan) : '—'}</span>
            </li>
          ))}
        </ol>
      </div>

      {aktifIs && aktifIs.tur === 'kontrol' && (
        <KontrolPenceresi key={aktifIs.id} sonuc={aktifIs.r} sorunlar={aktifIs.sorunlar} ayar={ayar} anahtarlar={anahtarlar}
          onAtla={() => { isBitti(); bildir('uyari', 'Kâğıt atlandı. İsterseniz tekrar okutun.') }}
          onOnay={karar => { isBitti(); kaydetKayit(kayitOlustur(aktifIs.r, karar, ayar)) }} />
      )}
      {aktifIs && aktifIs.tur === 'cakisma' && (
        <CakismaPenceresi key={aktifIs.id} is={aktifIs} ogrenciler={ogrenciler} anahtarlar={anahtarlar} ayar={ayar}
          onSec={secim => {
            const { kayit, t } = aktifIs
            isBitti()
            if (secim === 'degistir') {
              setSinav(x => ({ ...x, ogrenciler: x.ogrenciler.map((o, j) => (j === t.index ? { ...kayit, id: o.id } : o)) }))
              bildir('tamam', `✅ ${adSoyad(kayit)} güncellendi`)
            } else if (secim === 'ikisi') kaydetKayit(kayit, true)
            else bildir('uyari', 'Yeni okunan kâğıt kaydedilmedi.')
          }} />
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
      <div className="pencere">
        <h2>⚠️ {is.t.tur === 'ayniNo' ? 'Aynı numara daha önce okundu' : 'Aynı isim daha önce okundu'}</h2>
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
        <div className="dugmeler dikey">
          <button type="button" className="birincil" onClick={() => onSec('degistir')}>Öncekini sil, yenisini kaydet</button>
          <button type="button" className="ikincil" onClick={() => onSec('ikisi')}>İkisini de kaydet (farklı öğrenciler)</button>
          <button type="button" className="ikincil" onClick={() => onSec('iptal')}>Yeni okunanı kaydetme</button>
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
      <div className="pencere genis" onClick={e => e.stopPropagation()}>
        <h2>{sira}. {adSoyad(o)}</h2>
        <div className="form-izgara">
          <label>Ad<input value={ad} onChange={e => setAd(e.target.value.toLocaleUpperCase('tr-TR'))} /></label>
          <label>Soyad<input value={soyad} onChange={e => setSoyad(e.target.value.toLocaleUpperCase('tr-TR'))} /></label>
          <label>Numara<input value={no} inputMode="numeric" onChange={e => setNo(e.target.value.replace(/\D/g, ''))} /></label>
          <label>Kitapçık<select value={kitapcik || ''} onChange={e => setKitapcik(e.target.value)}>
            {Object.keys(anahtarlar).map(k => <option key={k} value={k}>{k}</option>)}
          </select></label>
        </div>
        {p && <p><b>Doğru {p.d} · Yanlış {p.y} · Boş {p.b} · Net {sayiTR(p.net)} · Puan {sayiTR(p.puan)}</b></p>}
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
        <div className="dugmeler">
          <button type="button" className="ikincil tehlike" onClick={() => { if (confirm('Bu öğrencinin kaydı silinsin mi?')) onSil() }}>Kaydı sil</button>
          <button type="button" className="ikincil" onClick={onKapat}>Kapat</button>
          <button type="button" className="birincil" disabled={!degisti} onClick={() => { onGuncelle({ ...o, ad, soyad, no, kitapcik }); onKapat() }}>Değişiklikleri kaydet</button>
        </div>
      </div>
    </div>
  )
}

// =====================================================================
function SonucEkrani({ sinav, setSinav, git }) {
  const { ayar, anahtarlar, ogrenciler } = sinav
  const [eposta, setEposta] = useState(() => { try { return localStorage.getItem('optik-okuyucu.eposta') || '' } catch { return '' } })
  const [durum, setDurum] = useState(null) // {tur, metin}
  const [mesgul, setMesgul] = useState(false)
  const [sirala, setSirala] = useState('sira')
  const puanli = ogrenciler.map((o, i) => ({ o, i, p: anahtarlar[o.kitapcik] ? puanla(o, anahtarlar[o.kitapcik], ayar) : null }))
  const puanlar = puanli.filter(x => x.p).map(x => x.p.puan)
  const ort = puanlar.length ? puanlar.reduce((a, b) => a + b, 0) / puanlar.length : 0
  const gorunen = [...puanli].sort((a, b) => sirala === 'puan' ? (b.p?.puan ?? -1) - (a.p?.puan ?? -1) : sirala === 'isim' ? adSoyad(a.o).localeCompare(adSoyad(b.o), 'tr') : a.i - b.i)

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
  async function gonder(e) {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta.trim())) { setDurum({ tur: 'hata', metin: 'Geçerli bir e-posta adresi girin.' }); return }
    setMesgul(true); setDurum({ tur: 'bilgi', metin: 'Gönderiliyor…' })
    try { localStorage.setItem('optik-okuyucu.eposta', eposta.trim()) } catch { /* yok */ }
    try {
      const { buf, ad } = await dosya()
      const bytes = new Uint8Array(buf)
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
      const yanit = await fetch('/api/eposta', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kime: eposta.trim(), sinavAdi: ayar.sinavAdi, dosyaAdi: ad, veri: btoa(bin),
          ozet: { ogrenci: ogrenciler.length, ortalama: yuvarla(ort, 2) },
        }),
      })
      const j = await yanit.json().catch(() => ({}))
      if (!yanit.ok || !j.tamam) throw new Error(j.hata || `Sunucu hatası (${yanit.status})`)
      setDurum({ tur: 'tamam', metin: `✅ Excel ${eposta.trim()} adresine gönderildi. Gelen kutunuzu (ve istenmeyen klasörünü) kontrol edin.` })
    } catch (err) {
      setDurum({ tur: 'hata', metin: `E-posta gönderilemedi: ${err.message}. Dosyayı "Excel'i indir" ya da "Paylaş" ile alabilirsiniz.` })
    } finally { setMesgul(false) }
  }

  return (
    <section className="kart">
      <h1>Sonuçlar</h1>
      <div className="istatistik">
        <div><span>{ogrenciler.length}</span>öğrenci</div>
        <div><span>{sayiTR(ort)}</span>ortalama</div>
        <div><span>{puanlar.length ? sayiTR(Math.max(...puanlar)) : '-'}</span>en yüksek</div>
        <div><span>{puanlar.length ? sayiTR(Math.min(...puanlar)) : '-'}</span>en düşük</div>
      </div>

      <form className="eposta" onSubmit={gonder}>
        <label className="alan">Excel'i e-postayla gönder
          <div className="yan-yana">
            <input type="email" inputMode="email" autoComplete="email" placeholder="ornek@okul.k12.tr" value={eposta} onChange={e => setEposta(e.target.value)} />
            <button type="submit" className="birincil" disabled={mesgul || !ogrenciler.length}>📧 Gönder</button>
          </div>
        </label>
      </form>
      <div className="dugmeler sol">
        <button type="button" className="ikincil" disabled={mesgul || !ogrenciler.length} onClick={indir}>⬇️ Excel'i indir</button>
        {typeof navigator !== 'undefined' && navigator.share && <button type="button" className="ikincil" disabled={mesgul || !ogrenciler.length} onClick={paylas}>📤 Paylaş</button>}
      </div>
      {durum && <div className={durum.tur === 'hata' ? 'hata-kutu' : durum.tur === 'tamam' ? 'basari-kutu' : 'bilgi-kutu'}>{durum.metin}</div>}

      <div className="liste-kart">
        <div className="liste-baslik">
          <span>SINAV SONUÇLARI</span>
          <select value={sirala} onChange={e => setSirala(e.target.value)}>
            <option value="sira">Okutma sırası</option>
            <option value="puan">Puana göre</option>
            <option value="isim">İsme göre</option>
          </select>
        </div>
        <ol className="sonuc-listesi">
          {gorunen.map(({ o, i, p }, j) => (
            <li key={o.id}>
              <span className="sira">{(sirala === 'sira' ? i : j) + 1}.</span>
              <span className="isim">{adSoyad(o)}<small>{o.no ? `No ${o.no} · ` : ''}{o.kitapcik}{p ? ` · D${p.d} Y${p.y} B${p.b}` : ''}</small></span>
              <span className="puan">{p ? sayiTR(p.puan) : '—'}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="dugmeler">
        <button type="button" className="ikincil" onClick={() => git('okut')}>← Okutmaya dön</button>
        <button type="button" className="ikincil tehlike" onClick={() => {
          if (confirm('Bu sınavın tüm verileri silinip yeni sınava başlanacak. Excel\'i aldınız mı?')) { depo.sil(); setSinav(yeniSinav()) }
        }}>Yeni sınav</button>
      </div>
    </section>
  )
}
