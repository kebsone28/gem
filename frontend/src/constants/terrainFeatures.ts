export type TerrainFeatureKey =
  | 'search'
  | 'sync'
  | 'statusFilter'
  | 'teamFilter'
  | 'listView'
  | 'recenter'
  | 'routing'
  | 'photoCapture'
  | 'syncIssues'
  | 'statusLegend'
  | 'geofencingAlerts'
  | 'mapStyle'
  | 'zoneOverlay'
  | 'householdAdminEdit'
  | 'bulkConformingLocks'
  | 'analytics'
  | 'heatmap'
  | 'grappeTools'
  | 'regionDownload'
  | 'dataHub';

export type TerrainFeatureConfig = Partial<Record<TerrainFeatureKey, boolean>>;

export const DEFAULT_TERRAIN_FEATURES: Record<TerrainFeatureKey, boolean> = {
  search: true,
  sync: true,
  statusFilter: true,
  teamFilter: true,
  listView: true,
  recenter: true,
  routing: true,
  photoCapture: true,
  syncIssues: true,
  statusLegend: true,
  geofencingAlerts: true,
  mapStyle: true,
  zoneOverlay: true,
  householdAdminEdit: false,
  bulkConformingLocks: false,
  analytics: false,
  heatmap: false,
  grappeTools: false,
  regionDownload: false,
  dataHub: false,
};

export const ADMIN_ONLY_TERRAIN_FEATURES: TerrainFeatureKey[] = [
  'householdAdminEdit',
  'bulkConformingLocks',
  'analytics',
  'heatmap',
  'grappeTools',
  'regionDownload',
  'dataHub',
];

export const TERRAIN_FEATURE_DEFS: Array<{
  key: TerrainFeatureKey;
  title: string;
  desc: string;
  adminOnly?: boolean;
}> = [
  { key: 'search', title: 'Recherche ménage', desc: 'Recherche par numéro, nom, téléphone et village.' },
  { key: 'sync', title: 'Synchronisation', desc: 'Action manuelle de sync et état de reprise.' },
  { key: 'statusFilter', title: 'Filtre statut', desc: 'Filtre les ménages par avancement réel des travaux.' },
  { key: 'teamFilter', title: 'Filtre équipe', desc: 'Affiche les ménages selon l’équipe affectée.' },
  { key: 'listView', title: 'Vue liste', desc: 'Permet de basculer entre carte et liste terrain.' },
  { key: 'recenter', title: 'Recentrage GPS', desc: 'Recentrage sur la zone utilisateur ou le ménage sélectionné.' },
  { key: 'routing', title: 'Itinéraire', desc: 'Trace un itinéraire vers un ménage sélectionné.' },
  { key: 'photoCapture', title: 'Capture photo', desc: 'Prise de photo terrain depuis le mobile.' },
  { key: 'syncIssues', title: 'Incidents de sync', desc: 'Panneau pending/erreur/conflits de synchronisation.' },
  { key: 'statusLegend', title: 'Légende travaux', desc: 'Affiche la légende métier des statuts ménages.' },
  { key: 'geofencingAlerts', title: 'Alertes géographiques', desc: 'Affiche les incohérences GPS et alertes de zone.' },
  { key: 'mapStyle', title: 'Style de carte', desc: 'Change le style fond clair, nuit ou satellite.' },
  { key: 'zoneOverlay', title: 'Zones et grappes', desc: 'Affiche les zones et grappes sur la carte.' },
  { key: 'householdAdminEdit', title: 'Edition admin ménage', desc: 'Ouvre le centre de contrôle ménage.', adminOnly: true },
  { key: 'bulkConformingLocks', title: 'Bulk verrous conformes', desc: 'Verrouille ou déverrouille les ménages déjà conformes.', adminOnly: true },
  { key: 'analytics', title: 'Stats analytiques', desc: 'Widget analytique avancé sur la carte.', adminOnly: true },
  { key: 'heatmap', title: 'Heatmap', desc: 'Vue densité purement analytique.', adminOnly: true },
  { key: 'grappeTools', title: 'Outils grappes', desc: 'Panneaux grappes et allocation avancée.', adminOnly: true },
  { key: 'regionDownload', title: 'Cartes offline', desc: 'Téléchargement des régions pour travail hors connexion.', adminOnly: true },
  { key: 'dataHub', title: 'DataHub Kobo', desc: 'Outils bruts d’import, purge et sync avancée.', adminOnly: true },
];
