/**
 * Standardized pagination utility
 * Ensures consistent pagination across all endpoints
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;
const MIN_LIMIT = 1;
const MIN_PAGE = 1;

/**
 * Parse and validate pagination parameters
 * @param {number|string} page - Page number (1-indexed)
 * @param {number|string} limit - Items per page
 * @returns {Object} { page, limit, offset }
 */
export const parsePaginationParams = (page, limit) => {
  let parsedPage = parseInt(page) || 1;
  let parsedLimit = parseInt(limit) || DEFAULT_LIMIT;

  // Validate page
  if (parsedPage < MIN_PAGE) {
    parsedPage = MIN_PAGE;
  }

  // Validate limit
  if (parsedLimit < MIN_LIMIT) {
    parsedLimit = MIN_LIMIT;
  }
  if (parsedLimit > MAX_LIMIT) {
    parsedLimit = MAX_LIMIT;
  }

  const offset = (parsedPage - 1) * parsedLimit;

  return {
    page: parsedPage,
    limit: parsedLimit,
    offset,
  };
};

/**
 * Build pagination response metadata
 */
export const buildPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
};

/**
 * Express middleware for automatic pagination parsing
 */
export const paginationMiddleware = (req, res, next) => {
  const { page, limit } = req.query;
  const pagination = parsePaginationParams(page, limit);

  req.pagination = pagination;
  res.locals.buildPaginationMeta = (total) =>
    buildPaginationMeta(pagination.page, pagination.limit, total);

  next();
};

/**
 * Usage in controllers:
 *
 * // With middleware (automatic):
 * const { offset, limit } = req.pagination;
 * const total = await prisma.mission.count({ where: whereClause });
 * const items = await prisma.mission.findMany({
 *   where: whereClause,
 *   take: limit,
 *   skip: offset,
 * });
 * res.json({
 *   items,
 *   pagination: res.locals.buildPaginationMeta(total),
 * });
 *
 * // Manual parsing:
 * const { offset, limit } = parsePaginationParams(req.query.page, req.query.limit);
 */
