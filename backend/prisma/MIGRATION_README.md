Steps to apply the new project models and defaultProjectId

1. Update Prisma client (generate)

  cd backend
  npx prisma generate --schema=prisma/schema.prisma

2. Create and run a migration (recommended: use a proper migration flow)

  npx prisma migrate dev --name add-project-templates --schema=prisma/schema.prisma

If you can't run `migrate dev` in your environment, you can use `prisma db push` to sync schema without a migration file:

  npx prisma db push --schema=prisma/schema.prisma

3. Initialize defaultProjectId for existing organizations

  node ./scripts/set_default_project.mjs

4. Restart backend and verify endpoints:

  npm run dev

Notes:
- Review added models `ProjectTemplate`, `ProjectPage`, `ProjectModule` and adjust access control as needed.
- Consider creating database backups before running migrations in production.
