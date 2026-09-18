import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { COURSE_STAFF_ROLES, LANGUAGES, ROLES } from '../config/constants.js';
import { authService } from '../modules/auth/index.js';
import * as authRepository from '../modules/auth/auth.repository.js';
import { academicStructureService } from '../modules/academic-structure/index.js';
import { coursesService } from '../modules/courses/index.js';

const DEMO_PASSWORD = 'Passw0rd1';
const ADMIN_EMAIL = 'admin@menoufia.edu.eg';

const INSTITUTION_NAME = 'Menoufia University';
const EMAIL_DOMAIN = 'menoufia.edu.eg';

function log(message) {
  console.log(`[seed] ${message}`);
}

async function registerUser(payload) {
  const { user } = await authService.register({ password: DEMO_PASSWORD, ...payload });
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
  await coursesService.requestEnrollment(requester, course.id, {
    note: 'I would like to join this course as an elective.',
  });
  log('enrollment request: farida -> CS201 (pending admin approval)');

  await coursesService.addTopic(instructor, course.id, { title: 'Set Theory', order: 1 });
  await coursesService.addTopic(instructor, course.id, { title: 'Graph Theory', order: 2 });
  await coursesService.addTopic(instructor, course.id, { title: 'Graph Coloring', order: 3 });
  await coursesService.addTopic(instructor, osCourse.id, { title: 'CPU Scheduling', order: 1 });
  await coursesService.addTopic(instructor, osCourse.id, { title: 'Deadlocks', order: 2 });
  await coursesService.addTopic(instructor, osCourse.id, { title: 'Memory Management', order: 3 });
  log('topics ready: CS201 (3) + CS301 (3)');

  console.log(
    [
      '',
      '════════════════════════════════════════════════════════════',
      ' ✔ Seed complete - structure only, zero demo data',
      '════════════════════════════════════════════════════════════',
      ' courses     CS201 Discrete Mathematics | CS301 Operating Systems',
      ' topics      CS201: Set Theory, Graph Theory, Graph Coloring',
      '             CS301: CPU Scheduling, Deadlocks, Memory Management',
      ' content     none: upload real materials and build assignments live',
      ' enrollment  1 pending request (farida -> CS201) awaiting admin approval',
      '────────────────────────────────────────────────────────────',
      ` logins (password: ${DEMO_PASSWORD})`,
      '   institution_admin  admin@menoufia.edu.eg',
      '   instructor         hassan.farid@menoufia.edu.eg',
      '   students           sara.mitchell | mona.reyes | nadia.khalil | yara.hansen | omar.diaz | mariam.taleb  (@gmail.com)',
      '   requester          farida@menoufia.edu.eg  (pending enrollment request)',
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
