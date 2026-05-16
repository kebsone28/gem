/**
 * Configuration dynamique du système GED OS.
 * Permet de définir le nom de l'application et les modules actifs via les variables d'environnement.
 */

export const PROJECT_CONFIG = {
  // Nom principal de l'application (ex: GED OS, PROQUELEC, etc.)
  appName: import.meta.env.VITE_APP_NAME || 'GED OS',
  
  // Slogan stratégique
  appSlogan: 'Connecter le terrain, automatiser les opérations, piloter l’avenir.',
  
  // Contexte ou sous-titre (ex: ÉCOSYSTÈME DIGITAL)
  projectContext: import.meta.env.VITE_PROJECT_CONTEXT || 'ÉCOSYSTÈME DIGITAL',
  
  // Liste des modules activés
  enabledModules: (import.meta.env.VITE_ENABLED_MODULES || '')
    .split(',')
    .map((m: string) => m.trim().toLowerCase())
    .filter((m: string) => m.length > 0),

  /**
   * Vérifie si un module est activé.
   * Si VITE_ENABLED_MODULES n'est pas défini, on considère tout activé par défaut (backward compatibility).
   */
  isModuleEnabled(moduleId: string): boolean {
    if (!import.meta.env.VITE_ENABLED_MODULES) return true;
    return this.enabledModules.includes(moduleId.toLowerCase());
  }
};
