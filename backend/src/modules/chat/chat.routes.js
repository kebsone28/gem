import express from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import { verifierPermission } from '../../middleware/verifierPermission.js';
import { validateSchema } from '../../middleware/validation.js';
import { PERMISSIONS } from '../../core/config/permissions.js';
import {
  createConversation,
  getChatBootstrap,
  getConversationMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
  toggleUserChatBlock,
  deleteConversation,
  clearHistory,
  clearMyHistory,
  updateRetention,
  deleteMessageForMe,
  resolveEntity,
  updateUserStatus,
  editMessage,
} from './chat.controller.js';

const router = express.Router();

// Chat schemas for validation
const chatCreateConversationSchema = {
  required: ['participantIds'],
  fields: {
    participantIds: {
      type: 'array',
      required: true,
      validate: (value) => Array.isArray(value) && value.length >= 1 ? null : 'Sélectionnez au moins un autre membre'
    },
    name: { type: 'string', maxLength: 255 },
  },
};

const chatSendMessageSchema = {
  required: ['content'],
  fields: {
    content: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
  },
};

const chatEditMessageSchema = {
  required: ['content'],
  fields: {
    content: { type: 'string', required: true, minLength: 1, maxLength: 5000 },
  },
};

router.use(authProtect);

router.get('/bootstrap', getChatBootstrap);
router.put('/status', updateUserStatus);
router.get('/resolve', resolveEntity);
router.post('/conversations', validateSchema(chatCreateConversationSchema), createConversation);
router.get('/conversations/:conversationId/messages', getConversationMessages);
router.post('/conversations/:conversationId/messages', validateSchema(chatSendMessageSchema), sendMessage);
router.patch('/conversations/:conversationId/messages/:messageId', validateSchema(chatEditMessageSchema), editMessage);
router.delete('/conversations/:conversationId/messages/:messageId/me', deleteMessageForMe);
router.post('/conversations/:conversationId/read', markAsRead);
router.delete(
  '/conversations/:conversationId/messages',
  verifierPermission(PERMISSIONS.GERER_UTILISATEURS),
  clearHistory
);
router.delete('/conversations/:conversationId/my-history', clearMyHistory);
router.patch('/conversations/:conversationId/retention', updateRetention);
router.delete(
  '/conversations/:conversationId/messages/:messageId',
  verifierPermission(PERMISSIONS.GERER_UTILISATEURS),
  deleteMessage
);
router.delete('/conversations/:conversationId', deleteConversation);
router.patch(
  '/users/:userId/block',
  verifierPermission(PERMISSIONS.GERER_UTILISATEURS),
  toggleUserChatBlock
);

export default router;
