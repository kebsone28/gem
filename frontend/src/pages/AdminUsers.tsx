import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../store/db';
import type { UserRole, User as ManagedUser } from '../utils/types';
import {
    Users, Plus, Edit3, Trash2, ShieldCheck, Shield, User,
    Eye, EyeOff, Save, X, Search, Lock, CheckCircle2,
    AlertTriangle, RefreshCw
} from 'lucide-react';
import { appSecurity } from '../services/appSecurity';

// Les constantes statiques de sécurité sont gérées par appSecurity

// ─── Config rôles ───────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<UserRole, {
    label: string; color: string; textColor: string;
    icon: typeof Shield; description: string
}> = {
    ADMIN_PROQUELEC: { label: 'Administrateur', color: 'bg-indigo-500/10 border-indigo-500/20 shadow-indigo-500/5', textColor: 'text-indigo-400', icon: ShieldCheck, description: 'Accès complet & 2FA' },
    DG_PROQUELEC: { label: 'Direction Générale', color: 'bg-emerald-500/10 border-emerald-500/20 shadow-emerald-500/5', textColor: 'text-emerald-400', icon: Shield, description: 'Finances & Stratégie' },
    CLIENT_LSE: { label: 'Client LSE', color: 'bg-amber-500/10 border-amber-500/20 shadow-amber-500/5', textColor: 'text-amber-400', icon: User, description: 'Interventions & Suivi' },
    CHEF_EQUIPE: { label: 'Chef de Chantier', color: 'bg-blue-500/10 border-blue-500/20 shadow-blue-500/5', textColor: 'text-blue-400', icon: Users, description: 'Équipes & Terrain' },
};

const emptyForm = (): Omit<ManagedUser, 'id' | 'createdAt'> => ({
    email: '', password: '', role: 'CHEF_EQUIPE', name: '', teamId: undefined, active: true, requires2FA: false,
});

// ─── Toast ───────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast { id: number; msg: string; type: ToastType }

let _toastId = 0;

// ─── Composant principal ─────────────────────────────────────────────────────
export default function AdminUsers() {
    const users = useLiveQuery(() => db.users.toArray()) || [];
    const teams = useLiveQuery(() => db.teams.toArray()) || [];

    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [showPass, setShowPass] = useState(false);
    const [toasts, setToasts] = useState<Toast[]>([]);

    // ── Delete modal state ──
    const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
    const [delPass, setDelPass] = useState('');
    const [delAnswer, setDelAnswer] = useState('');
    const [delStep, setDelStep] = useState<1 | 2>(1);
    const [delError, setDelError] = useState('');
    const [showDelPass, setShowDelPass] = useState(false);
    const [activeSecurityQuestion, setActiveSecurityQuestion] = useState('');

    // Load question on mount or change
    useEffect(() => {
        appSecurity.get('securityQuestion').then(setActiveSecurityQuestion);
    }, []);

    // ── Password reset modal ──
    const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
    const [newPassword, setNewPassword] = useState('');
    const [showNewPass, setShowNewPass] = useState(false);

    // ─── Toast helpers ────────────────────────────────────────────────────────
    const addToast = (msg: string, type: ToastType = 'success') => {
        const id = ++_toastId;
        setToasts(prev => [...prev, { id, msg, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    // ─── Filtering ────────────────────────────────────────────────────────────
    const filtered = users.filter((u: ManagedUser) =>
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    // ─── Open form (create / edit) ────────────────────────────────────────────
    const openAdd = () => {
        setEditId(null); setForm(emptyForm()); setShowForm(true); setShowPass(false);
    };
    const openEdit = (u: ManagedUser) => {
        setEditId(u.id);
        setForm({ email: u.email, password: u.password, role: u.role, name: u.name, teamId: u.teamId, active: u.active, requires2FA: u.requires2FA });
        setShowForm(true); setShowPass(false);
    };

    // ─── Save (create / update) ───────────────────────────────────────────────
    const saveUser = async () => {
        if (!form.email.trim() || !form.password?.trim() || !form.name.trim()) {
            addToast('Tous les champs obligatoires doivent être remplis.', 'error'); return;
        }
        if ((form.password?.length ?? 0) < 6) {
            addToast('Le mot de passe doit faire au moins 6 caractères.', 'error'); return;
        }
        try {
            if (editId) {
                await db.users.update(editId, form);
                addToast(`✏️  Compte "${form.name}" mis à jour avec succès.`, 'success');
            } else {
                const newUser: ManagedUser = {
                    ...form,
                    id: Date.now().toString(),
                    createdAt: new Date().toISOString().split('T')[0],
                };
                await db.users.add(newUser);
                addToast(`✅  Compte "${form.name}" créé avec succès.`, 'success');
            }
            setShowForm(false);
        } catch {
            addToast('❌  Erreur lors de l\'enregistrement.', 'error');
        }
    };

    // ─── Open delete modal ────────────────────────────────────────────────────
    const openDelete = (u: ManagedUser) => {
        if (u.id === '1') { addToast('Impossible de supprimer le compte Admin principal.', 'error'); return; }
        setDeleteTarget(u);
        setDelPass(''); setDelAnswer(''); setDelError('');
        setDelStep(u.role === 'ADMIN_PROQUELEC' ? 1 : 1);
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
        await db.users.delete(deleteTarget.id);
        addToast(`🗑️  Compte "${name}" supprimé définitivement.`, 'warning');
        setDeleteTarget(null);
    };

    // ─── Toggle active ────────────────────────────────────────────────────────
    const toggleActive = async (u: ManagedUser) => {
        if (u.id === '1') { addToast('Impossible de désactiver le compte Admin principal.', 'error'); return; }
        const next = !u.active;
        await db.users.update(u.id, { active: next });
        addToast(
            next ? `▶️  Compte "${u.name}" activé.` : `⏸️  Compte "${u.name}" désactivé.`,
            next ? 'success' : 'info'
        );
    };

    // ─── Quick password reset ────────────────────────────────────────────────
    const openReset = (u: ManagedUser) => {
        setResetTarget(u); setNewPassword(''); setShowNewPass(false);
    };
    const saveReset = async () => {
        if (!resetTarget) return;
        if (newPassword.length < 6) { addToast('Le mot de passe doit faire au moins 6 caractères.', 'error'); return; }
        await db.users.update(resetTarget.id, { password: newPassword });
        addToast(`🔑  Mot de passe de "${resetTarget.name}" réinitialisé.`, 'success');
        setResetTarget(null);
    };

    // ─── Role stats ──────────────────────────────────────────────────────────
    const roleStats = Object.entries(ROLE_CONFIG).map(([role, cfg]) => ({
        ...cfg, role, count: users.filter((u: ManagedUser) => u.role === role).length,
    }));

    const isAdminDelete = deleteTarget?.role === 'ADMIN_PROQUELEC';

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">

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
                            <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500/20">
                                <motion.div
                                    className="h-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.6)]"
                                    initial={{ width: 0 }}
                                    animate={{ width: '100%' }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>

                            <div className="flex items-center gap-5 mb-8">
                                <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/10">
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

                            <div className="p-5 rounded-[2rem] bg-rose-500/5 border border-rose-500/10 mb-8 space-y-2">
                                <p className="text-rose-200/80 text-sm font-medium">
                                    Vous êtes sur le point de supprimer :
                                </p>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white font-black text-xs">
                                        {deleteTarget.name.charAt(0)}
                                    </div>
                                    <span className="text-white font-black">{deleteTarget.name}</span>
                                </div>
                                <p className="text-rose-400/60 text-[10px] uppercase font-black pt-1">Action Irréversible</p>
                            </div>

                            <form onSubmit={(e) => { e.preventDefault(); if (isAdminDelete) { if (delStep === 1) confirmDelStep1(); else confirmDelStep2(); } else executeDelete(); }} className="space-y-6">
                                {isAdminDelete && (
                                    <div className="space-y-4">
                                        {delStep === 1 ? (
                                            <div className="space-y-3">
                                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Confirmation Administrateur</label>
                                                <div className="relative">
                                                    <input
                                                        type={showDelPass ? 'text' : 'password'}
                                                        value={delPass}
                                                        onChange={e => { setDelPass(e.target.value); setDelError(''); }}
                                                        placeholder="Saisissez votre mot de passe"
                                                        title="Mot de passe administrateur"
                                                        autoComplete="current-password"
                                                        autoFocus
                                                        className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 text-white font-mono text-sm placeholder:text-slate-700 outline-none transition-all ${delError ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-800 focus:border-rose-500/50 focus:ring-4 focus:ring-rose-500/5'}`}
                                                    />
                                                    <button type="button" title="Afficher/masquer" onClick={() => setShowDelPass(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors">
                                                        {showDelPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="p-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                                                    <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1.5">Question de sécurité</p>
                                                    <p className="text-white font-bold leading-relaxed">{activeSecurityQuestion}</p>
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block ml-1">Votre Réponse</label>
                                                    <input
                                                        type="text"
                                                        value={delAnswer}
                                                        onChange={e => { setDelAnswer(e.target.value); setDelError(''); }}
                                                        placeholder="Répondre ici..."
                                                        title="Réponse à la question de sécurité"
                                                        autoComplete="off"
                                                        autoFocus
                                                        className={`w-full bg-slate-950 border rounded-2xl px-5 py-4 text-white font-bold text-sm outline-none transition-all ${delError ? 'border-rose-500 ring-4 ring-rose-500/10' : 'border-slate-800 focus:border-rose-500/50'}`}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                        {delError && <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-rose-400 text-xs font-bold text-center">{delError}</motion.p>}
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
                                <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center">
                                    <RefreshCw size={22} className="text-indigo-400" />
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
                                        title="Nouveau mot de passe (min. 6 car.)"
                                        autoComplete="new-password"
                                        autoFocus
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-11 pr-12 py-3.5 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                                    />
                                    <button type="button" title="Afficher/masquer" onClick={() => setShowNewPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
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

            {/* ── Main ── */}
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header Section */}
                <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500 inline-flex items-center justify-center rounded-2xl shadow-[0_0_30px_rgba(99,102,241,0.4)]">
                                <Users className="text-white w-5 h-5" />
                            </div>
                            <h1 className="text-4xl font-black text-white tracking-tight">Utilisateurs</h1>
                        </div>
                        <p className="text-slate-500 font-bold text-sm ml-13">
                            {users.length} comptes enregistrés — <span className="text-emerald-500">{users.filter((u: ManagedUser) => u.active).length} actifs</span>
                        </p>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 w-4 h-4 transition-colors" />
                            <input
                                type="text"
                                placeholder="Filtrer..."
                                title="Filtrer par nom, login ou rôle"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-64 bg-slate-900 border border-slate-800/50 rounded-2xl pl-11 pr-4 py-3.5 text-white font-bold text-sm placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"
                            />
                        </div>
                        <button
                            onClick={openAdd}
                            title="Créer un nouvel utilisateur"
                            className="bg-indigo-600 hover:bg-slate-50 hover:text-indigo-600 text-white font-black px-6 py-3.5 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 flex items-center gap-2"
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
                                <p className="text-slate-500 text-[10px] font-bold leading-tight">{s.description}</p>
                            </div>
                        );
                    })}
                </div>

                {/* Search */}
                <div className="relative max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Rechercher un compte..."
                        title="Rechercher par nom, identifiant ou rôle"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>

                {/* User List Section */}
                <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/50 rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800/50">
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Statut</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Utilisateur</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Identifiant</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Rôle</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Accès</th>
                                    <th className="px-6 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Sécurité</th>
                                    <th className="px-8 py-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] text-right">Actions</th>
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
                                                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">{u.createdAt}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className="font-mono text-slate-400 text-xs">@{u.email}</span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${rc.color} ${rc.textColor}`}>
                                                    {rc.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-slate-300 font-bold text-xs">
                                                        {u.teamId ? teams.find((t: any) => t.id === u.teamId)?.name : 'Accès Global'}
                                                    </span>
                                                    <span className="text-slate-600 text-[10px] font-medium">
                                                        {u.teamId ? 'Équipe de terrain' : 'Administration centrale'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() => openReset(u)}
                                                        title="Réinitialiser le mot de passe"
                                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/50 border border-slate-800 rounded-lg hover:border-indigo-500/50 transition-all group/pass"
                                                    >
                                                        <Lock size={12} className="text-slate-500 group-hover/pass:text-indigo-400 transition-colors" />
                                                        <span className="text-slate-600 font-mono text-[10px]">••••••</span>
                                                    </button>
                                                    {u.requires2FA && (
                                                        <div className="w-5 h-5 bg-indigo-500/10 border border-indigo-500/20 rounded flex items-center justify-center" title="2FA Activé">
                                                            <ShieldCheck size={10} className="text-indigo-400" />
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => openEdit(u)}
                                                        title="Modifier les détails"
                                                        className="p-2.5 bg-slate-950/50 border border-slate-800 text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all rounded-xl"
                                                    >
                                                        <Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => openDelete(u)}
                                                        title="Supprimer définitivement"
                                                        className="p-2.5 bg-slate-950/50 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 transition-all rounded-xl"
                                                    >
                                                        <Trash2 size={16} />
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
                                <Search size={24} className="text-slate-600" />
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
                            <button onClick={() => setShowForm(false)} title="Fermer" aria-label="Fermer le formulaire" className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={(e) => { e.preventDefault(); saveUser(); }} className="space-y-5">
                            {/* Nom complet */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Nom complet *</label>
                                <input type="text" value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
                                    placeholder="ex: Chef Maçons" title="Nom complet"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            {/* Email / Username */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Identifiant (Email/Login) *</label>
                                <input type="text" value={form.email} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))}
                                    placeholder="ex: maçongem" title="Identifiant de connexion"
                                    autoComplete="username"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Mot de passe *</label>
                                <div className="relative">
                                    <input type={showPass ? 'text' : 'password'} value={form.password}
                                        onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))}
                                        placeholder="Min. 6 caractères" title="Mot de passe"
                                        autoComplete="new-password"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white font-mono font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none" />
                                    <button type="button" title="Afficher/masquer le mot de passe" onClick={() => setShowPass(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200">
                                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            {/* Role */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Rôle *</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(Object.entries(ROLE_CONFIG) as [UserRole, typeof ROLE_CONFIG[UserRole]][]).map(([role, cfg]) => (
                                        <button key={role} type="button"
                                            onClick={() => setForm((f: any) => ({ ...f, role, teamId: role !== 'CHEF_EQUIPE' ? undefined : f.teamId }))}
                                            className={`flex items-center gap-2 p-3 rounded-xl border font-bold text-xs transition-all ${form.role === role ? `${cfg.color} ${cfg.textColor}` : 'bg-slate-950 border-slate-800 text-slate-500 hover:border-slate-600'}`}
                                        >
                                            <cfg.icon size={14} /> {cfg.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Team (Chef Équipe only) */}
                            {form.role === 'CHEF_EQUIPE' && (
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Équipe assignée</label>
                                    <select title="Choisir l'équipe" value={form.teamId ?? ''} onChange={e => setForm((f: any) => ({ ...f, teamId: e.target.value || undefined }))}
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
                                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requires2FA ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-slate-300 font-medium text-sm">Activer la double authentification (2FA)</span>
                                </label>
                            )}

                            {/* Active toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div onClick={() => setForm((f: any) => ({ ...f, active: !f.active }))}
                                    className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.active ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-4' : ''}`} />
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
        </div>
    );
}
