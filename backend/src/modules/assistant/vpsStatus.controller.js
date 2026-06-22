import logger from '../../utils/logger.js';

/**
 * GET /api/assistant/vps/status
 * Vérifie l'état des services IA depuis le serveur (backend → localhost)
 * Résout le problème CORS/SSL en évitant les appels directs depuis le navigateur
 */
export const getVpsStatus = async (req, res) => {
    try {
        const results = {};
        const vpsHost = 'ged-os.proquelec.sn';
        logger.info(`[VPS STATUS] Starting AI services audit for ${vpsHost}...`);

        // 1. Test Ollama (Port 11434)
        const ollamaUrl = process.env.OLLAMA_BASE_URL || `http://localhost:11434`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);
            const r = await fetch(`${ollamaUrl}/api/tags`, { method: 'GET', signal: controller.signal });
            clearTimeout(timeout);
            if (r.ok || r.status === 401) {
                const data = await r.json().catch(() => ({}));
                const models = (data.models || []).map(m => m.name || m.model || String(m));
                results.ollama = { status: 'ok', url: ollamaUrl, models, hint: `✅ Ollama opérationnel sur ${ollamaUrl}. ${models.length} modèle(s) chargé(s).` };
            } else {
                results.ollama = { status: 'error', url: ollamaUrl, code: r.status, hint: `⚠️ Ollama répond avec le code HTTP ${r.status}. Vérifiez sa configuration ou ses logs.` };
            }
        } catch (err) {
            const isTimeout = err.name === 'AbortError';
            const isRefused = err.message?.includes('ECONNREFUSED');
            results.ollama = {
                status: 'error', url: ollamaUrl, error: err.message,
                hint: isTimeout
                    ? `⏱ Timeout (4s) : Ollama ne répond pas sur le port 11434. Sur le VPS, lancez : ollama serve`
                    : isRefused
                    ? `🔌 Connexion refusée : Ollama n'est pas démarré sur ce serveur. Sur le VPS, exécutez : ollama serve`
                    : `💻 En développement local, cette erreur est normale (Ollama n'est pas sur votre PC). Elle disparaîtra une fois déployé sur ged-os.proquelec.sn.`,
                command: 'ollama serve',
                isLocalDevOnly: !ollamaUrl.includes('localhost') ? false : true
            };
        }

        // 2. Test code-server (Port 8080)
        const codeServerUrl = process.env.VPS_CODE_SERVER_URL || `http://${vpsHost}:8080`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const r = await fetch(codeServerUrl, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeout);
            results.codeserver = {
                status: (r.ok || r.status === 401) ? 'ok' : 'error',
                url: codeServerUrl,
                hint: (r.ok || r.status === 401)
                    ? `✅ Code-Server accessible sur le port 8080. Environnement de dev opérationnel.`
                    : `⚠️ Code-Server répond avec le code ${r.status} sur ${codeServerUrl}.`
            };
        } catch (err) {
            const isTimeout = err.name === 'AbortError';
            results.codeserver = {
                status: 'error', url: codeServerUrl, error: err.message,
                hint: isTimeout
                    ? `⏱ Timeout (3s) : Code-Server (port 8080) ne répond pas.`
                    : `🔌 Code-Server inaccessible : ${err.message}`
            };
        }

        // 3. Test OpenHands agent UI (Port 3000)
        const openHandsUrl = process.env.OPENHANDS_URL || process.env.OPENWEBUI_URL || `http://localhost:3000`;
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const r = await fetch(openHandsUrl, { method: 'HEAD', signal: controller.signal });
            clearTimeout(timeout);
            results.openhands = {
                status: (r.ok || r.status === 401) ? 'ok' : 'error',
                url: openHandsUrl,
                hint: (r.ok || r.status === 401)
                    ? `✅ OpenHands opérationnel sur le port 3000. Agent local GED OS disponible.`
                    : `⚠️ OpenHands répond avec le code ${r.status}.`
            };
        } catch (err) {
            const isTimeout = err.name === 'AbortError';
            const isRefused = err.message?.includes('ECONNREFUSED');
            results.openhands = {
                status: 'error', url: openHandsUrl, error: err.message,
                hint: isTimeout
                    ? `⏱ Timeout (3s) : OpenHands (port 3000) ne répond pas. Conteneur Docker peut-être arrêté.`
                    : isRefused
                    ? `🐳 Connexion refusée : le conteneur OpenHands est arrêté. Relancez scripts/start-ged-agent.ps1.`
                    : `❓ Erreur : ${err.message}`,
                command: 'powershell.exe -ExecutionPolicy Bypass -File .\\scripts\\start-ged-agent.ps1'
            };
        }

        // Backward compatibility for older frontend builds.
        results.webui = results.openhands;

        return res.json(results);
    } catch (error) {
        logger.error('VPS Status check failed', { error: error.message, stack: error.stack });
        return res.status(500).json({ error: 'Internal server error during VPS audit' });
    }
};
