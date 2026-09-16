import { asyncHandler } from '../../shared/utils/async-handler.js';
import { sendSuccess } from '../../shared/http/api-response.js';

export function createAnalyticsController({ analyticsService }) {
  const getCourseAnalytics = asyncHandler(async (req, res) => {
    const analytics = await analyticsService.getCourseAnalytics(
      req.user,
      req.validated.params.courseId,
    );
    sendSuccess(res, { data: analytics });
  });

  const getCoverageGaps = asyncHandler(async (req, res) => {
    const coverage = await analyticsService.getCoverageGaps(
      req.user,
      req.validated.params.courseId,
    );
    sendSuccess(res, { data: coverage });
  });

  const getInstructorHome = asyncHandler(async (req, res) => {
    const home = await analyticsService.getInstructorHome(req.user);
    sendSuccess(res, { data: home });
  });

  return { getCourseAnalytics, getCoverageGaps, getInstructorHome };
}