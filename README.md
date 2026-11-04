# FootWare ⚽

Futbol oyunları: 5 mod, Kolay / Orta / Zor, TR / EN / DE / FR. Her oyun 7 soru, tek tıkla cevap.
Football quiz games: 5 modes, Easy / Medium / Hard, 7 rounds each, one-click answers.

| Mod | Nasıl oynanır |
|---|---|
| Transfer Yolu | Kulüpleri tek tek aç, futbolcuyu bul |
| Kim Bu? (yeni) | İpuçları adım adım gelir; erken bilene daha çok puan, yanlış şık elenir |
| Ortak Kulüp (yeni) | İki futbolcunun ikisinin de oynadığı kulüp |
| Gizemli Kulüp (yeni) | 2–4 efsane gösterilir, hepsinin oynadığı kulüp hangisi? |
| Transfer Bedeli (yeni) | Gizli transfer üstteki bedelden pahalı mı, ucuz mu? |

Seviyeler: Kolay (tanıdık oyuncular, 50:50 jokeri, 3 yanlış hakkı, puan ×0,7) · Orta (×1) · Zor (uzman oyuncular, joker/ipucu yok, 1 yanlış hakkı, ×1,3).
Derece isimleri maksimum puana oranla verilir, yani her seviyede aynı merdiven.

## Geliştirme / Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # validate data + tests + build
```

## Yayınlama / Deploy (GitHub Pages)

Bir kerelik ayar: GitHub'da repo → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
Sonrasında her `main` push'u `.github/workflows/pages.yml` ile otomatik derlenir ve şurada yayınlanır:
`https://mehmetustattsc.github.io/FootWare/`

## Siteye gömme / Embed (WordPress + Elementor)

Elementor'da **HTML** widget'ı ekle:

```html
<iframe src="https://mehmetustattsc.github.io/FootWare/?lang=de"
        title="FootWare" loading="lazy"
        style="width:100%;max-width:640px;height:900px;border:0;display:block;margin:0 auto"></iframe>
```

`?lang=tr|en|de|fr` açılış dilini, `?level=easy|medium|hard` açılış seviyesini belirler (yoksa kayıtlı seçim → tarayıcı dili → EN).

## Oyuncu ekleme / Adding players

Tüm içerik `src/data/players.json` içindedir; kod değiştirmek gerekmez.

```json
{ "id": "ornek", "difficulty": 3, "name": "Ad Soyad", "nat": "GER", "era": "2000–2015",
  "clubs": ["Kulüp 1", "Kulüp 2", "Kulüp 3"],
  "distractors": ["Yanlış 1", "Yanlış 2", "Yanlış 3"],
  "clues": { "tr": ["…"], "en": ["…"], "de": ["…"] } }
```

- `difficulty`: 1 (kolay) … 5 (efsane). Doğru cevap her zaman `name`, 3 yanlış şık `distractors`.
- Her dilde (tr/en/de/fr) aynı sayıda ipucu olmalı.
- Transferler `src/data/transfers.json` içinde (bedel milyon €, ek ödemeler hariç, kaynak: Wikipedia transfer rekorları listesi). Yeni satır eklemek yeterli.
- Ortak Kulüp ve Gizemli Kulüp soruları `players.json` içindeki kulüp listelerinden otomatik üretilir; yeni oyuncu eklemek bu modları da zenginleştirir.
- Kaydetmeden önce: `npm run validate`.
- Yeni kulüplere otomatik renk atanır; özel renk için `src/clubs.js`.

## Puanlama

Soru başı 1500 / 1000 / 600 / 300 (açılan kulüp oranına göre), ipucu başına −100, en az 50.
Maksimum 10.500. Dereceler `src/i18n.js` içinde (9000 / 7000 / 5000 / 3000 / 1000 / 0).

## Notlar

- Dış servis yok (Google Fonts dahil) — KVKK/GDPR dostu; sistem yazı tipi kullanılır.
- Bayraklar emoji yerine 3 harfli kod (Windows bayrak emojisi göstermez).
- Geliştirme ortamında npm kayıt defteri erişilemediği için `package-lock.json` yok ve gerçek `vite build` orada çalıştırılmadı; arayüz Bun paketleyici + Playwright ile uçtan uca test edildi. İlk `npm install` lock dosyasını üretir, onu commit'le.
