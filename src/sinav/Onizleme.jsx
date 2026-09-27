import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Simge from '../bilesenler/Simge.jsx'
import { GrupSayfalari, CevapAnahtari, SAYFA } from './Baski.jsx'
import { tumGruplar } from './karistir.js'
import { eksikler, soruSayisi, toplamPuan, GRUP_HARFLERI } from './model.js'
import { duzMetin } from './metin.js'
import { Acilir, MenuOge, MenuAyrac, Secici, Anahtar, Pencere, useBildirim } from './arayuz.jsx'
import { optigeAktarilabilir, optikDurumu } from './optikAktar.js'
import * as optikDepo from '../depo.js'
import { indirBlob, dosyaAdi } from './yedek.js'

const MM_PX = 96 / 25.4

export default function Onizleme({ sinav, degistir, kaydetSimdi }) {
  const gruplar = useMemo(() => tumGruplar(sinav), [sinav])
  const [sekme, setSekme] = useState(0)                 // 0..3 grup, 'anahtar'
  const [bilgi, setBilgi] = useState({})                // grup -> { sayfa, tasan }
  const [baski, setBaski] = useState(null)              // { gruplar: [...], anahtar: bool }
  const [olcek, setOlcek] = useState(1)
  const [optikPencere, setOptikPencere] = useState(false)
  const [wordMesgul, setWordMesgul] = useState(false)
  const [bildirim, bildir] = useBildirim()
  const alan = useRef(null)
  const a = sinav.ayar
  const ayarla = (k, v) => degistir(s => ({ ...s, ayar: { ...s.ayar, [k]: v } }))
  const eksik = useMemo(() => eksikler(sinav, duzMetin), [sinav])
  const optik = useMemo(() => optigeAktarilabilir(sinav), [sinav])

  useEffect(() => { if (typeof sekme === 'number' && sekme >= gruplar.length) setSekme(0) }, [gruplar.length, sekme])
  // ayar değişince eski sayfa sayıları geçersiz (açık sekme yeniden ölçülür, diğerleri açılınca)
  useEffect(() => { setBilgi({}) }, [gruplar])

  // sayfaları ekrana sığdır
  useEffect(() => {
    const el = alan.current
    if (!el) return
    const hesapla = () => {
      const g = el.clientWidth - 32
      setOlcek(Math.min(1, g / (SAYFA.g * MM_PX)))
    }
    hesapla()
    const ro = new ResizeObserver(hesapla)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ---- yazdırma: seçilen tüm sayfalar gövdeye ayrı bir alan olarak çizilir, yerleşim bitince yazdırma penceresi açılır
  const [baskiHazir, setBaskiHazir] = useState({})
  const yazdir = useCallback((secim) => {
    setBaskiHazir({})
    setBaski(secim)
  }, [])
  useEffect(() => {
    if (!baski) return
    const beklenen = baski.gruplar.length
    const hazirSayi = Object.keys(baskiHazir).length
    if (hazirSayi < beklenen) return
    const html = document.documentElement
    html.classList.add('sh-yazdir')
    const bitti = () => { html.classList.remove('sh-yazdir'); setBaski(null); window.removeEventListener('afterprint', bitti) }
    window.addEventListener('afterprint', bitti)
    const t = setTimeout(() => {
      try { window.print() } finally {
        // bazı tarayıcılar afterprint göndermez
        setTimeout(() => { if (html.classList.contains('sh-yazdir')) bitti() }, 1500)
      }
    }, 120)
    return () => clearTimeout(t)
  }, [baski, baskiHazir])

  // kısayol: Ctrl+P bu ekranda doğru baskıyı başlatır
  useEffect(() => {
    const f = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); yazdir({ gruplar: gruplar.map((_, i) => i), anahtar: false }) }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [gruplar, yazdir])

  const wordIndir = useCallback(async (secim = { gruplar: gruplar.map((_, i) => i), anahtar: true }) => {
    setWordMesgul(true)
    try {
      await kaydetSimdi()
      const { wordOlustur } = await import('./word.js')
      const blob = await wordOlustur(sinav, secim)
      indirBlob(blob, dosyaAdi(sinav, 'docx'))
      bildir('Word dosyası indirildi.')
    } catch (e) {
      console.error(e)
      bildir('Word dosyası oluşturulamadı: ' + (e.message || e), 'hata')
    } finally { setWordMesgul(false) }
  }, [sinav, gruplar, kaydetSimdi])

  useEffect(() => {
    const f = () => wordIndir()
    window.addEventListener('sh-word', f)
    return () => window.removeEventListener('sh-word', f)
  }, [wordIndir])

  const tumGruplarSecim = { gruplar: gruplar.map((_, i) => i), anahtar: false }
  const sayfaToplam = gruplar.reduce((t, g) => t + (bilgi[g.harf]?.sayfa || 0), 0)
  const tasan = Object.values(bilgi).flatMap(x => x.tasan || [])

  return (
    <div className="sh-onizleme">
      <header className="sh-ust">
        <a className="sh-ust-geri" href={`#/sinav/${sinav.id}`} title="Düzenlemeye dön" aria-label="Düzenlemeye dön"><Simge ad="geri" boyut={18} /></a>
        <div className="sh-ust-ad">
          <span className="sh-ust-baslik salt">{sinav.baslik.sinavAdi || 'Adsız sınav'}</span>
          <span className="sh-ust-alt">Önizleme · {soruSayisi(sinav.ogeler)} soru · {toplamPuan(sinav.ogeler)} puan{sayfaToplam ? ` · ${gruplar.length > 1 ? `grup başına ${bilgi.A?.sayfa || '–'}` : bilgi.A?.sayfa} sayfa` : ''}</span>
        </div>
        <div className="sh-ust-eylem">
          <a className="ikincil sh-ust-dugme" href={`#/sinav/${sinav.id}`}><Simge ad="kalem" /><span>Düzenle</span></a>
          <button type="button" className="ikincil sh-ust-dugme" disabled={wordMesgul} onClick={() => wordIndir()}>{wordMesgul ? <span className="donen kucuk" /> : <Simge ad="word" />}<span>Word</span></button>
          <div className="sh-bolunmus">
            <button type="button" className="birincil" onClick={() => yazdir(tumGruplarSecim)}><Simge ad="yazdir" /><span>Yazdır / PDF</span></button>
            <Acilir hiza="sag" genislik={290} tetik={<button type="button" className="birincil sh-bolunmus-ok" aria-label="Yazdırma seçenekleri"><Simge ad="asagi" boyut={16} /></button>}>
              <div className="sh-menu-baslik">Yazdır ya da PDF olarak kaydet</div>
              <MenuOge simge="kopya" aciklama={gruplar.length > 1 ? `${gruplar.map(g => g.harf).join(', ')} grupları art arda` : 'Öğrenci kâğıdı'} onClick={() => yazdir(tumGruplarSecim)}>{gruplar.length > 1 ? 'Tüm gruplar' : 'Sınav kâğıdı'}</MenuOge>
              <MenuOge simge="anahtar" aciklama="Sınav kâğıtları + öğretmen nüshası" onClick={() => yazdir({ ...tumGruplarSecim, anahtar: true })}>Gruplar ve cevap anahtarı</MenuOge>
              {gruplar.length > 1 && gruplar.map((g, i) => (
                <MenuOge key={g.harf} simge="sayfa" onClick={() => yazdir({ gruplar: [i], anahtar: false })}>Yalnız {g.harf} grubu</MenuOge>
              ))}
              <MenuOge simge="anahtar" onClick={() => yazdir({ gruplar: [], anahtar: true })}>Yalnız cevap anahtarı</MenuOge>
              <MenuAyrac />
              <MenuOge simge="word" aciklama="Word'de açıp düzenlemek için .docx" onClick={() => wordIndir()}>Word olarak indir</MenuOge>
            </Acilir>
          </div>
        </div>
      </header>

      <div className="sh-onizleme-govde">
        <aside className="sh-oniz-yan">
          <section className="sh-oz-bolum">
            <h3><Simge ad="kopya" boyut={15} />Gruplar</h3>
            <Secici etiket="Grup sayısı" deger={a.grupSayisi} onDegis={v => ayarla('grupSayisi', v)} secenekler={[[1, 'Tek'], [2, 'A–B'], [3, 'A–C'], [4, 'A–D']]} />
            {a.grupSayisi > 1 && (
              <>
                <Anahtar deger={a.soruKaristir} onDegis={v => ayarla('soruKaristir', v)}>Soru sırasını karıştır</Anahtar>
                <Anahtar deger={a.sikKaristir} onDegis={v => ayarla('sikKaristir', v)}>Şıkları karıştır</Anahtar>
                <button type="button" className="ikincil kucuk tam" onClick={() => ayarla('tohum', Math.floor(Math.random() * 1e9))}><Simge ad="karistir" boyut={15} />Yeniden karıştır</button>
              </>
            )}
          </section>
          <section className="sh-oz-bolum">
            <h3><Simge ad="sayfa" boyut={15} />Sayfa</h3>
            <div className="sh-oz-satir"><span>Sütun</span><Secici kucuk etiket="Sütun" deger={a.sutun} onDegis={v => ayarla('sutun', v)} secenekler={[[1, 'Tek'], [2, 'İki']]} /></div>
            <div className="sh-oz-satir"><span>Yazı boyutu</span><Secici kucuk etiket="Yazı boyutu" deger={a.yaziBoyutu} onDegis={v => ayarla('yaziBoyutu', v)} secenekler={[[10, '10'], [11, '11'], [12, '12'], [13, '13']]} /></div>
            <div className="sh-oz-satir"><span>Yazı tipi</span>
              <select value={a.yaziTipi} onChange={e => ayarla('yaziTipi', e.target.value)} aria-label="Yazı tipi">
                <option value="modern">Modern (Geist)</option><option value="klasik">Klasik (Times)</option><option value="arial">Arial</option>
              </select>
            </div>
            <Anahtar deger={a.ogrenciBilgisi} onDegis={v => ayarla('ogrenciBilgisi', v)}>Öğrenci bilgi alanı</Anahtar>
            <Anahtar deger={a.puanGoster} onDegis={v => ayarla('puanGoster', v)}>Soru puanları</Anahtar>
            <Anahtar deger={a.puanTablosu} onDegis={v => ayarla('puanTablosu', v)}>Puan tablosu</Anahtar>
          </section>

          {(eksik.length > 0 || tasan.length > 0) && (
            <section className="sh-oz-bolum">
              <h3><Simge ad="uyari" boyut={15} />Kontrol edin</h3>
              <ul className="sh-eksik-liste">
                {tasan.length > 0 && <li><span className="agir">{[...new Set(tasan)].join(', ')}. soru tek sayfaya sığmıyor; cevap alanını kısaltın ya da görseli küçültün.</span></li>}
                {eksik.slice(0, 8).map((e, i) => <li key={i}><a className={e.agir ? 'agir' : ''} href={`#/sinav/${sinav.id}`}>{e.mesaj}</a></li>)}
                {eksik.length > 8 && <li className="sh-oz-not">ve {eksik.length - 8} eksik daha</li>}
              </ul>
            </section>
          )}

          <section className={'sh-oz-bolum sh-optik-kart' + (optik.tamam ? '' : ' pasif')}>
            <h3><Simge ad="tara" boyut={15} />Optik okuma</h3>
            {optik.tamam ? (
              <>
                <p>Cevap anahtarlarını optik okuyucuya aktarın; öğrencilerin optik formlarını kamerayla okuyup puanlayın. {gruplar.length > 1 && 'Gruplar kitapçık türü olarak aktarılır.'}</p>
                <button type="button" className="birincil kucuk tam" onClick={() => setOptikPencere(true)}><Simge ad="tara" boyut={16} />Optik okuyucuya aktar</button>
                <a className="sh-oz-baglanti" href="/optik_formu.pdf" download><Simge ad="indir" boyut={14} />Boş optik formu indir (PDF)</a>
              </>
            ) : (
              <p className="sh-oz-not">{optik.neden}</p>
            )}
          </section>
        </aside>

        <main className="sh-sayfa-alani" ref={alan}>
          <div className="sh-sekmeler" role="tablist" aria-label="Görünüm">
            {gruplar.map((g, i) => (
              <button key={g.harf} type="button" role="tab" aria-selected={sekme === i} className={sekme === i ? 'secili' : ''} onClick={() => setSekme(i)}>
                {gruplar.length > 1 ? <><b>{g.harf}</b> grubu</> : 'Sınav kâğıdı'}
                {bilgi[g.harf]?.sayfa ? <small>{bilgi[g.harf].sayfa} s.</small> : null}
              </button>
            ))}
            <button type="button" role="tab" aria-selected={sekme === 'anahtar'} className={sekme === 'anahtar' ? 'secili' : ''} onClick={() => setSekme('anahtar')}><Simge ad="anahtar" boyut={15} />Cevap anahtarı</button>
          </div>
          <div className="sh-sayfalar">
            {sekme === 'anahtar'
              ? <CevapAnahtari sinav={sinav} gruplar={gruplar} olcek={olcek} />
              : gruplar[sekme] && <GrupSayfalari key={gruplar[sekme].harf} sinav={sinav} grup={gruplar[sekme]} grupSayisi={gruplar.length} olcek={olcek}
                  hazir={(n, t) => setBilgi(b => (b[gruplar[sekme].harf]?.sayfa === n && JSON.stringify(b[gruplar[sekme].harf]?.tasan) === JSON.stringify(t) ? b : { ...b, [gruplar[sekme].harf]: { sayfa: n, tasan: t } }))} />}
          </div>
        </main>
      </div>

      {baski && createPortal(
        <div className="sh bs-baski-alani" aria-hidden="true">
          {baski.gruplar.map(i => (
            <GrupSayfalari key={GRUP_HARFLERI[i]} sinav={sinav} grup={gruplar[i]} grupSayisi={gruplar.length}
              hazir={() => setBaskiHazir(h => ({ ...h, [i]: true }))} />
          ))}
          {baski.anahtar && <CevapAnahtari sinav={sinav} gruplar={gruplar} />}
        </div>,
        document.body,
      )}

      {optikPencere && <OptikAktarPenceresi sinav={sinav} onKapat={() => setOptikPencere(false)} />}
      {bildirim}
    </div>
  )
}

function OptikAktarPenceresi({ sinav, onKapat }) {
  const mevcut = useMemo(() => optikDepo.yukle(), [])
  const durum = useMemo(() => optikDurumu(sinav), [sinav])
  const ogrenciVar = mevcut && mevcut.ogrenciler && mevcut.ogrenciler.length > 0
  const [onay, setOnay] = useState(!ogrenciVar)
  const kitaplar = Object.keys(durum.anahtarlar)
  function aktar() {
    const { _puanUyari, ...kayit } = durum
    optikDepo.kaydet(kayit)
    window.location.hash = '#/optik'
  }
  return (
    <Pencere baslik="Optik okuyucuya aktar" simge="tara" onKapat={onKapat}
      alt={<div className="dugmeler"><button type="button" className="ikincil" onClick={onKapat}>Vazgeç</button><button type="button" className="birincil" disabled={!onay} onClick={aktar}><Simge ad="tara" />Aktar ve okumaya başla</button></div>}>
      <div className="sh-aktar-ozet">
        <div><span>Sınav</span><b>{durum.ayar.sinavAdi}</b></div>
        <div><span>Soru</span><b>{durum.ayar.soruSayisi}</b></div>
        <div><span>Kitapçık</span><b>{kitaplar.join(', ')}</b></div>
      </div>
      <div className="sh-aktar-anahtar">
        {kitaplar.map(k => (
          <div key={k}><b>{k}</b><code>{durum.anahtarlar[k].slice(0, durum.ayar.soruSayisi).map(i => 'ABCDE'[i]).join('')}</code></div>
        ))}
      </div>
      {kitaplar.length > 1 && <div className="bilgi-kutu"><Simge ad="bilgi" />Öğrenciler optik formda <b>kitapçık türü</b> olarak kendi grup harflerini işaretlemeli.</div>}
      {durum._puanUyari && <div className="uyari-kutu"><Simge ad="uyari" />{durum._puanUyari}</div>}
      {ogrenciVar && (
        <div className="hata-kutu">
          <Simge ad="uyari" />
          <div>
            Optik okuyucuda <b>{mevcut.ayar?.sinavAdi || 'bir sınav'}</b> için okunmuş <b>{mevcut.ogrenciler.length} öğrenci</b> var. Aktarırsanız bu sonuçlar silinir.
            <label className="sh-onay"><input type="checkbox" checked={onay} onChange={e => setOnay(e.target.checked)} />Excel'i aldım, eski sonuçlar silinsin</label>
          </div>
        </div>
      )}
    </Pencere>
  )
}
