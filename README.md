# FootWare ⚽

Kariyer yolundan futbolcuyu bul — 7 soru, artan zorluk, TR / EN / DE.
Career-path football quiz: 7 rounds, rising difficulty, multiple choice with one click.

## Geliştirme / Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # validate data + tests + build
```

## Yayınlama / Deploy (Vercel)

1. vercel.com → *Add New Project* → bu repoyu seç. Framework: **Vite** (otomatik algılanır).
2. Her `main` push'u otomatik yayınlanır — içerik güncellemesi = GitHub'da dosya düzenle, commit.

## Siteye gömme / Embed (WordPress + Elementor)

Elementor'da **HTML** widget'ı ekle:

```html
<iframe src="https://SENIN-PROJEN.vercel.app/?lang=de"
        title="FootWare" loading="lazy"
        style="width:100%;max-width:640px;height:900px;border:0;display:block;margin:0 auto"></iframe>
```

`?lang=tr|en|de` açılış dilini belirler (yoksa kayıtlı seçim → tarayıcı dili → EN).

## Oyuncu ekleme / Adding players

Tüm içerik `src/data/players.json` içindedir; kod değiştirmek gerekmez.

```json
{ "id": "ornek", "difficulty": 3, "name": "Ad Soyad", "nat": "GER", "era": "2000–2015",
  "clubs": ["Kulüp 1", "Kulüp 2", "Kulüp 3"],
  "distractors": ["Yanlış 1", "Yanlış 2", "Yanlış 3"],
  "clues": { "tr": ["…"], "en": ["…"], "de": ["…"] } }
```

- `difficulty`: 1 (kolay) … 5 (efsane). Doğru cevap her zaman `name`, 3 yanlış şık `distractors`.
- Her dilde aynı sayıda ipucu olmalı.
- Kaydetmeden önce: `npm run validate`.
- Yeni kulüplere otomatik renk atanır; özel renk için `src/clubs.js`.

## Puanlama

Soru başı 1500 / 1000 / 600 / 300 (açılan kulüp oranına göre), ipucu başına −100, en az 50.
Maksimum 10.500. Dereceler `src/i18n.js` içinde (9000 / 7000 / 5000 / 3000 / 1000 / 0).

## Notlar

- Dış servis yok (Google Fonts dahil) — KVKK/GDPR dostu; sistem yazı tipi kullanılır.
- Bayraklar emoji yerine 3 harfli kod (Windows bayrak emojisi göstermez).
- İlk kurulum ortamında npm kayıt defteri erişilemediği için `package-lock.json` yok ve gerçek `vite build` orada çalıştırılmadı; arayüz Bun paketleyici + Playwright ile uçtan uca test edildi. İlk `npm install` lock dosyasını üretir, onu commit'le.
