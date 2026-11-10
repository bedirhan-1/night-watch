# Bikort Operasyon Panosu

Geliştirme ve operasyon kayıtlarını tek yerden takip eden Next.js uygulaması. Vercel, GitHub Actions, App Store Connect ve AWS IAM'i her sabah yoklar, bulduğu sorunları kayıt olarak açar, sorun geçince kapatır ve özetle hatırlatmaları e-postayla gönderir.

## Kurulum (Vercel)

1. Bu depoyu Vercel'de yeni proje olarak içe aktar.
2. Proje > Storage > **Neon** ekle. `DATABASE_URL` otomatik tanımlanır. Tablolar ilk açılışta kendiliğinden oluşur.
3. Proje > Settings > Environment Variables altında `.env.example` içindeki değişkenleri gir. En az: `APP_PASSWORD`, `CRON_SECRET`, `RESEND_API_KEY`, `NOTIFY_EMAIL`.
4. Yeniden deploy et, siteyi aç, `APP_PASSWORD` ile giriş yap.
5. Ayarlar sekmesinde "Şimdi kontrol et" ve "Özet mailini şimdi gönder" ile bağlantıları dene.

## Token'lar

| Servis | Değişkenler | Nereden alınır | Gereken yetki |
| --- | --- | --- | --- |
| Vercel | `VERCEL_TOKEN`, `VERCEL_TEAM_ID` | Vercel > Account Settings > Tokens | Deploy listesini okuma |
| GitHub | `GITHUB_TOKEN`, `GITHUB_REPOS` | GitHub > Settings > Developer settings > Fine-grained tokens | Actions: read, Metadata: read |
| App Store | `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` | App Store Connect > Users and Access > Integrations > App Store Connect API | Developer rolü yeterli |
| AWS | `BIKORT_AWS_ACCESS_KEY_ID`, `BIKORT_AWS_SECRET_ACCESS_KEY` | Yeni bir IAM kullanıcısı | `IAMReadOnlyAccess` |
| Resend | `RESEND_API_KEY`, `MAIL_FROM` | resend.com > API Keys | Mail gönderme |

Token tanımlanmayan servis atlanır; Ayarlar sekmesinde "Bağlı değil" görünür.

`MAIL_FROM` boşsa `onboarding@resend.dev` kullanılır; Resend bu adresten yalnızca kendi hesap e-postana gönderim yapar. Başka bir adrese göndermek için Resend'de alan adı doğrula.

## Zamanlama

`vercel.json` içindeki cron her gün 05:00 UTC'de (İstanbul 08:00) `/api/cron/daily` adresini çağırır. Vercel Hobby planında cron günde en fazla bir kez çalışır ve saat içinde gecikebilir; daha sık kontrol için Pro plan gerekir ya da Ayarlar'daki "Şimdi kontrol et" kullanılır.

Dikkat gerektiren bir şey yoksa mail gönderilmez. Pazartesi günleri geçen haftanın özeti eklenir.

## Otomatik kayıtlar nasıl çalışır

- Vercel: her proje, hedef ve dal için en son biten deploy hatalıysa kayıt açılır; sonraki deploy başarılı olunca kapanır.
- GitHub Actions: her deponun varsayılan dalında her iş akışının son çalışması başarısızsa kayıt açılır; sonraki başarılı çalışmada kapanır.
- App Store: işlenemeyen TestFlight derlemesi, 7 gün içinde süresi dolacak derleme, reddedilen ya da incelemede bekleyen sürüm.
- AWS: kök hesapta erişim anahtarı ya da kapalı MFA, 90 günden eski erişim anahtarı, MFA'sız konsol kullanıcısı.

Elle açılan kayıtlara otomatik kontroller dokunmaz. Elle kapattığın otomatik kayıt aynı olay için yeniden açılmaz.

## Yerelde çalıştırma

```
npm install
cp .env.example .env.local   # değerleri doldur
npm run dev
```
