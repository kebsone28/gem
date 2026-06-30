import Joi from 'joi';
import express from 'express';
import { authProtect, authorize } from '../../api/middlewares/auth.js';
import { validate } from '../../middleware/validate.js';
import {
  listHooks,
  listWebhookExecutions,
  createHook,
  updateHook,
  deleteHook,
  testHook,
} from './toolboxHooks.controller.js';

const router = express.Router();
router.use(authProtect);

const hookSchemas = {
  createHookSchema: {
    body: Joi.object({
      name: Joi.string().min(1).max(255).required(),
      url: Joi.string().uri().required(),
      formKey: Joi.string().optional(),
      events: Joi.array().items(Joi.string()).min(1).required(),
      secret: Joi.string().optional(),
      active: Joi.boolean().default(true),
    }),
  },
  updateHookSchema: {
    body: Joi.object({
      name: Joi.string().min(1).max(255).optional(),
      url: Joi.string().uri().optional(),
      formKey: Joi.string().optional(),
      events: Joi.array().items(Joi.string()).min(1).optional(),
      secret: Joi.string().optional(),
      active: Joi.boolean().optional(),
    }).min(1),
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },
  deleteHookSchema: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },
  testHookSchema: {
    params: Joi.object({
      id: Joi.string().uuid().required(),
    }),
  },
  listExecutionsSchema: {
    query: Joi.object({
      hookId: Joi.string().uuid().optional(),
      formKey: Joi.string().optional(),
      success: Joi.string().valid('true', 'false').optional(),
      limit: Joi.number().integer().min(1).max(100).default(50),
      offset: Joi.number().integer().min(0).default(0),
    }),
  },
};

router.get('/hooks', authorize('toolbox.settings.manage'), listHooks);
router.get(
  '/hooks/executions',
  authorize('toolbox.settings.manage'),
  validate(hookSchemas.listExecutionsSchema),
  listWebhookExecutions
);
router.post(
  '/hooks',
  authorize('toolbox.settings.manage'),
  validate(hookSchemas.createHookSchema),
  createHook
);
router.patch(
  '/hooks/:id',
  authorize('toolbox.settings.manage'),
  validate(hookSchemas.updateHookSchema),
  updateHook
);
router.delete(
  '/hooks/:id',
  authorize('toolbox.settings.manage'),
  validate(hookSchemas.deleteHookSchema),
  deleteHook
);
router.post(
  '/hooks/:id/test',
  authorize('toolbox.settings.manage'),
  validate(hookSchemas.testHookSchema),
  testHook
);

export default router;
