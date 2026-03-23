import { Router } from 'express';
import multer from 'multer';
import { uploadImage } from '../../modules/upload/upload.controller.js';
import { authProtect } from '../middlewares/auth.js';

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post('/', authProtect, upload.single('file'), uploadImage);

export default router;
