import Joi from 'joi';

export const registerOrganizationSchema = {
  body: Joi.object({
    orgName: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(12).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/).required().messages({
      'string.min': 'Le mot de passe doit contenir au moins 12 caractères',
      'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
    }),
    name: Joi.string().required()
  })
};

export const loginSchema = {
  body: Joi.object({
    email: Joi.string().required(),
    password: Joi.string().required(),
    twoFactorCode: Joi.string().optional()
  })
};

export const verify2FASchema = {
  body: Joi.object({
    id: Joi.string().uuid().optional(),
    email: Joi.string().optional(),
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
    newPassword: Joi.string().min(12).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/).invalid(Joi.ref('currentPassword')).required().messages({
      'string.min': 'Le mot de passe doit contenir au moins 12 caractères',
      'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
      'any.invalid': 'Le nouveau mot de passe doit être différent de l\'ancien',
    })
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
    newPassword: Joi.string().min(12).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/).required().messages({
      'string.min': 'Le mot de passe doit contenir au moins 12 caractères',
      'string.pattern.base': 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
    }),
  }).or('securityAnswer', 'recoveryCode')
};
