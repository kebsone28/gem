import Joi from 'joi';

export const registerOrganizationSchema = {
  body: Joi.object({
    orgName: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    name: Joi.string().required()
  })
};

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    twoFactorCode: Joi.string().optional()
  })
};

export const verify2FASchema = {
  body: Joi.object({
    id: Joi.string().uuid().optional(),
    email: Joi.string().email().optional(),
    answer: Joi.string().required()
  }).or('id', 'email')
};

export const impersonateUserSchema = {
  body: Joi.object({
    targetUserId: Joi.string().uuid().required(),
    reason: Joi.string().optional()
  })
};

export const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
  })
};

export const updateSecuritySettingsSchema = {
  body: Joi.object({
    securityQuestion: Joi.string().optional(),
    securityAnswer: Joi.string().optional(),
    recoveryCode: Joi.string().optional()
  }).min(1)
};

export const verifyPasswordSchema = {
  body: Joi.object({
    password: Joi.string().required()
  })
};

export const resetPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    securityAnswer: Joi.string().optional(),
    recoveryCode: Joi.string().optional(),
    newPassword: Joi.string().min(8).required()
  }).or('securityAnswer', 'recoveryCode')
};
