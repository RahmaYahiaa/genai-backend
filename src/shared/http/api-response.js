/**
 * Consistent success envelope for every API response.
 * Shape: { success: true, data: ..., meta?: ... }
 */

export function sendSuccess(res, { status = 200, data = null, meta } = {}) {
  const body = { success: true, data };
  if (meta !== undefined) {
    body.meta = meta;
  }
  return res.status(status).json(body);
}

export function sendCreated(res, data) {
  return sendSuccess(res, { status: 201, data });
}

export function buildPaginationMeta({ page, limit, total }) {
  const totalPages = Math.ceil(total / limit);
  return {
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}
