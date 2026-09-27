import { memo, useEffect, useRef, useState } from 'react'
import Simge from '../bilesenler/Simge.jsx'
import Duzenlenebilir from './Duzenlenebilir.jsx'
import { Acilir, MenuOge, MenuAyrac } from './arayuz.jsx'
import { HARFLER, TURLER, sikDuzeni, yeniId } from './model.js'
import { kucukHarf } from './karistir.js'
import { useGorsel } from './gorsel.js'

const SORU_TURLERI = ['coktan', 'klasik', 'dy', 'bosluk', 'eslestirme']

/** Soru türü ekleme menüsünün içeriği */
export function TurMenusu({ onSec, bolumDahil = true }) {
  return (
    <>
      {SORU_TURLERI.map(t => (
        <MenuOge key={t} simge={TURLER[t].simge} aciklama={TURLER[t].aciklama} onClick={() => onSec(t)}>{TURLER[t].ad}</MenuOge>
      ))}
      <MenuOge simge="kalem" aciklama="Tek satırlık cevap alanı" onClick={() => onSec('klasik', { satir: 1 })}>Kısa cevaplı</MenuOge>
      {bolumDahil && (<><MenuAyrac /><MenuOge simge={TURLER.bolum.simge} aciklama={TURLER.bolum.aciklama} onClick={() => onSec('bolum')}>{TURLER.bolum.ad}</MenuOge></>)}
    </>
  )
}

/** Sayfadaki bir soru (ya da bölüm başlığı) */
export const OgeKarti = memo(function OgeKarti({ oge, no, secili, islem, ayar, ilk, son, odakla }) {
  const kutuRef = useRef(null)
  const dosyaRef = useRef(null)
  const [surukle, setSurukle] = useState(false)
  const guncelle = (patch, anahtar) => islem.guncelle(oge.id, patch, anahtar)
  const anahtar = alan => `${oge.id}:${alan}`
  const gorselSec = () => dosyaRef.current?.click()
  const gorselDosya = (dosya, sikId) => islem.gorselEkle(oge.id, dosya, sikId)

  useEffect(() => {
    if (odakla && kutuRef.current) kutuRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [odakla])

  const bolum = oge.tur === 'bolum'
  return (
    <div ref={kutuRef} id={`oge-${oge.id}`}
      className={`sh-oge sh-oge-${oge.tur}${secili ? ' secili' : ''}${surukle ? ' surukle' : ''}`}
      onMouseDown={() => islem.sec(oge.id)} onFocusCapture={() => islem.sec(oge.id)}
      onDragOver={e => { if (!bolum && Array.from(e.dataTransfer?.items || []).some(i => i.kind === 'file')) { e.preventDefault(); setSurukle(true) } }}
      onDragLeave={() => setSurukle(false)}
      onDrop={e => {
        setSurukle(false)
        const f = Array.from(e.dataTransfer?.files || []).find(x => /^image\//.test(x.type))
        if (f && !bolum) { e.preventDefault(); gorselDosya(f) }
      }}>
      <div className="sh-oge-arac" onMouseDown={e => { if (!e.target.closest('input')) e.preventDefault() }}>
        <Acilir genislik={280} tetik={<button type="button" className="sh-tur-cip" title="Soru türünü değiştir"><Simge ad={TURLER[oge.tur].simge} boyut={14} />{TURLER[oge.tur].kisa}<Simge ad="asagi" boyut={13} /></button>}>
          <div className="sh-menu-baslik">Türü değiştir</div>
          <TurMenusu onSec={(t, sec) => islem.turDegistir(oge.id, t, sec)} />
        </Acilir>
        {!bolum && (
          <label className="sh-puan-kutu" title="Bu sorunun puanı">
            <PuanGirdisi deger={oge.puan} onDegis={v => guncelle({ puan: v }, anahtar('puan'))} />
            <span>puan</span>
          </label>
        )}
        <span className="sh-arac-bosluk" />
        {!bolum && <button type="button" className="sh-ikon-dugme" title="Görsel ekle" onClick={gorselSec}><Simge ad="gorsel" boyut={17} /></button>}
        <button type="button" className="sh-ikon-dugme" title="Yukarı taşı" disabled={ilk} onClick={() => islem.tasi(oge.id, -1)}><Simge ad="yukari" boyut={17} /></button>
        <button type="button" className="sh-ikon-dugme" title="Aşağı taşı" disabled={son} onClick={() => islem.tasi(oge.id, 1)}><Simge ad="asagi" boyut={17} /></button>
        <button type="button" className="sh-ikon-dugme" title="Çoğalt" onClick={() => islem.cogalt(oge.id)}><Simge ad="kopya" boyut={16} /></button>
        <button type="button" className="sh-ikon-dugme tehlike" title="Sil" onClick={() => islem.sil(oge.id)}><Simge ad="cop" boyut={16} /></button>
        <input ref={dosyaRef} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) gorselDosya(f) }} />
      </div>

      {bolum ? (
        <div className="sh-bolum-govde">
          <Duzenlenebilir className="sh-bolum-baslik" deger={oge.metin} onDegis={h => guncelle({ metin: h }, anahtar('metin'))} yerTutucu="Bölüm başlığı — örn. A) Aşağıdaki soruları cevaplayınız." tekSatir otomatikOdak={odakla} />
          <Duzenlenebilir className="sh-bolum-aciklama" deger={oge.aciklama} onDegis={h => guncelle({ aciklama: h }, anahtar('aciklama'))} yerTutucu="Açıklama (isteğe bağlı)" />
        </div>
      ) : (
        <div className="sh-soru">
          <span className="sh-soru-no">{no}.</span>
          <div className="sh-soru-icerik">
            {oge.gorsel && oge.gorsel.konum === 'yan' && <GorselBlok gorsel={oge.gorsel} onDegis={(g, a) => guncelle({ gorsel: g }, a)} onDegistir={gorselSec} />}
            <Duzenlenebilir className="sh-soru-metni" deger={oge.metin} onDegis={h => guncelle({ metin: h }, anahtar('metin'))}
              yerTutucu={YER_TUTUCU[oge.tur]} onGorsel={f => gorselDosya(f)} otomatikOdak={odakla} />
            {oge.gorsel && oge.gorsel.konum !== 'yan' && <GorselBlok gorsel={oge.gorsel} onDegis={(g, a) => guncelle({ gorsel: g }, a)} onDegistir={gorselSec} />}
            {oge.tur === 'coktan' && <CoktanSecmeli oge={oge} guncelle={guncelle} anahtar={anahtar} ayar={ayar} gorselDosya={gorselDosya} />}
            {oge.tur === 'dy' && <DogruYanlis oge={oge} guncelle={guncelle} anahtar={anahtar} />}
            {oge.tur === 'bosluk' && <BoslukDoldurma oge={oge} guncelle={guncelle} anahtar={anahtar} />}
            {oge.tur === 'eslestirme' && <Eslestirme oge={oge} guncelle={guncelle} anahtar={anahtar} />}
            {oge.tur === 'klasik' && <Klasik oge={oge} guncelle={guncelle} anahtar={anahtar} />}
          </div>
        </div>
      )}
      {surukle && <div className="sh-birak">Görseli bu soruya eklemek için bırakın</div>}
    </div>
  )
})

/** Soru puanı: ekranda en çok iki ondalık (8,33) görünür; dokunulmadıkça kesin değer (8,3333…) korunur */
function PuanGirdisi({ deger, onDegis }) {
  const [yazi, setYazi] = useState(null)
  const d = Number(deger) || 0
  const cevir = t => parseFloat(String(t).replace(',', '.'))
  return (
    <input type="text" inputMode="decimal" aria-label="Puan" value={yazi ?? String(Math.round(d * 100) / 100).replace('.', ',')}
      onChange={e => { const t = e.target.value; if (!/^\s*\d*[.,]?\d*\s*$/.test(t)) return; setYazi(t); const v = cevir(t); if (!Number.isNaN(v)) onDegis(Math.max(0, Math.min(1000, v))) }}
      onBlur={() => { if (yazi === null) return; const v = cevir(yazi); setYazi(null); onDegis(Number.isNaN(v) ? 0 : Math.max(0, Math.min(1000, Math.round(v * 10000) / 10000))) }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
  )
}

const YER_TUTUCU = {
  coktan: 'Soru kökünü yazın… (resim yapıştırabilir ya da sürükleyip bırakabilirsiniz)',
  klasik: 'Soruyu yazın…',
  dy: 'Yönerge',
  bosluk: 'Yönerge',
  eslestirme: 'Yönerge',
}

// ------------------------------------------------------------------ çoktan seçmeli
function CoktanSecmeli({ oge, guncelle, anahtar, ayar, gorselDosya }) {
  const kutu = useRef(null)
  const [odak, setOdak] = useState(null)
  const duzen = sikDuzeni(oge, ayar.sikDuzeni, 1)
  const sikGuncelle = (id, patch, a) => guncelle(o => ({ siklar: o.siklar.map(s => (s.id === id ? { ...s, ...patch } : s)) }), a)
  const sikEkle = (sonra) => {
    if (oge.siklar.length >= 5) return
    const yeni = { id: yeniId(), metin: '', gorsel: null }
    guncelle(o => { const s = [...o.siklar]; const i = sonra ? s.findIndex(x => x.id === sonra) + 1 : s.length; s.splice(i, 0, yeni); return { siklar: s } })
    setOdak(yeni.id)
  }
  const sikSil = id => guncelle(o => ({ siklar: o.siklar.filter(s => s.id !== id), dogru: o.dogru === id ? null : o.dogru }))
  const sonrakineGec = (id) => {
    const i = oge.siklar.findIndex(s => s.id === id)
    if (i < oge.siklar.length - 1) {
      const el = kutu.current?.querySelectorAll('.sh-sik-metin')[i + 1]
      if (el) { el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r) }
    } else sikEkle(id)
  }
  return (
    <div ref={kutu} className={`sh-siklar duzen-${duzen}`} style={{ '--sik-sayi': oge.siklar.length }}>
      {oge.siklar.map((s, i) => (
        <div key={s.id} className={'sh-sik' + (oge.dogru === s.id ? ' dogru' : '')}>
          <button type="button" className="sh-sik-harf" onMouseDown={e => e.preventDefault()} onClick={() => guncelle({ dogru: oge.dogru === s.id ? null : s.id })}
            title={oge.dogru === s.id ? 'Doğru cevap (kaldırmak için tıklayın)' : 'Doğru cevap olarak işaretle'} aria-pressed={oge.dogru === s.id}>
            {HARFLER[i]}
          </button>
          <div className="sh-sik-icerik">
            <Duzenlenebilir className="sh-sik-metin" deger={s.metin} onDegis={h => sikGuncelle(s.id, { metin: h }, anahtar('sik' + s.id))}
              yerTutucu={`${HARFLER[i]} şıkkı`} onEnter={() => sonrakineGec(s.id)} onGorsel={f => gorselDosya(f, s.id)} otomatikOdak={odak === s.id} />
            {s.gorsel && <GorselBlok kucuk gorsel={s.gorsel} onDegis={(g, a) => sikGuncelle(s.id, { gorsel: g }, a)} />}
          </div>
          <div className="sh-sik-arac">
            <SikGorselDugme onDosya={f => gorselDosya(f, s.id)} />
            {oge.siklar.length > 2 && <button type="button" className="sh-ikon-dugme kucuk" title="Şıkkı sil" onMouseDown={e => e.preventDefault()} onClick={() => sikSil(s.id)}><Simge ad="kapat" boyut={14} /></button>}
          </div>
        </div>
      ))}
      <div className="sh-siklar-alt">
        {oge.siklar.length < 5 && <button type="button" className="sh-ekle-kucuk" onClick={() => sikEkle()}><Simge ad="arti" boyut={14} />Şık ekle</button>}
        {!oge.dogru && <span className="sh-ipucu uyari"><Simge ad="bilgi" boyut={14} />Doğru cevabı işaretlemek için harfe tıklayın</span>}
      </div>
    </div>
  )
}

function SikGorselDugme({ onDosya }) {
  const r = useRef(null)
  return (
    <>
      <button type="button" className="sh-ikon-dugme kucuk" title="Şıkka görsel ekle" onMouseDown={e => e.preventDefault()} onClick={() => r.current?.click()}><Simge ad="gorsel" boyut={14} /></button>
      <input ref={r} type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onDosya(f) }} />
    </>
  )
}

// ------------------------------------------------------------------ doğru / yanlış
function DogruYanlis({ oge, guncelle, anahtar }) {
  const [odak, setOdak] = useState(null)
  const madde = (id, patch, a) => guncelle(o => ({ maddeler: o.maddeler.map(m => (m.id === id ? { ...m, ...patch } : m)) }), a)
  const ekle = () => { const m = { id: yeniId(), metin: '', dogru: true }; guncelle(o => ({ maddeler: [...o.maddeler, m] })); setOdak(m.id) }
  return (
    <div className="sh-liste-blok">
      {oge.maddeler.map((m, i) => (
        <div key={m.id} className="sh-madde">
          <span className="sh-harf">{kucukHarf(i)})</span>
          <div className="sh-dy-sec" role="radiogroup" aria-label="Cevap">
            <button type="button" className={m.dogru ? 'secili d' : ''} onMouseDown={e => e.preventDefault()} onClick={() => madde(m.id, { dogru: true })} aria-checked={m.dogru} role="radio">D</button>
            <button type="button" className={!m.dogru ? 'secili y' : ''} onMouseDown={e => e.preventDefault()} onClick={() => madde(m.id, { dogru: false })} aria-checked={!m.dogru} role="radio">Y</button>
          </div>
          <Duzenlenebilir className="sh-madde-metin" deger={m.metin} onDegis={h => madde(m.id, { metin: h }, anahtar('m' + m.id))} yerTutucu="İfadeyi yazın…" onEnter={ekle} otomatikOdak={odak === m.id} />
          {oge.maddeler.length > 1 && <button type="button" className="sh-ikon-dugme kucuk" title="İfadeyi sil" onClick={() => guncelle(o => ({ maddeler: o.maddeler.filter(x => x.id !== m.id) }))}><Simge ad="kapat" boyut={14} /></button>}
        </div>
      ))}
      <button type="button" className="sh-ekle-kucuk" onClick={ekle}><Simge ad="arti" boyut={14} />İfade ekle</button>
    </div>
  )
}

// ------------------------------------------------------------------ boşluk doldurma
function BoslukDoldurma({ oge, guncelle, anahtar }) {
  const [odak, setOdak] = useState(null)
  const cumle = (id, patch, a) => guncelle(o => ({ cumleler: o.cumleler.map(m => (m.id === id ? { ...m, ...patch } : m)) }), a)
  const ekle = () => { const c = { id: yeniId(), metin: '' }; guncelle(o => ({ cumleler: [...o.cumleler, c] })); setOdak(c.id) }
  return (
    <div className="sh-liste-blok">
      <div className="sh-ipucu"><Simge ad="bilgi" boyut={14} />Boşluk olacak kelimeyi seçip araç çubuğundaki <b>Boşluk yap</b>'a basın ya da <b>[köşeli parantez]</b> içinde yazın.</div>
      {oge.cumleler.map((c, i) => (
        <div key={c.id} className="sh-madde">
          <span className="sh-harf">{kucukHarf(i)})</span>
          <Duzenlenebilir className="sh-madde-metin" bosluk deger={c.metin} onDegis={h => cumle(c.id, { metin: h }, anahtar('c' + c.id))} yerTutucu="Cümleyi yazın, örn. Türkiye'nin başkenti [Ankara]'dır." onEnter={ekle} otomatikOdak={odak === c.id} />
          {oge.cumleler.length > 1 && <button type="button" className="sh-ikon-dugme kucuk" title="Cümleyi sil" onClick={() => guncelle(o => ({ cumleler: o.cumleler.filter(x => x.id !== c.id) }))}><Simge ad="kapat" boyut={14} /></button>}
        </div>
      ))}
      <button type="button" className="sh-ekle-kucuk" onClick={ekle}><Simge ad="arti" boyut={14} />Cümle ekle</button>
    </div>
  )
}

// ------------------------------------------------------------------ eşleştirme
function Eslestirme({ oge, guncelle, anahtar }) {
  const [odak, setOdak] = useState(null)
  const cift = (id, patch, a) => guncelle(o => ({ ciftler: o.ciftler.map(m => (m.id === id ? { ...m, ...patch } : m)) }), a)
  const ekle = () => { const c = { id: yeniId(), sol: '', sag: '' }; guncelle(o => ({ ciftler: [...o.ciftler, c] })); setOdak(c.id) }
  return (
    <div className="sh-liste-blok">
      <div className="sh-cift-baslik"><span /><span>Sol sütun</span><span /><span>Doğru eşi <small>(baskıda karıştırılır)</small></span><span /></div>
      {oge.ciftler.map((c, i) => (
        <div key={c.id} className="sh-cift">
          <span className="sh-harf">{i + 1}.</span>
          <Duzenlenebilir className="sh-cift-metin" deger={c.sol} onDegis={h => cift(c.id, { sol: h }, anahtar('s' + c.id))} yerTutucu="Kavram" otomatikOdak={odak === c.id} />
          <span className="sh-cift-ok" aria-hidden="true"><Simge ad="ileri" boyut={15} /></span>
          <Duzenlenebilir className="sh-cift-metin" deger={c.sag} onDegis={h => cift(c.id, { sag: h }, anahtar('g' + c.id))} yerTutucu="Karşılığı" onEnter={ekle} />
          {oge.ciftler.length > 1 ? <button type="button" className="sh-ikon-dugme kucuk" title="Çifti sil" onClick={() => guncelle(o => ({ ciftler: o.ciftler.filter(x => x.id !== c.id) }))}><Simge ad="kapat" boyut={14} /></button> : <span />}
        </div>
      ))}
      <button type="button" className="sh-ekle-kucuk" onClick={ekle}><Simge ad="arti" boyut={14} />Çift ekle</button>
    </div>
  )
}

// ------------------------------------------------------------------ açık uçlu
function Klasik({ oge }) {
  const n = Number(oge.satir) || 0
  if (!n) return null
  return (
    <div className={'sh-cevap-alani ' + (oge.alan === 'bos' ? 'bos' : 'cizgili')} style={{ '--satir': n }} aria-hidden="true">
      <span className="sh-cevap-etiket">{n === 1 ? 'Kısa cevap alanı' : `Cevap alanı · ${n} satır`}</span>
    </div>
  )
}

// ------------------------------------------------------------------ görsel
export function GorselBlok({ gorsel, onDegis, onDegistir, kucuk }) {
  const v = useGorsel(gorsel.id)
  const kutu = useRef(null)
  const [canli, setCanli] = useState(null)
  const genislik = canli ?? gorsel.genislik ?? (kucuk ? 60 : 50)

  function boyutla(e) {
    e.preventDefault(); e.stopPropagation()
    const kap = kutu.current?.parentElement
    if (!kap) return
    const kapG = kap.getBoundingClientRect().width
    const x0 = e.clientX, g0 = genislik
    const yon = gorsel.hiza === 'sag' || gorsel.konum === 'yan' ? -1 : 1
    let son = g0
    const hareket = ev => { son = Math.round(Math.max(12, Math.min(100, g0 + yon * (ev.clientX - x0) / kapG * 100 * (gorsel.hiza === 'orta' || !gorsel.hiza ? 2 : 1)))); setCanli(son) }
    const birak = () => {
      window.removeEventListener('pointermove', hareket); window.removeEventListener('pointerup', birak)
      setCanli(null)
      onDegis({ ...gorsel, genislik: son }, 'gorsel-boyut')
    }
    window.addEventListener('pointermove', hareket)
    window.addEventListener('pointerup', birak)
  }

  return (
    <figure ref={kutu} className={`sh-gorsel hiza-${gorsel.hiza || 'orta'} konum-${gorsel.konum || 'alt'}${kucuk ? ' kucuk' : ''}`} style={{ width: `${genislik}%` }}>
      {v ? <img src={v.url} alt="" draggable={false} /> : <div className="sh-gorsel-yer" style={{ aspectRatio: '4 / 3' }} />}
      <div className="sh-gorsel-arac" onMouseDown={e => e.preventDefault()}>
        {!kucuk && [['sol', 'hizaSol', 'Sola hizala'], ['orta', 'hizaOrta', 'Ortala'], ['sag', 'hizaSag', 'Sağa hizala']].map(([h, s, t]) => (
          <button key={h} type="button" title={t} className={(gorsel.hiza || 'orta') === h && gorsel.konum !== 'yan' ? 'secili' : ''} onClick={() => onDegis({ ...gorsel, hiza: h, konum: 'alt' })}><Simge ad={s} boyut={15} /></button>
        ))}
        {!kucuk && <button type="button" title="Metnin yanında" className={gorsel.konum === 'yan' ? 'secili' : ''} onClick={() => onDegis({ ...gorsel, konum: gorsel.konum === 'yan' ? 'alt' : 'yan', genislik: gorsel.konum === 'yan' ? gorsel.genislik : Math.min(gorsel.genislik || 50, 45) })}><Simge ad="metinYani" boyut={15} /></button>}
        {onDegistir && <button type="button" title="Görseli değiştir" onClick={onDegistir}><Simge ad="yenile" boyut={15} /></button>}
        <button type="button" title="Görseli kaldır" className="tehlike" onClick={() => onDegis(null)}><Simge ad="cop" boyut={15} /></button>
      </div>
      <span className="sh-gorsel-tutamak" onPointerDown={boyutla} title="Boyutlandırmak için sürükleyin" />
      {canli != null && <span className="sh-gorsel-yuzde">%{canli}</span>}
    </figure>
  )
}
