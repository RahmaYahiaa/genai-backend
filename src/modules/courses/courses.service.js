import { ROLES, ACCOUNT_TYPES, COURSE_STAFF_ROLES, ENROLLMENT_REQUEST_STATUSES } from '../../config/constants.js';
import {
  ConflictError,
  FeatureNotAvailableError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/errors/index.js';
import { toPublicCourse } from './course.model.js';
import { toPublicEnrollment } from './enrollment.model.js';
import { toPublicEnrollmentRequest } from './enrollment-request.model.js';

function isAdminOf(user, institutionId) {
  return (
    user.role === ROLES.INSTITUTION_ADMIN &&
    user.institutionId !== null &&
    String(user.institutionId) === String(institutionId)
  );
}

function isStaffMember(course, userId) {
  return (course.staff ?? []).some((member) => String(member.userId) === String(userId));
}

function isPersonalOwner(course, userId) {
  return Boolean(course.isPersonal) && course.ownerId && String(course.ownerId) === String(userId);
}

export function createCoursesService({
  courseRepository,
  enrollmentRepository,
  enrollmentRequestRepository,
  authService,
  academicStructureService,
}) {
  async function getCourseOrNotFound(courseId) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    return course;
  }

  /** Read access: same-institution admin, course staff, enrolled student, personal owner. */
  async function assertReadAccess(course, user) {
    if (course.isPersonal) {
      if (isPersonalOwner(course, user.id)) return;
      throw new NotFoundError('Course not found');
    }
    if (isAdminOf(user, course.institutionId)) return;
    if (isStaffMember(course, user.id)) return;
    if (user.role === ROLES.STUDENT) {
      const enrolled = await enrollmentRepository.exists(user.id, course._id);
      if (enrolled) return;
    }
    // Out of scope (different institution, not staff, not enrolled).
    throw new NotFoundError('Course not found');
  }

  /** Content write access: same-institution admin, course staff, personal owner. */
  function assertWriteAccess(course, user) {
    if (course.isPersonal) {
      if (isPersonalOwner(course, user.id)) return;
      throw new NotFoundError('Course not found');
    }
    if (isAdminOf(user, course.institutionId)) return;
    if (isStaffMember(course, user.id)) return;
    throw new NotFoundError('Course not found');
  }

  /** Administrative access (staff management, enrollment management): admin only. */
  function assertAdminAccess(course, user) {
    if (!isAdminOf(user, course.institutionId)) {
      throw new NotFoundError('Course not found');
    }
  }

  async function ensureInstitutionalCourseAccess(user, courseId) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    if (course.isPersonal || !course.institutionId) {
      throw new FeatureNotAvailableError();
    }
    if (user.role === ROLES.STUDENT) {
      if (await enrollmentRepository.exists(user.id, course._id)) {
        return course;
      }
      if (
        user.accountType === ACCOUNT_TYPES.INSTITUTIONAL &&
        user.institutionId &&
        String(user.institutionId) === String(course.institutionId)
      ) {
        return course;
      }
      throw new NotFoundError('Course not found');
    }
    if (!user.institutionId || String(user.institutionId) !== String(course.institutionId)) {
      throw new NotFoundError('Course not found');
    }
    return course;
  }

  async function ensureInstructorCourseAccess(user, courseId) {
    const course = await courseRepository.findById(courseId);
    if (!course) {
      throw new NotFoundError('Course not found');
    }
    if (isAdminOf(user, course.institutionId)) {
      return course;
    }
    const isInstructor =
      user.role === ROLES.INSTRUCTOR &&
      (course.staff ?? []).some(
        (member) =>
          String(member.userId) === String(user.id) &&
          member.role === COURSE_STAFF_ROLES.INSTRUCTOR,
      );
    if (isInstructor) {
      return course;
    }
    throw new ForbiddenError('Only course instructors and institution admins can access this resource');
  }

  // --- Course CRUD ---

  /**
   * Institutional course (admin) or personal learning space (individual
   * student). institutionId/ownerId are forced from the caller, never from
   * the payload.
   */
  async function createCourse(user, data) {
    if (user.role === ROLES.INSTITUTION_ADMIN) {
      if (user.institutionId === null) {
        throw new ForbiddenError('Admin has no institution scope');
      }
      if (data.departmentId) {
        const unit = await academicStructureService.getUnitInScope(
          data.departmentId,
          user.institutionId,
        );
        if (unit.type !== 'department') {
          throw new ValidationError('departmentId must reference a department unit');
        }
      }
      if (data.semesterId) {
        const unit = await academicStructureService.getUnitInScope(
          data.semesterId,
          user.institutionId,
        );
        if (unit.type !== 'semester') {
          throw new ValidationError('semesterId must reference a semester unit');
        }
      }

      const course = await courseRepository.create({
        title: data.title,
        code: data.code ?? null,
        description: data.description ?? null,
        institutionId: user.institutionId,
        departmentId: data.departmentId ?? null,
        semesterId: data.semesterId ?? null,
        createdBy: user.id,
      });
      return toPublicCourse(course);
    }

    if (user.role === ROLES.STUDENT && user.accountType === ACCOUNT_TYPES.INDIVIDUAL) {
      const course = await courseRepository.create({
        title: data.title,
        description: data.description ?? null,
        isPersonal: true,
        ownerId: user.id,
        createdBy: user.id,
      });
      return toPublicCourse(course);
    }

    throw new ForbiddenError(
      'Institutional students cannot create courses; institution courses are created by the institution admin',
    );
  }

  /** Role-scoped listing: admin -> institution courses, instructor -> staffed, student -> enrolled + personal. */
  async function listCourses(user, { q, page, limit }) {
    const skip = (page - 1) * limit;
    let result;

    if (user.role === ROLES.INSTITUTION_ADMIN) {
      result = await courseRepository.listInstitutionCourses({
        institutionId: user.institutionId,
        q,
        skip,
        limit,
      });
    } else if (user.role === ROLES.INSTRUCTOR) {
      result = await courseRepository.listStaffedCourses({ userId: user.id, q, skip, limit });
    } else {
      const enrolledCourseIds = await enrollmentRepository.listCourseIds(user.id);
      result = await courseRepository.listStudentCourses({
        studentId: user.id,
        enrolledCourseIds,
        q,
        skip,
        limit,
      });
    }

    return { items: result.items.map(toPublicCourse), total: result.total };
  }

  async function getCourse(user, courseId) {
    const course = await getCourseOrNotFound(courseId);
    await assertReadAccess(course, user);
    return toPublicCourse(course);
  }

  /**
   * Cross-module contract (used by knowledge ingestion): resolves the course
   * under the standard write rules (same-institution admin, course staff, or
   * personal owner) and returns the lean course document.
   */
  async function ensureCourseWriteAccess(user, courseId) {
    const course = await getCourseOrNotFound(courseId);
    assertWriteAccess(course, user);
    return course;
  }

  /**
   * Cross-module contract (learning flow: diagnostics, evidence, tutor): only
   * the learner themself may enter it - an enrolled institutional student or
   * the owner of a personal space. Admins/staff are rejected (their view of
   * learners arrives later via the instructor-intervention module).
   */
  async function ensureStudentCourseAccess(user, courseId) {
    const course = await getCourseOrNotFound(courseId);
    if (user.role !== ROLES.STUDENT) {
      throw new ForbiddenError('Only students can access the learning flow');
    }
    if (course.isPersonal) {
      if (!isPersonalOwner(course, user.id)) {
        throw new NotFoundError('Course not found');
      }
      return course;
    }
    const enrolled = await enrollmentRepository.exists(user.id, course._id);
    if (!enrolled) {
      throw new NotFoundError('Course not found');
    }
    return course;
  }

  async function updateCourse(user, courseId, patch) {
    const course = await getCourseOrNotFound(courseId);
    assertWriteAccess(course, user);

    const update = {};
    if (patch.title !== undefined) update.title = patch.title.trim();
    if (patch.description !== undefined) update.description = patch.description;
    if (patch.isActive !== undefined) update.isActive = patch.isActive;

    if (patch.code !== undefined) {
      if (course.isPersonal) {
        throw new ForbiddenError('Personal courses have no course code');
      }
      update.code = patch.code;
    }
    if (patch.departmentId !== undefined || patch.semesterId !== undefined) {
      if (course.isPersonal) {
        throw new ForbiddenError('Personal courses have no academic units');
      }
      if (patch.departmentId !== undefined) {
        if (patch.departmentId) {
          const unit = await academicStructureService.getUnitInScope(
            patch.departmentId,
            course.institutionId,
          );
          if (unit.type !== 'department') {
            throw new ValidationError('departmentId must reference a department unit');
          }
        }
        update.departmentId = patch.departmentId;
      }
      if (patch.semesterId !== undefined) {
        if (patch.semesterId) {
          const unit = await academicStructureService.getUnitInScope(
            patch.semesterId,
            course.institutionId,
          );
          if (unit.type !== 'semester') {
            throw new ValidationError('semesterId must reference a semester unit');
          }
        }
        update.semesterId = patch.semesterId;
      }
    }

    const updated = await courseRepository.updateById(course._id, { $set: update });
    return toPublicCourse(updated);
  }

  // --- Topics (embedded) ---

  function validateTopicPrerequisites(course, prerequisiteTopicIds, currentTopicId) {
    const topicIds = new Set((course.topics ?? []).map((topic) => String(topic._id)));
    for (const prerequisiteId of prerequisiteTopicIds ?? []) {
      if (String(prerequisiteId) === String(currentTopicId)) {
        throw new ValidationError('A topic cannot be its own prerequisite');
      }
      if (!topicIds.has(String(prerequisiteId))) {
        throw new ValidationError(
          `Prerequisite topic ${prerequisiteId} does not exist in this course`,
        );
      }
    }
  }

  async function addTopic(user, courseId, data) {
    const course = await getCourseOrNotFound(courseId);
    assertWriteAccess(course, user);
    validateTopicPrerequisites(course, data.prerequisiteTopicIds, null);

    const { updatedCourse, topic } = await courseRepository.addTopic(courseId, {
      title: data.title.trim(),
      description: data.description ?? null,
      order: data.order ?? 0,
      learningObjectives: (data.learningObjectives ?? []).map((objective) => ({
        code: objective.code ?? null,
        description: objective.description,
      })),
      prerequisiteTopicIds: data.prerequisiteTopicIds ?? [],
    });

    return toPublicCourse(updatedCourse).topics.find((t) => t.id === topic._id.toString());
  }

  async function updateTopic(user, courseId, topicId, data) {
    const course = await getCourseOrNotFound(courseId);
    assertWriteAccess(course, user);
    validateTopicPrerequisites(course, data.prerequisiteTopicIds ?? [], topicId);

    const topicData = {};
    if (data.title !== undefined) topicData.title = data.title.trim();
    if (data.description !== undefined) topicData.description = data.description;
    if (data.order !== undefined) topicData.order = data.order;
    if (data.learningObjectives !== undefined) {
      topicData.learningObjectives = data.learningObjectives.map((objective) => ({
        code: objective.code ?? null,
        description: objective.description,
      }));
    }
    if (data.prerequisiteTopicIds !== undefined) {
      topicData.prerequisiteTopicIds = data.prerequisiteTopicIds;
    }

    const result = await courseRepository.updateTopic(courseId, topicId, topicData);
    if (!result) {
      throw new NotFoundError('Topic not found in this course');
    }
    return toPublicCourse(result.updatedCourse).topics.find((t) => t.id === topicId);
  }

  async function deleteTopic(user, courseId, topicId) {
    const course = await getCourseOrNotFound(courseId);
    assertWriteAccess(course, user);
    const exists = (course.topics ?? []).some((topic) => String(topic._id) === String(topicId));
    if (!exists) {
      throw new NotFoundError('Topic not found in this course');
    }
    await courseRepository.deleteTopic(courseId, topicId);
    return { deleted: true };
  }

  // --- Course staff (institutional, admin-managed) ---

  async function addStaff(admin, courseId, { userId, role }) {
    const course = await getCourseOrNotFound(courseId);
    assertAdminAccess(course, admin);
    if (course.isPersonal) {
      throw new ForbiddenError('Personal courses have no staff');
    }

    const staffUser = await authService.getProfile(userId);
    if (
      staffUser.role !== ROLES.INSTRUCTOR ||
      staffUser.accountType !== ACCOUNT_TYPES.INSTITUTIONAL ||
      String(staffUser.institutionId) !== String(course.institutionId)
    ) {
      throw new ForbiddenError('Target user must be an instructor of the same institution');
    }
    if (isStaffMember(course, userId)) {
      throw new ForbiddenError('User is already a staff member of this course');
    }

    const updatedCourse = await courseRepository.addStaffMember(courseId, {
      userId,
      role: role ?? COURSE_STAFF_ROLES.INSTRUCTOR,
      addedBy: admin.id,
    });
    const member = (updatedCourse.staff ?? []).find((s) => String(s.userId) === String(userId));
    return { userId: String(member.userId), role: member.role, addedAt: member.addedAt };
  }

  async function removeStaff(admin, courseId, userId) {
    const course = await getCourseOrNotFound(courseId);
    assertAdminAccess(course, admin);

    const { removed } = await courseRepository.removeStaffMember(courseId, userId);
    if (!removed) {
      throw new NotFoundError('Staff member not found on this course');
    }
    return { removed: true };
  }

  // --- Enrollments (institutional courses) ---

  async function enroll(user, courseId, requestedStudentId) {
    const course = await getCourseOrNotFound(courseId);
    if (course.isPersonal) {
      throw new ForbiddenError('Personal courses do not use enrollments');
    }

    let studentId;
    if (user.role === ROLES.INSTITUTION_ADMIN) {
      if (!requestedStudentId) {
        throw new ValidationError('studentId is required when enrolling by an admin');
      }
      const student = await authService.getProfile(requestedStudentId);
      if (student.role !== ROLES.STUDENT) {
        throw new ForbiddenError('Target user must be a student account');
      }
      studentId = student.id;
    } else if (user.role === ROLES.STUDENT) {
      if (
        user.accountType !== ACCOUNT_TYPES.INSTITUTIONAL ||
        !user.institutionId
      ) {
        throw new ForbiddenError(
          'Individual learners use personal courses - no enrollment needed',
        );
      }
      throw new ForbiddenError(
        'Course enrollment is managed by the institution admin - submit an enrollment request instead',
      );
    } else {
      throw new ForbiddenError('Only the institution admin enrolls students');
    }

    await enrollmentRepository.create({
      studentId,
      courseId: course._id,
      enrolledBy: user.id,
    });
    return { courseId: String(course._id), studentId, enrolled: true };
  }

  async function dropEnrollment(admin, courseId, studentId) {
    const course = await getCourseOrNotFound(courseId);
    assertAdminAccess(course, admin);

    const removed = await enrollmentRepository.remove(studentId, course._id);
    if (!removed) {
      throw new NotFoundError('Enrollment not found');
    }
    return { dropped: true };
  }


  // --- Course catalog & enrollment requests (student asks, admin decides) ---

  function assertCatalogStudent(user) {
    if (user.role !== ROLES.STUDENT) {
      throw new ForbiddenError('Only students browse the course catalog and request enrollment');
    }
    if (user.accountType !== ACCOUNT_TYPES.INSTITUTIONAL || !user.institutionId) {
      throw new ForbiddenError(
        'Individual learners use personal courses - no enrollment requests needed',
      );
    }
  }

  /**
   * Catalog of the student's institution courses: titles and availability
   * metadata only (never content) annotated with the caller's own enrollment
   * and request state so the UI can render join actions correctly.
   */
  async function listCourseCatalog(user, { search, page, limit }) {
    assertCatalogStudent(user);
    const skip = (page - 1) * limit;
    const result = await courseRepository.listInstitutionCourses({
      institutionId: user.institutionId,
      q: search,
      skip,
      limit,
    });
    const [enrolledCourseIds, myRequests] = await Promise.all([
      enrollmentRepository.listCourseIds(user.id),
      enrollmentRequestRepository.listByStudent(user.id),
    ]);
    const requests = myRequests.items;
    const enrolledSet = new Set(enrolledCourseIds.map((id) => String(id)));
    const statusByCourse = new Map(
      requests.map((request) => [String(request.courseId?._id ?? request.courseId), request.status]),
    );
    return {
      items: result.items.map((course) => ({
        id: course._id.toString(),
        title: course.title,
        code: course.code ?? null,
        description: course.description ?? null,
        isActive: course.isActive,
        enrolled: enrolledSet.has(course._id.toString()),
        myRequestStatus: statusByCourse.get(course._id.toString()) ?? 'NONE',
      })),
      total: result.total,
    };
  }

  async function requestEnrollment(user, courseId, { note }) {
    assertCatalogStudent(user);
    const course = await getCourseOrNotFound(courseId);
    if (course.isPersonal) {
      throw new ForbiddenError('Personal courses do not use enrollment requests');
    }
    if (!course.institutionId || String(user.institutionId) !== String(course.institutionId)) {
      throw new ForbiddenError('Only students of this institution can request its courses');
    }
    if (await enrollmentRepository.exists(user.id, course._id)) {
      throw new ConflictError('Already enrolled in this course');
    }
    const existing = await enrollmentRequestRepository.findByStudentAndCourse(user.id, course._id);
    if (existing) {
      throw new ConflictError(
        `You already have a ${String(existing.status).toLowerCase()} request for this course`,
      );
    }
    const request = await enrollmentRequestRepository.create({
      studentId: user.id,
      courseId: course._id,
      institutionId: course.institutionId,
      studentNote: note ?? null,
    });
    return toPublicEnrollmentRequest(request);
  }

  async function listMyEnrollmentRequests(user, { status, page, limit }) {
    assertCatalogStudent(user);
    const skip = (page - 1) * limit;
    const { items, total } = await enrollmentRequestRepository.listByStudent(user.id, {
      status,
      skip,
      limit,
    });
    return { items: items.map(toPublicEnrollmentRequest), total };
  }

  async function listEnrollmentRequests(admin, { status, page, limit }) {
    if (admin.role !== ROLES.INSTITUTION_ADMIN || !admin.institutionId) {
      throw new ForbiddenError('Only the institution admin manages enrollment requests');
    }
    const skip = (page - 1) * limit;
    const { items, total } = await enrollmentRequestRepository.listByInstitution(
      admin.institutionId,
      { status, skip, limit },
    );
    return { items: items.map(toPublicEnrollmentRequest), total };
  }

  /**
   * Admin decision on a pending request. Approval creates the enrollment
   * (unless the admin already enrolled the student manually, in which case
   * the request is still closed as approved). Rejection records the reason.
   */
  async function decideEnrollmentRequest(admin, requestId, { decision, note }) {
    if (admin.role !== ROLES.INSTITUTION_ADMIN || !admin.institutionId) {
      throw new ForbiddenError('Only the institution admin manages enrollment requests');
    }
    const request = await enrollmentRequestRepository.findById(requestId);
    if (!request || String(request.institutionId) !== String(admin.institutionId)) {
      throw new NotFoundError('Enrollment request not found');
    }
    if (request.status !== ENROLLMENT_REQUEST_STATUSES.PENDING) {
      throw new ConflictError('This enrollment request was already decided');
    }

    let enrollmentCreated = false;
    if (decision === ENROLLMENT_REQUEST_STATUSES.APPROVED) {
      const alreadyEnrolled = await enrollmentRepository.exists(request.studentId, request.courseId);
      if (!alreadyEnrolled) {
        await enrollmentRepository.create({
          studentId: request.studentId,
          courseId: request.courseId,
          enrolledBy: admin.id,
        });
        enrollmentCreated = true;
      }
    }

    const updated = await enrollmentRequestRepository.updateById(requestId, {
      $set: {
        status: decision,
        decisionNote: note ?? null,
        decidedBy: admin.id,
        decidedAt: new Date(),
      },
    });
    return { ...toPublicEnrollmentRequest(updated), enrollmentCreated };
  }

  async function listEnrollments(user, courseId, { page, limit }) {
    const course = await getCourseOrNotFound(courseId);
    if (course.isPersonal) {
      if (!isPersonalOwner(course, user.id)) {
        throw new NotFoundError('Course not found');
      }
      return { items: [], total: 0 };
    }
    if (!isAdminOf(user, course.institutionId) && !isStaffMember(course, user.id)) {
      throw new NotFoundError('Course not found');
    }

    const skip = (page - 1) * limit;
    const { items, total } = await enrollmentRepository.listByCourse(course._id, { skip, limit });
    return { items: items.map(toPublicEnrollment), total };
  }

  return {
    createCourse,
    listCourses,
    getCourse,
    ensureCourseWriteAccess,
    ensureStudentCourseAccess,
    ensureInstitutionalCourseAccess,
    ensureInstructorCourseAccess,
    updateCourse,
    addTopic,
    updateTopic,
    deleteTopic,
    addStaff,
    removeStaff,
    enroll,
    dropEnrollment,
    listEnrollments,
    listCourseCatalog,
    requestEnrollment,
    listMyEnrollmentRequests,
    listEnrollmentRequests,
    decideEnrollmentRequest,
  };
}