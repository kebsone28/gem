# 📚 PROQUELEC Web Migration Guide (Electron → Web SaaS)

## 🎯 Project Overview

**Objective**: Transform PROQUELEC from Electron desktop app to Web SaaS hosted on Wanekoo shared hosting for 200+ concurrent users.

**Timeline**: Phases 1-9 (estimated 8-10 weeks)

**GitHub**: https://github.com/kebsone28/electron.git  
**Hosting**: Wanekoo (mutualisé, shared hosting)

---

## 📊 Architecture Decision

### Current Stack (Electron)
- Frontend: HTML/CSS/JS + TailwindCSS
- Desktop: Electron
- Database: IndexedDB (offline)
- Deployment: Windows installer

### New Stack (Web SaaS)
- Frontend: React + Vite + TailwindCSS (maintain existing code)
- Backend: Node.js + Express.js
- Database: PostgreSQL (primary) + IndexedDB (offline cache)
- Authentication: JWT + Refresh tokens
- Deployment: Docker single container on Wanekoo

### Authentication Roles
```
ADMIN        - Système admin, gestion utilisateurs, KPI globaux
SUPERVISEUR  - Gestion projet, équipes, alertes
TECHNICIEN   - Terrain, livraisons, collecte de données
```

---

## 🔧 Backend Structure Created

```
backend/
├── package.json                 (Dependencies)
├── .env.example                (Template)
├── .env.production             (Wanekoo secrets)
├── src/
│   ├── server.js               (Express entry point)
│   ├── middleware/
│   │   ├── auth.js             (JWT verification)
│   │   └── errorHandler.js     (Error manager)
│   ├── routes/
│   │   ├── auth.js             (Login/refresh tokens)
│   │   ├── kpi.js              (KPI aggregation)
│   │   ├── projects.js         (Project CRUD)
│   │   ├── teams.js            (Team management)
│   │   └── households.js       (Household status)
│   ├── db/
│   │   ├── connection.js       (Pool configuration for 200+ users)
│   │   └── schema.sql          (PostgreSQL tables + indexes)
│   └── utils/
│       └── logger.js           (Structured logging)
├── Dockerfile                   (Multi-stage build)
└── docker-compose.yml          (Nginx + App + PostgreSQL)
```

---

## 🗄️ PostgreSQL Schema

### Core Tables

**1. Users & Authentication**
- `users` - Utilisateurs (email, password_hash, role_id, status, last_login)
- `roles` - Rôles (ADMIN, SUPERVISEUR, TECHNICIEN)
- `team_members` - Affectation utilisateur-équipe
- `refresh_tokens` - Session tokens (pour revoke)

**2. Projects & Operations**
- `projects` - Projets (code, zone, start_date, end_date, target_households, budget)
- `households` - Ménages (status: planned/in-progress/electrified, costs)
- `teams` - Équipes (team_type: installation/supervision/logistics)
- `deliveries` - Livraisons électrification (avec date, team_id, status)

**3. KPI & Analytics**
- `kpi_snapshots` - Historique KPI (electricity_access_percent, budget_percent, igpp_score)
- `alerts` - Alertes critiques (stock, delay, budget, quality)
- `activity_logs` - Audit log de toutes les actions

**4. Sync & Offline Support**
- `sync_metadata` - Metadata pour offline-first (sync_status, last_synced_at)

### Optimization for 200+ Users

```sql
-- Connection pooling (25-30 max connections)
max_connections=250
shared_buffers=256MB
effective_cache_size=1GB

-- Indexes on frequently queried columns
idx_users_email_status
idx_households_project_status
idx_deliveries_project_date
idx_activity_logs_project_action
```

---

## 🔐 Authentication Flow

### Login Endpoint
```
POST /api/auth/login
Body: { email, password }
Response: { accessToken, refreshToken, user }
```

**Process**:
1. Lookup user by email
2. bcrypt.compare(password, stored_hash)
3. Generate JWT (expires 24h)
4. Generate refresh token (expires 7d)
5. Store refresh token hash in DB
6. Return both tokens

### Refresh Token Flow
```
POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken }
```

### Protected Routes
- Require `Authorization: Bearer <accessToken>` header
- Middleware verifies JWT signature + expiration
- Unauthorized routes return 401 Unauthorized

### Role-Based Access
```javascript
// Example: Only ADMIN can view summary
router.get('/api/kpi/summary', 
  authenticate,
  authorize(['ADMIN']),
  (req, res) => { ... }
)
```

---

## 📡 API Endpoints

### Public Routes (No Auth)
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/health` - Health check

### Protected Routes (JWT Required)

#### KPI Routes
```
GET  /api/kpi/project/:projectId           - Get latest KPI
POST /api/kpi/project/:projectId/snapshot   - Create snapshot
GET  /api/kpi/project/:projectId/history   - Last 30 days
GET  /api/kpi/summary                      - Admin summary
```

#### Project Routes
```
GET    /api/projects                  - List all
GET    /api/projects/:id              - Get one
POST   /api/projects                  - Create (ADMIN/SUPERVISEUR)
PATCH  /api/projects/:id              - Update (ADMIN/SUPERVISEUR)
```

#### Teams & Households
```
GET    /api/teams?projectId=X         - List teams
POST   /api/teams                     - Create team
GET    /api/households?projectId=X    - List households
POST   /api/households                - Create household
PATCH  /api/households/:id            - Update status
```

---

## 🐳 Docker Deployment

### Single Container Strategy (Shared Hosting)

```yaml
Nginx (Port 80/443)
  ↓
Express.js API (Port 3001)
  ↓
PostgreSQL (Port 5432)
```

### Build & Run

```bash
# Development
docker-compose up -d

# Will:
# 1. Build Node.js image (Dockerfile)
# 2. Start Nginx reverse proxy
# 3. Start Express API
# 4. Initialize PostgreSQL with schema.sql
# 5. Health checks on all services

# Health check
curl http://localhost/api/health
```

### Environment Template

Copy `.env.example` to `.env.production` and customize:
```bash
DBuser=proquelec_prod
DB_PASSWORD=<secure_password>
JWT_SECRET=<32_random_chars>
CORS_ORIGIN=https://proquelec.wanekoo.com
```

---

## 🌐 Frontend Integration (Phase 6)

### Current Frontend (Keep As-Is)
- Keep existing HTML files (index.html, parametres.html, etc.)
- Keep TailwindCSS styling
- Keep dark mode system
- Keep KPIService.js + scoreEngine.js

### Modifications Needed
```javascript
// Create: src/services/api.js
const API_BASE = process.env.API_URL || 'http://localhost:3001';

export async function apiCall(method, endpoint, data = null) {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: data ? JSON.stringify(data) : undefined
  });

  if (response.status === 401) {
    // Try refresh token
    await refreshToken();
  }
  
  return response.json();
}
```

### Routes to Update
1. **Login Page** - POST /api/auth/login instead of local storage
2. **KPI Loading** - GET /api/kpi/project/:id instead of IndexedDB
3. **Project Selection** - GET /api/projects instead of localStorage
4. **Data Submission** - POST endpoints for deliveries, households, etc.

---

## 📋 Phase Breakdown

### Phase 1: Backend Express Structure ✅ DONE
- [x] package.json avec dépendances
- [x] server.js avec routes de base
- [x] Middleware auth + errorHandler
- [x] Logger structuré

### Phase 2: PostgreSQL Schema ✅ DONE
- [x] Tables utilisateurs/projets/ménages
- [x] Tables KPI + historique
- [x] Indexes optimisés pour 200+ utilisateurs
- [x] Migration versioning ready

### Phase 3: JWT Authentication ✅ DONE
- [x] Login/refresh token routes
- [x] Password hashing (bcryptjs)
- [x] Token storage & revocation

### Phase 4: Docker Configuration ✅ DONE
- [x] Dockerfile multi-stage optimisé
- [x] docker-compose.yml (Nginx + App + DB)
- [x] nginx.conf avec reverse proxy + rate limiting
- [x] Health checks configurés

### Phase 5: KPI Backend Integration ⏳ TODO
- [ ] `/api/kpi/project/:id` endpoint
- [ ] Snapshot creation & caching
- [ ] IGPP calculation on backend (optional)
- [ ] Historique KPI 30 jours

### Phase 6: Frontend React Integration ⏳ TODO
- [ ] Create /frontend folder with Vite
- [ ] API service layer
- [ ] Login page component
- [ ] AuthContext for state management
- [ ] Connect all pages to backend

### Phase 7: Lovable Integration ⏳ TODO
- [ ] Link GitHub repo to Lovable
- [ ] Code generation for new features
- [ ] No-code capabilities for dialogs/modals

### Phase 8: GitHub Actions CI/CD ⏳ TODO
- [ ] Build Docker image on push
- [ ] Run tests before deployment
- [ ] Push to registry
- [ ] Auto-deploy to Wanekoo

### Phase 9: Wanekoo Deployment ⏳ TODO
- [ ] Register domain / DNS setup
- [ ] SSL certificate (Let's Encrypt via Certbot)
- [ ] Deploy Docker container
- [ ] Database backup automation
- [ ] Monitoring setup (logs, errors)

---

## 🚀 Local Development Quick Start

```bash
# 1. Copy environment
cp backend/.env.example backend/.env

# 2. Start Docker stack
docker-compose up -d

# 3. Wait for services (30s)
sleep 30

# 4. Test health
curl http://localhost/api/health
# Response: {"status":"OK",...}

# 5. Login test
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@proquelec.com","password":"admin123"}'

# 6. Access API
curl -H "Authorization: Bearer <accessToken>" \
  http://localhost/api/kpi/summary
```

---

## ⚠️ Production Checklist (Wanekoo Deployment)

- [ ] Generate secure JWT_SECRET & JWT_REFRESH_SECRET
- [ ] Generate secure DB_PASSWORD
- [ ] Configure CORS_ORIGIN = https://proquelec.wanekoo.com
- [ ] Setup Let's Encrypt SSL certificate
- [ ] Configure DNS A record → Wanekoo IP
- [ ] Test database backup automation
- [ ] Setup monitoring & error tracking (Sentry)
- [ ] Enable HTTP→HTTPS redirect
- [ ] Rate limiting tuned for 200 users
- [ ] Connection pooling max=30, min=8
- [ ] User load test (Apache JMeter / k6)
- [ ] Security audit (OWASP Top 10)
- [ ] Documentation for admins

---

## 📞 Support & Escalation

### Tech Debt
- [ ] Implement refresh token rotation (security best practice)
- [ ] Add 2FA for ADMIN users
- [ ] Implement GraphQL API (optional)
- [ ] Add WebSocket support for real-time alerts

### Performance Enhancements
- [ ] Redis caching layer (KPI snapshots)
- [ ] Background jobs (Bull queue) for heavy operations
- [ ] CDN for static assets
- [ ] Image optimization (Avatar, documents)

---

## 📄 References

- [Express.js Docs](https://expressjs.com/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc7519)
- [Docker Docs](https://docs.docker.com/)
- [Wanekoo Hosting](https://wanekoo.com/)

---

**Status**: Migration Phase 1-4 COMPLETED ✅  
**Last Updated**: 2025-02-28  
**Next Action**: Phase 5 - Backend KPI Integration
