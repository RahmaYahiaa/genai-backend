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
  'Lecture on set theory. A set is a collection of distinct objects with no ordering. ' +
  'The intersection of two sets A and B is the set of elements common to both, written A ∩ B. ' +
  'The union is the set of all elements that belong to A or B or both, written A ∪ B. ' +
  "De Morgan's laws relate union and intersection through complementation: the complement of a union equals the intersection of the complements. " +
  'Worked example: if A = {1,2,3} and B = {2,3,4} then A ∩ B = {2,3} and A ∪ B = {1,2,3,4}.';

const GRAPH_THEORY_MATERIAL =
  'Lecture on graph theory. A graph G = (V, E) consists of a vertex set V and an edge set E. ' +
  'A path is a chain of consecutive edges between two vertices, and a cycle is a closed path that returns to its start. ' +
  'A connected graph has at least one path between every pair of vertices. A tree is a connected graph with no cycles and exactly n-1 edges. ' +
  'Worked example: model a transport network as vertices and edges, then verify connectivity between all stations using breadth-first search.';

const COLORING_MATERIAL =
  'Lecture on graph coloring. A coloring assigns colors to vertices so that no two adjacent vertices share the same color. ' +
  'The chromatic number χ(G) is the smallest number of colors that suffices to color the graph. ' +
  'The four color theorem states that every planar graph can be colored with at most four colors. ' +
  'Worked example: color a small planar graph vertex by vertex, checking every edge after each assignment.';

const SCHEDULING_MATERIAL =
  'Lecture on CPU scheduling. The scheduler decides which ready process runs next on the CPU. ' +
  'First-come first-served runs processes in arrival order, while shortest-job-first picks the process with the smallest next CPU burst. ' +
  'Round robin gives every process a fixed time quantum and preempts it when the quantum expires. ' +
  'Worked example: three processes with bursts 5, 2 and 1 under shortest-job-first finish in the order 1, 2, 5 giving an average waiting time of 3.';

const DEADLOCKS_MATERIAL =
  'Lecture on deadlocks. A deadlock is a set of processes each waiting for a resource held by another member of the set. ' +
  'The four Coffman conditions are mutual exclusion, hold and wait, no preemption and circular wait. ' +
  'The resource allocation graph detects cycles, and the banker algorithm avoids unsafe states before granting a request. ' +
  'Worked example: two processes holding one printer and one scanner each while requesting the other device form a circular wait.';

const PYTHON_BASICS_MATERIAL =
  'Handout on Python basics. A variable is a name bound to a value created directly by assignment without declaring a type. ' +
  'A list is an ordered mutable sequence written with square brackets such as [1, 2, 3], while a tuple is ordered but immutable and written with parentheses such as (1, 2, 3). ' +
  'A function is defined with the def keyword and may accept parameters and return a value with return. ' +
  'Worked example: a sum function that takes two lists and returns the sum of their elements using a for loop and the built-in sum function.';

const GOOD_INTERSECTION_ANSWER =
  'The intersection of two sets A and B is the set of all elements common to both, denoted A ∩ B. ' +
  'Worked example: if A = {1,2,3} and B = {2,3,4} then A ∩ B = {2,3} because only 2 and 3 belong to both sets, ' +
  'exactly as defined in the lecture and its worked example.';

const GOOD_UNION_ANSWER =
  'The union collects all elements of both sets together, while the intersection keeps only the elements common to both.';

const PROOF_ANSWER =
  'By the four color theorem every planar graph is colorable with at most four colors; we color the vertices one by one, ' +
  'choosing a color different from all already-colored neighbors until every edge is satisfied.';

const WEAK_ANSWER = 'I do not know how to prove this.';

const SCHEDULING_ANSWER =
  'Round robin assigns a fixed time quantum to each ready process and preempts the running process when the quantum expires, ' +
  'so short jobs do not wait behind long ones as they do under first-come first-served.';

const DEADLOCK_ANSWER =
  'A circular wait exists in the example because process P1 holds the printer and requests the scanner while process P2 holds the scanner and requests the printer, ' +
  'closing a cycle in the resource allocation graph.';

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
    firstName: 'Mona',
    lastName: 'Abdelrahman',
    role: ROLES.INSTITUTION_ADMIN,
    institutionName: INSTITUTION_NAME,
    emailDomains: [EMAIL_DOMAIN],
    allowSelfRegistration: true,
    languagePreference: LANGUAGES.ENGLISH,
  });

  const faculty = await academicStructureService.createUnit(admin, {
    type: 'faculty',
    name: 'Faculty of Computers and Information',
    code: 'FCI-MN',
  });
  const department = await academicStructureService.createUnit(admin, {
    type: 'department',
    name: 'Computer Science Department',
    code: 'CS-MN',
    parentId: faculty.id,
  });
  await academicStructureService.createUnit(admin, {
    type: 'program',
    name: 'BSc Computer Science Program',
    code: 'BSC-CS-MN',
    parentId: department.id,
  });
  await academicStructureService.createUnit(admin, {
    type: 'semester',
    name: 'Fall 2026 Semester',
    code: 'FALL-2026',
    parentId: department.id,
  });
  log('academic units: faculty > department > program > semester');

  const instructor = await registerUser({
    email: 'hassan.farid@menoufia.edu.eg',
    firstName: 'Hassan',
    lastName: 'Farid',
    role: ROLES.INSTRUCTOR,
    institutionId: admin.institutionId,
    languagePreference: LANGUAGES.ENGLISH,
  });

  const studentSeed = [
    ['sara.mitchell@gmail.com', 'Sara', 'Mitchell'],
    ['mona.reyes@gmail.com', 'Mona', 'Reyes'],
    ['nadia.khalil@gmail.com', 'Nadia', 'Khalil'],
    ['yara.hansen@gmail.com', 'Yara', 'Hansen'],
    ['omar.diaz@gmail.com', 'Omar', 'Diaz'],
    ['mariam.taleb@gmail.com', 'Mariam', 'Taleb'],
  ];
  const students = [];
  for (const [email, firstName, lastName] of studentSeed) {
    students.push(
      await registerUser({
        email,
        firstName,
        lastName,
        role: ROLES.STUDENT,
        languagePreference: LANGUAGES.ENGLISH,
      }),
    );
  }
  const [sara, mona, nadia, yara, omar, mariam] = students;
  log('students registered as personal-track learners (no university affiliation)');

  const course = await coursesService.createCourse(admin, {
    title: 'Discrete Mathematics',
    code: 'CS201',
  });
  await coursesService.addStaff(admin, course.id, {
    userId: instructor.id,
    role: COURSE_STAFF_ROLES.INSTRUCTOR,
  });
  for (const student of students) {
    await coursesService.enroll(admin, course.id, student.id);
  }
  log(`course ready: CS201 - Discrete Mathematics (1 instructor, ${students.length} students)`);

  const osCourse = await coursesService.createCourse(admin, {
    title: 'Operating Systems',
    code: 'CS301',
  });
  await coursesService.addStaff(admin, osCourse.id, {
    userId: instructor.id,
    role: COURSE_STAFF_ROLES.INSTRUCTOR,
  });
  for (const student of [sara, mona, nadia, omar]) {
    await coursesService.enroll(admin, osCourse.id, student.id);
  }
  log('course ready: CS301 - Operating Systems (1 instructor, 4 students)');

  const requester = await registerUser({
    email: 'farida@menoufia.edu.eg',
    firstName: 'Farida',
    lastName: 'Mohamed',
    role: ROLES.STUDENT,
    institutionId: admin.institutionId,
    languagePreference: LANGUAGES.ENGLISH,
  });
  await coursesService.requestEnrollment(requester, course.id, {
    note: 'I would like to join this course as an elective.',
  });
  log('enrollment request: farida -> CS201 (pending admin approval)');

  const topicSets = await coursesService.addTopic(instructor, course.id, {
    title: 'Set Theory',
    order: 1,
  });
  const topicGraphs = await coursesService.addTopic(instructor, course.id, {
    title: 'Graph Theory',
    order: 2,
  });
  const topicColoring = await coursesService.addTopic(instructor, course.id, {
    title: 'Graph Coloring',
    order: 3,
  });
  const topicScheduling = await coursesService.addTopic(instructor, osCourse.id, {
    title: 'CPU Scheduling',
    order: 1,
  });
  const topicDeadlocks = await coursesService.addTopic(instructor, osCourse.id, {
    title: 'Deadlocks',
    order: 2,
  });
  await coursesService.addTopic(instructor, osCourse.id, {
    title: 'Memory Management',
    order: 3,
  });

  await knowledgeIngestionService.uploadMaterial(instructor, course.id, {
    title: 'Lecture 1: Set Theory',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'lecture-01-sets.txt',
    content: SET_THEORY_MATERIAL,
  });
  await knowledgeIngestionService.uploadMaterial(instructor, course.id, {
    title: 'Lecture 2: Graph Theory',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'lecture-02-graphs.txt',
    content: GRAPH_THEORY_MATERIAL,
  });
  await knowledgeIngestionService.uploadMaterial(instructor, course.id, {
    title: 'Lecture 3: Graph Coloring',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'lecture-03-coloring.txt',
    content: COLORING_MATERIAL,
  });
  await knowledgeIngestionService.uploadMaterial(instructor, osCourse.id, {
    title: 'Lecture 1: CPU Scheduling',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'os-lecture-01-scheduling.txt',
    content: SCHEDULING_MATERIAL,
  });
  await knowledgeIngestionService.uploadMaterial(instructor, osCourse.id, {
    title: 'Lecture 2: Deadlocks',
    sourceType: 'lecture_notes',
    mimeType: 'text/plain',
    fileName: 'os-lecture-02-deadlocks.txt',
    content: DEADLOCKS_MATERIAL,
  });
  log('materials uploaded and READY: 3 CS201 lectures + 2 CS301 lectures chunked + embedded');

  const hw1 = await assignmentsService.createAssignment(instructor, course.id, {
    title: 'Assignment 1: Set Theory',
  });
  const q1 = await assignmentsService.addQuestion(instructor, hw1.id, {
    questionText: 'Define the intersection of two sets and give a worked example.',
    topicId: topicSets.id,
    maxScore: 10,
    modelAnswer: 'The intersection of A and B is the set of elements common to both; example: {1,2} ∩ {2,3} = {2}.',
    rubricText: '4 points for the definition, 4 for the worked example, 2 for correct notation.',
  });
  const q2 = await assignmentsService.addQuestion(instructor, hw1.id, {
    questionText: 'Explain the union of two sets and how it differs from the intersection.',
    topicId: topicSets.id,
    maxScore: 10,
  });
  const q3 = await assignmentsService.addQuestion(instructor, hw1.id, {
    questionText: 'Discuss the four color theorem and its significance for planar graphs.',
    topicId: topicColoring.id,
    maxScore: 10,
    modelAnswer: 'Four color theorem: every planar graph is colorable with at most four colors.',
    rubricText: '5 points for stating the theorem, 5 for discussing its significance.',
  });
  await assignmentsService.publishAssignment(instructor, hw1.id);
  log('assignment 1 published: Assignment 1: Set Theory (3 essay questions, total 30)');

  await submissionsService.autosaveAnswer(sara, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.submitAssignment(sara, hw1.id);
  await submissionsService.autosaveAnswer(mona, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.autosaveAnswer(mona, hw1.id, q2.id, { answerText: GOOD_UNION_ANSWER });
  await submissionsService.submitAssignment(mona, hw1.id);
  await submissionsService.autosaveAnswer(nadia, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.autosaveAnswer(nadia, hw1.id, q3.id, { answerText: WEAK_ANSWER });
  await submissionsService.submitAssignment(nadia, hw1.id);
  await submissionsService.autosaveAnswer(yara, hw1.id, q1.id, { answerText: GOOD_INTERSECTION_ANSWER });
  await submissionsService.submitAssignment(yara, hw1.id);
  await submissionsService.autosaveAnswer(omar, hw1.id, q1.id, { answerText: WEAK_ANSWER });
  await submissionsService.submitAssignment(omar, hw1.id);
  await submissionsService.autosaveAnswer(mariam, hw1.id, q1.id, { answerText: GOOD_UNION_ANSWER });
  log('5 submissions sent + mariam keeps a DRAFT - waiting for the AI grading queue...');

  const saraSubmission = await waitForGraded(sara, hw1.id);
  await waitForGraded(mona, hw1.id);
  const nadiaSubmission = await waitForGraded(nadia, hw1.id);
  const yaraSubmission = await waitForGraded(yara, hw1.id);
  const omarSubmission = await waitForGraded(omar, hw1.id);
  log('all CS201 assignment 1 submissions GRADED');

  const hw1Review = await reviewService.getReview(instructor, hw1.id, { limit: 100 });
  const wantedFast = new Set([saraSubmission.id, yaraSubmission.id]);
  const fastIds = hw1Review.fastTrack
    .map((row) => row.submission.id)
    .filter((id) => wantedFast.has(id));
  if (fastIds.length > 0) {
    const bulk = await reviewService.bulkApprove(instructor, hw1.id, {
      submissionIds: fastIds,
    });
    log(`bulk approved (fast track): ${bulk.approved.length} submissions`);
  } else {
    log('WARN no fast-track rows (LLM confidence below HIGH) - bulk approve skipped, those submissions stay pending');
  }

  await reviewService.editSubmission(instructor, (await submissionsService.getStudentAssignmentView(mona, hw1.id)).submission.id, {
    score: 14,
    feedback: 'The definition is excellent, but the union answer needs more detail and a worked example.',
  });
  log('mona: edited final score 14/30');

  await reviewService.rejectSubmission(instructor, omarSubmission.id, {
    score: 2,
    feedback: 'Manual review: the answer does not address the question; effort points only.',
  });
  log('omar: rejected and graded manually 2/30');

  await reviewService.requestResubmission(instructor, nadiaSubmission.id, {
    reason: 'Please rewrite the coloring answer with the proof steps and the notation explained.',
  });
  log('nadia: resubmission requested (attempt 2 opened)');

  await submitAnswer(nadia, hw1.id, q3.id, PROOF_ANSWER);
  const nadiaResubmitted = await waitForGraded(nadia, hw1.id, 'RESUBMISSION_REQUESTED');
  await reviewService.approveSubmission(instructor, nadiaResubmitted.id);
  log('nadia: resubmitted, approved by AI grades');

  const hw2 = await assignmentsService.createAssignment(instructor, course.id, {
    title: 'Assignment 2: Graph Theory',
  });
  const tfQuestion = await assignmentsService.addQuestion(instructor, hw2.id, {
    questionText: 'Every cycle in a graph is a path, and the converse also holds.',
    topicId: topicGraphs.id,
    maxScore: 5,
    questionType: 'true_false',
    correctAnswer: false,
  });
  const mcqQuestion = await assignmentsService.addQuestion(instructor, hw2.id, {
    questionText: 'Which of the following guarantees that a graph with n vertices is connected?',
    topicId: topicGraphs.id,
    maxScore: 5,
    questionType: 'multiple_choice',
    options: [
      { text: 'At least n-1 edges with a path between every pair of vertices' },
      { text: 'A self loop on every vertex' },
      { text: 'All vertices isolated' },
      { text: 'Fewer than n-1 edges' },
    ],
    correctOptionIndexes: [0],
  });
  const hw2Essay = await assignmentsService.addQuestion(instructor, hw2.id, {
    questionText: 'Distinguish between a path and a cycle in a graph with an example of each.',
    topicId: topicGraphs.id,
    maxScore: 10,
    modelAnswer: 'A path is a chain of consecutive edges between two vertices; a cycle is a closed path returning to its start.',
    rubricText: '5 points per definition with its example.',
  });
  await assignmentsService.publishAssignment(instructor, hw2.id);

  const tfFalseOption = tfQuestion.options.find((option) => /false/i.test(option.text)) ?? tfQuestion.options[1];
  const tfTrueOption = tfQuestion.options.find((option) => /true/i.test(option.text)) ?? tfQuestion.options[0];
  await submissionsService.autosaveAnswer(sara, hw2.id, tfQuestion.id, { selectedOptionIds: [tfFalseOption.id] });
  await submissionsService.autosaveAnswer(sara, hw2.id, mcqQuestion.id, { selectedOptionIds: [mcqQuestion.options[0].id] });
  await submissionsService.autosaveAnswer(sara, hw2.id, hw2Essay.id, { answerText: GOOD_UNION_ANSWER });
  await submissionsService.submitAssignment(sara, hw2.id);
  await waitForGraded(sara, hw2.id);
  await submissionsService.autosaveAnswer(mona, hw2.id, tfQuestion.id, { selectedOptionIds: [tfTrueOption.id] });
  await submissionsService.autosaveAnswer(mona, hw2.id, mcqQuestion.id, { selectedOptionIds: [mcqQuestion.options[2].id] });
  await submissionsService.autosaveAnswer(mona, hw2.id, hw2Essay.id, { answerText: WEAK_ANSWER });
  await submissionsService.submitAssignment(mona, hw2.id);
  await waitForGraded(mona, hw2.id);
  log('assignment 2 OPEN: true_false + multiple_choice (auto-graded) + essay (AI) - sara correct, mona wrong on both objective items');

  const hw3 = await assignmentsService.createAssignment(instructor, course.id, {
    title: 'Assignment 3: Graph Coloring',
  });
  await assignmentsService.addQuestion(instructor, hw3.id, {
    questionText: 'Apply the coloring algorithm to a small planar graph and prove the result correct.',
    topicId: topicColoring.id,
    maxScore: 20,
  });
  log('assignment 3 stays DRAFT');

  const os1 = await assignmentsService.createAssignment(instructor, osCourse.id, {
    title: 'Assignment 1: CPU Scheduling and Deadlocks',
  });
  const osQ1 = await assignmentsService.addQuestion(instructor, os1.id, {
    questionText: 'Compare round robin with first-come first-served scheduling and give a worked example.',
    topicId: topicScheduling.id,
    maxScore: 10,
    modelAnswer: 'Round robin preempts after a fixed quantum; FCFS runs processes to completion in arrival order.',
    rubricText: '5 points per comparison point with the worked example.',
  });
  const osQ2 = await assignmentsService.addQuestion(instructor, os1.id, {
    questionText: 'Explain the circular wait condition with the printer and scanner example.',
    topicId: topicDeadlocks.id,
    maxScore: 10,
  });
  await assignmentsService.publishAssignment(instructor, os1.id);

  await submissionsService.autosaveAnswer(sara, os1.id, osQ1.id, { answerText: SCHEDULING_ANSWER });
  await submissionsService.autosaveAnswer(sara, os1.id, osQ2.id, { answerText: DEADLOCK_ANSWER });
  await submissionsService.submitAssignment(sara, os1.id);
  const saraOs = await waitForGraded(sara, os1.id);
  await reviewService.approveSubmission(instructor, saraOs.id);
  await submissionsService.autosaveAnswer(mona, os1.id, osQ1.id, { answerText: SCHEDULING_ANSWER });
  await submissionsService.submitAssignment(mona, os1.id);
  await waitForGraded(mona, os1.id);
  await submissionsService.autosaveAnswer(omar, os1.id, osQ2.id, { answerText: WEAK_ANSWER });
  await submissionsService.submitAssignment(omar, os1.id);
  await waitForGraded(omar, os1.id);
  log('CS301 assignment 1: sara FINALIZED, mona + omar pending review');

  await assignmentsService.setGradeVisibility(instructor, hw1.id, { showGradeToStudent: true });
  await assignmentsService.setGradeVisibility(instructor, os1.id, { showGradeToStudent: true });
  await assignmentsService.setFeedbackVisibility(instructor, hw1.id, { showFeedbackToStudent: true });
  log('visibility: grades ON for CS201 hw1 + CS301 os1, human feedback ON for hw1 only (feedback stays hidden by default elsewhere)');

  let remedialPublished = 0;
  try {
    const practiceRemedial = await remedialService.generateDraft(instructor, course.id, {
      origin: 'STANDALONE',
      topicId: topicGraphs.id,
      contentType: 'EXTRA_PRACTICE_QUESTIONS',
      instructions: 'Focus on the difference between paths, cycles and trees',
    });
    await remedialService.publishRemedial(instructor, course.id, practiceRemedial.id, {
      audienceType: 'ALL_STUDENTS',
    });
    remedialPublished += 1;
    log('remedial published: ALL_STUDENTS (graphs practice)');
  } catch (error) {
    log(`WARN standalone remedial skipped: ${error.message}`);
  }
  const reportedCodes = [
    ...new Set(
      [...hw1Review.fastTrack, ...hw1Review.needsReview]
        .flatMap((row) => row.answers ?? [])
        .flatMap((answer) => answer.misconceptions ?? [])
        .map((misconception) => misconception?.code)
        .filter(Boolean),
    ),
  ];
  if (reportedCodes.length > 0) {
    try {
      const offTopicRemedial = await remedialService.generateDraft(instructor, course.id, {
        origin: 'FROM_MISCONCEPTION',
        assignmentId: hw1.id,
        misconceptionCode: reportedCodes[0],
        contentType: 'FOCUSED_EXPLANATION_WITH_EXAMPLE',
      });
      await remedialService.publishRemedial(instructor, course.id, offTopicRemedial.id, {
        audienceType: 'AFFECTED_STUDENTS',
      });
      remedialPublished += 1;
      log(`remedial published: AFFECTED_STUDENTS (${reportedCodes[0]})`);
    } catch (error) {
      log(`WARN misconception remedial skipped: ${error.message}`);
    }
  } else {
    log('WARN no AI-reported misconception codes in the hw1 review - misconception remedial skipped');
  }

  log('learning loop: diagnostics, tutor, practice, reassessment for the students...');

  try {
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
          'The intersection of two sets A and B is the set of all elements common to both, denoted A ∩ B, ' +
          'for example {1,2} ∩ {2,3} = {2} as in the lecture.',
      });
    }
    log('sara: diagnostic completed on Set Theory (evidence written)');
  } catch (error) {
    log(`WARN sara diagnostic skipped: ${error.message}`);
  }

  try {
    const monaDiagnostic = await learnerDiagnosticService.startDiagnostic(mona, course.id, {
      topicIds: [topicGraphs.id],
      questionsPerTopic: 2,
    });
    const monaQuestions = await learnerDiagnosticService.getDiagnostic(mona, course.id, monaDiagnostic.id);
    await learnerDiagnosticService.submitAnswer(mona, course.id, monaDiagnostic.id, {
      questionId: monaQuestions.questions[0].id,
      content: 'I do not remember anything about this topic.',
    });
    for (const question of monaQuestions.questions.slice(1)) {
      await learnerDiagnosticService.submitAnswer(mona, course.id, monaDiagnostic.id, {
        questionId: question.id,
        content:
          'A path is a chain of consecutive edges between two vertices, and a cycle is a closed path that returns to its start, ' +
          'for example the triangle between three vertices.',
      });
    }
    log('mona: diagnostic completed on Graph Theory (one weak answer, one strong)');
  } catch (error) {
    log(`WARN mona diagnostic skipped: ${error.message}`);
  }

  try {
    const monaTutorSession = await tutorService.createSession(mona, course.id, {
      topicId: topicGraphs.id,
      mode: 'explanation',
    });
    await tutorService.askQuestion(mona, course.id, monaTutorSession.id, {
      content: 'What is the difference between a path and a cycle in a graph, with an example?',
    });
    log('mona: tutor session answered from the trusted lecture (grounded + cited)');
  } catch (error) {
    log(`WARN mona tutor session skipped: ${error.message}`);
  }

  try {
    const saraPractice = await practiceService.startSession(sara, course.id, {
      topicId: topicColoring.id,
      questionsCount: 2,
    });
    const practiceSession = await practiceService.getSession(sara, course.id, saraPractice.id);
    const practiceAnswers = [
      'A graph coloring assigns colors to vertices so that no two adjacent vertices share the same color, ' +
        'and the chromatic number is the smallest number of colors that suffices to color the whole graph.',
      'We color the vertices in order, picking a color different from all colored neighbors, repeating until every edge ' +
        'is satisfied, then we verify the coloring edge by edge as in the worked example.',
    ];
    for (const [index, question] of practiceSession.questions.entries()) {
      await practiceService.submitAnswer(sara, course.id, saraPractice.id, {
        questionId: question.id,
        content: practiceAnswers[index % practiceAnswers.length],
      });
    }
    log('sara: practice session completed on Graph Coloring');
  } catch (error) {
    log(`WARN sara practice skipped: ${error.message}`);
  }

  try {
    const saraReassessment = await reassessmentService.startSession(sara, course.id, {
      topicId: topicSets.id,
      questionsCount: 2,
    });
    for (const question of saraReassessment.questions) {
      await reassessmentService.submitAnswer(sara, course.id, saraReassessment.id, {
        questionId: question.id,
        content:
          'The union of two sets A and B is the set of all elements that belong to A or B or both, written A ∪ B, ' +
          'while the intersection keeps only the common elements; example: {1,2} ∪ {2,3} = {1,2,3} and {1,2} ∩ {2,3} = {2}.',
      });
    }
    await reassessmentService.getLearningGain(sara, course.id);
    log('sara: reassessment completed on Set Theory + learning-gain report ready');
  } catch (error) {
    log(`WARN sara reassessment skipped: ${error.message}`);
  }

  try {
    const saraProfile = await learnerModelService.getLearnerModel(sara, course.id);
    log(
      `sara learner model: ${saraProfile.mastery.length} topics tracked - ` +
        saraProfile.mastery
          .map((topic) => `${topic.title}=${topic.masteryLevel}`)
          .join(', '),
    );
    log(`sara recommended next action: ${saraProfile.recommendedNextAction?.message ?? 'n/a'}`);
  } catch (error) {
    log(`WARN sara learner model skipped: ${error.message}`);
  }

  log('personal learner: adam.hayes@gmail.com (no university) opens a personal workspace');
  const adam = await registerUser({
    email: 'adam.hayes@gmail.com',
    firstName: 'Adam',
    lastName: 'Hayes',
    role: ROLES.STUDENT,
    languagePreference: LANGUAGES.ENGLISH,
  });
  const adamCourse = await coursesService.createCourse(adam, {
    title: 'My Personal Space: Python Basics',
    description: 'A personal course managed by the student outside any university.',
  });
  const adamTopic = await coursesService.addTopic(adam, adamCourse.id, {
    title: 'Variables and Lists',
    order: 1,
  });
  await knowledgeIngestionService.uploadMaterial(adam, adamCourse.id, {
    title: 'Handout: Variables and Lists in Python',
    sourceType: 'textbook',
    mimeType: 'text/plain',
    fileName: 'python-basics.txt',
    content: PYTHON_BASICS_MATERIAL,
  });
  try {
    const adamTutorSession = await tutorService.createSession(adam, adamCourse.id, {
      topicId: adamTopic.id,
      mode: 'explanation',
    });
    await tutorService.askQuestion(adam, adamCourse.id, adamTutorSession.id, {
      content: 'What is the difference between a list and a tuple in Python, with an example?',
    });
    log('adam: personal course + self-uploaded material + grounded tutor answer');
  } catch (error) {
    log(`WARN adam tutor session skipped: ${error.message}`);
  }

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
    await authService.login({ email: requester.email, password: DEMO_PASSWORD });
  } catch {
    suspendedLoginBlocked = true;
  }
  if (!suspendedLoginBlocked) {
    throw new Error('contract gate failed: farida logged in while the university is suspended');
  }
  await authService.login({ email: admin.email, password: DEMO_PASSWORD });
  await authService.login({ email: sara.email, password: DEMO_PASSWORD });
  log('contract suspended: university-track login blocked while personal-track students still sign in');
  await academicStructureService.updateInstitution(admin, admin.institutionId, {
    isActive: true,
  });
  await authService.login({ email: requester.email, password: DEMO_PASSWORD });
  log('contract reactivated: university login restored');

  await analyticsService.recomputeCourse(course.id);
  await analyticsService.recomputeCourse(osCourse.id);

  const [auditCount, evidenceCount, evaluationCount, snapshot, osSnapshot] = await Promise.all([
    mongoose.connection.collection('auditlogs').countDocuments(),
    mongoose.connection.collection('learningevidences').countDocuments(),
    mongoose.connection.collection('aievaluations').countDocuments(),
    analyticsService.getCourseAnalytics(instructor, course.id),
    analyticsService.getCourseAnalytics(instructor, osCourse.id),
  ]);

  console.log(
    [
      '',
      '════════════════════════════════════════════════════════════',
      ' ✔ Seed complete - English dataset covering every feature',
      '════════════════════════════════════════════════════════════',
      ` courses       CS201 Discrete Mathematics | CS301 Operating Systems`,
      ` assignments   CS201: hw1 decided mix, hw2 OPEN (tf+mcq+essay), hw3 DRAFT | CS301: os1 OPEN`,
      ` students      6 personal-track learners (no university) + farida (university, pending request)`,
      ` ai evaluations ${evaluationCount} | final grades written | audit rows ${auditCount}`,
      ` learning evidence rows ${evidenceCount} | snapshots CS201 ${snapshot.computedAt} | CS301 ${osSnapshot.computedAt}`,
      ` learning loop  ${remedialPublished} remedial published | diagnostics, tutor, practice, reassessment + gain report seeded`,
      ` visibility    grades ON (hw1, os1) | human feedback ON (hw1) | feedback hidden by default elsewhere`,
      ` enrollment    1 pending request (farida -> CS201) awaiting admin approval`,
      ` contract      suspension blocks university login, personal-track students unaffected (verified live)`,
      ` personal      adam.hayes@gmail.com self-served course + material + tutor (no university)`,
      `               CS201 finalized ${snapshot.totals.finalizedCount} | pending ${snapshot.totals.pendingReviewCount} | avg ${snapshot.totals.avgCoursePercentage}%`,
      `               CS301 finalized ${osSnapshot.totals.finalizedCount} | pending ${osSnapshot.totals.pendingReviewCount} | avg ${osSnapshot.totals.avgCoursePercentage}%`,
      '────────────────────────────────────────────────────────────',
      ` logins (password: ${DEMO_PASSWORD})`,
      '   institution_admin  admin@menoufia.edu.eg',
      '   instructor         hassan.farid@menoufia.edu.eg',
      '   students           sara.mitchell | mona.reyes | nadia.khalil | yara.hansen | omar.diaz | mariam.taleb  (@gmail.com)',
      '   personal student   adam.hayes@gmail.com  (personal workspace)',
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
