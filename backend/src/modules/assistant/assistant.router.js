import { Router } from 'express';
import { authProtect } from '../../api/middlewares/auth.js';
import {
  handleQuery,
  handleMentorQuery,
  saveMemory,
  getMemory,
  listMentorTrainingEntries,
  saveMentorTrainingEntry,
  deleteMentorTrainingEntry,
  acceptMentorTrainingEntry,
  findMentorTrainingMatch
} from './assistant.controller.js';
import { analyzeQuery, executeAction } from './AgenticController.js';
import { queryChatbotAgent } from './chatbotAgent.controller.js';
import { getVpsStatus } from './vpsStatus.controller.js';


const router = Router();

router.use(authProtect);

router.post('/query', handleQuery);
router.post('/agent/query', analyzeQuery);
router.post('/agent/chat', queryChatbotAgent);
router.post('/agent/execute', executeAction);
router.get('/vps/status', getVpsStatus);

router.post('/mentor/query', handleMentorQuery);
router.get('/training', listMentorTrainingEntries);
router.post('/training', saveMentorTrainingEntry);
router.delete('/training/:entryId', deleteMentorTrainingEntry);
router.patch('/training/:entryId/accept', acceptMentorTrainingEntry);
router.post('/training/match', findMentorTrainingMatch);
router.post('/memory', saveMemory);
router.get('/memory/:userId', getMemory);

export default router;
