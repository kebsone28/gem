import { Router } from 'express';
import { 
  createSharedocFolder,
  uploadSharedocDocument,
  getSharedocDocument,
  listSharedocDocuments,
  updateSharedocDocument,
  deleteSharedocDocument,
  downloadSharedocDocument,
  createSharedocVersion,
  getSharedocDocumentVersions
} from './sharedoc.controller.js';
import { authProtect } from '../middlewares/auth.js';

const router = Router();

// Folder routes
router.post('/folder', authProtect, createSharedocFolder);

// Document routes
router.post('/upload', authProtect, uploadSharedocDocument);
router.get('/:id', authProtect, getSharedocDocument);
router.put('/:id', authProtect, updateSharedocDocument);
router.delete('/:id', authProtect, deleteSharedocDocument);
router.get('/:id/download', authProtect, downloadSharedocDocument);
router.post('/:id/version', authProtect, createSharedocVersion);
router.get('/:id/versions', authProtect, getSharedocDocumentVersions);

// List documents (root or folder)
router.get('/', authProtect, listSharedocDocuments);

export default router;