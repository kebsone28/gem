import logger from '../../utils/logger.js';
import { assistantService } from './assistant.service.pro.js';
import { processMentorAI } from './mentor.service.js';
import {
    mentorTrainingService,
    isMentorTrainingAdmin,
    safeMentorTrainingError
} from './mentorTraining.service.js';

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

export const handleMentorQuery = async (req, res) => {
    try {
        const requester = req.user || {};
        const { message, context = {}, history = [], image = '' } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({ error: 'message is required.' });
        }

        const result = await processMentorAI({
            query: message,
            user: requester,
            state: context,
            history,
            image
        });

        return res.json(result);
    } catch (error) {
        logger.error('Mentor AI query failed', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Unable to process mentor AI query', details: error.message });
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

export const listMentorTrainingEntries = async (req, res) => {
    try {
        const requester = req.user || {};
        if (!isMentorTrainingAdmin(requester)) {
            return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
        }

        const entries = await mentorTrainingService.listEntries(requester.organizationId);
        return res.json(entries);
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'Unable to list mentor training entries', details: safeMentorTrainingError(error) });
    }
};

export const saveMentorTrainingEntry = async (req, res) => {
    try {
        const requester = req.user || {};
        if (!isMentorTrainingAdmin(requester)) {
            return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
        }

        const { question, answer } = req.body;
        if (!question || !answer) {
            return res.status(400).json({ error: 'question and answer are required.' });
        }

        const entry = await mentorTrainingService.saveEntry({
            organizationId: requester.organizationId,
            question,
            answer,
            createdBy: requester.email || requester.id || null
        });

        return res.status(201).json(entry);
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'Unable to save mentor training entry', details: safeMentorTrainingError(error) });
    }
};

export const deleteMentorTrainingEntry = async (req, res) => {
    try {
        const requester = req.user || {};
        if (!isMentorTrainingAdmin(requester)) {
            return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
        }

        const { entryId } = req.params;
        if (!entryId) {
            return res.status(400).json({ error: 'entryId param is required.' });
        }

        const entry = await mentorTrainingService.closeEntry({
            organizationId: requester.organizationId,
            entryId,
            closedBy: requester.email || requester.id || null
        });

        return res.json(entry);
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'Unable to close mentor training entry', details: safeMentorTrainingError(error) });
    }
};

export const acceptMentorTrainingEntry = async (req, res) => {
    try {
        const requester = req.user || {};
        if (!isMentorTrainingAdmin(requester)) {
            return res.status(403).json({ error: 'Accès réservé aux administrateurs.' });
        }

        const { entryId } = req.params;
        if (!entryId) {
            return res.status(400).json({ error: 'entryId param is required.' });
        }

        const entry = await mentorTrainingService.acceptEntry({
            organizationId: requester.organizationId,
            entryId,
            acceptedBy: requester.email || requester.id || null
        });

        return res.json(entry);
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'Unable to accept mentor training entry', details: safeMentorTrainingError(error) });
    }
};

export const findMentorTrainingMatch = async (req, res) => {
    try {
        const requester = req.user || {};
        const { question } = req.body;

        if (!question || typeof question !== 'string') {
            return res.status(400).json({ error: 'question is required.' });
        }

        const entry = await mentorTrainingService.findMatch({
            organizationId: requester.organizationId,
            question
        });

        return res.json(entry || null);
    } catch (error) {
        return res
            .status(500)
            .json({ error: 'Unable to find mentor training match', details: safeMentorTrainingError(error) });
    }
};
