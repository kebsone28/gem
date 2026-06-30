import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { validate } from '../../middleware/validate.js';
import { registerPin, loginWithPin, getAssignedForms, submitForm, submitBatch, getSubmissionByClientId } from './gedcollect.controller.js';
import { registerPinSchema, loginWithPinSchema, getAssignedFormsSchema } from './gedcollect.validation.js';

const router = express.Router();

// Auth endpoints (no auth required)
router.post('/auth/register-pin', validate(registerPinSchema), registerPin);
router.post('/auth/login', validate(loginWithPinSchema), loginWithPin);

// Protected endpoints
router.use(authProtect);
router.get('/forms', validate(getAssignedFormsSchema), getAssignedForms);
router.post('/submissions', submitForm);
router.post('/submissions/batch', submitBatch);
router.get('/submissions/by-client-id/:clientId', getSubmissionByClientId);

export default router;
