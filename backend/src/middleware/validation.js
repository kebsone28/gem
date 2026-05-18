/**
 * Schema-based input validation middleware
 * Ensures all request bodies match expected schemas
 */

import logger from '../utils/logger.js';

/**
 * Simple schema validator
 * Supports basic type checking and required fields
 */
export const validateSchema = (schema) => {
  return (req, res, next) => {
    const errors = [];

    // Check required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (req.body[field] === undefined || req.body[field] === null) {
          errors.push(`${field} is required`);
        }
      }
    }

    // Check field types
    if (schema.fields) {
      for (const [field, fieldSchema] of Object.entries(schema.fields)) {
        if (req.body[field] === undefined || req.body[field] === null) {
          if (fieldSchema.required) {
            errors.push(`${field} is required`);
          }
          continue;
        }

        const value = req.body[field];
        const expectedType = fieldSchema.type;

        // Type checking
        if (expectedType === 'string' && typeof value !== 'string') {
          errors.push(`${field} must be a string`);
        } else if (expectedType === 'number' && typeof value !== 'number') {
          errors.push(`${field} must be a number`);
        } else if (expectedType === 'boolean' && typeof value !== 'boolean') {
          errors.push(`${field} must be a boolean`);
        } else if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`${field} must be an array`);
        } else if (expectedType === 'object' && typeof value !== 'object') {
          errors.push(`${field} must be an object`);
        }

        // Min/max length for strings
        if (expectedType === 'string') {
          if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
            errors.push(
              `${field} must have at least ${fieldSchema.minLength} characters`
            );
          }
          if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
            errors.push(
              `${field} must have at most ${fieldSchema.maxLength} characters`
            );
          }
        }

        // Min/max for numbers
        if (expectedType === 'number') {
          if (
            fieldSchema.minimum !== undefined &&
            value < fieldSchema.minimum
          ) {
            errors.push(`${field} must be at least ${fieldSchema.minimum}`);
          }
          if (fieldSchema.maximum !== undefined && value > fieldSchema.maximum) {
            errors.push(`${field} must be at most ${fieldSchema.maximum}`);
          }
        }

        // Enum validation
        if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
          errors.push(
            `${field} must be one of: ${fieldSchema.enum.join(', ')}`
          );
        }

        // Custom validator
        if (fieldSchema.validate) {
          const validationError = fieldSchema.validate(value);
          if (validationError) {
            errors.push(`${field}: ${validationError}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      logger.warn('[VALIDATION] Request validation failed:', {
        endpoint: req.path,
        method: req.method,
        errors,
      });

      return res.status(400).json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors,
          timestamp: new Date().toISOString(),
        },
      });
    }

    next();
  };
};

/**
 * Common schemas for reuse
 */
export const schemas = {
  mission: {
    create: {
      required: ['title'],
      fields: {
        title: {
          type: 'string',
          required: true,
          minLength: 3,
          maxLength: 255,
        },
        description: {
          type: 'string',
          maxLength: 5000,
        },
        budget: {
          type: 'number',
          minimum: 0,
        },
        status: {
          type: 'string',
          enum: ['draft', 'soumise', 'en_attente_validation', 'approuvee', 'rejetee'],
        },
      },
    },
    update: {
      fields: {
        title: {
          type: 'string',
          minLength: 3,
          maxLength: 255,
        },
        description: {
          type: 'string',
          maxLength: 5000,
        },
        budget: {
          type: 'number',
          minimum: 0,
        },
        status: {
          type: 'string',
          enum: ['draft', 'soumise', 'en_attente_validation', 'approuvee', 'rejetee'],
        },
      },
    },
  },

  project: {
    create: {
      required: ['name', 'status'],
      fields: {
        name: {
          type: 'string',
          required: true,
          minLength: 3,
          maxLength: 255,
        },
        status: {
          type: 'string',
          required: true,
          enum: ['active', 'paused', 'completed', 'archived'],
        },
        budget: {
          type: 'number',
          minimum: 0,
        },
      },
    },
  },

  pagination: {
    fields: {
      page: {
        type: 'number',
        minimum: 1,
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 1000,
      },
    },
  },
};

/**
 * Usage in routes:
 *
 * import { validateSchema, schemas } from '../middleware/validation.js';
 *
 * router.post('/missions',
 *   validateSchema(schemas.mission.create),
 *   createMission
 * );
 *
 * router.patch('/missions/:id',
 *   validateSchema(schemas.mission.update),
 *   updateMission
 * );
 */
