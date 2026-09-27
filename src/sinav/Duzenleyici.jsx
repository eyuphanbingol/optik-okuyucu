import { useEffect, useMemo, useRef, useState } from 'react'
import Simge from '../bilesenler/Simge.jsx'
import Duzenlenebilir from './Duzenlenebilir.jsx'
import { OgeKarti, TurMenusu } from './Ogeler.jsx'
import Ozellikler from './Ozellikler.jsx'
import { Acilir, MenuOge, MenuAyrac, useBildirim, Pencere } from './arayuz.jsx'
import { yeniOge, numaralar, soruSayisi, toplamPuan, turDegistir, ogeKopyala, TURLER, yeniId } from './model.js'
import { ozet, SEMBOLLER } from './metin.js'
import { gorselEkle } from './gorsel.js'
import { sinavSil } from './depo.js'
import { yedekOlustur, sinavKopyala, indirBlob, dosyaAdi } from './yedek.js'

/** Düzenleyicinin kalbi: sayfa üzerinde Word gibi düzenleme */
export default function Duzenleyici({ sinav, degistir, geriAl, yinele, geriVar, ileriVar, kayit, kaydetSimdi }) {
  const [secili, setSecili] = useState(null)
  const [odak, setOdak] = useState(null)
  const [panel, setPanel] = useState(null)          // telefonda: 'anahat' | 'ozellik'
  const [silOnay, setSilOnay] = useState(false)
  const [bildirim, bildir] = useBildirim()
  const seciliRef = useRef(null)
  seciliRef.current = secili
  const no = useMemo(() => numaralar(sinav.ogeler), [sinav.ogeler])
  const sinavRef = useRef(sinav)
  sinavRef.current = sinav

  // yeni sorunun varsayılan puanı: sınavdaki en yaygın puan
  const onerilenPuan = () => {
    const say = new Map()
    for (const o of sinavRef.current.ogeler) if (o.tur !== 'bolum') say.set(o.puan, (say.get(o.puan) || 0) + 1)
    let en = 5, n = 0
    for (const [p, k] of say) if (k > n && p > 0) { en = p; n = k }
    return en
  }

  const islem = useMemo(() => ({
    sec: id => setSecili(id),
    git: id => { setSecili(id); setOdak(null); requestAnimationFrame(() => document.getElementById(`oge-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })) },
    guncelle: (id, patch, anahtar) => degistir(s => ({
      ...s,
      ogeler: s.ogeler.map(o => (o.id === id ? { ...o, ...(typeof patch === 'function' ? patch(o) : patch) } : o)),
    }), anahtar),
    ekle: (tur, konum = null, sec = {}) => {
      const o = yeniOge(tur, { puan: onerilenPuan(), sikSayisi: sinavRef.current.ogeler.find(x => x.tur === 'coktan')?.siklar.length || 4, ...sec })
      degistir(s => {
        const ogeler = [...s.ogeler]
        let i = konum
        if (i == null) { const si = ogeler.findIndex(x => x.id === seciliRef.current); i = si >= 0 ? si + 1 : ogeler.length }
        ogeler.splice(i, 0, o)
        return { ...s, ogeler }
      })
      setSecili(o.id)
      setOdak(o.id)
      setPanel(null)
    },
    topluEkle: (tur, adet) => {
      const yeni = Array.from({ length: adet }, () => yeniOge(tur, { puan: onerilenPuan(), sikSayisi: 4 }))
      degistir(s => ({ ...s, ogeler: [...s.ogeler, ...yeni] }))
      setSecili(yeni[0].id); setOdak(yeni[0].id)
    },
    sil: id => {
      degistir(s => ({ ...s, ogeler: s.ogeler.filter(o => o.id !== id) }))
      setSecili(null)
      bildir('Soru silindi.', 'bilgi', { eylem: { ad: 'Geri al', fn: geriAl } })
    },
    cogalt: id => {
      let k = null
      degistir(s => {
        const i = s.ogeler.findIndex(o => o.id === id)
        if (i < 0) return s
        k = ogeKopyala(s.ogeler[i])
        const ogeler = [...s.ogeler]; ogeler.splice(i + 1, 0, k)
        return { ...s, ogeler }
      })
      if (k) { setSecili(k.id); setOdak(k.id) }
    },
    tasi: (id, yon) => degistir(s => {
      const i = s.ogeler.findIndex(o => o.id === id), j = i + yon
      if (i < 0 || j < 0 || j >= s.ogeler.length) return s
      const ogeler = [...s.ogeler];[ogeler[i], ogeler[j]] = [ogeler[j], ogeler[i]]
      requestAnimationFrame(() => document.getElementById(`oge-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
      return { ...s, ogeler }
    }),
    tasiKonuma: (id, hedef) => degistir(s => {
      const i = s.ogeler.findIndex(o => o.id === id)
      if (i < 0) return s
      const ogeler = [...s.ogeler]
      const [o] = ogeler.splice(i, 1)
      ogeler.splice(hedef > i ? hedef - 1 : hedef, 0, o)
      return { ...s, ogeler }
    }),
    turDegistir: (id, tur, sec) => degistir(s => ({ ...s, ogeler: s.ogeler.map(o => (o.id === id ? { ...turDegistir(o, tur), ...(tur === 'klasik' && sec?.satir ? { satir: sec.satir } : {}) } : o)) })),
    sikSayisi: (id, n) => degistir(s => ({
      ...s,
      ogeler: s.ogeler.map(o => {
        if (o.id !== id) return o
        let siklar = o.siklar.slice(0, n)
        while (siklar.length < n) siklar = [...siklar, { id: yeniId(), metin: '', gorsel: null }]
        return { ...o, siklar, dogru: siklar.some(x => x.id === o.dogru) ? o.dogru : null }
      }),
    })),
    gorselEkle: async (id, dosya, sikId) => {
      try {
        const g = await gorselEkle(dosya, sinavRef.current.id)
        degistir(s => ({
          ...s,
          ogeler: s.ogeler.map(o => {
            if (o.id !== id) return o
            if (sikId) return { ...o, siklar: o.siklar.map(k => (k.id === sikId ? { ...k, gorsel: { id: g.id, genislik: 70 } } : k)) }
            const oran = g.genislik / g.yukseklik
            return { ...o, gorsel: { id: g.id, genislik: oran < 0.9 ? 40 : oran > 2.2 ? 80 : 60, hiza: 'orta', konum: 'alt' } }
          }),
        }))
        bildir('Görsel eklendi.')
      } catch (e) { bildir(e.message || 'Görsel eklenemedi.', 'hata') }
    },
  }), [degistir, geriAl])

  // eklenen soruya odak: bir kez
  useEffect(() => { if (odak) { const t = setTimeout(() => setOdak(null), 400); return () => clearTimeout(t) } }, [odak])

  // kısayollar
  useEffect(() => {
    const f = e => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); geriAl() }
      else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); yinele() }
      else if (k === 's') { e.preventDefault(); kaydetSimdi().then(() => bildir('Kaydedildi.')) }
      else if (k === 'p') { e.preventDefault(); window.location.hash = `#/sinav/${sinav.id}/yazdir` }
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [geriAl, yinele, kaydetSimdi, sinav.id])

  const b = sinav.baslik
  const bGuncelle = (k, v) => degistir(s => ({ ...s, baslik: { ...s.baslik, [k]: v } }), `baslik:${k}`)
  const sayi = soruSayisi(sinav.ogeler)
  const toplam = toplamPuan(sinav.ogeler)

  return (
    <div className={`sh-duzenleyici yazi-${sinav.ayar.yaziTipi}`} style={{ '--kagit-yazi': `${sinav.ayar.yaziBoyutu}pt` }}>
      {/* ---------------------------------------------------------------- üst çubuk */}
      <header className="sh-ust">
        <a className="sh-ust-geri" href="#/sinav" title="Sınavlarım" aria-label="Sınavlarım"><Simge ad="geri" boyut={18} /></a>
        <span className="sh-ust-belge" aria-hidden="true"><Simge ad="sinav" boyut={20} /></span>
        <div className="sh-ust-ad">
          <input className="sh-ust-baslik" value={b.sinavAdi} onChange={e => bGuncelle('sinavAdi', e.target.value)} placeholder="Adsız sınav" aria-label="Sınav adı" />
          <span className="sh-ust-alt">
            {[b.sinif, b.ders].filter(Boolean).join(' · ') || 'Sınav'} · {sayi} soru · {toplam} puan
            <span className={`sh-kayit ${kayit}`}>
              {kayit === 'hata' ? <><Simge ad="uyari" boyut={13} />Kaydedilemedi</> : kayit === 'kaydedildi' ? <><Simge ad="onay" boyut={13} kalinlik={2.4} />Kaydedildi</> : 'Kaydediliyor…'}
            </span>
          </span>
        </div>
        <div className="sh-ust-eylem">
          <button type="button" className="sh-ikon-dugme" title="Geri al (Ctrl+Z)" aria-label="Geri al" disabled={!geriVar} onClick={geriAl}><Simge ad="geriAl" /></button>
          <button type="button" className="sh-ikon-dugme" title="Yinele (Ctrl+Y)" aria-label="Yinele" disabled={!ileriVar} onClick={yinele}><Simge ad="yinele" /></button>
          <a className="birincil sh-onizle" href={`#/sinav/${sinav.id}/yazdir`}><Simge ad="yazdir" /><span>Önizle ve yazdır</span></a>
          <Acilir hiza="sag" genislik={260} tetik={<button type="button" className="sh-ikon-dugme" aria-label="Diğer işlemler" title="Diğer işlemler"><Simge ad="menu" /></button>}>
            <MenuOge simge="yazdir" kisayol="Ctrl+P" onClick={() => { window.location.hash = `#/sinav/${sinav.id}/yazdir` }}>Önizle, yazdır, PDF</MenuOge>
            <MenuOge simge="word" onClick={() => { window.location.hash = `#/sinav/${sinav.id}/yazdir`; setTimeout(() => window.dispatchEvent(new CustomEvent('sh-word')), 400) }}>Word olarak indir</MenuOge>
            <MenuAyrac />
            <MenuOge simge="kopya" onClick={async () => { await kaydetSimdi(); const k = await sinavKopyala(sinavRef.current); window.location.hash = `#/sinav/${k.id}` }}>Kopyasını oluştur</MenuOge>
            <MenuOge simge="indir" aciklama="Başka cihaza taşımak için .sinav dosyası" onClick={async () => { indirBlob(await yedekOlustur(sinavRef.current), dosyaAdi(sinavRef.current, 'sinav')); bildir('Yedek dosyası indirildi.') }}>Yedek dosyası indir</MenuOge>
            <MenuAyrac />
            <MenuOge simge="cop" tehlike onClick={() => setSilOnay(true)}>Sınavı sil</MenuOge>
          </Acilir>
        </div>
      </header>

      {/* ---------------------------------------------------------------- biçim araç çubuğu */}
      <AracCubugu islem={islem} secili={secili} geriAl={geriAl} yinele={yinele} geriVar={geriVar} ileriVar={ileriVar} />

      <div className="sh-govde">
        {/* ---------------------------------------------------------------- ana hat */}
        <aside className={'sh-anahat' + (panel === 'anahat' ? ' acik' : '')} aria-label="Ana hat">
          <AnaHat sinav={sinav} no={no} secili={secili} islem={islem} onSec={() => setPanel(null)} />
        </aside>

        {/* ---------------------------------------------------------------- sayfa */}
        <main className="sh-tuval" onMouseDown={e => { if (e.target === e.currentTarget) setSecili(null) }}>
          <div className="sh-kagit" onMouseDown={e => { if (e.target === e.currentTarget) setSecili(null) }}>
            <div className={'sh-kagit-baslik' + (secili === '__baslik' ? ' secili' : '')} onMouseDown={() => setSecili(null)} id="oge-__baslik">
              <input className="sh-b-okul" value={b.okul} onChange={e => bGuncelle('okul', e.target.value)} placeholder="OKUL ADI" aria-label="Okul adı" />
              <div className="sh-b-satir">
                <input className="sh-b-kucuk" value={b.ogretimYili} onChange={e => bGuncelle('ogretimYili', e.target.value)} placeholder="2026-2027" aria-label="Öğretim yılı" size={9} />
                <span>EĞİTİM-ÖĞRETİM YILI</span>
                <input className="sh-b-orta" value={b.sinif} onChange={e => bGuncelle('sinif', e.target.value)} placeholder="SINIF" aria-label="Sınıf" size={genislik(b.sinif, 'SINIF')} />
                <input className="sh-b-orta" value={b.ders} onChange={e => bGuncelle('ders', e.target.value)} placeholder="DERS" aria-label="Ders" size={genislik(b.ders, 'DERS')} />
                <span>DERSİ</span>
              </div>
              <input className="sh-b-sinav" value={b.sinavAdi} onChange={e => bGuncelle('sinavAdi', e.target.value)} placeholder="SINAV ADI (örn. 1. Dönem 1. Yazılı)" aria-label="Sınav adı" />
              {sinav.ayar.ogrenciBilgisi && (
                <div className="sh-b-ogrenci" aria-hidden="true">
                  <span>Adı Soyadı: <i /></span><span>Numarası: <i /></span><span>Sınıfı: <i /></span><span className="sh-b-puan">PUAN</span>
                </div>
              )}
              <div className="sh-b-bilgi">
                <label>Tarih<input value={b.tarih} onChange={e => bGuncelle('tarih', e.target.value)} placeholder="gg.aa.yyyy" /></label>
                <label>Süre<input value={b.sure} onChange={e => bGuncelle('sure', e.target.value)} placeholder="40 dakika" /></label>
                <label>Öğretmen<input value={b.ogretmen} onChange={e => bGuncelle('ogretmen', e.target.value)} placeholder="Ad Soyad" /></label>
              </div>
              <Duzenlenebilir className="sh-b-yonerge" deger={b.yonerge} onDegis={h => bGuncelle('yonerge', h)} yerTutucu="Sınav yönergesi (isteğe bağlı) — örn. Süre 40 dakikadır. Cevaplarınızı tükenmez kalemle yazınız." />
              {sinav.ayar.grupSayisi > 1 && <span className="sh-b-grup" title="Grup harfi baskıda her kâğıtta ayrı görünür">A</span>}
            </div>

            {sinav.ogeler.length === 0 ? (
              <BosSayfa islem={islem} />
            ) : (
              <>
                <EkleCizgisi konum={0} islem={islem} />
                {sinav.ogeler.map((o, i) => (
                  <div key={o.id} className="sh-oge-sarmal">
                    <OgeKarti oge={o} no={no.get(o.id)} secili={secili === o.id} islem={islem} ayar={sinav.ayar}
                      ilk={i === 0} son={i === sinav.ogeler.length - 1} odakla={odak === o.id} />
                    <EkleCizgisi konum={i + 1} islem={islem} />
                  </div>
                ))}
                <div className="sh-kagit-son">
                  <Acilir genislik={300} tetik={<button type="button" className="sh-soru-ekle-buyuk"><Simge ad="arti" />Soru ekle</button>}>
                    <TurMenusu onSec={(t, sec) => islem.ekle(t, sinavRef.current.ogeler.length, sec)} />
                  </Acilir>
                </div>
              </>
            )}
            {sinav.ayar.altBilgi && <div className="sh-kagit-altbilgi">{sinav.ayar.altBilgi}{b.ogretmen && <span> — {b.ogretmen}</span>}</div>}
          </div>
          {sinav.ayar.sutun === 2 && <p className="sh-tuval-not"><Simge ad="sutun" boyut={15} />İki sütunlu düzen önizlemede ve baskıda uygulanır.</p>}
        </main>

        {/* ---------------------------------------------------------------- özellikler */}
        <aside className={'sh-ozellik' + (panel === 'ozellik' ? ' acik' : '')} aria-label="Özellikler">
          <Ozellikler sinav={sinav} degistir={degistir} secili={secili} no={no} islem={islem} onKapat={() => setPanel(null)} />
        </aside>
        {panel && <div className="sh-panel-perde" onClick={() => setPanel(null)} />}
      </div>

      {/* ---------------------------------------------------------------- telefon alt çubuğu */}
      <nav className="sh-alt-cubuk" aria-label="Düzenleyici">
        <button type="button" className={panel === 'anahat' ? 'secili' : ''} onClick={() => setPanel(p => (p === 'anahat' ? null : 'anahat'))}><Simge ad="liste" /><span>Sorular</span></button>
        <Acilir genislik={290} tetik={<button type="button" className="sh-alt-ekle"><Simge ad="arti" /><span>Ekle</span></button>}>
          <TurMenusu onSec={(t, sec) => islem.ekle(t, null, sec)} />
        </Acilir>
        <button type="button" className={panel === 'ozellik' ? 'secili' : ''} onClick={() => setPanel(p => (p === 'ozellik' ? null : 'ozellik'))}><Simge ad="ayarlar" /><span>{secili ? 'Soru' : 'Ayarlar'}</span></button>
        <a href={`#/sinav/${sinav.id}/yazdir`}><Simge ad="yazdir" /><span>Yazdır</span></a>
      </nav>

      {silOnay && (
        <Pencere baslik="Sınav silinsin mi?" simge="cop" onKapat={() => setSilOnay(false)}
          alt={<div className="dugmeler"><button type="button" className="ikincil" onClick={() => setSilOnay(false)}>Vazgeç</button><button type="button" className="birincil tehlike-dolu" onClick={async () => { await sinavSil(sinav.id); window.location.hash = '#/sinav' }}><Simge ad="cop" />Sil</button></div>}>
          <p className="aciklama">“{b.sinavAdi || 'Adsız sınav'}” ve içindeki görseller bu cihazdan kalıcı olarak silinecek.</p>
        </Pencere>
      )}
      {bildirim}
    </div>
  )
}

/** Başlıktaki kısa alanlar yazılan metin kadar genişler (field-sizing desteklemeyen tarayıcılar için) */
const genislik = (v, yerTutucu) => Math.max(4, Math.ceil(String(v || yerTutucu).length * 1.25) + 1)

// ------------------------------------------------------------------ boş sayfa
function BosSayfa({ islem }) {
  const [adet, setAdet] = useState(10)
  return (
    <div className="sh-bos-kagit">
      <b>Sınavınız boş</b>
      <p>İlk sorunuzu ekleyin ya da aynı türden birden çok soruyu tek seferde oluşturun.</p>
      <div className="sh-bos-turler">
        {['coktan', 'klasik', 'dy', 'bosluk', 'eslestirme', 'bolum'].map(t => (
          <button key={t} type="button" onClick={() => islem.ekle(t, null)}>
            <Simge ad={TURLER[t].simge} boyut={20} /><span>{TURLER[t].ad}</span>
          </button>
        ))}
      </div>
      <div className="sh-toplu">
        <span>Toplu ekle:</span>
        <input type="number" min="1" max="100" value={adet} onChange={e => setAdet(Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 1)))} aria-label="Soru sayısı" />
        <button type="button" className="ikincil kucuk" onClick={() => islem.topluEkle('coktan', adet)}>çoktan seçmeli</button>
        <button type="button" className="ikincil kucuk" onClick={() => islem.topluEkle('klasik', adet)}>açık uçlu</button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ sorular arasına ekleme
function EkleCizgisi({ konum, islem }) {
  return (
    <div className="sh-ekle-cizgi">
      <Acilir genislik={300} tetik={<button type="button" className="sh-ekle-arti" title="Buraya soru ekle" aria-label="Buraya soru ekle"><Simge ad="arti" boyut={14} kalinlik={2.4} /></button>}>
        <div className="sh-menu-baslik">Buraya ekle</div>
        <TurMenusu onSec={(t, sec) => islem.ekle(t, konum, sec)} />
      </Acilir>
    </div>
  )
}

// ------------------------------------------------------------------ ana hat (sol panel)
function AnaHat({ sinav, no, secili, islem, onSec }) {
  const [surukle, setSurukle] = useState(null)   // { id, hedef }
  const toplam = toplamPuan(sinav.ogeler)
  return (
    <div className="sh-anahat-ic">
      <div className="sh-anahat-ust">
        <span>Sorular</span>
        <span className="sh-anahat-sayi">{soruSayisi(sinav.ogeler)} soru · {toplam} p</span>
      </div>
      <button type="button" className={'sh-anahat-oge baslik' + (!secili ? ' secili' : '')} onClick={() => { islem.sec(null); document.getElementById('oge-__baslik')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); onSec() }}>
        <span className="sh-ah-no"><Simge ad="sayfa" boyut={14} /></span>
        <span className="sh-ah-metin">Sınav başlığı ve ayarlar</span>
      </button>
      <ol className="sh-anahat-liste" onDragOver={e => e.preventDefault()}>
        {sinav.ogeler.map((o, i) => (
          <li key={o.id}
            className={(surukle && surukle.hedef === i ? 'hedef-ust ' : '') + (surukle && surukle.hedef === i + 1 && i === sinav.ogeler.length - 1 ? 'hedef-alt ' : '')}
            onDragOver={e => { if (!surukle) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); const h = e.clientY < r.top + r.height / 2 ? i : i + 1; if (h !== surukle.hedef) setSurukle({ ...surukle, hedef: h }) }}
            onDrop={e => { e.preventDefault(); if (surukle && surukle.hedef != null) islem.tasiKonuma(surukle.id, surukle.hedef); setSurukle(null) }}>
            <button type="button" draggable
              onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', o.id); setSurukle({ id: o.id, hedef: null }) }}
              onDragEnd={() => setSurukle(null)}
              className={'sh-anahat-oge' + (o.tur === 'bolum' ? ' bolum' : '') + (secili === o.id ? ' secili' : '') + (surukle?.id === o.id ? ' tasiniyor' : '')}
              onClick={() => { islem.git(o.id); onSec() }}>
              <span className="sh-ah-tutamak" aria-hidden="true"><Simge ad="tutamak" boyut={14} /></span>
              <span className="sh-ah-no">{o.tur === 'bolum' ? <Simge ad="baslik" boyut={14} /> : no.get(o.id)}</span>
              <span className="sh-ah-metin">{ozet(o.metin, 60) || <i>{o.tur === 'bolum' ? 'Başlıksız bölüm' : TURLER[o.tur].ad}</i>}</span>
              {o.tur !== 'bolum' && <span className="sh-ah-puan">{o.puan || 0}</span>}
            </button>
          </li>
        ))}
      </ol>
      <div className="sh-anahat-alt">
        <Acilir genislik={290} tetik={<button type="button" className="ikincil kucuk tam"><Simge ad="arti" boyut={16} />Soru ekle</button>}>
          <TurMenusu onSec={(t, sec) => { islem.ekle(t, sinav.ogeler.length, sec); onSec() }} />
        </Acilir>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ biçim araç çubuğu
function AracCubugu({ islem, secili }) {
  const [durum, setDurum] = useState({ aktif: false, bosluk: false, b: false, i: false, u: false, sup: false, sub: false })
  useEffect(() => {
    const f = () => {
      const el = document.activeElement
      const aktif = !!(el && el.dataset && el.dataset.duz === '1')
      let d = { aktif, bosluk: aktif && el.dataset.bosluk === '1' }
      if (aktif) {
        try {
          d = { ...d, b: document.queryCommandState('bold'), i: document.queryCommandState('italic'), u: document.queryCommandState('underline'), sup: document.queryCommandState('superscript'), sub: document.queryCommandState('subscript') }
        } catch { /* yok */ }
      }
      setDurum(o => (Object.keys(d).every(k => o[k] === d[k]) ? o : d))
    }
    document.addEventListener('selectionchange', f)
    document.addEventListener('focusin', f)
    document.addEventListener('focusout', f)
    return () => { document.removeEventListener('selectionchange', f); document.removeEventListener('focusin', f); document.removeEventListener('focusout', f) }
  }, [])

  const komut = (ad, deger = null) => {
    const el = document.activeElement
    if (!el || el.dataset?.duz !== '1') return
    document.execCommand(ad, false, deger)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const dugme = (ad, etiket, ic, secili, baslik) => (
    <button type="button" className={'sh-bicim' + (secili ? ' secili' : '')} disabled={!durum.aktif} title={baslik} aria-label={etiket} aria-pressed={!!secili}
      onMouseDown={e => e.preventDefault()} onClick={() => komut(ad)}>{ic}</button>
  )

  return (
    <div className="sh-arac" role="toolbar" aria-label="Biçim">
      <div className="sh-arac-grup">
        {dugme('bold', 'Kalın', <b>K</b>, durum.b, 'Kalın (Ctrl+B)')}
        {dugme('italic', 'İtalik', <i>T</i>, durum.i, 'İtalik (Ctrl+I)')}
        {dugme('underline', 'Altı çizili', <u>A</u>, durum.u, 'Altı çizili (Ctrl+U)')}
        {dugme('superscript', 'Üst simge', <span>x<sup>2</sup></span>, durum.sup, 'Üst simge (üs)')}
        {dugme('subscript', 'Alt simge', <span>x<sub>2</sub></span>, durum.sub, 'Alt simge (indis)')}
        {dugme('insertUnorderedList', 'Madde işaretli liste', <Simge ad="liste" boyut={16} />, false, 'Madde işaretli liste')}
        {dugme('removeFormat', 'Biçimi temizle', <span className="sh-temizle">T<small>×</small></span>, false, 'Biçimi temizle')}
      </div>
      <span className="sh-arac-ayrac" />
      <div className="sh-arac-grup">
        <Acilir genislik={332} tetik={<button type="button" className="sh-bicim genis" disabled={!durum.aktif} title="Sembol ekle" onMouseDown={e => e.preventDefault()}><Simge ad="sembol" boyut={16} /><span>Sembol</span><Simge ad="asagi" boyut={13} /></button>}>
          {kapat => (
            <div className="sh-semboller">
              {SEMBOLLER.map(([grup, liste]) => (
                <div key={grup}>
                  <div className="sh-menu-baslik">{grup}</div>
                  <div className="sh-sembol-izgara">
                    {liste.map(s => <button key={s} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { komut('insertText', s); kapat() }}>{s}</button>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Acilir>
        <button type="button" className={'sh-bicim genis vurgu' + (durum.bosluk ? '' : ' pasif')} disabled={!durum.bosluk} title="Seçili kelimeyi boşluk yap (boşluk doldurma sorularında)" onMouseDown={e => e.preventDefault()} onClick={boslukYap}>
          <Simge ad="bosluk" boyut={16} /><span>Boşluk yap</span>
        </button>
      </div>
      <span className="sh-arac-ayrac" />
      <div className="sh-arac-grup">
        <GorselDugmesi islem={islem} secili={secili} />
        <Acilir genislik={300} tetik={<button type="button" className="sh-bicim genis ekle"><Simge ad="arti" boyut={16} /><span>Soru ekle</span><Simge ad="asagi" boyut={13} /></button>}>
          <TurMenusu onSec={(t, sec) => islem.ekle(t, null, sec)} />
        </Acilir>
      </div>
    </div>
  )
}

function GorselDugmesi({ islem, secili }) {
  const r = useRef(null)
  return (
    <>
      <button type="button" className="sh-bicim genis" disabled={!secili} title={secili ? 'Seçili soruya görsel ekle' : 'Önce bir soru seçin'} onMouseDown={e => e.preventDefault()} onClick={() => r.current?.click()}>
        <Simge ad="gorsel" boyut={16} /><span>Görsel</span>
      </button>
      <input ref={r} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f && secili) islem.gorselEkle(secili, f) }} />
    </>
  )
}

/** Seçili kelime(ler)i boşluğa çevirir; imleç bir boşluğun içindeyse boşluğu kaldırır. */
function boslukYap() {
  const el = document.activeElement
  if (!el || el.dataset?.bosluk !== '1') return
  const sec = window.getSelection()
  if (!sec || !sec.rangeCount) return
  let r = sec.getRangeAt(0)
  if (!el.contains(r.commonAncestorContainer)) return
  const icindeki = n => (n && (n.nodeType === 3 ? n.parentElement : n))?.closest?.('span.bosluk')
  const mevcut = icindeki(r.startContainer)
  if (mevcut && el.contains(mevcut)) {
    const t = document.createTextNode(mevcut.textContent)
    mevcut.replaceWith(t)
    el.normalize()
    el.dispatchEvent(new Event('input', { bubbles: true }))
    return
  }
  if (r.collapsed) {
    try { sec.modify('move', 'backward', 'word'); sec.modify('extend', 'forward', 'word') } catch { return }
    r = sec.getRangeAt(0)
  }
  const ham = r.toString()
  const metin = ham.trim()
  if (!metin) return
  const bas = ham.match(/^\s*/)[0], son = ham.match(/\s*$/)[0]
  const span = document.createElement('span')
  span.className = 'bosluk'
  span.textContent = metin
  r.deleteContents()
  const frag = document.createDocumentFragment()
  if (bas) frag.appendChild(document.createTextNode(bas))
  frag.appendChild(span)
  const sonDugum = document.createTextNode(son || ' ')
  frag.appendChild(sonDugum)
  r.insertNode(frag)
  const r2 = document.createRange()
  r2.setStart(sonDugum, sonDugum.length)
  r2.collapse(true)
  sec.removeAllRanges(); sec.addRange(r2)
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
