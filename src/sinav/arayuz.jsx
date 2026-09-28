import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Simge from '../bilesenler/Simge.jsx'
import { GRUP_HARFLERI, MAKS_GRUP } from './model.js'

/** Açılır menü: tetikleyiciye göre konumlanır, dışarı tıklayınca / Esc ile kapanır. */
export function Acilir({ tetik, children, hiza = 'sol', genislik, className = '', acikBaslat = false, onAcik }) {
  const [acik, setAcik] = useState(acikBaslat)
  const [konum, setKonum] = useState(null)
  const tetikRef = useRef(null)
  const menuRef = useRef(null)

  useLayoutEffect(() => {
    if (!acik) return
    const hesapla = () => {
      const r = tetikRef.current?.getBoundingClientRect()
      const m = menuRef.current
      if (!r || !m) return
      const mw = m.offsetWidth, mh = m.offsetHeight
      let x = hiza === 'sag' ? r.right - mw : r.left
      x = Math.max(8, Math.min(x, window.innerWidth - mw - 8))
      let y = r.bottom + 6
      if (y + mh > window.innerHeight - 8 && r.top - mh - 6 > 8) y = r.top - mh - 6
      setKonum({ x, y: Math.max(8, y) })
    }
    hesapla()
    window.addEventListener('resize', hesapla)
    window.addEventListener('scroll', hesapla, true)
    return () => { window.removeEventListener('resize', hesapla); window.removeEventListener('scroll', hesapla, true) }
  }, [acik, hiza])

  useEffect(() => {
    onAcik && onAcik(acik)
    if (!acik) return
    const dis = e => { if (!menuRef.current?.contains(e.target) && !tetikRef.current?.contains(e.target)) setAcik(false) }
    const tus = e => { if (e.key === 'Escape') { setAcik(false); tetikRef.current?.querySelector('button')?.focus() } }
    document.addEventListener('pointerdown', dis, true)
    document.addEventListener('keydown', tus)
    return () => { document.removeEventListener('pointerdown', dis, true); document.removeEventListener('keydown', tus) }
  }, [acik])

  return (
    <>
      <span ref={tetikRef} className="sh-acilir-tetik" onMouseDown={e => { if (e.target.closest('button')) e.preventDefault() }} onClick={() => setAcik(v => !v)}>
        {typeof tetik === 'function' ? tetik(acik) : tetik}
      </span>
      {acik && createPortal(
        <div ref={menuRef} className={'sh sh-menu ' + className} role="menu" style={{ left: konum?.x ?? -9999, top: konum?.y ?? -9999, width: genislik }}
          onMouseDown={e => { if (!e.target.closest('input,textarea,select')) e.preventDefault() }}
          onClick={e => { if (e.target.closest('[data-kapat]')) setAcik(false) }}>
          {typeof children === 'function' ? children(() => setAcik(false)) : children}
        </div>,
        document.body,
      )}
    </>
  )
}

export function MenuOge({ simge, children, aciklama, onClick, tehlike, devreDisi, kisayol, secili }) {
  return (
    <button type="button" role="menuitem" className={'sh-menu-oge' + (tehlike ? ' tehlike' : '') + (secili ? ' secili' : '')} disabled={devreDisi} data-kapat onClick={onClick}>
      {simge && <span className="sh-menu-simge"><Simge ad={simge} boyut={17} /></span>}
      <span className="sh-menu-metin"><b>{children}</b>{aciklama && <small>{aciklama}</small>}</span>
      {kisayol && <kbd>{kisayol}</kbd>}
      {secili && <Simge ad="onay" boyut={16} className="sh-menu-onay" />}
    </button>
  )
}

export const MenuAyrac = () => <div className="sh-menu-ayrac" role="separator" />

/** Pencere (masaüstünde ortada, telefonda alttan açılan sayfa) */
export function Pencere({ baslik, altBaslik, simge, onKapat, children, alt, genis, className = '' }) {
  useEffect(() => {
    const tus = e => { if (e.key === 'Escape') onKapat && onKapat() }
    document.addEventListener('keydown', tus)
    const onceki = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', tus); document.body.style.overflow = onceki }
  }, [onKapat])
  return createPortal(
    <div className="sh pencere-arka" onMouseDown={e => { if (e.target === e.currentTarget) onKapat && onKapat() }}>
      <div className={'pencere' + (genis ? ' genis' : '') + ' ' + className} role="dialog" aria-modal="true" aria-label={baslik}>
        <div className="pencere-bas">
          {simge && <span className="pencere-simge"><Simge ad={simge} /></span>}
          <div className="pencere-bas-metin">
            <h2>{baslik}</h2>
            {altBaslik && <p className="aciklama">{altBaslik}</p>}
          </div>
          {onKapat && <button type="button" className="pencere-kapat" aria-label="Kapat" onClick={onKapat}><Simge ad="kapat" boyut={18} /></button>}
        </div>
        <div className="pencere-govde">{children}</div>
        {alt && <div className="pencere-alt">{alt}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Bölümlü seçici (iOS benzeri) */
export function Secici({ secenekler, deger, onDegis, etiket, kucuk }) {
  return (
    <div className={'sh-secici' + (kucuk ? ' kucuk' : '')} role="radiogroup" aria-label={etiket}>
      {secenekler.map(([d, ad, ipucu]) => (
        <button key={String(d)} type="button" role="radio" aria-checked={deger === d} title={ipucu} className={deger === d ? 'secili' : ''} onClick={() => onDegis(d)}>{ad}</button>
      ))}
    </div>
  )
}

/** Ekranı dolduran kabuk (düzenleyici, önizleme) kaymamalı: overflow: clip desteklemeyen eski tarayıcılarda da geri al */
export function kabukKaymasin(e) {
  const el = e.currentTarget
  if (e.target === el && (el.scrollTop || el.scrollLeft)) { el.scrollTop = 0; el.scrollLeft = 0 }
}

export function Anahtar({ deger, onDegis, children, aciklama }) {
  return (
    <label className="sh-anahtar">
      <span className="sh-anahtar-metin"><span>{children}</span>{aciklama && <small>{aciklama}</small>}</span>
      <input type="checkbox" checked={!!deger} onChange={e => onDegis(e.target.checked)} />
      <span className="sh-anahtar-ray" aria-hidden="true"><span /></span>
    </label>
  )
}

export function Sayac({ deger, onDegis, min = 0, maks = 100, adim = 1, etiket, birim }) {
  const d = Number(deger) || 0
  const [yazi, setYazi] = useState(null)       // yazarken ara metin ("8," gibi); bitince sayıya çevrilir
  const sinirla = v => Math.max(min, Math.min(maks, v))
  const ayarla = v => onDegis(sinirla(Math.round(v * 100) / 100))
  const cevir = t => parseFloat(String(t).replace(',', '.'))
  const gorunen = yazi ?? (deger === '' ? '' : String(Math.round(d * 100) / 100).replace('.', ','))
  return (
    <div className="sh-sayac" aria-label={etiket}>
      <button type="button" aria-label="Azalt" disabled={d <= min} onClick={() => ayarla(d - adim)}>−</button>
      <input type="text" inputMode="decimal" value={gorunen} aria-label={etiket}
        onChange={e => { const t = e.target.value; setYazi(t); const v = cevir(t); if (!Number.isNaN(v) && /^\s*\d*[.,]?\d*\s*$/.test(t)) onDegis(sinirla(v)) }}
        onBlur={() => { if (yazi === null) return; const v = cevir(yazi); setYazi(null); onDegis(sinirla(Number.isNaN(v) ? min : Math.round(v * 10000) / 10000)) }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
      {birim && <span className="sh-sayac-birim">{birim}</span>}
      <button type="button" aria-label="Artır" disabled={d >= maks} onClick={() => ayarla(d + adim)}>+</button>
    </div>
  )
}

/**
 * Grup sayısı: tek grup ya da A–B, A–B–C, A–B–C–D (optik formdaki kitapçık türleri). Tek dokunuşla seçilir;
 * altında basılacak grupların harfleri görünür.
 */
export function GrupSecici({ deger, onDegis }) {
  const n = Math.max(1, Math.min(MAKS_GRUP, Number(deger) || 1))
  return (
    <div className="sh-grup-secici">
      <div className="sh-secici" role="radiogroup" aria-label="Grup sayısı">
        {Array.from({ length: MAKS_GRUP }, (_, i) => i + 1).map(k => (
          <button key={k} type="button" role="radio" aria-checked={n === k} className={n === k ? 'secili' : ''} onClick={() => { if (k !== n) onDegis(k) }}
            title={k === 1 ? 'Tek grup' : `${GRUP_HARFLERI.slice(0, k).split('').join(', ')} grupları`}>
            {k === 1 ? 'Tek grup' : `${k} grup`}
          </button>
        ))}
      </div>
      <div className="sh-grup-harfler" aria-hidden="true">
        {GRUP_HARFLERI.split('').map((h, i) => <i key={h} className={i < n ? '' : 'yok'}>{h}</i>)}
        <span>{n === 1 ? 'Herkese aynı kâğıt' : `${GRUP_HARFLERI.slice(0, n).split('').join(', ')} grupları`}</span>
      </div>
    </div>
  )
}

export function useBildirim() {
  const [b, setB] = useState(null)
  useEffect(() => {
    if (!b) return
    const t = setTimeout(() => setB(null), b.sure || 3200)
    return () => clearTimeout(t)
  }, [b])
  const goster = useCallback((metin, tur = 'tamam', ek = {}) => setB({ metin, tur, zaman: Date.now(), ...ek }), [])
  const ogesi = b && createPortal(
    <div key={b.zaman} className={'sh sh-tost ' + b.tur} role="status">
      <Simge ad={b.tur === 'hata' ? 'uyari' : b.tur === 'bilgi' ? 'bilgi' : 'onayDaire'} boyut={18} />
      <span>{b.metin}</span>
      {b.eylem && <button type="button" onClick={() => { b.eylem.fn(); setB(null) }}>{b.eylem.ad}</button>}
    </div>,
    document.body,
  )
  return [ogesi, goster]
}

export function tarihMetni(t) {
  if (!t) return ''
  const d = new Date(t), simdi = new Date()
  const ayniGun = d.toDateString() === simdi.toDateString()
  if (ayniGun) return 'bugün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dun = new Date(simdi); dun.setDate(dun.getDate() - 1)
  if (d.toDateString() === dun.toDateString()) return 'dün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: d.getFullYear() === simdi.getFullYear() ? undefined : 'numeric' })
}
