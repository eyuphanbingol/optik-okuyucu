/*
 * Excel sonuç dosyasını e-postayla gönderir (Vercel sunucu fonksiyonu).
 *
 * Gerekli ortam değişkenleri (Vercel > Project > Settings > Environment Variables):
 *   SMTP_HOST   örn. smtp.gmail.com
 *   SMTP_PORT   465 (SSL) ya da 587
 *   SMTP_USER   gönderen hesap (örn. okulumuz.optik@gmail.com)
 *   SMTP_PASS   uygulama şifresi (Gmail: Google Hesabı > Güvenlik > Uygulama şifreleri)
 * İsteğe bağlı:
 *   MAIL_FROM            "Optik Okuyucu <okulumuz.optik@gmail.com>"
 *   IZINLI_ALAN_ADLARI   virgülle ayrılmış, örn. "meb.k12.tr,okulum.k12.tr,gmail.com" (boşsa herkese gönderir)
 *
 * Kötüye kullanıma karşı: yalnızca .xlsx eki kabul edilir, konu/metin sabittir, boyut sınırlıdır,
 * aynı IP'den dakikada en fazla 5 gönderim yapılabilir.
 */
import nodemailer from 'nodemailer'

const MAKS_BOYUT = 4 * 1024 * 1024
const son = new Map() // ip -> [zamanlar]

function temizDosyaAdi(ad) {
  const t = String(ad || 'sonuclar.xlsx').replace(/[^\p{L}\p{N}._ -]/gu, '').slice(0, 120)
  return t.toLowerCase().endsWith('.xlsx') ? t : t + '.xlsx'
}

function kacis(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ tamam: false, hata: 'Yalnızca POST' })

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
  const simdi = Date.now()
  const liste = (son.get(ip) || []).filter(t => simdi - t < 60_000)
  if (liste.length >= 5) return res.status(429).json({ tamam: false, hata: 'Çok fazla deneme. Bir dakika sonra tekrar deneyin.' })
  liste.push(simdi); son.set(ip, liste)

  let govde = req.body
  if (typeof govde === 'string') { try { govde = JSON.parse(govde) } catch { govde = null } }
  const { kime, sinavAdi, dosyaAdi, veri, ozet } = govde || {}

  const eposta = String(kime || '').trim()
  if (!/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(eposta) || eposta.length > 254) {
    return res.status(400).json({ tamam: false, hata: 'Geçersiz e-posta adresi' })
  }
  const izinli = (process.env.IZINLI_ALAN_ADLARI || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  if (izinli.length && !izinli.some(a => eposta.toLowerCase().endsWith('@' + a) || eposta.toLowerCase().endsWith('.' + a))) {
    return res.status(403).json({ tamam: false, hata: 'Bu alan adına gönderim izni yok' })
  }
  if (typeof veri !== 'string' || !veri.length) return res.status(400).json({ tamam: false, hata: 'Dosya yok' })
  const icerik = Buffer.from(veri, 'base64')
  if (icerik.length > MAKS_BOYUT) return res.status(413).json({ tamam: false, hata: 'Dosya çok büyük' })
  if (icerik[0] !== 0x50 || icerik[1] !== 0x4b) return res.status(400).json({ tamam: false, hata: 'Geçersiz Excel dosyası' })

  const test = process.env.EPOSTA_TEST === '1'
  if (!test && (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS)) {
    return res.status(500).json({ tamam: false, hata: 'E-posta sunucusu ayarlanmamış (SMTP_HOST / SMTP_USER / SMTP_PASS)' })
  }
  const port = Number(process.env.SMTP_PORT || 465)
  const tasiyici = test
    ? nodemailer.createTransport({ jsonTransport: true })
    : nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })

  const ad = String(sinavAdi || 'Sınav').slice(0, 120)
  const ogr = Number(ozet?.ogrenci) || 0
  const ort = Number(ozet?.ortalama)
  const metin = `${ad} sonuçları ektedir.\n\nÖğrenci sayısı: ${ogr}\n${Number.isFinite(ort) ? `Ortalama puan: ${ort.toLocaleString('tr-TR')}\n` : ''}\nBu e-posta Optik Okuyucu tarafından gönderildi.`
  try {
    const bilgi = await tasiyici.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER || 'optik@example.com',
      to: eposta,
      subject: `${ad} – sınav sonuçları`,
      text: metin,
      html: `<p><b>${kacis(ad)}</b> sonuçları ektedir.</p><p>Öğrenci sayısı: ${ogr}${Number.isFinite(ort) ? `<br>Ortalama puan: ${kacis(ort.toLocaleString('tr-TR'))}` : ''}</p><p style="color:#777">Bu e-posta Optik Okuyucu tarafından gönderildi.</p>`,
      attachments: [{ filename: temizDosyaAdi(dosyaAdi), content: icerik, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }],
    })
    return res.status(200).json({ tamam: true, ...(test ? { test: JSON.parse(bilgi.message) } : {}) })
  } catch (e) {
    return res.status(502).json({ tamam: false, hata: 'E-posta gönderilemedi: ' + (e && e.message ? e.message : 'bilinmeyen hata') })
  }
}
