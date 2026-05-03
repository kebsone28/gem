/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  MapPin,
  Navigation,
  Star,
  Phone,
  Navigation2,
  Plus,
  CloudOff,
  RefreshCcw,
  Zap,
  Hammer,
  AlertTriangle,
  Users,
  Database,
  MessageCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Settings2,
  Lock,
  LockOpen,
  ClipboardList,
  Activity,
  Info,
} from 'lucide-react';
import { AdminControlCenterModal } from './AdminControlCenterModal';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { getHouseholdDisplayName, stringifyHouseholdValue } from '../../utils/householdDisplay';
import {
  FileDown,
  FileText,
  ShieldCheck,
  Truck as TruckIcon,
  Hammer as HammerIcon,
  Zap as ZapIcon,
  Download
} from 'lucide-react';
import * as ReportGen from '../../services/householdReportGenerator';
import { getHouseholdDerivedStatus, getStatusTailwindClasses } from '../../utils/statusUtils';
import type { Household } from '../../utils/types';
import { useTerrainUIStore } from '../../store/terrainUIStore';
import { useSyncStore } from '../../store/syncStore';
import { useOfflineStore } from '../../store/offlineStore';
import { TeamAllocationsBadge, HouseholdStatusTimeline } from './shared';
import { InternalKoboForm } from './InternalKoboForm';
import {
  INTERNAL_KOBO_CONTROL_FIELD_NAMES,
  INTERNAL_KOBO_FIELD_NAMES,
  INTERNAL_KOBO_FORM_SETTINGS,
  getInternalKoboSubmissionValues,
  isTruthyKoboValue,
  validateInternalKoboRequiredFields,
} from './internalKoboFormDefinition';
import {
  flushInternalKoboSubmissionQueue,
  getInternalKoboQueueCount,
  queueInternalKoboSubmission,
  submitInternalKoboSubmission,
  type InternalKoboSubmissionPayload,
} from '../../services/internalKoboSubmissionService';

interface HouseholdDetailsPanelProps {
  household: Household;
  onPhotoOpen: (photos: any[], index: number) => void;
  onStatusUpdate: (newStatus: string) => Promise<void>;
  onPhotoUpload: (file: File) => Promise<string>;
  isFavorite: boolean;
  toggleFavorite: () => void;
  onUpdate?: (id: string, patch: Partial<Household>) => Promise<void>;
  onTraceItinerary: () => void;
  onCancelItinerary: () => void;
  routeStats?: { distance: number; duration: number } | null;
  grappeInfo?: { id: string; name: string; count: number } | null;
  userRole?: string;
  isAdmin?: boolean;
  pendingSyncCount?: number;
  koboAssetUid?: string;
  resolveHouseholdByNumero?: (numeroOrdre: string) => Record<string, any> | null;
}

type NativeKoboAuditField = {
  key: string;
  koboKey: string;
  label: string;
  observationKey?: string;
  type?: 'select' | 'number' | 'text';
};

const NATIVE_KOBO_AUDIT_FIELDS: NativeKoboAuditField[] = [
  {
    key: 'disjoncteur_tete',
    koboKey: 'DISJONCTEUR_GENERAL_EN_TETE_D_',
    observationKey: 'obs_disjoncteur',
    label: "Disjoncteur général en tête d'installation",
  },
  {
    key: 'protection_ddr_30ma',
    koboKey: 'ENSEMBLE_DE_L_INSTALLATION_PRO',
    observationKey: 'obs_ddr',
    label: "Ensemble de l'installation protégé par DDR 30 mA",
  },
  {
    key: 'protection_origine',
    koboKey: 'PROTECTION_L_ORIGINE_DE_CHAQ',
    observationKey: 'obs_protection_origine',
    label: "Protection à l'origine de chaque circuit",
  },
  {
    key: 'separation_circuits',
    koboKey: 'S_PARATION_DES_CIRCUITS_Lumi_',
    observationKey: 'obs_separation',
    label: 'Séparation des circuits lumière et prise',
  },
  {
    key: 'contact_direct',
    koboKey: 'PROTECTION_CONTRE_LES_CONTACTS',
    observationKey: 'obs_contact_direct',
    label: 'Protection contre les contacts directs',
  },
  {
    key: 'mise_en_oeuvre_mat',
    koboKey: 'MISE_EN_OEUVRE_MAT_RIEL_ET_APP',
    observationKey: 'obs_mat',
    label: 'Mise en œuvre matériel et appareillage',
  },
  {
    key: 'continuite_protection',
    koboKey: 'CONTINUITE_DE_LA_PROTECTION_ME',
    observationKey: 'obs_continuite',
    label: 'Continuité de la protection mécanique',
  },
  {
    key: 'audit_terre',
    koboKey: 'MISE_EN_UVRE_DU_R_SEAU_DE_TER',
    observationKey: 'obs_terre',
    label: 'Mise en œuvre du réseau de terre et continuité',
  },
  {
    key: 'barrette_terre',
    koboKey: 'ETAT_DE_LA_BARRETTE_DE_TERRE',
    label: 'État de la barrette de terre',
  },
  {
    key: 'resistance_terre',
    koboKey: 'VALEUR_DE_LA_RESISTANCE_DE_TER',
    observationKey: 'obs_resistance',
    label: 'Valeur de la résistance de terre ou de boucle',
    type: 'number',
  },
];

export const HouseholdDetailsPanel: React.FC<HouseholdDetailsPanelProps> = ({
  household,
  onPhotoOpen,
  onStatusUpdate,
  onPhotoUpload,
  isFavorite,
  toggleFavorite,
  onUpdate,
  onTraceItinerary,
  onCancelItinerary,
  grappeInfo,
  isAdmin = false,
  pendingSyncCount = 0,
  resolveHouseholdByNumero,
}) => {
  const closePanel = useTerrainUIStore((s) => s.closePanel);
  const setSelectedHouseholdId = useTerrainUIStore((s) => s.setSelectedHouseholdId);
  const routingEnabled = useTerrainUIStore((s) => s.activePanel === 'routing');
  const lastSyncError = useSyncStore((s) => s.lastSyncError);
  const isOnline = useOfflineStore((s) => s.isOnline);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showInternalReportModal, setShowInternalReportModal] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [nativeKoboAuditForm, setNativeKoboAuditForm] = useState<Record<string, unknown>>({});
  const [nativeKoboTargetHousehold, setNativeKoboTargetHousehold] = useState<Record<string, any> | null>(null);
  const [nativeKoboValidated, setNativeKoboValidated] = useState(false);
  const [internalKoboQueueCount, setInternalKoboQueueCount] = useState(0);

  const refreshInternalKoboQueueCount = useCallback(async () => {
    const count = await getInternalKoboQueueCount();
    setInternalKoboQueueCount(count);
    return count;
  }, []);

  useEffect(() => {
    refreshInternalKoboQueueCount();
    if (!isOnline) return;

    let cancelled = false;
    flushInternalKoboSubmissionQueue()
      .then((result) => {
        if (cancelled) return;
        setInternalKoboQueueCount(result.pending);
        if (result.flushed > 0) {
          toast.success(`${result.flushed} soumission(s) terrain envoyee(s) au VPS`);
        }
      })
      .catch(() => {
        // La file locale reste intacte; la prochaine reconnexion relancera l'envoi.
        refreshInternalKoboQueueCount();
      });

    return () => {
      cancelled = true;
    };
  }, [isOnline, refreshInternalKoboQueueCount]);

  // Optimisation rendering via memoization (bloque les references inutiles du state parent)
  const memoizedTeams = useMemo(() => {
    return Array.isArray(household.assignedTeams) ? household.assignedTeams : [];
  }, [household.assignedTeams]);

  useEffect(() => {
    if (!showInternalReportModal) return;
    refreshInternalKoboQueueCount();

    const audit = ((household.constructionData as any)?.audit || {}) as Record<string, any>;
    const koboData = (household.koboData || {}) as Record<string, any>;
    const nextForm: Record<string, unknown> = {};

    INTERNAL_KOBO_FIELD_NAMES.forEach((fieldName) => {
      const storedValue = audit[fieldName] ?? koboData[fieldName] ?? '';
      nextForm[fieldName] = storedValue;
    });

    nextForm.Numero_ordre = String(koboData.Numero_ordre ?? household.numeroordre ?? household.id ?? '');
    nextForm.nom_key = String(koboData.nom_key ?? household.name ?? household.owner ?? '');
    nextForm.telephone_key = String(koboData.telephone_key ?? household.phone ?? household.ownerPhone ?? '');
    nextForm.latitude_key = String(koboData.latitude_key ?? household.latitude ?? '');
    nextForm.longitude_key = String(koboData.longitude_key ?? household.longitude ?? '');
    nextForm.region_key = String(koboData.region_key ?? household.region ?? '');
    nextForm.LOCALISATION_CLIENT = String(
      koboData.LOCALISATION_CLIENT ??
      (household.latitude && household.longitude ? `${household.latitude} ${household.longitude}` : '')
    );
    setNativeKoboAuditForm(nextForm);
    setNativeKoboTargetHousehold(household as unknown as Record<string, any>);
    setNativeKoboValidated(Boolean(audit.conforme || household.koboSync?.controleOk));
  }, [household, refreshInternalKoboQueueCount, showInternalReportModal]);

  const [selectedNewStatus, setSelectedNewStatus] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const alerts = Array.isArray(household.alerts) ? household.alerts : [];
  const manualOverrideFields = useMemo(
    () => Array.from(new Set(household.manualOverrides || [])),
    [household.manualOverrides]
  );
  const phoneText =
    stringifyHouseholdValue(household.phone) || stringifyHouseholdValue(household.ownerPhone);

  const formatOverrideLabel = (path: string) => {
    const directLabels: Record<string, string> = {
      name: 'Nom complet',
      phone: 'Téléphone',
      latitude: 'Latitude',
      longitude: 'Longitude',
      numeroordre: "Numéro d'ordre",
      zoneId: 'Zone géographique',
      source: 'Source de données',
      'constructionData.preparateur': 'Préparation',
      'constructionData.livreur': 'Livraison',
      'constructionData.macon': 'Maçonnerie',
      'constructionData.reseau': 'Réseau',
      'constructionData.interieur': 'Installation intérieure',
      'constructionData.audit': 'Audit final',
    };

    if (directLabels[path]) return directLabels[path];

    return path
      .split('.')
      .filter(Boolean)
      .map((segment) =>
        segment
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (letter) => letter.toUpperCase())
      )
      .join(' / ');
  };

  // Kobo sometimes saves photos in different fields depending on the sync phase
  const extractPhotoUrl = () => {
    if (household.photo) return household.photo;
    if (household.koboData?.photoUrl) return household.koboData.photoUrl;
    if (household.koboData?.photo) return household.koboData.photo;
    if (household.koboData?.Photo) return household.koboData.Photo;

    // Direct Kobo API attachment structure
    const attachments = household.koboData?._attachments;
    if (Array.isArray(attachments) && attachments.length > 0) {
      return attachments[0].download_url || attachments[0].url;
    }
    return null;
  };
  const photoSrc = extractPhotoUrl();

  const statuses = [
    'Contrôle conforme',
    'Non conforme',
    'Intérieur terminé',
    'Réseau terminé',
    'Murs terminés',
    'Livraison effectuée',
    'Non encore installée',
  ];

  const timelineStages = [
    'Non encore installée',
    'Livraison effectuée',
    'Murs terminés',
    'Réseau terminé',
    'Intérieur terminé',
    'Contrôle conforme',
  ];
  const stageVisuals: Record<
    string,
    {
      icon: React.ReactNode;
      accent: string;
      description: string;
    }
  > = {
    'Non encore installée': {
      icon: <Clock size={14} />,
      accent: 'from-emerald-400/25 to-emerald-500/5 border-emerald-400/20 text-emerald-300',
      description: 'Le ménage est planifié mais aucune opération terrain n’a encore été validée.',
    },
    'Livraison effectuée': {
      icon: <Users size={14} />,
      accent: 'from-cyan-400/25 to-cyan-500/5 border-cyan-400/20 text-cyan-300',
      description: 'Le kit et les prérequis logistiques ont été remis sur site.',
    },
    'Murs terminés': {
      icon: <Hammer size={14} />,
      accent: 'from-amber-400/25 to-amber-500/5 border-amber-400/20 text-amber-300',
      description: 'La préparation structurelle et les supports sont terminés.',
    },
    'Réseau terminé': {
      icon: <Zap size={14} />,
      accent: 'from-sky-400/25 to-sky-500/5 border-sky-400/20 text-sky-300',
      description: 'Le raccordement réseau est finalisé et prêt pour l’intérieur.',
    },
    'Intérieur terminé': {
      icon: <Settings2 size={14} />,
      accent: 'from-violet-400/25 to-violet-500/5 border-violet-400/20 text-violet-300',
      description: 'Les opérations intérieures sont terminées, reste le contrôle final.',
    },
    'Contrôle conforme': {
      icon: <CheckCircle2 size={14} />,
      accent: 'from-blue-400/25 to-blue-500/5 border-blue-400/20 text-blue-300',
      description: 'Le dossier terrain est terminé et validé conforme.',
    },
  };

  // Helper de reformatage de texte Kobo (slugs -> texte lisible)
  const reformatKoboText = (text: string | null | undefined): string => {
    if (!text) return '—';

    const knownKoboLabels: Record<string, string> = {
      etape_controleur: 'Étape contrôleur - vérification finale',
      group_hx7ae46: 'Contrôle installation intérieure',
      DISJONCTEUR_GENERAL_EN_TETE_D_: "Disjoncteur général en tête d'installation",
      TYPE_DE_DISJONCTEUR_GENERAL: 'Type de disjoncteur général',
      ENSEMBLE_DE_L_INSTALLATION_PRO: "Ensemble de l'installation protégé par DDR 30 mA",
      PROTECTION_L_ORIGINE_DE_CHAQ: "Protection à l'origine de chaque circuit (modulaire et conducteur)",
      S_PARATION_DES_CIRCUITS_Lumi_: 'Séparation des circuits (lumière et prise)',
      PROTECTION_CONTACT_D_TOUTE_L_INSTALLATION: "Protection contact direct à vérifier sur toute l'installation",
      PROTECTION_CONTRE_LES_CONTACTS: 'Protection contre les contacts directs',
      MISE_EN_OEUVRE_MAT_RIEL_ET_APP: 'Mise en œuvre matériel et appareillage (coffret, prise, interrupteur, boîte, câble...)',
      CONTINUITE_DE_LA_PROTECTION_ME: 'Continuité de la protection mécanique des fils conducteurs (phase, neutre, terre)',
      RESEAU_DE_TERRE_A_VE_TOUTE_L_INSTALLATION: "Réseau de terre à vérifier sur toute l'installation",
      MISE_EN_UVRE_DU_R_SEAU_DE_TER: 'Mise en œuvre du réseau de terre et continuité',
      ETAT_DE_LA_BARRETTE_DE_TERRE: 'État de la barrette de terre',
      VALEUR_DE_LA_RESISTANCE_DE_TER: 'Valeur de la résistance de terre ou de boucle',
      validation_controleur_final: "Validation finale du contrôle et de l'installation",
      notes_generales: 'Notes générales',
      // Nouveaux mappings issus de l'audit
      verification_branchement_interieur: 'Conformité du branchement',
      problemes_branchement_interieur: 'Anomalies branchement',
      etat_installation_interieur: 'Qualité installation intérieure',
      problemes_installation_interieur: 'Détails anomalies intérieures',
      validation_interieur_final: 'Confirmation contrôle final',
      rr4dg37: 'Contrôle préalable',
      oo84j36: 'Détails des anomalies détectées',
      ga7rh54: 'Phase du contrôle',
      sv3tg34: 'État du branchement',
      ETAT_DE_L_INSTALLATION: "État de l'installation",
      controleurPROB: 'Problèmes détectés par le contrôleur'
    };

    const makeLookupKey = (value: string) =>
      value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toUpperCase();

    const knownKoboLabelsByLookup = Object.fromEntries(
      Object.entries(knownKoboLabels).map(([key, label]) => [makeLookupKey(key), label])
    );

    let formatted = String(text).trim();
    const rawSegment = formatted.split('/').filter(Boolean).pop()?.trim() || formatted;
    const exactLabel = knownKoboLabels[rawSegment] || knownKoboLabels[formatted];
    if (exactLabel) return exactLabel;

    const lookupLabel = knownKoboLabelsByLookup[makeLookupKey(rawSegment)] || knownKoboLabelsByLookup[makeLookupKey(formatted)];
    if (lookupLabel) return lookupLabel;

    formatted = rawSegment;

    // Kobo tronque parfois les noms de variables : on complète ici les cas métier connus.
    const inferredLabels: Array<[RegExp, string]> = [
      [/S\s*PARATION\s+DES\s+CIRCUITS\s+LUMI/i, 'Séparation des circuits (lumière et prise)'],
      [/PROTECTION\s+L\s+ORIGINE\s+DE\s+CHAQ/i, "Protection à l'origine de chaque circuit (modulaire et conducteur)"],
      [/MISE\s+EN\s+UVRE\s+DU\s+R\s*SEAU\s+DE\s+TER/i, 'Mise en œuvre du réseau de terre et continuité'],
      [/MISE\s+EN\s+OEUVRE\s+MAT\s*RIEL\s+ET\s+APP/i, 'Mise en œuvre matériel et appareillage (coffret, prise, interrupteur, boîte, câble...)'],
      [/CONTINUITE\s+DE\s+LA\s+PROTECTION\s+ME/i, 'Continuité de la protection mécanique des fils conducteurs (phase, neutre, terre)'],
      [/VALEUR\s+DE\s+LA\s+RESISTANCE\s+DE\s+TER/i, 'Valeur de la résistance de terre ou de boucle'],
      [/ENSEMBLE\s+DE\s+L\s+INSTALLATION\s+PRO/i, "Ensemble de l'installation protégé par DDR 30 mA"],
      [/DISJONCTEUR\s+GENERAL\s+EN\s+TETE/i, "Disjoncteur général en tête d'installation"],
    ];

    const inferredLabel = inferredLabels.find(([pattern]) => pattern.test(formatted))?.[1];
    if (inferredLabel) return inferredLabel;

    // 1. Remplacement des séparateurs Kobo restants
    formatted = formatted.replace(/__/g, ' / ');
    formatted = formatted.replace(/_/g, ' ');

    // 2. Correction heuristique des accents courants cassés par l'export Kobo
    const corrections: Record<string, string> = {
      'etape controleur': 'étape contrôleur',
      'group': 'groupe',
      'fix e': 'fixée',
      'lumi re': 'lumière',
      'c blage': 'câblage',
      'd rivation': 'dérivation',
      'rése': 'réseau',
      'r seau': 'réseau',
      'mise en uvre': 'mise en œuvre',
      's paration': 'séparation',
      'protection l origine': "protection à l'origine",
      'chaq': 'chaque',
      'ter': 'terre',
      'pr parateur': 'préparateur',
      'récupér': 'récupéré',
      'installat': 'installation',
      'effec': 'effectué',
      'piquet': 'piquet de terre',
      'disjoncteur': 'disjoncteur',
      'd placer': 'déplacer',
      'en lieu c': 'en lieu sûr',
      'contr leur': 'contrôleur'
    };

    Object.entries(corrections).forEach(([search, replace]) => {
      const regex = new RegExp(search, 'gi');
      formatted = formatted.replace(regex, replace);
    });

    // 3. Nettoyage final (espaces multiples et capitalisation)
    formatted = formatted.replace(/\s+/g, ' ').trim();
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  const formatKoboValue = (value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—';

    const raw = String(value).trim();
    const normalized = raw.toLowerCase().replace(/\s+/g, '_');
    const knownValues: Record<string, string> = {
      true: 'Oui',
      false: 'Non',
      oui: 'Oui',
      non: 'Non',
      conforme: 'Conforme',
      non_conforme: 'Non conforme',
      nc: 'Non conforme',
      c: 'Conforme',
      barrette_conforme: 'Barrette conforme',
    };

    return knownValues[normalized] || reformatKoboText(raw);
  };

  const currentStatus = getHouseholdDerivedStatus(household);

  // Normalize status for timeline.
  const normalizedStatus = useMemo(() => {
    const status = currentStatus.toLowerCase();
    if (status.includes('conforme') && !status.includes('non conforme')) return 'Contrôle conforme';
    if (status.includes('non conforme')) return 'Intérieur terminé'; // Si non conforme, l'intérieur est forcément fini
    if (status.includes('audit')) return 'Intérieur terminé';

    return currentStatus
        .replace(
          /[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF]/g,
          ''
        )
        .trim();
  }, [currentStatus]);

  const currentStageIndex = useMemo(() => {
    const idx = timelineStages.findIndex(
      (s) => s.toLowerCase() === normalizedStatus.toLowerCase()
    );
    // Fallback : si on est "Non Conforme", on est au moins à l'étape 4 (Intérieur terminé)
    if (idx === -1 && currentStatus.toLowerCase().includes('non conforme')) return 4;
    return idx;
  }, [normalizedStatus, currentStatus]);

  const progressPercentRaw =
    currentStageIndex >= 0
      ? Math.round((currentStageIndex / (timelineStages.length - 1)) * 100)
      : 0;
  const progressPercent = isNaN(progressPercentRaw) ? 0 : progressPercentRaw;

  const isTerminalStatus = ['Non éligible', 'Désistement', 'Refusé'].includes(currentStatus);
  const justification = (household.constructionData as any)?.livreur?.justificatif ||
    (household.constructionData as any)?.livreur?.kit_problems ||
    household.koboData?.justificatif;
  const activeStageMeta =
    stageVisuals[timelineStages[currentStageIndex] || 'Non encore installée'] ||
    stageVisuals['Non encore installée'];
  const progressRingCircumference = 2 * Math.PI * 28;
  const progressRingOffset =
    progressRingCircumference - (Math.max(0, Math.min(100, progressPercent)) / 100) * progressRingCircumference;
  const completedStageCount = currentStageIndex >= 0 ? currentStageIndex + 1 : 0;
  const headerAuraClass = isTerminalStatus
    ? 'from-rose-500/26 via-rose-500/8 to-transparent'
    : progressPercent >= 100
      ? 'from-emerald-400/24 via-emerald-500/8 to-transparent'
      : progressPercent >= 50
        ? 'from-sky-400/24 via-blue-500/8 to-transparent'
        : 'from-amber-400/22 via-blue-500/8 to-transparent';
  const lastUpdateSummary = useMemo(() => {
    if (!household.updatedAt) return 'En attente';

    const updatedAt = new Date(household.updatedAt);
    if (Number.isNaN(updatedAt.getTime())) return 'En attente';

    const elapsedMs = Date.now() - updatedAt.getTime();
    const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / 60000));
    if (elapsedMinutes < 60) return `${elapsedMinutes || 1} min`;

    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours} h`;

    const elapsedDays = Math.floor(elapsedHours / 24);
    return `${elapsedDays} j`;
  }, [household.updatedAt]);

  const hasConflict = alerts.some((a: any) => a.type === 'DOUBLON_DETECTE');
  const syncState = household.syncStatus || 'synced';
  const syncBadge = useMemo(() => {
    if (syncState === 'pending') {
      return {
        label: 'En attente',
        helper: 'Modification locale en file de synchronisation',
        classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      };
    }

    if (syncState === 'error') {
      return {
        label: 'Erreur',
        helper: "La dernière synchronisation a échoué, une reprise est nécessaire",
        classes: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      };
    }

    return {
      label: 'Synchronisé',
      helper: 'État local aligné avec le serveur',
      classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    };
  }, [syncState]);

  // Détermination du rapport principal intelligent
  const smartReportAction = useMemo(() => {
    const statusLower = currentStatus.toLowerCase();
    const isAuditPhase = statusLower.includes('conforme') || statusLower.includes('audit');

    // 1. Audit Final / Certificat (Uniquement si CONFORME)
    if ((currentStageIndex >= 5 || household.koboSync?.controleOk || (household.constructionData as any)?.audit) && !statusLower.includes('non conforme')) {
      return {
        label: 'Certificat Final',
        action: () => ReportGen.generateConformiteFinalPDF(household),
        icon: <ShieldCheck size={18} />,
        color: 'from-emerald-600 to-emerald-900'
      };
    }
    // 2. Installation Intérieure (Active si Intérieur fini OU Audit en cours/fini même non conforme)
    if (currentStageIndex >= 4 || isAuditPhase || household.koboSync?.interieurOk || (household.constructionData as any)?.interieur) {
      return {
        label: 'PV Intérieur',
        action: () => ReportGen.generateInstallationPDF(household),
        icon: <FileText size={18} />,
        color: 'from-violet-600 to-violet-900'
      };
    }
    // 3. Réseau / Branchement
    if (currentStageIndex >= 3 || household.koboSync?.reseauOk || (household.constructionData as any)?.reseau) {
      return {
        label: 'Fiche Réseau',
        action: () => ReportGen.generateBranchementPDF(household),
        icon: <ZapIcon size={18} />,
        color: 'from-sky-600 to-sky-900'
      };
    }
    // 4. Maçonnerie / Support
    if (currentStageIndex >= 2 || household.koboSync?.maconOk || (household.constructionData as any)?.macon) {
      return {
        label: 'PV Maçonnerie',
        action: () => ReportGen.generateMaconneriePDF(household),
        icon: <HammerIcon size={18} />,
        color: 'from-amber-600 to-amber-900'
      };
    }
    // Default: Livraison
    return {
      label: 'Bon Livraison',
      action: () => ReportGen.generateLivraisonPDF(household),
      icon: <TruckIcon size={18} />,
      color: 'from-blue-600 to-indigo-900'
    };
  }, [household, currentStageIndex]);

  const handleConfirmStatusChange = async () => {
    if (!selectedNewStatus) return;

    setIsUpdating(true);
    try {
      await onStatusUpdate(selectedNewStatus);
      toast.success(`Status changé en "${selectedNewStatus}" ✓`);
      setShowStatusModal(false);
      setSelectedNewStatus(null);
    } catch (error) {
      toast.error('Erreur lors de la mise à jour du status');
    } finally {
      setIsUpdating(false);
    }
  };

  const updateNativeKoboAuditField = (key: string, value: unknown) => {
    setNativeKoboAuditForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleInternalKoboResolvedHousehold = (resolvedHousehold: Record<string, any> | null) => {
    setNativeKoboTargetHousehold(resolvedHousehold);

    const resolvedId = resolvedHousehold?.id ? String(resolvedHousehold.id) : '';
    if (resolvedId && resolvedId !== household.id) {
      setSelectedHouseholdId(resolvedId);
    }
  };

  const handleSaveNativeKoboAudit = async () => {
    const missingRequiredFields = validateInternalKoboRequiredFields(nativeKoboAuditForm);
    const requestedNumeroOrdre = String(nativeKoboAuditForm.Numero_ordre || '').trim();
    const currentNumeroOrdre = String(household.numeroordre || household.id || '').trim();
    const submissionHousehold = nativeKoboTargetHousehold || (household as unknown as Record<string, any>);

    if (requestedNumeroOrdre && requestedNumeroOrdre !== currentNumeroOrdre && !nativeKoboTargetHousehold?.id) {
      toast.error("Numero ordre introuvable sur le VPS: soumission bloquee pour eviter d'ecrire sur le mauvais menage");
      return;
    }

    setIsUpdating(true);
    let fallbackSubmissionPayload: InternalKoboSubmissionPayload | null = null;

    try {
      const now = new Date().toISOString();
      const targetHouseholdId = String(submissionHousehold.id || household.id);
      const internalSubmissionId = `gem-vps-${targetHouseholdId}-${Date.now()}`;
      const submissionValues = getInternalKoboSubmissionValues(nativeKoboAuditForm);
      const today = now.slice(0, 10);
      const xlsFormMetadata = {
        start: nativeKoboAuditForm.start || (submissionHousehold.koboData as any)?.start || now,
        end: now,
        today: nativeKoboAuditForm.today || (submissionHousehold.koboData as any)?.today || today,
        username:
          nativeKoboAuditForm.username ||
          (submissionHousehold.koboData as any)?.username ||
          (submissionHousehold as any).assignedTo ||
          (submissionHousehold as any).agentName ||
          'gem-vps',
        phonenumber:
          nativeKoboAuditForm.phonenumber ||
          (submissionHousehold.koboData as any)?.phonenumber ||
          nativeKoboAuditForm.telephone_key ||
          submissionHousehold.phone ||
          submissionHousehold.ownerPhone ||
          '',
        C1: nativeKoboAuditForm.nom_key || '',
        C2: nativeKoboAuditForm.latitude_key || '',
        C3: nativeKoboAuditForm.telephone_key || '',
        C4: nativeKoboAuditForm.longitude_key || '',
        C5: nativeKoboAuditForm.region_key || '',
        _xform_style: INTERNAL_KOBO_FORM_SETTINGS.style,
        _xform_version: INTERNAL_KOBO_FORM_SETTINGS.version,
        _xform_default_language: INTERNAL_KOBO_FORM_SETTINGS.defaultLanguage,
      };
      const cleanValues = Object.fromEntries(
        Object.entries({ ...xlsFormMetadata, ...nativeKoboAuditForm, ...submissionValues }).filter(([, value]) => {
          if (Array.isArray(value)) return value.length > 0;
          return value !== undefined && value !== null && String(value).trim() !== '';
        })
      );

      const hasControlNonConformity = INTERNAL_KOBO_CONTROL_FIELD_NAMES.some(
        (fieldName) => nativeKoboAuditForm[fieldName] === 'non_conforme'
      );
      const controlCompleted = isTruthyKoboValue(nativeKoboAuditForm.validation_controleur_final);
      const allRequiredComplete = missingRequiredFields.length === 0;
      const controleOk = controlCompleted && allRequiredComplete && !hasControlNonConformity;
      const nextStatus =
        controleOk
          ? 'Contrôle conforme'
          : hasControlNonConformity || nativeKoboAuditForm.ETAT_DE_L_INSTALLATION === 'probleme_a_signaler'
            ? 'Non conforme'
            : isTruthyKoboValue(nativeKoboAuditForm.validation_interieur_final)
              ? 'Intérieur terminé'
              : isTruthyKoboValue(nativeKoboAuditForm.validation_reseau_final)
                ? 'Réseau terminé'
                : isTruthyKoboValue(nativeKoboAuditForm.validation_macon_final)
                  ? 'Murs terminés'
                  : nativeKoboAuditForm.Situation_du_M_nage === 'menage_non_eligible'
                    ? 'Non éligible'
                    : submissionHousehold.status || household.status;

      const auditPatch: Record<string, any> = {
        ...((submissionHousehold.constructionData as any)?.audit || {}),
        ...cleanValues,
        conforme: controleOk,
        requiredMissing: missingRequiredFields.map((field) => field.name),
        source: 'native-gem-kobo-form',
        submissionTarget: 'gem-vps',
        internalSubmissionId,
        xlsForm: INTERNAL_KOBO_FORM_SETTINGS,
        updatedAt: now,
      };

      const koboDataPatch: Record<string, any> = {
        ...(submissionHousehold.koboData || {}),
        ...cleanValues,
        numeroordre: submissionHousehold.numeroordre || requestedNumeroOrdre || targetHouseholdId,
        Numero_ordre: nativeKoboAuditForm.Numero_ordre || submissionHousehold.numeroordre || targetHouseholdId,
        _gem_internal_kobo: true,
        _gem_internal_kobo_updated_at: now,
        _gem_submission_target: 'gem-vps',
        _gem_submission_id: internalSubmissionId,
        _gem_submission_status: allRequiredComplete ? 'submitted' : 'draft',
        _gem_submitted_at: allRequiredComplete ? now : undefined,
        _gem_xlsform_version: INTERNAL_KOBO_FORM_SETTINGS.version,
      };

      const householdPatch = {
        status: nextStatus,
        koboData: koboDataPatch,
        koboSync: {
          ...(submissionHousehold.koboSync || {}),
          preparateurKits: Number(nativeKoboAuditForm.Nombre_de_KIT_pr_par || submissionHousehold.koboSync?.preparateurKits || 0),
          câbleInt25: Number(nativeKoboAuditForm.Longueur_Cable_2_5mm_Int_rieure || submissionHousehold.koboSync?.câbleInt25 || 0),
          câbleInt15: Number(nativeKoboAuditForm.Longueur_Cable_1_5mm_Int_rieure || submissionHousehold.koboSync?.câbleInt15 || 0),
          tranchee4: Number(nativeKoboAuditForm.Longueur_Tranch_e_Cable_arm_4mm || submissionHousehold.koboSync?.tranchee4 || 0),
          tranchee15: Number(nativeKoboAuditForm.Longueur_Tranch_e_C_ble_arm_1_5mm || submissionHousehold.koboSync?.tranchee15 || 0),
          maconOk: isTruthyKoboValue(nativeKoboAuditForm.validation_macon_final) || submissionHousehold.koboSync?.maconOk,
          reseauOk: isTruthyKoboValue(nativeKoboAuditForm.validation_reseau_final) || submissionHousehold.koboSync?.reseauOk,
          interieurOk: isTruthyKoboValue(nativeKoboAuditForm.validation_interieur_final) || submissionHousehold.koboSync?.interieurOk,
          controleOk,
          village: submissionHousehold.village || submissionHousehold.koboSync?.village,
          departement: submissionHousehold.departement || submissionHousehold.koboSync?.departement,
          region: String(nativeKoboAuditForm.region_key || submissionHousehold.region || submissionHousehold.koboSync?.region || ''),
          tel: String(nativeKoboAuditForm.telephone_key || submissionHousehold.phone || submissionHousehold.ownerPhone || submissionHousehold.koboSync?.tel || ''),
        },
        constructionData: {
          ...(submissionHousehold.constructionData || {}),
          audit: auditPatch,
          internalKoboSubmission: {
            id: internalSubmissionId,
            target: 'gem-vps',
            xlsForm: INTERNAL_KOBO_FORM_SETTINGS,
            status: allRequiredComplete ? 'submitted' : 'draft',
            requiredMissing: missingRequiredFields.map((field) => field.name),
            submittedAt: allRequiredComplete ? now : undefined,
            savedAt: now,
          },
        },
      } as Partial<Household>;

      fallbackSubmissionPayload = {
        clientSubmissionId: internalSubmissionId,
        householdId: targetHouseholdId,
        numeroOrdre: String(nativeKoboAuditForm.Numero_ordre || submissionHousehold.numeroordre || targetHouseholdId),
        formKey: 'terrain_internal',
        formVersion: INTERNAL_KOBO_FORM_SETTINGS.version,
        role: nativeKoboAuditForm.role ? String(nativeKoboAuditForm.role) : null,
        status: allRequiredComplete ? 'submitted' : 'draft',
        values: cleanValues,
        metadata: {
          xlsForm: INTERNAL_KOBO_FORM_SETTINGS,
          target: 'gem-vps',
          source: 'native-gem-kobo-form',
          localSavedAt: now,
          validation: {
            allRequiredComplete,
            controleOk,
            hasControlNonConformity,
          },
        },
        requiredMissing: missingRequiredFields.map((field) => field.name),
        householdPatch: householdPatch as Record<string, unknown>,
      };

      let traceQueued = false;

      if (onUpdate) {
        await onUpdate(targetHouseholdId, householdPatch);

        const { householdPatch: _householdPatch, ...submissionTracePayload } = fallbackSubmissionPayload;
        try {
          await submitInternalKoboSubmission(submissionTracePayload);
        } catch (submissionError) {
          traceQueued = true;
          await queueInternalKoboSubmission(
            submissionTracePayload,
            submissionError instanceof Error ? submissionError.message : 'Trace VPS indisponible'
          );
          await refreshInternalKoboQueueCount();
        }
      } else {
        await submitInternalKoboSubmission(fallbackSubmissionPayload);
      }

      toast.success(
        traceQueued
          ? 'Fiche sauvegardee; trace Kobo interne mise en file VPS'
          : allRequiredComplete
            ? 'Formulaire soumis au serveur VPS'
            : `Brouillon sauvegardé sur le VPS (${missingRequiredFields.length} requis manquant(s))`
      );
      setShowInternalReportModal(false);
    } catch (error) {
      if (fallbackSubmissionPayload) {
        await queueInternalKoboSubmission(
          fallbackSubmissionPayload,
          error instanceof Error ? error.message : 'VPS indisponible'
        );
        await refreshInternalKoboQueueCount();
        toast.success('VPS indisponible: saisie securisee en file locale');
        setShowInternalReportModal(false);
      } else {
        toast.error('Soumission impossible: serveur VPS indisponible');
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className={`fixed inset-x-0 bottom-0 z-[2000] flex w-full flex-col overflow-hidden rounded-t-[1.75rem] border-t border-white/10 bg-slate-950/94 text-white shadow-[-20px_0_90px_rgba(0,0,0,0.56)] backdrop-blur-3xl transition-[max-height,min-height] duration-300 sm:rounded-t-[2.4rem] md:inset-y-0 md:left-auto md:right-0 md:h-screen md:max-h-none md:min-h-0 md:w-[430px] md:rounded-none md:border-l lg:w-[446px] ${
        isExpanded ? 'max-h-[98dvh] min-h-[92dvh] sm:max-h-[96dvh]' : 'max-h-[94dvh] min-h-[72dvh] sm:max-h-[92dvh]'
      }`}
    >
      {/* Drag Handle for Mobile */}
      <motion.button
        type="button"
        className="mx-auto my-2.5 h-5 w-16 shrink-0 rounded-full md:hidden"
        aria-label={isExpanded ? 'Réduire le panneau' : 'Agrandir le panneau'}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.18}
        whileTap={{ scale: 0.92 }}
        onClick={() => setIsExpanded((value) => !value)}
        onDragEnd={(_, info) => {
          if (info.offset.y < -18) setIsExpanded(true);
          if (info.offset.y > 18) setIsExpanded(false);
        }}
      >
        <span className="mx-auto mt-1.5 block h-1.5 w-10 rounded-full bg-white/[0.16] shadow-[0_0_16px_rgba(255,255,255,0.08)]" />
      </motion.button>

      {/* Header Sticky */}
      <div className="sticky top-0 z-10 shrink-0 overflow-hidden border-b border-white/[0.08] bg-slate-950/95 px-4 pb-3 pt-2.5 backdrop-blur-2xl sm:px-5 sm:py-4 md:px-7 md:py-5">
        <div className={`pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-gradient-to-br ${headerAuraClass} blur-3xl`} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.5rem] font-black uppercase leading-[0.94] tracking-[-0.035em] text-white drop-shadow-sm sm:text-[1.68rem] md:text-[1.5rem]">
              MÉNAGE {household.numeroordre || household.id.slice(-6)}
            </h2>
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
              {hasConflict && (
                <div className="flex shrink-0 animate-pulse items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-500">
                  <AlertTriangle size={8} />
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] sm:text-[9px]">CONFLIT</span>
                </div>
              )}
              {isTerminalStatus ? (
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]">
                  <AlertTriangle size={8} />
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] sm:text-[9px]">
                    {currentStatus}
                  </span>
                </div>
              ) : (
                <div className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 shadow-inner sm:px-3 ${syncBadge.classes}`}>
                  {syncState === 'pending' ? (
                    <RefreshCcw size={8} className="animate-spin text-amber-500" />
                  ) : syncState === 'error' ? (
                    <CloudOff size={8} />
                  ) : (
                    <CheckCircle2 size={8} />
                  )}
                  <span className="text-[7px] font-black uppercase tracking-[0.1em] sm:text-[9px]">
                    {syncBadge.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {isAdmin && onUpdate && (
              <button
                onClick={() => setShowAdminModal(true)}
                className="group flex h-10 w-10 items-center justify-center rounded-[1.1rem] border border-white/[0.08] bg-white/[0.055] text-blue-300 shadow-inner transition-all hover:bg-white/10 active:scale-95 sm:h-11 sm:w-11"
                title="Admin : Modifier tout le profil"
                aria-label="Modifier le profil ménage"
              >
                <Settings2 className="h-[18px] w-[18px] transition-transform duration-500 group-hover:rotate-45 sm:h-5 sm:w-5" />
              </button>
            )}

            <button
              onClick={() => {
                setSelectedHouseholdId(null);
                closePanel();
              }}
              title="Fermer le panneau"
              aria-label="Fermer le panneau"
              className="group flex h-10 w-10 items-center justify-center rounded-[1.1rem] border border-white/[0.08] bg-white/[0.055] text-slate-300 shadow-inner transition-all hover:bg-white/10 hover:text-white sm:h-11 sm:w-11"
            >
              <X size={16} className="transition-transform duration-300 group-hover:rotate-90" />
            </button>
          </div>
        </div>

        <div className="relative z-10 mt-3 rounded-[1.35rem] border border-white/[0.09] bg-white/[0.045] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_45px_rgba(2,6,23,0.36)]">
          <div className="flex items-center gap-3">
            <div className="relative grid h-[72px] w-[72px] shrink-0 place-items-center">
              <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 72 72" aria-hidden="true">
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="6" />
                <circle
                  className={isTerminalStatus ? 'animate-pulse' : ''}
                  cx="36"
                  cy="36"
                  r="28"
                  fill="none"
                  stroke="url(#household-progress-ring)"
                  strokeLinecap="round"
                  strokeWidth="6"
                  strokeDasharray={progressRingCircumference}
                  strokeDashoffset={progressRingOffset}
                  style={{ filter: isTerminalStatus ? 'drop-shadow(0 0 5px rgba(239,68,68,0.9))' : 'none' }}
                />
                <defs>
                  <linearGradient id="household-progress-ring" x1="0" y1="0" x2="72" y2="72">
                    <stop stopColor="#38bdf8" />
                    <stop offset="1" stopColor={isTerminalStatus ? '#fb7185' : '#34d399'} />
                  </linearGradient>
                </defs>
              </svg>
              <div className="grid h-[48px] w-[48px] place-items-center rounded-[1.05rem] border border-white/10 bg-slate-950/70 text-blue-200 shadow-[0_0_28px_rgba(59,130,246,0.22)]">
                {activeStageMeta.icon || <MapPin size={18} />}
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-black uppercase tracking-[0.08em] text-slate-100">
                {getHouseholdDisplayName(household)}
              </p>
              <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 sm:text-[10px]">
                {household.village || household.departement || 'Terrain actif'}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-slate-300">
                  {completedStageCount}/{timelineStages.length}
                </span>
                <span className="truncate rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-blue-200">
                  {timelineStages[currentStageIndex] || currentStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/[0.07] bg-black/18 px-3 py-2">
              <p className="text-[7px] font-black uppercase tracking-[0.16em] text-slate-500">Progression</p>
              <p className="mt-1 text-sm font-black text-white">{progressPercent}%</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-black/18 px-3 py-2">
              <p className="text-[7px] font-black uppercase tracking-[0.16em] text-slate-500">Équipes</p>
              <p className="mt-1 text-sm font-black text-white">{memoizedTeams.length || 0}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.07] bg-black/18 px-3 py-2">
              <p className="text-[7px] font-black uppercase tracking-[0.16em] text-slate-500">MAJ</p>
              <p className="mt-1 truncate text-sm font-black text-white">{lastUpdateSummary}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 sm:py-5 md:px-7">
        <div className="space-y-5 pb-3 animate-in fade-in slide-in-from-bottom-2 duration-500 sm:space-y-6">
          {/* ALERTES BLOQUANTES & SYSTÈME */}
          {alerts.length > 0 && (
            <div className="space-y-4">
              {/* Alertes Critiques (High Severity) */}
              {alerts.some((a: any) => a.severity === 'HIGH') && (
                <div className="p-6 rounded-[2rem] bg-rose-500/10 border-2 border-rose-500/20 shadow-inner flex flex-col gap-4 animate-pulse-slow">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 text-rose-500">
                    <AlertTriangle size={16} /> ALERTES CRITIQUES
                  </h4>
                  <div className="space-y-3">
                    {alerts.filter((a: any) => a.severity === 'HIGH').map((alert: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-bold text-rose-400 uppercase tracking-widest shadow-inner"
                      >
                        <div className="w-2 h-2 mt-1 rounded-full bg-rose-500 shrink-0 shadow-[0_0_15px_rgba(244,63,94,0.8)]" />
                        <span>{alert.message || alert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alertes Moyennes (GPS, Anomalies mineures) */}
              {alerts.some((a: any) => a.severity === 'MEDIUM' || !a.severity) && (
                <div className="p-6 rounded-[2rem] bg-amber-500/5 border-2 border-amber-500/10 shadow-inner flex flex-col gap-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 text-amber-500/70">
                    <Zap size={14} /> ALERTES SYSTÈME
                  </h4>
                  <div className="space-y-3">
                    {alerts.filter((a: any) => a.severity !== 'HIGH').map((alert: any, i: number) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold text-amber-400/80 uppercase tracking-widest"
                      >
                        <div className="w-1.5 h-1.5 mt-1 rounded-full bg-amber-500 shrink-0" />
                        <span>{alert.message || alert}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}


          {/* GLOBAL STATUS TRACKING (REPOSITIONNÉ ICI POUR ÉVITER LE DOUBLON) */}
          <HouseholdStatusTimeline
            currentStatus={currentStatus}
            updatedAt={household.updatedAt}
            isAdmin={isAdmin}
            onEdit={(newStatus) => setShowStatusModal(true)}
            stages={timelineStages.map((stage) => ({
              label: stage,
              value: stage,
              description: stageVisuals[stage]?.description,
              icon: stageVisuals[stage]?.icon,
            }))}
          />

          {/* PROGRESS BAR TIMELINE OR INELIGIBILITY CARD */}
          {isTerminalStatus && (
            <div className="p-8 rounded-[2.5rem] bg-rose-500/10 border-2 border-rose-500/20 shadow-2xl relative overflow-hidden group">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-rose-500/5 blur-[80px] rounded-full" />
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                  <CloudOff size={24} />
                </div>
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-500">Ménage Non Éligible</h4>
                  <p className="text-white font-black text-xl uppercase tracking-tighter">Construction annulée</p>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-black/20 border border-white/5 space-y-3">
                <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Motif du rejet :</p>
                <p className="text-xs font-bold text-slate-300 tracking-wide leading-relaxed">
                  {justification || 'Aucun motif renseigné dans le formulaire Kobo'}
                </p>
              </div>

              <div className="mt-6 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-rose-500/60">
                <AlertTriangle size={12} /> Dossier classé sans suite
              </div>
            </div>
          )}

          {/* Gallery Section */}
          <div className="space-y-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-[0.25em] flex items-center gap-2 text-blue-300/80">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              GALERIE TERRAIN
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {photoSrc ? (
                <button
                  onClick={() => onPhotoOpen([{ url: photoSrc as string, label: 'Preuve' }], 0)}
                  title="Voir l'image agrandie"
                  className="aspect-[4/3] rounded-[1.4rem] overflow-hidden border border-white/10 bg-white/5 group relative shadow-2xl"
                >
                  <img
                    src={photoSrc as string}
                    alt="Terrain"
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <span className="text-[9px] font-black uppercase tracking-widest text-white">
                      Agrandir +
                    </span>
                  </div>
                </button>
              ) : isAdmin ? (
                <label className="aspect-[4/3] rounded-[1.55rem] border-2 border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(37,99,235,0.08),rgba(15,23,42,0.7))] hover:bg-white/5 transition-all flex flex-col items-center justify-center p-5 text-slate-500 hover:border-blue-500/30 group cursor-pointer shadow-inner">
                  <Plus
                    size={24}
                    className="mb-2.5 group-hover:text-blue-300 group-hover:scale-110 transition-all opacity-50 group-hover:opacity-100"
                  />
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-center text-slate-200">
                    Ajouter Une Preuve
                  </span>
                  <span className="mt-1.5 text-[10px] text-slate-400 text-center leading-relaxed max-w-[170px]">
                    Téléverse une photo de validation terrain pour ce ménage.
                  </span>
                  <input
                    id="household-photo-upload"
                    type="file"
                    className="hidden"
                    accept="image/*"
                    title="Uploader une photo de preuve terrain"
                    aria-label="Charger une photo de preuve"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const tid = toast.loading('Upload...');
                      try {
                        await onPhotoUpload(file);
                        toast.success('Upload OK ✓', { id: tid });
                      } catch {
                        toast.error('Erreur', { id: tid });
                      }
                    }}
                  />
                </label>
              ) : (
                <div className="aspect-[4/3] rounded-[1.55rem] border border-white/5 bg-[linear-gradient(180deg,rgba(30,41,59,0.6),rgba(2,6,23,0.8))] flex flex-col items-center justify-center p-5 text-slate-600 shadow-inner">
                  <CloudOff size={24} className="mb-2.5 opacity-25" />
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-center opacity-70 text-slate-300">
                    Aucune preuve disponible
                  </span>
                  <span className="mt-1.5 text-[10px] text-slate-500 text-center max-w-[160px] leading-relaxed">
                    Ajoute une photo terrain pour enrichir le dossier ménage.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Owner Identity Card */}
          <div className="relative rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(59,130,246,0.045),rgba(15,23,42,0.58))] px-4 py-5 shadow-inner">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite();
              }}
              title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={`absolute right-3.5 top-3.5 w-8 h-8 rounded-full border transition-all hover:scale-105 active:scale-95 flex items-center justify-center ${isFavorite ? 'bg-amber-400/16 border-amber-400/30 text-amber-400' : 'bg-slate-900/35 border-white/8 text-slate-500'}`}
            >
              <Star size={12} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-11 h-11 rounded-[0.95rem] border border-blue-500/15 bg-blue-600/10 text-blue-300 flex items-center justify-center mb-3">
                <MapPin size={18} />
              </div>

              <p className="text-[8px] font-black uppercase tracking-[0.24em] text-blue-300/52">
                Titulaire Du Compte
              </p>

              <p className="mt-2.5 text-white font-black text-[1.02rem] sm:text-[1.12rem] uppercase tracking-[-0.025em] leading-[1.06] max-w-[240px] flex items-center justify-center gap-2">
                {getHouseholdDisplayName(household)}
                {(manualOverrideFields.includes('owner') || manualOverrideFields.includes('name')) && (
                  <Lock size={12} className="text-amber-400 shrink-0" />
                )}
              </p>
            </div>
          </div>

          {/* Practical Information List */}
          <div className="grid grid-cols-1 gap-3.5">
            {/* Contact */}
            <div className="rounded-[1.5rem] border border-white/8 bg-[linear-gradient(180deg,rgba(16,185,129,0.045),rgba(15,23,42,0.56))] px-4 py-4 shadow-inner">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-[0.95rem] bg-emerald-500/10 text-emerald-300 flex items-center justify-center border border-emerald-500/15 shrink-0">
                    <Phone size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.24em] mb-1">
                      Contact Direct
                    </p>
                    <p className="text-[1rem] sm:text-[1.08rem] font-black text-white tracking-[0.04em] truncate">
                      {phoneText || '—'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`tel:${phoneText}`}
                    title="Appeler localement"
                    className="h-10 px-3.5 rounded-full border border-emerald-400/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.2),rgba(5,150,105,0.14))] text-emerald-100 text-[9px] font-black uppercase tracking-[0.14em] shadow-[0_8px_18px_rgba(16,185,129,0.12)] hover:border-emerald-300/35 hover:bg-[linear-gradient(180deg,rgba(16,185,129,0.28),rgba(5,150,105,0.18))] transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Phone size={12} />
                    Appel
                  </a>
                  {phoneText && (
                    <a
                      href={`https://wa.me/${phoneText.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ouvrir WhatsApp"
                      className="h-10 px-3.5 rounded-full border border-emerald-500/20 bg-transparent text-emerald-300 text-[9px] font-black uppercase tracking-[0.14em] hover:border-emerald-400/30 hover:bg-emerald-500/8 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Localisation & Administratif */}
            <div className={`p-4 sm:p-5 rounded-[1.5rem] border space-y-4 relative overflow-hidden transition-colors ${alerts.some((a: any) => a.type === 'MISMATCH_GPS') ? 'bg-amber-900/10 border-amber-500/30 ring-1 ring-amber-500/20' : 'bg-[linear-gradient(180deg,rgba(59,130,246,0.045),rgba(15,23,42,0.56))] border-white/8'}`}>
              <div className="absolute top-0 right-0 p-4 opacity-[0.035]">
                <Database size={88} />
              </div>

              {alerts.some((a: any) => a.type === 'MISMATCH_GPS') && (
                <div className="p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl mb-4 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-500">
                    <AlertTriangle size={18} />
                  </div>
                  <p className="text-[10px] font-black uppercase text-amber-400">Position Suspecte !</p>
                </div>
              )}

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-[0.95rem] bg-orange-500/10 text-orange-300 flex items-center justify-center shrink-0 border border-orange-500/15">
                  <MapPin size={17} />
                </div>
                <div className="flex-1">
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.24em] mb-2">
                    HIÉRARCHIE GÉOGRAPHIQUE
                  </p>
                  <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 truncate flex-wrap">
                    <span className="text-white/95">{household.region || '?'}</span>
                    <ArrowRight size={10} />
                    <span className="text-white/75">{household.departement || '?'}</span>
                    <ArrowRight size={10} />
                    <span className="text-orange-300">
                      {household.village || '?'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="w-10 h-10 rounded-[0.95rem] bg-indigo-500/10 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-500/15">
                  <Navigation2 size={17} />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 flex-1">
                  <div>
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">
                      LATITUDE
                    </p>
                    <p className="text-[10px] sm:text-[11px] font-mono font-black text-blue-200 truncate">
                      {household.latitude || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">
                      LONGITUDE
                    </p>
                    <p className="text-[10px] sm:text-[11px] font-mono font-black text-blue-200 truncate">
                      {household.longitude || '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* TECHNICAL COCKPIT DASHBOARD */}
          {!isTerminalStatus && (
            <div className="p-1 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent border border-white/10 shadow-2xl overflow-hidden">
              <div className="bg-slate-950/40 backdrop-blur-xl rounded-[2.35rem] p-6 sm:p-8 space-y-8">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-400/60 flex items-center gap-2">
                    <Activity size={14} className="animate-pulse" /> SPÉCIFICATIONS SYSTÈME
                  </h4>
                  {(household as any).priority === 'URGENT' && (
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-[8px] font-black text-rose-400 uppercase tracking-widest animate-bounce">
                      <AlertTriangle size={10} /> Urgence Terrain
                    </div>
                  )}
                </div>

                {/* Grid Visualizer */}
                <div className="grid grid-cols-2 gap-4">
                   {/* Ohm Meter Card */}
                   <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-3 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/50" />
                      <div className="flex items-center justify-between">
                        <Zap size={14} className="text-amber-500/60" />
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Impédance Terre</span>
                      </div>
                      <div className="flex items-end gap-1">
                        <span className={`text-2xl font-black tracking-tighter ${Number((household.constructionData as any)?.audit?.resistance_terre) > 150 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {(household.constructionData as any)?.audit?.resistance_terre ?? '—'}
                        </span>
                        <span className="text-xs font-bold text-slate-600 mb-1.5">Ω</span>
                      </div>
                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (Number((household.constructionData as any)?.audit?.resistance_terre) / 200) * 100)}%` }}
                          className={`h-full ${Number((household.constructionData as any)?.audit?.resistance_terre) > 150 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        />
                      </div>
                   </div>

                   {/* Masonry Card */}
                   <div className="p-5 rounded-3xl bg-black/40 border border-white/5 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50" />
                      <div className="flex items-center justify-between">
                        <Hammer size={14} className="text-blue-500/60" />
                        <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Maçonnerie</span>
                      </div>
                      <p className="text-[10px] font-black text-white uppercase tracking-wider truncate">
                        {(household.constructionData as any)?.macon?.type_mur || 'Non défini'}
                      </p>
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                        <span className="text-[8px] font-bold text-slate-500 uppercase">Structure Validée</span>
                      </div>
                   </div>
                </div>

                {/* Sub-Technical Details */}
                <div className="space-y-4 pt-2">
                  {[
                    { label: 'Réseau / Branchement', data: (household.constructionData as any)?.reseau?.problemes_branchement, color: 'text-sky-400' },
                    { label: 'Installation Intérieure', data: (household.constructionData as any)?.interieur?.problemes_installation, color: 'text-violet-400' },
                  ].filter(s => !!s.data).map((s, i) => (
                    <div key={i} className="flex flex-col gap-2 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                      <div className="flex items-center justify-between">
                        <span className={`text-[8px] font-black uppercase tracking-widest ${s.color}`}>{s.label}</span>
                        <Info size={10} className="text-slate-600" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.data.split(' ').filter(Boolean).map((tag: string, j: number) => (
                          <span key={j} className="px-2 py-0.5 rounded-md bg-white/5 text-[9px] font-bold text-slate-300 border border-white/5">
                            {reformatKoboText(tag)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Assigned Teams */}
          <TeamAllocationsBadge teams={memoizedTeams} />



          {/* Grappe */}
          {grappeInfo && (
            <div className="p-6 sm:p-8 rounded-[2.25rem] border border-blue-400/20 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_35%),linear-gradient(180deg,rgba(59,130,246,0.08),rgba(15,23,42,0.34))] shadow-lg shadow-blue-500/10">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h4 className="text-[10px] font-black uppercase tracking-[0.24em] text-blue-200/75">
                  UNITÉ / GRAPPE
                </h4>
                <div className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-blue-200">
                  {grappeInfo.count ?? 0} ménages
                </div>
              </div>

              <p className="text-cyan-400 font-black text-xl uppercase tracking-tight leading-tight break-words drop-shadow-[0_2px_10px_rgba(34,211,238,0.3)]">
                {grappeInfo.name}
              </p>

              <p className="text-[10px] font-bold uppercase tracking-[0.18em] mt-3 text-blue-300/80">
                {grappeInfo.count ?? 0} MÉNAGES DANS LA ZONE
              </p>
            </div>
          )}


          {/* Kobo Data Explorer */}
          {household.koboData && Object.keys(household.koboData).length > 0 && (
            <div className="p-6 sm:p-8 rounded-[2.5rem] bg-white/5 border border-white/10 space-y-6">
              <h4 className="text-[9px] font-black uppercase tracking-[0.18em] sm:tracking-[0.3em] flex items-center gap-2 text-blue-400/60">
                <Database size={14} /> DÉTAILS FORMULAIRE KOBO
              </h4>

              <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {Object.entries(household.koboData)
                  .filter(([key, val]) =>
                    !key.startsWith('_') &&
                    val !== null &&
                    typeof val !== 'object' &&
                    key !== 'photo' &&
                    key !== 'photoUrl'
                  )
                  .map(([key, val]) => {
                    const rawValue = String(val);
                    const isMultiValue = rawValue.includes(' ') && (rawValue.includes('_') || rawValue.length > 40);
                    const displayValue = formatKoboValue(val);
                    const normalizedValue = displayValue.toLowerCase();
                    const valueTone = normalizedValue.includes('non conforme')
                      ? 'text-rose-200'
                      : normalizedValue === 'conforme' || normalizedValue === 'oui'
                        ? 'text-emerald-200'
                        : 'text-slate-50';

                    return (
                      <div
                        key={key}
                        className="flex flex-col gap-2 rounded-[1.35rem] border border-white/[0.07] bg-black/[0.22] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors hover:border-blue-300/[0.18] hover:bg-white/[0.045]"
                      >
                        <span className="max-w-full whitespace-normal break-words text-[11px] font-semibold normal-case leading-[1.45] tracking-normal text-blue-200/85 sm:text-[12px]">
                          {reformatKoboText(key)}
                        </span>
                        <div className={`max-w-full whitespace-normal break-words text-[14px] font-black leading-snug tracking-[-0.01em] ${valueTone}`}>
                          {isMultiValue ? (
                            <ul className="mt-1 space-y-2">
                              {rawValue.split(' ').filter(Boolean).map((v, idx) => (
                                <li key={idx} className="flex items-start gap-2.5">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400/50" />
                                  <span className="flex-1">{formatKoboValue(v)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p>{displayValue}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                }
              </div>

              <p className="text-[8px] font-bold text-slate-600 uppercase tracking-widest text-center">
                Données synchronisées via API KoboToolbox
              </p>
            </div>
          )}

          {/* Kobo Metadata */}
          <div className="p-5 sm:p-8 rounded-[2rem] border-dashed border-2 border-slate-800 bg-slate-900/30 space-y-6">
            <h4 className="text-[9px] font-black uppercase tracking-[0.18em] sm:tracking-[0.3em] flex items-center gap-2 text-slate-500">
              <Database size={14} /> MÉTADONNÉES SYNC & SYSTÈME
            </h4>

            <div className={`rounded-2xl border p-4 ${syncBadge.classes}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70">
                    Sync local
                  </p>
                  <p className="mt-1 text-sm font-black uppercase tracking-wide">{syncBadge.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-70">
                    File globale
                  </p>
                  <p className="mt-1 text-sm font-black">{isNaN(Number(pendingSyncCount)) ? 0 : pendingSyncCount}</p>
                </div>
              </div>
              <p className="mt-3 text-[10px] font-semibold leading-relaxed opacity-90">
                {syncBadge.helper}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-widest">
                <span className={`rounded-full px-2.5 py-1 ${isOnline ? 'bg-emerald-950/40 text-emerald-300' : 'bg-slate-950/40 text-slate-300'}`}>
                  {isOnline ? 'Connecté' : 'Hors-ligne'}
                </span>
                {lastSyncError ? (
                  <span className="rounded-full bg-rose-950/40 px-2.5 py-1 text-rose-300">
                    Dernière sync en erreur
                  </span>
                ) : null}
              </div>
              <div className="mt-4 rounded-2xl border border-black/10 bg-black/15 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {manualOverrideFields.length > 0 ? (
                      <Lock size={14} className="text-amber-300" />
                    ) : (
                      <LockOpen size={14} className="text-slate-300" />
                    )}
                    <p className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">
                      Champs forcés admin
                    </p>
                  </div>
                  <span className="rounded-full bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest">
                    {manualOverrideFields.length}
                  </span>
                </div>
                {manualOverrideFields.length > 0 ? (
                  <>
                    <p className="mt-2 text-[10px] font-semibold leading-relaxed opacity-90">
                      Ces champs gardent la valeur locale et ne sont pas écrasés par Kobo.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {manualOverrideFields.slice(0, 6).map((field) => (
                        <span
                          key={field}
                          className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-amber-100"
                          title={field}
                        >
                          <Lock size={10} />
                          {formatOverrideLabel(field)}
                        </span>
                      ))}
                      {manualOverrideFields.length > 6 ? (
                        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-200">
                          +{manualOverrideFields.length - 6} autres
                        </span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="mt-2 text-[10px] font-semibold leading-relaxed opacity-90">
                    Aucun cadenas actif. Ce ménage suit entièrement la dernière synchronisation Kobo.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-[10px] font-mono text-slate-400">
              <div>
                <p className="text-slate-600 mb-1 tracking-widest font-sans font-bold">
                  SOURCE
                </p>

                <p className="font-bold text-slate-300 uppercase bg-slate-800/50 inline-block px-2 py-0.5 rounded">
                  {household.source || 'INCONNUE'}
                </p>
              </div>

              <div>
                <p className="text-slate-600 mb-1 tracking-widest font-sans font-bold">
                  KOBO SUBMISSION ID
                </p>

                <p
                  className="font-bold text-slate-300 truncate"
                  title={household.koboSubmissionId?.toString()}
                >
                  {household.koboSubmissionId?.toString() || '—'}
                </p>
              </div>

              <div className="sm:col-span-2 pt-2 border-t border-slate-800/50">
                <p className="text-slate-600 mb-1 tracking-widest font-sans font-bold">
                  DERNIÈRE SYNCHRONISATION (UTC)
                </p>
                <p className="font-bold text-blue-400/80 text-xs">
                  {household.updatedAt && !isNaN(new Date(household.updatedAt).getTime())
                    ? new Date(household.updatedAt).toLocaleString('fr-FR', {
                      timeZoneName: 'short',
                    })
                    : 'En attente'}
                </p>
              </div>
            </div>
          </div>

          {/* EXPORTS MÉTIFERS SECTION */}
          <div className="p-5 sm:p-8 space-y-6">
            <h4 className="text-[9px] font-black uppercase tracking-[0.18em] sm:tracking-[0.3em] flex items-center gap-2 text-blue-400">
              <FileDown size={14} /> EXPORTS & RAPPORTS MÉTIERS
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ÉTAPE 1 : LIVRAISON (Toujours disponible ou Inéligibilité) */}
              <button
                onClick={() => ReportGen.generateLivraisonPDF(household)}
                className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all group"
              >
                <div className="p-2 bg-blue-500/10 rounded-lg group-hover:scale-110 transition-transform">
                  <TruckIcon size={16} className="text-blue-400" />
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-black uppercase tracking-widest text-white">
                    {isTerminalStatus ? 'Attestation' : 'Bon Livraison'}
                  </p>
                  <p className="text-[7px] font-bold text-slate-500 uppercase">Étape 1 - Logistique</p>
                </div>
              </button>

              {/* ÉTAPE 2 : MAÇONNERIE */}
              {(currentStageIndex >= 2 || household.koboSync?.maconOk || (household.constructionData as any)?.macon) ? (
                <button
                  onClick={() => ReportGen.generateMaconneriePDF(household)}
                  className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-amber-500/30 transition-all group animate-in fade-in zoom-in-95"
                >
                  <div className="p-2 bg-amber-500/10 rounded-lg group-hover:scale-110 transition-transform">
                    <HammerIcon size={16} className="text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white">PV Maçonnerie</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">Étape 2 - Support</p>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl opacity-30 grayscale cursor-not-allowed">
                  <HammerIcon size={16} className="text-slate-600" />
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">En attente...</p>
                  </div>
                </div>
              )}

              {/* ÉTAPE 3 : RÉSEAU */}
              {(currentStageIndex >= 3 || household.koboSync?.reseauOk || (household.constructionData as any)?.reseau) ? (
                <button
                  onClick={() => ReportGen.generateBranchementPDF(household)}
                  className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-sky-500/30 transition-all group animate-in fade-in zoom-in-95"
                >
                  <div className="p-2 bg-sky-500/10 rounded-lg group-hover:scale-110 transition-transform">
                    <ZapIcon size={16} className="text-sky-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white">Fiche Réseau</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">Étape 3 - Branchement</p>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl opacity-30 grayscale cursor-not-allowed">
                  <ZapIcon size={16} className="text-slate-600" />
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">En attente...</p>
                  </div>
                </div>
              )}

              {/* ÉTAPE 4 : INSTALLATION */}
              {(currentStageIndex >= 4 || household.koboSync?.interieurOk || (household.constructionData as any)?.interieur) ? (
                <button
                  onClick={() => ReportGen.generateInstallationPDF(household)}
                  className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-violet-500/30 transition-all group animate-in fade-in zoom-in-95"
                >
                  <div className="p-2 bg-violet-500/10 rounded-lg group-hover:scale-110 transition-transform">
                    <FileText size={16} className="text-violet-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white">PV Installation</p>
                    <p className="text-[7px] font-bold text-slate-500 uppercase">Étape 4 - Intérieur</p>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl opacity-30 grayscale cursor-not-allowed">
                  <FileText size={16} className="text-slate-600" />
                  <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 italic">En attente...</p>
                  </div>
                </div>
              )}

              {/* ÉTAPE 5 : CERTIFICAT FINAL */}
              {(currentStageIndex >= 5 || household.koboSync?.controleOk || (household.constructionData as any)?.audit) ? (
                <button
                  onClick={() => ReportGen.generateConformiteFinalPDF(household)}
                  className="col-span-1 sm:col-span-2 flex items-center justify-center gap-4 p-5 bg-emerald-500/10 border border-emerald-500/20 rounded-[1.5rem] hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all group shadow-lg shadow-emerald-500/5 animate-in fade-in slide-in-from-bottom-4"
                >
                  <ShieldCheck size={24} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                  <div className="text-left">
                    <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white">Certificat de Conformité Final</p>
                    <p className="text-[8px] font-bold text-emerald-500/60 uppercase">Rapport complet d'Audit NS 01 001 & NF C14-100</p>
                  </div>
                  <Download size={18} className="ml-auto text-emerald-400 opacity-40 group-hover:opacity-100 transition-opacity" />
                </button>
              ) : (
                <div className="col-span-1 sm:col-span-2 flex items-center justify-center gap-4 p-5 bg-white/[0.02] border border-white/5 rounded-[1.5rem] opacity-20 grayscale cursor-not-allowed">
                  <ShieldCheck size={24} className="text-slate-600" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 italic">Audit final non encore effectué</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Actions Bottom Sticky — OPTIMISÉ MOBILE FIELD WORK */}
      <div className="shrink-0 border-t border-white/10 bg-slate-950/92 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-15px_35px_rgba(0,0,0,0.5)] backdrop-blur-3xl sm:px-5">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_3.5rem] gap-2.5">
          {!routingEnabled ? (
            <button
              onClick={onTraceItinerary}
              className="flex h-[52px] min-w-0 items-center justify-center gap-2 rounded-[1.15rem] border border-blue-300/20 bg-blue-600 px-2 text-white shadow-xl shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-95"
            >
              <Navigation size={18} className="shrink-0 rotate-45" />
              <span className="truncate text-[10px] font-black uppercase tracking-[0.12em]">Itinéraire</span>
            </button>
          ) : (
            <button
              onClick={onCancelItinerary}
              className="flex h-[52px] min-w-0 items-center justify-center gap-2 rounded-[1.15rem] border border-rose-500/40 bg-rose-500/[0.18] px-2 text-rose-300 transition-all active:scale-95"
            >
              <X size={18} className="shrink-0" />
              <span className="truncate text-[10px] font-black uppercase tracking-[0.12em]">Annuler</span>
            </button>
          )}

          {/* BOUTON RAPPORT CONTEXTUEL — SMART ACTION */}
          <motion.button
            onClick={smartReportAction.action}
            whileTap={{ scale: 0.96 }}
            className={`relative flex h-[52px] min-w-0 items-center justify-center gap-2 overflow-hidden rounded-[1.15rem] border border-white/20 bg-[linear-gradient(135deg,var(--tw-gradient-stops))] ${smartReportAction.color} px-2 text-white shadow-xl shadow-blue-600/20 transition-all hover:brightness-110`}
          >
            <span className="absolute inset-y-0 -left-1/2 w-1/2 animate-pulse bg-gradient-to-r from-transparent via-white/20 to-transparent blur-sm" />
            {React.cloneElement(smartReportAction.icon as React.ReactElement<any>, { size: 18, className: "relative z-10 shrink-0 text-white/90" })}
            <span className="relative z-10 truncate text-[10px] font-black uppercase tracking-[0.12em]">{smartReportAction.label}</span>
          </motion.button>

          {/* Formulaire interne GEM — soumission VPS */}
          <button
            onClick={() => {
              refreshInternalKoboQueueCount();
              setShowInternalReportModal(true);
            }}
            className="relative flex h-[52px] w-14 items-center justify-center rounded-[1.15rem] border border-white/[0.08] bg-slate-900/85 text-slate-300 transition-all hover:bg-slate-800 hover:text-white active:scale-95"
            title="Ouvrir le formulaire interne VPS"
            aria-label="Ouvrir le formulaire interne VPS"
          >
            <Database size={20} />
            {internalKoboQueueCount > 0 ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border border-sky-200/60 bg-sky-400 px-1 text-[9px] font-black text-slate-950 shadow-lg shadow-sky-500/30">
                {internalKoboQueueCount > 9 ? '9+' : internalKoboQueueCount}
              </span>
            ) : null}
          </button>
        </div>

        {routingEnabled && (
          <button
            onClick={() => {
              const [lng, lat] = household.location!.coordinates;
              window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
            }}
            className="mt-2.5 flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 text-[10px] font-black uppercase tracking-widest text-white/70"
          >
            <Navigation2 size={14} className="rotate-90" />
            Lancer Google Maps
          </button>
        )}
      </div>

      {/* Status Modal - Premium Version (Portaled to break out of transformed side panel) */}
      {showStatusModal && createPortal(
        <div className="fixed inset-0 z-[5000] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-3xl p-3 sm:p-6 overflow-hidden">
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-10 max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-3xl bg-slate-900 border border-white/10 ring-1 ring-white/5"
          >
            <h3 className="text-2xl font-black uppercase tracking-tighter mb-2 text-white leading-none">
              Status Audit
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] sm:tracking-[0.3em] mb-10 text-blue-500/50 leading-none">
              Évolution du cycle de vie terrain
            </p>

            <div className="space-y-2 mb-10 max-h-[40vh] overflow-y-auto pr-3 custom-scrollbar">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => setSelectedNewStatus(status)}
                  className={`w-full p-5 rounded-2xl border-2 transition-all text-left font-black text-[9px] uppercase tracking-[0.2em] ${selectedNewStatus === status
                    ? 'bg-blue-600 border-blue-600 text-white shadow-xl shadow-blue-600/30 scale-[1.02]'
                    : 'bg-white/5 border-white/10 hover:border-blue-500/40 text-slate-400'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => {
                  setShowStatusModal(false);
                  setSelectedNewStatus(null);
                }}
                disabled={isUpdating}
                className="flex-1 h-14 rounded-2xl font-black text-[9px] uppercase tracking-widest bg-white/5 text-slate-500 hover:bg-white/10 transition-all"
              >
                FERMER
              </button>
              <button
                onClick={handleConfirmStatusChange}
                disabled={!selectedNewStatus || isUpdating}
                className="flex-1 h-14 rounded-2xl bg-blue-600 text-white font-black text-[9px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:brightness-110 active:scale-95 disabled:opacity-20"
              >
                {isUpdating ? 'PROCESS...' : 'Mettre à jour'}
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
      {/* Formulaire GEM-Kobo natif */}
      {showInternalReportModal && createPortal(
        <InternalKoboForm
          values={nativeKoboAuditForm}
          onChange={updateNativeKoboAuditField}
          onSave={handleSaveNativeKoboAudit}
          onClose={() => setShowInternalReportModal(false)}
          isSaving={isUpdating}
          onPhotoUpload={onPhotoUpload}
          onResolvedHousehold={handleInternalKoboResolvedHousehold}
          resolveHouseholdByNumero={resolveHouseholdByNumero}
          queueCount={internalKoboQueueCount}
          isOnline={isOnline}
        />,
        document.body
      )}

      {/* Admin Control Center Modal */}
      {isAdmin && onUpdate && (
        <AdminControlCenterModal
          isOpen={showAdminModal}
          onClose={() => setShowAdminModal(false)}
          household={household}
          onUpdate={onUpdate}
        />
      )}
    </motion.div>
  );
};

export default HouseholdDetailsPanel;
