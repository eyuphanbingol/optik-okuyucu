/*
 * Soru metinleri için sınırlı HTML.
 * İzin verilen: b, i, u, sup, sub, br, div, p, ul, ol, li, span.bosluk
 * Başka her şey (Word/web'den yapıştırılan stiller, bağlantılar, betikler) temizlenir; metin korunur.
 */

const IZINLI = new Set(['B', 'I', 'U', 'SUP', 'SUB', 'BR', 'DIV', 'P', 'UL', 'OL', 'LI', 'SPAN'])
const ESLE = { STRONG: 'B', EM: 'I', INS: 'U', H1: 'DIV', H2: 'DIV', H3: 'DIV', H4: 'DIV', H5: 'DIV', H6: 'DIV', BLOCKQUOTE: 'DIV', PRE: 'DIV', TR: 'DIV', TABLE: 'DIV', TBODY: 'DIV', THEAD: 'DIV' }
const ATLA = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'META', 'LINK', 'TITLE', 'HEAD', 'OBJECT', 'IFRAME', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'NOSCRIPT', 'XML'])

export function kacis(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** HTML'yi izinli alt kümeye indirger (tarayıcıda). */
export function temizle(html) {
  if (!html) return ''
  if (typeof DOMParser === 'undefined') return kacis(duzMetin(html))
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const cikti = document.createElement('div')
  const yurut = (kaynak, hedef) => {
    for (const d of Array.from(kaynak.childNodes)) {
      if (d.nodeType === 3) { hedef.appendChild(document.createTextNode(d.nodeValue.replace(/ /g, ' '))); continue }
      if (d.nodeType !== 1) continue
      let ad = d.tagName.toUpperCase()
      if (ATLA.has(ad)) continue
      // Word: <span style="font-weight:bold"> gibi biçimleri koru
      const stil = (d.getAttribute && d.getAttribute('style')) || ''
      if (ESLE[ad]) ad = ESLE[ad]
      if (ad === 'SPAN' && d.classList && d.classList.contains('bosluk')) {
        const s = document.createElement('span'); s.className = 'bosluk'; s.textContent = d.textContent
        hedef.appendChild(s); continue
      }
      let kap = hedef
      if (IZINLI.has(ad) && ad !== 'SPAN') {
        kap = document.createElement(ad.toLowerCase())
        hedef.appendChild(kap)
      } else if (ad === 'TD' || ad === 'TH') {
        yurut(d, hedef); hedef.appendChild(document.createTextNode(' ')); continue
      }
      // stil ile verilen kalın / italik / altı çizili
      let ic = kap
      if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(stil) && ad !== 'B') { const b = document.createElement('b'); ic.appendChild(b); ic = b }
      if (/font-style\s*:\s*italic/i.test(stil) && ad !== 'I') { const i = document.createElement('i'); ic.appendChild(i); ic = i }
      if (/text-decoration[^;]*underline/i.test(stil) && ad !== 'U') { const u = document.createElement('u'); ic.appendChild(u); ic = u }
      if (/vertical-align\s*:\s*super/i.test(stil) && ad !== 'SUP') { const u = document.createElement('sup'); ic.appendChild(u); ic = u }
      if (/vertical-align\s*:\s*sub/i.test(stil) && ad !== 'SUB') { const u = document.createElement('sub'); ic.appendChild(u); ic = u }
      yurut(d, ic)
    }
  }
  yurut(doc.body, cikti)
  // boş biçim etiketlerini at
  for (const e of Array.from(cikti.querySelectorAll('b,i,u,sup,sub'))) if (!e.textContent && !e.querySelector('br')) e.remove()
  return bosMu(cikti.innerHTML) ? '' : cikti.innerHTML
}

/** Etiketsiz düz metin (Node'da da çalışır) */
export function duzMetin(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(div|p|li)>/gi, '\n')
    .replace(/<span class="bosluk"[^>]*>([\s\S]*?)<\/span>/g, '_____')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** "<br>", "<div><br></div>" gibi görünmez içerik boş sayılır */
export function bosMu(html) {
  return !String(html || '').replace(/<br\s*\/?>/gi, '').replace(/<\/?(div|p|b|i|u|sup|sub|span)[^>]*>/gi, '').replace(/&nbsp;|\s/g, '')
}

/** Tek satırlık kısaltma (ana hat listesinde) */
export function ozet(html, uzunluk = 70) {
  const t = duzMetin(html).replace(/\s+/g, ' ').trim()
  return t.length > uzunluk ? t.slice(0, uzunluk - 1) + '…' : t
}

/**
 * Metin düğümlerindeki [köşeli parantez] ifadelerini boşluğa çevirir (tarayıcıda, bir DOM öğesi üzerinde).
 * Dönüş: değişiklik yapıldı mı
 */
export function koseliParantezleriBoslugaCevir(kok) {
  const yuruyucu = document.createTreeWalker(kok, NodeFilter.SHOW_TEXT)
  const dugumler = []
  while (yuruyucu.nextNode()) {
    const d = yuruyucu.currentNode
    if (d.parentElement && d.parentElement.closest('.bosluk')) continue
    if (/\[[^\[\]]+\]/.test(d.nodeValue)) dugumler.push(d)
  }
  for (const d of dugumler) {
    const parca = d.nodeValue.split(/(\[[^\[\]]+\])/)
    const frag = document.createDocumentFragment()
    for (const p of parca) {
      const m = /^\[([^\[\]]+)\]$/.exec(p)
      if (m && m[1].trim()) { const s = document.createElement('span'); s.className = 'bosluk'; s.textContent = m[1].trim(); frag.appendChild(s) }
      else if (p) frag.appendChild(document.createTextNode(p))
    }
    d.parentNode.replaceChild(frag, d)
  }
  return dugumler.length > 0
}

export const SEMBOLLER = [
  ['Matematik', ['×', '÷', '±', '∓', '−', '·', '√', '∛', '∞', '≈', '≠', '≡', '≤', '≥', '<', '>', '°', '′', '″', '%', '‰', 'π', '∑', '∏', '∫', '∆', '∇', '∂', '∠', '⊥', '∥', '△', '□', '○', '∈', '∉', '⊂', '⊆', '∪', '∩', '∅', 'ℕ', 'ℤ', 'ℚ', 'ℝ', '⇒', '⇔', '→', '←', '↔', '∀', '∃', '¬', '∧', '∨', '½', '⅓', '¼', '¾', '²', '³']],
  ['Yunan', ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'ρ', 'σ', 'τ', 'φ', 'ω', 'Δ', 'Σ', 'Ω', 'Φ', 'Θ']],
  ['Diğer', ['•', '…', '–', '—', '“', '”', '‘', '’', '«', '»', '✓', '✗', '★', '☐', 'I', 'II', 'III', 'IV', 'V', '€', '₺', '$', '§', '©']],
]
