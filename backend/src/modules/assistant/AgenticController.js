import { agenticService } from './AgenticService.js';
import logger from '../../utils/logger.js';

export const analyzeQuery = async (req, res) => {
    try {
        const { message, context } = req.body;
        const userId = req.user.id;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const result = await agenticService.analyze(userId, message, context);
        return res.json(result);
    } catch (error) {
        logger.error('Agentic analysis failed', error);
        return res.status(500).json({ error: 'Failed to analyze query' });
    }
};

export const executeAction = async (req, res) => {
    try {
        const { action } = req.body;
        const userId = req.user.id;

        if (!action) {
            return res.status(400).json({ error: 'Action payload is required' });
        }

        const result = await agenticService.execute(userId, action);
        return res.json(result);
    } catch (error) {
        logger.error('Agentic execution failed', error);
        return res.status(500).json({ error: 'Failed to execute action' });
    }
};
