# 🔒 GEM SAAS - RESERVED PORTS CONFIGURATION

## ⚠️ IMPORTANT: Ports Réservés pour GEM SAAS

Les ports suivants sont **exclusivement réservés** pour l'application GEM SAAS et ne doivent **pas être modifiés**.

### Ports Réservés

| Service | Port | URL | Description |
|---------|------|-----|-------------|
| **Backend API** | `8888` | http://localhost:8888 | Serveur Node.js/Express |
| **Frontend Dev** | `8889` | http://localhost:8889 | Serveur Vite en développement |
| **Frontend Preview** | `8890` | http://localhost:8890 | Serveur de preview/production |

### Variables d'Environnement

Ces ports sont configurés dans :
- `backend/.env` → `PORT=8888`
- `package.json` → `--port 8889`
- `frontend/vite.config.ts` → `port: 8889` et `port: 8890`
- `backend/src/core/config/config.js` → CORS origins

### 🚀 Démarrer GEM SAAS

```bash
npm run dev:saas
```

Cela va:
1. ✅ Valider que les ports 8888/8889/8890 sont correctement configurés
2. ✅ Lancer le backend sur `8888`
3. ✅ Lancer le frontend sur `8889`

### 🔧 Commandes d'Entretien

```bash
# Valider que les ports GEM sont corrects
npm run validate-ports

# Réparer les ports GEM si modifiés accidentellement
npm run validate-ports:fix
```

### ❌ NE PAS MODIFIER

Les fichiers suivants **NE DOIVENT PAS être modifiés** pour changer les ports:
- ❌ `backend/.env` (PORT=8888)
- ❌ `package.json` (--port 8889)
- ❌ `frontend/vite.config.ts` (port: 8889, port: 8890)
- ❌ `backend/src/core/config/config.js` (CORS origins)
- ❌ `backend/src/server.js` (FRONTEND_URL fallback)

### 📋 Fichiers de Configuration

- **`.ged-os-ports.json`** — Fichier de référence avec tous les ports réservés
- **`scripts/validate-gem-ports.mjs`** — Valide que les ports sont corrects
- **`scripts/fix-gem-ports.mjs`** — Restaure les ports en cas de modification

### 🛡️ Protection Automatique

Chaque fois que vous lancez `npm run dev:saas`, le script vérifie automatiquement que les ports sont corrects. Si une autre application a modifié les fichiers de configuration, vous verrez:

```
🚨 PORT VALIDATION FAILED - Some GEM ports are incorrect!
Please run: npm run validate-ports:fix
```

Lancez simplement `npm run validate-ports:fix` pour restaurer les ports automatiquement.

### 🔗 Accès à l'Application

Une fois `npm run dev:saas` lancé, accédez à:

**http://localhost:8889**

---

**Dernière mise à jour:** 2026-05-12  
**Application:** PROQUELEC GEM SAAS  
**Status:** 🔒 Ports Protégés
