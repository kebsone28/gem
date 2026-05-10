/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, no-empty */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../store/db';
import type { UserRole, User } from '../utils/types';
import {
  Users,
  Plus,
  Trash2,
  ShieldCheck,
  Shield as ShieldIcon,
  User as UserIcon,
  Eye,
  EyeOff,
  Save,
  X,
  Search,
  Lock,
  CheckCircle2 as CheckIcon,
  AlertTriangle,
  RefreshCcw,
  Briefcase,
  Calculator,
  Award,
  Settings as SettingsIcon,
  Layout,
  FileText,
} from 'lucide-react';
import { appSecurity } from '../services/appSecurity';
import { useAuth } from '../contexts/AuthContext';
import { PageContainer, PageHeader, ContentArea, Modal } from '../components';
import {
  PERMISSION_LABELS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  normalizeRole,
  invalidatePermissionsCache,
} from '../utils/permissions';
import type { UserRole as PermissionUserRole } from '../utils/security/types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { userService } from '../services/userService';
import { organizationService } from '../services/organizationService';
import { auditService } from '../services/auditService';
import projectService from '../services/projectService';
import adminPermissionsService from '../services/adminPermissionsService';
import logger from '../utils/logger';
import { isMasterAdminEmail } from '../utils/roleUtils';

// Les constantes statiques de sécurité sont gérées par appSecurity

// ─── Config rôles ───────────────────────────────────────────────────
const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    color: string;
    textColor: string;
    icon: typeof ShieldIcon;
    description: string;
  }
> = {
  // CLIENT LSE
  CLIENT_LSE_SUPERVISEUR: {
    label: 'Superviseur LSE',
    color: 'bg-amber-500/10 border-amber-500/50',
    textColor: 'text-amber-400',
    icon: UserIcon,
    description: 'Supervision & Validation',
  },
  CLIENT_LSE_TECHNIQUE: {
    label: 'Technicien LSE',
    color: 'bg-amber-500/10 border-amber-500/50',
    textColor: 'text-amber-400',
    icon: UserIcon,
    description: 'Validation Technique',
  },
  
  // PROQUELEC/GEM - MAÎTRE D'ŒUVRE
  PROQUELEC_ADMIN: {
    label: 'Administrateur Proquelec',
    color: 'bg-indigo-500/10 border-indigo-500/50',
    textColor: 'text-indigo-400',
    icon: ShieldCheck,
    description: 'Accès complet & 2FA',
  },
  PROQUELEC_DG: {
    label: 'DG Proquelec',
    color: 'bg-emerald-500/10 border-emerald-500/50',
    textColor: 'text-emerald-400',
    icon: ShieldIcon,
    description: 'Direction GEM',
  },
  PROQUELEC_CHEF_PROJET: {
    label: 'Chef de Projet',
    color: 'bg-sky-500/10 border-sky-500/50',
    textColor: 'text-sky-400',
    icon: Briefcase,
    description: 'Gestion de Mission',
  },
  PROQUELEC_DIRECTION: {
    label: 'Direction Opérationnelle',
    color: 'bg-blue-500/10 border-blue-500/50',
    textColor: 'text-blue-400',
    icon: Users,
    description: 'Supervision & Coordination',
  },
  PROQUELEC_COMPTABLE: {
    label: 'Comptable',
    color: 'bg-rose-500/10 border-rose-500/50',
    textColor: 'text-rose-400',
    icon: Calculator,
    description: 'Finances & Audit',
  },
  PROQUELEC_PATRIMOINE: {
    label: 'Gestion Patrimoine',
    color: 'bg-purple-500/10 border-purple-500/50',
    textColor: 'text-purple-400',
    icon: Award,
    description: 'Actifs & Maintenance',
  },
  PROQUELEC_EMPLOYE: {
    label: 'Employé Proquelec',
    color: 'bg-blue-500/10 border-blue-500/50',
    textColor: 'text-blue-400',
    icon: UserIcon,
    description: 'Opérations & Reporting',
  },
  
  // SENELEC - SUPERVISEUR NATIONAL
  SENELEC_SUPERVISEUR: {
    label: 'Superviseur SENELEC',
    color: 'bg-cyan-500/10 border-cyan-500/50',
    textColor: 'text-cyan-400',
    icon: ShieldIcon,
    description: 'Contrôle Technique National',
  },
  SENELEC_CONTROLEUR: {
    label: 'Contrôleur SENELEC',
    color: 'bg-cyan-500/10 border-cyan-500/50',
    textColor: 'text-cyan-400',
    icon: ShieldIcon,
    description: 'Inspection & Conformité',
  },
  
  // SOUS-TRAITANTS
  SOUS_TRAITANT_DIRECTEUR: {
    label: 'Directeur Sous-traitant',
    color: 'bg-orange-500/10 border-orange-500/50',
    textColor: 'text-orange-400',
    icon: Users,
    description: 'Coordination & Reporting',
  },
  SOUS_TRAITANT_EMPLOYE: {
    label: 'Employé Sous-traitant',
    color: 'bg-orange-500/10 border-orange-500/50',
    textColor: 'text-orange-400',
    icon: UserIcon,
    description: 'Exécution Terrain',
  },
};

// ─── Unification des Modules Métier ──────────────────────────────────────────
const FEATURE_PACKS: Record<
  string,
  {
    label: string;
    icon: any;
    color: string;
    bg: string;
    border: string;
    desc: string;
    permissions: string[];
  }
> = {
  prep: {
    label: 'Stratégie',
    icon: FileText,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
    desc: 'Gestion des missions (Ordres de Mission, Cadrage, Planning)',
    permissions: [
      PERMISSIONS.VOIR_MISSIONS,
      PERMISSIONS.CREER_MISSION,
      PERMISSIONS.MODIFIER_MISSION,
      PERMISSIONS.GERER_PLANNING,
    ],
  },
  report: {
    label: 'Exécution',
    icon: CheckIcon,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
    desc: 'Suivi financier, paiements, rapports terrain et logistique',
    permissions: [
      PERMISSIONS.VOIR_RAPPORTS_TERRAIN,
      PERMISSIONS.VOIR_FINANCES,
      PERMISSIONS.VOIR_PAIEMENTS,
      PERMISSIONS.VOIR_LOGISTIQUE,
    ],
  },
  approval: {
    label: 'Approbations',
    icon: ShieldIcon,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
    desc: 'Validations finales, PV de réception et documents confidentiels',
    permissions: [
      PERMISSIONS.VALIDER_MISSION,
      PERMISSIONS.APPROUVER_MISSION,
      PERMISSIONS.GERER_PV,
      PERMISSIONS.VOIR_DOCUMENTS_CONFIDENTIELS,
    ],
  },
  global: {
    label: 'Pilotage Global',
    icon: Layout,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    border: 'border-indigo-400/20',
    desc: 'Supervision globale : Projets, Équipes, Audit et Synchronisation',
    permissions: [
      PERMISSIONS.VOIR_PROJETS,
      PERMISSIONS.VOIR_EQUIPES,
      PERMISSIONS.VOIR_AUDIT_LOGS,
      PERMISSIONS.VOIR_SYNCHRO,
      PERMISSIONS.VOIR_ALERTES,
    ],
  },
};

type UserForm = Omit<User, 'id' | 'createdAt'>;

const emptyForm = (): UserForm => ({
  email: '',
  notificationEmail: '',
  password: '',
  role: 'PROQUELEC_EMPLOYE',
  name: '',
  teamId: undefined,
  active: true,
  requires2FA: false,
  permissions: [],
  assignedProjectIds: [], // New field for UI management
});

// ─── Composant principal ─────────────────────────────────────────────────────
export default function AdminUsers() {
  const navigate = useNavigate();
  const [applyingRoleDefaults, setApplyingRoleDefaults] = useState(false);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [pendingApplyPerms, setPendingApplyPerms] = useState<string[] | null>(null);
  const [pendingApplyRole, setPendingApplyRole] = useState<string | null>(null);
  const { user, impersonate } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [showPass, setShowPass] = useState(false);

  // ── Delete modal state ──
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [delPass, setDelPass] = useState('');
  const [delAnswer, setDelAnswer] = useState('');
  const [delStep, setDelStep] = useState<1 | 2>(1);
  const [delError, setDelError] = useState('');
  const [showDelPass, setShowDelPass] = useState(false);
  const [deleteConfirmedName, setDeleteConfirmedName] = useState('');
  const [activeSecurityQuestion, setActiveSecurityQuestion] = useState('');

  // ── Organization Config State ──
  const [orgConfig, setOrgConfig] = useState<any>({
    mission_panels_dg: ['prep', 'report', 'approval'],
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Load data from API
  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        userService.getUsers(),
        db.teams.toArray(),
        projectService.getProjects(),
      ]);

      if (results[0].status === 'fulfilled') {
        setUsers(results[0].value);
      } else {
        toast.error("Échec du chargement des utilisateurs");
        logger.error('[AdminUsers] Load users failed', results[0].reason);
      }

      if (results[1].status === 'fulfilled') {
        setTeams(results[1].value);
      } else {
        logger.warn('[AdminUsers] Load teams from Dexie failed', results[1].reason);
      }

      if (results[2].status === 'fulfilled') {
        setProjects(results[2].value);
      } else {
        toast.error("Échec du chargement des projets");
        logger.error('[AdminUsers] Load projects failed', results[2].reason);
      }
    } catch (err) {
      toast.error('Erreur critique lors du chargement des données');
      logger.error('[AdminUsers] Critical load failure', err);
    } finally {
      setLoading(false);
    }
  };

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    loadData();
    loadOrgConfig();
    appSecurity.get('securityQuestion').then(setActiveSecurityQuestion);
  }, []);

  const loadOrgConfig = async () => {
    try {
      const data = await organizationService.getConfig();
      if (data?.config) setOrgConfig(data.config);
    } catch (err) {
      logger.warn('[AdminUsers] Failed to load org config', err);
    }
  };

  const updateOrgConfig = async (newConfig: any) => {
    setIsSavingConfig(true);
    try {
      await organizationService.updateConfig(newConfig);
      setOrgConfig(newConfig);
      toast.success("Configuration de l'organisation mise à jour");
    } catch (err) {
      toast.error('Échec de la mise à jour de la config');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const toggleDGPanel = (panelId: string) => {
    const current = orgConfig.mission_panels_dg || [];
    const next = current.includes(panelId)
      ? current.filter((id: string) => id !== panelId)
      : [...current, panelId];
    updateOrgConfig({ ...orgConfig, mission_panels_dg: next });
  };

  // ── Password reset modal ──
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // ─── Filtering ────────────────────────────────────────────────────────────
  const filtered = users.filter(
    (u: User) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Open form (create / edit) ────────────────────────────────────────────
  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
    setShowPass(false);
  };
  const openEdit = (u: User) => {
    if (u.role === 'ADMIN_PROQUELEC' && user?.id !== u.id) {
      toast.error('Impossible de modifier un autre Administrateur Système');
      return;
    }
    setEditId(u.id);
    
    // Compute which projects this user is assigned to
    const userProjects = projects
      .filter(p => {
        const assigned = p.config?.assignedUsers || [];
        return assigned.includes(u.id);
      })
      .map(p => p.id);

    setForm({
      email: u.email,
      notificationEmail: (u as any).notificationEmail || '',
      password: '', // Do not show current pass
      role: u.role,
      name: u.name || '',
      teamId: u.teamId,
      active: u.active ?? true,
      requires2FA: !!u.requires2FA,
      permissions: u.permissions ?? undefined,
      assignedProjectIds: userProjects,
    } as any);
    setShowForm(true);
    setShowPass(false);
  };

  const togglePermission = (p: string) => {
    setForm((f: any) => {
      const currentRole = normalizeRole(f.role) || (f.role as PermissionUserRole);

      // Si on est en mode Auto (null ou undefined), on part de la base du rôle
      const isAuto = f.permissions === null || f.permissions === undefined;
      const current = isAuto ? ROLE_PERMISSIONS[currentRole] || [] : f.permissions;

      if (current.includes(p)) {
        return { ...f, permissions: current.filter((x: string) => x !== p) };
      } else {
        return { ...f, permissions: [...current, p] };
      }
    });
  };

  const toggleFeaturePack = (packId: string) => {
    const pack = FEATURE_PACKS[packId];
    if (!pack) return;

    setForm((f: any) => {
      const currentRole = normalizeRole(f.role) || (f.role as PermissionUserRole);
      const isAuto = f.permissions === null || f.permissions === undefined;
      const current = isAuto ? ROLE_PERMISSIONS[currentRole] || [] : f.permissions;

      // Si toutes les perms du pack sont déjà là, on les retire toutes
      // Sinon, on s'assure qu'elles y sont toutes
      const hasAll = pack.permissions.every((p) => current.includes(p));
      let next;
      if (hasAll) {
        next = current.filter((p) => !pack.permissions.includes(p));
      } else {
        next = Array.from(new Set([...current, ...pack.permissions]));
      }
      return { ...f, permissions: next };
    });
  };

  const applyDefaultPermissions = () => {
    // En mettant permissions à undefined, le système repasse automatiquement
    // sur le fallback du RÔLE (comportement par défaut)
    setForm((f: any) => ({ ...f, permissions: null })); // null tells the server to reset to role defaults
    toast(`✅ Compte synchronisé sur les droits par défaut du rôle ${form.role}`, { icon: 'ℹ️' });
  };

  // ─── Save (create / update) ───────────────────────────────────────────────
  const saveUser = async () => {
    const trimmedEmail = form.email.trim();
    const trimmedName = form.name.trim();

    if (!trimmedEmail || (!editId && !form.password?.trim()) || !trimmedName) {
      toast.error('Tous les champs obligatoires doivent être remplis.');
      return;
    }
    
    const finalForm = {
      ...form,
      email: trimmedEmail,
      name: trimmedName,
    };

    if (!editId && (form.password?.length ?? 0) < 6) {
      toast.error('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    try {
      let finalUserId = editId;
      if (editId) {
        // Find existing user to log changes
        const oldUser = users.find((u) => u.id === editId);
        await userService.updateUser(editId, finalForm);

        if (user) {
          auditService.logAction(
            user,
            'Modification Utilisateur',
            'UTILISATEURS',
            `A modifié le compte de "${trimmedName}" (${trimmedEmail}). Rôle: ${oldUser?.role} -> ${form.role}`,
            'info'
          );
        }
        toast.success(`✏️  Compte "${trimmedName}" mis à jour sur le serveur.`);
      } else {
        const newUser = await userService.createUser(finalForm);
        finalUserId = newUser.id;
        if (user) {
          auditService.logAction(
            user,
            'Création Utilisateur',
            'UTILISATEURS',
            `A créé le compte de "${form.name}" avec le rôle ${form.role}`,
            'info'
          );
        }
        toast.success(`✅  Compte "${form.name}" créé sur le serveur.`);
      }

      // ── Update Project Assignments ──
      if (finalUserId) {
        invalidatePermissionsCache(finalUserId);
        const assignedIds = (form as any).assignedProjectIds || [];
        const updatePromises = projects.map(async (p) => {
          const currentAssigned = p.config?.assignedUsers || [];
          const isCurrentlyAssigned = currentAssigned.includes(finalUserId);
          const shouldBeAssigned = assignedIds.includes(p.id);

          if (shouldBeAssigned && !isCurrentlyAssigned) {
            // Add user to project
            const nextAssigned = [...currentAssigned, finalUserId];
            await projectService.updateProject(p.id, {
              config: { ...p.config, assignedUsers: nextAssigned }
            });
          } else if (!shouldBeAssigned && isCurrentlyAssigned) {
            // Remove user from project
            const nextAssigned = currentAssigned.filter((id: string) => id !== finalUserId);
            await projectService.updateProject(p.id, {
              config: { ...p.config, assignedUsers: nextAssigned }
            });
          }
        });
        
        // Wait for all assignments with a timeout to prevent hanging UI
        try {
          await Promise.race([
            Promise.all(updatePromises),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Délai d\'assignation dépassé')), 10000))
          ]);
        } catch (assignError: any) {
          logger.warn('[AdminUsers] Project assignment partially failed or timed out', assignError);
          toast.error("Certaines assignations de projets n'ont pas pu être finalisées");
        }
      }

      setShowForm(false);
      loadData(); // Refresh list
    } catch (err: any) {
      toast.error(`❌  Erreur: ${err.message}`);
    }
  };

  // ─── Open delete modal ────────────────────────────────────────────────────
  const openDelete = (u: User) => {
    if (u.id === '1' || u.role === 'ADMIN_PROQUELEC') {
      toast.error('Impossible de supprimer un compte Administrateur.');
      return;
    }
    setDeleteTarget(u);
    setDelPass('');
    setDelAnswer('');
    setDelError('');
    setDelStep(1);
    setShowDelPass(false);
    setDeleteConfirmedName('');
  };

  // ─── Confirm delete: step 1 (password) ────────────────────────────────────
  const confirmDelStep1 = async () => {
    if (!deleteTarget) return;
    // Non-admin: require name confirmation before delete
    if (deleteTarget.role !== 'ADMIN_PROQUELEC') {
      if (
        !deleteConfirmedName ||
        deleteConfirmedName.toLowerCase() !== (deleteTarget.name || '').toLowerCase()
      ) {
        setDelError("Veuillez saisir le nom de l'utilisateur pour confirmer la suppression.");
        return;
      }
      await executeDelete();
      return;
    }
    // Admin: check password first
    const ok = await appSecurity.check('adminPassword', delPass);
    if (!ok) {
      setDelError('Mot de passe incorrect. Veuillez réessayer.');
      return;
    }
    setDelError('');
    setDelStep(2);
  };

  // ─── Confirm delete: step 2 (security question) ───────────────────────────
  const confirmDelStep2 = async () => {
    const ok = await appSecurity.check('securityAnswer', delAnswer, true);
    if (!ok) {
      setDelError('Réponse incorrecte. Suppression annulée.');
      return;
    }
    executeDelete();
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    try {
      await userService.deleteUser(deleteTarget.id);
      if (user) {
        auditService.logAction(
          user,
          'Suppression Utilisateur',
          'UTILISATEURS',
          `A SUPPRIMÉ le compte de "${name}" (${deleteTarget.email})`,
          'warning'
        );
      }
      toast(`🗑️  Compte "${name}" supprimé du serveur.`, { icon: '⚠️' });
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(`❌  Erreur: ${err.message}`);
    }
  };

  // ─── Toggle active ────────────────────────────────────────────────────────
  const toggleActive = async (u: User) => {
    if (u.id === '1') {
      toast.error('Impossible de désactiver le compte Admin principal.');
      return;
    }
    const next = !u.active;
    try {
      await userService.updateUser(u.id, { active: next });
      if (user) {
        auditService.logAction(
          user,
          next ? 'Activation Utilisateur' : 'Désactivation Utilisateur',
          'UTILISATEURS',
          `A ${next ? 'activé' : 'désactivé'} le compte de "${u.name}"`,
          next ? 'info' : 'warning'
        );
      }
      if (next) {
        toast.success(`▶️  Compte "${u.name}" activé.`);
      } else {
        toast(`⏸️  Compte "${u.name}" désactivé.`, { icon: 'ℹ️' });
      }
      loadData();
    } catch (err: any) {
      toast.error(`❌  Erreur: ${err.message}`);
    }
  };

  // ─── Quick password reset ────────────────────────────────────────────────
  const openReset = (u: User) => {
    setResetTarget(u);
    setNewPassword('');
    setShowNewPass(false);
  };
  const saveReset = async () => {
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      toast.error('Le mot de passe doit faire au moins 6 caractères.');
      return;
    }
    try {
      await userService.updateUser(resetTarget.id, { password: newPassword });
      if (user) {
        auditService.logAction(
          user,
          'Réinitialisation Mot de Passe',
          'UTILISATEURS',
          `A forcé la modification du mot de passe de "${resetTarget.name}"`,
          'warning'
        );
      }
      toast.success(`🔑  Mot de passe de "${resetTarget.name}" réinitialisé.`);
      setResetTarget(null);
      loadData();
    } catch (err: any) {
      toast.error(`❌  Erreur: ${err.message}`);
    }
  };

  // ─── Role stats ──────────────────────────────────────────────────────────
  const roleStats = Object.entries(ROLE_CONFIG).map(([roleKey, cfg]) => ({
    ...cfg,
    role: roleKey,
    count: users.filter((u: User) => {
      // Comparer le rôle brut ou normalisé pour correspondre à la clé de ROLE_CONFIG
      const nUserRole = normalizeRole(u.role);
      const nConfigRole = normalizeRole(roleKey);
      return nUserRole === nConfigRole || u.role === roleKey;
    }).length,
  }));

  const isAdminDelete = deleteTarget?.role === 'ADMIN_PROQUELEC';

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4000] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="bg-slate-900 border border-slate-800/80 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl overflow-hidden relative"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-200 dark:bg-rose-900/70">
                <motion.div
                  className="h-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              <div className="flex items-center gap-5 mb-8">
                <div className="w-14 h-14 bg-rose-100 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-200 dark:shadow-rose-600">
                  <Trash2 className="text-rose-500" size={24} />
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-black text-xl leading-snug">
                    {isAdminDelete ? 'Action Haute Sécurité' : 'Supprimer le compte'}
                  </h3>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-0.5">
                    {isAdminDelete ? `Vérification ${delStep}/2` : 'Validation Requise'}
                  </p>
                </div>
              </div>

              <div className="p-5 rounded-[2rem] bg-rose-50 dark:bg-rose-900/50 border border-rose-200 dark:border-rose-600 mb-8 space-y-2">
                <p className="text-rose-900 dark:text-rose-100 text-sm font-medium">
                  Vous êtes sur le point de supprimer :
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white font-black text-xs">
                    {deleteTarget.name.charAt(0)}
                  </div>
                  <span className="text-white font-black">{deleteTarget.name}</span>
                </div>
                <p className="text-rose-900/60 dark:text-rose-100 text-xs uppercase font-black pt-1">
                  Action Irréversible
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (isAdminDelete) {
                    if (delStep === 1) confirmDelStep1();
                    else confirmDelStep2();
                  } else confirmDelStep1();
                }}
                className="space-y-6"
              >
                {isAdminDelete ? (
                  <div className="space-y-4">
                    {delStep === 1 ? (
                      <div className="space-y-3">
                        <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">
                          Confirmation Administrateur
                        </label>
                        <div className="relative">
                          <input
                            type={showDelPass ? 'text' : 'password'}
                            value={delPass}
                            onChange={(e) => {
                              setDelPass(e.target.value);
                              setDelError('');
                            }}
                            placeholder="Saisissez votre mot de passe"
                            title="Mot de passe administrateur"
                            autoComplete="current-password"
                            autoFocus
                            className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 text-white font-mono text-sm placeholder:text-slate-700 dark:text-slate-300 outline-none transition-all ${delError ? 'border-rose-500 ring-4 ring-rose-200 dark:ring-rose-600' : 'border-slate-800 focus:border-rose-500/50 focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-900/50'}`}
                          />
                          <button
                            type="button"
                            aria-label="Afficher/masquer"
                            onClick={() => setShowDelPass((v) => !v)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                          >
                            {showDelPass ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-5 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-600">
                          <p className="text-indigo-900 dark:text-indigo-100 text-xs font-black uppercase tracking-widest mb-1.5">
                            Question de sécurité
                          </p>
                          <p className="text-white font-bold leading-relaxed">
                            {activeSecurityQuestion}
                          </p>
                        </div>
                        <div className="space-y-3">
                          <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">
                            Votre Réponse
                          </label>
                          <input
                            type="text"
                            value={delAnswer}
                            onChange={(e) => {
                              setDelAnswer(e.target.value);
                              setDelError('');
                            }}
                            placeholder="Répondre ici..."
                            aria-label="Réponse à la question de sécurité"
                            autoComplete="off"
                            autoFocus
                            className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 text-white font-bold text-sm outline-none transition-all ${delError ? 'border-rose-500 ring-4 ring-rose-200 dark:ring-rose-600' : 'border-slate-800 focus:border-rose-500/50'}`}
                          />
                        </div>
                      </div>
                    )}
                    {delError && (
                      <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-rose-900 dark:text-rose-100 text-xs font-bold text-center"
                      >
                        {delError}
                      </motion.p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">
                        Confirmer la suppression
                      </label>
                      <input
                        type="text"
                        placeholder={`Saisir "${deleteTarget?.name}" pour confirmer`}
                        value={deleteConfirmedName}
                        onChange={(e) => {
                          setDeleteConfirmedName(e.target.value);
                          setDelError('');
                        }}
                        autoFocus
                        className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 text-white font-bold text-sm placeholder:text-slate-700 outline-none transition-all ${delError ? 'border-rose-500 ring-4 ring-rose-200 dark:ring-rose-600' : 'border-slate-800 focus:border-rose-500/50'}`}
                      />
                    </div>
                    {delError && (
                      <motion.p
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-rose-900 dark:text-rose-100 text-xs font-bold text-center"
                      >
                        {delError}
                      </motion.p>
                    )}
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 py-4 bg-slate-800/50 text-slate-400 rounded-2xl font-black text-sm hover:bg-slate-800 hover:text-white transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-[1.5] py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black text-sm transition-all shadow-xl shadow-rose-600/25 active:scale-95"
                  >
                    {isAdminDelete
                      ? delStep === 1
                        ? 'Vérifier →'
                        : 'Confirmer la suppression'
                      : 'Oui, Supprimer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Apply-to-role Confirmation Modal */}
      <Modal
        isOpen={confirmApplyOpen}
        onClose={() => setConfirmApplyOpen(false)}
        title={`Confirmer l'écrasement des permissions`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setConfirmApplyOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-200 text-gray-800 mr-2"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!pendingApplyRole || !pendingApplyPerms) return setConfirmApplyOpen(false);
                try {
                  setApplyingRoleDefaults(true);
                  await adminPermissionsService.updateRolePermissions(
                    pendingApplyRole,
                    pendingApplyPerms
                  );
                  toast.success('Matrice mise à jour pour le rôle');
                } catch (err: any) {
                  logger.error('Apply role defaults failed', err);
                  toast.error('Erreur lors de la mise à jour de la matrice');
                } finally {
                  setApplyingRoleDefaults(false);
                  setConfirmApplyOpen(false);
                  setPendingApplyPerms(null);
                  setPendingApplyRole(null);
                }
              }}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white"
            >
              Confirmer
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-400">
          Vous allez écraser la configuration par défaut du rôle <strong>{pendingApplyRole}</strong>
          .
        </p>
        <p className="text-sm text-slate-400 mt-3">
          Nombre de permissions à appliquer : <strong>{pendingApplyPerms?.length ?? 0}</strong>
        </p>
      </Modal>

      {/* Reset Password Modal */}
      <AnimatePresence>
        {resetTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[4000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-600 rounded-2xl flex items-center justify-center">
                  <RefreshCw size={22} className="text-indigo-900 dark:text-indigo-100" />
                </div>
                <div>
                  <h3 className="text-white font-black text-lg">Réinitialiser</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                    {resetTarget.name}
                  </p>
                </div>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveReset();
                }}
                className="space-y-6"
              >
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock size={16} />
                  </div>
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nouveau mot de passe"
                    aria-label="Nouveau mot de passe (min. 6 car.)"
                    autoComplete="new-password"
                    autoFocus
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-12 py-3.5 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                  />
                  <button
                    type="button"
                    aria-label="Afficher/masquer"
                    onClick={() => setShowNewPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  >
                    {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setResetTarget(null)}
                    className="flex-1 py-3.5 bg-slate-800/50 text-slate-400 rounded-xl font-bold hover:bg-slate-800 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95"
                  >
                    <Save size={16} /> Enregistrer
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader
        title="Utilisateurs"
        subtitle="Gestion des comptes et des accès"
        icon={<Users size={24} />}
      />
      <ContentArea className="space-y-8 p-8 bg-slate-950 border-slate-800">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header Section */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 inline-flex items-center justify-center rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.4)]">
                  <Users className="text-white w-5 h-5" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                  Utilisateurs
                </h1>
              </div>
              <p className="text-slate-500 font-bold text-sm md:ml-13">
                {users.length} comptes enregistrés —{' '}
                <span className="text-emerald-500">
                  {users.filter((u: User) => u.active).length} actifs
                </span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full md:w-auto min-w-0">
              <div className="relative group flex-1 min-w-0">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 w-4 h-4 transition-colors" />
                <input
                  type="text"
                  placeholder="Filtrer..."
                  title="Filtrer par nom, login ou rôle"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64 min-w-0 bg-slate-900 border border-slate-800/50 rounded-2xl pl-11 pr-4 py-3.5 text-white font-bold text-sm placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                />
              </div>
              <button
                onClick={openAdd}
                aria-label="Créer un nouvel utilisateur"
                className="w-full sm:w-auto justify-center bg-indigo-600 hover:bg-slate-50 dark:bg-indigo-600 dark:hover:bg-indigo-500 hover:text-indigo-600 dark:hover:text-white text-white font-black px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
              >
                <Plus size={20} strokeWidth={3} />
                Nouveau
              </button>
            </div>
          </header>

          {/* KPI Section with Glassmorphism */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {roleStats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.role}
                  className={`backdrop-blur-xl group hover:scale-[1.02] transition-all p-6 rounded-[2.5rem] border ${s.color}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`p-3 rounded-2xl ${s.color.replace(' border-', ' ')} border border-transparent group-hover:border-current transition-colors`}
                    >
                      <Icon size={20} className={s.textColor} />
                    </div>
                    <span className={`text-3xl font-black ${s.textColor}`}>{s.count}</span>
                  </div>
                  <h3 className="text-white font-black text-sm tracking-wide uppercase mb-1">
                    {s.label}
                  </h3>
                  <p className="text-slate-500 text-xs font-bold leading-tight">{s.description}</p>
                </div>
              );
            })}
          </div>

          {/* Business Rules Config Section (NEW) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-8"
          >
            <div className="xl:col-span-2 bg-slate-900/40 backdrop-blur-xl border border-slate-800/50 rounded-[2.5rem] p-8 space-y-6 shadow-2xl relative overflow-hidden group">
              {/* Glow effect */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full translate-x-1/2 -translate-y-1/2 pointer-events-none" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                    <Layout size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tight">
                      Interface Direction Générale (DG)
                    </h2>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                      Modules actifs sur la page Mission
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-full">
                  <div
                    className={`w-2 h-2 rounded-full ${isSavingConfig ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}
                  />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    {isSavingConfig ? 'Synchro...' : 'Serveur Synchronisé'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                {[
                  {
                    id: 'prep',
                    label: 'Stratégie',
                    desc: 'Planning & Cadrage',
                    icon: FileText,
                    color: 'text-sky-400',
                    bg: 'bg-sky-400/10',
                    border: 'border-sky-400/20',
                  },
                  {
                    id: 'report',
                    label: 'Exécution',
                    desc: 'Rapports Terrain',
                    icon: CheckIcon,
                    color: 'text-emerald-400',
                    bg: 'bg-emerald-400/10',
                    border: 'border-emerald-400/20',
                  },
                  {
                    id: 'approval',
                    label: 'Approbations',
                    desc: 'Validations Métier',
                    icon: ShieldIcon,
                    color: 'text-purple-400',
                    bg: 'bg-purple-400/10',
                    border: 'border-purple-400/20',
                  },
                ].map((panel) => {
                  const isActive = (orgConfig.mission_panels_dg || []).includes(panel.id);
                  return (
                    <button
                      key={panel.id}
                      onClick={() => toggleDGPanel(panel.id)}
                      className={`flex flex-col items-start p-6 rounded-3xl border transition-all duration-500 text-left relative group/panel ${
                        isActive
                          ? `${panel.bg} ${panel.border} shadow-xl shadow-slate-950`
                          : 'bg-slate-950/20 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div
                        className={`p-2.5 rounded-xl mb-4 transition-transform group-hover/panel:scale-110 ${isActive ? `${panel.bg} ${panel.color}` : 'bg-slate-800 text-slate-400'}`}
                      >
                        {(() => {
                          const Icon = panel.icon;
                          return <Icon size={20} />;
                        })()}
                      </div>
                      <span
                        className={`text-sm font-black uppercase tracking-tight mb-1 ${isActive ? 'text-white' : 'text-slate-500'}`}
                      >
                        {panel.label}
                      </span>
                      <p
                        className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-slate-400' : 'text-slate-600'}`}
                      >
                        {panel.desc}
                      </p>

                      {/* Activity dot */}
                      <div
                        className={`absolute top-6 right-6 w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)] ${isActive ? 'bg-white' : 'bg-slate-800'}`}
                      />

                      {/* Status label */}
                      <span
                        className={`mt-4 text-[9px] font-black uppercase tracking-[0.15em] ${isActive ? panel.color : 'text-slate-700'}`}
                      >
                        {isActive ? 'Activé' : 'Masqué'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl group hover:shadow-indigo-500/20 transition-all">
              {/* Background visual */}
              <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <SettingsIcon size={240} strokeWidth={1} />
              </div>

              <div className="relative z-10 space-y-6">
                <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <SettingsIcon size={24} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight">Guide Admin</h3>
                  <p className="text-indigo-100 text-sm font-medium leading-relaxed opacity-80">
                    Ici, vous pilotez ce que la Direction voit sur le terrain. Utile pour simplifier
                    leur vue et se concentrer sur l'essentiel.
                  </p>
                </div>

                <div className="pt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                    <div className="w-1 h-1 bg-white rounded-full" />
                    Effet Immédiat après reco
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-indigo-200">
                    <div className="w-1 h-1 bg-white rounded-full" />
                    Sauvegarde auto sur le Cloud
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* User List Section */}
          <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800/50">
                    <th className="px-8 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                      Statut
                    </th>
                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                      Utilisateur
                    </th>
                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                      Identifiant
                    </th>
                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                      Rôle
                    </th>
                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                      Accès
                    </th>
                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
                      Sécurité
                    </th>
                    <th className="px-8 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em] text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/30">
                  {filtered.map((u) => {
                    const normalized = normalizeRole(u.role);
                    const rc = (normalized && ROLE_CONFIG[normalized]) || {
                      label: u.role || 'Utilisateur',
                      color: 'bg-slate-500/10 border-slate-500/50',
                      textColor: 'text-slate-400',
                      icon: UserIcon,
                      description: 'Rôle système hérité',
                    };
                    const RoleIcon = rc.icon || UserIcon;
                    return (
                      <tr
                        key={u.id}
                        className={`group hover:bg-slate-800/20 transition-colors ${!u.active ? 'opacity-50' : ''}`}
                      >
                        <td className="px-8 py-5">
                          <button
                            onClick={() => toggleActive(u)}
                            title={u.active ? 'Désactiver le compte' : 'Activer le compte'}
                            className={`w-3 h-3 rounded-full transition-all duration-500 ${u.active ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}
                          />
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 flex items-center justify-center rounded-xl border ${rc.color}`}
                            >
                              <RoleIcon size={16} className={rc.textColor} />
                            </div>
                            <div>
                              <div className="text-white font-black text-sm">{u.name}</div>
                              <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">
                                {u.createdAt}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="font-mono text-slate-400 text-xs">@{u.email}</span>
                        </td>
                        <td className="px-6 py-5">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${rc.color} ${rc.textColor}`}
                          >
                            {rc.label}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-slate-300 font-bold text-xs">
                              {u.teamId
                                ? teams.find((t: any) => t.id === u.teamId)?.name
                                : 'Accès Global'}
                            </span>
                            <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                              {u.teamId ? 'Équipe de terrain' : 'Administration centrale'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => openReset(u)}
                              aria-label="Réinitialiser le mot de passe"
                              className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-lg hover:border-indigo-500/50 transition-all group/pass"
                            >
                              <Lock
                                size={12}
                                className="text-slate-500 group-hover/pass:text-indigo-400 transition-colors"
                              />
                              <span className="text-slate-600 dark:text-slate-400 font-mono text-xs">
                                ••••••
                              </span>
                            </button>
                            {u.requires2FA && (
                              <div
                                className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-600 rounded flex items-center justify-center"
                                title="2FA Activé"
                              >
                                <ShieldCheck
                                  size={10}
                                  className="text-indigo-900 dark:text-indigo-100"
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-5">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={async () => {
                                try {
                                  if (user && typeof auditService?.logAction === 'function') {
                                    await auditService.logAction(
                                      user,
                                      'Impersonation Demarree',
                                      'UTILISATEURS',
                                      `A demarre la simulation du compte "${u.name}" (${u.email}) - Role: ${u.role}`,
                                      'warning'
                                    );
                                  }
                                } catch (e) {
                                  console.warn('[AdminUsers] Audit impersonation failed:', e);
                                }
                                impersonate(u);
                                toast(`🎭 Simulation de "${u.name}" activée`, { icon: 'ℹ️' });
                              }}
                              title="Simuler cet accès (God Mode Simulation)"
                              className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white hover:bg-white hover:text-indigo-600 shadow-lg shadow-indigo-500/20 transition-all rounded-xl active:scale-90"
                            >
                              <span className="text-base" role="img" aria-label="Simuler">
                                👁️
                              </span>
                            </button>
                            <button
                              onClick={() => openEdit(u)}
                              aria-label="Modifier les détails"
                              className="w-9 h-9 flex items-center justify-center bg-slate-800 text-white hover:bg-slate-700 transition-all rounded-xl active:scale-90 border border-slate-700"
                            >
                              <span className="text-base" role="img" aria-label="Modifier">
                                ✏️
                              </span>
                            </button>
                            <button
                              onClick={() => openDelete(u)}
                              aria-label="Supprimer définitivement"
                              className="w-9 h-9 flex items-center justify-center bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/20 transition-all rounded-xl active:scale-90"
                            >
                              <span className="text-base" role="img" aria-label="Supprimer">
                                🗑️
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {loading ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-16 h-16 flex items-center justify-center mx-auto">
                  <RefreshCw size={32} className="text-indigo-400 animate-spin" />
                </div>
                <div>
                  <h3 className="text-white font-black">Chargement...</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    Récupération des utilisateurs en cours.
                  </p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-20 text-center space-y-4">
                <div className="w-16 h-16 bg-slate-800/50 border border-slate-700/50 rounded-3xl inline-flex items-center justify-center mb-2">
                  <Search size={24} className="text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h3 className="text-white font-black">Aucun utilisateur trouvé</h3>
                  <p className="text-slate-500 text-sm mt-1">
                    {search
                      ? `Votre recherche "${search}" n'a donné aucun résultat.`
                      : 'Commencez par créer votre premier compte utilisateur.'}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Create / Edit Form Drawer ── */}
        {showForm && (
          <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black text-white">
                  {editId ? '✏️ Modifier le compte' : '➕ Nouveau compte'}
                </h2>
                <button
                  onClick={() => setShowForm(false)}
                  aria-label="Fermer le formulaire"
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  saveUser();
                }}
                className="space-y-5"
              >
                {/* Nom complet */}
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))}
                    placeholder="ex: Chef Maçons"
                    title="Nom complet"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                {/* Email / Username */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Identifiant (Login) *
                    </label>
                    <input
                      type="text"
                      value={form.email}
                      onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))}
                      placeholder="ex: maçongem"
                      title="Identifiant de connexion"
                      autoComplete="username"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Email Notification *
                    </label>
                    <input
                      type="email"
                      autoComplete="email"
                      value={(form as any).notificationEmail}
                      onChange={(e) =>
                        setForm((f: any) => ({ ...f, notificationEmail: e.target.value }))
                      }
                      placeholder="user@wanekoo.com"
                      title="Email pour les notifications (Missions, etc.)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Mot de passe *
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm((f: any) => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 caractères"
                      title="Mot de passe"
                      autoComplete="new-password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <button
                      type="button"
                      aria-label="Afficher/masquer le mot de passe"
                      onClick={() => setShowPass((s) => !s)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                    >
                      {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Rôle *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(ROLE_CONFIG).map(([role, cfg]) => {
                      const isImmutable =
                        form.role === 'ADMIN_PROQUELEC' || isMasterAdminEmail(form.email);
                      return (
                        <button
                          key={role}
                          type="button"
                          disabled={isImmutable}
                          onClick={() =>
                            setForm((f: any) => ({
                              ...f,
                              role,
                              teamId: role !== 'CHEF_EQUIPE' ? undefined : f.teamId,
                            }))
                          }
                          className={`flex items-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all ${
                            form.role === role
                              ? `${cfg.color} ${cfg.textColor}`
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                          } ${isImmutable ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          {(() => { const Icon = cfg.icon; return <Icon size={14} /> })()} {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  {(form.role === 'ADMIN_PROQUELEC' || isMasterAdminEmail(form.email)) && (
                    <p className="mt-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <Lock size={10} /> Rôle Administrateur immuable
                    </p>
                  )}
                </div>

                {/* Team (Chef Équipe only) */}
                {form.role === 'CHEF_EQUIPE' && (
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Équipe assignée
                    </label>
                    <select
                      aria-label="Choisir l'équipe"
                      value={form.teamId ?? ''}
                      onChange={(e) =>
                        setForm((f: any) => ({ ...f, teamId: e.target.value || undefined }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                    >
                      <option value="">— Sélectionner une équipe —</option>
                      {teams.map((t: any) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* 📂 Projets assignés */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                    Projets assignés *
                  </label>
                  <div className="grid grid-cols-1 gap-2 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                    {projects.length === 0 ? (
                      <p className="text-slate-600 text-[10px] italic">Aucun projet disponible</p>
                    ) : (
                      projects.map((p) => {
                        const isAssigned = ((form as any).assignedProjectIds || []).includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                              isAssigned
                                ? 'bg-indigo-500/10 border-indigo-500/30'
                                : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={isAssigned}
                                onChange={() => {
                                  setForm((f: any) => {
                                    const current = f.assignedProjectIds || [];
                                    const next = current.includes(p.id)
                                      ? current.filter((id: string) => id !== p.id)
                                      : [...current, p.id];
                                    return { ...f, assignedProjectIds: next };
                                  });
                                }}
                              />
                              <div
                                className={`w-4 h-4 flex items-center justify-center rounded border transition-all ${
                                  isAssigned
                                    ? 'bg-indigo-500 border-indigo-500 text-white'
                                    : 'border-slate-600'
                                }`}
                              >
                                {isAssigned && <CheckCircle2 size={12} />}
                              </div>
                              <div className="flex flex-col">
                                <span className={`text-xs font-bold ${isAssigned ? 'text-indigo-400' : 'text-slate-400'}`}>
                                  {p.name}
                                </span>
                                <span className="text-[8px] text-slate-600 uppercase font-bold tracking-widest">
                                  {p.client || 'Sans Client'}
                                </span>
                              </div>
                            </div>
                            
                              {isAssigned && (
                                <span className="text-[8px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-black uppercase tracking-widest">
                                  Accès Activé
                                </span>
                              )}
                          </label>
                        );
                      })
                    )}
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500 italic">
                    L'utilisateur ne pourra voir que les projets sélectionnés ici.
                  </p>
                </div>

                {/* 2FA (Admin only) */}
                {form.role === 'ADMIN_PROQUELEC' && (
                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setForm((f: any) => ({ ...f, requires2FA: !f.requires2FA }))}
                      className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.requires2FA ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                      <div
                        className={`w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform ${form.requires2FA ? 'translate-x-4' : ''}`}
                      />
                    </div>
                    <span className="text-slate-300 font-medium text-sm">
                      Activer la double authentification (2FA)
                    </span>
                  </label>
                )}

                {/* 🔐 Permissions Editor */}
                <div className="col-span-1 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                  {(() => {
                    const permissionGroups = [
                      {
                        title: '🛡️ Administration & Sécurité',
                        keys: [
                          'SYSTEM_USERS',
                          'SYSTEM_ROLES',
                          'SYSTEM_CONFIG',
                          'SYSTEM_AUDIT',
                          'SYSTEM_SYNC',
                          'SYSTEM_EXPORT',
                          'SYSTEM_MESSAGES',
                        ],
                      },
                      {
                        title: '🚀 Missions (Ordres de Mission)',
                        keys: [
                          'MISSIONS_READ',
                          'MISSIONS_CREATE',
                          'MISSIONS_UPDATE',
                          'MISSIONS_VALIDATE',
                          'MISSIONS_APPROVE',
                          'MISSIONS_DELETE',
                          'MISSIONS_PLANNING',
                        ],
                      },
                      {
                        title: '👥 Équipes & Organisation',
                        keys: [
                          'UI_TEAMS',
                        ],
                      },
                      {
                        title: '💰 Finances & Budgets',
                        keys: [
                          'FINANCE_READ',
                          'FINANCE_MANAGE',
                          'FINANCE_PAYMENTS',
                          'FINANCE_EXPORT',
                          'FINANCE_REPORTS',
                        ],
                      },
                      {
                        title: '🗺️ Terrain & Cartographie',
                        keys: [
                          'UI_MAP',
                          'TERRAIN_READ',
                          'TERRAIN_WRITE',
                          'TERRAIN_TERMINAL',
                          'TERRAIN_REJECT',
                          'TERRAIN_ZONES',
                          'TERRAIN_MENAGES',
                        ],
                      },
                      {
                        title: '📁 Projets & Planning',
                        keys: [
                          'UI_PROJECTS',
                          'UI_DASHBOARD',
                        ],
                      },
                      {
                        title: '📦 Logistique & Kobo',
                        keys: [
                          'LOGISTIQUE_READ',
                          'LOGISTIQUE_MANAGE',
                        ],
                      },
                      {
                        title: '📊 Rapports & Documents',
                        keys: [
                          'DOCS_READ',
                          'DOCS_CONFIDENTIAL',
                          'DOCS_PV',
                        ],
                      },
                      { title: '🎓 Formations', keys: ['UI_TRAINING'] },
                      {
                        title: '💬 Communication',
                        keys: ['UI_CHAT', 'UI_ALERTS'],
                      },
                      {
                        title: '🤖 Intelligence Artificielle',
                        keys: ['IA_USE', 'IA_METRICS', 'IA_SIMULATION'],
                      },
                    ];
                    const totalPermissions = permissionGroups.reduce(
                      (acc, g) => acc + g.keys.length,
                      0
                    );

                    // Calcul dynamique du nombre de permissions réellement cochées
                    const currentRole =
                      normalizeRole(form.role) || (form.role as PermissionUserRole);
                    const checkedPermissionsCount = permissionGroups
                      .flatMap((g) => g.keys)
                      .filter((key) => {
                        const value = (PERMISSIONS as any)[key];
                        if (!value) return false;
                        if (form.role === 'ADMIN_PROQUELEC' || isMasterAdminEmail(form.email))
                          return true;
                        return form.permissions === null || form.permissions === undefined
                          ? (ROLE_PERMISSIONS[currentRole] || []).includes(value)
                          : form.permissions.includes(value);
                      }).length;

                    return (
                      <div className="space-y-6">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 bg-slate-900/40 rounded-3xl border border-slate-800/50 backdrop-blur-sm shadow-xl">
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                              <ShieldCheck size={24} className="text-emerald-500" />
                            </div>
                            <div>
                              <h4 className="text-xl font-black text-white tracking-tight">
                                Droits d'accès granulaires
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                  {permissionGroups.length} Modules
                                </span>
                                <span className="text-slate-600 font-bold">•</span>
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                  {checkedPermissionsCount} / {totalPermissions} Actives
                                </span>
                              </div>
                            </div>
                          </div>

                          {!(form.role === 'ADMIN_PROQUELEC' || isMasterAdminEmail(form.email)) && (
                            <div className="flex flex-wrap items-center gap-3">
                              {form.permissions === null || form.permissions === undefined ? (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                    Mode Automatique
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                                    Mode Personnalisé
                                  </span>
                                </div>
                              )}

                              <div className="h-8 w-px bg-slate-800 hidden sm:block mx-2" />

                              <button
                                type="button"
                                onClick={() => navigate('/admin/permissions')}
                                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                              >
                                Ouvrir matrice
                              </button>

                              <button
                                type="button"
                                onClick={async () => {
                                  if (!form.role) return toast.error('Rôle manquant');
                                  const currentRole =
                                    normalizeRole(form.role) || (form.role as UserRole);
                                  setForm((f: any) => ({
                                    ...f,
                                    permissions: [...(ROLE_PERMISSIONS[currentRole] || [])],
                                  }));
                                  toast.success('Permissions du rôle appliquées');
                                }}
                                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                              >
                                Appliquer au rôle
                              </button>

                              <button
                                type="button"
                                onClick={() => setForm((f: any) => ({ ...f, permissions: [] }))}
                                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                              >
                                Réinitialiser
                              </button>
                            </div>
                          )}
                        </div>

                        {form.role === 'ADMIN_PROQUELEC' || isMasterAdminEmail(form.email) ? (
                          <div className="p-6 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/30 flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/40">
                              <Award size={24} />
                            </div>
                            <div>
                              <p className="text-indigo-400 font-black uppercase tracking-widest text-xs">
                                Accès Universel Détecté
                              </p>
                              <p className="text-slate-400 text-xs mt-1 font-medium italic">
                                Ce compte est un Administrateur Système. <br />
                                Toutes les permissions sont déverrouillées par défaut au niveau du
                                noyau de sécurité Wanekoo.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar p-1">
                            {/* 🚀 QUICK PACKS FOR MANAGEMENT ROLES */}
                            {(normalizeRole(form.role) === 'PROQUELEC_DG' || 
                              normalizeRole(form.role) === 'PROQUELEC_CHEF_PROJET' ||
                              normalizeRole(form.role) === 'PROQUELEC_DIRECTION') && (
                              <div className="space-y-3 mb-6">
                                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] pl-1 border-l-2 border-indigo-500 leading-none">
                                  ⚡ Pilotage par Modules (Unifié)
                                </h5>
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                  {Object.entries(FEATURE_PACKS).map(([id, pack]) => {
                                    const currentRole =
                                      normalizeRole(form.role) || (form.role as PermissionUserRole);
                                    const isAuto =
                                      form.permissions === null || form.permissions === undefined;
                                    const current = isAuto
                                      ? ROLE_PERMISSIONS[currentRole] || []
                                      : form.permissions;
                                    const isActive = pack.permissions.every((p) =>
                                      current.includes(p)
                                    );

                                    return (
                                      <button
                                        key={id}
                                        type="button"
                                        onClick={() => toggleFeaturePack(id)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                                          isActive
                                            ? `${pack.bg} ${pack.border} shadow-lg`
                                            : 'bg-slate-950 border-slate-800 opacity-60 grayscale hover:grayscale-0'
                                        }`}
                                      >
                                        <div
                                          className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${isActive ? pack.color : 'text-slate-600'}`}
                                        >
                                          {(() => { const Icon = pack.icon; return <Icon size={18} /> })()}
                                        </div>
                                        <span
                                          className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-500'}`}
                                        >
                                          {pack.label}
                                        </span>
                                        <p className={`text-[8px] mt-1 text-center font-medium leading-tight px-1 ${isActive ? 'text-white/60' : 'text-slate-600'}`}>
                                          {pack.desc}
                                        </p>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-1 gap-6 bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                              {permissionGroups.map((group) => (
                                <div key={group.title} className="space-y-3">
                                  <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] pl-1 border-l-2 border-slate-700 leading-none">
                                    {group.title}
                                  </h5>
                                  <div className="grid grid-cols-1 gap-2">
                                    {group.keys.map((key) => {
                                      const value = (PERMISSIONS as any)[key];
                                      if (!value) return null;

                                      const currentRole =
                                        normalizeRole(form.role) ||
                                        (form.role as PermissionUserRole);
                                      const isAuto =
                                        form.permissions === null || form.permissions === undefined;
                                      const roleHasIt = (ROLE_PERMISSIONS[currentRole] || []).includes(
                                        value
                                      );
                                      const isChecked = isAuto ? roleHasIt : form.permissions.includes(value);

                                      const label = PERMISSION_LABELS[value] || value;
                                      return (
                                        <label
                                          key={key}
                                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                                            isChecked
                                              ? 'bg-emerald-500/10 border-emerald-500/30'
                                              : 'bg-slate-900/50 border-slate-800/50 hover:border-slate-700'
                                          }`}
                                        >
                                          <div className="flex items-center gap-3">
                                            <input
                                              type="checkbox"
                                              className="hidden"
                                              checked={isChecked}
                                              onChange={() => togglePermission(value)}
                                            />
                                            <div
                                              className={`w-4 h-4 flex items-center justify-center rounded border transition-all ${
                                                isChecked
                                                  ? 'bg-emerald-500 border-emerald-500 text-white'
                                                  : 'border-slate-600'
                                              }`}
                                            >
                                              {isChecked && <CheckCircle2 size={12} />}
                                            </div>
                                            <div className="flex flex-col">
                                              <span
                                                className={`text-xs font-bold ${isChecked ? 'text-emerald-400' : isAuto ? 'text-slate-500 italic' : 'text-slate-400'}`}
                                              >
                                                {label}
                                              </span>
                                              <span className="text-[8px] text-slate-600 uppercase font-bold tracking-widest">
                                                {key}
                                              </span>
                                            </div>
                                          </div>

                                          {/* ORIGIN INDICATOR */}
                                          <div className="flex items-center gap-2">
                                            {roleHasIt && (
                                              <span
                                                title="Inclus par défaut dans le rôle"
                                                className={`text-[8px] px-2 py-0.5 rounded-full border font-black uppercase tracking-widest ${
                                                  isChecked && isAuto
                                                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
                                                    : 'bg-slate-800 border-slate-700 text-slate-600'
                                                }`}
                                              >
                                                Rôle
                                              </span>
                                            )}
                                            {!isAuto && isChecked && !roleHasIt && (
                                              <span
                                                title="Ajouté manuellement pour cet utilisateur"
                                                className="text-[8px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black uppercase tracking-widest"
                                              >
                                                Forcé
                                              </span>
                                            )}
                                          </div>
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <p className="mt-3 text-[10px] text-slate-500 flex items-start gap-2 italic">
                    <AlertTriangle size={12} className="mt-0.5 text-amber-500" />
                    <span>
                      Note : L'admin peut forcer ou retirer n'importe quel accès individuellement.
                    </span>
                  </p>
                </div>

                {/* Active toggle */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setForm((f: any) => ({ ...f, active: !f.active }))}
                    className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                  >
                    <div
                      className={`w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform ${form.active ? 'translate-x-4' : ''}`}
                    />
                  </div>
                  <span className="text-slate-300 font-medium text-sm">Compte actif</span>
                </label>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-2xl font-bold hover:bg-slate-700 transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
                  >
                    <Save size={16} />{' '}
                    {editId ? 'Enregistrer les modifications' : 'Créer le compte'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </ContentArea>
    </PageContainer>
  );
}
