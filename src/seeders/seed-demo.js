/**
 * Demo activity seeder: fills the platform with realistic course content and
 * student activity by going through the REAL API (same path as the app), so
 * every record is produced by the real pipelines (file parsing, AI topic
 * detection, AI grading, learning evidence, tutor, study tools).
 *
 * Run AFTER `npm run seed -- --reset` and `npm run seed:admin`, with the API
 * server running (and LeRna running, or GROQ_API_KEY set for the fallback):
 *
 *   npm run seed:demo
 *   API_URL=http://localhost:5000/api/v1 npm run seed:demo
 *
 * Safe to re-run: skips steps whose result already exists (by title).
 */
import { readFile } from 'node:fs/promises';

const API = (process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 5000}/api/v1`).replace(/\/$/, '');
const PASSWORD = 'Passw0rd1';
const MATERIALS = new URL('./materials/', import.meta.url);

const log = (message) => console.log(`[seed:demo] ${message}`);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- HTTP ----

async function request(token, method, path, body, { tries = 6 } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(`${API}${path}`, { method, headers, body: payload });
    } catch (error) {
      if (attempt >= tries) throw new Error(`${method} ${path}: API not reachable at ${API} (${error.message})`);
      await sleep(3000);
      continue;
    }
    const json = await response.json().catch(() => ({}));
    // Rate limit or AI provider busy: wait and retry.
    if ((response.status === 429 || response.status === 503 || response.status === 502) && attempt < tries) {
      const wait = 15000 * attempt;
      log(`  ${response.status} on ${method} ${path}, retrying in ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!response.ok) {
      const error = new Error(`${method} ${path} -> ${response.status} ${json?.error?.message ?? ''}`.trim());
      error.status = response.status;
      throw error;
    }
    return json.data ?? json;
  }
}

const items = (data) => (Array.isArray(data) ? data : data?.items ?? []);

async function login(email) {
  const data = await request(null, 'POST', '/auth/login', { email, password: PASSWORD });
  const token = data.accessToken ?? data.tokens?.accessToken;
  if (!token) throw new Error(`login failed for ${email}`);
  const call = (method, path, body, options) => request(token, method, path, body, options);
  call.email = email;
  return call;
}

/** Runs a step; logs and continues on failure so one AI hiccup never aborts the seed. */
async function step(label, fn) {
  try {
    const result = await fn();
    log(`  ok  ${label}`);
    return result;
  } catch (error) {
    log(`  !!  ${label}: ${error.message}`);
    return null;
  }
}

// ----------------------------------------------------------- materials ----

async function uploadFile(call, courseId, title, fileName) {
  const existing = items(await call('GET', `/courses/${courseId}/materials?limit=100`));
  const found = existing.find((m) => m.title === title);
  if (found) return found;
  const buffer = await readFile(new URL(fileName, MATERIALS));
  const type = fileName.endsWith('.pdf') ? 'application/pdf' : 'text/markdown';
  const form = new FormData();
  form.append('file', new Blob([buffer], { type }), fileName);
  form.append('title', title);
  return call('POST', `/courses/${courseId}/materials/file`, form);
}

/** Waits until every file is processed and its topics are detected. */
async function waitForTopics(call, courseId, timeoutMs = 240000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const mats = items(await call('GET', `/courses/${courseId}/materials?limit=100`));
    const busy = mats.filter((m) => m.status === 'processing' || m.status === 'pending' || (m.status === 'ready' && m.topicDetection === 'pending'));
    if (busy.length === 0) {
      const failed = mats.filter((m) => m.topicDetection === 'failed');
      if (failed.length) {
        log(`  topic detection failed for ${failed.length} file(s); asking again`);
        await call('POST', `/courses/${courseId}/topics/detect`).catch(() => null);
      }
      return (await call('GET', `/courses/${courseId}`)).topics ?? [];
    }
    await sleep(4000);
  }
  log('  topics still being detected; continuing');
  return (await call('GET', `/courses/${courseId}`)).topics ?? [];
}

// -------------------------------------------------------- assignments ----

const ASSIGNMENTS = {
  CS301: [
    {
      title: 'Assignment 1: Scheduling and deadlocks',
      publish: true,
      questions: [
        {
          questionType: 'multiple_choice',
          questionText: 'Which scheduling algorithm gives the minimum average waiting time for a given set of processes?',
          options: ['First-Come First-Served', 'Shortest Job First', 'Round Robin', 'Priority scheduling'],
          correctOptionIndexes: [1],
          maxScore: 2,
        },
        {
          questionType: 'true_false',
          questionText: 'A cycle in a resource-allocation graph always means that a deadlock exists, even when resources have several instances.',
          correctAnswer: false,
          maxScore: 2,
        },
        {
          questionType: 'multiple_select',
          questionText: 'Which of the following are necessary conditions for a deadlock? Select all that apply.',
          options: ['Mutual exclusion', 'Hold and wait', 'Preemption', 'Circular wait'],
          correctOptionIndexes: [0, 1, 3],
          maxScore: 3,
        },
        {
          questionType: 'short_answer',
          questionText: 'Explain the convoy effect and name the scheduling algorithm that suffers from it.',
          modelAnswer: 'The convoy effect happens under FCFS: a long CPU-bound process holds the CPU while many short processes wait behind it, which raises the average waiting time and lowers device utilisation.',
          rubricText: '1 point: names FCFS. 2 points: explains that short processes wait behind a long one, increasing waiting time.',
          maxScore: 3,
        },
        {
          questionType: 'long_answer',
          questionText: 'Describe how the Banker\'s algorithm decides whether to grant a resource request. Mention the data structures it uses and what a safe state is.',
          modelAnswer: 'The Banker\'s algorithm keeps Available, Max, Allocation and Need (Need = Max - Allocation). When a process requests resources, the request must not exceed its Need or the Available resources. The algorithm pretends to allocate them and runs the safety algorithm: it looks for an order in which every process can obtain its remaining Need and finish, releasing its allocation. If such a safe sequence exists the state is safe and the request is granted; otherwise the process waits and the old state is restored.',
          rubricText: '2 points: names Available, Max, Allocation and Need. 3 points: explains the trial allocation and safety check. 2 points: defines a safe state as one with a safe sequence where all processes can finish. 1 point: clear writing.',
          maxScore: 8,
        },
      ],
    },
    {
      title: 'Assignment 2: Synchronization',
      publish: false,
      questions: [
        {
          questionType: 'short_answer',
          questionText: 'What three requirements must a solution to the critical-section problem satisfy?',
          modelAnswer: 'Mutual exclusion, progress and bounded waiting.',
          maxScore: 3,
        },
        {
          questionType: 'long_answer',
          questionText: 'Write the producer and consumer code for the bounded-buffer problem using semaphores, and explain the initial value of each semaphore.',
          modelAnswer: 'mutex = 1 protects the buffer, empty = n counts empty slots, full = 0 counts full slots. Producer: wait(empty); wait(mutex); add item; signal(mutex); signal(full). Consumer: wait(full); wait(mutex); remove item; signal(mutex); signal(empty).',
          maxScore: 7,
        },
      ],
    },
  ],
  CS201: [
    {
      title: 'Problem set 1: Sets, logic and graphs',
      publish: true,
      questions: [
        {
          questionType: 'multiple_choice',
          questionText: 'Which statement is logically equivalent to "if p then q"?',
          options: ['if q then p', 'if not p then not q', 'if not q then not p', 'p and not q'],
          correctOptionIndexes: [2],
          maxScore: 2,
        },
        {
          questionType: 'true_false',
          questionText: 'Every planar graph can be colored with at most four colors.',
          correctAnswer: true,
          maxScore: 2,
        },
        {
          questionType: 'short_answer',
          questionText: 'Let A = {1, 2, 3} and B = {2, 3, 4}. Find A union B, A intersection B and A minus B.',
          modelAnswer: 'A union B = {1, 2, 3, 4}; A intersection B = {2, 3}; A minus B = {1}.',
          maxScore: 3,
        },
        {
          questionType: 'problem_solving',
          questionText: 'Use mathematical induction to prove that 1 + 2 + ... + n = n(n + 1)/2 for every positive integer n.',
          modelAnswer: 'Basis: n = 1 gives 1 = 1(2)/2. Inductive step: assume 1 + ... + k = k(k + 1)/2. Then 1 + ... + k + (k + 1) = k(k + 1)/2 + (k + 1) = (k + 1)(k + 2)/2, which is the formula for k + 1. By induction the formula holds for all n >= 1.',
          rubricText: '2 points basis step, 1 point inductive hypothesis stated, 3 points correct algebra in the inductive step, 1 point conclusion.',
          maxScore: 7,
        },
      ],
    },
  ],
};

async function ensureAssignments(call, courseId, code) {
  const existing = items(await call('GET', `/courses/${courseId}/assignments`));
  const created = [];
  for (const spec of ASSIGNMENTS[code] ?? []) {
    let assignment = existing.find((a) => a.title === spec.title);
    if (!assignment) {
      assignment = await call('POST', `/courses/${courseId}/assignments`, { title: spec.title });
      for (const question of spec.questions) {
        const body = { ...question };
        if (body.options) body.options = body.options.map((text) => ({ text }));
        await call('POST', `/assignments/${assignment.id}/questions`, body);
      }
      if (spec.publish) await call('POST', `/assignments/${assignment.id}/publish`);
      log(`  ok  ${code} assignment "${spec.title}" (${spec.questions.length} questions${spec.publish ? ', published' : ', draft'})`);
    }
    created.push({ ...assignment, spec });
  }
  return created;
}

// Student answers for assignment questions, by question text keyword and level.
const ASSIGNMENT_ANSWERS = [
  ['minimum average waiting', { strong: 'Shortest Job First', weak: 'Round Robin' }],
  ['cycle in a resource-allocation graph', { strong: 'False', weak: 'True' }],
  ['necessary conditions for a deadlock', { strong: ['Mutual exclusion', 'Hold and wait', 'Circular wait'], weak: ['Mutual exclusion', 'Preemption', 'Circular wait'] }],
  ['convoy effect', {
    strong: 'The convoy effect appears in FCFS scheduling. When a long CPU-bound process arrives first, all the short processes queue behind it, so the average waiting time becomes large and I/O devices sit idle.',
    weak: 'It is when many processes run together like a convoy. I think it happens in Round Robin.',
  }],
  ["Banker's algorithm", {
    strong: 'The Banker\'s algorithm uses the Available vector and the Max, Allocation and Need matrices, where Need = Max - Allocation. For a request it first checks Request <= Need and Request <= Available. Then it pretends to allocate and runs the safety algorithm, searching for a sequence of processes that can each finish with Work plus what they already hold. If such a safe sequence exists the state is safe and the request is granted; if not, the process must wait and the allocation is rolled back.',
    weak: 'The Banker\'s algorithm gives resources to processes like a bank gives loans. It checks if there are enough resources available and then gives them. A safe state means no deadlock.',
  }],
  ['logically equivalent to "if p then q"', { strong: 'if not q then not p', weak: 'if q then p' }],
  ['planar graph', { strong: 'True', weak: 'True' }],
  ['A = {1, 2, 3}', {
    strong: 'A union B = {1, 2, 3, 4}, A intersection B = {2, 3}, A - B = {1}.',
    weak: 'A union B = {1, 2, 3, 4}, A intersection B = {2, 3}, A - B = {1, 4}.',
  }],
  ['induction', {
    strong: 'Basis: for n = 1, the left side is 1 and the right side is 1(1 + 1)/2 = 1. Inductive hypothesis: assume 1 + 2 + ... + k = k(k + 1)/2 for some k >= 1. Then 1 + ... + k + (k + 1) = k(k + 1)/2 + (k + 1) = (k + 1)(k/2 + 1) = (k + 1)(k + 2)/2, which is the statement for n = k + 1. So by induction it is true for all positive integers n.',
    weak: 'For n = 1 it works because 1 = 1. If it works for k then adding k + 1 to both sides it also works for k + 1, so it is true.',
  }],
];

async function submitAssignment(call, assignmentId, level) {
  const mine = await call('GET', `/assignments/${assignmentId}/result`).catch(() => null);
  if (mine && (mine.status === 'submitted' || mine.status === 'graded' || mine.submittedAt || mine.submission?.submittedAt)) return 'already submitted';
  const assignment = await call('GET', `/assignments/${assignmentId}`);
  const questions = assignment.questions ?? items(await call('GET', `/assignments/${assignmentId}/questions`).catch(() => []));
  for (const question of questions) {
    const text = question.questionText ?? question.text ?? '';
    const entry = ASSIGNMENT_ANSWERS.find(([key]) => text.includes(key));
    if (!entry) continue;
    const answer = entry[1][level];
    const body = (question.options ?? []).length
      ? { selectedOptionIds: (Array.isArray(answer) ? answer : [answer]).map((label) => question.options.find((o) => o.text === label)?.id).filter(Boolean) }
      : { answerText: answer };
    try {
      await call('PUT', `/assignments/${assignmentId}/answers/${question.id}`, body);
    } catch (error) {
      if (error.status === 409) return 'already submitted';
      throw error;
    }
  }
  await call('POST', `/assignments/${assignmentId}/submit`, {});
  return 'submitted';
}

// ------------------------------------------- diagnostic / practice text ----

// Answers keyed by keywords in the question; "strong" = knows it, "weak" = partial.
const TOPIC_ANSWERS = [
  [/schedul|fcfs|round robin|sjf|quantum|convoy|turnaround|waiting time/i, {
    strong: 'Scheduling picks the next ready process. FCFS is simple but causes the convoy effect, SJF gives the minimum average waiting time but needs burst prediction, and Round Robin gives each process a time quantum; a huge quantum behaves like FCFS and a tiny one causes too many context switches.',
    weak: 'The scheduler chooses a process to run. Round Robin gives each process some time. I am not sure about the others.',
  }],
  [/deadlock|banker|circular wait|resource-allocation|safe state/i, {
    strong: 'A deadlock needs mutual exclusion, hold and wait, no preemption and circular wait at the same time. It can be prevented by breaking one condition, avoided with the Banker\'s algorithm that only grants requests keeping the system in a safe state, or detected and recovered from.',
    weak: 'A deadlock is when processes are stuck. I think you can fix it by restarting the computer or killing a process.',
  }],
  [/memory|paging|page|frame|tlb|fragmentation|virtual|thrash|lru|fifo/i, {
    strong: 'Paging splits memory into fixed-size frames and pages, removing external fragmentation. The page table maps pages to frames and the TLB caches translations. On a page fault a replacement algorithm like LRU or FIFO chooses a victim page; thrashing is when the system spends more time paging than executing.',
    weak: 'Paging divides memory into pages. When memory is full, the oldest page is removed. I do not remember what the TLB does.',
  }],
  [/semaphore|mutex|critical section|race|synchroni|producer|consumer|monitor|philosoph|peterson/i, {
    strong: 'A critical-section solution needs mutual exclusion, progress and bounded waiting. A semaphore supports wait, which decrements and may block, and signal, which increments and wakes a waiting process. For the bounded buffer we use mutex = 1, empty = n and full = 0.',
    weak: 'A semaphore is a variable used to lock things so two processes do not run at the same time.',
  }],
  [/file|directory|inode|allocation|raid|disk|seek|journal|fat/i, {
    strong: 'Indexed allocation keeps all block pointers in an index block, so it supports direct access without external fragmentation; UNIX inodes use direct, single, double and triple indirect pointers. Linked allocation avoids fragmentation but direct access is slow.',
    weak: 'Files are stored in blocks on the disk. Contiguous allocation stores them next to each other.',
  }],
  [/set|subset|union|intersection|power set|complement|cartesian|venn/i, {
    strong: 'The union contains elements in either set, the intersection elements in both, and the difference A minus B elements in A but not in B. A set with n elements has 2^n subsets in its power set, and the Cartesian product A x B has |A| * |B| ordered pairs.',
    weak: 'A union is all the elements together and an intersection is the common elements. I forgot how the power set works.',
  }],
  [/graph|vertex|vertices|edge|degree|euler|hamilton|tree|path|cycle|bipartite/i, {
    strong: 'By the handshake theorem the sum of the degrees equals twice the number of edges. A connected graph has an Euler circuit exactly when every vertex has even degree. A tree with n vertices has n - 1 edges, and a graph is bipartite exactly when it has no odd cycle.',
    weak: 'A graph has vertices and edges. An Euler path uses every vertex once, I think.',
  }],
  [/colou?r|chromatic|planar|four color/i, {
    strong: 'The chromatic number is the least number of colors so that adjacent vertices get different colors. Every planar graph can be colored with at most four colors, a bipartite graph needs two, and a complete graph K_n needs n.',
    weak: 'Graph coloring means giving colors to vertices. I think any graph can be colored with three colors.',
  }],
  [/logic|proposition|implication|contrapositive|tautolog|quantifier|predicate|de morgan/i, {
    strong: 'An implication p -> q is false only when p is true and q is false, and it is equivalent to its contrapositive not q -> not p. De Morgan\'s laws say not (p and q) is (not p) or (not q). Negating a universal statement gives an existential one.',
    weak: 'An implication is if p then q. It is the same as if q then p.',
  }],
  [/proof|induction|contradiction|irrational|counterexample/i, {
    strong: 'Induction proves a basis step and then shows that P(k) implies P(k + 1). Proof by contradiction assumes the statement is false and derives a contradiction, as in the proof that the square root of 2 is irrational.',
    weak: 'Induction means checking the first few cases and seeing the pattern.',
  }],
  [/count|permutation|combination|pigeonhole|binomial|choose|arrangement|probability/i, {
    strong: 'Permutations count ordered arrangements, P(n, r) = n!/(n - r)!, and combinations count unordered selections, C(n, r) = n!/(r!(n - r)!). The pigeonhole principle says that N objects in k boxes put at least ceiling(N/k) in some box.',
    weak: 'A combination is when the order matters and a permutation is when it does not.',
  }],
];

function answerFor(questionText, level) {
  const match = TOPIC_ANSWERS.find(([pattern]) => pattern.test(questionText));
  if (!match) return level === 'strong' ? null : 'idk';
  return match[1][level];
}

async function runDiagnostic(call, courseId, profile) {
  const done = items(await call('GET', `/courses/${courseId}/diagnostics`).catch(() => []));
  if (done.some((d) => d.status === 'completed')) return 'already done';
  const diagnostic = await call('POST', `/courses/${courseId}/diagnostics`, { questionsPerTopic: 1 });
  for (const question of diagnostic.questions ?? []) {
    const text = question.prompt ?? question.questionText ?? question.text ?? '';
    const level = profile(text);
    const answer = answerFor(text, level);
    const body = !answer || answer === 'idk'
      ? { questionId: question.id, responseMode: 'idk', content: '' }
      : { questionId: question.id, content: answer };
    await call('POST', `/courses/${courseId}/diagnostics/${diagnostic.id}/answers`, body);
  }
  return `${(diagnostic.questions ?? []).length} questions answered`;
}

async function runPractice(call, courseId, body, level) {
  const session = await call('POST', `/courses/${courseId}/practice/sessions`, { ...body, questionsCount: 2 });
  for (const question of session.questions ?? []) {
    const text = question.prompt ?? question.questionText ?? '';
    const answer = answerFor(`${text} ${session.topicTitle ?? ''} ${session.focus ?? ''}`, level) ?? 'I am not sure.';
    await call('POST', `/courses/${courseId}/practice/sessions/${session.id}/answers`, {
      questionId: question.id,
      content: answer === 'idk' ? 'I do not know this one yet.' : answer,
    });
  }
  return `"${session.topicTitle ?? session.focus}"`;
}

async function runTutor(call, courseId, questions) {
  const session = await call('POST', `/courses/${courseId}/tutor/sessions`, { mode: 'explanation' });
  for (const content of questions) {
    await call('POST', `/courses/${courseId}/tutor/sessions/${session.id}/messages`, { content }).catch((error) => {
      if (error.status !== 422) throw error; // 422 = tutor honestly had no source; still realistic
    });
  }
  return `${questions.length} questions`;
}

// ----------------------------------------------------------------- main ----

async function main() {
  log(`API: ${API}`);
  await fetch(`${API}/health`).catch(() => {
    throw new Error(`API server is not running at ${API}. Start it first (npm run dev).`);
  });

  // ---- Instructor: upload the real course files, let AI find the topics ----
  const hassan = await login('hassan.farid@menoufia.edu.eg');
  const courses = items(await hassan('GET', '/courses'));
  const cs201 = courses.find((c) => c.code === 'CS201');
  const cs301 = courses.find((c) => c.code === 'CS301');
  if (!cs201 || !cs301) throw new Error('CS201/CS301 not found. Run `npm run seed -- --reset` first.');

  log('instructor: uploading course files (PDF + notes)');
  await step('CS201 "Lecture notes weeks 5-8: Logic and proofs" (PDF)', () => uploadFile(hassan, cs201.id, 'Lecture notes weeks 5-8: Logic and proofs', 'cs201-logic-and-proofs.pdf'));
  await step('CS201 "Lecture notes weeks 9-12: Counting"', () => uploadFile(hassan, cs201.id, 'Lecture notes weeks 9-12: Counting', 'cs201-counting.md'));
  await step('CS301 "Lecture notes weeks 5-7: Process synchronization" (PDF)', () => uploadFile(hassan, cs301.id, 'Lecture notes weeks 5-7: Process synchronization', 'cs301-synchronization.pdf'));
  await step('CS301 "Lecture notes weeks 8-10: File systems and storage"', () => uploadFile(hassan, cs301.id, 'Lecture notes weeks 8-10: File systems and storage', 'cs301-file-systems.md'));

  log('waiting for the AI to read the files and find the topics…');
  for (const [code, course] of [['CS201', cs201], ['CS301', cs301]]) {
    const topics = await waitForTopics(hassan, course.id);
    log(`  ${code} topics: ${topics.map((t) => t.title).join(', ')}`);
  }

  log('instructor: assignments');
  const [asg301] = (await step('CS301 assignments', () => ensureAssignments(hassan, cs301.id, 'CS301'))) ?? [];
  const [asg201] = (await step('CS201 assignments', () => ensureAssignments(hassan, cs201.id, 'CS201'))) ?? [];

  // ---- Students: realistic, mixed-ability activity ----
  const students = [
    // email, per-topic ability, what they do
    {
      email: 'sara.mitchell@gmail.com',
      ability: (text) => (/deadlock|banker|semaphore|synchron|critical/i.test(text) ? 'weak' : 'strong'),
      submit: { CS301: 'strong', CS201: 'strong' },
      practice: [
        [cs301, { }, 'weak'],
        [cs301, { focus: 'semaphores and the bounded-buffer problem' }, 'weak'],
      ],
      tutor: [cs301, ['What is the difference between deadlock prevention and deadlock avoidance?', 'Can you give me a small example of the Banker\'s algorithm safety check?']],
      studyTools: true,
      personal: true,
    },
    {
      email: 'mona.reyes@gmail.com',
      ability: (text) => (/memory|page|file|disk|graph|colou?r/i.test(text) ? 'weak' : 'strong'),
      submit: { CS301: 'weak', CS201: 'strong' },
      practice: [[cs301, {}, 'weak']],
      tutor: [cs301, ['Why does a very small time quantum hurt Round Robin?']],
    },
    {
      email: 'nadia.khalil@gmail.com',
      ability: () => 'strong',
      submit: { CS301: 'strong', CS201: 'strong' },
      practice: [],
    },
    {
      email: 'omar.diaz@gmail.com',
      ability: () => 'weak',
      submit: { CS201: 'weak' },
      practice: [[cs201, {}, 'weak']],
    },
    {
      email: 'yara.hansen@gmail.com',
      ability: (text) => (/logic|proof|induction/i.test(text) ? 'weak' : 'strong'),
      submit: { CS201: 'strong' },
      practice: [],
    },
  ];

  for (const student of students) {
    log(`student: ${student.email}`);
    const call = await step('login', () => login(student.email));
    if (!call) continue;
    const mine = items(await call('GET', '/courses'));
    const enrolled = (course) => mine.some((c) => c.id === course.id);

    for (const course of [cs301, cs201]) {
      if (!enrolled(course)) continue;
      await step(`${course.code} level check`, () => runDiagnostic(call, course.id, student.ability));
    }
    if (asg301 && student.submit.CS301 && enrolled(cs301)) {
      await step(`${cs301.code} submit "${asg301.title}" (${student.submit.CS301})`, () => submitAssignment(call, asg301.id, student.submit.CS301));
    }
    if (asg201 && student.submit.CS201 && enrolled(cs201)) {
      await step(`${cs201.code} submit "${asg201.title}" (${student.submit.CS201})`, () => submitAssignment(call, asg201.id, student.submit.CS201));
    }
    const practised = new Set();
    for (const course of [cs301, cs201]) {
      if (enrolled(course) && items(await call('GET', `/courses/${course.id}/practice/sessions`).catch(() => [])).length) practised.add(course.id);
    }
    for (const [course, body, level] of student.practice.filter(([c]) => !practised.has(c.id))) {
      await step(`${course.code} practice ${body.focus ? `on "${body.focus}"` : '(suggested)'}`, () => runPractice(call, course.id, body, level));
    }
    const chatted = student.tutor && items(await call('GET', `/courses/${student.tutor[0].id}/tutor/sessions`).catch(() => [])).length > 0;
    if (student.tutor && !chatted) {
      const [course, questions] = student.tutor;
      await step(`${course.code} tutor chat`, () => runTutor(call, course.id, questions));
    }
    const hasTools = student.studyTools && items(await call('GET', `/courses/${cs301.id}/learning-resources`).catch(() => [])).length > 0;
    if (student.studyTools && !hasTools) {
      await step(`${cs301.code} study tools (summary + flashcards from a file)`, async () => {
        const mats = items(await call('GET', `/courses/${cs301.id}/materials?limit=100`));
        const file = mats.find((m) => m.title.includes('synchronization')) ?? mats[0];
        const result = await call('POST', `/courses/${cs301.id}/learning-resources`, { materialId: file.id, kinds: ['summary', 'flashcards'], language: 'en' });
        return items(result).map((r) => `${r.kind}:${r.status}`).join(', ');
      });
    }
    if (student.personal) {
      await step('personal course "Introduction to Machine Learning" with her own notes', async () => {
        const own = mine.find((c) => c.isPersonal && c.title === 'Introduction to Machine Learning')
          ?? (await call('POST', '/courses', { title: 'Introduction to Machine Learning' }));
        await uploadFile(call, own.id, 'My ML notes', 'personal-ml-basics.md');
        const topics = await waitForTopics(call, own.id, 180000);
        return `topics: ${topics.map((t) => t.title).join(', ')}`;
      });
    }
  }

  console.log(
    [
      '',
      '════════════════════════════════════════════════════════════',
      ' ✔ Demo data ready',
      '════════════════════════════════════════════════════════════',
      ' files       CS201: sets & graphs, logic & proofs (PDF), counting',
      '             CS301: scheduling/deadlocks/memory, synchronization (PDF), file systems',
      ' assignments CS301: 1 published (5 questions) + 1 draft | CS201: 1 published',
      ' students    sara, mona, nadia, omar, yara: level checks, submissions,',
      '             practice, tutor chats; sara also has study tools and a',
      '             personal "Introduction to Machine Learning" course',
      ` logins      password ${PASSWORD} (see npm run seed output)`,
      '════════════════════════════════════════════════════════════',
      '',
    ].join('\n'),
  );
}

main().catch((error) => {
  console.error('[seed:demo] failed:', error.message);
  process.exit(1);
});
