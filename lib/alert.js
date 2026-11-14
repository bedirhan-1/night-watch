import { sql } from './db';
import { today } from './util';
import { sendMail, notifyEmail, alertMail } from './mail';

const DAILY_CAP = 20;

// Yeni açılan otomatik kayıtlar için anında mail. Projenin "Anında mail" tercihine uyar
// ve bir hata döngüsünün gelen kutusunu doldurmaması için proje başına günde DAILY_CAP mail ile sınırlıdır.
export async function sendAlert(project, created, origin, { sessions = {} } = {}) {
  const mode = project.alert_mode || 'hepsi';
  if (!created.length || mode === 'kapali') return false;
  const list = mode === 'kritik' ? created.filter((r) => r.priority === 'kritik') : created;
  if (!list.length) return false;
  try {
    const t = today();
    const used = project.alert_day === t ? project.alert_count || 0 : 0;
    if (used >= DAILY_CAP) {
      console.warn(`[alert] ${project.name}: günlük anında mail sınırı doldu`);
      return false;
    }
    await sql()`UPDATE projects SET alert_day = ${t}, alert_count = ${used + 1} WHERE id = ${project.id}`;
    project.alert_day = t;
    project.alert_count = used + 1;
    const last = used + 1 === DAILY_CAP;
    await sendMail({
      to: notifyEmail(project),
      subject: `Night Watch · ${project.name}: ${list.length === 1 ? list[0].title : `${list.length} yeni sorun`}`,
      html: alertMail({ project, records: list, origin, last, sessions }),
    });
    return true;
  } catch (e) {
    console.error('[alert] anında mail gönderilemedi:', e && e.message);
    return false;
  }
}
