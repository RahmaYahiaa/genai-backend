import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess, sendCreated, buildPaginationMeta } from '../../shared/http/api-response.js';

export function createCoursesController({ coursesService }) {
  const create = asyncHandler(async (req, res) => {
    const course = await coursesService.createCourse(req.user, req.validated.body);
    sendCreated(res, course);
  });

  const list = asyncHandler(async (req, res) => {
    const { q, page, limit } = req.validated.query;
    const { items, total } = await coursesService.listCourses(req.user, { q, page, limit });
    sendSuccess(res, { data: items, meta: buildPaginationMeta({ page, limit, total }) });
  });

  const getOne = asyncHandler(async (req, res) => {
    sendSuccess(res, { data: req.course });
  });

  const update = asyncHandler(async (req, res) => {
    const course = await coursesService.updateCourse(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendSuccess(res, { data: course });
  });

  const addTopic = asyncHandler(async (req, res) => {
    const topic = await coursesService.addTopic(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, topic);
  });

  const updateTopic = asyncHandler(async (req, res) => {
    const topic = await coursesService.updateTopic(
      req.user,
      req.validated.params.courseId,
      req.validated.params.topicId,
      req.validated.body,
    );
    sendSuccess(res, { data: topic });
  });

  const deleteTopic = asyncHandler(async (req, res) => {
    const result = await coursesService.deleteTopic(
      req.user,
      req.validated.params.courseId,
      req.validated.params.topicId,
    );
    sendSuccess(res, { data: result });
  });

  const addStaff = asyncHandler(async (req, res) => {
    const member = await coursesService.addStaff(
      req.user,
      req.validated.params.courseId,
      req.validated.body,
    );
    sendCreated(res, member);
  });

  const removeStaff = asyncHandler(async (req, res) => {
    const result = await coursesService.removeStaff(
      req.user,
      req.validated.params.courseId,
      req.validated.params.userId,
    );
    sendSuccess(res, { data: result });
  });

  const enroll = asyncHandler(async (req, res) => {
    const result = await coursesService.enroll(
      req.user,
      req.validated.params.courseId,
      req.validated.body.studentId,
    );
    sendCreated(res, result);
  });

  const dropEnrollment = asyncHandler(async (req, res) => {
    const result = await coursesService.dropEnrollment(
      req.user,
      req.validated.params.courseId,
      req.validated.params.studentId,
    );
    sendSuccess(res, { data: result });
  });

  const listEnrollments = asyncHandler(async (req, res) => {
    const { page, limit } = req.validated.query;
    const { items, total } = await coursesService.listEnrollments(
      req.user,
      req.validated.params.courseId,
      { page, limit },
    );
    sendSuccess(res, { data: items, meta: buildPaginationMeta({ page, limit, total }) });
  });

  return {
    create,
    list,
    getOne,
    update,
    addTopic,
    updateTopic,
    deleteTopic,
    addStaff,
    removeStaff,
    enroll,
    dropEnrollment,
    listEnrollments,
  };
}