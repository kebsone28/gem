const strings: Record<string, { fr: string; en: string }> = {
  appName: { fr: 'GedCollect', en: 'GedCollect' },
  formListTitle: { fr: 'Formulaires', en: 'Forms' },
  formListEmpty: { fr: 'Aucun formulaire assigné', en: 'No assigned forms' },
  settings: { fr: 'Paramètres', en: 'Settings' },
  autoSync: { fr: 'Synchronisation automatique', en: 'Auto Sync' },
  wifiOnly: { fr: 'WiFi uniquement', en: 'WiFi Only' },
  language: { fr: 'Langue', en: 'Language' },
  save: { fr: 'Enregistrer', en: 'Save' },
  cancel: { fr: 'Annuler', en: 'Cancel' },
  submit: { fr: 'Soumettre', en: 'Submit' },
  syncNow: { fr: 'Synchroniser maintenant', en: 'Sync Now' },
  syncInProgress: { fr: 'Synchronisation en cours...', en: 'Syncing...' },
  syncComplete: { fr: 'Synchronisation terminée', en: 'Sync Complete' },
  offline: { fr: 'Hors ligne', en: 'Offline' },
  online: { fr: 'En ligne', en: 'Online' },
  pendingSubmissions: { fr: 'Soumissions en attente', en: 'Pending Submissions' },
  error: { fr: 'Erreur', en: 'Error' },
  success: { fr: 'Succès', en: 'Success' },
  connectionError: { fr: 'Erreur de connexion', en: 'Connection Error' },
};

export function t(key: string, lang: 'fr' | 'en' = 'fr'): string {
  return strings[key]?.[lang] ?? key;
}

export default strings;
