import express from 'express';
import { authProtect, authorize } from '../../api/middlewares/auth.js';
import * as controller from '../../modules/projectTemplate/projectTemplate.controller.js';

const router = express.Router();

router.use(authProtect);

// List & read (any authenticated user)
router.get('/', controller.listTemplates);
router.get('/:id', controller.getTemplate);

// Admin-only create/update/delete
router.post('/', authorize('project.template.create', ['ADMIN_PROQUELEC', 'ADMIN']), controller.createTemplate);
router.patch('/:id', authorize('project.template.update', ['ADMIN_PROQUELEC', 'ADMIN']), controller.updateTemplate);
router.delete('/:id', authorize('project.template.delete', ['ADMIN_PROQUELEC', 'ADMIN']), controller.deleteTemplate);

export default router;
