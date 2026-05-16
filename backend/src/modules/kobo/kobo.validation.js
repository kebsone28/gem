import Joi from 'joi';

// Kobo Asset ID regex validation pattern
const koboAssetIdPattern = /^[a-zA-Z0-9_-]+$/;

export const testKoboConnectionSchema = {
  body: Joi.object({
    token: Joi.string().required(),
    assetUid: Joi.string().regex(koboAssetIdPattern).required()
  })
};

export const autoDetectMappingSchema = {
  body: Joi.object({
    koboAssetId: Joi.string().regex(koboAssetIdPattern).required(),
    koboServerUrl: Joi.string().uri().optional()
  })
};

export const getMappingSchema = {
  query: Joi.object({
    koboAssetId: Joi.string().regex(koboAssetIdPattern).required()
  })
};

export const migrateMappingSchema = {
  body: Joi.object({
    koboAssetId: Joi.string().regex(koboAssetIdPattern).required(),
    koboServerUrl: Joi.string().uri().optional()
  })
};

export const transformDataSchema = {
  body: Joi.object({
    koboAssetId: Joi.string().regex(koboAssetIdPattern).required(),
    koboData: Joi.object().required(),
    koboServerUrl: Joi.string().uri().optional()
  })
};
