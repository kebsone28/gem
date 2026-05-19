import Joi from 'joi';

export const createUserSchema = {
  body: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().optional(),
    roleLegacy: Joi.string().optional(),
    roleId: Joi.string().uuid().optional().allow(null),
    active: Joi.boolean().optional(),
    requires2FA: Joi.boolean().optional(),
    teamId: Joi.string().uuid().optional().allow(null),
    notificationEmail: Joi.string().email().optional().allow(null, ''),
    permissions: Joi.array().items(Joi.string()).optional().allow(null)
  })
};

export const updateUserSchema = {
  params: Joi.object({
    id: Joi.string().uuid().required()
  }),
  body: Joi.object({
    name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(8).optional(),
    role: Joi.string().optional(),
    roleLegacy: Joi.string().optional(),
    roleId: Joi.string().uuid().optional().allow(null),
    active: Joi.boolean().optional(),
    requires2FA: Joi.boolean().optional(),
    teamId: Joi.string().uuid().optional().allow(null),
    notificationEmail: Joi.string().email().optional().allow(null, ''),
    permissions: Joi.array().items(Joi.string()).optional().allow(null)
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
