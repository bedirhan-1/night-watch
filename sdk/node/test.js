'use strict';
// Sahte bir Night Watch sunucusuna karşı SDK'yı dener: node test.js
const assert = require('node:assert');
const http = require('node:http');
const { spawn } = require('node:child_process');

function server() {
  const got = [];
  const srv = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      got.push({ url: req.url, body: JSON.parse(body) });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    });
  });
  return new Promise((res) => srv.listen(0, () => res({ srv, got, url: `http://127.0.0.1:${srv.address().port}/api/ingest/${'k'.repeat(32)}` })));
}

function run(code, env) {
  return new Promise((res) => {
    const p = spawn(process.execPath, ['-e', code], { env: Object.assign({}, process.env, env), stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('exit', (code) => res({ code, err }));
  });
}

(async () => {
  const { srv, got, url } = await server();
  const env = { NIGHTWATCH_DSN: url, NODE_ENV: 'production', NIGHTWATCH_RELEASE: '1.0.2' };
  const sdk = JSON.stringify(require.resolve('./index.js'));

  // 1. Elle yakalanan hata, gruplama ve tekrar süzgeci
  let r = await run(`const nw=require(${sdk});nw.init({service:'api'});
    function odemeAl(){throw new TypeError('kart bulunamadı')}
    for(let i=0;i<3;i++){try{odemeAl()}catch(e){nw.captureException(e,{request:{method:'POST',originalUrl:'/odeme',headers:{'user-agent':'test'}}})}}
    nw.flush().then(()=>process.exit(0));`, env);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(got.length, 1, 'aynı hata 60 saniye içinde bir kez gönderilmeli');
  let e = got[0].body;
  assert.strictEqual(e.title, 'TypeError: kart bulunamadı');
  assert.strictEqual(e.level, 'error');
  assert.strictEqual(e.environment, 'production');
  assert.strictEqual(e.service, 'api');
  assert.match(e.fingerprint, /^TypeError \| odemeAl /);
  assert.match(e.message, /İstek: POST \/odeme/);
  assert.match(e.message, /Sürüm: 1\.0\.2/);

  // 2. Reddedilen promise
  got.length = 0;
  r = await run(`require(${sdk}).init();Promise.reject(new Error('veritabanı zaman aşımı'));setTimeout(()=>require(${sdk}).flush().then(()=>process.exit(0)),200);`, env);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].body.title, 'Error: veritabanı zaman aşımı');
  assert.match(got[0].body.message, /mechanism: unhandledRejection/);

  // 3. Yakalanmayan hata: gönderilir, süreç 1 koduyla kapanır
  got.length = 0;
  r = await run(`require(${sdk}).init();setTimeout(()=>{throw new RangeError('sınır aşıldı')},10);`, env);
  assert.strictEqual(r.code, 1, 'yakalanmayan hatadan sonra süreç kapanmalı');
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].body.level, 'critical');
  assert.match(r.err, /RangeError: sınır aşıldı/);

  // 4. Express hata katmanı: 4xx gönderilmez, 5xx gönderilir, hata sonraki katmana geçer
  got.length = 0;
  r = await run(`const nw=require(${sdk});nw.init();const h=nw.expressErrorHandler();let passed=0;
    const bad=Object.assign(new Error('yetkisiz'),{status:401});h(bad,{method:'GET',url:'/x',headers:{}},{},()=>passed++);
    h(new Error('çöktü'),{method:'GET',url:'/y',headers:{}},{},()=>passed++);
    nw.flush().then(()=>process.exit(passed===2?0:3));`, env);
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].body.title, 'Error: çöktü');

  // 5. DSN yoksa hiçbir şey gönderilmez ve uygulama etkilenmez
  got.length = 0;
  r = await run(`const nw=require(${sdk});nw.init();nw.captureException(new Error('x'));nw.flush().then(()=>process.exit(0));`, { NIGHTWATCH_DSN: '' });
  assert.strictEqual(r.code, 0, r.err);
  assert.strictEqual(got.length, 0);

  srv.close();
  console.log('nightwatch-node: tüm testler geçti');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
