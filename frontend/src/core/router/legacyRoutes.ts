/**
 * Registre des redirections historiques (Legacy Routes)
 * Permet de rediriger automatiquement les anciennes URLs vers les nouvelles adresses GEM OS.
 */
export const LEGACY_ROUTES_MAP: Record<string, string> = {
  '/dashboard': '/executive/dashboard',
  '/home': '/projects',
  '/admin/project-creation': '/projects/create',
  '/admin/project-edit/:id': '/projects/edit/:id',
  '/terrain': '/operations/map',
  '/admin/ged-os-collect': '/operations/collect',
  '/planning': '/operations/missions',
  '/bordereau': '/operations/delivery',
  '/logistique': '/resources/inventory',
  '/atelier': '/resources/workshop',
  '/admin/pv-automation': '/quality/pv',
  '/admin/approval': '/governance/approvals',
  '/charges': '/finance/budget',
  '/simulation': '/finance/simulation',
  '/sharedoc': '/documents/library',
  '/cahier': '/documents/specifications',
  '/finances': '/finance/budget'
};
