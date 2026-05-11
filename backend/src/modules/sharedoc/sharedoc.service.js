import { uploadFile, getFileUrl, deleteFile, getFileStream } from '../../services/storage.service.js';
import prisma from '../../core/utils/prisma.js';
import logger from '../../utils/logger.js';
import crypto from 'crypto';
import path from 'path';

/**
 * Service for Shared Document Management
 * Provides hierarchical document/folder management with versioning
 */

export const createFolder = async (organizationId, parentFolderId, name, createdById) => {
  try {
    const folder = await prisma.document.create({
      data: {
        organizationId,
        folderId: parentFolderId || null,
        filename: name,
        storageKey: null, // Folders don't have storage
        mimeType: 'application/vnd.folder',
        size: 0,
        uploadedById: createdById,
        isPublic: false,
        accessLevel: 'ORG', // Default to organization level
      },
    });
    return folder;
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error creating folder:', error);
    throw error;
  }
};

export const uploadDocument = async (organizationId, folderId, file, uploadedById, description = '', changeLog = 'Initial upload') => {
  try {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }

    const fileExtension = path.extname(file.originalname).substring(1); // Remove the dot
    const fileName = file.originalname;
    const mimeType = file.mimetype || 'application/octet-stream';
    const size = file.size;

    // Generate storage key
    const storageKey = `${organizationId}/documents/${crypto.randomUUID()}.${fileExtension}`;

    // Upload file to storage
    await uploadFile(storageKey, file.buffer, mimeType);

    // Create document record
    const document = await prisma.document.create({
      data: {
        organizationId,
        folderId,
        filename: fileName,
        storageKey,
        mimeType,
        size,
        description,
        uploadedById,
        isPublic: false,
        accessLevel: 'ORG',
      },
    });

    // Create initial version
    await prisma.documentVersion.create({
      data: {
        documentId: document.id,
        storageKey,
        mimeType,
        size,
        uploadedById,
        changeLog,
      },
    });

    return document;
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error uploading document:', error);
    throw error;
  }
};

export const getDocumentById = async (id, organizationId) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id, organizationId },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            uploadedAt: true,
            uploadedBy: { select: { id: true, name: true } },
            changeLog: true,
            size: true,
          },
        },
        children: {
          where: { deletedAt: null },
          orderBy: [{ filename: 'asc' }],
        },
      },
    });
    return document;
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error fetching document:', error);
    throw error;
  }
};

export const getDocuments = async (organizationId, options = {}) => {
  try {
    const {
      folderId = null, // null for root
      projectId = null,
      search = '',
      page = 1,
      limit = 20,
      sortBy = 'filename',
      sortOrder = 'asc',
    } = options;

    const where = {
      organizationId,
      deletedAt: null,
      ...(folderId !== null && { folderId }),
      ...(projectId !== null && { projectId }),
      ...(search && {
        filename: {
          contains: search,
          mode: 'insensitive',
        },
      }),
    };

    const [documents, totalCount] = await prisma.$transaction([
      prisma.document.findMany({
        where,
        include: {
          uploadedBy: { select: { id: true, name: true } },
          _count: { select: { children: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.document.count({ where }),
    ]);

    return {
      documents,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
      },
    };
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error fetching documents:', error);
    throw error;
  }
};

export const updateDocument = async (id, organizationId, updates) => {
  try {
    const document = await prisma.document.update({
      where: { id, organizationId, deletedAt: null },
      data: updates,
    });
    return document;
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error updating document:', error);
    throw error;
  }
};

export const deleteDocument = async (id, organizationId) => {
  try {
    // Soft delete
    const document = await prisma.document.update({
      where: { id, organizationId },
      data: { deletedAt: new Date() },
    });

    // Optionally, delete the file from storage? We'll keep it for history with versions.
    // If we want to physically delete, we would need to delete all versions first.
    // For now, we just soft delete the document record.
    return document;
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error deleting document:', error);
    throw error;
  }
};

export const downloadDocument = async (id, organizationId) => {
  try {
    const document = await prisma.document.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.mimeType === 'application/vnd.folder') {
      throw new Error('Cannot download a folder');
    }

    // For now, we return the key and let the controller handle streaming
    // Alternatively, we could return a signed URL or stream directly.
    return {
      key: document.storageKey,
      mimeType: document.mimeType,
      filename: document.filename,
      size: document.size,
    };
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error preparing download:', error);
    throw error;
  }
};

export const createVersion = async (documentId, organizationId, file, uploadedById, changeLog = 'New version') => {
  try {
    // Get the current document to validate and get folderId, etc.
    const document = await prisma.document.findFirst({
      where: { id: documentId, organizationId, deletedAt: null },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const fileExtension = path.extname(file.originalname).substring(1);
    const fileName = file.originalname;
    const mimeType = file.mimetype || document.mimetype; // Keep original mimeType if not provided
    const size = file.size;

    // Generate new storage key for this version
    const storageKey = `${organizationId}/documents/${crypto.randomUUID()}.${fileExtension}`;

    // Upload the new file
    await uploadFile(storageKey, file.buffer, mimeType);

    // Create version record
    const version = await prisma.documentVersion.create({
      data: {
        documentId,
        storageKey,
        mimeType,
        size,
        uploadedById,
        changeLog,
      },
    });

    // Update the document to point to the new storage key (so that downloads get the latest)
    await prisma.document.update({
      where: { id: documentId },
      data: {
        storageKey,
        filename: fileName,
        mimeType,
        size,
        // Optionally update the description if provided in the version? We'll keep document description separate.
      },
    });

    return version;
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error creating version:', error);
    throw error;
  }
};

export const getDocumentVersions = async (documentId, organizationId) => {
  try {
    const versions = await prisma.documentVersion.findMany({
      where: {
        document: {
          id: documentId,
          organizationId,
          deletedAt: null,
        },
      },
      orderBy: { uploadedAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true } },
      },
    });
    return versions;
  } catch (error) {
    logger.error('[SHAREDDOC SERVICE] Error fetching document versions:', error);
    throw error;
  }
};
