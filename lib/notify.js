import { memberEmails } from './auth';
import { sendMail, assignMail } from './mail';

// Kayıt, işlemi yapan kişiden başka bir proje üyesine atandıysa ona mail gönderir.
// Mail hatası kaydın kendisini etkilemez; yalnızca sunucu günlüğüne yazılır.
export async function notifyAssignment({ project, record, previousOwner, actor, origin }) {
  const to = record.owner;
  if (!to || to === previousOwner || to === actor.email) return;
  if (!memberEmails(project).includes(to)) return;
  if (record.status === 'cozuldu') return;
  try {
    await sendMail({
      to,
      subject: `Night Watch · ${project.name}: sana bir iş atandı`,
      html: assignMail({ projectName: project.name, projectId: project.id, record, actor: actor.name || actor.email, origin }),
    });
  } catch (e) {
    console.error('[notify] atama maili gönderilemedi:', e && e.message);
  }
}
