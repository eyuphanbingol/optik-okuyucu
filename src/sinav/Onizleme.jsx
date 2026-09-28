import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Simge from '../bilesenler/Simge.jsx'
import { GrupSayfalari, GrupSayfaCizim, GrupOlcer, CevapAnahtari, BosSayfa, SAYFA, olcumAnahtari } from './Baski.jsx'
import { OptikFormSayfasi } from './OptikForm.jsx'
import { tumGruplar } from './karistir.js'
import { eksikler, soruSayisi, toplamPuan, puanMetni, puanlariDagit, soruMu, sinavBaslikMetni } from './model.js'
import { duzMetin } from './metin.js'
import { Secici, Anahtar, Pencere, Sayac, GrupSecici, useBildirim, kabukKaymasin } from './arayuz.jsx'
import { optigeAktarilabilir, optikYapiUygun, optikDurumu, puanDurumu } from './optikAktar.js'
import { baskiListesi, baskiSecimiDuzelt, dagilim, bloklar, MAKS_OGRENCI } from './baski.js'
import { tablodanOgrenciler, dosyadanSatirlar, metniTabloyaCevir, ogrenciKodu } from './sinifListesi.js'
import * as optikDepo from '../depo.js'
import { indirBlob, dosyaAdi } from './yedek.js'

const MM_PX = 96 / 25.4

/** Grubun optik anahtarı: soru sırasıyla doğru şık indeksleri */
const grupCevaplari = grup => grup.ogeler.filter(soruMu).map(o => (o.dogruIndex ?? null))

export default function Onizleme({ sinav, degistir, kaydetSimdi }) {
  const gruplar = useMemo(() => tumGruplar(sinav), [sinav])
  const [sekme, setSekme] = useState(0)                 // 0..n-1 grup, 'anahtar', 'optik'
  const [bilgi, setBilgi] = useState({})                // grup -> { sayfa, tasan }
  const [is, setIs] = useState(null)                    // yazdırma işi { kimlik, bloklar, planlar, kitapcik }
  const [olcek, setOlcek] = useState(1)
  const [optikPencere, setOptikPencere] = useState(false)
  const [yazdirPencere, setYazdirPencere] = useState(false)
  const [wordMesgul, setWordMesgul] = useState(false)
  const [bildirim, bildir] = useBildirim()
  const alan = useRef(null)
  const a = sinav.ayar
  const ayarla = (k, v) => degistir(s => ({ ...s, ayar: { ...s.ayar, [k]: v } }))
  const eksik = useMemo(() => eksikler(sinav, duzMetin), [sinav])
  const optik = useMemo(() => optigeAktarilabilir(sinav), [sinav])
  const optikYapi = useMemo(() => optikYapiUygun(sinav), [sinav])

  useEffect(() => {
    if (typeof sekme === 'number' && sekme >= gruplar.length) setSekme(0)
    if (sekme === 'optik' && !optik.tamam) setSekme(0)
  }, [gruplar.length, sekme, optik.tamam])
  // ayar değişince eski sayfa sayıları geçersiz (açık sekme yeniden ölçülür, diğerleri açılınca)
  useEffect(() => { setBilgi({}) }, [gruplar])

  // sayfaları ekrana sığdır
  useEffect(() => {
    const el = alan.current
    if (!el) return
    const hesapla = () => setOlcek(Math.min(1, (el.clientWidth - 32) / (SAYFA.g * MM_PX)))
    hesapla()
    const ro = new ResizeObserver(hesapla)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // kısayol: Ctrl+P yazdırma penceresini açar
  useEffect(() => {
    const f = e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') { e.preventDefault(); setYazdirPencere(true) } }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [])

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
  }, [sinav, gruplar, kaydetSimdi, bildir])

  useEffect(() => {
    const f = () => wordIndir()
    window.addEventListener('sh-word', f)
    return () => window.removeEventListener('sh-word', f)
  }, [wordIndir])

  const tasan = Object.values(bilgi).flatMap(x => x.tasan || [])
  const ilkSayfa = bilgi[gruplar[0]?.harf]?.sayfa

  return (
    <div className="sh-onizleme" onScroll={kabukKaymasin}>
      <header className="sh-ust">
        <a className="sh-ust-geri" href={`#/sinav/${sinav.id}`} title="Düzenlemeye dön" aria-label="Düzenlemeye dön"><Simge ad="geri" boyut={18} /></a>
        <div className="sh-ust-ad">
          <span className="sh-ust-baslik salt">{sinav.baslik.sinavAdi || 'Adsız sınav'}</span>
          <span className="sh-ust-alt">Önizleme · {soruSayisi(sinav.ogeler)} soru · {puanMetni(toplamPuan(sinav.ogeler))} puan{ilkSayfa ? ` · ${gruplar.length > 1 ? `grup başına ${ilkSayfa}` : ilkSayfa} sayfa` : ''}</span>
        </div>
        <div className="sh-ust-eylem">
          <a className="ikincil sh-ust-dugme" href={`#/sinav/${sinav.id}`}><Simge ad="kalem" /><span>Düzenle</span></a>
          <button type="button" className="ikincil sh-ust-dugme" disabled={wordMesgul} onClick={() => wordIndir()}>{wordMesgul ? <span className="donen kucuk" /> : <Simge ad="word" />}<span>Word</span></button>
          <button type="button" className="birincil sh-yazdir-dugme" onClick={() => setYazdirPencere(true)}><Simge ad="yazdir" /><span>Yazdır / PDF</span></button>
        </div>
      </header>

      <div className="sh-onizleme-govde">
        <aside className="sh-oniz-yan">
          <section className="sh-oz-bolum">
            <h3><Simge ad="kopya" boyut={15} />Gruplar</h3>
            <GrupSecici deger={a.grupSayisi} onDegis={v => ayarla('grupSayisi', v)} />
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
                <button type="button" className="ikincil kucuk tam" onClick={() => setYazdirPencere(true)}><Simge ad="yazdir" boyut={15} />Optik formları yazdır</button>
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
            {optik.tamam && <button type="button" role="tab" aria-selected={sekme === 'optik'} className={sekme === 'optik' ? 'secili' : ''} onClick={() => setSekme('optik')}><Simge ad="tara" boyut={15} />Optik anahtar</button>}
          </div>
          <div className="sh-sayfalar">
            {sekme === 'anahtar' ? <CevapAnahtari sinav={sinav} gruplar={gruplar} olcek={olcek} />
              : sekme === 'optik' ? gruplar.slice(0, 4).map(g => (
                <OptikFormSayfasi key={g.harf} kitapcik={g.harf} anahtar cevaplar={grupCevaplari(g)} olcek={olcek}
                  etiket={`CEVAP ANAHTARI · ${g.harf}`} altEtiket={sinavBaslikMetni(sinav.baslik)} />
              ))
                : gruplar[sekme] && <GrupSayfalari key={gruplar[sekme].harf} sinav={sinav} grup={gruplar[sekme]} grupSayisi={gruplar.length} olcek={olcek}
                  hazir={(n, t) => setBilgi(b => (b[gruplar[sekme].harf]?.sayfa === n && JSON.stringify(b[gruplar[sekme].harf]?.tasan) === JSON.stringify(t) ? b : { ...b, [gruplar[sekme].harf]: { sayfa: n, tasan: t } }))} />}
          </div>
        </main>
      </div>

      {is && createPortal(<BaskiAlani key={is.kimlik} sinav={sinav} gruplar={gruplar} is={is} onBitti={() => setIs(null)} />, document.body)}

      {yazdirPencere && (
        <YazdirmaPenceresi sinav={sinav} gruplar={gruplar} degistir={degistir} optikYapi={optikYapi} optikAnahtar={optik}
          onKapat={() => setYazdirPencere(false)}
          onYazdir={j => { setYazdirPencere(false); setIs({ ...j, kimlik: Date.now() }) }} />
      )}
      {optikPencere && <OptikAktarPenceresi sinav={sinav} degistir={degistir} onKapat={() => setOptikPencere(false)} />}
      {bildirim}
    </div>
  )
}

// ------------------------------------------------------------------ yazdırma alanı
/**
 * Seçilen her şey gövdeye ayrı bir alan olarak çizilir (ekranda görünmez); görseller ve form yüklenince
 * yazdırma penceresi açılır. Tarayıcının "PDF olarak kaydet" seçeneği aynı çıktıyı PDF yapar.
 */
function BaskiAlani({ sinav, gruplar, is, onBitti }) {
  const kok = useRef(null)
  const G = gruplar.length
  useEffect(() => {
    let iptal = false
    const html = document.documentElement
    const calis = async () => {
      try { await document.fonts?.ready } catch { /* yok */ }
      const imgs = Array.from(kok.current?.querySelectorAll('img') || [])
      await Promise.all(imgs.map(i => (i.complete && i.naturalWidth ? null : i.decode ? i.decode().catch(() => {}) : new Promise(r => { i.onload = i.onerror = r }))))
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 60)))
      if (iptal) return
      html.classList.add('sh-yazdir')
      kok.current?.setAttribute('data-hazir', '1')
      window.print()
    }
    calis()
    // yazdırma penceresi kapanınca alan kaldırılır (afterprint göndermeyen tarayıcıda bir sonraki işe kadar görünmez kalır)
    const bitti = () => { html.classList.remove('sh-yazdir'); onBitti() }
    window.addEventListener('afterprint', bitti)
    return () => { iptal = true; window.removeEventListener('afterprint', bitti); html.classList.remove('sh-yazdir') }
  }, [])   // eslint-disable-line react-hooks/exhaustive-deps

  const kitapcikHarfi = g => (is.kitapcik && G > 1 ? gruplar[g].harf : null)
  return (
    <div ref={kok} className="sh bs-baski-alani" aria-hidden="true">
      {is.bloklar.map((b, i) => {
        const ogrenci = is.ogrenciler && b.kisi != null ? is.ogrenciler[b.kisi] : undefined
        if (b.tur === 'kagit') return <GrupSayfaCizim key={i} sinav={sinav} grup={gruplar[b.g]} grupSayisi={G} plan={is.planlar[b.g]} ogrenci={ogrenci} />
        if (b.tur === 'optik') return <OptikFormSayfasi key={i} kitapcik={kitapcikHarfi(b.g)} ogrenci={ogrenci} etiket={ogrenci?.sinif || undefined} veri={{ 'data-kisi': b.kisi + 1 }} />
        if (b.tur === 'optikAnahtar') {
          return <OptikFormSayfasi key={i} kitapcik={gruplar[b.g].harf} anahtar cevaplar={grupCevaplari(gruplar[b.g])}
            etiket={`CEVAP ANAHTARI · ${gruplar[b.g].harf}`} altEtiket={sinavBaslikMetni(sinav.baslik)} />
        }
        if (b.tur === 'bos') return <BosSayfa key={i} />
        return <CevapAnahtari key={i} sinav={sinav} gruplar={gruplar} />
      })}
    </div>
  )
}

// ------------------------------------------------------------------ yazdırma penceresi
function YazdirmaPenceresi({ sinav, gruplar, degistir, optikYapi, optikAnahtar, onKapat, onYazdir }) {
  const G = gruplar.length
  const [secim, setSecim] = useState(() => baskiSecimiDuzelt(sinav.baski, G))
  const [planlar, setPlanlar] = useState({})
  const ayarla = (k, v) => setSecim(s => baskiSecimiDuzelt({ ...s, [k]: v }, G))
  const optikUygun = optikYapi.tamam
  const anahtarUygun = optikAnahtar.tamam
  const optikVar = secim.optik && optikUygun
  const kisiVar = secim.kagit || optikVar

  const gecerli = g => { const p = planlar[g]; return p && !p.gecici && p.anahtar === olcumAnahtari(sinav, gruplar[g], G) }
  const olculecek = secim.kagit ? secim.gruplar : []
  const hazir = olculecek.every(gecerli)
  const sinifListesi = sinav.sinifListesi && Array.isArray(sinav.sinifListesi.ogrenciler) ? sinav.sinifListesi : null
  const listeSayisi = secim.kopya === 'liste' && sinifListesi ? sinifListesi.ogrenciler.length : 0
  const liste = useMemo(() => (hazir ? baskiListesi(secim, g => planlar[g].sayfalar.length, { optikUygun, anahtarUygun, listeSayisi }) : null),
    [hazir, secim, planlar, optikUygun, anahtarUygun, listeSayisi])
  const sayfa = liste ? liste.filter(x => x.tur !== 'anahtar').length : null
  const bosIs = liste && liste.length === 0

  const dag = useMemo(() => {
    const say = {}
    for (const g of dagilim(secim, listeSayisi)) say[g] = (say[g] || 0) + 1
    return secim.gruplar.map(g => `${gruplar[g].harf}: ${say[g] || 0}`).join(' · ')
  }, [secim, gruplar, listeSayisi])

  function yazdir() {
    if (!liste || bosIs) return
    if (JSON.stringify(secim) !== JSON.stringify(sinav.baski || null)) degistir(s => ({ ...s, baski: secim }))
    onYazdir({ bloklar: bloklar(liste), planlar, kitapcik: secim.kitapcik, ogrenciler: secim.kopya === 'liste' && sinifListesi ? sinifListesi.ogrenciler : null })
  }

  const grupDegistir = g => {
    const var_ = secim.gruplar.includes(g)
    if (var_ && secim.gruplar.length === 1) return
    ayarla('gruplar', var_ ? secim.gruplar.filter(x => x !== g) : [...secim.gruplar, g])
  }
  const kagitSayfa = hazir && secim.kagit && secim.gruplar.length ? planlar[secim.gruplar[0]].sayfalar.length : null

  return (
    <Pencere baslik="Yazdır" altBaslik="Yazdırma penceresinde “PDF olarak kaydet” seçerseniz aynı çıktı PDF olur." simge="yazdir" genis className="sh-yazdir-pencere" onKapat={onKapat}
      alt={(
        <div className="sh-yazdir-alt">
          <span className="sh-yazdir-ozet" aria-live="polite">
            {!hazir ? <><span className="donen kucuk" />Sayfalar hazırlanıyor…</>
              : bosIs ? (secim.kopya === 'liste' && !listeSayisi ? 'Önce sınıf listesini yükleyin.' : 'Yazdırılacak bir şey seçilmedi.')
                : <><b>{sayfa}</b> sayfa{secim.anahtar ? ' + cevap anahtarı' : ''}</>}
          </span>
          <div className="dugmeler">
            <button type="button" className="ikincil" onClick={onKapat}>Vazgeç</button>
            <button type="button" className="birincil sh-yazdir-onay" disabled={!hazir || bosIs} onClick={yazdir}><Simge ad="yazdir" />Yazdır</button>
          </div>
        </div>
      )}>
      <div className="sh-yazdir-bolum">
        <Anahtar deger={secim.kagit} onDegis={v => ayarla('kagit', v)}
          aciklama={kagitSayfa ? `${G > 1 ? 'Her grubun' : 'Sınav'} kâğıdı ${kagitSayfa} sayfa` : undefined}>Sınav kâğıtları</Anahtar>
      </div>

      {kisiVar && (
        <div className="sh-yazdir-bolum">
          <div className="sh-yazdir-baslik">Kaç kopya</div>
          <Secici etiket="Kopya" deger={secim.kopya} onDegis={v => ayarla('kopya', v)}
            secenekler={[['ogrenci', 'Öğrenci sayısı kadar'], ['liste', 'Sınıf listesinden'], ['grup', G > 1 ? 'Her gruptan 1 (fotokopi için)' : '1 kopya (fotokopi için)']]} />
          {secim.kopya === 'liste' && (
            <SinifListesiAlani liste={sinifListesi} gruplar={gruplar} secim={secim}
              onDegis={l => degistir(s => ({ ...s, sinifListesi: l }))} />
          )}
          {secim.kopya === 'ogrenci' && (
            <div className="sh-yazdir-satir">
              <span>Öğrenci sayısı</span>
              <Sayac etiket="Öğrenci sayısı" deger={secim.ogrenci} min={1} maks={MAKS_OGRENCI} adim={1} birim="öğrenci" onDegis={v => ayarla('ogrenci', v === '' ? 1 : v)} />
            </div>
          )}
          {G > 1 && (
            <>
              <div className="sh-yazdir-satir ustten">
                <span>Gruplar</span>
                <div className="sh-grup-sec" role="group" aria-label="Basılacak gruplar">
                  {gruplar.map((g, i) => (
                    <button key={g.harf} type="button" aria-pressed={secim.gruplar.includes(i)} className={secim.gruplar.includes(i) ? 'secili' : ''} onClick={() => grupDegistir(i)}>{g.harf}</button>
                  ))}
                </div>
              </div>
              {secim.kopya !== 'grup' && secim.gruplar.length > 1 && (secim.kopya === 'ogrenci' || listeSayisi > 0) && (
                <p className="sh-oz-not sh-dagilim">{dag}. Kâğıtlar {secim.gruplar.slice(0, 3).map(g => gruplar[g].harf).join(', ')}{secim.gruplar.length > 3 ? '…' : ''} sırasıyla basılır; sırayla dağıtınca yan yana oturanlar farklı grup alır.</p>
              )}
            </>
          )}
        </div>
      )}

      <div className={'sh-yazdir-bolum' + (optikUygun ? '' : ' pasif')}>
        <div className="sh-yazdir-baslik"><Simge ad="tara" boyut={15} />Optik form</div>
        {optikUygun ? (
          <>
            <Anahtar deger={secim.optik} onDegis={v => ayarla('optik', v)}
              aciklama={secim.kopya === 'ogrenci' ? `${secim.ogrenci} optik form; her biri öğrencinin kâğıdının hemen arkasından`
                : secim.kopya === 'liste' ? `${listeSayisi} optik form; adı, soyadı ve numarası hazır işaretli, kâğıdının hemen arkasından`
                  : 'Her kopyanın arkasına bir optik form'}>
              Her öğrenciye optik form
            </Anahtar>
            {secim.optik && G > 1 && (
              <Anahtar deger={secim.kitapcik} onDegis={v => ayarla('kitapcik', v)} aciklama="Formdaki kitapçık türü yuvarlağı öğrencinin grubuyla dolu basılır; yanlış kitapçık işaretlenemez">
                Kitapçık türü işaretli olsun
              </Anahtar>
            )}
            <Anahtar deger={secim.optikAnahtar && anahtarUygun} onDegis={v => ayarla('optikAnahtar', v)}
              aciklama={anahtarUygun ? `Sona, her grup için cevapları işaretli bir optik form (${secim.gruplar.map(g => gruplar[g].harf).join(', ')}). Optik okuyucuda “Anahtarı kamerayla okut” ile okutulur.` : optikAnahtar.neden}>
              Optikte işaretli cevap anahtarları
            </Anahtar>
          </>
        ) : <p className="sh-oz-not">{optikYapi.neden}</p>}
      </div>

      <div className="sh-yazdir-bolum">
        <div className="sh-yazdir-baslik"><Simge ad="anahtar" boyut={15} />Öğretmen</div>
        <Anahtar deger={secim.anahtar} onDegis={v => ayarla('anahtar', v)} aciklama="Tüm grupların cevapları tablo halinde, en sonda">Cevap anahtarı</Anahtar>
      </div>

      <div className="sh-yazdir-bolum">
        <Anahtar deger={secim.ciftTaraf} onDegis={v => ayarla('ciftTaraf', v)} aciklama="Her öğrencinin kâğıdı ve optik formu yeni bir yaprakta başlar (gerekirse boş sayfa eklenir)">Çift taraflı yazıcı</Anahtar>
      </div>

      {/* sayfa sayısı için gizli ölçüm */}
      {olculecek.map(g => (
        <GrupOlcer key={gruplar[g].harf} sinav={sinav} grup={gruplar[g]} grupSayisi={G} onPlan={p => setPlanlar(x => ({ ...x, [g]: p }))} />
      ))}
    </Pencere>
  )
}

// ------------------------------------------------------------------ sınıf listesi
/**
 * e-Okul / öğrenci bilgi sistemi listesi: Excel (.xlsx) ya da CSV yüklenir veya Excel'den kopyalanıp yapıştırılır.
 * Liste sınavla birlikte bu cihazda saklanır (hiçbir sunucuya gitmez).
 */
function SinifListesiAlani({ liste, gruplar, secim, onDegis }) {
  const dosyaRef = useRef(null)
  const [yapistir, setYapistir] = useState(false)
  const [metin, setMetin] = useState('')
  const [hata, setHata] = useState(null)
  const [mesgul, setMesgul] = useState(false)
  const [uyariAcik, setUyariAcik] = useState(false)

  function al(satirlar, kaynak) {
    const r = tablodanOgrenciler(satirlar)
    if (!r.ogrenciler.length) { setHata(r.uyarilar[0] || 'Listede öğrenci bulunamadı.'); return }
    setHata(null); setYapistir(false); setMetin('')
    onDegis({ kaynak, ogrenciler: r.ogrenciler.slice(0, MAKS_OGRENCI), uyarilar: r.uyarilar, tarih: Date.now() })
  }
  async function dosyaSec(f) {
    setMesgul(true)
    try { al(await dosyadanSatirlar(f), f.name) } catch (e) { setHata(e.message || String(e)) } finally { setMesgul(false) }
  }

  const kodlar = useMemo(() => (liste ? liste.ogrenciler.map(o => ogrenciKodu(o)) : []), [liste])
  const uyarili = kodlar.map((k, i) => ({ i, k })).filter(x => x.k.uyarilar.length)
  const grupHarfi = i => (gruplar.length > 1 ? gruplar[secim.gruplar[i % secim.gruplar.length]].harf : '')

  if (!liste) {
    return (
      <div className="sh-liste-yukle">
        <div className="sh-liste-yukle-dugmeler">
          <button type="button" className="ikincil" disabled={mesgul} onClick={() => dosyaRef.current?.click()}>{mesgul ? <span className="donen kucuk" /> : <Simge ad="yukle" />}Excel / CSV yükle</button>
          <button type="button" className="ikincil" onClick={() => setYapistir(v => !v)}><Simge ad="kopya" />Yapıştır</button>
        </div>
        <p className="sh-oz-not">e-Okul ya da öğrenci bilgi sisteminden aldığınız sınıf listesi. <b>Öğrenci No, Adı, Soyadı</b> (ya da <b>Adı Soyadı</b>) sütunları yeterli; liste bu cihazda kalır.</p>
        {yapistir && (
          <div className="sh-liste-yapistir">
            <textarea rows={5} value={metin} onChange={e => setMetin(e.target.value)} placeholder={'Excel\'de sütunları seçip kopyalayın, buraya yapıştırın:\nÖğrenci No\tAdı\tSoyadı\n123\tAyşe\tYılmaz'} aria-label="Sınıf listesi" />
            <button type="button" className="birincil kucuk" disabled={!metin.trim()} onClick={() => al(metniTabloyaCevir(metin), 'Yapıştırılan liste')}><Simge ad="onay" boyut={16} />Listeyi al</button>
          </div>
        )}
        {hata && <div className="hata-kutu"><Simge ad="uyari" /><div>{hata}</div></div>}
        <input ref={dosyaRef} type="file" accept=".xlsx,.xlsm,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) dosyaSec(f) }} />
      </div>
    )
  }

  return (
    <div className="sh-liste-yuklu">
      <div className="sh-liste-ozet">
        <span className="sh-liste-simge"><Simge ad="kisiler" boyut={17} /></span>
        <div><b>{liste.ogrenciler.length} öğrenci</b><small>{liste.kaynak}</small></div>
        <button type="button" className="ikincil kucuk" onClick={() => onDegis(null)}>Değiştir</button>
      </div>
      <div className="sh-liste-tablo-kap">
        <table className="sh-liste-tablo">
          <thead><tr><th>No</th><th>Adı Soyadı</th>{gruplar.length > 1 && <th>Grup</th>}</tr></thead>
          <tbody>
            {liste.ogrenciler.slice(0, 5).map((o, i) => (
              <tr key={i}><td>{o.no || '—'}</td><td>{[o.ad, o.soyad].filter(Boolean).join(' ')}</td>{gruplar.length > 1 && <td>{grupHarfi(i)}</td>}</tr>
            ))}
            {liste.ogrenciler.length > 5 && <tr className="devam"><td colSpan={3}>ve {liste.ogrenciler.length - 5} öğrenci daha</td></tr>}
          </tbody>
        </table>
      </div>
      {(liste.uyarilar || []).map((u, i) => <p key={i} className="sh-oz-not">{u}</p>)}
      {uyarili.length > 0 && (
        <div className="uyari-kutu sh-liste-uyari">
          <Simge ad="uyari" />
          <div>
            <b>{uyarili.length} öğrencinin bilgisi forma tam sığmıyor.</b>{' '}
            <button type="button" className="sh-bag-dugme" onClick={() => setUyariAcik(v => !v)}>{uyariAcik ? 'Gizle' : 'Göster'}</button>
            {uyariAcik && (
              <ul>
                {uyarili.slice(0, 30).map(({ i, k }) => <li key={i}><b>{[liste.ogrenciler[i].ad, liste.ogrenciler[i].soyad].join(' ')}</b>: {k.uyarilar.join('; ')}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ optiğe aktarma
function OptikAktarPenceresi({ sinav, degistir, onKapat }) {
  const mevcut = useMemo(() => optikDepo.yukle(), [])
  const p = puanDurumu(sinav)
  const [hata, setHata] = useState(null)
  let durum = null, durumHata = null
  if (p.esit) { try { durum = optikDurumu(sinav) } catch (e) { durumHata = e.message } }
  const ogrenciVar = mevcut && mevcut.ogrenciler && mevcut.ogrenciler.length > 0
  const [onay, setOnay] = useState(!ogrenciVar)
  const kitaplar = durum ? Object.keys(durum.anahtarlar) : []
  const N = soruSayisi(sinav.ogeler)
  const hedefToplam = p.toplam > 0 ? p.toplam : 100

  function esitle() {
    degistir(s => ({ ...s, ogeler: puanlariDagit(s.ogeler, hedefToplam, true) }))
  }

  function aktar() {
    setHata(null)
    try {
      const d = optikDurumu(sinav)
      if (!optikDepo.kaydet(d)) throw new Error('Tarayıcı kaydı yazamadı (depolama dolu ya da gizli pencere olabilir).')
      // yazılanı geri oku ve karşılaştır: optik okuyucu tam olarak bunu görecek
      const geri = optikDepo.yukle()
      if (!geri || JSON.stringify(geri.anahtarlar) !== JSON.stringify(d.anahtarlar) || geri.ayar.soruSayisi !== d.ayar.soruSayisi) throw new Error('Kayıt doğrulanamadı.')
      window.location.hash = '#/optik'
    } catch (e) { setHata(e.message || String(e)) }
  }

  return (
    <Pencere baslik="Optik okuyucuya aktar" simge="tara" onKapat={onKapat}
      alt={<div className="dugmeler"><button type="button" className="ikincil" onClick={onKapat}>Vazgeç</button><button type="button" className="birincil sh-aktar-onay" disabled={!onay || !durum} onClick={aktar}><Simge ad="tara" />Aktar ve okumaya başla</button></div>}>
      {!p.esit ? (
        <div className="sh-puan-esitle">
          <div className="uyari-kutu"><Simge ad="uyari" />
            <div>
              Bu sınavda soru puanları farklı ({p.farkli.slice(0, 4).join(', ')}{p.farkli.length > 4 ? '…' : ''}). Optik okuyucu her soruyu <b>eşit</b> puanlar;
              aktarmadan önce puanlar eşitlenmeli. Toplam <b>{puanMetni(hedefToplam)}</b> puan korunur, her soru <b>{puanMetni(hedefToplam / N)}</b> puan olur.
            </div>
          </div>
          <button type="button" className="birincil tam" onClick={esitle}><Simge ad="yenile" />Puanları eşitle</button>
        </div>
      ) : durum ? (
        <>
          <div className="sh-aktar-ozet">
            <div><span>Sınav</span><b>{durum.ayar.sinavAdi}</b></div>
            <div><span>Soru</span><b>{durum.ayar.soruSayisi}</b></div>
            <div><span>Soru puanı</span><b>{puanMetni(p.puan)}</b></div>
            <div><span>Kitapçık</span><b>{kitaplar.join(', ')}</b></div>
          </div>
          <div className="sh-aktar-anahtar">
            {kitaplar.map(k => (
              <div key={k}><b>{k}</b><code>{durum.anahtarlar[k].slice(0, durum.ayar.soruSayisi).map(i => 'ABCDE'[i]).join('')}</code></div>
            ))}
          </div>
          <p className="sh-oz-not">Toplam {puanMetni(p.toplam)} puan: optik okuyucu her doğruya {puanMetni(p.puan)} puan verir; kâğıttaki puanlarla aynıdır.</p>
          {kitaplar.length > 1 && <div className="bilgi-kutu"><Simge ad="bilgi" /><div>Öğrenciler optik formda <b>kitapçık türü</b> olarak kendi grup harflerini işaretlemeli (ya da “Yazdır” penceresinden kitapçığı işaretli formlar basın).</div></div>}
          {ogrenciVar && (
            <div className="hata-kutu">
              <Simge ad="uyari" />
              <div>
                Optik okuyucuda <b>{mevcut.ayar?.sinavAdi || 'bir sınav'}</b> için okunmuş <b>{mevcut.ogrenciler.length} öğrenci</b> var. Aktarırsanız bu sonuçlar silinir.
                <label className="sh-onay"><input type="checkbox" checked={onay} onChange={e => setOnay(e.target.checked)} />Excel'i aldım, eski sonuçlar silinsin</label>
              </div>
            </div>
          )}
        </>
      ) : <div className="hata-kutu"><Simge ad="uyari" /><div>{durumHata}</div></div>}
      {hata && <div className="hata-kutu"><Simge ad="uyari" /><div>Aktarılamadı: {hata}</div></div>}
    </Pencere>
  )
}
