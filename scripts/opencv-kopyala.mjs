// OpenCV.js'i ayrı bir statik dosya olarak public/opencv/ altına kopyalar (derlemeden önce otomatik çalışır).
// Ayrı dosya: tarayıcı önbelleğinde uzun süre kalır, iş parçacığına importScripts ile yüklenir.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const kok = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const paket = path.join(kok, 'node_modules', '@techstark', 'opencv-js')
const surum = JSON.parse(fs.readFileSync(path.join(paket, 'package.json'), 'utf8')).version
const kaynak = path.join(paket, 'dist', 'opencv.js')
const hedefKlasor = path.join(kok, 'public', 'opencv')
const hedefAd = `opencv-${surum}.js`
fs.mkdirSync(hedefKlasor, { recursive: true })
for (const f of fs.readdirSync(hedefKlasor)) if (f !== hedefAd) fs.rmSync(path.join(hedefKlasor, f))
fs.copyFileSync(kaynak, path.join(hedefKlasor, hedefAd))
fs.writeFileSync(path.join(kok, 'src', 'omr', 'opencv-surum.json'), JSON.stringify({ dosya: `/opencv/${hedefAd}`, boyut: fs.statSync(kaynak).size }))
console.log(`OpenCV kopyalandı: public/opencv/${hedefAd} (${(fs.statSync(kaynak).size / 1e6).toFixed(1)} MB)`)
