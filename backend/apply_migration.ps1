# Script PowerShell pour appliquer la migration carto_grappes
cd C:\Mes-Sites-Web\GED_SAAS\backend
psql -d electrification -f prisma/migration_carto_grappes.sql