# Configuration Ollama pour PROQUELEC

## 🎯 État actuel

- ✅ Endpoint Ollama détecté sur `https://proquelec.wanekoohost.com`
- ⚠️ Authentification requise (HTTP 401)
- 🤖 Modèle cible : `qwen2.5-coder:7b`

## 📋 Étapes de configuration

### Option 1 : Mode développement (sans authentification)

**Sur le serveur Ollama** :

```bash
# Démarrer Ollama sans authentification + CORS activé
export OLLAMA_CORS=*
export OLLAMA_AUTH=false
ollama serve
```

Ensuite laisser les variables dans `.env` vides :

```env
OLLAMA_AUTH_TOKEN=
```

### Option 2 : Mode production (avec authentification)

**Sur le serveur Ollama** :

```bash
# Démarrer Ollama avec authentification
export OLLAMA_CORS=*
export OLLAMA_AUTH=true
ollama serve
```

Générer un token et l'ajouter à `.env` :

```env
OLLAMA_AUTH_TOKEN=votre_token_genere_ici
```

## 🔍 Vérification

### Test local (du serveur)

```bash
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5-coder:7b","prompt":"test","stream":false}'
```

### Test distant (depuis le backend)

```bash
cd backend
node test_ollama_simple.mjs
```

## 📝 Configuration dans `.env`

Le `.env` est déjà configuré avec :

```env
OLLAMA_BASE_URL=https://proquelec.wanekoohost.com
OLLAMA_MODEL=qwen2.5-coder:7b
OLLAMA_AUTH_TOKEN=             # À remplir si authentification requise
```

## 🚀 Workflow du système

```txt
POST /api/ai/query
    ↓
[AI Router]
    ├─ Intent: "analyse données" → DataAgent
    ├─ Intent: "erreur technique" → TechAgent
    ├─ Intent: "bonjour" → MissionSage (local)
    ↓
[Agent exécution]
    ├─ Planification via Ollama
    ├─ Exécution des outils métiers
    ├─ Retour résultat humanisé
    ↓
Response avec: {
    response: "...",
    intent: "...",
    emotion: "...",
    route: "agent",
    model: "TechAgent|DataAgent|SupportAgent",
    agent: "...",
    semanticContext: [...]
}
```

## 🔧 Troubleshooting

| Problème | Solution |
|----------|----------|
| HTTP 401 Unauthorized | Configurer `OLLAMA_AUTH_TOKEN` ou démarrer Ollama sans auth |
| Connexion timeout | Vérifier firewall, CORS, URL de base |
| Modèle non trouvé | Vérifier que `qwen2.5-coder:7b` est bien installé : `ollama list` |
| Lenteur | Normal pour LLM local, configurer cache TTL plus haut |

## ✅ Prêt pour

- ✅ Hybride Cloud/Edge (OpenAI + Ollama)
- ✅ Agents autonomes (TechAgent, DataAgent, SupportAgent)
- ✅ Cache intelligent Redis/local
- ✅ Mémoire vectorielle sémantique
- ✅ Routage multi-modèles intelligent

## 📞 Support

Pour toute question :
- Vérifier les logs du backend
- Tester manuellement avec `test_ollama_simple.mjs`
- Consulter la documentation Ollama officielle
