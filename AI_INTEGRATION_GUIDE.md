# 🔧 Guide d'Intégration IA pour Développeurs

**Version:** 1.0  
**API Version:** /api/assistant  
**Cost:** $0 (100% Local)

---

## 📍 Points d'Intégraton

### 1. Correction de Texte

**Endpoint:** `POST /api/assistant/query`

```bash
curl -X POST http://localhost:3000/api/assistant/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "corrige ce texte: l equipe a travailé dur",
    "context": "correction_texte",
    "mode": "pro"
  }'
```

**Response:**
```json
{
  "response": "L'équipe a travaillé dur",
  "metadata": {
    "type": "correction",
    "confidence": 0.95
  },
  "circuitState": {
    "serviceName": "ollama",
    "state": "CLOSED",
    "requestTime": 125
  }
}
```

---

### 2. Suggestions Intelligentes

**Endpoint:** `GET /api/assistant/suggestions`

```bash
curl http://localhost:3000/api/assistant/suggestions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "suggestions": [
    {
      "type": "anomaly",
      "severity": "warning",
      "message": "Équipe Maçons en retard de 15%",
      "action": "Revoir cadence de travail",
      "dataPoint": "12 ménages/jour vs 14 attendus"
    },
    {
      "type": "opportunity",
      "severity": "info",
      "message": "Région Thiès avance bien",
      "action": "Prioriser zones plus lentes",
      "dataPoint": "+35% d'avancement"
    }
  ]
}
```

---

### 3. Q&A Conversationnel

**Endpoint:** `POST /api/assistant/ask`

```javascript
// Frontend example
const response = await fetch('/api/assistant/ask', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: "Quelle équipe a la meilleure productivité ?",
    context: "dashboard",
    filters: { region: "thiès", dateRange: "30d" }
  })
});

const data = await response.json();
console.log(data.answer);
// Output: "Équipe Installation: 12.4 ménages/jour (+8% vs moyenne)"
```

---

### 4. Rapport Automatique

**Endpoint:** `POST /api/assistant/report`

```bash
curl -X POST http://localhost:3000/api/assistant/report \
  -H "Content-Type: application/json" \
  -d '{
    "type": "monthly",
    "format": "pdf",
    "includeAI": true
  }'
```

**Response:** PDF binary stream avec sections IA-générées

---

## 🛠️ Intégration Frontend HTML

### Bouton Correction Texte

```html
<!-- Dans votre textarea -->
<div class="relative">
  <textarea id="rapport" placeholder="Écrivez votre rapport..."></textarea>
  
  <!-- Bouton IA -->
  <div class="absolute top-2 right-2 space-x-2">
    <button onclick="aiCorrect()" class="px-3 py-1 bg-indigo-500 text-white rounded text-sm">
      ✨ Corriger
    </button>
    <button onclick="aiImprove()" class="px-3 py-1 bg-indigo-500 text-white rounded text-sm">
      🎨 Améliorer
    </button>
  </div>
</div>

<script>
async function aiCorrect() {
  const text = document.getElementById('rapport').value;
  
  const response = await fetch('/api/assistant/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Corrige ceci: ${text}`,
      context: 'correction_texte',
      mode: 'pro'
    })
  });
  
  const data = await response.json();
  document.getElementById('rapport').value = data.response;
}

async function aiImprove() {
  const text = document.getElementById('rapport').value;
  
  const response = await fetch('/api/assistant/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Améliore le style de ceci: ${text}`,
      context: 'improvement_texte',
      mode: 'pro'
    })
  });
  
  const data = await response.json();
  document.getElementById('rapport').value = data.response;
}
</script>
```

---

### Panneau Suggestions

```html
<!-- Dashboard suggestions -->
<div id="suggestionsPanel" class="bg-indigo-50 p-4 rounded-lg">
  <h3 class="font-bold mb-3">💡 Suggestions IA</h3>
  <div id="suggestionsList" class="space-y-2"></div>
</div>

<script>
async function loadSuggestions() {
  const response = await fetch('/api/assistant/suggestions', {
    headers: { 'Authorization': `Bearer ${getToken()}` }
  });
  
  const data = await response.json();
  const html = data.suggestions.map(s => `
    <div class="border-l-4 border-${s.severity === 'warning' ? 'amber' : 'blue'}-400 
                pl-4 py-2 bg-white rounded">
      <p class="font-bold text-sm">${s.message}</p>
      <p class="text-xs text-gray-600">${s.action}</p>
      <p class="text-xs text-gray-500">${s.dataPoint}</p>
    </div>
  `).join('');
  
  document.getElementById('suggestionsList').innerHTML = html;
}

// Auto-refresh suggestions toutes les 5min
setInterval(loadSuggestions, 300000);
loadSuggestions(); // Initial load
</script>
```

---

### Chat IA Conversationnel

```html
<div class="flex flex-col h-96 border rounded-lg">
  <!-- Messages -->
  <div id="chatMessages" class="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
    <!-- Messages apparaissent ici -->
  </div>
  
  <!-- Input -->
  <div class="border-t p-3 flex gap-2">
    <input 
      id="chatInput" 
      type="text" 
      placeholder="Posez une question sur vos données..."
      class="flex-1 px-3 py-2 border rounded-lg outline-none"
    />
    <button onclick="sendQuestion()" class="px-4 py-2 bg-indigo-500 text-white rounded-lg">
      📤 Envoyer
    </button>
  </div>
</div>

<script>
async function sendQuestion() {
  const question = document.getElementById('chatInput').value;
  if (!question.trim()) return;
  
  // Ajouter question à l'UI
  appendMessage(question, 'user');
  document.getElementById('chatInput').value = '';
  
  // Appel IA
  const response = await fetch('/api/assistant/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: question,
      context: 'dashboard'
    })
  });
  
  const data = await response.json();
  appendMessage(data.answer, 'assistant');
}

function appendMessage(text, role) {
  const messagesDiv = document.getElementById('chatMessages');
  const messageDiv = document.createElement('div');
  messageDiv.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'}`;
  messageDiv.innerHTML = `
    <div class="max-w-xs px-3 py-2 rounded-lg ${
      role === 'user' 
        ? 'bg-indigo-500 text-white' 
        : 'bg-white text-gray-800 border'
    }">
      ${text}
    </div>
  `;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}
</script>
```

---

## 🔌 Intégration Backend Node.js

### Using AIRouterService

```javascript
// src/modules/assistant/services/AIRouterService.js
import { AIRouterService } from './AIRouterService.js';

// Initialiser
const missionSage = new MissionSageService();
const ollamaQuery = async (prompt) => {
  return await ollama.generate({ prompt, model: 'qwen2.5-coder' });
};

const aiRouter = new AIRouterService();
aiRouter.initialize(missionSage, ollamaQuery);

// Utiliser
export async function queryAI(message, context) {
  try {
    const result = await aiRouter.query(message, context);
    return {
      response: result.response,
      circuitState: result.circuitState,
      metadata: result.metadata
    };
  } catch (error) {
    logger.error('AI Query failed:', error);
    throw new Error('Service temporarily unavailable');
  }
}
```

### Wrapper Service

```javascript
// src/services/AssistantServicePro.js
import { AIRouterService } from '../modules/assistant/services/AIRouterService.js';

export class AssistantServicePro {
  async correctText(text) {
    const aiRouter = AIRouterService.getInstance();
    return aiRouter.query(`Corrige ceci: ${text}`, { type: 'correction' });
  }
  
  async improveText(text) {
    const aiRouter = AIRouterService.getInstance();
    return aiRouter.query(`Améliore le style: ${text}`, { type: 'improvement' });
  }
  
  async summarizeText(text) {
    const aiRouter = AIRouterService.getInstance();
    return aiRouter.query(`Résume en points-clés: ${text}`, { type: 'summary' });
  }
  
  async answerQuestion(question, context) {
    const aiRouter = AIRouterService.getInstance();
    return aiRouter.query(question, { type: 'qa', context });
  }
  
  async generateReport(dataPoints) {
    const aiRouter = AIRouterService.getInstance();
    const prompt = this.buildReportPrompt(dataPoints);
    return aiRouter.query(prompt, { type: 'report' });
  }
  
  buildReportPrompt(dataPoints) {
    // Construire prompt détaillé avec données
    return `
      Génère un rapport professionnel avec:
      - Titre & date
      - Résumé executive (2 paragraphes)
      - KPIs clés
      - Analyse par région
      - Recommandations
      
      Données:
      ${JSON.stringify(dataPoints, null, 2)}
    `;
  }
}

export default new AssistantServicePro();
```

### Express Routes

```javascript
// src/routes/assistantRoutes.js
import express from 'express';
import assistantService from './AssistantServicePro.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Correction texte
router.post('/correct', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const result = await assistantService.correctText(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Amélioration texte
router.post('/improve', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    const result = await assistantService.improveText(text);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Q&A
router.post('/ask', requireAuth, async (req, res) => {
  try {
    const { question, context } = req.body;
    const result = await assistantService.answerQuestion(question, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
router.get('/health', async (req, res) => {
  try {
    const aiRouter = AIRouterService.getInstance();
    const health = aiRouter.getHealthStatus();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

---

## 📊 Monitoring & Debugging

### Check Circuit Breaker State

```javascript
const aiRouter = AIRouterService.getInstance();
const state = aiRouter.getCircuitStates();

console.log('Ollama:', state.ollama);
// {
//   state: 'CLOSED',
//   failureCount: 0,
//   totalRequests: 542,
//   successRate: '99.63%',
//   lastError: null,
//   isHealthy: true
// }

console.log('MissionSage:', state.missionSage);
// {
//   state: 'ALWAYS_AVAILABLE',
//   isHealthy: true,
//   cost: '$0'
// }
```

### Get Detailed Metrics

```javascript
const metrics = aiRouter.getDetailedMetrics();
console.log(metrics);
// {
//   totalRequests: 542,
//   successfulRequests: 540,
//   failedRequests: 2,
//   avgDuration: 8.2,
//   byService: {
//     ollama: { total: 532, avgDuration: 8.1 },
//     missionSage: { total: 10, avgDuration: 5.3 }
//   },
//   estimatedCost: '$0.00'
// }
```

### Reset Circuit Breaker (Admin Only)

```javascript
// Force reset (reconnect to Ollama)
aiRouter.resetAll();
logger.info('Circuit breaker reset');

// Or via Admin endpoint
// POST /admin/ai/reset
```

---

## 🛡️ Error Handling

```javascript
async function safeQuery(message, context) {
  try {
    const aiRouter = AIRouterService.getInstance();
    const result = await aiRouter.query(message, context);
    
    // Check circuit state
    if (result.circuitState.state === 'OPEN') {
      logger.warn('Using MissionSage fallback');
    }
    
    return result.response;
    
  } catch (error) {
    if (error.message.includes('Circuit open')) {
      // Fallback is already being used
      logger.error('Both services down - returning cached response');
      return getCachedResponse(message);
    }
    
    throw new Error('AI service unavailable');
  }
}
```

---

## 🚀 Performance Tips

### 1. Cache Common Queries
```javascript
const cache = new Map();

async function queryWithCache(message, context) {
  const key = `${context}-${message.slice(0, 50)}`;
  
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const result = await aiRouter.query(message, context);
  cache.set(key, result);
  
  // Clear cache after 1h
  setTimeout(() => cache.delete(key), 3600000);
  
  return result;
}
```

### 2. Batch Requests
```javascript
async function batchCorrections(texts) {
  const aiRouter = AIRouterService.getInstance();
  
  const promises = texts.map(text =>
    aiRouter.query(`Corrige: ${text}`, { type: 'correction' })
  );
  
  return Promise.all(promises);
}

// Usage
const corrected = await batchCorrections([
  "texte 1 avec erreure",
  "texte 2 avec autre probleme",
  "texte 3 a corriger"
]);
```

### 3. Streaming (Pour longs textes)

```javascript
// Endpoint pour rapports longs
router.post('/stream-report', requireAuth, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  
  try {
    const { dataPoints } = req.body;
    const aiRouter = AIRouterService.getInstance();
    
    // Générer rapport par chunks
    for (const chunk of generateReportChunks(dataPoints)) {
      const result = await aiRouter.query(chunk, { type: 'report-chunk' });
      res.write(`data: ${JSON.stringify(result)}\n\n`);
    }
    
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});
```

---

## ✅ Checklist d'Intégration

- [ ] Importer AIRouterService
- [ ] Initialiser avec Ollama + MissionSage
- [ ] Ajouter routes API `/api/assistant/*`
- [ ] Fronted: Ajouter boutons IA (Corriger, Améliorer, etc)
- [ ] Test: Vérifier circuit breaker endpoint
- [ ] Monitoring: Configurer health checks
- [ ] Error handling: Implémenter fallback graceful
- [ ] Performance: Ajouter cache si nécessaire
- [ ] Sécurité: Vérifier authentification routes IA
- [ ] Documentation: Ajouter guides utilisateurs

---

## 📞 Support Développeurs

**Q:** Comment tester le circuit breaker ?
**A:** Stop Ollama, confirmez fallback à MissionSage:
```bash
docker stop ollama  # Arrêter Ollama
curl http://localhost:3000/api/ai/health  # Vérifier circuit = OPEN
# Restart après test
docker start ollama
```

**Q:** Comment déboguer une réponse IA faible ?
**A:** 
1. Check prompt quality
2. Verify Ollama model loaded
3. Look at raw Ollama response
4. Consider MissionSage accuracy

**Q:** Performance est lente ?
**A:**
1. Check CPU/memory de serveur
2. Monitor `/api/ai/health` metrics
3. Consider caching results
4. Batch requests si possible

---

**Status:** Production Ready  
**Cost:** $0/mois  
**Support:** Open Source

---

*Version 1.0 — 15 Avril 2026*
