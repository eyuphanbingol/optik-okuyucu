// Puanlama ve karar mantığı birim testleri:  node test/puan.test.js
import assert from 'node:assert/strict'
import { puanla, okumalariBirlestir, tekrarKontrol, kayitOlustur, sorunlariBul, kitapcikSec, baslikBicim, sayiTR, anahtarTaslagi } from '../src/mantik.js'

let gecen = 0
const t = (ad, f) => { f(); gecen++; console.log('  ✔', ad) }
const c = k => ({ t: 'c', k }), b = { t: 'b' }, x = ks => ({ t: 'x', ks })
const ayar = (o = {}) => ({ soruSayisi: 4, soruPuani: 0, yanlisGoturur: 0, ciftIsaret: 'yanlis', ...o })

t('otomatik puan: 4 soruda 3 doğru = 75', () => {
  const p = puanla({ cevaplar: [c(0), c(1), c(2), c(0)] }, [0, 1, 2, 3], ayar())
  assert.deepEqual([p.d, p.y, p.b, p.puan], [3, 1, 0, 75])
})
t('soru başı puan elle: 3 doğru x 5 = 15', () => {
  assert.equal(puanla({ cevaplar: [c(0), c(1), c(2), b] }, [0, 1, 2, 3], ayar({ soruPuani: 5 })).puan, 15)
})
t('4 yanlış 1 doğru götürür', () => {
  const p = puanla({ cevaplar: [c(1), c(1), c(1), c(1), c(0)] }, [0, 0, 0, 0, 0], ayar({ soruSayisi: 5, yanlisGoturur: 4 }))
  assert.deepEqual([p.d, p.y, p.net, p.puan], [1, 4, 0, 0])
})
t('net eksiye düşerse puan 0', () => {
  const p = puanla({ cevaplar: [c(1), c(1), c(1), c(1)] }, [0, 0, 0, 0], ayar({ yanlisGoturur: 3 }))
  assert.equal(p.puan, 0)
})
t('çift işaret ayara göre yanlış / boş', () => {
  assert.equal(puanla({ cevaplar: [x([0, 1]), b, b, b] }, [0, 0, 0, 0], ayar()).y, 1)
  assert.equal(puanla({ cevaplar: [x([0, 1]), b, b, b] }, [0, 0, 0, 0], ayar({ ciftIsaret: 'bos' })).b, 4)
})
t('100/30 gibi bölünmeyen puanlarda tam doğru = 100', () => {
  const cev = Array.from({ length: 30 }, () => c(2))
  assert.equal(puanla({ cevaplar: cev }, cev.map(() => 2), ayar({ soruSayisi: 30 })).puan, 100)
})
t('Türkçe başlık biçimi', () => {
  assert.equal(baslikBicim('İREM IŞIK'), 'İrem Işık')
  assert.equal(baslikBicim('ŞÜKRÜ ALİ ÇAĞLAR'), 'Şükrü Ali Çağlar')
  assert.equal(sayiTR(87.5), '87,50')
})

const r0 = (o = {}) => ({
  tamam: true, anahtar: 'hayir',
  ad: { metin: 'ALİ', supheli: false, notlar: [] }, soyad: { metin: 'KAYA', supheli: false, notlar: [] },
  no: { metin: '12', supheli: false, notlar: [] }, kitapcik: { harf: 'A', not: '' },
  cevaplar: [{ tur: 'cevap', k: 0, not: '' }, { tur: 'bos', k: null, not: '' }, { tur: 'cevap', k: 2, not: '' }, { tur: 'cevap', k: 3, not: '' }],
  ...o,
})
t('iki okuma aynı -> kabul', () => assert.equal(okumalariBirlestir(r0(), r0()).tamam, true))
t('iki okuma emin ama farklı cevap -> çelişki (tekrar okunur)', () => {
  const r2 = r0(); r2.cevaplar = r2.cevaplar.map((q, i) => (i === 2 ? { tur: 'cevap', k: 1, not: '' } : q))
  const s = okumalariBirlestir(r0(), r2)
  assert.equal(s.tamam, false); assert.deepEqual(s.celiski, ['soru 3'])
})
t('bir okumada emin değil -> emin olmayan hali alınır (öğretmene sorulur)', () => {
  const r2 = r0(); r2.cevaplar = r2.cevaplar.map((q, i) => (i === 1 ? { tur: 'bos', k: null, not: 'silik' } : q))
  const s = okumalariBirlestir(r0(), r2)
  assert.equal(s.tamam, true); assert.equal(s.sonuc.cevaplar[1].not, 'silik')
})
t('iki okumada farklı isim -> çelişki', () => {
  const s = okumalariBirlestir(r0(), r0({ ad: { metin: 'ALI', supheli: false, notlar: [] } }))
  assert.equal(s.tamam, false)
})
t('sorunsuz okumada sorun listesi boş', () => assert.equal(sorunlariBul(r0(), ayar(), { A: [0, 1, 2, 3] }).length, 0))
t('sorunlar: silik soru, anahtar işaretli, anahtarı olmayan kitapçık', () => {
  const r = r0({ anahtar: 'evet', kitapcik: { harf: 'C', not: '' } })
  r.cevaplar[1] = { tur: 'bos', k: null, not: 'silik' }
  const s = sorunlariBul(r, ayar(), { A: [0, 1, 2, 3], B: [1, 1, 1, 1] }).map(x => x.tur).sort()
  assert.deepEqual(s, ['anahtarIsaretli', 'kitapcik', 'soru'])
})
t('kitapçık işaretsiz + tek anahtar -> o anahtar; iki anahtar -> sor', () => {
  const r = r0({ kitapcik: { harf: null, not: '' } })
  assert.equal(kitapcikSec(r, { A: [] }), 'A')
  assert.equal(kitapcikSec(r, { A: [], B: [] }), null)
  assert.equal(sorunlariBul(r, ayar(), { A: [0, 1, 2, 3], B: [0, 1, 2, 3] }).some(s => s.tur === 'kitapcik'), true)
})
t('tekrar kontrolü: aynı kâğıt / aynı numara farklı cevap / farklı öğrenci', () => {
  const a = kayitOlustur(r0(), { kitapcik: 'A' }, ayar())
  const ayni = kayitOlustur(r0(), { kitapcik: 'A' }, ayar())
  assert.equal(tekrarKontrol(ayni, [a], 4).tur, 'ayni')
  const r2 = r0(); r2.cevaplar = [...r2.cevaplar]; r2.cevaplar[0] = { tur: 'cevap', k: 4, not: '' }
  assert.equal(tekrarKontrol(kayitOlustur(r2, { kitapcik: 'A' }, ayar()), [a], 4).tur, 'ayniNo')
  assert.equal(tekrarKontrol(kayitOlustur(r0({ no: { metin: '13', supheli: false, notlar: [] } }), { kitapcik: 'A' }, ayar()), [a], 4), null)
})
t('öğretmen kararı cevabı ezer', () => {
  const k = kayitOlustur(r0(), { kitapcik: 'A', kararlar: { 1: { t: 'c', k: 4 } } }, ayar())
  assert.deepEqual(k.cevaplar[1], { t: 'c', k: 4 })
  assert.equal(k.notlar.length, 0)   // öğretmen onayı artık not olarak saklanmıyor
})
t('anahtar taslağı: eksik ve soru sayısından fazla işaret', () => {
  const r = r0(); r.cevaplar = [...r.cevaplar, { tur: 'cevap', k: 1, not: '' }]
  const a = anahtarTaslagi(r, 4)
  assert.deepEqual(a.eksik, [1]); assert.equal(a.fazla, 5)
})
console.log(`\n${gecen} test geçti`)
