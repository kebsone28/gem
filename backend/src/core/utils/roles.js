export const ROLE_ALIASES = {
    // Chef de Projet — toutes variantes
    'CP':                  'CHEF_PROJET',
    'CHEF_PROJET':         'CHEF_PROJET',
    'CHEF_DE_PROJET':      'CHEF_PROJET',
    'CHEF DE PROJET':      'CHEF_PROJET',
    'CHEF PROJET':         'CHEF_PROJET',
    // Directeur Général — toutes variantes
    'DG':                  'DIRECTEUR',
    'DG_PROQUELEC':        'DIRECTEUR',
    'DIRECTEUR_GENERAL':   'DIRECTEUR',
    'DIRECTEUR GENERAL':   'DIRECTEUR',
    'DIR_GEN':             'DIRECTEUR',
    'DIRECTEUR':           'DIRECTEUR',
    // Admin — toutes variantes
    'ADMIN':               'ADMIN_PROQUELEC',
    'ADMIN_PROQUELEC':     'ADMIN_PROQUELEC',
    // Autres rôles standard
    'COMPTABLE':           'COMPTABLE',
    'SUPERVISEUR':         'SUPERVISEUR',
    'AGENT':               'AGENT',
    'TERRAIN':             'TERRAIN',
};

export const normalizeRole = (role) => ROLE_ALIASES[role?.toUpperCase()] || role?.toUpperCase();
