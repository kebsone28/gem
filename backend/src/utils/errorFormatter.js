/**
 * Consistent error response formatter
 * Ensures all API errors follow the same format
 */

const isDev = process.env.NODE_ENV !== 'production';

export const createErrorResponse = (
  status,
  message,
  code,
  details = null
) => {
  return {
    error: {
      message,
      code,
      timestamp: new Date().toISOString(),
      ...(isDev && details && { details }),
    },
  };
};

export const formatValidationError = (errors) => {
  return createErrorResponse(
    400,
    'Validation failed',
    'VALIDATION_ERROR',
    { validationErrors: errors }
  );
};

export const formatAuthError = (message = 'Unauthorized') => {
  return createErrorResponse(
    401,
    message,
    'AUTH_ERROR'
  );
};

export const formatForbiddenError = (message = 'Forbidden') => {
  return createErrorResponse(
    403,
    message,
    'FORBIDDEN'
  );
};

export const formatNotFoundError = (resource = 'Resource') => {
  return createErrorResponse(
    404,
    `${resource} not found`,
    'NOT_FOUND'
  );
};

export const formatConflictError = (message, code = 'CONFLICT') => {
  return createErrorResponse(
    409,
    message,
    code
  );
};

export const formatServerError = (message, code = 'SERVER_ERROR', error = null) => {
  return createErrorResponse(
    500,
    message,
    code,
    isDev ? {
      message: error?.message,
      stack: error?.stack,
    } : null
  );
};

/**
 * Express middleware for consistent error responses
 */
export const errorFormatter = (err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'SERVER_ERROR';
  const message = err.message || 'Internal server error';

  res.status(statusCode).json(createErrorResponse(statusCode, message, code, isDev ? err : null));
};
