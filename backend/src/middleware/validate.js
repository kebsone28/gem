import logger from '../utils/logger.js';
import Joi from 'joi';

/**
 * Standard validation middleware using Joi
 *
 * @param {Object} schema - Joi schema object (can contain body, query, and params keys)
 * @returns {Function} Express middleware function
 */
export const validate = (schema) => {
  return (req, res, next) => {
    const validSchema = Joi.object(schema);
    const objectToValidate = {};

    if (schema.body) objectToValidate.body = req.body;
    if (schema.query) objectToValidate.query = req.query;
    if (schema.params) objectToValidate.params = req.params;

    const { value, error } = validSchema.validate(objectToValidate, {
      abortEarly: false,
      stripUnknown: true, // Remove unknown keys from the validated object
    });

    if (error) {
      const errorDetails = error.details.map((details) => ({
        field: details.path.join('.'),
        message: details.message,
      }));

      logger.error(
        '[DIAGNOSTIC] Joi Validation Error:',
        JSON.stringify(errorDetails, null, 2),
        'Body was:',
        req.body
      );

      // Include first error message in top-level error for backwards compatibility
      const firstErrorMessage = errorDetails[0]?.message || 'Invalid request data';

      return res.status(400).json({
        success: false,
        error: `Validation failed: ${firstErrorMessage}`,
        message: 'Invalid request data',
        details: errorDetails,
      });
    }

    // Assign validated and stripped values back to the request
    if (schema.body) req.body = value.body;
    if (schema.query) req.query = value.query;
    if (schema.params) req.params = value.params;

    next();
  };
};

// Common Joi validation components for reuse
export const JoiSchemas = {
  id: Joi.string().uuid().required(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
  }),
  search: Joi.string().trim().max(255).optional(),
};
