import {
  IAMClient,
  GetAccountSummaryCommand,
  ListUsersCommand,
  ListAccessKeysCommand,
  ListMFADevicesCommand,
  GetLoginProfileCommand,
} from '@aws-sdk/client-iam';

const MAX_KEY_AGE_DAYS = 90;

// Salt okunur IAM denetimi: kök hesap anahtarı ve MFA, eski erişim anahtarları, MFA'sız konsol kullanıcıları.
export async function check(c) {
  const accessKeyId = c.awsAccessKeyId;
  const secretAccessKey = c.awsSecretAccessKey;
  const iam = new IAMClient({ region: 'us-east-1', credentials: { accessKeyId, secretAccessKey } });
  const base = { category: 'aws', area: 'Altyapı / AWS', env: 'production', sourceUrl: 'https://console.aws.amazon.com/iam/home' };
  const findings = [];

  const summary = (await iam.send(new GetAccountSummaryCommand({}))).SummaryMap || {};
  if (summary.AccountAccessKeysPresent) {
    findings.push({ ...base, externalId: 'aws:root-keys', title: 'AWS kök hesabında erişim anahtarı var', priority: 'kritik', nextAction: 'Kök hesap erişim anahtarını sil' });
  }
  if (summary.AccountMFAEnabled === 0) {
    findings.push({ ...base, externalId: 'aws:root-mfa', title: 'AWS kök hesabında MFA kapalı', priority: 'kritik', nextAction: 'Kök hesap için MFA etkinleştir' });
  }

  const users = (await iam.send(new ListUsersCommand({ MaxItems: 100 }))).Users || [];
  for (const u of users) {
    const keys = (await iam.send(new ListAccessKeysCommand({ UserName: u.UserName }))).AccessKeyMetadata || [];
    for (const k of keys) {
      if (k.Status !== 'Active' || !k.CreateDate) continue;
      const age = Math.floor((Date.now() - new Date(k.CreateDate).getTime()) / 86400000);
      if (age > MAX_KEY_AGE_DAYS) {
        findings.push({
          ...base,
          externalId: `aws:key:${k.AccessKeyId}`,
          title: `AWS erişim anahtarı ${age} gündür döndürülmedi: ${u.UserName}`,
          priority: age > 180 ? 'yuksek' : 'orta',
          errorMessage: `Anahtar ...${String(k.AccessKeyId).slice(-4)}, ${age} günlük`,
          nextAction: 'Yeni anahtar üret, servisleri güncelle, eskisini devre dışı bırak',
        });
      }
    }
    let hasConsole = true;
    try {
      await iam.send(new GetLoginProfileCommand({ UserName: u.UserName }));
    } catch (e) {
      if (e && (e.name === 'NoSuchEntityException' || e.name === 'NoSuchEntity')) hasConsole = false;
      else throw e;
    }
    if (hasConsole) {
      const mfa = (await iam.send(new ListMFADevicesCommand({ UserName: u.UserName }))).MFADevices || [];
      if (!mfa.length) {
        findings.push({ ...base, externalId: `aws:mfa:${u.UserName}`, title: `Konsol kullanıcısında MFA yok: ${u.UserName}`, priority: 'yuksek', nextAction: 'Kullanıcı için MFA etkinleştir' });
      }
    }
  }
  return { configured: true, findings, exhaustive: true };
}
