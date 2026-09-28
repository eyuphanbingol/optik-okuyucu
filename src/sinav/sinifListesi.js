/*
 * Sınıf listesi (e-Okul, üniversite öğrenci bilgi sistemi ya da herhangi bir Excel / CSV listesi) ve
 * öğrencinin adının / numarasının optik forma kodlanması.
 *
 * Optik formda: ad 13 sütun, soyad 13 sütun (29 Türkçe harf), öğrenci numarası 9 hane.
 * Formda olmayan harfler en yakın Türkçe harfle yazılır (W→V, Q→K, X→KS, Â→A …) ve öğretmene gösterilir.
 * Formdan uzun ad kısaltılır, 9 haneden uzun numara kodlanmaz (uydurma numara basılmaz) — hepsi uyarı olarak listelenir.
 */
// optik formun ölçüleri (src/omr/geometri.json ile aynı olduğu test/sinav.test.js'te denetlenir)
export const AD_SUTUN = 13
export const SOYAD_SUTUN = 13
export const NO_HANE = 9
export const FORM_HARFLERI = 'ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'

const DONUSUM = { 'Â': 'A', 'Á': 'A', 'À': 'A', 'Ä': 'A', 'Ã': 'A', 'Å': 'A', 'Î': 'İ', 'Í': 'İ', 'Ì': 'İ', 'Ï': 'İ', 'Û': 'U', 'Ú': 'U', 'Ù': 'U',
  'Ê': 'E', 'É': 'E', 'È': 'E', 'Ë': 'E', 'Ô': 'O', 'Ó': 'O', 'Ò': 'O', 'Õ': 'O', 'Ñ': 'N', 'W': 'V', 'Q': 'K', 'X': 'KS', 'ß': 'SS', 'Æ': 'AE', 'Œ': 'OE' }

export const buyukHarf = s => String(s ?? '').toLocaleUpperCase('tr-TR')

/**
 * Ad (ya da soyad) -> optik form kodu.
 * dönüş: { kod: [harf indeksi | null (boş sütun)], yazilan: 'AYŞE NUR', uyarilar: [...] }
 */
export function adKodla(metin, sutun = AD_SUTUN) {
  const uyarilar = []
  let m = buyukHarf(metin).replace(/[-_.,/]+/g, ' ').replace(/['’`"]/g, '').replace(/\s+/g, ' ').trim()
  let cikti = ''
  const degisen = new Set()
  for (const ch of m) {
    if (ch === ' ' || FORM_HARFLERI.includes(ch)) { cikti += ch; continue }
    if (DONUSUM[ch]) { cikti += DONUSUM[ch]; degisen.add(`${ch}→${DONUSUM[ch]}`); continue }
    degisen.add(`${ch} yazılmadı`)
  }
  cikti = cikti.replace(/\s+/g, ' ').trim()
  if (degisen.size) uyarilar.push(`formda olmayan harf: ${[...degisen].join(', ')}`)
  if (cikti.length > sutun) { uyarilar.push(`${sutun} harften uzun, "${cikti.slice(0, sutun).trim()}" kodlanır`); cikti = cikti.slice(0, sutun) }
  const kod = [...cikti].map(ch => (ch === ' ' ? null : FORM_HARFLERI.indexOf(ch)))
  return { kod, yazilan: cikti.trim(), uyarilar }
}

/** Öğrenci numarası -> haneler. 9 haneden uzunsa kodlanmaz. dönüş: { haneler: [0-9] | null, yazilan, uyari } */
export function noKodla(no) {
  const s = String(no ?? '').replace(/\s+/g, '')
  if (!s) return { haneler: null, yazilan: '', uyari: null }
  if (!/^\d+$/.test(s)) return { haneler: null, yazilan: '', uyari: `numara yalnızca rakam olmalı ("${s}")` }
  if (s.length > NO_HANE) return { haneler: null, yazilan: '', uyari: `numara ${s.length} haneli; formda ${NO_HANE} hane var, numara kodlanmadı` }
  return { haneler: [...s].map(Number), yazilan: s, uyari: null }
}

/** Öğrencinin forma kodlanacak hali: { ad, soyad, no (yazılanlar), kodlar, uyarilar } */
export function ogrenciKodu(o) {
  const a = adKodla(o.ad, AD_SUTUN), s = adKodla(o.soyad, SOYAD_SUTUN), n = noKodla(o.no)
  const uyarilar = [...a.uyarilar.map(u => `ad: ${u}`), ...s.uyarilar.map(u => `soyad: ${u}`), ...(n.uyari ? [n.uyari] : [])]
  return { ad: a.yazilan, soyad: s.yazilan, no: n.yazilan, adKod: a.kod, soyadKod: s.kod, noHane: n.haneler, uyarilar }
}

// ------------------------------------------------------------------ tablo çözümleme
const ascii = s => String(s ?? '').toLocaleLowerCase('tr-TR')
  .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

const BASLIK = {
  no: /^(ogrenci |ogr |okul )?(no|numara|numarasi|numarası)$|^ogrenci numarasi$|^okul numarasi$|^student (no|id|number)$|^id$/,
  adSoyad: /^(adi|ad|isim|ismi)( ve)? (soyadi|soyad|soyisim|soyismi)$|^ogrenci(nin)? adi soyadi$|^name surname$|^full name$|^ogrenci$/,
  ad: /^(adi|ad|isim|ismi|ogrenci adi|ogrencinin adi|name|first name)$/,
  soyad: /^(soyadi|soyad|soy adi|soyisim|soyismi|ogrenci soyadi|surname|last name)$/,
  sinif: /^(sinif|sinifi|sube|subesi|sinif sube|sinifi subesi|sinif subesi)$/,
}

/** Yapıştırılan metin ya da CSV -> satırlar (hücre dizileri) */
export function metniTabloyaCevir(metin) {
  const satirlar = String(metin ?? '').replace(/\r\n?/g, '\n').split('\n').filter(s => s.trim())
  if (!satirlar.length) return []
  const ornek = satirlar.slice(0, 10).join('\n')
  const ayrac = ornek.includes('\t') ? '\t' : (ornek.split(';').length > ornek.split(',').length ? ';' : ',')
  return satirlar.map(s => {
    const hucre = []
    let cur = '', tirnak = false
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (ch === '"') { if (tirnak && s[i + 1] === '"') { cur += '"'; i++ } else tirnak = !tirnak }
      else if (ch === ayrac && !tirnak) { hucre.push(cur); cur = '' }
      else cur += ch
    }
    hucre.push(cur)
    return hucre.map(h => h.trim())
  })
}

/**
 * Satırlar -> öğrenciler. Başlık satırı ("Öğrenci No", "Adı", "Soyadı", "Adı Soyadı", "Sınıfı" …) aranır;
 * yoksa sütunlar içeriğinden tahmin edilir (rakamlı sütun numara, yazılı sütunlar ad / soyad).
 * dönüş: { ogrenciler: [{ no, ad, soyad, sinif }], sutunlar: { no, ad, soyad, adSoyad, sinif }, baslikSatiri, uyarilar }
 */
export function tablodanOgrenciler(satirlar) {
  const uyarilar = []
  const temiz = satirlar.map(r => r.map(h => String(h ?? '').trim()))
  let bs = -1, sutunlar = {}
  for (let i = 0; i < Math.min(20, temiz.length); i++) {
    const s = {}
    temiz[i].forEach((h, j) => {
      const a = ascii(h)
      for (const [k, re] of Object.entries(BASLIK)) if (s[k] === undefined && re.test(a)) { s[k] = j; break }
    })
    if ((s.ad !== undefined && s.soyad !== undefined) || s.adSoyad !== undefined || (s.no !== undefined && (s.ad !== undefined || s.soyad !== undefined))) { bs = i; sutunlar = s; break }
  }
  let veri = bs >= 0 ? temiz.slice(bs + 1) : temiz
  if (bs < 0) {
    // başlıksız: sütun türlerini içerikten tahmin et
    const n = Math.max(0, ...veri.map(r => r.length))
    const rakam = [], yazi = []
    for (let j = 0; j < n; j++) {
      const d = veri.map(r => r[j] || '').filter(Boolean)
      if (!d.length) continue
      const rakamli = d.filter(x => /^\d+$/.test(x.replace(/\s/g, ''))).length / d.length
      const sirali = d.every((x, i) => x === String(i + 1))           // 1, 2, 3 … sıra numarası
      if (rakamli > 0.8 && !sirali) rakam.push(j)
      else if (rakamli < 0.2) yazi.push(j)
    }
    if (rakam.length) sutunlar.no = rakam[0]
    if (yazi.length >= 2) { sutunlar.ad = yazi[0]; sutunlar.soyad = yazi[1] } else if (yazi.length === 1) sutunlar.adSoyad = yazi[0]
    if (sutunlar.ad === undefined && sutunlar.adSoyad === undefined) return { ogrenciler: [], sutunlar, baslikSatiri: -1, uyarilar: ['Listede ad soyad sütunu bulunamadı.'] }
    uyarilar.push('Başlık satırı bulunamadı; sütunlar içeriğe göre tahmin edildi. Önizlemeyi kontrol edin.')
  }
  const ogrenciler = []
  for (const r of veri) {
    let ad = '', soyad = ''
    if (sutunlar.ad !== undefined || sutunlar.soyad !== undefined) {
      ad = r[sutunlar.ad] || ''; soyad = r[sutunlar.soyad] || ''
    } else if (sutunlar.adSoyad !== undefined) {
      const p = (r[sutunlar.adSoyad] || '').split(/\s+/).filter(Boolean)
      soyad = p.length > 1 ? p.pop() : ''
      ad = p.join(' ')
    }
    ad = buyukHarf(ad).replace(/\s+/g, ' ').trim(); soyad = buyukHarf(soyad).replace(/\s+/g, ' ').trim()
    if (!ad && !soyad) continue
    const no = sutunlar.no !== undefined ? String(r[sutunlar.no] || '').replace(/\s+/g, '').replace(/\.0+$/, '') : ''
    const sinif = sutunlar.sinif !== undefined ? (r[sutunlar.sinif] || '').trim() : ''
    ogrenciler.push({ no, ad, soyad, sinif })
  }
  if (!ogrenciler.length) uyarilar.push('Listede öğrenci bulunamadı.')
  const nolar = ogrenciler.map(o => o.no).filter(Boolean)
  const tekrar = nolar.filter((n, i) => nolar.indexOf(n) !== i)
  if (tekrar.length) uyarilar.push(`Aynı numara birden fazla öğrencide: ${[...new Set(tekrar)].slice(0, 5).join(', ')}`)
  return { ogrenciler, sutunlar, baslikSatiri: bs, uyarilar }
}

/** Excel (.xlsx) dosyası -> satırlar (ilk dolu sayfa). exceljs yalnızca gerektiğinde yüklenir. */
export async function exceldenSatirlar(dosya) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  try { await wb.xlsx.load(await dosya.arrayBuffer()) } catch {
    throw new Error('Dosya okunamadı. Eski .xls dosyasıysa Excel\'de "Farklı kaydet → Excel Çalışma Kitabı (.xlsx)" yapın ya da sütunları kopyalayıp yapıştırın.')
  }
  for (const ws of wb.worksheets) {
    const satirlar = []
    ws.eachRow({ includeEmpty: false }, row => {
      const r = []
      row.eachCell({ includeEmpty: true }, (c, j) => { r[j - 1] = (c.text ?? '').toString() })
      satirlar.push(Array.from(r, h => h ?? ''))
    })
    if (satirlar.length) return satirlar
  }
  return []
}

/** Dosya (xlsx, csv, txt) -> satırlar */
export async function dosyadanSatirlar(dosya) {
  const ad = (dosya.name || '').toLowerCase()
  if (ad.endsWith('.xlsx') || ad.endsWith('.xlsm') || /spreadsheetml/.test(dosya.type || '')) return exceldenSatirlar(dosya)
  if (ad.endsWith('.xls')) throw new Error('Eski .xls biçimi okunamıyor. Excel\'de "Farklı kaydet → Excel Çalışma Kitabı (.xlsx)" yapın ya da sütunları kopyalayıp yapıştırın.')
  const buf = await dosya.arrayBuffer()
  let metin = new TextDecoder('utf-8').decode(buf)
  if (metin.includes('�')) metin = new TextDecoder('windows-1254').decode(buf)   // Türkçe Windows CSV
  return metniTabloyaCevir(metin.replace(/^﻿/, ''))
}
