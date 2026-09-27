import { memo, useLayoutEffect, useRef } from 'react'
import { temizle, bosMu, kacis, koseliParantezleriBoslugaCevir } from './metin.js'

/**
 * Word gibi yerinde düzenlenen metin alanı (contentEditable).
 * - React içeriği yönetmez: dışarıdan gelen değer yalnızca gerçekten değiştiğinde (geri al, yükleme) yazılır; imleç kaybolmaz.
 * - Yapıştırılan içerik temizlenir (Word/web stilleri atılır, kalın/italik/altı çizili korunur).
 * - Resim yapıştırılırsa onGorsel(dosya) çağrılır.
 * - bosluk: [köşeli parantez] içindeki kelimeler odak kaybında boşluğa çevrilir; araç çubuğunda "Boşluk yap" etkin olur.
 */
function Duzenlenebilir({ deger, onDegis, className = '', yerTutucu, tekSatir = false, bosluk = false, etiket, onGorsel, onOdak, onEnter, otomatikOdak }) {
  const ref = useRef(null)
  const son = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const d = deger || ''
    if (son.current === null || (d !== son.current && d !== el.innerHTML)) {
      el.innerHTML = d
      if (son.current !== null && document.activeElement === el) imleciSonaAl(el)
    }
    son.current = d
  }, [deger])

  useLayoutEffect(() => {
    if (otomatikOdak && ref.current) { ref.current.focus(); imleciSonaAl(ref.current) }
  }, [otomatikOdak])

  function bildir() {
    const el = ref.current
    let h = el.innerHTML
    if (bosMu(h)) { h = ''; if (el.innerHTML && !el.querySelector('span.bosluk')) el.innerHTML = '' }
    son.current = h
    onDegis(h)
  }

  function yapistir(e) {
    const cb = e.clipboardData
    if (!cb) return
    const dosya = Array.from(cb.files || []).find(f => /^image\//.test(f.type))
    if (dosya && onGorsel) { e.preventDefault(); onGorsel(dosya); return }
    e.preventDefault()
    const html = cb.getData('text/html')
    const duz = cb.getData('text/plain')
    let ekle = html ? temizle(html) : kacis(duz).replace(/\r?\n/g, '<br>')
    if (tekSatir) ekle = ekle.replace(/<br\s*\/?>|<\/?(div|p|li|ul|ol)[^>]*>/gi, ' ').replace(/\s+/g, ' ').trim()
    if (ekle) document.execCommand('insertHTML', false, ekle)
  }

  return (
    <div
      ref={ref}
      className={'sh-duz ' + className}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline={!tekSatir}
      aria-label={etiket || yerTutucu}
      data-yer-tutucu={yerTutucu}
      data-duz="1"
      data-bosluk={bosluk ? '1' : undefined}
      spellCheck
      lang="tr"
      onInput={bildir}
      onPaste={yapistir}
      onFocus={onOdak}
      onBlur={() => {
        if (bosluk && koseliParantezleriBoslugaCevir(ref.current)) bildir()
      }}
      onKeyDown={e => {
        if (e.key === 'Enter' && (tekSatir || onEnter) && !e.shiftKey) {
          e.preventDefault()
          if (onEnter) onEnter()
        }
      }}
      onDrop={e => {
        const dosya = Array.from(e.dataTransfer?.files || []).find(f => /^image\//.test(f.type))
        if (dosya && onGorsel) { e.preventDefault(); e.stopPropagation(); onGorsel(dosya) }
      }}
    />
  )
}

export function imleciSonaAl(el) {
  try {
    const r = document.createRange()
    r.selectNodeContents(el)
    r.collapse(false)
    const s = window.getSelection()
    s.removeAllRanges()
    s.addRange(r)
  } catch { /* yok */ }
}

export default memo(Duzenlenebilir)
