import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { COURSE_STAFF_ROLES, LANGUAGES, ROLES } from '../config/constants.js';
import { authService } from '../modules/auth/index.js';
import * as authRepository from '../modules/auth/auth.repository.js';
import { academicStructureService } from '../modules/academic-structure/index.js';
import { readFile } from 'node:fs/promises';
import { coursesService } from '../modules/courses/index.js';
import { knowledgeIngestionService } from '../modules/knowledge/index.js';
import { topicDetectionService } from '../modules/topics/index.js';
import Institution from '../modules/academic-structure/institution.model.js';

const DEMO_PASSWORD = 'Passw0rd1';
const ADMIN_EMAIL = 'admin@menoufia.edu.eg';

const INSTITUTION_NAME = 'Menoufia University';
const EMAIL_DOMAIN = 'menoufia.edu.eg';

function log(message) {
  console.log(`[seed] ${message}`);
}

async function registerUser(payload) {
  const { user } = await authService.register({ trustedEmail: true, password: DEMO_PASSWORD, ...payload });
  log(`user ready: ${user.role.padEnd(18)} ${user.email}`);
  return user;
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

  // Institution home page content (editable later from "Institution profile").
  await Institution.updateOne(
    { _id: admin.institutionId },
    {
      $set: {
        country: 'Egypt',
        profile: {
          shortName: 'MU',
          tagline: 'Learning that follows every student, from the first lecture to graduation.',
          about:
            'Menoufia University is a public university in Shebin El-Kom, the capital of Menoufia Governorate in the Nile Delta. ' +
            'It became an independent university in 1976 and today teaches students across many faculties, from engineering and medicine to computing, science, education and the humanities. ' +
            'On Lerna, every course has its official material, a smart tutor that answers from it, and a clear picture of how each student is doing.',
          mission:
            'Offer every student high-quality teaching and fair assessment, and give staff the tools to notice early who needs help.',
          vision: 'A university where every student knows what to study next, and every lecturer knows how the class is really doing.',
          foundedYear: 1976,
          city: 'Shebin El-Kom, Menoufia',
          address: 'Gamal Abdel Nasser St., Shebin El-Kom, Menoufia, Egypt',
          website: 'https://menofia.edu.eg',
          contactEmail: ADMIN_EMAIL,
          phone: '',
          faculties: [
            { name: 'Faculty of Computers and Information', description: 'Computer science, information systems and information technology.' },
            { name: 'Faculty of Engineering', description: 'Civil, electrical, mechanical and production engineering.' },
            { name: 'Faculty of Medicine', description: 'Medical education and the university hospitals.' },
            { name: 'Faculty of Science', description: 'Mathematics, physics, chemistry and life sciences.' },
            { name: 'Faculty of Commerce', description: 'Accounting, business administration and economics.' },
            { name: 'Faculty of Education', description: 'Preparing the next generation of teachers.' },
          ],
        },
      },
    },
  );
  log('institution profile: about, mission, faculties');

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
  const [sara, mona, nadia, omar] = students;
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
  // University student demo: already in CS301, and asking to join CS201
  // (so the "join request" flow can be shown from both sides).
  await coursesService.enroll(admin, osCourse.id, requester.id);
  await coursesService.requestEnrollment(requester, course.id, {
    note: 'I would like to join this course as an elective.',
  });
  log('university student: farida enrolled in CS301, pending request -> CS201');

  // Topics are not typed by hand any more: the instructor uploads the course
  // files and the AI detects the topics from them (same path as the app).
  const seedMaterials = [
    [course.id, 'Lecture notes weeks 1-4', 'cs201-sets-and-graphs.md', 'CS201'],
    [osCourse.id, 'Lecture notes weeks 1-4', 'cs301-processes-and-memory.md', 'CS301'],
  ];
  const topicSummary = [];
  for (const [courseId, title, file, code] of seedMaterials) {
    const content = await readFile(new URL(`./materials/${file}`, import.meta.url), 'utf8');
    const material = await knowledgeIngestionService.uploadMaterial(instructor, courseId, {
      title,
      content,
      fileName: file,
      mimeType: 'text/markdown',
      sourceType: 'lecture_notes',
    });
    const topics = await topicDetectionService.detectForMaterial(material.id);
    if (topics?.length) {
      topicSummary.push(`${code}: ${topics.map((t) => t.title).join(', ')}`);
      log(`material ready: ${code} "${title}" -> AI topics: ${topics.map((t) => t.title).join(', ')}`);
    } else {
      topicSummary.push(`${code}: (AI unavailable - open the course and choose "Find topics again")`);
      log(`material ready: ${code} "${title}" -> topic detection unavailable (no AI provider reachable)`);
    }
  }

  console.log(
    [
      '',
      '════════════════════════════════════════════════════════════',
      ' ✔ Seed complete - structure only, zero demo data',
      '════════════════════════════════════════════════════════════',
      ' courses     CS201 Discrete Mathematics | CS301 Operating Systems',
      ` topics      detected by the AI from the course files`,
      ...topicSummary.map((line) => `             ${line}`),
      ' content     one lecture-notes file per course; build assignments live',
      ' enrollment  1 pending request (farida -> CS201) awaiting admin approval',
      '────────────────────────────────────────────────────────────',
      ` logins (password: ${DEMO_PASSWORD})`,
      '   institution_admin  admin@menoufia.edu.eg',
      '   instructor         hassan.farid@menoufia.edu.eg',
      '   students           sara.mitchell | mona.reyes | nadia.khalil | yara.hansen | omar.diaz | mariam.taleb  (@gmail.com)',
      '   university student farida@menoufia.edu.eg  (in CS301, pending request -> CS201)',
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
