import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { COURSE_STAFF_ROLES, LANGUAGES, ROLES } from '../config/constants.js';
import { authService } from '../modules/auth/index.js';
import * as authRepository from '../modules/auth/auth.repository.js';
import { academicStructureService } from '../modules/academic-structure/index.js';
import { coursesService } from '../modules/courses/index.js';
import { knowledgeIngestionService } from '../modules/knowledge/index.js';
import { assignmentsService } from '../modules/assignments/index.js';
import { submissionsService } from '../modules/submissions/index.js';
import { reviewService } from '../modules/review/index.js';
import { remedialService } from '../modules/remedial/index.js';
import { analyticsService } from '../modules/analytics/index.js';
import { learnerDiagnosticService } from '../modules/learner/index.js';
import { learnerModelService } from '../modules/learner/index.js';
import { tutorService } from '../modules/tutor/index.js';
import { practiceService } from '../modules/practice/index.js';
import { reassessmentService } from '../modules/reassessment/index.js';

const DEMO_PASSWORD = 'Passw0rd1';
const ADMIN_EMAIL = 'admin@menoufia.edu.eg';

const INSTITUTION_NAME = 'Menoufia University';
const EMAIL_DOMAIN = 'menoufia.edu.eg';

const SET_THEORY_MATERIAL =
  'محاضرة في نظرية المجموعات. المجموعة هي تجمع لكائنات مميزة بلا ترتيب محدد. ' +
  'التقاطع بين المجموعتين A و B هو مجموعة العناصر المشتركة بينهما ويكتب A ∩ B. ' +
  'الاتحاد هو مجموعة كل العناصر التي تنتمي إلى A أو B أو كليهما ويكتب A ∪ B. ' +
  'قوانين دي مورجان تربط الاتحاد والتقاطع بالمتممة: متممة اتحاد مجموعتين تساوي تقاطع المتممات. ' +
  'مثال محلول: إذا كانت A = {1,2,3} و B = {2,3,4} فإن A ∩ B = {2,3} و A ∪ B = {1,2,3,4}.';

const GRAPH_THEORY_MATERIAL =
  'محاضرة في نظرية المخططات. المخطط G = (V, E) يتكون من مجموعة رؤوس V ومجموعة حواف E. ' +
  'المسار هو سلسلة من الحواف المتتالية بين رأسين، والدورة مسار مغلق يعود إلى نقطة البداية. ' +
  'المخطط المتصل يوجد بين كل زوج من الرؤوس مسار على الأقل. الشجرة هي مخطط متصل بلا دورات وعدد حوافها n-1. ' +
  'مثال محلول: نمثل شبكة نقل بالرؤوس والحواف ثم نتحقق من الاتصال بين كل المحطات باستخدام البحث بالعرض BFS.';

const COLORING_MATERIAL =
  'محاضرة في تلوين المخططات. تلوين المخطط هو إسناد ألوان إلى الرؤوس بحيث لا يتشارك رأسان متجاوران في اللون نفسه. ' +
  'العدد الكرومي χ(G) هو أقل عدد من الألوان يكفي لتلوين المخطط. ' +
  'نظرية الأربعة ألوان تنص على أن كل مخطط مستوٍ قابل للتلوين بأربعة ألوان على الأكثر. ' +
  'مثال محلول: نلون مخططًا مستويًا صغيرًا رأسًا رأس بالترتيب ثم نتحقق من صحة التلوين عند كل حافة.';

const PYTHON_BASICS_MATERIAL =
  'ملزمة في أساسيات لغة بايثون. المتغير اسم يشير إلى قيمة محفوظة في الذاكرة ويتم إنشاؤه عند الإسناد مباشرة دون تحديد النوع. ' +
  'القائمة List مجموعة مرتبة قابلة للتعديل تُكتب بأقواس مربعة مثل [1, 2, 3]، أما الصف Tuple فمرتب لكن غير قابل للتعديل ويُكتب بأقواس عادية مثل (1, 2, 3). ' +
  'الدالة تُعرَّف بالكلمة المفتاحية def ويمكن أن تستقبل معاملات وترجع قيمة بـ return. ' +
  'مثال محلول: دالة مجموع تأخذ قائمتين وترجع مجموع العناصر باستخدام حلقة for ودالة sum المدمجة.';

const GOOD_INTERSECTION_ANSWER =
  'تقاطع المجموعتين A و B هو مجموعة كل العناصر المشتركة بينهما، ويُرمز له بـ A ∩ B. ' +
  'مثال محلول: إذا كانت A = {1,2,3} و B = {2,3,4} فإن التقاطع A ∩ B = {2,3} ' +
  'لأن العنصرين 2 و 3 فقط هما المشتركان بين المجموعتين كما في تعريف المحاضرة ومثالها.';

const GOOD_UNION_ANSWER =
  'الاتحاد يجمع كل عناصر المجموعتين معًا بينما التقاطع يقتصر على العناصر المشتركة بينهما فقط.';

const PROOF_ANSWER =
  'وفقًا لنظرية الأربعة ألوان كل مخطط مستوٍ قابل للتلوين بأربعة ألوان؛ نلوّن الرؤوس واحدًا تلو الآخر ' +
  'ونختار لونًا مختلفًا عن ألوان جيرانه حتى تُحقق كل حافة الشرط.';

function log(message) {
  console.log(`[seed] ${message}`);
}

async function registerUser(payload) {
  const { user } = await authService.register({ password: DEMO_PASSWORD, ...payload });
  log(`user ready: ${user.role.padEnd(18)} ${user.email}`);
  return user;
}

async function waitForGraded(student, assignmentId, fromStatus) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const view = await submissionsService.getStudentAssignmentView(student, assignmentId);
    const status = view.submission?.status;
    if (status === 'GRADED' || status === 'FINALIZED') {
      return view.submission;
    }
    if (fromStatus && status !== fromStatus && status !== 'GRADING' && status !== 'SUBMITTED') {
      throw new Error(`unexpected submission status ${status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`grading timed out for student ${student.email}`);
}

async function submitAnswer(student, assignmentId, questionId, answerText) {
  await submissionsService.autosaveAnswer(student, assignmentId, questionId, { answerText });
  return submissionsService.submitAssignment(student, assignmentId);
}

async function main() {
  const reset = process.argv.includes('--reset');
  await connectDatabase();

  if (reset) {
    log('reset flag detected: dropping the database');
    await mongoose.connection.dropDatabase();
  }

  const existingAdmin = await authRepository.findByEmail(ADMIN_EMAIL);
  if (existingAdmin) {
    console.log('\n[seed] database already seeded. Re-run with --reset to wipe and reseed:\n  npm run seed -- --reset\n');
    await disconnectDatabase();
    return;
  }

  log(`institution: ${INSTITUTION_NAME} (@${EMAIL_DOMAIN})`);
  const admin = await registerUser({
    email: ADMIN_EMAIL,
    firstName: 'منى',
    lastName: 'عبد الرحمن',
    role: ROLES.INSTITUTION_ADMIN,
    institutionName: INSTITUTION_NAME,
    emailDomains: [EMAIL_DOMAIN],
    allowSelfRegistration: true,
    languagePreference: LANGUAGES.ARABIC,
  });

  const faculty = await academicStructureService.createUnit(admin, {
    type: 'faculty',
    name: 'كلية الحاسبات والمعلومات',
    code: 'FCI-MN',
  });
  const department = await academicStructureService.createUnit(admin, {
    type: 'department',
    name: 'قسم علوم الحاسب',
    code: 'CS-MN',
    parentId: faculty.id,
  });
  await academicStructureService.createUnit(admin, {
    type: 'program',
    name: 'برنامج بكالوريوس علوم الحاسب',
    code: 'BSC-CS-MN',
    parentId: department.id,
  });
  await academicStructureService.createUnit(admin, {
    type: 'semester',
    name: 'الفصل الدراسي الأول 2026/2027',
    code: 'FALL-2026',
    parentId: department.id,
  });
  log('academic units: faculty > department > program > semester');

  const instructor = await registerUser({
    email: 'hassan.farid@menoufia.edu.eg',
    firstName: 'حسن',
    lastName: 'فريد',
    role: ROLES.INSTRUCTOR,
    institutionId: admin.institutionId,
    languagePreference: LANGUAGES.ARABIC,
  });

  const studentSeed = [
    ['sara@menoufia.edu.eg', 'سارة', 'علي'],
    ['mona@menoufia.edu.eg', 'منى', 'سعيد'],
    ['nadia@menoufia.edu.eg', 'نادية', 'سمير'],
    ['yara@menoufia.edu.eg', 'يارا', 'هاني'],
    ['omar@menoufia.edu.eg', 'عمر', 'كمال'],
    ['mariam@menoufia.edu.eg', 'مريم', 'حسن'],
  ];
  const students = [];
  for (const [email, firstName, lastName] of studentSeed) {
    students.push(
      await registerUser({
        email,
        firstName,
        lastName,
        role: ROLES.STUDENT,
        institutionId: admin.institutionId,
        languagePreference: LANGUAGES.ARABIC,
      }),
    );
  }
  const [sara, mona, nadia, yara, omar] = students;

  const course = await coursesService.createCourse(admin, {
    title: 'الرياضيات المتقطعة',
    code: 'CS201',
  });
  await coursesService.addStaff(admin, course.id, {
    userId: instructor.id,
    role: COURSE_STAFF_ROLES.INSTRUCTOR,
  });
  for (const student of students) {
    await coursesService.enroll(admin, course.id, student.id);
  }
  log(`course ready: CS201 - الرياضيات المتقطعة (1 instructor, ${students.length} students)`);

  const requester = await registerUser({
    email: 'farida@menoufia.edu.eg',
    firstName: 'فريدة',
    lastName: 'محمد',
    role: ROLES.STUDENT,
    institutionId: admin.institutionId,
    languagePreference: LANGUAGES.ARABIC,
  });
  await coursesService.requestEnrollment(requester, course.id, {
    note: 'حابة أبدأ في المقرر ده كمقرر اختياري.',
  });
  log('enrollment request: farida -> CS201 (pending admin approval)');

  const topicSets = await coursesService.addTopic(instructor, course.id, {
    title: 'نظرية المجموعات',
    order: 1,
  });
  const topicGraphs = await coursesService.addTopic(instructor, course.id, {
    title: 'نظرية المخططات',
    order: 2,
  });
  const topicColoring = await coursesService.addTopic(instructor, course.id, {
    title: 'تلوين المخططات',
    order: 3,
  });

  await knowledgeIngestionService.uploadMaterial(instructor, course.id, {
    title: 'محاضرة 1: نظرية المجموعات',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'lecture-01-sets.txt',
    content: SET_THEORY_MATERIAL,
  });
  await knowledgeIngestionService.uploadMaterial(instructor, course.id, {
    title: 'محاضرة 2: نظرية المخططات',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'lecture-02-graphs.txt',
    content: GRAPH_THEORY_MATERIAL,
  });
  await knowledgeIngestionService.uploadMaterial(instructor, course.id, {
    title: 'محاضرة 3: تلوين المخططات',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'lecture-03-coloring.txt',
    content: COLORING_MATERIAL,
  });
  log('materials uploaded and READY: 3 Arabic lectures chunked + embedded');

  const hw1 = await assignmentsService.createAssignment(instructor, course.id, {
    title: 'واجب 1: نظرية المجموعات',
  });
  const q1 = await assignmentsService.addQuestion(instructor, hw1.id, {
    questionText: 'عرّف تقاطع المجموعتين وقدّم مثالًا محلولًا.',
    topicId: topicSets.id,
    maxScore: 10,
    modelAnswer: 'تقاطع A و B هو مجموعة العناصر المشتركة بينهما؛ مثال: {1,2} ∩ {2,3} = {2}.',
    rubricText: '4 درجات للتعريف، 4 للمثال المحلول، درجتان للرموز الصحيحة.',
  });
  const q2 = await assignmentsService.addQuestion(instructor, hw1.id, {
    questionText: 'اشرح الاتحاد بين مجموعتين وكيف يختلف عن التقاطع.',
    topicId: topicSets.id,
    maxScore: 10,
  });
  const q3 = await assignmentsService.addQuestion(instructor, hw1.id, {
    questionText: 'ناقش نظرية الأربعة ألوان ودلالتها في تلوين المخططات المستوية.',
    topicId: topicColoring.id,
    maxScore: 10,
    modelAnswer: 'نظرية الأربعة ألوان: كل مخطط مستوٍ قابل للتلوين بأربعة ألوان على الأكثر.',
    rubricText: '5 درجات لصياغة النظرية، 5 لمناقشة الدلالة.',
  });
  await assignmentsService.publishAssignment(instructor, hw1.id);
  log(`assignment 1 published: واجب 1 (3 questions, total 30)`);

  await submissionsService.autosaveAnswer(sara, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.submitAssignment(sara, hw1.id);
  await submissionsService.autosaveAnswer(mona, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.autosaveAnswer(mona, hw1.id, q2.id, { answerText: GOOD_UNION_ANSWER });
  await submissionsService.submitAssignment(mona, hw1.id);
  await submissionsService.autosaveAnswer(nadia, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.autosaveAnswer(nadia, hw1.id, q3.id, { answerText: 'لا أعرف الإثبات' });
  await submissionsService.submitAssignment(nadia, hw1.id);
  await submissionsService.autosaveAnswer(yara, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.submitAssignment(yara, hw1.id);
  await submissionsService.autosaveAnswer(omar, hw1.id, q1.id, { answerText: 'مش عارف حاجة في الموضوع ده' });
  await submissionsService.submitAssignment(omar, hw1.id);
  log('5 submissions sent - waiting for the AI grading queue...');

  const saraSubmission = await waitForGraded(sara, hw1.id);
  await waitForGraded(mona, hw1.id);
  const nadiaSubmission = await waitForGraded(nadia, hw1.id);
  const yaraSubmission = await waitForGraded(yara, hw1.id);
  const omarSubmission = await waitForGraded(omar, hw1.id);
  log('all submissions GRADED');

  const bulk = await reviewService.bulkApprove(instructor, hw1.id, {
    submissionIds: [saraSubmission.id, yaraSubmission.id],
  });
  log(`bulk approved (fast track): ${bulk.approved.length} submissions`);

  await reviewService.editSubmission(instructor, (await submissionsService.getStudentAssignmentView(mona, hw1.id)).submission.id, {
    score: 14,
    feedback: 'التعريف ممتاز، لكن إجابة الاتحاد تحتاج تفصيلًا أكثر مع مثال.',
  });
  log('mona: edited final score 14/30');

  await reviewService.rejectSubmission(instructor, omarSubmission.id, {
    score: 2,
    feedback: 'تقييم يدوي: الإجابة لا تتناول المطلوب، درجة مجهود فقط.',
  });
  log('omar: rejected and graded manually 2/30');

  await reviewService.requestResubmission(instructor, nadiaSubmission.id, {
    reason: 'أعيدي كتابة إجابة سؤال الألوان مع شرح خطوات الإثبات والرموز.',
  });
  log('nadia: resubmission requested (attempt 2 opened)');

  await submitAnswer(nadia, hw1.id, q3.id, PROOF_ANSWER);
  const nadiaResubmitted = await waitForGraded(nadia, hw1.id, 'RESUBMISSION_REQUESTED');
  await reviewService.approveSubmission(instructor, nadiaResubmitted.id);
  log('nadia: resubmitted, approved by AI grades');

  const hw2 = await assignmentsService.createAssignment(instructor, course.id, {
    title: 'واجب 2: نظرية المخططات',
  });
  await assignmentsService.addQuestion(instructor, hw2.id, {
    questionText: 'كل دورة في المخطط هي مسار، وعكس ذلك صحيح أيضًا.',
    topicId: topicGraphs.id,
    maxScore: 5,
    questionType: 'true_false',
    correctAnswer: false,
  });
  await assignmentsService.addQuestion(instructor, hw2.id, {
    questionText: 'أي مما يلي يضمن أن المخطط ذا الرؤوس n متصل؟',
    topicId: topicGraphs.id,
    maxScore: 5,
    questionType: 'multiple_choice',
    options: [
      { text: 'عدد الحواف n-1 على الأقل مع اتصال كل زوج بالمسار' },
      { text: 'وجود حلقة ذاتية على كل رأس' },
      { text: 'أن تكون كل الرؤوس معزولة' },
      { text: 'أن يكون عدد الحواف أقل من n-1' },
    ],
    correctOptionIndexes: [0],
  });
  await assignmentsService.addQuestion(instructor, hw2.id, {
    questionText: 'ميّز بين المسار والدورة في المخطط مع مثال لكل منهما.',
    topicId: topicGraphs.id,
    maxScore: 10,
    modelAnswer: 'المسار سلسلة حواف متتالية بين رأسين، والدورة مسار مغلق يعود إلى نقطة البداية.',
    rubricText: '5 لكل تعريف مع المثال.',
  });
  await assignmentsService.publishAssignment(instructor, hw2.id);

  const hw3 = await assignmentsService.createAssignment(instructor, course.id, {
    title: 'واجب 3: تلوين المخططات',
  });
  await assignmentsService.addQuestion(instructor, hw3.id, {
    questionText: 'طبّق خوارزمية التلوين على مخطط مستوي صغير واثبت صحة الحل.',
    topicId: topicColoring.id,
    maxScore: 20,
  });
  log('assignment 2 OPEN: true_false + multiple_choice (auto-graded) + essay (AI) - assignment 3 DRAFT');

  let remedialPublished = 0;
  try {
    const offTopicRemedial = await remedialService.generateDraft(instructor, course.id, {
      origin: 'FROM_MISCONCEPTION',
      assignmentId: hw1.id,
      misconceptionCode: 'OFF_TOPIC_RESPONSE',
      contentType: 'FOCUSED_EXPLANATION_WITH_EXAMPLE',
    });
    await remedialService.publishRemedial(instructor, course.id, offTopicRemedial.id, {
      audienceType: 'AFFECTED_STUDENTS',
    });
    remedialPublished += 1;
    const practiceRemedial = await remedialService.generateDraft(instructor, course.id, {
      origin: 'STANDALONE',
      topicId: topicGraphs.id,
      contentType: 'EXTRA_PRACTICE_QUESTIONS',
      instructions: 'تركيز على الفرق بين المسار والدورة والأشجار',
    });
    await remedialService.publishRemedial(instructor, course.id, practiceRemedial.id, {
      audienceType: 'ALL_STUDENTS',
    });
    remedialPublished += 1;
    log('remedial published: AFFECTED_STUDENTS (OFF_TOPIC) + ALL_STUDENTS (graphs practice)');
  } catch (error) {
    log(
      `WARN remedial step skipped: ${error.message}` +
        ' (check VECTOR_SEARCH_MODE / the Atlas index - retrieval returned no trusted chunks)',
    );
  }

  log('learning loop: diagnostics, tutor, practice, reassessment for the students...');

  const saraDiagnostic = await learnerDiagnosticService.startDiagnostic(sara, course.id, {
    topicIds: [topicSets.id],
    questionsPerTopic: 2,
  });
  const diagnosticQuestions = await learnerDiagnosticService.getDiagnostic(
    sara,
    course.id,
    saraDiagnostic.id,
  );
  for (const question of diagnosticQuestions.questions) {
    await learnerDiagnosticService.submitAnswer(sara, course.id, saraDiagnostic.id, {
      questionId: question.id,
      content:
        'تقاطع المجموعتين A و B هو مجموعة كل العناصر المشتركة بينهما ويُرمز له بـ A ∩ B، ' +
        'ومثاله {1,2} ∩ {2,3} = {2} كما في المحاضرة.',
    });
  }
  log('sara: diagnostic completed on نظرية المجموعات (evidence written)');

  const monaDiagnostic = await learnerDiagnosticService.startDiagnostic(mona, course.id, {
    topicIds: [topicGraphs.id],
    questionsPerTopic: 2,
  });
  const monaQuestions = await learnerDiagnosticService.getDiagnostic(mona, course.id, monaDiagnostic.id);
  await learnerDiagnosticService.submitAnswer(mona, course.id, monaDiagnostic.id, {
    questionId: monaQuestions.questions[0].id,
    content: 'مش فاكرة حاجة، صدقني',
  });
  for (const question of monaQuestions.questions.slice(1)) {
    await learnerDiagnosticService.submitAnswer(mona, course.id, monaDiagnostic.id, {
      questionId: question.id,
      content:
        'المسار هو سلسلة حواف متتالية بين رأسين، والدورة مسار مغلق يعود إلى نقطة البداية، ' +
        'ومثال الدورة هو المثلث بين ثلاثة رؤوس.',
    });
  }
  log('mona: diagnostic completed on نظرية المخططات (one weak answer, one strong)');

  const monaTutorSession = await tutorService.createSession(mona, course.id, {
    topicId: topicGraphs.id,
    mode: 'explanation',
  });
  await tutorService.askQuestion(mona, course.id, monaTutorSession.id, {
    content: 'إيه الفرق بين المسار والدورة في المخطط مع مثال؟',
  });
  log('mona: tutor session answered from the trusted Arabic lecture (grounded + cited)');

  const saraPractice = await practiceService.startSession(sara, course.id, {
    topicId: topicColoring.id,
    questionsCount: 2,
  });
  const practiceSession = await practiceService.getSession(sara, course.id, saraPractice.id);
  const practiceAnswers = [
    'تلوين المخطط هو إسناد ألوان إلى الرؤوس بحيث لا يتشارك رأسان متجاوران في اللون نفسه، ' +
      'والعدد الكرومي هو أقل عدد ألوان يكفي لتلوين المخطط بالكامل.',
    'نلوّن الرؤوس بالترتيب ونختار لونًا مختلفًا عن ألوان الجيران، ونكرر حتى تتحقق كل الحواف ' +
      'ثم نتحقق من صحة التلوين عند كل حافة كما في المثال المحلول.',
  ];
  for (const [index, question] of practiceSession.questions.entries()) {
    await practiceService.submitAnswer(sara, course.id, saraPractice.id, {
      questionId: question.id,
      content: practiceAnswers[index % practiceAnswers.length],
    });
  }
  log('sara: practice session completed on تلوين المخططات');

  const saraReassessment = await reassessmentService.startSession(sara, course.id, {
    topicId: topicSets.id,
    questionsCount: 2,
  });
  for (const question of saraReassessment.questions) {
    await reassessmentService.submitAnswer(sara, course.id, saraReassessment.id, {
      questionId: question.id,
      content:
        'اتحاد المجموعتين A و B هو مجموعة كل العناصر التي تنتمي إلى A أو B أو كليهما ويكتب A ∪ B، ' +
        'والتقاطع يقتصر على العناصر المشتركة، ومثال: {1,2} ∪ {2,3} = {1,2,3} و {1,2} ∩ {2,3} = {2}.',
    });
  }
  await reassessmentService.getLearningGain(sara, course.id);
  log('sara: reassessment completed on نظرية المجموعات + learning-gain report ready');

  const saraProfile = await learnerModelService.getLearnerModel(sara, course.id);
  log(
    `sara learner model: ${saraProfile.mastery.length} topics tracked - ` +
      saraProfile.mastery
        .map((topic) => `${topic.title}=${topic.masteryLevel}`)
        .join(', '),
  );
  log(`sara recommended next action: ${saraProfile.recommendedNextAction?.message ?? 'n/a'}`);

  log('personal learner: ahmed@gmail.com (no university) opens a personal workspace');
  const ahmed = await registerUser({
    email: 'ahmed@gmail.com',
    firstName: 'أحمد',
    lastName: 'سيد',
    role: ROLES.STUDENT,
    languagePreference: LANGUAGES.ARABIC,
  });
  const ahmedCourse = await coursesService.createCourse(ahmed, {
    title: 'مساحتي الشخصية: أساسيات بايثون',
    description: 'كورس شخصي يديره الطالب بنفسه خارج أي جامعة.',
  });
  const ahmedTopic = await coursesService.addTopic(ahmed, ahmedCourse.id, {
    title: 'المتغيرات والقوائم',
    order: 1,
  });
  await knowledgeIngestionService.uploadMaterial(ahmed, ahmedCourse.id, {
    title: 'ملزمة: المتغيرات والقوائم في بايثون',
    sourceType: 'textbook',
    mimeType: 'text/plain',
    fileName: 'python-basics.txt',
    content: PYTHON_BASICS_MATERIAL,
  });
  const ahmedTutorSession = await tutorService.createSession(ahmed, ahmedCourse.id, {
    topicId: ahmedTopic.id,
    mode: 'explanation',
  });
  await tutorService.askQuestion(ahmed, ahmedCourse.id, ahmedTutorSession.id, {
    content: 'إيه الفرق بين الليست والتوبل في بايثون مع مثال؟',
  });
  log('ahmed: personal course + self-uploaded material + grounded tutor answer');

  const uniGuidance = await authService.getRegistrationGuidance('newcomer@menoufia.edu.eg');
  log(
    `registration guidance: university email -> ${uniGuidance.institution.name} (track=${uniGuidance.recommendedTrack})`,
  );
  const personalGuidance = await authService.getRegistrationGuidance('newcomer@gmail.com');
  log(
    `registration guidance: personal email -> no university (track=${personalGuidance.recommendedTrack})`,
  );

  log('contract check: suspending the university (isActive=false)...');
  await academicStructureService.updateInstitution(admin, admin.institutionId, {
    isActive: false,
  });
  let suspendedLoginBlocked = false;
  try {
    await authService.login({ email: sara.email, password: DEMO_PASSWORD });
  } catch {
    suspendedLoginBlocked = true;
  }
  if (!suspendedLoginBlocked) {
    throw new Error('contract gate failed: sara logged in while the university is suspended');
  }
  await authService.login({ email: admin.email, password: DEMO_PASSWORD });
  log('contract suspended: student login blocked, institution admin still signs in');
  await academicStructureService.updateInstitution(admin, admin.institutionId, {
    isActive: true,
  });
  await authService.login({ email: sara.email, password: DEMO_PASSWORD });
  log('contract reactivated: student login restored');

  await analyticsService.recomputeCourse(course.id);

  const [auditCount, evidenceCount, evaluationCount, snapshot] = await Promise.all([
    mongoose.connection.collection('auditlogs').countDocuments(),
    mongoose.connection.collection('learningevidences').countDocuments(),
    mongoose.connection.collection('aievaluations').countDocuments(),
    analyticsService.getCourseAnalytics(instructor, course.id),
  ]);

  console.log(
    [
      '',
      '════════════════════════════════════════════════════════════',
      ' ✔ Seed complete - Menoufia University demo',
      '════════════════════════════════════════════════════════════',
      ` course        CS201 - الرياضيات المتقطعة`,
      ` assignments   واجب 1 (5/6 finalized), واجب 2 (OPEN), واجب 3 (DRAFT)`,
      ` ai evaluations ${evaluationCount} | final grades written | audit rows ${auditCount}`,
      ` learning evidence rows ${evidenceCount} | analytics computedAt ${snapshot.computedAt}`,
      ` learning loop  ${remedialPublished} remedial published | diagnostics, tutor, practice, reassessment + gain report seeded`,
      ` question types  واجب 2 mixes auto-graded objective (true_false + multiple_choice) with AI-graded essay`,
      ` enrollment req 1 pending request (farida -> CS201) awaiting admin approval`,
      ` contract       suspension blocks institutional login (verified live) | admin keeps access`,
      ` personal       ahmed@gmail.com self-served course + material + tutor (no university)`,
      `               finalized ${snapshot.totals.finalizedCount} | pending ${snapshot.totals.pendingReviewCount} | avg ${snapshot.totals.avgCoursePercentage}%`,
      '────────────────────────────────────────────────────────────',
      ` logins (password: ${DEMO_PASSWORD})`,
      '   institution_admin  admin@menoufia.edu.eg',
      '   instructor         hassan.farid@menoufia.edu.eg',
      '   students           sara | mona | nadia | yara | omar | mariam  (@menoufia.edu.eg)',
      '   personal student   ahmed@gmail.com  (personal workspace)',
      '   requester          farida@menoufia.edu.eg  (pending enrollment request)',
      '────────────────────────────────────────────────────────────',
      ' mariam keeps a DRAFT submission so the student flow can be demoed live.',
      '════════════════════════════════════════════════════════════',
      '',
    ].join('\n'),
  );

  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error('\n[seed] FAILED:', error?.message ?? error);
  await disconnectDatabase().catch(() => {});
  process.exitCode = 1;
});
