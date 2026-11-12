# Night Watch

Birden çok projenin geliştirme ve operasyon kayıtlarını tek yerden takip eden Next.js uygulaması. Her proje için Vercel, GitHub Actions, App Store Connect ve AWS IAM'i her sabah yoklar, bulduğu sorunları kayıt olarak açar, sorun geçince kapatır ve özetle hatırlatmaları e-postayla gönderir.

## Nasıl çalışır

1. E-posta adresini yazarsın, gelen bağlantıyla giriş yaparsın (şifre yok; ilk girişte hesap açılır).
2. Proje listesinden bir proje seçersin ya da yenisini eklersin.
3. Projenin panosu açılır: Kanban, Liste, Zaman çizelgesi, Haftalık özet, Kararlar, Hatırlatmalar, Ayarlar.
4. Ayarlar sekmesinde o projenin servis token'larını, bildirim adresini ve üyelerini girersin.

## Kurulum (Vercel)

1. Bu depoyu Vercel'de yeni proje olarak içe aktar.
2. Proje > Storage > **Neon** ekle. `DATABASE_URL` otomatik tanımlanır. Tablolar ilk açılışta kendiliğinden oluşur.
3. Proje > Settings > Environment Variables altında `.env.example` içindeki zorunlu değişkenleri gir: `ENCRYPTION_KEY`, `CRON_SECRET`, `RESEND_API_KEY`.
4. Yeniden deploy et, siteyi aç, e-posta adresinle giriş bağlantısı iste.
5. İlk projeni ekle, Ayarlar sekmesinden servisleri bağla, "Şimdi kontrol et" ile dene.

Resend'de alan adı doğrulanmadıysa mailler yalnızca Resend hesabının kendi e-postasına gider. Herkesin giriş yapabilmesi için Resend'de alan adı doğrula ve `MAIL_FROM` tanımla.

## Hesaplar ve yetkiler

Kayıt herkese açıktır: giriş ekranına adresini yazan herkese bağlantı gider ve ilk girişte hesabı oluşur. Herkes yalnızca kendi projelerini görür.

- **Sahip** (projeyi açan kişi): ayarları, servis token'larını ve üyeleri yönetir, projeyi siler.
- **Üye** (projenin Ayarlar > Üyeler alanındaki adresler): o projeyi görür, kayıt ekleyip düzenler; token'ları ve ayarları göremez.

Üye eklenince o adrese davet maili gider. Bir kayıt başka bir üyeye atandığında o kişiye bildirim maili gönderilir.

Giriş bağlantıları sınırlıdır: adres başına dakikada 1 ve saatte 5, tüm uygulama için günde `DAILY_LOGIN_MAILS` (varsayılan 80). Bu sınır Resend kotasını ve gönderen itibarını korur.

## Servis token'ları

Adım adım kurulum ve gidilecek sayfaların bağlantıları: [docs/baglantilar.md](docs/baglantilar.md). Aynı rehber uygulamada Ayarlar > Bağla bölümünde de görünür.

Her projenin Ayarlar sekmesinden girilir, veritabanında AES-256-GCM ile şifreli saklanır ve kaydedildikten sonra tarayıcıya bir daha gönderilmez.

| Servis | Alanlar | Nereden alınır | Gereken yetki |
| --- | --- | --- | --- |
| Vercel | Token, takım ID, proje adları | Vercel > Account Settings > Tokens | Deploy listesini okuma |
| GitHub | Token, depolar | GitHub > Settings > Developer settings > Fine-grained tokens | Actions: read, Metadata: read |
| App Store | Key ID, Issuer ID, .p8 içeriği, App ID | App Store Connect > Users and Access > Integrations | Developer rolü yeterli |
| AWS | Access key ID, secret access key | Yeni bir IAM kullanıcısı | `IAMReadOnlyAccess` |

Vercel token'ı hesaptaki tüm projeleri görür; "Vercel proje adları" alanına yalnızca bu projeye ait olanları yaz.

## Kendi backend'ini bağlama

Backend'inden hata gönderme, adres sağlık kontrolü, anında mail ve günde birden sık kontrol için zamanlayıcı kurulumu: [docs/backend.md](docs/backend.md).

## Zamanlama

`vercel.json` içindeki cron her gün 05:00 UTC'de (İstanbul 08:00) `/api/cron/daily` adresini çağırır; tüm projeler sırayla yoklanır ve her projenin bildirim adresine ayrı özet gider. Vercel Hobby planında cron günde en fazla bir kez çalışır ve saat içinde gecikebilir; daha sık kontrol için Pro plan gerekir ya da Ayarlar'daki "Şimdi kontrol et" kullanılır.

Dikkat gerektiren bir şey yoksa mail gönderilmez. Pazartesi günleri geçen haftanın özeti eklenir.

## Otomatik kayıtlar

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

Oturum çerezi yalnızca HTTPS üzerinden gönderilir; yerelde giriş için `next dev --experimental-https` kullan.
