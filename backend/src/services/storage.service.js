import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from '../core/config/config.js';

/**
 * Service de Stockage Distribué (Compatible S3 / MinIO)
 * PROQUELEC Phase 3 - Infrastructure SaaS
 */

const s3Client = new S3Client({
    region: config.storage.region || 'us-east-1',
    endpoint: config.storage.endpoint, // Utile pour MinIO
    forcePathStyle: !!config.storage.endpoint, // Requis pour MinIO
    credentials: {
        accessKeyId: config.storage.accessKeyId,
        secretAccessKey: config.storage.secretAccessKey,
    },
});

const BUCKET_NAME = config.storage.bucketName || 'proquelec-assets';

/**
 * Upload d'un fichier vers le stockage S3
 */
export const uploadFile = async (key, body, contentType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: body,
            ContentType: contentType,
        });
        await s3Client.send(command);
        return key;
    } catch (error) {
        console.error('[STORAGE SERVICE] Upload error:', error);
        throw new Error('Échec de l\'envoi du fichier au stockage.');
    }
};

/**
 * Générer une URL signée (temporaire) pour la consultation d'un fichier privé
 */
export const getFileUrl = async (key, expiresIn = 3600) => {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        return await getSignedUrl(s3Client, command, { expiresIn });
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
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });
        await s3Client.send(command);
    } catch (error) {
        console.error('[STORAGE SERVICE] Delete error:', error);
    }
};
