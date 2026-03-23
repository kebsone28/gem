import { uploadFile, getFileUrl } from '../../services/storage.service.js';
import logger from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * @desc    Upload an image to S3/MinIO
 * @route   POST /api/upload
 */
export const uploadImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni.' });
        }

        const { organizationId } = req.user;
        const fileExtension = req.file.originalname.split('.').pop();
        const fileName = `${organizationId}/terrain/${crypto.randomUUID()}.${fileExtension}`;

        // Upload to S3 via storage service
        const key = await uploadFile(fileName, req.file.buffer, req.file.mimetype);
        
        // Generate a public-ish (or signed) URL
        const url = await getFileUrl(key);

        res.status(201).json({
            success: true,
            key: key,
            url: url
        });
    } catch (error) {
        logger.error('[UPLOAD CONTROLLER] Error:', error);
        res.status(500).json({ error: 'Échec de l\'upload de l\'image.' });
    }
};
