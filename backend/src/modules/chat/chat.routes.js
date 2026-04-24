import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import {
  createConversation,
  getChatBootstrap,
  getConversationMessages,
  sendMessage,
  toggleUserChatBlock,
} from './chat.controller.js';

const router = express.Router();

router.use(authProtect);

router.get('/bootstrap', getChatBootstrap);
router.post('/conversations', createConversation);
router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post('/conversations/:conversationId/messages', sendMessage);
router.patch(
  '/users/:userId/block',
  verifierPermission(PERMISSIONS.GERER_UTILISATEURS),
  toggleUserChatBlock
);

export default router;
