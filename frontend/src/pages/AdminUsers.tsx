import { useState } from 'react';
import {
    Users, Plus, Edit3, Trash2, ShieldCheck, Shield, User,
    Eye, EyeOff, Save, X, Search, Lock, CheckCircle2, AlertTriangle
} from 'lucide-react';
import type { UserRole } from '../utils/types';

// ─── Types ────────────────────────────────────────────────────────
interface ManagedUser {
    id: string;
    username: string;
    password: string;
    role: UserRole;
    name: string;
    teamId?: string;
    active: boolean;
    createdAt: string;
    requires2FA?: boolean;
}

// ─── Initial seeded users from mockUsers.ts ────────────────────────
const INITIAL_USERS: ManagedUser[] = [
    { id: '1', username: 'admingem', password: '1995@PROQUELEC@2026', role: 'ADMIN_PROQUELEC', name: 'Administrateur PROQUELEC', active: true, createdAt: '2026-01-01', requires2FA: true },
    { id: '2', username: 'dggem', password: 'GEMDG2026', role: 'DG_PROQUELEC', name: 'DG PROQUELEC', active: true, createdAt: '2026-01-01' },
    { id: '3', username: 'gemlse', password: 'LSEGEM2026', role: 'CLIENT_LSE', name: 'Client LSE', active: true, createdAt: '2026-01-15' },
    { id: '4', username: 'maçongem', password: 'GEMMA2026', role: 'CHEF_EQUIPE', name: 'Chef Maçons', active: true, createdAt: '2026-01-10', teamId: 'team_macons' },
    { id: '5', username: 'reseaugem', password: 'GEMRE2026', role: 'CHEF_EQUIPE', name: 'Chef Réseau', active: true, createdAt: '2026-01-10', teamId: 'team_reseau' },
    { id: '6', username: 'electriciengem', password: 'GEMELEC2026', role: 'CHEF_EQUIPE', name: 'Chef Électricien', active: true, createdAt: '2026-01-10', teamId: 'team_interieur' },
    { id: '7', username: 'livreurgem', password: 'gemliv2026', role: 'CHEF_EQUIPE', name: 'Chef Livreur', active: true, createdAt: '2026-01-20', teamId: 'team_livraison' },
];

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; textColor: string; icon: typeof Shield; description: string }> = {
    ADMIN_PROQUELEC: { label: 'Admin', color: 'bg-indigo-500/15 border-indigo-500/40', textColor: 'text-indigo-400', icon: ShieldCheck, description: 'Accès complet + 2FA' },
    DG_PROQUELEC: { label: 'DG', color: 'bg-emerald-500/15 border-emerald-500/40', textColor: 'text-emerald-400', icon: Shield, description: 'Finances + Rapports' },
    CLIENT_LSE: { label: 'Client LSE', color: 'bg-amber-500/15 border-amber-500/40', textColor: 'text-amber-400', icon: User, description: 'Carte + Avancement' },
    CHEF_EQUIPE: { label: 'Chef Équipe', color: 'bg-blue-500/15 border-blue-500/40', textColor: 'text-blue-400', icon: Users, description: 'Dashboard Équipe' },
};

const TEAMS = [
    { id: 'team_macons', label: 'Équipe Maçons' },
    { id: 'team_reseau', label: 'Équipe Réseau' },
    { id: 'team_interieur', label: 'Équipe Électricien' },
    { id: 'team_livraison', label: 'Équipe Livreur' },
    { id: 'team_controle', label: 'Équipe Contrôle' },
];

const emptyForm = (): Omit<ManagedUser, 'id' | 'createdAt'> => ({
    username: '', password: '', role: 'CHEF_EQUIPE', name: '', teamId: undefined, active: true, requires2FA: false,
});

export default function AdminUsers() {
    const [users, setUsers] = useState<ManagedUser[]>(INITIAL_USERS);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm());
    const [showPass, setShowPass] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    const filtered = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.name.toLowerCase().includes(search.toLowerCase()) ||
        u.role.toLowerCase().includes(search.toLowerCase())
    );

    const openAdd = () => {
        setEditId(null);
        setForm(emptyForm());
        setShowForm(true);
        setShowPass(false);
    };

    const openEdit = (u: ManagedUser) => {
        setEditId(u.id);
        setForm({ username: u.username, password: u.password, role: u.role, name: u.name, teamId: u.teamId, active: u.active, requires2FA: u.requires2FA });
        setShowForm(true);
        setShowPass(false);
    };

    const saveUser = () => {
        if (!form.username.trim() || !form.password.trim() || !form.name.trim()) {
            showToast('Tous les champs obligatoires doivent être remplis.', 'error');
            return;
        }
        if (form.password.length < 6) {
            showToast('Le mot de passe doit faire au moins 6 caractères.', 'error');
            return;
        }
        if (editId) {
            setUsers(prev => prev.map(u => u.id === editId ? { ...u, ...form } : u));
            showToast(`Compte "${form.username}" mis à jour avec succès.`);
        } else {
            const newUser: ManagedUser = {
                ...form,
                id: Date.now().toString(),
                createdAt: new Date().toISOString().split('T')[0],
            };
            setUsers(prev => [...prev, newUser]);
            showToast(`Compte "${form.username}" créé avec succès.`);
        }
        setShowForm(false);
    };

    const deleteUser = (id: string) => {
        if (id === '1') { showToast('Impossible de supprimer le compte Admin principal.', 'error'); return; }
        setUsers(prev => prev.filter(u => u.id !== id));
        showToast('Compte supprimé.');
        setConfirmDelete(null);
    };

    const toggleActive = (id: string) => {
        if (id === '1') { showToast('Impossible de désactiver le compte Admin principal.', 'error'); return; }
        setUsers(prev => prev.map(u => u.id === id ? { ...u, active: !u.active } : u));
    };

    const roleStats = Object.entries(ROLE_CONFIG).map(([role, cfg]) => ({
        ...cfg, role, count: users.filter(u => u.role === role).length,
    }));

    return (
        <div className="min-h-screen bg-slate-950 p-4 md:p-8">

            {/* Toast */}
            {toast && (
                <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-bold text-sm transition-all
                    ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
                    {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    {toast.msg}
                </div>
            )}

            {/* Confirm Delete */}
            {confirmDelete && (
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl">
                        <div className="w-14 h-14 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <Trash2 className="text-red-400" size={24} />
                        </div>
                        <h3 className="text-white font-black text-xl text-center mb-2">Supprimer ce compte ?</h3>
                        <p className="text-slate-400 text-sm text-center mb-6">Cette action est irréversible.</p>
                        <div className="flex gap-3">
                            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all">Annuler</button>
                            <button onClick={() => deleteUser(confirmDelete)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-black hover:bg-red-500 transition-all">Supprimer</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                            <Users className="text-white w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black text-white tracking-tight">Gestion des Utilisateurs</h1>
                            <p className="text-slate-500 font-medium">{users.length} compte(s) enregistré(s) — Réservé Admin</p>
                        </div>
                    </div>
                    <button
                        onClick={openAdd}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-indigo-600/25"
                    >
                        <Plus size={20} /> Nouveau Compte
                    </button>
                </header>

                {/* Role Stats */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {roleStats.map(s => {
                        const Icon = s.icon;
                        return (
                            <div key={s.role} className={`p-5 rounded-2xl border ${s.color}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <Icon size={18} className={s.textColor} />
                                    <span className={`text-2xl font-black ${s.textColor}`}>{s.count}</span>
                                </div>
                                <p className="text-white font-bold text-sm">{s.label}</p>
                                <p className="text-slate-500 text-[11px] mt-0.5">{s.description}</p>
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
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-12 pr-4 py-3 text-white font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>

                {/* User list */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {filtered.map(u => {
                        const rc = ROLE_CONFIG[u.role];
                        const RoleIcon = rc.icon;
                        return (
                            <div key={u.id} className={`bg-slate-900/60 rounded-3xl border transition-all ${u.active ? 'border-slate-800/60 hover:border-indigo-500/30' : 'border-slate-800/30 opacity-50'}`}>
                                <div className="p-6">
                                    {/* Top row */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`w-12 h-12 rounded-2xl ${rc.color} border flex items-center justify-center`}>
                                            <RoleIcon size={20} className={rc.textColor} />
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {u.requires2FA && (
                                                <span className="text-[9px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded-full">2FA</span>
                                            )}
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${rc.color} ${rc.textColor} border`}>
                                                {rc.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <h3 className="text-white font-black text-base mb-0.5">{u.name}</h3>
                                    <p className="text-slate-400 font-mono text-sm mb-1">@{u.username}</p>
                                    {u.teamId && (
                                        <p className="text-[11px] text-slate-500 mb-2">
                                            🏷 {TEAMS.find(t => t.id === u.teamId)?.label ?? u.teamId}
                                        </p>
                                    )}
                                    <p className="text-[10px] text-slate-600 mb-4">Créé le {u.createdAt}</p>

                                    {/* Password hint */}
                                    <div className="flex items-center gap-2 bg-slate-950/60 rounded-xl px-3 py-2 mb-5">
                                        <Lock size={12} className="text-slate-500" />
                                        <span className="text-slate-500 text-[11px] font-mono flex-1">{'•'.repeat(Math.min(u.password.length, 12))}</span>
                                        <span className="text-[9px] text-slate-600">{u.password.length} car.</span>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => openEdit(u)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-xl font-bold text-xs transition-all"
                                        >
                                            <Edit3 size={13} /> Modifier
                                        </button>
                                        <button
                                            onClick={() => toggleActive(u.id)}
                                            title={u.active ? 'Désactiver' : 'Activer'}
                                            className={`px-3 py-2.5 rounded-xl font-bold text-xs transition-all border ${u.active ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'}`}
                                        >
                                            {u.active ? '⏸' : '▶'}
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(u.id)}
                                            title="Supprimer ce compte"
                                            className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-all"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Drawer / Form */}
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

                        <div className="space-y-5">
                            {/* Nom complet */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Nom complet *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="ex: Chef Maçons"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            {/* Username */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Nom d'utilisateur *</label>
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                    placeholder="ex: maçongem"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            {/* Password */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Mot de passe *</label>
                                <div className="relative">
                                    <input
                                        type={showPass ? 'text' : 'password'}
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        placeholder="Min. 6 caractères"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white font-mono font-medium placeholder:text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
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
                                        <button
                                            key={role}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, role, teamId: role !== 'CHEF_EQUIPE' ? undefined : f.teamId }))}
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
                                    <select
                                        title="Choisir l'équipe"
                                        value={form.teamId ?? ''}
                                        onChange={e => setForm(f => ({ ...f, teamId: e.target.value || undefined }))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none"
                                    >
                                        <option value="">— Sélectionner une équipe —</option>
                                        {TEAMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                                    </select>
                                </div>
                            )}

                            {/* 2FA (Admin only) */}
                            {form.role === 'ADMIN_PROQUELEC' && (
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <div
                                        onClick={() => setForm(f => ({ ...f, requires2FA: !f.requires2FA }))}
                                        className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.requires2FA ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.requires2FA ? 'translate-x-4' : ''}`} />
                                    </div>
                                    <span className="text-slate-300 font-medium text-sm">Activer la double authentification (2FA)</span>
                                </label>
                            )}

                            {/* Active toggle */}
                            <label className="flex items-center gap-3 cursor-pointer">
                                <div
                                    onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                                    className={`w-10 h-6 rounded-full transition-all flex items-center px-0.5 ${form.active ? 'bg-emerald-600' : 'bg-slate-700'}`}
                                >
                                    <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? 'translate-x-4' : ''}`} />
                                </div>
                                <span className="text-slate-300 font-medium text-sm">Compte actif</span>
                            </label>
                        </div>

                        <div className="flex gap-3 mt-8">
                            <button onClick={() => setShowForm(false)} className="flex-1 py-3.5 bg-slate-800 text-slate-300 rounded-2xl font-bold hover:bg-slate-700 transition-all">Annuler</button>
                            <button onClick={saveUser} className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25">
                                <Save size={16} /> {editId ? 'Enregistrer' : 'Créer le compte'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
