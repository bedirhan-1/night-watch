// Ayarlar ekranında her servisin "Bağla" bölümünde gösterilen kurulum rehberleri.
// Aynı içerik docs/baglantilar.md dosyasında da durur; birini değiştirince diğerini de güncelle.
// Adım: [metin] ya da [metin, bağlantı etiketi, adres]

export const GUIDES = {
  vercel: {
    checks: 'Her Vercel projesinde, her dal için en son biten deploy başarısızsa kayıt açar; sonraki deploy başarılı olunca kaydı kapatır.',
    steps: [
      ['Vercel’de hesap token’ları sayfasını aç ve “Create” ile yeni bir token oluştur. Ad olarak “Night Watch” yaz, kapsam (Scope) olarak projelerinin bulunduğu takımı seç.', 'Account Tokens sayfası', 'https://vercel.com/account/tokens'],
      ['Token yalnızca bir kez gösterilir. Kopyalayıp aşağıdaki “Token” alanına yapıştır.'],
      ['Projelerin bir takımın altındaysa (Hobby hesaplar da bir takımdır) Takım ID gir: takımın Settings > General sayfasındaki “Team ID” değeri.', 'Takım ID’yi bulma', 'https://vercel.com/docs/accounts#find-your-team-id'],
      ['“Vercel proje adları” alanına yalnızca bu projeye ait Vercel projelerini virgülle yaz (örn. bikort-web, bikort-admin). Boş bırakırsan token’ın gördüğü tüm projeler izlenir.'],
    ],
    docs: ['Vercel: access token belgeleri', 'https://vercel.com/docs/accounts/access-tokens'],
  },
  github: {
    checks: 'Yazdığın her deponun varsayılan dalında, her iş akışının (workflow) son çalışması başarısızsa kayıt açar; sonraki başarılı çalışmada kapatır.',
    steps: [
      ['GitHub’da yeni bir fine-grained token oluştur.', 'Yeni token sayfası', 'https://github.com/settings/personal-access-tokens/new'],
      ['“Resource owner” olarak depoların sahibini seç (kendin ya da organizasyon). “Repository access” altında “Only select repositories” ile izlenecek depoları işaretle.'],
      ['“Permissions” > “Repository permissions” altında Actions için “Read-only” seç. Metadata izni kendiliğinden eklenir; başka izin gerekmez.'],
      ['“Generate token”a bas, token’ı kopyalayıp aşağıdaki “Token” alanına yapıştır.'],
      ['“Depolar” alanına izlenecek depoları sahip/depo biçiminde, virgülle yaz (örn. bikort/web, bikort/mobile). Bir sahibin token’ın eriştiği tüm depoları için sahip/* yazabilirsin (örn. bikort/*).'],
      ['Bir fine-grained token yalnızca tek bir sahibin depolarına erişir. Depolar bir organizasyondaysa 2. adımda “Resource owner” olarak o organizasyonu seçmelisin; kişisel hesabınla açılmış token organizasyon depolarını göremez ve “bulunamadı” hatası verir.'],
      ['Organizasyon listede çıkmıyorsa ya da token “pending” kalıyorsa, organizasyonun Settings > Personal access tokens sayfasından fine-grained token’lara izin verilmesi ve isteğin onaylanması gerekir.'],
    ],
    docs: ['GitHub: kişisel erişim token’ları', 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens'],
  },
  apple: {
    checks: 'İşlenemeyen TestFlight derlemesi, 7 gün içinde süresi dolacak derleme, reddedilen ya da incelemede bekleyen App Store sürümü için kayıt açar.',
    steps: [
      ['App Store Connect’te Users and Access > Integrations > App Store Connect API sayfasını aç, “Team Keys” altında yeni anahtar oluştur. İlk kez kullanılıyorsa hesap sahibinin (Account Holder) erişimi açması gerekir.', 'App Store Connect API sayfası', 'https://appstoreconnect.apple.com/access/integrations/api'],
      ['Ad olarak “Night Watch” yaz, erişim (Access) olarak “Developer” seç ve oluştur.'],
      ['Listedeki “Key ID” ile sayfanın üstündeki “Issuer ID” değerlerini aşağıdaki alanlara kopyala.'],
      ['“Download API Key” ile .p8 dosyasını indir (yalnızca bir kez indirilebilir). Dosyayı bir metin düzenleyicide aç ve BEGIN/END satırları dahil tüm içeriği “.p8 dosyasının içeriği” alanına yapıştır.'],
      ['Yalnızca tek bir uygulamayı izlemek istersen “App ID” gir: uygulamanın App Information sayfasındaki sayısal “Apple ID”. Boş bırakırsan hesaptaki tüm uygulamalar izlenir.'],
    ],
    docs: ['Apple: API anahtarı oluşturma', 'https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api'],
  },
  aws: {
    checks: 'Kök hesapta erişim anahtarı ya da kapalı MFA, 90 günden eski erişim anahtarı ve MFA’sız konsol kullanıcısı için kayıt açar. Saldırı tespiti ya da fatura takibi yapmaz.',
    steps: [
      ['AWS konsolunda IAM > Users sayfasında “Create user” ile yeni bir kullanıcı aç (örn. Nightwatch). Konsol erişimi verme.', 'IAM kullanıcıları', 'https://console.aws.amazon.com/iam/home#/users'],
      ['İzin adımında “Attach policies directly” seç ve yalnızca IAMReadOnlyAccess politikasını ekle.'],
      ['Kullanıcının sayfasında “Create access key”e bas, kullanım amacı olarak “Application running outside AWS” seç.'],
      ['Çıkan “Access key” ve “Secret access key” değerlerini aşağıdaki alanlara yapıştır. Secret yalnızca o ekranda bir kez gösterilir.'],
    ],
    docs: ['AWS: erişim anahtarlarını yönetme', 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html'],
  },
};
