# Kendi backend'ini bağlama

Night Watch backend'ini üç yoldan izler. Üçü birbirinden bağımsızdır; istediğini kullan.

| Yol | Ne zaman tetiklenir | Nerede ayarlanır |
| --- | --- | --- |
| Hata gönderme | Backend'in bir hata yakaladığı anda | Ayarlar > "Kendi backend'inden hata gönder" |
| Sağlık kontrolü | Night Watch adresi yokladığında | Ayarlar > "Backend sağlık kontrolü" |
| Sık kontrol | Dışarıdaki bir zamanlayıcı her çağırdığında | Bu belgenin son bölümü |

## Hata gönderme

Projenin Ayarlar sekmesinde "Kendi backend'inden hata gönder" kartını aç. Oradaki adres projene özeldir ve şifre gibidir: koduna gömme, ortam değişkeninde tut (`NIGHTWATCH_URL`).

Bu adrese JSON gövdeli bir `POST` isteği at:

```
curl -X POST "$NIGHTWATCH_URL" \
  -H "Content-Type: application/json" \
  -d '{"title":"Ödeme servisi 500 dönüyor","level":"error","environment":"production","service":"api"}'
```

### Alanlar

| Alan | Zorunlu | Açıklama |
| --- | --- | --- |
| `title` | evet | Kaydın başlığı, en fazla 200 karakter |
| `level` | hayır | `critical` (kritik), `error` (yüksek, varsayılan), `warning` (orta), `info` (düşük) |
| `message` | hayır | Hata ayrıntısı; `stack` da gönderebilirsin |
| `environment` | hayır | `local`, `staging` ya da `production` |
| `service` | hayır | Kaydın "proje alanı"na yazılır, örn. `api` |
| `url` | hayır | Kaynağa giden bağlantı (log, istek, panel) |
| `fingerprint` | hayır | Aynı hatayı gruplamak için anahtar; verilmezse başlık kullanılır |

### Tekrarlayan hatalar

Aynı `fingerprint` (ya da aynı başlık) tek bir kayıtta toplanır:

- Açık bir kayıt varsa yeni kayıt açılmaz, "kaç kez" sayacı artar ve mail gitmez.
- Kayıt çözülmüşse yeniden açılır ve mail gider.

Başlığında değişken bilgi olan hatalarda (kullanıcı kimliği, istek numarası) her hata ayrı kayıt olur. Bunu önlemek için sabit bir `fingerprint` gönder, örn. `"payment-timeout"`.

### NestJS örneği

Yakalanmayan tüm hataları bildiren bir filtre:

```ts
import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

@Catch()
export class NightWatchFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500 && process.env.NIGHTWATCH_URL) {
      const err = exception as Error;
      const req = host.switchToHttp().getRequest();
      fetch(process.env.NIGHTWATCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: err?.message ?? 'Bilinmeyen hata',
          message: err?.stack,
          level: 'error',
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'staging',
          service: 'api',
          fingerprint: `${req?.method} ${req?.route?.path} ${err?.name}`,
        }),
      }).catch(() => {});
    }
    super.catch(exception, host);
  }
}
```

`main.ts` içinde: `app.useGlobalFilters(new NightWatchFilter(app.get(HttpAdapterHost).httpAdapter));`

Yalnızca 5xx hataları gönder; 4xx hatalar (yanlış istek, yetkisiz erişim) çoğunlukla kullanıcı kaynaklıdır ve panoyu doldurur.

## Sağlık kontrolü

Ayarlar'da "Backend sağlık kontrolü" kartına, servis ayaktayken 200 dönen ve giriş gerektirmeyen adresleri yaz (örn. `https://api.ornek.com/health`). Night Watch her kontrolde bu adreslere istek atar:

- 10 saniyede yanıt gelmezse ya da 400 ve üstü bir durum kodu dönerse kritik bir kayıt açılır.
- Adres yeniden yanıt verince kayıt kendiliğinden kapanır.

Yerel ve özel ağ adresleri (localhost, 10.x, 192.168.x) kontrol edilemez.

## Anında mail

Proje ayarlarındaki "Anında mail" seçeneği, hata gönderme ve sık kontrollerin bulduğu yeni sorunlar için ne zaman mail gideceğini belirler: her yeni kayıtta, yalnızca kritiklerde ya da hiç. Bir hata döngüsü gelen kutusunu doldurmasın diye proje başına günde en fazla 20 anında mail gider; kalanı panoda ve sabah özetinde görünür.

## Sık kontrol için zamanlayıcı

Her servis kartında bir "Kontrol sıklığı" seçeneği vardır (5 dakika, 15 dakika, saatlik, 6 saatlik). Varsayılan, günde bir kez sabah 08:00'dir ve ek kurulum gerektirmez.

Günde birden sık kontrol için birinin Night Watch'ı düzenli aralıklarla dürtmesi gerekir, çünkü Vercel'in ücretsiz (Hobby) planı zamanlanmış görevleri günde bir kezle sınırlar. Şu adres her çağrıldığında, süresi dolmuş servisler yoklanır:

```
https://SENIN-ADRESIN/api/cron/tick?key=CRON_SECRET_DEGERIN
```

Bu adresi 5 dakikada bir çağıracak bir zamanlayıcı kur:

- **Ücretsiz bir cron servisi** (örn. cron-job.org): yeni bir iş oluştur, adresi yapıştır, aralığı 5 dakika seç.
- **Vercel Pro**: `vercel.json` içindeki `crons` listesine `{ "path": "/api/cron/tick", "schedule": "*/5 * * * *" }` ekle. Vercel `CRON_SECRET` başlığını kendisi gönderir.
- **Kendi sunucun**: `*/5 * * * * curl -fsS "https://SENIN-ADRESIN/api/cron/tick?key=..." > /dev/null`

Zamanlayıcı 5 dakikada bir çağırsa bile her servis kendi sıklığında yoklanır; saatlik ayarlı bir servis saatte bir çalışır. Adresteki `key` değeri `CRON_SECRET` ortam değişkeninle aynıdır; adresi kimseyle paylaşma.

Zamanlayıcının çalıştığını Ayarlar'daki servis satırında yazan son kontrol saatinden anlarsın.
