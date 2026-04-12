import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../store/db';
import type { UserRole, User } from '../utils/types';
import {
    Users, Plus, Trash2, ShieldCheck, Shield, User as UserIcon,
    Eye, EyeOff, Save, X, Search, Lock, CheckCircle2,
    AlertTriangle, RefreshCw, Briefcase, Calculator, Award
} from 'lucide-react';
import { appSecurity } from '../services/appSecurity';
import { useAuth } from '../contexts/AuthContext';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { PERMISSION_LABELS, PERMISSIONS, ROLE_PERMISSIONS } from '../utils/permissions';
import { userService } from '../services/userService';
import { organizationService } from '../services/organizationService';
import { auditService } from '../services/auditService';
import { Settings as SettingsIcon, Layout, FileText, CheckCircle2 as CheckIcon, Shield as ShieldIcon } from 'lucide-react';

// Les constantes statiques de sécurité sont gérées par appSecurity

// ─── Config rôles ───────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, {
    label: string; color: string; textColor: string;
    icon: typeof Shield; description: string
}> = {
    ADMIN_PROQUELEC: { label: 'Administrateur', color: 'bg-indigo-500/10 border-indigo-500/50', textColor: 'text-indigo-400', icon: ShieldCheck, description: 'Accès complet & 2FA' },
    ADMIN: { label: 'Admin Système', color: 'bg-slate-500/10 border-slate-500/50', textColor: 'text-slate-400', icon: ShieldCheck, description: 'Super Administration' },
    'DIRECTION GÉNÉRALE': { label: 'Direction Générale', color: 'bg-emerald-500/10 border-emerald-500/50', textColor: 'text-emerald-400', icon: Shield, description: 'Finances & Stratégie' },
    DG_PROQUELEC: { label: 'DG Proquelec', color: 'bg-emerald-500/10 border-emerald-500/50', textColor: 'text-emerald-400', icon: Shield, description: 'Direction GEM' },
    CLIENT_LSE: { label: 'Client LSE', color: 'bg-amber-500/10 border-amber-500/50', textColor: 'text-amber-400', icon: UserIcon, description: 'Interventions & Suivi' },
    'CHEF DE CHANTIER': { label: 'Chef de Chantier', color: 'bg-blue-500/10 border-blue-500/50', textColor: 'text-blue-400', icon: Users, description: 'Équipes & Terrain' },
    CHEF_EQUIPE: { label: 'Chef d\'Équipe', color: 'bg-blue-500/10 border-blue-500/50', textColor: 'text-blue-400', icon: Users, description: 'Exécution Opérationnelle' },
    'CHEF DE PROJET': { label: 'Chef de Projet', color: 'bg-sky-500/10 border-sky-500/50', textColor: 'text-sky-400', icon: Briefcase, description: 'Gestion de Mission' },
    CHEF_PROJET: { label: 'CP Vision', color: 'bg-sky-500/10 border-sky-500/50', textColor: 'text-sky-400', icon: Briefcase, description: 'Suivi Projets' },
    COMPTABLE: { label: 'Comptable', color: 'bg-rose-500/10 border-rose-500/50', textColor: 'text-rose-400', icon: Calculator, description: 'Finances & Audit' },
    DIRECTEUR: { label: 'Directeur', color: 'bg-purple-500/10 border-purple-500/50', textColor: 'text-purple-400', icon: Award, description: 'Validation Finale' },
};

const emptyForm = (): Omit<User, 'id' | 'createdAt'> => ({
    email: '', notificationEmail: '', password: '', role: 'CHEF_EQUIPE', name: '', teamId: undefined, active: true, requires2FA: false,
    permissions: [],
});

// ─── Toast ───────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; msg: string; type: ToastType }

let _toastId = 0;

// ─── Composant principal ─────────────────────────────────────────────────────
export default function AdminUsers() {
    const { user, impersonate } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    // const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [showPass, setShowPass] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // ── Delete modal state ──
    const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
    const [delPass, setDelPass] = useState('');
    const [delAnswer, setDelAnswer] = useState('');
    const [delStep, setDelStep] = useState<1 | 2>(1);
    const [delError, setDelError] = useState('');
    const [showDelPass, setShowDelPass] = useState(false);
    const [activeSecurityQuestion, setActiveSecurityQuestion] = useState('');
    
    // ── Organization Config State ──
    const [orgConfig, setOrgConfig] = useState<any>({ mission_panels_dg: ['prep', 'report', 'approval'] });
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Load data from API
    const loadData = async () => {
        try {
            const [u, t] = await Promise.all([
                userService.getUsers(),
                db.teams.toArray() // Keep teams in Dexie for now or fetch if needed
            ]);
            setUsers(u);
            setTeams(t);
        } catch (err) {
            addToast('Erreur lors du chargement des données', 'error');
        } finally {
        }
    };

    useEffect(() => {
        loadData();
        loadOrgConfig();
        appSecurity.get('securityQuestion').then(setActiveSecurityQuestion);
    }, []);

    const loadOrgConfig = async () => {
        try {
            const data = await organizationService.getConfig();
            if (data?.config) setOrgConfig(data.config);
        } catch (err) {
            console.error('Failed to load org config');
        }
    };

    const updateOrgConfig = async (newConfig: any) => {
        setIsSavingConfig(true);
        try {
            await organizationService.updateConfig(newConfig);
            setOrgConfig(newConfig);
            addToast('Configuration de l\'organisation mise à jour', 'success');
        } catch (err) {
            addToast('Échec de la mise à jour de la config', 'error');
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

    // ─── Toast helpers ────────────────────────────────────────────────────────
    const addToast = (msg: string, type: ToastType = 'success') => {
        const id = ++_toastId;
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // ─── Filtering ────────────────────────────────────────────────────────────
    const filtered = users.filter((u: User) =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    // ─── Open form (create / edit) ────────────────────────────────────────────
    const openAdd = () => {
        setEditId(null); setForm(emptyForm()); setShowForm(true); setShowPass(false);
    };
    const openEdit = (u: User) => {
        if (u.role === 'ADMIN_PROQUELEC' && user?.id !== u.id) {
            addToast('Impossible de modifier un autre Administrateur Système', 'error');
            return;
        }
        setEditId(u.id);
        setForm({ 
            email: u.email, 
            notificationEmail: (u as any).notificationEmail || '',
            password: '', // Do not show current pass
            role: u.role, 
            name: u.name || '', 
            teamId: u.teamId, 
            active: u.active ?? true, 
            requires2FA: !!u.requires2FA,
            permissions: u.permissions || []
        });
        setShowForm(true); setShowPass(false);
    };

    const togglePermission = (p: string) => {
        setForm((f: any) => {
            // Obtenir l'état actuel : si undefined (auto), on commence par les droits du rôle
            const current = f.permissions !== undefined ? f.permissions : (ROLE_PERMISSIONS[f.role] || []);
            if (current.includes(p)) {
                return { ...f, permissions: current.filter((x: string) => x !== p) };
            } else {
                return { ...f, permissions: [...current, p] };
            }
        });
    };

    const applyDefaultPermissions = () => {
        // En mettant permissions à undefined, le système repasse automatiquement 
        // sur le fallback du RÔLE (comportement par défaut)
        setForm((f: any) => ({ ...f, permissions: undefined }));
        addToast(`✅ Compte synchronisé sur les droits par défaut du rôle ${form.role}`, 'info');
    };

    // ─── Save (create / update) ───────────────────────────────────────────────
    const saveUser = async () => {
        if (!form.email.trim() || (!editId && !form.password?.trim()) || !form.name.trim()) {
            addToast('Tous les champs obligatoires doivent être remplis.', 'error'); return;
        }
        if (!editId && (form.password?.length ?? 0) < 6) {
            addToast('Le mot de passe doit faire au moins 6 caractères.', 'error'); return;
        }
        try {
            if (editId) {
                // Find existing user to log changes
                const oldUser = users.find(u => u.id === editId);
                await userService.updateUser(editId, form);
                
                if (user) {
                    auditService.logAction(
                        user, 
                        'Modification Utilisateur', 
                        'UTILISATEURS', 
                        `A modifié le compte de "${form.name}" (${form.email}). Rôle: ${oldUser?.role} -> ${form.role}`,
                        'info'
                    );
                }
                addToast(`✏️  Compte "${form.name}" mis à jour sur le serveur.`, 'success');
            } else {
                await userService.createUser(form);
                if (user) {
                    auditService.logAction(
                        user, 
                        'Création Utilisateur', 
                        'UTILISATEURS', 
                        `A créé le compte de "${form.name}" avec le rôle ${form.role}`,
                        'info'
                    );
                }
                addToast(`✅  Compte "${form.name}" créé sur le serveur.`, 'success');
            }
            setShowForm(false);
            loadData(); // Refresh list
        } catch (err: any) {
            addToast(`❌  Erreur: ${err.message}`, 'error');
        }
    };

    // ─── Open delete modal ────────────────────────────────────────────────────
    const openDelete = (u: User) => {
        if (u.id === '1' || u.role === 'ADMIN_PROQUELEC') { 
            addToast('Impossible de supprimer un compte Administrateur.', 'error'); 
            return; 
        }
        setDeleteTarget(u);
        setDelPass(''); setDelAnswer(''); setDelError('');
        setDelStep(1);
        setShowDelPass(false);
    };

    // ─── Confirm delete: step 1 (password) ────────────────────────────────────
    const confirmDelStep1 = async () => {
        if (!deleteTarget) return;
        // Non-admin: direct delete
        if (deleteTarget.role !== 'ADMIN_PROQUELEC') {
            executeDelete();
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
            addToast(`🗑️  Compte "${name}" supprimé du serveur.`, 'warning');
            setDeleteTarget(null);
            loadData();
        } catch (err: any) {
            addToast(`❌  Erreur: ${err.message}`, 'error');
        }
    };

    // ─── Toggle active ────────────────────────────────────────────────────────
    const toggleActive = async (u: User) => {
        if (u.id === '1') { addToast('Impossible de désactiver le compte Admin principal.', 'error'); return; }
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
            addToast(
                next ? `▶️  Compte "${u.name}" activé.` : `⏸️  Compte "${u.name}" désactivé.`,
                next ? 'success' : 'info'
            );
            loadData();
        } catch (err: any) {
            addToast(`❌  Erreur: ${err.message}`, 'error');
        }
    };

    // ─── Quick password reset ────────────────────────────────────────────────
    const openReset = (u: User) => {
        setResetTarget(u); setNewPassword(''); setShowNewPass(false);
    };
    const saveReset = async () => {
        if (!resetTarget) return;
        if (newPassword.length < 6) { addToast('Le mot de passe doit faire au moins 6 caractères.', 'error'); return; }
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
            addToast(`🔑  Mot de passe de "${resetTarget.name}" réinitialisé.`, 'success');
            setResetTarget(null);
            loadData();
        } catch (err: any) {
            addToast(`❌  Erreur: ${err.message}`, 'error');
        }
    };

    // ─── Role stats ──────────────────────────────────────────────────────────
    const roleStats = Object.entries(ROLE_CONFIG).map(([role, cfg]) => ({
        ...cfg, role, count: users.filter((u: User) => u.role === role).length,
    }));

    const isAdminDelete = deleteTarget?.role === 'ADMIN_PROQUELEC';

    return (
        <PageContainer className="min-h-screen bg-slate-950 py-8">

            {/* ── Toast Stack ── */}
            <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-bold text-sm pointer-events-auto animate-in slide-in-from-right-4 duration-300 ${t.type === 'success' ? 'bg-emerald-600 text-white' :
                        t.type === 'error' ? 'bg-red-600 text-white' :
                            t.type === 'warning' ? 'bg-amber-500 text-white' :
                                'bg-indigo-600 text-white'
                        }`}>
                        {t.type === 'success' ? <CheckCircle2 size={16} /> :
                            t.type === 'error' ? <AlertTriangle size={16} /> :
                                t.type === 'warning' ? <AlertTriangle size={16} /> :
                                    <CheckCircle2 size={16} />}
                        {t.msg}
                    </div>
                ))}
            </div>

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
                                <p className="text-rose-900/60 dark:text-rose-100 text-xs uppercase font-black pt-1">Action Irréversible</p>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); if (isAdminDelete) { if (delStep === 1) confirmDelStep1(); else confirmDelStep2(); } else executeDelete(); }} className="space-y-6">
                                {isAdminDelete && (
                                    <div className="space-y-4">
                                        {delStep === 1 ? (
                                            <div className="space-y-3">
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">Confirmation Administrateur</label>
                                                <div className="relative">
                                                    <input
                                                        type={showDelPass ? 'text' : 'password'}
                                                        value={delPass}
                                                        onChange={e => { setDelPass(e.target.value); setDelError(''); }}
                                                        placeholder="Saisissez votre mot de passe"
                                                        title="Mot de passe administrateur"
                                                        autoComplete="current-password"
                                                        autoFocus
                                                        className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 text-white font-mono text-sm placeholder:text-slate-700 dark:text-slate-300 outline-none transition-all ${delError ? 'border-rose-500 ring-4 ring-rose-200 dark:ring-rose-600' : 'border-slate-800 focus:border-rose-500/50 focus:ring-4 focus:ring-rose-100 dark:focus:ring-rose-900/50'}`}
                                                    />
                                                    <button type="button" aria-label="Afficher/masquer" onClick={() => setShowDelPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                                        {showDelPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="p-5 rounded-2xl bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-600">
                                                    <p className="text-indigo-900 dark:text-indigo-100 text-xs font-black uppercase tracking-widest mb-1.5">Question de sécurité</p>
                                                    <p className="text-white font-bold leading-relaxed">{activeSecurityQuestion}</p>
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block ml-1">Votre Réponse</label>
                                                    <input
                                                        type="text"
                                                        value={delAnswer}
                                                        onChange={e => { setDelAnswer(e.target.value); setDelError(''); }}
                                                        placeholder="Répondre ici..."
                                                        aria-label="Réponse à la question de sécurité"
                                                        autoComplete="off"
                                                        autoFocus
                                                        className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 text-white font-bold text-sm outline-none transition-all ${delError ? 'border-rose-500 ring-4 ring-rose-200 dark:ring-rose-600' : 'border-slate-800 focus:border-rose-500/50'}`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {delError && <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-rose-900 dark:text-rose-100 text-xs font-bold text-center">{delError}</motion.p>}
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
                                        {isAdminDelete ? (delStep === 1 ? 'Vérifier →' : 'Confirmer la suppression') : 'Oui, Supprimer'}
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{resetTarget.name}</p>
                                </div>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); saveReset(); }} className="space-y-6">
                                <div className="relative">
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"><Lock size={16} /></div>
                                    <input
                                        type={showNewPass ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Nouveau mot de passe"
                                        aria-label="Nouveau mot de passe (min. 6 car.)"
                                        autoComplete="new-password"
                                        autoFocus
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-12 py-3.5 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                    />
                                    <button type="button" aria-label="Afficher/masquer" onClick={() => setShowNewPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setResetTarget(null)} className="flex-1 py-3.5 bg-slate-800/50 text-slate-400 rounded-xl font-bold hover:bg-slate-800 transition-all">Annuler</button>
                                    <button type="submit" className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95">
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
                            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">Utilisateurs</h1>
                        </div>
                        <p className="text-slate-500 font-bold text-sm md:ml-13">
                            {users.length} comptes enregistrés — <span className="text-emerald-500">{users.filter((u: User) => u.active).length} actifs</span>
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
                                onChange={e => setSearch(e.target.value)}
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
                    {roleStats.map(s => {
                        const Icon = s.icon;
                        return (
                            <div key={s.role} className={`backdrop-blur-xl group hover:scale-[1.02] transition-all p-6 rounded-[2.5rem] border ${s.color}`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-3 rounded-2xl ${s.color.replace(' border-', ' ')} border border-transparent group-hover:border-current transition-colors`}>
                                        <Icon size={20} className={s.textColor} />
                                    </div>
                                    <span className={`text-3xl font-black ${s.textColor}`}>{s.count}</span>
                                </div>
                                <h3 className="text-white font-black text-sm tracking-wide uppercase mb-1">{s.label}</h3>
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
                                    <h2 className="text-xl font-black text-white uppercase tracking-tight">Interface Direction Générale (DG)</h2>
                                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Modules actifs sur la page Mission</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-full">
                                <div className={`w-2 h-2 rounded-full ${isSavingConfig ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                    {isSavingConfig ? 'Synchro...' : 'Serveur Synchronisé'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                            {[
                                { id: 'prep', label: 'Stratégie', desc: 'Planning & Cadrage', icon: FileText, color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/20' },
                                { id: 'report', label: 'Exécution', desc: 'Rapports Terrain', icon: CheckIcon, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
                                { id: 'approval', label: 'Approbations', desc: 'Validations Métier', icon: ShieldIcon, color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' }
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
                                        <div className={`p-2.5 rounded-xl mb-4 transition-transform group-hover/panel:scale-110 ${isActive ? `${panel.bg} ${panel.color}` : 'bg-slate-800 text-slate-400'}`}>
                                            <panel.icon size={20} />
                                        </div>
                                        <span className={`text-sm font-black uppercase tracking-tight mb-1 ${isActive ? 'text-white' : 'text-slate-500'}`}>
                                            {panel.label}
                                        </span>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-slate-400' : 'text-slate-600'}`}>
                                            {panel.desc}
                                        </p>
                                        
                                        {/* Activity dot */}
                                        <div className={`absolute top-6 right-6 w-1.5 h-1.5 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)] ${isActive ? 'bg-white' : 'bg-slate-800'}`} />
                                        
                                        {/* Status label */}
                                        <span className={`mt-4 text-[9px] font-black uppercase tracking-[0.15em] ${isActive ? panel.color : 'text-slate-700'}`}>
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
                                    Ici, vous pilotez ce que la Direction voit sur le terrain. Utile pour simplifier leur vue et se concentrer sur l'essentiel.
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
                                    <th className="px-8 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Statut</th>
                                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Utilisateur</th>
                                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Identifiant</th>
                                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Rôle</th>
                                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Accès</th>
                                    <th className="px-6 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Sécurité</th>
                                    <th className="px-8 py-6 text-xs font-black text-slate-500 uppercase tracking-[0.2em] text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/30">
                                {filtered.map(u => {
                                    const rc = ROLE_CONFIG[u.role as UserRole] || ROLE_CONFIG.CHEF_EQUIPE;
                                    const RoleIcon = rc.icon;
                                    return (
                                        <tr key={u.id} className={`group hover:bg-slate-800/20 transition-colors ${!u.active ? 'opacity-50' : ''}`}>
                                            <td className="px-8 py-5">
                                                <button
                                                    onClick={() => toggleActive(u)}
                                                    title={u.active ? 'Désactiver le compte' : 'Activer le compte'}
                                                    className={`w-3 h-3 rounded-full transition-all duration-500 ${u.active ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]' : 'bg-slate-700'}`}
                                                />
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-9 h-9 flex items-center justify-center rounded-xl border ${rc.color}`}>
                                                        <RoleIcon size={16} className={rc.textColor} />
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-black text-sm">{u.name}</div>
                                                        <div className="text-slate-500 text-xs font-bold uppercase tracking-wider">{u.createdAt}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="font-mono text-slate-400 text-xs">@{u.email}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${rc.color} ${rc.textColor}`}>
                                                    {rc.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-300 font-bold text-xs">
                                                        {u.teamId ? teams.find((t: any) => t.id === u.teamId)?.name : 'Accès Global'}
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
                                                        <Lock size={12} className="text-slate-500 group-hover/pass:text-indigo-400 transition-colors" />
                                                        <span className="text-slate-600 dark:text-slate-400 font-mono text-xs">••••••</span>
                                                    </button>
                                                    {u.requires2FA && (
                                                        <div className="w-5 h-5 bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-600 rounded flex items-center justify-center" title="2FA Activé">
                                                            <ShieldCheck size={10} className="text-indigo-900 dark:text-indigo-100" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-5">
                                                <div className="flex justify-end gap-1">
                                                    <button
                                                        onClick={() => {
                                                            impersonate(u);
                                                            addToast(`🎭 Simulation de "${u.name}" activée`, 'info');
                                                        }}
                                                        title="Simuler cet accès (God Mode Simulation)"
                                                        className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white hover:bg-white hover:text-indigo-600 shadow-lg shadow-indigo-500/20 transition-all rounded-xl active:scale-90"
                                                    >
                                                        <span className="text-base" role="img" aria-label="Simuler">👁️</span>
                                                    </button>
                                                    <button
                                                        onClick={() => openEdit(u)}
                                                        aria-label="Modifier les détails"
                                                        className="w-9 h-9 flex items-center justify-center bg-slate-800 text-white hover:bg-slate-700 transition-all rounded-xl active:scale-90 border border-slate-700"
                                                    >
                                                        <span className="text-base" role="img" aria-label="Modifier">✏️</span>
                                                    </button>
                                                    <button
                                                        onClick={() => openDelete(u)}
                                                        aria-label="Supprimer définitivement"
                                                        className="w-9 h-9 flex items-center justify-center bg-rose-600/10 text-rose-500 hover:bg-rose-600 hover:text-white border border-rose-500/20 transition-all rounded-xl active:scale-90"
                                                    >
                                                        <span className="text-base" role="img" aria-label="Supprimer">🗑️</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    {filtered.length === 0 && (
                        <div className="p-20 text-center space-y-4">
                            <div className="w-16 h-16 bg-slate-800/50 border border-slate-700/50 rounded-3xl inline-flex items-center justify-center mb-2">
                                <Search size={24} className="text-slate-600 dark:text-slate-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-black">Aucun utilisateur trouvé</h3>
                                <p className="text-slate-500 text-sm mt-1">
                                    {search ? `Votre recherche "${search}" n'a donné aucun résultat.` : 'Commencez par créer votre premier compte utilisateur.'}
                                </p>
                            </div>
                        </div>
                    )}
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
                            <button onClick={() => setShowForm(false)} aria-label="Fermer le formulaire" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); saveUser(); }} className="space-y-5">
                            {/* Nom complet */}
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Nom complet *</label>
                                <input type="text" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                                    placeholder="ex: Chef Maçons" title="Nom complet"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            {/* Email / Username */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Identifiant (Login) *</label>
                                    <input type="text" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))}
                                        placeholder="ex: maçongem" title="Identifiant de connexion"
                                        autoComplete="username"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Email Notification *</label>
                                    <input type="email" value={(form as any).notificationEmail} onChange={e => setForm((f: any) => ({ ...f, notificationEmail: e.target.value }))}
                                        placeholder="user@wanekoo.com" title="Email pour les notifications (Missions, etc.)"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                </div>
                            </div>

                            {/* Password */}
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Mot de passe *</label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={form.password}
                                        onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))}
                                        placeholder="Min. 6 caractères" title="Mot de passe"
                                        autoComplete="new-password"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    <button type="button" aria-label="Afficher/masquer le mot de passe" onClick={() => setShowPass(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Rôle *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => {
                                        const isImmutable = (form.role === 'ADMIN_PROQUELEC' || form.email === 'admingem');
                                        return (
                                            <button key={role} type="button"
                                                disabled={isImmutable}
                                                onClick={() => setForm((f: any) => ({ ...f, role, teamId: role !== 'CHEF_EQUIPE' ? undefined : f.teamId }))}
                                                className={`flex items-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all ${
                                                    form.role === role 
                                                    ? `${cfg.color} ${cfg.textColor}` 
                                                    : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-700'
                                                } ${isImmutable ? 'cursor-not-allowed opacity-80' : ''}`}
                                            >
                                                <cfg.icon size={14} /> {cfg.label}
                                            </button>
                                        );
                                    })}
                                </div>
                                {(form.role === 'ADMIN_PROQUELEC' || form.email === 'admingem') && (
                                    <p className="mt-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                                        <Lock size={10} /> Rôle Administrateur immuable
                                    </p>
                                )}
                            </div>

                            {/* Team (Chef Équipe only) */}
                            {form.role === 'CHEF_EQUIPE' && (
                                <div>
                                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">Équipe assignée</label>
                                    <select aria-label="Choisir l'équipe" value={form.teamId ?? ''} onChange={e => setForm((f: any) => ({ ...f, teamId: e.target.value || undefined }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none">
                                        <option value="">— Sélectionner une équipe —</option>
                                        {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* 2FA (Admin only) */}
                            {form.role === 'ADMIN_PROQUELEC' && (
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div onClick={() => setForm((f: any) => ({ ...f, requires2FA: !f.requires2FA }))}
                                        className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.requires2FA ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                        <div className={`w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform ${form.requires2FA ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-slate-300 font-medium text-sm">Activer la double authentification (2FA)</span>
                                </label>
                            )}

                            {/* 🔐 Permissions Editor */}
                            <div className="col-span-1 mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <ShieldCheck size={20} className="text-emerald-500" />
                                            <h4 className="text-lg font-bold text-slate-800 dark:text-white">Droits d'accès granulaires</h4>
                                        </div>
                                        {!(form.role === 'ADMIN_PROQUELEC' || form.email === 'admingem') && (
                                            <div className="flex items-center gap-2">
                                                {form.permissions === undefined ? (
                                                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded">
                                                        Mode Automatique (Rôle)
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-2 py-1 rounded">
                                                        Mode Personnalisé
                                                    </span>
                                                )}
                                                <button 
                                                    type="button"
                                                    onClick={applyDefaultPermissions}
                                                    title="Repasser en mode automatique (basé sur le rôle)"
                                                    className="text-xs font-semibold text-indigo-500 hover:text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 transition-all font-black uppercase tracking-widest"
                                                >
                                                    Réinitialiser
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                
                                {(form.role === 'ADMIN_PROQUELEC' || form.email === 'admingem') ? (
                                    <div className="p-6 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/30 flex flex-col items-center text-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/40">
                                            <Award size={24} />
                                        </div>
                                        <div>
                                            <p className="text-indigo-400 font-black uppercase tracking-widest text-xs">Accès Universel Détecté</p>
                                            <p className="text-slate-400 text-xs mt-1 font-medium italic">
                                                Ce compte est un Administrateur Système. <br/>
                                                Toutes les permissions sont déverrouillées par défaut au niveau du noyau de sécurité Wanekoo.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar bg-slate-950/50 p-2 rounded-2xl border border-slate-800">
                                            {Object.entries(PERMISSIONS).map(([key, value]) => {
                                                const isChecked = form.permissions !== undefined 
                                                    ? form.permissions.includes(value)
                                                    : (ROLE_PERMISSIONS[form.role] || []).includes(value);
                                                
                                                const label = PERMISSION_LABELS[value] || value;
                                                return (
                                                    <label 
                                                        key={key} 
                                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                                            isChecked 
                                                            ? 'bg-emerald-500/10 border-emerald-500/30' 
                                                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                                        }`}
                                                    >
                                                        <input 
                                                            type="checkbox" 
                                                            className="hidden" 
                                                            checked={isChecked}
                                                            onChange={() => togglePermission(value)}
                                                        />
                                                        <div className={`w-5 h-5 flex items-center justify-center rounded-md border transition-all ${
                                                            isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-400 dark:border-slate-600'
                                                        }`}>
                                                            {isChecked && <CheckCircle2 size={14} />}
                                                        </div>
                                                        <span className={`text-sm font-medium ${isChecked ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                            {label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        <p className="mt-3 text-[10px] text-slate-500 flex items-start gap-2 italic">
                                            <AlertTriangle size={12} className="mt-0.5 text-amber-500" />
                                            <span>Note : L'admin peut forcer ou retirer n'importe quel accès individuellement.</span>
                                        </p>
                                    </>
                                )}
                            </div>

                            {/* Active toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div onClick={() => setForm((f: any) => ({ ...f, active: !f.active }))}
                                    className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.active ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                                    <div className={`w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform ${form.active ? 'translate-x-4' : ''}`} />
                                </div>
                                <span className="text-slate-300 font-medium text-sm">Compte actif</span>
                            </label>

                            <div className="flex gap-3 mt-8">
                                <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-2xl font-bold hover:bg-slate-700 transition-all">Annuler</button>
                                <button type="submit" className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 active:scale-95">
                                    <Save size={16} /> {editId ? 'Enregistrer les modifications' : 'Créer le compte'}
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
