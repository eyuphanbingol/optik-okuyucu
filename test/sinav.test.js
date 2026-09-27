// Sınav hazırlama: model ve grup (karıştırma) birim testleri:  node test/sinav.test.js
import assert from 'node:assert/strict'
import { yeniSinav, yeniOge, numaralar, toplamPuan, puanlariDagit, ogeKopyala, turDegistir, eksikler, gorselKimlikleri } from '../src/sinav/model.js'
import { grupOlustur, tumGruplar, bosluklar } from '../src/sinav/karistir.js'
import { duzMetin, bosMu, ozet } from '../src/sinav/metin.js'
import { optigeAktarilabilir, optikDurumu } from '../src/sinav/optikAktar.js'

let gecen = 0
const t = (ad, f) => { f(); gecen++; console.log('  ✔', ad) }

function testSinavi(n = 12, grup = 4) {
  const s = yeniSinav({ sablon: 'test', soruSayisi: n, sikSayisi: 5, grupSayisi: grup })
  s.ogeler.forEach((o, i) => { o.metin = `Soru ${i + 1}`; o.siklar.forEach((k, j) => { k.metin = `S${i + 1}-${'ABCDE'[j]}` }); o.dogru = o.siklar[i % 5].id })
  return s
}

t('şablonlar: test / yazılı / karma / boş', () => {
  assert.equal(yeniSinav({ sablon: 'test', soruSayisi: 20 }).ogeler.length, 20)
  assert.ok(yeniSinav({ sablon: 'yazili', soruSayisi: 5 }).ogeler.every(o => o.tur === 'klasik'))
  const k = yeniSinav({ sablon: 'karma', soruSayisi: 10 })
  assert.deepEqual([...new Set(k.ogeler.map(o => o.tur))].sort(), ['bolum', 'bosluk', 'coktan', 'dy', 'eslestirme', 'klasik'])
  assert.equal(yeniSinav({ sablon: 'bos' }).ogeler.length, 0)
})
t('yeni sınavda puanlar toplam 100 (tam sayı)', () => {
  for (const n of [1, 3, 7, 12, 30, 40]) {
    const s = yeniSinav({ sablon: 'test', soruSayisi: n })
    assert.equal(toplamPuan(s.ogeler), 100)
    assert.ok(s.ogeler.every(o => Number.isInteger(o.puan)))
  }
})
t('bölümler numarasız, sorular sıralı numaralı', () => {
  const s = yeniSinav({ sablon: 'karma', soruSayisi: 3 })
  const no = numaralar(s.ogeler)
  assert.equal(no.get(s.ogeler[0].id), undefined)
  assert.equal(no.get(s.ogeler[1].id), 1)
  assert.equal([...no.values()].length, s.ogeler.filter(o => o.tur !== 'bolum').length)
})
t('puanları eşit dağıt: bölümler etkilenmez', () => {
  const ogeler = puanlariDagit([yeniOge('bolum'), yeniOge('klasik'), yeniOge('klasik'), yeniOge('klasik')], 100)
  assert.equal(ogeler[0].puan, undefined)
  assert.deepEqual(ogeler.slice(1).map(o => o.puan), [33, 33, 34])
})
t('A grubu yazıldığı sırada; B/C/D farklı ve cevap anahtarı doğru', () => {
  const s = testSinavi(12, 4)
  const g = tumGruplar(s)
  assert.deepEqual(g.map(x => x.harf), ['A', 'B', 'C', 'D'])
  assert.deepEqual(g[0].ogeler.map(o => o.metin), s.ogeler.map(o => o.metin))
  assert.deepEqual(g[0].anahtar.map(a => a.kisa).join(''), 'ABCDEABCDEAB')
  const siralar = g.map(x => x.ogeler.map(o => o.metin).join('|'))
  assert.equal(new Set(siralar).size, 4, 'her grubun soru sırası farklı olmalı')
  for (const grup of g) {
    for (const o of grup.ogeler) {
      // doğru harf, karıştırılmış şıklarda doğru şıkkı göstermeli
      const asil = s.ogeler.find(x => x.id === o.id)
      const dogruMetin = asil.siklar.find(k => k.id === asil.dogru).metin
      assert.equal(o.siklarSirali[o.dogruIndex].metin, dogruMetin)
      assert.equal(o.dogruHarf, 'ABCDE'[o.dogruIndex])
    }
  }
})
t('karıştırma kararlı: aynı tohum aynı grup, farklı tohum farklı grup', () => {
  const s = testSinavi(10, 2)
  const a = JSON.stringify(grupOlustur(s, 1).anahtar)
  assert.equal(JSON.stringify(grupOlustur(s, 1).anahtar), a)
  s.ayar.tohum += 1
  assert.notEqual(JSON.stringify(grupOlustur(s, 1).ogeler.map(o => o.id)), JSON.stringify(grupOlustur({ ...s, ayar: { ...s.ayar, tohum: s.ayar.tohum - 1 } }, 1).ogeler.map(o => o.id)))
})
t('karıştırma kapalıysa B grubu A ile aynı sırada', () => {
  const s = testSinavi(8, 2)
  s.ayar.soruKaristir = false; s.ayar.sikKaristir = false
  assert.deepEqual(grupOlustur(s, 1).anahtar.map(a => a.kisa), grupOlustur(s, 0).anahtar.map(a => a.kisa))
})
t('şıkları sabitlenen soru karışmaz', () => {
  const s = testSinavi(4, 4)
  s.ogeler[2].sikKilit = true
  for (let g = 1; g < 4; g++) {
    const o = grupOlustur(s, g).ogeler.find(x => x.id === s.ogeler[2].id)
    assert.deepEqual(o.siklarSirali.map(k => k.id), s.ogeler[2].siklar.map(k => k.id))
  }
})
t('bölüm başlıkları yerinde kalır, sorular bölüm dışına çıkmaz', () => {
  const s = yeniSinav({ sablon: 'karma', soruSayisi: 6, grupSayisi: 4 })
  for (let g = 0; g < 4; g++) {
    const o = grupOlustur(s, g).ogeler
    const turSirasi = o.map(x => x.tur).join(',')
    assert.equal(turSirasi, s.ogeler.map(x => x.tur).join(','))
  }
})
t('eşleştirme: sağ sütun karışık, anahtar doğru', () => {
  const s = yeniSinav({ sablon: 'bos' })
  const e = yeniOge('eslestirme', { adet: 5 })
  e.ciftler.forEach((c, i) => { c.sol = `Sol${i}`; c.sag = `Sag${i}` })
  e.ekSag = 'Çeldirici1, Çeldirici2'
  s.ogeler = [e]
  for (let g = 0; g < 2; g++) {
    const o = grupOlustur(s, g).ogeler[0]
    assert.equal(o.sagSirali.length, 7)
    assert.ok(o.sagSirali.slice(0, 5).some((x, i) => x.metin !== `Sag${i}`))
    o.eslesme.forEach((j, i) => assert.equal(o.sagSirali[j].metin, `Sag${i}`))
  }
})
t('boşluk doldurma: cevaplar ve kelime havuzu', () => {
  const s = yeniSinav({ sablon: 'bos' })
  const b = yeniOge('bosluk', { adet: 2 })
  b.cumleler[0].metin = 'Türkiye\'nin başkenti <span class="bosluk">Ankara</span>\'dır.'
  b.cumleler[1].metin = '<span class="bosluk">Su</span> <b>100</b> °C\'de <span class="bosluk">kaynar</span>.'
  b.ekKelimeler = 'İstanbul'
  s.ogeler = [b]
  const o = grupOlustur(s, 0).ogeler[0]
  assert.deepEqual(bosluklar(b.cumleler[1].metin), ['Su', 'kaynar'])
  assert.deepEqual([...o.havuzSirali].sort(), ['Ankara', 'İstanbul', 'Su', 'kaynar'].sort())
  assert.equal(grupOlustur(s, 0).anahtar[0].uzun, 'a) Ankara   b) Su / kaynar')
})
t('D/Y cevap anahtarı', () => {
  const s = yeniSinav({ sablon: 'bos' })
  const d = yeniOge('dy', { adet: 3 }); d.maddeler[1].dogru = false
  s.ogeler = [d]
  assert.equal(grupOlustur(s, 0).anahtar[0].kisa, 'DYD')
})
t('çoğaltma yeni kimlik verir, doğru cevap korunur', () => {
  const s = testSinavi(1, 1)
  const k = ogeKopyala(s.ogeler[0])
  assert.notEqual(k.id, s.ogeler[0].id)
  assert.notEqual(k.siklar[0].id, s.ogeler[0].siklar[0].id)
  assert.equal(k.siklar.findIndex(x => x.id === k.dogru), 0)
})
t('tür değiştirme metni ve puanı korur', () => {
  const o = yeniOge('coktan'); o.metin = 'Soru'; o.puan = 7
  const y = turDegistir(o, 'klasik')
  assert.equal(y.metin, 'Soru'); assert.equal(y.puan, 7); assert.equal(y.id, o.id)
})
t('eksik kontrolü: doğru cevap işaretlenmemiş soru', () => {
  const s = yeniSinav({ sablon: 'test', soruSayisi: 2 })
  const e = eksikler(s, duzMetin)
  assert.ok(e.some(x => x.agir && x.no === 1))
})
t('görsel kimlikleri', () => {
  const s = testSinavi(2, 1)
  s.ogeler[0].gorsel = { id: 'g1' }; s.ogeler[1].siklar[0].gorsel = { id: 'g2' }
  assert.deepEqual([...gorselKimlikleri(s)].sort(), ['g1', 'g2'])
})
t('metin yardımcıları', () => {
  assert.equal(duzMetin('a<b>b</b><br>c &amp; d'), 'ab\nc & d')
  assert.ok(bosMu('<div><br></div>'))
  assert.ok(!bosMu('<b>x</b>'))
  assert.equal(ozet('x'.repeat(100), 10).length, 10)
})
t('optiğe aktarım: yalnız çoktan seçmeli, eksiksiz sınav', () => {
  const s = testSinavi(12, 4)
  assert.equal(optigeAktarilabilir(s).tamam, true)
  const d = optikDurumu(s)
  assert.equal(d.ayar.soruSayisi, 12)
  assert.deepEqual(Object.keys(d.anahtarlar), ['A', 'B', 'C', 'D'])
  assert.equal(d.anahtarlar.A.length, 80)
  assert.deepEqual(d.anahtarlar.A.slice(0, 5), [0, 1, 2, 3, 4])
  const g1 = grupOlustur(s, 1)
  assert.deepEqual(d.anahtarlar.B.slice(0, 12), g1.ogeler.map(o => o.dogruIndex))
  const k = yeniSinav({ sablon: 'karma' })
  assert.equal(optigeAktarilabilir(k).tamam, false)
})

console.log(`\n${gecen} test geçti`)
