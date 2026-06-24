# GED OS — Agent Guide

## CI/CD
Le déploiement est automatique : un push sur `main` déclenche les tests backend, puis le déploiement sur le VPS via SSH.

## Commands
```bash
# Backend
cd backend && npm run dev          # dev server with nodemon
cd backend && npm test              # all vitest tests
cd backend && npm run lint          # ESLint

# Frontend
cd frontend && npm run dev          # Vite dev server
cd frontend && npm run test:unit    # Vitest frontend tests
cd frontend && npm run test:e2e     # Playwright E2E

# Mobile
cd mobile/gedcollect && npx expo start
```

## Structure
- `backend/` — Express.js API (ESM modules, `import`/`export`)
- `frontend/` — React + Vite + TypeScript
- `mobile/gedcollect/` — React Native (Expo)

## Conventions
- **Backend tests**: Vitest + supertest. Mock `prisma` and `auth` middleware. Pattern in `src/api/routes/__tests__/projectTemplates.api.test.js`.
- **Lint**: `npm run lint` (ESLint, backend), no lint for mobile yet.
- **TypeScript**: `npx tsc --noEmit` in mobile dir to typecheck.
- **Database**: Prisma ORM, PostgreSQL. Run `npx prisma generate` after schema changes.
- **Auth**: JWT via `authProtect` middleware. Role/permission checks via `authorize('perm.key')`.

## Key Modules
- `toolbox/` — XLSForm engine, form management, submissions, webhooks (hooks)
- `alerts/` — Alerting engine
- `mission/` — Mission management
- `project/` — Project CRUD

## Mobile
- `mobile/gedcollect/` — React Native app
- Offline-first: drafts stored locally via `@services/storage`
- API layer in `src/services/api.ts` — dynamic `AsyncStorage`-based URL

## CI/CD
- GitHub Actions runs backend vitest tests on push/PR to main.
- On push to `main`: if tests pass, auto-deploy to VPS via SSH.
