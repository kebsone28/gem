/**
 * Atomic Permissions Registry
 * (Pour la normalisation JWT / matrice admin, référence canonique côté API : `permissionNormalization.js`.)
 *
 * Replaces role-based fallback with explicit permission requirements.
 * Each permission represents a specific action in the system.
 *
 * Structure: domain.resource.action
 * Example: project.view, mission.create, household.edit
 */

export const ATOMIC_PERMISSIONS = {
  // Organization Management
  'organization.view': 'View organization details',
  'organization.edit': 'Edit organization settings',
  'organization.delete': 'Delete organization',

  // Project Management
  'project.view': 'View projects',
  'project.create': 'Create new projects',
  'project.edit': 'Edit project settings',
  'project.delete': 'Delete projects',
  'project.template.manage': 'Manage project templates',

  // Modules & Pages
  'project.module.manage': 'Manage project modules and pages',
  'project.module.view': 'View project modules',

  // Mission Management
  'mission.view': 'View missions',
  'mission.create': 'Create missions',
  'mission.edit': 'Edit missions',
  'mission.delete': 'Delete missions',
  'mission.approve': 'Approve missions',
  'mission.reject': 'Reject missions',
  'mission.assign': 'Assign missions to teams',

  // Household Management
  'household.view': 'View households',
  'household.create': 'Create households',
  'household.edit': 'Edit household details',
  'household.delete': 'Delete households',
  'household.export': 'Export household data',

  // Team Management
  'team.view': 'View teams',
  'team.create': 'Create teams',
  'team.edit': 'Edit teams',
  'team.delete': 'Delete teams',
  'team.assign.user': 'Assign users to teams',

  // User Management
  'user.view': 'View users',
  'user.create': 'Create users',
  'user.edit': 'Edit user details',
  'user.delete': 'Delete users',
  'user.manage.roles': 'Manage user roles and permissions',
  'user.manage.password': 'Reset user passwords',

  // Reporting & Analytics
  'report.view': 'View reports',
  'report.create': 'Create reports',
  'report.export': 'Export reports',

  // Kobo & Data Sync
  'kobo.manage': 'Manage Kobo form mappings',
  'kobo.sync': 'Trigger Kobo data synchronization',
  'sync.view': 'View sync logs',
  'data.export': 'Export data',
  'data.import': 'Import data',

  // Formation & Training
  'formation.view': 'View formation modules',
  'formation.manage': 'Manage formation content',

  // Chat & Communication
  'chat.send': 'Send chat messages',
  'chat.view': 'View chat conversations',
  'chat.manage': 'Manage chat settings',

  // Security & Audit
  'audit.view': 'View audit logs',
  'security.manage': 'Manage security settings',
  'security.2fa.manage': '2FA management',
};

/**
 * Permission Groups by Role
 * Maps roles to sets of atomic permissions
 */
export const ROLE_PERMISSION_MAP = {
  ADMIN_PROQUELEC: [
    '*', // Superadmin - all permissions
  ],

  ADMIN: [
    '*', // All permissions
  ],

  DIRECTEUR: [
    // Organization
    'organization.view',
    'organization.edit',

    // Projects
    'project.view',
    'project.create',
    'project.edit',
    'project.delete',

    // Modules
    'project.module.view',
    'project.module.manage',

    // Missions
    'mission.view',
    'mission.create',
    'mission.edit',
    'mission.delete',
    'mission.approve',
    'mission.assign',

    // Teams
    'team.view',
    'team.create',
    'team.edit',
    'team.delete',

    // Users
    'user.view',
    'user.create',
    'user.edit',
    'user.manage.roles',

    // Reports
    'report.view',
    'report.create',
    'report.export',

    // Data
    'data.export',
    'kobo.manage',

    // Audit
    'audit.view',
  ],

  CHEF_PROJET: [
    // Project
    'project.view',
    'project.edit',

    // Modules
    'project.module.view',
    'project.module.manage',

    // Missions
    'mission.view',
    'mission.create',
    'mission.edit',
    'mission.approve',
    'mission.assign',

    // Teams
    'team.view',
    'team.edit',
    'team.assign.user',

    // Users
    'user.view',

    // Reports
    'report.view',
    'report.create',

    // Data
    'data.export',

    // Chat
    'chat.send',
    'chat.view',
  ],

  SUPERVISEUR: [
    // Project
    'project.view',

    // Modules
    'project.module.view',

    // Missions
    'mission.view',
    'mission.edit',
    'mission.approve',

    // Households
    'household.view',
    'household.edit',

    // Teams
    'team.view',

    // Reports
    'report.view',

    // Chat
    'chat.send',
    'chat.view',

    // Data
    'data.export',
  ],

  CHEF_EQUIPE: [
    // Project
    'project.view',

    // Missions
    'mission.view',
    'mission.edit',
    'mission.assign',

    // Households
    'household.view',
    'household.edit',

    // Teams
    'team.view',

    // Chat
    'chat.send',
    'chat.view',
  ],

  EMPLOYE: [
    // Project
    'project.view',

    // Missions
    'mission.view',
    'mission.edit',

    // Households
    'household.view',

    // Chat
    'chat.send',
    'chat.view',
  ],

  CLIENT: [
    // Limited read-only access
    'project.view',
    'report.view',
    'household.view',
    'chat.view',
  ],
};

/**
 * Check if user has permission
 *
 * @param {string[]} userPermissions - User's explicit permissions array
 * @param {string} requiredPermission - Permission to check (e.g., 'project.create')
 * @param {string} userRole - User's role for fallback check
 * @returns {boolean}
 */
export const hasPermission = (userPermissions = [], requiredPermission, userRole = null) => {
  // Check explicit permissions first
  if (userPermissions?.includes(requiredPermission)) {
    return true;
  }

  // Check wildcard permission
  if (userPermissions?.includes('*')) {
    return true;
  }

  // Fall back to role-based permissions if role provided
  if (userRole) {
    const rolePermissions = ROLE_PERMISSION_MAP[userRole] || [];
    if (rolePermissions.includes('*')) {
      return true;
    }
    return rolePermissions.includes(requiredPermission);
  }

  return false;
};

/**
 * Get all permissions for a user
 *
 * Combines explicit permissions + role-based permissions
 *
 * @param {string[]} userPermissions - Explicit permissions
 * @param {string} userRole - User's role
 * @returns {string[]} - All permissions user has
 */
export const getAllPermissions = (userPermissions = [], userRole = null) => {
  const explicit = new Set(userPermissions || []);

  if (userRole) {
    const rolePerms = ROLE_PERMISSION_MAP[userRole] || [];
    rolePerms.forEach(p => explicit.add(p));
  }

  return Array.from(explicit);
};

/**
 * Check multiple permissions (AND logic)
 *
 * @param {string[]} userPermissions - User's permissions
 * @param {string[]} requiredPermissions - Required permissions
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
export const hasAllPermissions = (userPermissions, requiredPermissions, userRole) => {
  return requiredPermissions.every(perm =>
    hasPermission(userPermissions, perm, userRole)
  );
};

/**
 * Check multiple permissions (OR logic)
 *
 * @param {string[]} userPermissions - User's permissions
 * @param {string[]} requiredPermissions - Required permissions
 * @param {string} userRole - User's role
 * @returns {boolean}
 */
export const hasAnyPermission = (userPermissions, requiredPermissions, userRole) => {
  return requiredPermissions.some(perm =>
    hasPermission(userPermissions, perm, userRole)
  );
};
