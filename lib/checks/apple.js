import { createPrivateKey, sign } from 'node:crypto';
import { getJson } from '../util';

const API = 'https://api.appstoreconnect.apple.com';
const b64u = (s) => Buffer.from(s).toString('base64url');

function jwt(c) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: c.ascKeyId, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: c.ascIssuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }));
  const key = createPrivateKey(c.ascPrivateKey.replace(/\\n/g, '\n'));
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return `${head}.${body}.${sig}`;
}

const REJECTED = ['REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
const IN_REVIEW = ['WAITING_FOR_REVIEW', 'IN_REVIEW'];

// Bu kontrol her çalıştığında güncel bulguların tamamını döndürür; listede olmayan eski App Store kayıtları kapatılır.
export async function check(c) {
  const headers = { Authorization: `Bearer ${jwt(c)}` };
  let apps;
  if (c.ascAppId) {
    const one = await getJson(`${API}/v1/apps/${c.ascAppId}`, headers);
    apps = [one.data];
  } else {
    apps = (await getJson(`${API}/v1/apps?limit=50`, headers)).data || [];
  }
  const findings = [];
  for (const app of apps) {
    const name = (app.attributes && app.attributes.name) || app.id;
    const base = { category: 'store', area: name, env: 'production' };

    const builds = (await getJson(`${API}/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`, headers)).data || [];
    const b = builds[0];
    if (b) {
      const a = b.attributes || {};
      if (a.processingState === 'FAILED' || a.processingState === 'INVALID') {
        findings.push({
          ...base,
          externalId: `apple:build:${b.id}:failed`,
          title: `TestFlight derlemesi işlenemedi: ${name} (${a.version})`,
          priority: 'yuksek',
          sourceUrl: `https://appstoreconnect.apple.com/apps/${app.id}/testflight/ios`,
          errorMessage: `processingState: ${a.processingState}`,
          nextAction: "App Store Connect'ten gelen e-postadaki hatayı düzeltip yeni derleme yükle",
        });
      } else if (a.processingState === 'VALID' && !a.expired && a.expirationDate) {
        const days = (new Date(a.expirationDate).getTime() - Date.now()) / 86400000;
        if (days >= 0 && days <= 7) {
          findings.push({
            ...base,
            externalId: `apple:build:${b.id}:expiring`,
            title: `TestFlight derlemesinin süresi doluyor: ${name} (${a.version})`,
            priority: 'orta',
            dueDate: String(a.expirationDate).slice(0, 10),
            sourceUrl: `https://appstoreconnect.apple.com/apps/${app.id}/testflight/ios`,
            nextAction: 'Test devam edecekse yeni derleme yükle',
          });
        }
      }
    }

    const versions = (await getJson(`${API}/v1/apps/${app.id}/appStoreVersions?limit=5`, headers)).data || [];
    for (const v of versions) {
      const a = v.attributes || {};
      const state = a.appVersionState || a.appStoreState;
      const url = `https://appstoreconnect.apple.com/apps/${app.id}/distribution`;
      if (REJECTED.includes(state)) {
        findings.push({
          ...base,
          externalId: `apple:version:${v.id}:${state}`,
          title: `App Store incelemesi reddedildi: ${name} ${a.versionString}`,
          priority: 'yuksek',
          sourceUrl: url,
          errorMessage: `Durum: ${state}`,
          nextAction: 'Çözüm Merkezi’ndeki ret gerekçesini oku ve yanıtla',
        });
      } else if (IN_REVIEW.includes(state)) {
        findings.push({
          ...base,
          externalId: `apple:version:${v.id}:review`,
          title: `App Store incelemesinde: ${name} ${a.versionString}`,
          status: 'beklemede',
          priority: 'dusuk',
          sourceUrl: url,
          errorMessage: `Durum: ${state}`,
          nextAction: 'Apple incelemesinin sonucunu bekle',
        });
      } else if (state === 'PENDING_DEVELOPER_RELEASE') {
        findings.push({
          ...base,
          externalId: `apple:version:${v.id}:release`,
          title: `Onaylandı, yayına alınmayı bekliyor: ${name} ${a.versionString}`,
          priority: 'orta',
          sourceUrl: url,
          nextAction: 'Sürümü App Store Connect’ten yayına al',
        });
      }
    }
  }
  return { configured: true, findings, exhaustive: true };
}
