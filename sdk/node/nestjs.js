'use strict';
// NestJS için global hata filtresi. Kullanım (main.ts):
//   const { httpAdapter } = app.get(HttpAdapterHost);
//   app.useGlobalFilters(new NightWatchFilter(httpAdapter));
const { Catch, HttpException } = require('@nestjs/common');
const { BaseExceptionFilter } = require('@nestjs/core');
const { captureException } = require('./index');

class NightWatchFilter extends BaseExceptionFilter {
  catch(exception, host) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    if (status >= 500) {
      let request;
      try {
        if (host.getType() === 'http') request = host.switchToHttp().getRequest();
      } catch {}
      captureException(exception, { request });
    }
    super.catch(exception, host);
  }
}
Catch()(NightWatchFilter);

module.exports = { NightWatchFilter };
