/* eslint-disable @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, no-empty */
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../../../store/db';
import type { UserRole, User } from '../../../utils/types';
import type { Team, Project } from '../../../utils/types';
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
  RefreshCcw as RefreshCw,
  Briefcase,
  Calculator,
  Award,
  Settings as SettingsIcon,
  Layout,
  FileText,
} from 'lucide-react';
import { appSecurity } from '../../../services/appSecurity';
import { useAuth } from '../../../contexts/AuthContext';
import { useProject } from '../../../contexts/ProjectContext';
import { PageContainer, PageHeader, ContentArea, Modal } from '../../../components';
// Import des icônes pour le tableau
import { 
  MoreVertical, 
  Trash2 as TrashIcon, 
  UserPlus, 
  Key, 
  Activity, 
  ShieldAlert,
  ArrowUpDown,
  Mail,
  Calendar as DateIcon,
  Zap,
  Globe,
  Settings as ConfigIcon
} from 'lucide-react';
import {
  PERMISSION_LABELS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  normalizeRole,
  invalidatePermissionsCache,
} from '../../../core/security/permissions';
import { AppRole } from '../../../core/security/types';
import type { UserRole as PermissionUserRole } from '../../../core/security/types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { userService } from '../../../services/userService';
import { organizationService } from '../../../services/organizationService';
import { auditService } from '../../../services/auditService';
import projectService from '../../../services/projectService';
import adminPermissionsService from '../../../services/adminPermissionsService';
import logger from '../../../utils/logger';
import { isMasterAdminEmail } from '../../../core/security/roleUtils';

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

  // PROQUELEC/GEM - MAÎTRE D'ŒUVRE
  [AppRole.ADMIN]: {
    label: 'Administrateur Proquelec',
    color: 'bg-indigo-500/10 border-indigo-500/50',
    textColor: 'text-indigo-400',
    icon: ShieldCheck,
    description: 'Accès complet & 2FA',
  },
  [AppRole.DIRECTEUR]: {
    label: 'DG Proquelec',
    color: 'bg-emerald-500/10 border-emerald-500/50',
    textColor: 'text-emerald-400',
    icon: ShieldIcon,
    description: 'Direction GEM',
  },
  [AppRole.CHEF_PROJET]: {
    label: 'Chef de Projet',
    color: 'bg-sky-500/10 border-sky-500/50',
    textColor: 'text-sky-400',
    icon: Briefcase,
    description: 'Gestion de Mission',
  },
  [AppRole.COMPTABLE]: {
    label: 'Comptable',
    color: 'bg-rose-500/10 border-rose-500/50',
    textColor: 'text-rose-400',
    icon: Calculator,
    description: 'Finances & Audit',
  },
  [AppRole.PATRIMOINE]: {
    label: 'Gestion Patrimoine',
    color: 'bg-purple-500/10 border-purple-500/50',
    textColor: 'text-purple-400',
    icon: Award,
    description: 'Actifs & Maintenance',
  },
  [AppRole.EMPLOYE]: {
    label: 'Employé Proquelec',
    color: 'bg-blue-500/10 border-blue-500/50',
    textColor: 'text-blue-400',
    icon: UserIcon,
    description: 'Opérations & Reporting',
  },
  [AppRole.SUPERVISEUR]: {
    label: 'Superviseur / Consultant',
    color: 'bg-amber-500/10 border-amber-500/50',
    textColor: 'text-amber-400',
    icon: UserIcon,
    description: 'Supervision & Validation',
  },
  [AppRole.CONTROLEUR]: {
    label: 'Contrôleur / Audit',
    color: 'bg-amber-500/10 border-amber-500/50',
    textColor: 'text-amber-400',
    icon: UserIcon,
    description: 'Validation Technique',
  },
};

// ─── Unification des Modules Métier ──────────────────────────────────────────
const FEATURE_PACKS: Record<
  string,
  {
    label: string;
    icon: React.ElementType;
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
      PERMISSIONS.MISSIONS_READ,
      PERMISSIONS.MISSIONS_CREATE,
      PERMISSIONS.MISSIONS_UPDATE,
      PERMISSIONS.MISSIONS_PLANNING,
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
      PERMISSIONS.TERRAIN_READ,
      PERMISSIONS.FINANCE_READ,
      PERMISSIONS.FINANCE_PAYMENTS,
      PERMISSIONS.LOGISTIQUE_READ,
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
      PERMISSIONS.MISSIONS_VALIDATE,
      PERMISSIONS.MISSIONS_APPROVE,
      PERMISSIONS.DOCS_PV,
      PERMISSIONS.DOCS_CONFIDENTIAL,
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
      PERMISSIONS.UI_PROJECTS,
      PERMISSIONS.UI_TEAMS,
      PERMISSIONS.SYSTEM_AUDIT,
      PERMISSIONS.SYSTEM_SYNC,
      PERMISSIONS.UI_ALERTS,
    ],
  },
};

type UserForm = Omit<User, 'id' | 'createdAt'> & {
  assignedProjectIds: string[];
};

const emptyForm = (): UserForm => ({
  email: '',
  notificationEmail: '',
  password: '',
  role: AppRole.EMPLOYE as UserRole,
  name: '',
  teamId: undefined,
  active: true,
  requires2FA: false,
  permissions: [],
  assignedProjectIds: [], // New field for UI management
});

// ─── Composant interne : Table d'affichage ──────────────────────────────────
interface AdminUsersTableProps {
  users: User[];
  search: string;
  loading: boolean;
  onEdit: (u: User) => void;
  onDelete: (u: User) => void;
  onImpersonate: (u: User) => void;
  ROLE_CONFIG: any;
  normalizeRole: (r?: string) => string | null;
  AppRole: any;
  isMasterAdminEmail: (e: string) => boolean;
}

const AdminUsersTable = ({
  users,
  search,
  loading,
  onEdit,
  onDelete,
  onImpersonate,
  ROLE_CONFIG,
  normalizeRole,
  AppRole,
  isMasterAdminEmail,
}: AdminUsersTableProps) => {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold animate-pulse uppercase tracking-widest text-[10px]">
          Synchronisation sécurisée...
        </p>
      </div>
    );
  }

  const safeUsers = users ?? [];
  const filtered = safeUsers.filter((u) => {
    const s = search.toLowerCase();
    return (
      u.email.toLowerCase().includes(s) ||
      (u.name || '').toLowerCase().includes(s) ||
      (u.role || '').toLowerCase().includes(s)
    );
  });

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-600">
        <Users size={32} className="opacity-30" />
        <p className="text-[10px] font-black uppercase tracking-widest">Aucun utilisateur trouvé</p>
      </div>
    );
  }



  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full text-left border-separate border-spacing-y-3">
        <thead>
          <tr className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
            <th className="px-6 pb-2">Identité & Statut</th>
            <th className="px-6 pb-2">Rôle Système</th>
            <th className="px-6 pb-2">Sécurité</th>
            <th className="px-6 pb-2">Dernière activité</th>
            <th className="px-6 pb-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((u) => {
            const nRole = normalizeRole(u.role);
            const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG[nRole || ''] || {
              label: u.role,
              color: 'bg-slate-500/10 border-slate-500/30',
              textColor: 'text-slate-400',
              icon: UserIcon,
            };
            const Icon = cfg.icon;
            const isProtected = nRole === AppRole.ADMIN || isMasterAdminEmail(u.email);

            return (
              <motion.tr
                key={u.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group bg-slate-900/40 hover:bg-slate-800/60 border border-slate-800/50 transition-all"
              >
                <td className="px-6 py-4 rounded-l-2xl border-y border-l border-slate-800/50">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl ${cfg.color} flex items-center justify-center flex-shrink-0 border ${cfg.textColor.replace('text-', 'border-')}/20 shadow-lg shadow-black/20`}>
                      <Icon size={18} className={cfg.textColor} />
                    </div>
                    <div>
                      <div className="font-black text-white text-sm tracking-tight flex items-center gap-2">
                        {u.name || 'Sans Nom'}
                        {u.active ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-500 opacity-50" />
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1.5 mt-0.5">
                        <Mail size={10} className="opacity-40" />
                        {u.email}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-6 py-4 border-y border-slate-800/50">
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm ${cfg.color} ${cfg.textColor}`}>
                    {cfg.label}
                  </span>
                </td>

                <td className="px-6 py-4 border-y border-slate-800/50">
                  <div className="flex items-center gap-2">
                    {u.requires2FA ? (
                      <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" title="2FA Activé">
                        <ShieldCheck size={14} />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-lg bg-slate-800/50 text-slate-600 border border-slate-800" title="Pas de 2FA">
                        <ShieldIcon size={14} />
                      </div>
                    )}
                    {isProtected && (
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20" title="Compte Protégé">
                        <ShieldAlert size={14} />
                      </div>
                    )}
                  </div>
                </td>

                <td className="px-6 py-4 border-y border-slate-800/50">
                   <div className="text-[10px] font-bold text-slate-400 flex flex-col gap-0.5">
                     <span className="flex items-center gap-1.5">
                       <DateIcon size={10} className="opacity-40" />
                       Créé le {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                     </span>
                     {u.id === 'admingem' && (
                       <span className="text-[8px] text-indigo-500 uppercase font-black">Identité Maître</span>
                     )}
                   </div>
                </td>

                <td className="px-6 py-4 rounded-r-2xl border-y border-r border-slate-800/50 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onImpersonate(u)}
                      className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-90"
                      title="Prendre l'identité"
                    >
                      <Zap size={14} />
                    </button>
                    <button
                      onClick={() => onEdit(u)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all active:scale-90"
                      title="Modifier"
                    >
                      <Eye size={14} />
                    </button>
                    {!isProtected && (
                      <button
                        onClick={() => onDelete(u)}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20 transition-all active:scale-90"
                        title="Supprimer"
                      >
                        <TrashIcon size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Composant principal ─────────────────────────────────────────────────────
export default function AdminUsers() {
  const navigate = useNavigate();
  const [applyingRoleDefaults, setApplyingRoleDefaults] = useState(false);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [pendingApplyPerms, setPendingApplyPerms] = useState<string[] | null>(null);
  const [pendingApplyRole, setPendingApplyRole] = useState<string | null>(null);
  const { user, impersonate } = useAuth();
  const { setActiveProjectId } = useProject();
  const [users, setUsers] = useState<User[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Delete modal state ──
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [delPass, setDelPass] = useState('');
  const [delAnswer, setDelAnswer] = useState('');
  const [delStep, setDelStep] = useState<1 | 2>(1);
  const [delError, setDelError] = useState('');
  const [showDelPass, setShowDelPass] = useState(false);
  const [deleteConfirmedName, setDeleteConfirmedName] = useState('');
  const [activeSecurityQuestion, setActiveSecurityQuestion] = useState('');

  // ── Impersonate modal state ──
  const [impersonateTarget, setImpersonateTarget] = useState<User | null>(null);
  const [impersonateProjects, setImpersonateProjects] = useState<Project[]>([]);

  // ── Organization Config State ──
  const [orgConfig, setOrgConfig] = useState<Record<string, unknown>>({
    mission_panels_dg: ['prep', 'report', 'approval'],
  });
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const hasFetched = useRef(false);

  // ─── Stable loadData (useCallback prevents stale closure in useEffect) ────
  const loadData = useCallback(async () => {
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
        toast.error('Échec du chargement des utilisateurs');
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
        toast.error('Échec du chargement des projets');
        logger.error('[AdminUsers] Load projects failed', results[2].reason);
      }
    } catch (err) {
      toast.error('Erreur critique lors du chargement des données');
      logger.error('[AdminUsers] Critical load failure', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    loadData();
    loadOrgConfig();
    appSecurity.get('securityQuestion').then(setActiveSecurityQuestion);
  }, [loadData]);

  const loadOrgConfig = async () => {
    try {
      const data = await organizationService.getConfig();
      if (data?.config) setOrgConfig(data.config);
    } catch (err) {
      logger.warn('[AdminUsers] Failed to load org config', err);
    }
  };

  const updateOrgConfig = async (newConfig: Record<string, unknown>) => {
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
    const current = (orgConfig.mission_panels_dg as string[]) || [];
    const next = current.includes(panelId)
      ? current.filter((id: string) => id !== panelId)
      : [...current, panelId];
    updateOrgConfig({ ...orgConfig, mission_panels_dg: next });
  };

  // ── Password reset modal ──
  const [resetTarget, setResetTarget] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  // ─── Filtering (memoized to avoid recompute on every render) ─────────────
  const filtered = useMemo(
    () =>
      users.filter(
        (u: User) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
          u.role.toLowerCase().includes(search.toLowerCase())
      ),
    [users, search]
  );

  // ─── Open form (create / edit) ────────────────────────────────────────────
  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
    setShowPass(false);
  };
  const openEdit = (u: User) => {
    const isProtected = normalizeRole(u.role) === AppRole.ADMIN || isMasterAdminEmail(u.email);
    if (isProtected && user?.id !== u.id) {
      toast.error('Impossible de modifier un autre Administrateur Système');
      return;
    }
    // 🔒 PREVENT SELF-MODIFICATION OF ADMIN
    if (user?.id === u.id && isProtected) {
      toast.error('Admin: Impossible de modifier votre propre compte. Contactez le Master Admin.');
      return;
    }
    setEditId(u.id);

    // Compute which projects this user is assigned to
    const userProjects = projects
      .filter((p) => {
        const assigned = (p.config as any)?.assignedUsers || [];
        return assigned.includes(u.id);
      })
      .map((p) => p.id);

    setForm({
      email: u.email,
      notificationEmail: u.notificationEmail || '',
      password: '', // Do not show current pass
      role: u.role,
      name: u.name || '',
      teamId: u.teamId,
      active: u.active ?? true,
      requires2FA: !!u.requires2FA,
      permissions: u.permissions ?? undefined,
      assignedProjectIds: userProjects,
    });
    setShowForm(true);
    setShowPass(false);
  };

  const togglePermission = (p: string) => {
    setForm((f: UserForm) => {
      const currentRole = normalizeRole(f.role) || (f.role as PermissionUserRole);

      // Si on est en mode Auto (null ou undefined), on part de la base du rôle
      const isAuto = f.permissions === null || f.permissions === undefined;
      const current: string[] = isAuto
        ? (ROLE_PERMISSIONS[currentRole as keyof typeof ROLE_PERMISSIONS] ?? [])
        : (f.permissions ?? []);

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

    setForm((f: UserForm) => {
      const currentRole = normalizeRole(f.role) || (f.role as PermissionUserRole);
      const isAuto = f.permissions === null || f.permissions === undefined;
      const current: string[] = isAuto
        ? (ROLE_PERMISSIONS[currentRole as keyof typeof ROLE_PERMISSIONS] ?? [])
        : (f.permissions ?? []);

      // Si toutes les perms du pack sont déjà là, on les retire toutes
      // Sinon, on s'assure qu'elles y sont toutes
      const hasAll = pack.permissions.every((p) => current.includes(p));
      let next: string[];
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
    setForm((f: UserForm) => ({ ...f, permissions: undefined })); // undefined tells the server to reset to role defaults
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
    if (editId && form.password?.trim() && form.password.trim().length < 6) {
      toast.error('Le nouveau mot de passe doit faire au moins 6 caractères.');
      return;
    }
    setSaving(true);
    try {
      let finalUserId = editId;
      if (editId) {
        // Find existing user to log changes
        const oldUser = users.find((u) => u.id === editId);
        await userService.updateUser(editId, finalForm);

        if (user) {
          await auditService.logAction(
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
          await auditService.logAction(
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
        const assignedIds = form.assignedProjectIds || [];
        try {
          await projectService.setUserAssignments(finalUserId, assignedIds);
        } catch (assignError) {
          const errMessage =
            assignError instanceof Error ? assignError.message : String(assignError);
          logger.warn('[AdminUsers] Project assignment failed', errMessage);
          toast.error("Certaines assignations de projets n'ont pas pu être finalisées");
        }
      }

      setShowForm(false);
      loadData(); // Refresh list
    } catch (err) {
      const errMessage =
        (err as any)?.response?.data?.error || (err instanceof Error ? err.message : String(err));
      toast.error(`❌  Erreur: ${errMessage}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Open delete modal ────────────────────────────────────────────────────
  const openDelete = (u: User) => {
    if (isMasterAdminEmail(u.email) || normalizeRole(u.role) === AppRole.ADMIN) {
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
    const isAdminTarget =
      normalizeRole(deleteTarget.role) === AppRole.ADMIN || isMasterAdminEmail(deleteTarget.email);
    if (!isAdminTarget) {
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
    await executeDelete();
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    const toastId = toast.loading('Sécurisation de la suppression...');
    try {
      // 1. Demander un jeton de confirmation au serveur
      const token = await userService.requestDeletion(deleteTarget.id);
      
      // 2. Exécuter la suppression avec le jeton
      await userService.deleteUser(deleteTarget.id, token);

      if (user) {
        await auditService.logAction(
          user,
          'Suppression Utilisateur',
          'UTILISATEURS',
          `A SUPPRIMÉ le compte de "${name}" (${deleteTarget.email})`,
          'warning'
        );
      }
      toast.success(`🗑️  Compte "${name}" supprimé définitivement.`, { id: toastId });
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      const errMessage =
        (err as any)?.response?.data?.error || (err instanceof Error ? err.message : String(err));
      toast.error(`❌  Erreur: ${errMessage}`, { id: toastId });
    }
  };

  // ─── Toggle active ────────────────────────────────────────────────────────
  const toggleActive = async (u: User) => {
    if (isMasterAdminEmail(u.email)) {
      toast.error('Impossible de désactiver le compte Admin principal.');
      return;
    }
    if (normalizeRole(u.role) === AppRole.ADMIN) {
      toast.error('Impossible de désactiver un compte Administrateur.');
      return;
    }
    const next = !u.active;
    try {
      await userService.updateUser(u.id, { active: next });
      if (user) {
        await auditService.logAction(
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
    } catch (err) {
      const errMessage =
        (err as any)?.response?.data?.error || (err instanceof Error ? err.message : String(err));
      toast.error(`❌  Erreur: ${errMessage}`);
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
        await auditService.logAction(
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
    } catch (err) {
      const errMessage =
        (err as any)?.response?.data?.error || (err instanceof Error ? err.message : String(err));
      toast.error(`❌  Erreur: ${errMessage}`);
    }
  };

  // ─── Role stats (memoized – recomputes only when users list changes) ────────
  //
  // PROBLÈME : ROLE_CONFIG utilise des clés préfixées (ex: "PROQUELEC_ADMIN"),
  // mais l'API retourne des rôles bruts (ex: "ADMIN", "DG", "CHEF_PROJET").
  // La correction consiste à tester le match APRÈS avoir retiré le préfixe.
  const roleStats = useMemo(() => {
    // Retire le préfixe organisationnel pour obtenir la valeur brute comparable
    const stripOrgPrefix = (key: string) =>
      key
        .replace(/^PROQUELEC_/, '')
        .replace(/^SENELEC_/, '')
        .replace(/^SOUS_TRAITANT_/, '')
        .replace(/^CLIENT_LSE_/, '');

    return Object.entries(ROLE_CONFIG).map(([roleKey, cfg]) => {
      const strippedKey = stripOrgPrefix(roleKey);

      return {
        ...cfg,
        role: roleKey,
        count: users.filter((u: User) => {
          const raw = (u.role || '').toUpperCase();

          // 1. Match exact (cas où le rôle DB = clé ROLE_CONFIG ex: 'PROQUELEC_ADMIN')
          if (raw === roleKey.toUpperCase()) return true;

          // 2. Match après suppression du préfixe org
          //    ex: raw='ADMIN', strippedKey='ADMIN' ← cas principal
          if (raw === strippedKey) return true;

          // 3. Match normalisé (gère les variantes: DG_PROQUELEC→DG, etc.)
          const nUser = normalizeRole(u.role);
          const nStripped = normalizeRole(strippedKey) || strippedKey;
          if (nUser && nUser === nStripped) return true;

          return false;
        }).length,
      };
    });
  }, [users]);

  const isAdminDelete =
    normalizeRole(deleteTarget?.role) === AppRole.ADMIN || isMasterAdminEmail(deleteTarget?.email ?? '');

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-8">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-4000 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4"
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
                } catch (err) {
                  logger.error(
                    'Apply role defaults failed',
                    err instanceof Error ? err.message : String(err)
                  );
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

      <PageHeader backLink={{ to: '/admin/hub', label: 'Retour au Centre de Contrôle' }}
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
              <p className="text-slate-500 font-bold text-sm md:ml-12">
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
                  const isActive = ((orgConfig.mission_panels_dg as string[]) || []).includes(
                    panel.id
                  );
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
          <AdminUsersTable
            users={users}
            search={search}
            loading={loading}
            ROLE_CONFIG={ROLE_CONFIG}
            normalizeRole={normalizeRole}
            AppRole={AppRole}
            isMasterAdminEmail={isMasterAdminEmail}
            onEdit={openEdit}
            onDelete={openDelete}
            onImpersonate={(u) => {
              const uProjects = projects.filter((p) => {
                const assigned = (p.config as any)?.assignedUsers || [];
                return assigned.includes(u.id);
              });
              setImpersonateProjects(uProjects);
              setImpersonateTarget(u);
            }}
          />
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
                    onChange={(e) => setForm((f: UserForm) => ({ ...f, name: e.target.value }))}
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
                      onChange={(e) => setForm((f: UserForm) => ({ ...f, email: e.target.value }))}
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
                      value={form.notificationEmail}
                      onChange={(e) =>
                        setForm((f: UserForm) => ({ ...f, notificationEmail: e.target.value }))
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
                    Mot de passe {editId ? <span className="text-slate-600 normal-case font-normal">(laisser vide pour ne pas changer)</span> : '*'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) =>
                        setForm((f: UserForm) => ({ ...f, password: e.target.value }))
                      }
                      placeholder={editId ? 'Nouveau mot de passe (optionnel)' : 'Min. 6 caractères'}
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
                        normalizeRole(form.role) === AppRole.ADMIN || isMasterAdminEmail(form.email);
                      return (
                        <button
                          key={role}
                          type="button"
                          disabled={isImmutable}
                          onClick={() =>
                            setForm((f: UserForm) => ({
                              ...f,
                              role: role as UserRole,
                              teamId: role !== AppRole.SUPERVISEUR ? undefined : f.teamId,
                            }))
                          }
                          className={`flex items-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all ${
                            form.role === role
                              ? `${cfg.color} ${cfg.textColor}`
                              : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                          } ${isImmutable ? 'cursor-not-allowed opacity-80' : ''}`}
                        >
                          {(() => {
                            const Icon = cfg.icon;
                            return <Icon size={14} />;
                          })()}{' '}
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                  {(normalizeRole(form.role) === AppRole.ADMIN || isMasterAdminEmail(form.email)) && (
                    <p className="mt-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                      <Lock size={10} /> Rôle Administrateur immuable
                    </p>
                  )}
                </div>

                {/* Team (Chef Équipe only) */}
                {form.role === AppRole.SUPERVISEUR && (
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Équipe assignée
                    </label>
                    <select
                      aria-label="Choisir l'équipe"
                      value={form.teamId ?? ''}
                      onChange={(e) =>
                        setForm((f: UserForm) => ({ ...f, teamId: e.target.value || undefined }))
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                    >
                      <option value="">— Sélectionner une équipe —</option>
                      {teams.map((t: Team) => (
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
                        const isAssigned = (form.assignedProjectIds || []).includes(p.id);
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
                                  setForm((f: UserForm) => {
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
                                {isAssigned && <CheckIcon size={12} />}
                              </div>
                              <div className="flex flex-col">
                                <span
                                  className={`text-xs font-bold ${isAssigned ? 'text-indigo-400' : 'text-slate-400'}`}
                                >
                                  {p.name}
                                </span>
                                <span className="text-[8px] text-slate-600 uppercase font-bold tracking-widest">
                                  {(p as any).client || 'Sans Client'}
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

                {/* 2FA - visible for ALL roles */}
                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-2xl border border-slate-800/50 bg-slate-950/50 hover:border-indigo-500/30 transition-all">
                  <div
                    onClick={() =>
                      setForm((f: UserForm) => ({ ...f, requires2FA: !f.requires2FA }))
                    }
                    className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.requires2FA ? 'bg-indigo-600' : 'bg-slate-700'}`}
                  >
                    <div
                      className={`w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform ${form.requires2FA ? 'translate-x-4' : ''}`}
                    />
                  </div>
                  <div>
                    <span className="text-slate-200 font-bold text-sm block">Double authentification (2FA)</span>
                    <span className="text-slate-500 text-xs">Demander un code de sécurité à chaque connexion</span>
                  </div>
                </label>

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
                        keys: ['UI_TEAMS'],
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
                        keys: ['UI_PROJECTS', 'UI_DASHBOARD'],
                      },
                      {
                        title: '📦 Logistique & Kobo',
                        keys: ['LOGISTIQUE_READ', 'LOGISTIQUE_MANAGE'],
                      },
                      {
                        title: '📊 Rapports & Documents',
                        keys: ['DOCS_READ', 'DOCS_CONFIDENTIAL', 'DOCS_PV'],
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
                        const value = PERMISSIONS[key as keyof typeof PERMISSIONS];
                        if (!value) return false;
                        if (normalizeRole(form.role) === AppRole.ADMIN || isMasterAdminEmail(form.email))
                          return true;
                        return form.permissions === null || form.permissions === undefined
                          ? (ROLE_PERMISSIONS[currentRole] || []).includes(value)
                          : form.permissions.includes(value);
                      }).length;

                    return (
                      <div className="space-y-6">
                        <div className="flex flex-col gap-4 p-6 bg-slate-900/40 rounded-3xl border border-slate-800/50 backdrop-blur-sm shadow-xl">
                          {/* Row 1: Icon + Title + Counters */}
                          <div className="flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
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

                          {/* Row 2: Mode Badge + Action Buttons */}
                          {!(normalizeRole(form.role) === AppRole.ADMIN || isMasterAdminEmail(form.email)) && (
                            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/50">
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

                              <div className="flex flex-wrap items-center gap-2 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => navigate('/admin/permissions')}
                                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                                >
                                  Ouvrir matrice
                                </button>

                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (!form.role) return toast.error('Rôle manquant');
                                    const currentRole =
                                      normalizeRole(form.role) || (form.role as UserRole);
                                    setForm((f: UserForm) => ({
                                      ...f,
                                      permissions: [
                                        ...(ROLE_PERMISSIONS[
                                          currentRole as keyof typeof ROLE_PERMISSIONS
                                        ] || []),
                                      ],
                                    }));
                                    toast.success('Permissions du rôle appliquées');
                                  }}
                                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                                >
                                  Appliquer au rôle
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((f: UserForm) => ({ ...f, permissions: [] }))
                                  }
                                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95"
                                >
                                  Réinitialiser
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {normalizeRole(form.role) === AppRole.ADMIN || isMasterAdminEmail(form.email) ? (
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
                            {(normalizeRole(form.role) === AppRole.DIRECTEUR ||
                              normalizeRole(form.role) === AppRole.CHEF_PROJET) && (
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
                                    const current: string[] = isAuto
                                      ? (ROLE_PERMISSIONS[
                                          currentRole as keyof typeof ROLE_PERMISSIONS
                                        ] ?? [])
                                      : (form.permissions ?? []);
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
                                          {(() => {
                                            const Icon = pack.icon;
                                            return <Icon size={18} />;
                                          })()}
                                        </div>
                                        <span
                                          className={`text-[10px] font-black uppercase tracking-tight ${isActive ? 'text-white' : 'text-slate-500'}`}
                                        >
                                          {pack.label}
                                        </span>
                                        <p
                                          className={`text-[8px] mt-1 text-center font-medium leading-tight px-1 ${isActive ? 'text-white/60' : 'text-slate-600'}`}
                                        >
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
                                      const value = PERMISSIONS[key as keyof typeof PERMISSIONS];
                                      if (!value) return null;

                                      const currentRole =
                                        normalizeRole(form.role) ||
                                        (form.role as PermissionUserRole);
                                      const isAuto =
                                        form.permissions === null || form.permissions === undefined;
                                      const roleHasIt = (
                                        ROLE_PERMISSIONS[
                                          currentRole as keyof typeof ROLE_PERMISSIONS
                                        ] || []
                                      ).includes(value);
                                      const isChecked = isAuto
                                        ? roleHasIt
                                        : (form.permissions ?? []).includes(value);

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
                                              {isChecked && <CheckIcon size={12} />}
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
                    onClick={() => setForm((f: UserForm) => ({ ...f, active: !f.active }))}
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
                    disabled={saving}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95"
                  >
                    {saving ? (
                      <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <Save size={16} />
                    )}
                    {saving
                      ? 'Enregistrement…'
                      : editId
                        ? 'Enregistrer les modifications'
                        : 'Créer le compte'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Impersonate Gateway Modal ── */}
        {impersonateTarget && (
          <Modal title="Passerelle God Mode" onClose={() => setImpersonateTarget(null)}>
            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-100 text-sm font-medium">
                Vous êtes sur le point de prendre le contrôle de <strong>{impersonateTarget.name || impersonateTarget.email}</strong>.
                Ce compte a accès à <strong>{impersonateProjects.length}</strong> projet(s).
                Veuillez sélectionner le contexte de projet dans lequel vous souhaitez atterrir.
              </div>

              <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                {impersonateProjects.map(proj => (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setActiveProjectId(proj.id);
                      impersonate(impersonateTarget);
                    }}
                    className="w-full text-left p-4 rounded-xl border border-white/10 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-bold text-white group-hover:text-indigo-400">{proj.name}</h4>
                      <p className="text-xs text-slate-400 mt-1">Cliquez pour simuler sur ce projet</p>
                    </div>
                    <Briefcase size={20} className="text-slate-600 group-hover:text-indigo-500" />
                  </button>
                ))}
                {impersonateProjects.length === 0 && (
                  <div className="text-center p-6 border border-dashed border-white/10 rounded-xl text-slate-500 text-sm">
                    Cet utilisateur n'est assigné à aucun projet spécifique.
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setImpersonateTarget(null)}
                  className="px-6 py-2.5 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                >
                  Annuler
                </button>
                <button
                  onClick={() => impersonate(impersonateTarget)}
                  className="px-6 py-2.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25"
                >
                  Continuer par défaut
                </button>
              </div>
            </div>
          </Modal>
        )}
      </ContentArea>
    </PageContainer>
  );
}
