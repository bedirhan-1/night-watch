# nightwatch-node

Node.js backend'indeki hataları Night Watch'a gönderir. Sentry SDK'sı gibi çalışır: uygulama açılırken bir kez başlatırsın, yakalanmayan hatalar ve reddedilen promise'ler kendiliğinden gönderilir; Express ve NestJS için hata katmanı vardır. Bağımlılığı yoktur, Node 18 ve üstünde çalışır.

## Kurulum

```
npm install nightwatch-node
```

Paket npm'de yayınlanmadıysa `index.js` (NestJS kullanıyorsan `nestjs.js` de) dosyasını projene kopyalayıp oradan da kullanabilirsin.

Night Watch'ta projenin Ayarlar > "Kendi backend'inden hata gönder" kartındaki adresi ortam değişkenine koy:

```
NIGHTWATCH_DSN=https://bedirhangiden.com/api/ingest/...
```

## Başlatma

Uygulamanın en başında, diğer importlardan önce:

```js
const nightwatch = require('nightwatch-node');
nightwatch.init({ service: 'api' });
```

Bu kadarıyla yakalanmayan hatalar (`uncaughtException`) ve reddedilen promise'ler (`unhandledRejection`) gönderilir.

### NestJS

```ts
// main.ts
import * as nightwatch from 'nightwatch-node';
import { NightWatchFilter } from 'nightwatch-node/nestjs';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';

nightwatch.init({ service: 'api' });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { httpAdapter } = app.get(HttpAdapterHost);
  app.useGlobalFilters(new NightWatchFilter(httpAdapter));
  await app.listen(3000);
}
bootstrap();
```

Filtre 500 ve üstü hataları gönderir, sonra hatayı Nest'in normal hata yanıtına bırakır.

### Express

```js
app.use(routes);
app.use(nightwatch.expressErrorHandler()); // rotalardan sonra, kendi hata katmanından önce
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: 'Bir hata oluştu' }));
```

### Elle gönderme

```js
try {
  await odemeAl();
} catch (err) {
  nightwatch.captureException(err, { level: 'critical', user: { id: userId }, extra: { siparisId } });
  throw err;
}

nightwatch.captureMessage('Stok senkronizasyonu 3 kez denendi, vazgeçildi', 'warning');
```

Oturumdaki kullanıcıyı ve sabit etiketleri bir kez ayarlayabilirsin: `nightwatch.setUser({ id, email })`, `nightwatch.setTag('bolge', 'eu-central-1')`.

## Seçenekler

| Seçenek | Varsayılan | Açıklama |
| --- | --- | --- |
| `dsn` | `NIGHTWATCH_DSN` | Hata gönderme adresi |
| `environment` | `NODE_ENV` | production, staging ya da development (local) |
| `release` | `NIGHTWATCH_RELEASE`, yoksa package.json sürümü | Hatanın hangi sürümde çıktığını gösterir |
| `service` | boş | Kaydın "proje alanı" |
| `captureUnhandled` | `true` | Yakalanmayan hataları kendiliğinden yakala |
| `exitOnUncaught` | `true` | Yakalanmayan hatadan sonra hatayı gönderip süreci kapat (Node'un varsayılan davranışı) |
| `dedupeSeconds` | `60` | Aynı hatayı bu süre içinde tekrar gönderme |
| `beforeSend` | yok | Olayı göndermeden önce değiştir ya da `null` döndürüp gönderme |
| `debug` | `false` | Gönderimleri konsola yaz |

## Nasıl çalışır

- **Gruplama:** Hata türü ile uygulamandaki ilk stack satırının fonksiyon ve dosya adı birleştirilir (satır numarası dahil değil). Aynı yerden gelen hata, mesajı değişse de Night Watch'ta tek kayıtta toplanır ve sayacı artar. Kendi anahtarını vermek için `captureException(err, { fingerprint: 'odeme-zaman-asimi' })`.
- **Bağlam:** Stack trace, istek yöntemi ve adresi, kullanıcı, sürüm, sunucu adı ve Node sürümü hata ayrıntısına eklenir. İstek başlıkları ve gövdesi gönderilmez.
- **Gönderim:** Arka planda yapılır, uygulamayı bekletmez. Başarısız olursa bir kez yeniden denenir; Night Watch'a ulaşılamazsa uygulama etkilenmez.
- **Kapanış:** Yakalanmayan bir hatada SDK hatayı göndermek için en fazla 2 saniye bekler, sonra süreci 1 koduyla kapatır. Kendi `uncaughtException` dinleyicin varsa süreci kapatmaz, kararı sana bırakır. Süreci kendin kapatıyorsan önce `await nightwatch.flush()` çağır.

## Gizli bilgileri ayıklama

```js
nightwatch.init({
  beforeSend(event) {
    event.message = event.message.replace(/Bearer [\w.-]+/g, 'Bearer [gizli]');
    return event;
  },
});
```
