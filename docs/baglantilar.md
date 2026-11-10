# Servisleri bağlama

Her servis, projenin **Ayarlar** sekmesindeki "Bağla" düğmesinden bağlanır. Aynı adımlar uygulamada o bölümün içinde de gösterilir. Bilgileri kaydettikten sonra sağ üstteki oynat düğmesiyle ("Şimdi kontrol et") hemen deneyebilirsin; sonuç Ayarlar'da servisin satırında yazar.

Token'lar veritabanında şifreli saklanır ve kaydedildikten sonra ekranda bir daha gösterilmez. Her servis için yalnızca okuma yetkisi olan ayrı bir token oluştur.

## Vercel derlemeleri

**Neye bakar:** Her Vercel projesinde, her dal için en son biten deploy başarısızsa kayıt açar; sonraki deploy başarılı olunca kaydı kapatır.

1. Vercel’de hesap token’ları sayfasını aç ve “Create” ile yeni bir token oluştur. Ad olarak “Night Watch” yaz, kapsam (Scope) olarak projelerinin bulunduğu takımı seç. [Account Tokens sayfası](https://vercel.com/account/tokens)
2. Token yalnızca bir kez gösterilir. Kopyalayıp aşağıdaki “Token” alanına yapıştır.
3. Projelerin bir takımın altındaysa (Hobby hesaplar da bir takımdır) Takım ID gir: takımın Settings > General sayfasındaki “Team ID” değeri. [Takım ID’yi bulma](https://vercel.com/docs/accounts#find-your-team-id)
4. “Vercel proje adları” alanına yalnızca bu projeye ait Vercel projelerini virgülle yaz (örn. bikort-web, bikort-admin). Boş bırakırsan token’ın gördüğü tüm projeler izlenir.

Daha fazlası: [Vercel: access token belgeleri](https://vercel.com/docs/accounts/access-tokens)

## GitHub Actions

**Neye bakar:** Yazdığın her deponun varsayılan dalında, her iş akışının (workflow) son çalışması başarısızsa kayıt açar; sonraki başarılı çalışmada kapatır.

1. GitHub’da yeni bir fine-grained token oluştur. [Yeni token sayfası](https://github.com/settings/personal-access-tokens/new)
2. “Resource owner” olarak depoların sahibini seç (kendin ya da organizasyon). “Repository access” altında “Only select repositories” ile izlenecek depoları işaretle.
3. “Permissions” > “Repository permissions” altında Actions için “Read-only” seç. Metadata izni kendiliğinden eklenir; başka izin gerekmez.
4. “Generate token”a bas, token’ı kopyalayıp aşağıdaki “Token” alanına yapıştır.
5. “Depolar” alanına izlenecek depoları sahip/depo biçiminde, virgülle yaz (örn. bikort/web, bikort/mobile). Bir sahibin token’ın eriştiği tüm depoları için sahip/* yazabilirsin (örn. bikort/*).
6. Bir fine-grained token yalnızca tek bir sahibin depolarına erişir. Depolar bir organizasyondaysa 2. adımda “Resource owner” olarak o organizasyonu seçmelisin; kişisel hesabınla açılmış token organizasyon depolarını göremez ve “bulunamadı” hatası verir.
7. Organizasyon listede çıkmıyorsa ya da token “pending” kalıyorsa, organizasyonun Settings > Personal access tokens sayfasından fine-grained token’lara izin verilmesi ve isteğin onaylanması gerekir.

Daha fazlası: [GitHub: kişisel erişim token’ları](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

## App Store / TestFlight

**Neye bakar:** İşlenemeyen TestFlight derlemesi, 7 gün içinde süresi dolacak derleme, reddedilen ya da incelemede bekleyen App Store sürümü için kayıt açar.

1. App Store Connect’te Users and Access > Integrations > App Store Connect API sayfasını aç, “Team Keys” altında yeni anahtar oluştur. İlk kez kullanılıyorsa hesap sahibinin (Account Holder) erişimi açması gerekir. [App Store Connect API sayfası](https://appstoreconnect.apple.com/access/integrations/api)
2. Ad olarak “Night Watch” yaz, erişim (Access) olarak “Developer” seç ve oluştur.
3. Listedeki “Key ID” ile sayfanın üstündeki “Issuer ID” değerlerini aşağıdaki alanlara kopyala.
4. “Download API Key” ile .p8 dosyasını indir (yalnızca bir kez indirilebilir). Dosyayı bir metin düzenleyicide aç ve BEGIN/END satırları dahil tüm içeriği “.p8 dosyasının içeriği” alanına yapıştır.
5. Yalnızca tek bir uygulamayı izlemek istersen “App ID” gir: uygulamanın App Information sayfasındaki sayısal “Apple ID”. Boş bırakırsan hesaptaki tüm uygulamalar izlenir.

Daha fazlası: [Apple: API anahtarı oluşturma](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api)

## AWS güvenlik

**Neye bakar:** Kök hesapta erişim anahtarı ya da kapalı MFA, 90 günden eski erişim anahtarı ve MFA’sız konsol kullanıcısı için kayıt açar. Saldırı tespiti ya da fatura takibi yapmaz.

1. AWS konsolunda IAM > Users sayfasında “Create user” ile yeni bir kullanıcı aç (örn. Nightwatch). Konsol erişimi verme. [IAM kullanıcıları](https://console.aws.amazon.com/iam/home#/users)
2. İzin adımında “Attach policies directly” seç ve yalnızca IAMReadOnlyAccess politikasını ekle.
3. Kullanıcının sayfasında “Create access key”e bas, kullanım amacı olarak “Application running outside AWS” seç.
4. Çıkan “Access key” ve “Secret access key” değerlerini aşağıdaki alanlara yapıştır. Secret yalnızca o ekranda bir kez gösterilir.

Daha fazlası: [AWS: erişim anahtarlarını yönetme](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html)

## Sorun giderme

- **Satırda "Hata" yazıyor:** Altındaki mesaj servisin döndürdüğü hatadır. 401 ya da 403 çoğunlukla yanlış, süresi dolmuş ya da yetkisi eksik token demektir.
- **"0 açık bulgu" yazıyor ama sorun olduğunu biliyorsun:** Vercel'de Takım ID ve proje adlarını, GitHub'da depo adlarının yazımını kontrol et.
- **Kaydederken "ENCRYPTION_KEY tanımlı değil" hatası:** Uygulamayı kuran kişinin Vercel'de bu ortam değişkenini tanımlaması gerekir (bkz. README).
