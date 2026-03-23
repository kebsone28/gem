import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from '../core/config/config.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Service de Stockage Hybride (S3 / Local Fallback)
 * PROQUELEC Phase 3 - Infrastructure SaaS & Dev Local
 */

const isS3Configured = !!(config.storage.accessKeyId && config.storage.secretAccessKey);

let s3Client = null;
if (isS3Configured) {
    s3Client = new S3Client({
        region: config.storage.region || 'us-east-1',
        endpoint: config.storage.endpoint,
        forcePathStyle: !!config.storage.endpoint,
        credentials: {
            accessKeyId: config.storage.accessKeyId,
            secretAccessKey: config.storage.secretAccessKey,
        },
    });
}

const BUCKET_NAME = config.storage.bucketName || 'proquelec-assets';
const LOCAL_UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * Upload d'un fichier vers le stockage S3 ou Local
 */
export const uploadFile = async (key, body, contentType) => {
    try {
        if (isS3Configured && s3Client) {
            const command = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
                Body: body,
                ContentType: contentType,
            });
            await s3Client.send(command);
            return key;
        } else {
            // Local fallback
            const filePath = path.join(LOCAL_UPLOADS_DIR, key);
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, body);
            return key;
        }
    } catch (error) {
        console.error('[STORAGE SERVICE] Upload error:', error);
        throw new Error('Échec de l\'envoi du fichier au stockage.');
    }
};

/**
 * Générer une URL pour la consultation d'un fichier
 */
export const getFileUrl = async (key, expiresIn = 3600) => {
    try {
        if (isS3Configured && s3Client) {
            const command = new GetObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });
            return await getSignedUrl(s3Client, command, { expiresIn });
        } else {
            // Local fallback URL (assumes app is serving /uploads via static)
            // Use relative path from API base or absolute URL if we know the host
            return `/api/uploads/${key}`;
        }
    } catch (error) {
        console.error('[STORAGE SERVICE] Sign URL error:', error);
        return null;
    }
};

/**
 * Suppression d'un fichier
 */
export const deleteFile = async (key) => {
    try {
        if (isS3Configured && s3Client) {
            const command = new DeleteObjectCommand({
                Bucket: BUCKET_NAME,
                Key: key,
            });
            await s3Client.send(command);
        } else {
            const filePath = path.join(LOCAL_UPLOADS_DIR, key);
            await fs.unlink(filePath).catch(() => {});
        }
    } catch (error) {
        console.error('[STORAGE SERVICE] Delete error:', error);
    }
};
