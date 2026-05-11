import { 
  createFolder, 
  uploadDocument, 
  getDocumentById, 
  getDocuments, 
  updateDocument, 
  deleteDocument, 
  downloadDocument,
  createVersion,
  getDocumentVersions
} from './sharedoc.service.js';
import { authProtect, permissionProtect } from '../middlewares/auth.js';
import logger from '../../utils/logger.js';

/**
 * @desc    Create a new folder
 * @route   POST /api/sharedoc/folder
 * @access  Private
 */
export const createSharedocFolder = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const { parentFolderId, name } = req.body;
    const createdById = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await createFolder(organizationId, parentFolderId, name, createdById);
    res.status(201).json({ success: true, data: folder });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error creating folder:', error);
    res.status(500).json({ error: 'Failed to create folder' });
  }
};

/**
 * @desc    Upload a document
 * @route   POST /api/sharedoc/upload
 * @access  Private
 */
export const uploadSharedocDocument = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const folderId = req.body.folderId || null; // null for root
    const description = req.body.description || '';
    const changeLog = req.body.changeLog || 'Initial upload';
    const uploadedById = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const document = await uploadDocument(
      organizationId,
      folderId,
      req.file,
      uploadedById,
      description,
      changeLog
    );

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

/**
 * @desc    Get document by ID
 * @route   GET /api/sharedoc/:id
 * @access  Private
 */
export const getSharedocDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const document = await getDocumentById(id, organizationId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ success: true, data: document });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error fetching document:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
};

/**
 * @desc    List documents in a folder or root
 * @route   GET /api/sharedoc
 * @access  Private
 */
export const listSharedocDocuments = async (req, res) => {
  try {
    const { organizationId } = req.user;
    const options = {
      folderId: req.query.folderId ? req.query.folderId : null,
      projectId: req.query.projectId ? req.query.projectId : null,
      search: req.query.search || '',
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 20,
      sortBy: req.query.sortBy || 'filename',
      sortOrder: req.query.sortOrder || 'asc',
    };

    const result = await getDocuments(organizationId, options);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error listing documents:', error);
    res.status(500).json({ error: 'Failed to list documents' });
  }
};

/**
 * @desc    Update document metadata
 * @route   PUT /api/sharedoc/:id
 * @access  Private
 */
export const updateSharedocDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;
    const updates = req.body;

    const document = await updateDocument(id, organizationId, updates);
    res.json({ success: true, data: document });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error updating document:', error);
    res.status(500).json({ error: 'Failed to update document' });
  }
};

/**
 * @desc    Delete document (soft delete)
 * @route   DELETE /api/sharedoc/:id
 * @access  Private
 */
export const deleteSharedocDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    await deleteDocument(id, organizationId);
    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

/**
 * @desc    Download document
 * @route   GET /api/sharedoc/:id/download
 * @access  Private
 */
export const downloadSharedocDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { organizationId } = req.user;

    const fileInfo = await downloadDocument(id, organizationId);
    if (!fileInfo) {
      return res.status(404).json({ error: 'Document not found or cannot be downloaded' });
    }

    // For now, we'll get a signed URL or stream
    // In a real implementation, we might redirect to a signed URL or stream the file
    // For simplicity, we'll return the file info and let the frontend handle it
    // Alternatively, we could use the storage service to get a signed URL
    const { getFileUrl } = require('../../services/storage.service.js');
    const url = await getFileUrl(fileInfo.key);

    res.json({
      success: true,
      data: {
        ...fileInfo,
        downloadUrl: url,
      }
    });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error preparing download:', error);
    res.status(500).json({ error: 'Failed to prepare download' });
  }
};

/**
 * @desc    Create a new version of a document
 * @route   POST /api/sharedoc/:id/version
 * @access  Private
 */
export const createSharedocVersion = async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const { organizationId } = req.user;
    const uploadedById = req.user.id;
    const changeLog = req.body.changeLog || 'New version';

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided for version' });
    }

    const version = await createVersion(
      documentId,
      organizationId,
      req.file,
      uploadedById,
      changeLog
    );

    res.status(201).json({ success: true, data: version });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error creating version:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
};

/**
 * @desc    Get document versions
 * @route   GET /api/sharedoc/:id/versions
 * @access  Private
 */
export const getSharedocDocumentVersions = async (req, res) => {
  try {
    const { id: documentId } = req.params;
    const { organizationId } = req.user;

    const versions = await getDocumentVersions(documentId, organizationId);
    res.json({ success: true, data: versions });
  } catch (error) {
    logger.error('[SHAREDOC CONTROLLER] Error fetching document versions:', error);
    res.status(500).json({ error: 'Failed to fetch document versions' });
  }
};
