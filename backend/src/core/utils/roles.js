export const ROLE_ALIASES = {
    // Admin
    'ADMIN':               'ADMIN_PROQUELEC',
    'ADMIN_PROQUELEC':     'ADMIN_PROQUELEC',
    'PROQUELEC_ADMIN':     'ADMIN_PROQUELEC',
    'PLATFORM_ADMIN':      'ADMIN_PROQUELEC',
    
    // Direction / DG
    'DG':                  'DIRECTEUR',
    'DG_PROQUELEC':        'DIRECTEUR',
    'PROQUELEC_DG':        'DIRECTEUR',
    'PROQUELEC_DIRECTION': 'DIRECTEUR',
    'DIRECTEUR_GENERAL':   'DIRECTEUR',
    'DIRECTEUR GENERAL':   'DIRECTEUR',
    'DIRECTION GÉNÉRALE': 'DIRECTEUR',
    'DIR_GEN':             'DIRECTEUR',
    'DIRECTEUR':           'DIRECTEUR',
    'SOUS_TRAITANT_DIRECTEUR': 'DIRECTEUR',
    'CHEF DE CHANTIER':    'DIRECTEUR',
    
    // Operationnels
    'CP':                  'CHEF_PROJET',
    'CHEF_PROJET':         'CHEF_PROJET',
    'PROQUELEC_CHEF_PROJET': 'CHEF_PROJET',
    'CHEF_DE_PROJET':      'CHEF_PROJET',
    'CHEF DE PROJET':      'CHEF_PROJET',
    'CHEF PROJET':         'CHEF_PROJET',
    
    // Autres
    'COMPTABLE':           'COMPTABLE',
    'PROQUELEC_COMPTABLE': 'COMPTABLE',
    'PATRIMOINE':          'PATRIMOINE',
    'PROQUELEC_PATRIMOINE': 'PATRIMOINE',
    'SUPERVISEUR':         'SUPERVISEUR',
    'SENELEC_SUPERVISEUR': 'SUPERVISEUR',
    'CONTROLEUR':          'CONTROLEUR',
    'SENELEC_CONTROLEUR':  'CONTROLEUR',
    'EMPLOYE':             'EMPLOYE',
    'PROQUELEC_EMPLOYE':   'EMPLOYE',
    'SOUS_TRAITANT_EMPLOYE': 'EMPLOYE',
    'CHEF_EQUIPE':         'CHEF_EQUIPE',
};

export const normalizeRole = (role) => ROLE_ALIASES[role?.toUpperCase()] || role?.toUpperCase();
