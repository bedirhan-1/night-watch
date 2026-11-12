import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Her projenin servis bilgileri tek bir JSON olarak AES-256-GCM ile şifrelenip projects.credentials_enc sütununda tutulur.
export const SERVICE_KEYS = {
  http: ['httpUrls', 'httpEvery'],
  vercel: ['vercelToken', 'vercelTeamId', 'vercelProjects', 'vercelEvery'],
  github: ['githubToken', 'githubRepos', 'githubEvery'],
  apple: ['ascKeyId', 'ascIssuerId', 'ascPrivateKey', 'ascAppId', 'appleEvery'],
  aws: ['awsAccessKeyId', 'awsSecretAccessKey', 'awsEvery'],
};
export const ALL_KEYS = Object.values(SERVICE_KEYS).flat();
const SECRET = ['vercelToken', 'githubToken', 'ascPrivateKey', 'awsSecretAccessKey'];

function key() {
  const k = process.env.ENCRYPTION_KEY || '';
  if (k.length < 16) throw new Error('ENCRYPTION_KEY tanımlı değil ya da 16 karakterden kısa');
  return createHash('sha256').update(k).digest();
}

export function encrypt(obj) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(s) {
  if (!s) return {};
  const [iv, tag, enc] = s.split('.').map((x) => Buffer.from(x, 'base64'));
  const d = createDecipheriv('aes-256-gcm', key(), iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(enc), d.final()]).toString('utf8'));
}

export function configured(c) {
  return {
    http: !!String(c.httpUrls || '').trim(),
    vercel: !!c.vercelToken,
    github: !!(c.githubToken && c.githubRepos),
    apple: !!(c.ascKeyId && c.ascIssuerId && c.ascPrivateKey),
    aws: !!(c.awsAccessKeyId && c.awsSecretAccessKey),
  };
}

// Tarayıcıya gönderilen görünüm: gizli alanların değeri hiç dönmez, yalnızca kayıtlı olup olmadığı.
export function publicView(c) {
  const values = {};
  const set = {};
  for (const k of ALL_KEYS) {
    set[k] = !!c[k];
    if (!SECRET.includes(k)) values[k] = c[k] || '';
  }
  return { values, set };
}
