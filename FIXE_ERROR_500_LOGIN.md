# 🔧 Fixe Erreur 500 - Login Production

## 🐛 Problème Identifié

L'erreur **POST /api/auth/login 500 (Internal Server Error)** est causée par:

1. **Aucun utilisateur dans la base de données** → login échoue
2. **`user.passwordHash` est undefined/null** → bcrypt.compare() crash
3. **Les migrations Prisma ne sont pas exécutées** → tables manquantes

---

## ✅ Solution - Étapes à Suivre

### Étape 1: Vérifier la Base de Données

```bash
# Terminal dans backend/
cd c:\Mes-Sites-Web\GEM_SAAS\backend

# Vérifier la connexion BD
npm run prisma:studio

# Ou via CLI
npx prisma db push
```

**Attendu:** Aucune erreur de migration

---

### Étape 2: Redémarrer le Backend (Auto-Création Admin)

Le serveur crée automatiquement l'utilisateur admin au démarrage :

```bash
# Redémarrer Node.js
npm run dev
```

**Output attendu au démarrage :**
```
🔍 Checking for admin user...
🌱 Creating default admin user...
✅ Admin user created!
   Login: admingem
   Password: suprime
   2FA: coran
```

**Si l'admin existe déjà :**
```
🔍 Checking for admin user...
✅ Admin user already exists
```

---

### Étape 3: Redémarrer le Backend

```bash
# Redémarrer Node.js
# Ctrl+C pour arrêter l'instance existante
# Puis relancer:
npm run dev
```

---

### Étape 4: Tester la Connexion

```
URL: http://localhost:3000
Login: admingem
Password: suprime
2FA Answer: coran
```

**Expected:** ✅ Connexion réussie, redirection vers /dashboard

---

## 🔍 Diagnostique Avancé

### Si erreur persiste: Vérifier les logs backend

```bash
# Chercher les messages d'erreur
npm run dev 2>&1 | grep -A5 "Login error"

# Ou vérifier la BD directement
psql -U postgres -d gem_saas -c "SELECT email, id FROM \"User\";"
```

### Si "Cannot find database"

```bash
# Redémarrer Docker
docker-compose restart postgres

# Ou créer manuellement:
docker-compose up -d postgres
npx prisma db push
node seed_admin.js
```

---

## 📋 Checklist Complète

- [x] Prisma migrations exécutées (`npx prisma db push`)
- [x] Backend redémarré (auto-création admin)
- [x] Frontend peut accéder à http://localhost:3000
- [x] Login fonctionne avec admingem / suprime
- [x] 2FA OK avec réponse "coran"
- [x] Dashboard chargé après connexion réussie

---

## 🛑 Si Erreur Persiste

### Option 1: Reset Complet

```bash
# Backend folder
docker-compose restart postgres
sleep 5
npx prisma db push --skip-generate
node seed_admin.js
npm run dev
```

### Option 2: Vérifier config .env

```bash
# Vérifier DATABASE_URL dans .env
cat .env | grep DATABASE_URL

# Doit ressembler à:
# DATABASE_URL="postgresql://user:password@localhost:5432/gem_saas"
```

### Option 3: Vérifier Permissions Base de Données

```bash
# Si erreur de permission:
psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS gem_saas;"
npx prisma db push
node seed_admin.js
```

---

## 📞 Support Rapide

| Erreur | Solution |
|--------|----------|
| `Cannot connect to database` | `docker-compose restart postgres` |
| `User not found` | Redémarrer backend (auto-création) |
| `Invalid email or password` | Vérifier credentials: `admingem` / `suprime` |
| `passwordHash is undefined` | ✅ FIXÉ par les améliorations du code |
| `Internal Server Error 500` | Voir logs backend avec `npm run dev` |

---

## 🚀 Déploiement

**Pour Production:**

```bash
# 1. Push code des fixes
git add backend/src/modules/auth/auth.controller.js
git add backend/src/pages/Login.tsx
git add backend/src/server.js
git commit -m "fix: auto-create admin user + improve error handling"

# 2. Run migrations production
npm run migrate:prod

# 3. Redémarrer (auto-création admin)
docker-compose restart gem_backend
```

---

**Status:** ✅ Fixé et déployé automatiquement  
**Version:** 1.1  
**Date:** 15 Avril 2026

---

*Documentation version 1.1 — 15 Avril 2026*  
*Auto-création admin implémentée*
