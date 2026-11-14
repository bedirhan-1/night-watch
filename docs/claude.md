# Claude ile otomatik düzeltme

Backend'inden yeni bir hata geldiğinde Night Watch bunu kendi Claude'una iletir. Claude depoyu inceler, hatayı düzeltir ve bir pull request açar. Claude senin Claude hesabında, bulutta çalışır; bilgisayarının açık olması gerekmez. Olanları mail ile ve kayıt üzerinden takip edersin.

## Nasıl çalışır

1. Backend'in bir hata yakalar ve Night Watch'a gönderir ([backend bağlama](backend.md)).
2. Night Watch kaydı açar ve hatayı senin Claude Code bulut görevine iletir.
3. Uyarı mailinde "Claude çalışmaya başladı" satırı ve oturum bağlantısı bulunur.
4. Claude depoyu klonlar, kök nedeni bulur, düzeltir ve `claude/` ile başlayan bir dalda PR açar.
5. Claude sonucu Night Watch'a bildirir: PR bağlantısı ve kısa özet, ya da çözemediyse nedeni.
6. Sonuç kayda yazılır ve ikinci bir mail gider: "Claude PR açtı" ya da "Claude çözemedi".
7. PR'ı inceleyip birleştirmek sende. Claude birleştirmez ve deploy etmez.

## Gerekenler

- Claude Pro ya da üstü bir plan ve web üzerinde Claude Code. Kullanım kendi planından düşer.
- Claude hesabına bağlı GitHub erişimi (PR senin GitHub kimliğinle açılır).
- Night Watch sunucusunda `APP_URL` ortam değişkeni (örn. `https://night-watch.vercel.app`). Claude sonucu bu adrese bildirir.

Claude Code bulut görevleri (scheduled tasks, eski adıyla routines) Anthropic tarafında araştırma önizlemesindedir; ekran adları ve sınırlar değişebilir. Güncel bilgi: [code.claude.com/docs/en/routines](https://code.claude.com/docs/en/routines).

## Kurulum

Her üye kendi Claude'unu bağlar. Projenin Ayarlar sekmesinde "Claude'u bağla" kartını aç; aşağıdaki adımların aynısı orada kopyalanabilir metinlerle durur.

1. [claude.ai/code/routines](https://claude.ai/code/routines) sayfasında yeni bir görev oluştur. Backend deponu seç; hata birden çok depodan gelebiliyorsa hepsini ekle.
2. Görevin talimatı olarak karttaki metni yapıştır. Metin, Claude'a bildirimi nasıl okuyacağını, PR açıp birleştirmemesini ve sonucu nereye bildireceğini söyler.
3. Görevin bulut ortamında Night Watch alan adına ağ izni ver: Advanced settings > Cloud environment > ortamın ayarları > Allowed domains. Alan adı kartta yazar. Bu izin olmadan PR yine açılır, ama Claude sonucu Night Watch'a bildiremez.
4. Göreve "API" tetikleyicisi ekle ve anahtar üret. Anahtar yalnızca bir kez gösterilir.
5. Tetikleme adresini ve anahtarı karta yapıştırıp kaydet.
6. "Deneme gönder"e bas. Claude birkaç dakika içinde yanıt verir; sayfayı yenileyince kartta "Son deneme başarılı" yazmalı.

## Hangi hatalar Claude'a gider

- Otomatik: kaynağı backend olan (hata gönderme adresiyle gelen), önceliği kritik ya da yüksek olan kayıtlar; kayıt ilk açıldığında ve çözülmüş bir kayıt yeniden açıldığında.
- Açık bir kaydın tekrar etmesi (sayaç artışı) Claude'u yeniden tetiklemez.
- Elle: her kayıtta, kayıt penceresindeki "Claude'a düzelttir" düğmesiyle.
- Başarısız CI, başarısız Vercel deploy'u, sağlık kontrolü, App Store ve AWS bulguları otomatik gönderilmez.

Kimin Claude'u çalışır: kaydın sorumlusu Claude'unu bağladıysa onunki, bağlamadıysa proje sahibininki. Elle tetiklemede önce düğmeye basan kişinin Claude'una bakılır.

Proje sahibi Ayarlar > Proje > "Claude ile düzeltme" seçeneğiyle bunu otomatik, yalnızca elle ya da kapalı yapabilir.

## Sınırlar

- Kayıt başına en fazla 2 otomatik deneme.
- Proje başına günde en fazla 10 tetikleme (otomatik, elle ve deneme toplam).
- Bir kayıt için Claude çalışırken ikinci bir çalışma başlatılmaz.
- Claude tarafında görev başına saatte 30, hesap başına saatte 100 tetikleme sınırı vardır.

## Güvenlik

- Görev anahtarı veritabanında şifreli saklanır ve kaydedildikten sonra tarayıcıya gönderilmez. Anahtar yalnızca o görevi tetikleyebilir; hesabına ya da depolarına erişim vermez.
- Night Watch yalnızca `https://api.anthropic.com/v1/claude_code/routines/.../fire` biçimindeki adreslere istek atar.
- Hata metni dışarıdan gelen veridir ve içine kullanıcı girdisi karışabilir. Claude bu metni "güvenilmeyen veri" olarak alır; talimat metni de içindeki talimatlara uymamasını söyler. Yine de sonuç her zaman senin inceleyeceğin bir PR'dır; ana dalı korumak için GitHub'da dal koruma kuralı kullan.
- Her çalışma için tek kullanımlık bir sonuç anahtarı üretilir; bu anahtar yalnızca o çalışmanın sonucunu yazabilir.

## Sorun giderme

| Belirti | Neden ve çözüm |
| --- | --- |
| Kartta "APP_URL tanımlı olmalı" | Sunucuda `APP_URL` ortam değişkenini tanımla ve yeniden deploy et. |
| "Son denemede Claude sonuç bildirmedi" | Bulut ortamının izinli alan adlarında Night Watch adresi yok. 3. adımı yap. Oturum bağlantısından Claude'un ne yaptığına bakabilirsin. |
| "Bağlantı çalışmıyor" ve bir mail | Görev silinmiş ya da anahtarı yenilenmiş (401/404). Yeni adres ve anahtarı karta gir. |
| "Claude 429" | Claude tarafındaki saatlik sınır doldu; sonraki saatte yeniden dene. |
| "Claude 400" | Görev duraklatılmış olabilir; claude.ai/code/routines üzerinde kontrol et. |
| Kayıtta "Claude: sonuç yok" | Claude 2 saat içinde sonuç bildirmedi. Oturumu aç; PR açılmış olabilir. |
| Hata geldi ama Claude başlamadı | Öncelik orta ya da düşük olabilir, günlük sınır dolmuş olabilir ya da kimsenin Claude'u bağlı değildir. Kayıttaki düğmeyle elle gönder. |
