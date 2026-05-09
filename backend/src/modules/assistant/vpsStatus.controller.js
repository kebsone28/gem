import { config } from '../../core/config/config.js';
import logger from '../../utils/logger.js';

/**
 * GET /api/assistant/vps/status
 * Vérifie l'état des services IA depuis le serveur (backend → localhost)
 * Résout le problème CORS/SSL en évitant les appels directs depuis le navigateur
 */
export const getVpsStatus = async (req, res) => {
    try {
        const results = {};
        const vpsHost = 'gem.proquelec.sn';
        logger.info(`[VPS STATUS] Starting AI services audit for ${vpsHost}...`);

        // 1. Test Ollama (Port 11434)
        // On utilise localhost car le backend tourne sur le même serveur
        const ollamaUrl = process.env.OLLAMA_BASE_URL || `http://localhost:11434`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const r = await fetch(`${ollamaUrl}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (r.ok || r.status === 401) {
                const data = await r.json().catch(() => ({}));
                const models = (data.models || []).map(m => m.name || m.model || String(m));
                results.ollama = { status: 'ok', url: ollamaUrl, models };
            } else {
                results.ollama = { status: 'error', url: ollamaUrl, code: r.status };
            }
        } catch (err) {
            results.ollama = { status: 'error', url: ollamaUrl, error: 'Connection timed out (Check Firewall/Port 11434)' };
        }

        // 2. Test code-server (Port 8080)
        const codeServerUrl = process.env.VPS_CODE_SERVER_URL || `http://${vpsHost}:8080`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const r = await fetch(codeServerUrl, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeout);
            results.codeserver = { status: (r.ok || r.status === 401) ? 'ok' : 'error', url: codeServerUrl };
        } catch (err) {
            results.codeserver = { status: 'error', url: codeServerUrl, error: err.message };
        }

        // 3. Test Open WebUI (Port 3000 par défaut)
        const webUiUrl = process.env.OPENWEBUI_URL || `http://localhost:3000`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const r = await fetch(webUiUrl, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeout);
            results.webui = { status: (r.ok || r.status === 401) ? 'ok' : 'error', url: webUiUrl };
        } catch (err) {
            results.webui = { status: 'error', url: webUiUrl, error: err.message };
        }

        return res.json(results);
    } catch (error) {
        logger.error('VPS Status check failed', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Internal server error during VPS audit' });
    }
};
