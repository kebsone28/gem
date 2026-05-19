import Joi from 'joi';

export const createUserSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().required(), // Relaxed: acts as username, not necessarily a valid email
    password: Joi.string().min(6).required(), // Synced with frontend min(6)
    role: Joi.string().optional(),
    roleLegacy: Joi.string().optional(),
    roleId: Joi.string().uuid().optional().allow(null, ''),
    active: Joi.boolean().optional(),
    requires2FA: Joi.boolean().optional(),
    teamId: Joi.string().uuid().optional().allow(null, ''),
    notificationEmail: Joi.string().email().optional().allow(null, ''),
    permissions: Joi.array().items(Joi.string()).optional().allow(null),
    assignedProjectIds: Joi.array().items(Joi.string()).optional().allow(null)
  })
};

export const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required()
  }),
  body: Joi.object({
    name: Joi.string().optional(),
    email: Joi.string().optional(), // Relaxed: acts as username, not necessarily a valid email
    password: Joi.string().min(6).optional().allow(''), // Synced with frontend min(6)
    role: Joi.string().optional(),
    roleLegacy: Joi.string().optional(),
    roleId: Joi.string().uuid().optional().allow(null, ''),
    active: Joi.boolean().optional(),
    requires2FA: Joi.boolean().optional(),
    teamId: Joi.string().uuid().optional().allow(null, ''),
    notificationEmail: Joi.string().email().optional().allow(null, ''),
    permissions: Joi.array().items(Joi.string()).optional().allow(null),
    assignedProjectIds: Joi.array().items(Joi.string()).optional().allow(null)
  }).min(1)
};

export const deleteUserSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required()
  })
};

export const requestUserDeletionSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required()
  }),
  body: Joi.object({
    reason: Joi.string().optional()
  })
};
