import logger from '../../utils/logger.js';
import { assistantService } from './assistant.service.pro.js';

export const handleQuery = async (req, res) => {
    try {
        const { userId, message, context = {}, location = {}, offlineMode = false } = req.body;
        const requester = req.user || {};

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required.' });
        }

        const result = await assistantService.handleQuery(userId, message, context);

        return res.json(result);
    } catch (error) {
        logger.error('AI Query failed', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Unable to process AI query', details: error.message });
    }
};

export const saveMemory = async (req, res) => {
    try {
        const { userId, memory } = req.body;
        const requester = req.user || {};

        if (!userId || !memory || typeof memory !== 'object') {
            return res.status(400).json({ error: 'userId and memory payload are required.' });
        }

        if (requester.id !== userId && requester.role?.toUpperCase() !== 'ADMIN_PROQUELEC' && requester.role?.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ error: 'Vous ne pouvez enregistrer la mémoire que pour votre propre compte.' });
        }

        const saved = await assistantService.saveUserMemory(userId, memory, requester.organizationId);
        return res.json(saved);
    } catch (error) {
        logger.error('Save AI memory failed', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Unable to save memory', details: error.message });
    }
};

export const getMemory = async (req, res) => {
    try {
        const { userId } = req.params;
        const requester = req.user || {};

        if (!userId) {
            return res.status(400).json({ error: 'userId param is required.' });
        }

        if (requester.id !== userId && requester.role?.toUpperCase() !== 'ADMIN_PROQUELEC' && requester.role?.toUpperCase() !== 'ADMIN') {
            return res.status(403).json({ error: 'Accès refusé à la mémoire de cet utilisateur.' });
        }

        const memory = await assistantService.loadUserMemory(userId, requester.organizationId);
        return res.json(memory || { userId, preferences: {}, history: [], frequentTopics: [], lastInteractions: [], technicalLevel: 'medium' });
    } catch (error) {
        logger.error('Get AI memory failed', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Unable to load memory', details: error.message });
    }
};
