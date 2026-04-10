import Joi from 'joi';

/**
 * GEM SAAS - Organization Configuration Schema
 * Validates the JSON configuration for each organization.
 */
const organizationConfigSchema = Joi.object({
  branding: Joi.object({
    primaryColor: Joi.string().regex(/^#[0-9A-Fa-f]{6}$/).default('#4f46e5'),
    logo: Joi.string().uri().allow(null, ''),
    companyName: Joi.string().allow(null, '')
  }).default(),
  
  notifications: Joi.object({
    smtp: Joi.object({
      host: Joi.string(),
      port: Joi.number().integer(),
      user: Joi.string(),
      pass: Joi.string(),
      from: Joi.string().email()
    }).allow(null),
    enabled: Joi.boolean().default(true)
  }).default(),

  mission_panels_dg: Joi.array().items(Joi.string().valid('prep', 'report', 'approval')).default(['prep', 'report', 'approval']),
  
  features: Joi.object({
    map: Joi.boolean().default(true),
    ai_reporting: Joi.boolean().default(false),
    advanced_finance: Joi.boolean().default(false)
  }).default()
}).unknown(true); // Allow other fields for flexibility but validate core ones

/**
 * Validate organization config
 */
export const validateOrganizationConfig = (config) => {
  return organizationConfigSchema.validate(config, { abortEarly: false, stripUnknown: false });
};
