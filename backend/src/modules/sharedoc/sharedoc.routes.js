import { Router } from 'express';
import multer from 'multer';
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
import { authProtect } from '../../api/middlewares/auth.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
});
// Folder routes
router.post('/folder', authProtect, createSharedocFolder);

// Document routes
router.post('/upload', authProtect, upload.single('document'), uploadSharedocDocument);
router.get('/:id', authProtect, getSharedocDocument);
router.put('/:id', authProtect, updateSharedocDocument);
router.delete('/:id', authProtect, deleteSharedocDocument);
router.get('/:id/download', authProtect, downloadSharedocDocument);
router.post('/:id/version', authProtect, upload.single('document'), createSharedocVersion);
router.get('/:id/versions', authProtect, getSharedocDocumentVersions);

// List documents (root or folder)
router.get('/', authProtect, listSharedocDocuments);

export default router;