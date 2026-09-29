import { config } from '../../config/index.js';
import { appLink, pickLang, sendTemplated } from '../../shared/mail/templates.js';

/**
 * Every email the institution side sends. All of them are best effort:
 * they return a status and never make the calling action fail.
 */

const ROLE_LABEL = {
  student: { en: 'Student', ar: 'طالب' },
  instructor: { en: 'Instructor', ar: 'عضو هيئة تدريس' },
  officer: { en: 'Administration team', ar: 'فريق الإدارة' },
};

const fmtDate = (date, lang) =>
  new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

const courseList = (courses) => courses.map((c) => (c.code ? `${c.code} ${c.title}` : c.title)).join(' · ');

/** Invitation with a personal link to create the account (bulk import or officer). */
export function sendInvitationEmail({ invitation, token, institution, courses = [], invitedBy = null }) {
  const lang = pickLang(institution?.defaultLanguage);
  const name = invitation.firstName;
  const inst = institution?.name ?? '';
  const role = ROLE_LABEL[invitation.role] ?? ROLE_LABEL.student;
  const url = appLink(`/?invite=${encodeURIComponent(token)}`);
  const details = [
    [lang === 'ar' ? 'البريد' : 'Email', invitation.email],
    [lang === 'ar' ? 'الدور' : 'Role', role[lang]],
  ];
  if (courses.length) details.push([lang === 'ar' ? 'المقررات' : 'Courses', courseList(courses)]);
  if (invitation.expiresAt) details.push([lang === 'ar' ? 'صالحة حتى' : 'Valid until', fmtDate(invitation.expiresAt, lang)]);

  const copy =
    lang === 'ar'
      ? {
          subject: `دعوة للانضمام إلى ${inst} على ${config.mail.appName}`,
          title: `أهلاً ${name}، ${inst} بتدعوك`,
          paragraphs: [
            invitation.role === 'officer'
              ? `${invitedBy ? `${invitedBy} ضافك` : 'اتضافت'} لفريق إدارة ${inst} على ${config.mail.appName}.`
              : `${inst} ضافتك على ${config.mail.appName}، منصة التعلم الذكية بتاعة الجامعة.`,
            courses.length ? 'مقرراتك جاهزة، وهتلاقيها أول ما تدخل.' : 'اضغط الزرار، اختار كلمة سر، وحسابك هيبقى جاهز في دقيقة.',
          ],
          button: 'قبول الدعوة وإنشاء الحساب',
          foot: 'لو مش متوقع الرسالة دي تقدر تتجاهلها، ومش هيتعمل حساب.',
        }
      : {
          subject: `You're invited to join ${inst} on ${config.mail.appName}`,
          title: `Hi ${name}, ${inst} invited you`,
          paragraphs: [
            invitation.role === 'officer'
              ? `${invitedBy ? `${invitedBy} added you` : 'You were added'} to the ${inst} administration team on ${config.mail.appName}.`
              : `${inst} added you to ${config.mail.appName}, the university's smart learning platform.`,
            courses.length ? 'Your courses are ready and waiting for you.' : 'Press the button, choose a password, and your account is ready in a minute.',
          ],
          button: 'Accept invitation',
          foot: "If you weren't expecting this, you can ignore it and no account will be created.",
        };
  return sendTemplated(invitation.email, {
    lang,
    institution: inst,
    subject: copy.subject,
    title: copy.title,
    paragraphs: copy.paragraphs,
    details,
    button: { label: copy.button, url },
    foot: copy.foot,
  });
}

/** Someone who already has an account was added to courses from a file. */
export function sendAddedToCoursesEmail({ user, institution, courses }) {
  if (!courses.length) return Promise.resolve(null);
  const lang = pickLang(user.languagePreference);
  const inst = institution?.name ?? '';
  return sendTemplated(user.email, {
    lang,
    institution: inst,
    subject: lang === 'ar' ? `اتضافت مقررات جديدة لحسابك في ${inst}` : `New courses added to your account at ${inst}`,
    title: lang === 'ar' ? `أهلاً ${user.firstName}، عندك مقررات جديدة` : `Hi ${user.firstName}, you have new courses`,
    paragraphs: [lang === 'ar' ? `${inst} ضافتك على المقررات دي:` : `${inst} added you to these courses:`],
    details: courses.map((c) => [c.code ?? '', c.title]),
    button: { label: lang === 'ar' ? 'افتح مقرراتي' : 'Open my courses', url: appLink('/') },
    foot: lang === 'ar' ? 'بتوصلك الرسالة دي لأن بريدك موجود في قائمة المؤسسة.' : "You're receiving this because your email is on your institution's list.",
  });
}

/** Answer to a student's request to join a course. */
export function sendRequestDecisionEmail({ student, course, approved, note, institution }) {
  if (!student?.email) return Promise.resolve(null);
  const lang = pickLang(student.languagePreference);
  const label = course?.code ? `${course.code} ${course.title}` : course?.title ?? '';
  const inst = institution?.name ?? '';
  const paragraphs = approved
    ? [lang === 'ar' ? `اتقبل طلبك للانضمام إلى ${label}. المقرر ظاهر دلوقتي في مقرراتك.` : `Your request to join ${label} was approved. The course is now in your courses.`]
    : [lang === 'ar' ? `للأسف طلبك للانضمام إلى ${label} ما اتقبلش.` : `Unfortunately your request to join ${label} was not approved.`];
  const details = !approved && note ? [[lang === 'ar' ? 'السبب' : 'Reason', note]] : [];
  return sendTemplated(student.email, {
    lang,
    institution: inst,
    subject: approved
      ? lang === 'ar' ? `اتقبل طلبك: ${label}` : `Request approved: ${label}`
      : lang === 'ar' ? `رد على طلبك: ${label}` : `Update on your request: ${label}`,
    title: approved ? (lang === 'ar' ? 'اتقبل طلبك' : "You're in") : (lang === 'ar' ? 'رد على طلبك' : 'Update on your request'),
    paragraphs,
    details,
    button: { label: approved ? (lang === 'ar' ? 'افتح المقرر' : 'Open the course') : (lang === 'ar' ? 'شوف المقررات المتاحة' : 'See available courses'), url: appLink('/') },
    foot: lang === 'ar' ? 'لو عندك سؤال، تواصل مع إدارة المؤسسة.' : 'If you have a question, contact your institution.',
  });
}

/** Personal account asked to link with the institution (consent is given in the app). */
export function sendLinkInvitationEmail({ user, institution, invitedBy }) {
  const lang = pickLang(user.languagePreference);
  const inst = institution?.name ?? '';
  return sendTemplated(user.email, {
    lang,
    institution: inst,
    subject: lang === 'ar' ? `${inst} عايزة تربط حسابك` : `${inst} would like to link your account`,
    title: lang === 'ar' ? `أهلاً ${user.firstName}` : `Hi ${user.firstName}`,
    paragraphs:
      lang === 'ar'
        ? [`${invitedBy ?? inst} طلب ربط حسابك الشخصي بـ ${inst}.`, 'لو وافقت، هتقدر تدخل مقررات الجامعة وتفضل كل ملفاتك وتقدّمك زي ما هم. القرار ليك، ومفيش حاجة هتتغير من غير موافقتك.']
        : [`${invitedBy ?? inst} asked to link your personal account with ${inst}.`, "If you agree, you'll get access to your university's courses and keep all your files and progress. It's your choice; nothing changes without your consent."],
    button: { label: lang === 'ar' ? 'ادخل ورد على الطلب' : 'Sign in to respond', url: appLink('/') },
    foot: lang === 'ar' ? 'لو مش عارف المؤسسة دي، تجاهل الرسالة أو ارفض الطلب من جوه الحساب.' : "If you don't recognise this institution, ignore this email or decline in the app.",
  });
}

/** Account turned off / back on by the institution. */
export function sendAccountStatusEmail({ user, isActive, institution }) {
  const lang = pickLang(user.languagePreference);
  const inst = institution?.name ?? '';
  return sendTemplated(user.email, {
    lang,
    institution: inst,
    subject: isActive
      ? lang === 'ar' ? 'حسابك اتفعّل تاني' : 'Your account is active again'
      : lang === 'ar' ? 'حسابك اتوقف مؤقتًا' : 'Your account has been paused',
    title: isActive ? (lang === 'ar' ? 'أهلاً بيك تاني' : 'Welcome back') : (lang === 'ar' ? 'حسابك اتوقف' : 'Your account is paused'),
    paragraphs: isActive
      ? [lang === 'ar' ? `${inst} رجّعت تفعيل حسابك. تقدر تدخل عادي.` : `${inst} turned your account back on. You can sign in as usual.`]
      : [lang === 'ar' ? `${inst} وقفت حسابك، فمش هتقدر تدخل دلوقتي.` : `${inst} paused your account, so you can't sign in for now.`, lang === 'ar' ? 'لو ده حصل بالغلط، كلّم إدارة المؤسسة.' : 'If you think this is a mistake, contact your institution.'],
    button: isActive ? { label: lang === 'ar' ? 'تسجيل الدخول' : 'Sign in', url: appLink('/') } : null,
    foot: config.mail.appName,
  });
}

/** An instructor was assigned to teach a course. */
export function sendCourseAssignmentEmail({ user, course, institution }) {
  const lang = pickLang(user.languagePreference);
  const inst = institution?.name ?? '';
  const label = course?.code ? `${course.code} ${course.title}` : course?.title ?? '';
  return sendTemplated(user.email, {
    lang,
    institution: inst,
    subject: lang === 'ar' ? `اتعيّنت على مقرر ${label}` : `You're now teaching ${label}`,
    title: lang === 'ar' ? `أهلاً ${user.firstName}` : `Hi ${user.firstName}`,
    paragraphs:
      lang === 'ar'
        ? [`${inst} عيّنتك على مقرر ${label}.`, 'تقدر دلوقتي ترفع ملفات المقرر، تعمل تكليفات، وتتابع الطلاب.']
        : [`${inst} assigned you to teach ${label}.`, 'You can now upload course files, create assignments and follow your students.'],
    button: { label: lang === 'ar' ? 'افتح المقرر' : 'Open the course', url: appLink('/') },
    foot: config.mail.appName,
  });
}
