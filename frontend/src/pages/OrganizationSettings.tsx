import React, { useState, useEffect } from 'react';
import { 
    Building2, 
    Palette, 
    Mail, 
    GitBranch, 
    Save, 
    Upload, 
    Plus, 
    Trash2, 
    MoveUp, 
    MoveDown,
    ShieldCheck,
    BellRing,
    Box
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { toast } from 'react-hot-toast';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkflowStep {
    role: string;
    label: string;
    sequence: number;
}

interface OrgConfig {
    branding?: {
        logo?: string;
        primaryColor?: string;
        footerText?: string;
        organizationName?: string;
    };
    notifications?: {
        auditEmails?: string[];
        workflowAlerts?: boolean;
    };
    workflow?: {
        missionSteps?: WorkflowStep[];
    };
    labels?: {
        household?: { singular: string; plural: string };
        zone?: { singular: string; plural: string };
    };
    features?: {
        koboTerminal?: boolean;
    };
}

export default function OrganizationSettings() {
    const { user, login } = useAuth();
    const [config, setConfig] = useState<OrgConfig>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'branding' | 'notifications' | 'workflow' | 'labels' | 'features'>('branding');

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const response = await apiClient.get('/organization/config');
                setConfig(response.data.config || {});
            } catch (error) {
                toast.error('Erreur lors du chargement de la configuration');
            } finally {
                setIsLoading(false);
            }
        };
        fetchConfig();
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiClient.patch('/organization/config', { config });
            toast.success('Configuration mise à jour avec succès');
            
            // Mettre à jour le contexte global si nécessaire
            if (user) {
                // On met à jour le contexte avec la nouvelle config sans changer les autres infos
                login(user.email, user.role, user.name, user.organization, user.id, undefined, config);
            }
        } catch (error) {
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setIsSaving(false);
        }
    };

    const updateBranding = (field: string, value: string) => {
        setConfig(prev => ({
            ...prev,
            branding: { ...(prev.branding || {}), [field]: value }
        }));
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file size (max 2MB to not overload db/payload)
            if (file.size > 2 * 1024 * 1024) {
                toast.error("Le fichier est trop volumineux. La taille maximale est de 2 Mo.");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => {
                updateBranding('logo', reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const updateLabel = (type: 'household' | 'zone', field: 'singular' | 'plural', value: string) => {
        setConfig(prev => ({
            ...prev,
            labels: {
                ...(prev.labels || {}),
                [type]: { ...(prev.labels?.[type] || { singular: '', plural: '' }), [field]: value }
            }
        }));
    };

    const toggleFeature = (feature: keyof NonNullable<OrgConfig['features']>) => {
        setConfig(prev => ({
            ...prev,
            features: {
                ...(prev.features || {}),
                [feature]: !prev.features?.[feature]
            }
        }));
    };

    const addAuditEmail = () => {
        const email = prompt('Entrez une adresse email pour l\'audit :');
        if (email && email.includes('@')) {
            setConfig(prev => {
                const notifications = prev.notifications || {};
                const auditEmails = notifications.auditEmails || [];
                return {
                    ...prev,
                    notifications: { ...notifications, auditEmails: [...auditEmails, email] }
                };
            });
        }
    };

    const removeAuditEmail = (emailToRemove: string) => {
        setConfig(prev => {
            const notifications = prev.notifications || {};
            const auditEmails = (notifications.auditEmails || []).filter(e => e !== emailToRemove);
            return {
                ...prev,
                notifications: { ...notifications, auditEmails }
            };
        });
    };

    const addWorkflowStep = () => {
        const role = prompt('Rôle technique (ex: COMPTABLE, LOGISTIQUE) :');
        const label = prompt('Nom affiché (ex: Validation Comptable) :');
        if (role && label) {
            setConfig(prev => {
                const workflow = prev.workflow || {};
                const steps = workflow.missionSteps || [];
                const newStep: WorkflowStep = {
                    role: role.toUpperCase(),
                    label,
                    sequence: steps.length + 1
                };
                return {
                    ...prev,
                    workflow: { ...workflow, missionSteps: [...steps, newStep] }
                };
            });
        }
    };

    const removeWorkflowStep = (index: number) => {
        setConfig(prev => {
            const workflow = prev.workflow || {};
            const steps = (workflow.missionSteps || [])
                .filter((_, i) => i !== index)
                .map((s, i) => ({ ...s, sequence: i + 1 }));
            return {
                ...prev,
                workflow: { ...workflow, missionSteps: steps }
            };
        });
    };

    const moveStep = (index: number, direction: 'up' | 'down') => {
        setConfig(prev => {
            const steps = [...(prev.workflow?.missionSteps || [])];
            if (direction === 'up' && index > 0) {
                [steps[index], steps[index - 1]] = [steps[index - 1], steps[index]];
            } else if (direction === 'down' && index < steps.length - 1) {
                [steps[index], steps[index + 1]] = [steps[index + 1], steps[index]];
            }
            const reordered = steps.map((s, i) => ({ ...s, sequence: i + 1 }));
            return {
                ...prev,
                workflow: { ...(prev.workflow || {}), missionSteps: reordered }
            };
        });
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <PageContainer className="min-h-screen bg-slate-950 py-8">
            <PageHeader
                title="Mon Organisation"
                subtitle="Personnalisez l'identité visuelle et les processus métier"
                icon={<Building2 size={24} className="text-blue-500" />}
                actions={
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        <Save size={16} />
                        {isSaving ? 'SAUVEGARDE...' : 'ENREGISTRER'}
                    </button>
                }
            />

            <ContentArea className="mt-8 !p-0 !bg-transparent border-none">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Navigation latérale */}
                    <div className="lg:col-span-1 space-y-2">
                        <button
                            onClick={() => setActiveTab('branding')}
                            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'branding' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                            <Palette size={18} /> Identité Visuelle
                        </button>
                        <button
                            onClick={() => setActiveTab('notifications')}
                            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'notifications' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                            <BellRing size={18} /> Notifications & Audit
                        </button>
                        <button
                            onClick={() => setActiveTab('workflow')}
                            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'workflow' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                            <GitBranch size={18} /> Workflow Mission
                        </button>
                        <button
                            onClick={() => setActiveTab('labels')}
                            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'labels' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                            <Box size={18} /> Glossaire Métier
                        </button>
                        <button
                            onClick={() => setActiveTab('features')}
                            className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'features' ? 'bg-blue-600 text-white shadow-xl' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                        >
                            <ShieldCheck size={18} /> Fonctionnalités
                        </button>
                    </div>

                    {/* Zone de contenu dynamique */}
                    <div className="lg:col-span-3">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="glass-card !p-10 !rounded-[2.5rem] min-h-[500px]"
                        >
                            {activeTab === 'features' && (
                                <div className="space-y-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-blue-500/10 rounded-2xl"><ShieldCheck className="text-blue-500" /></div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Activation des Modules</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10 flex items-start gap-4 mb-6">
                                            <ShieldCheck className="text-blue-500 shrink-0 mt-1" size={24} />
                                            <div className="space-y-1">
                                                <h4 className="text-sm font-black text-white">Contrôle Admin des Paramètres</h4>
                                                <p className="text-xs text-slate-400 leading-relaxed">Activez ou désactivez les fonctionnalités techniques sensibles pour le reste de l'organisation.</p>
                                            </div>
                                        </div>

                                        <div className="pt-6 border-t border-white/5">
                                            <label className="flex items-center justify-between cursor-pointer group">
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-black text-white group-hover:text-blue-500 transition-colors">Terminal Kobo Toolbox</h4>
                                                    <p className="text-xs text-slate-500">Permettre l'accès au terminal de synchronisation brute pour les utilisateurs habilités.</p>
                                                </div>
                                                <div onClick={() => toggleFeature('koboTerminal')} className={`w-14 h-8 rounded-full p-1 transition-colors relative ${config.features?.koboTerminal ? 'bg-blue-600' : 'bg-slate-800'}`}>
                                                    <div className={`w-6 h-6 bg-white rounded-full transition-transform shadow-md ${config.features?.koboTerminal ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'branding' && (
                                <div className="space-y-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-blue-500/10 rounded-2xl"><Palette className="text-blue-500" /></div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Branding White-Label</h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Logo de l'organisation (Fichier Image)</label>
                                            <div className="flex gap-4">
                                                <div className="flex-1 relative cursor-pointer group">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        title="Choisir un fichier image"
                                                        onChange={handleLogoUpload}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                    />
                                                    <div className="absolute inset-0 flex items-center gap-3 bg-slate-900 border border-white/5 rounded-2xl px-5 text-slate-400 text-sm group-hover:border-blue-500/50 group-hover:bg-slate-800 transition-all pointer-events-none">
                                                        <Upload size={18} className="text-blue-500" />
                                                        <span className="truncate">Cliquer pour parcourir (Max 2Mo)...</span>
                                                    </div>
                                                </div>
                                                <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center p-2 border border-white/10 overflow-hidden shadow-Inner shrink-0 relative z-20">
                                                    {config.branding?.logo ? (
                                                        <img src={config.branding.logo} alt="Preview" className="max-w-full max-h-full object-contain" />
                                                    ) : <Palette className="text-slate-200" />}
                                                </div>
                                            </div>
                                            {config.branding?.logo && (
                                                <div className="flex justify-end">
                                                    <button 
                                                        onClick={() => updateBranding('logo', '')}
                                                        className="text-[10px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                                                    >
                                                        Supprimer le logo actuel
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Couleur Primaire</label>
                                            <div className="flex gap-4">
                                                <input
                                                    type="color"
                                                    title="Choisir la couleur primaire"
                                                    value={config.branding?.primaryColor || '#1e90ff'}
                                                    onChange={e => updateBranding('primaryColor', e.target.value)}
                                                    className="w-14 h-14 bg-transparent border-none cursor-pointer rounded-2xl overflow-hidden"
                                                />
                                                <input
                                                    type="text"
                                                    title="Code hexadécimal de la couleur"
                                                    placeholder="#000000"
                                                    value={config.branding?.primaryColor || '#1e90ff'}
                                                    onChange={e => updateBranding('primaryColor', e.target.value)}
                                                    className="flex-1 bg-slate-900 border border-white/5 rounded-2xl px-5 py-4 text-white font-mono text-sm uppercase focus:ring-2 focus:ring-blue-500/30 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Texte Bas de Page (Factures & PDF)</label>
                                        <textarea
                                            value={config.branding?.footerText || ''}
                                            onChange={e => updateBranding('footerText', e.target.value)}
                                            rows={3}
                                            placeholder="Ex: PROQUELEC S.A - Dakar, Sénégal - RCCM SN-DKR-..."
                                            className="w-full bg-slate-900 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:ring-2 focus:ring-blue-500/30 outline-none resize-none"
                                        />
                                    </div>
                                    
                                    <div className="p-6 bg-blue-500/5 rounded-3xl border border-blue-500/10 flex items-start gap-4">
                                        <ShieldCheck className="text-blue-500 shrink-0 mt-1" size={24} />
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-black text-white">Mode White-Label Actif</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                Ces réglages s'appliquent en temps réel à tous vos collaborateurs. Ils remplacent le branding par défaut de GEM SAAS pour vos documents officiels et votre interface.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notifications' && (
                                <div className="space-y-8">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-emerald-500/10 rounded-2xl"><Mail className="text-emerald-500" /></div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Audit & Communications</h3>
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Emails en Copie (Audit)</h4>
                                            <button onClick={addAuditEmail} className="text-xs font-black text-emerald-500 hover:text-emerald-400 flex items-center gap-1">
                                                <Plus size={14} /> Ajouter un email
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {config.notifications?.auditEmails?.map((email, i) => (
                                                <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:border-emerald-500/30 transition-all">
                                                    <span className="text-sm font-bold text-white">{email}</span>
                                                    <button 
                                                        onClick={() => removeAuditEmail(email)} 
                                                        title="Supprimer cet email"
                                                        className="text-slate-500 hover:text-rose-500 p-1 opacity-0 group-hover:opacity-100 transition-all"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                            {(!config.notifications?.auditEmails || config.notifications.auditEmails.length === 0) && (
                                                <div className="col-span-full py-8 text-center border-2 border-dashed border-white/5 rounded-[2rem] text-slate-500 font-bold text-xs uppercase italic">
                                                    Aucun email d'audit configuré
                                                </div>
                                            )}
                                        </div>

                                        <div className="pt-6 border-t border-white/5">
                                            <label className="flex items-center gap-4 cursor-pointer group">
                                                <div className={`w-14 h-8 rounded-full p-1 transition-colors relative ${config.notifications?.workflowAlerts !== false ? 'bg-emerald-500' : 'bg-slate-800'}`}>
                                                    <div className={`w-6 h-6 bg-white rounded-full transition-transform shadow-md ${config.notifications?.workflowAlerts !== false ? 'translate-x-6' : 'translate-x-0'}`} />
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={config.notifications?.workflowAlerts !== false}
                                                    onChange={e => setConfig(prev => ({ 
                                                        ...prev, 
                                                        notifications: { ...(prev.notifications || {}), workflowAlerts: e.target.checked } 
                                                    }))}
                                                />
                                                <div>
                                                    <h4 className="text-sm font-black text-white group-hover:text-emerald-500 transition-colors">Alertes de Workflow en Temps Réel</h4>
                                                    <p className="text-xs text-slate-500">Notifier automatiquement les valideurs quand une action est requise.</p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'workflow' && (
                                <div className="space-y-8">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-amber-500/10 rounded-2xl"><GitBranch className="text-amber-500" /></div>
                                            <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Processus de Validation</h3>
                                        </div>
                                        <button onClick={addWorkflowStep} className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
                                            <Plus size={16} /> Ajouter une étape
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {config.workflow?.missionSteps?.map((step, index) => (
                                            <div key={index} className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/10 group hover:border-amber-500/50 transition-all">
                                                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center font-black">
                                                    {step.sequence}
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="text-sm font-black text-white">{step.label}</h4>
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{step.role}</p>
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                                    <button onClick={() => moveStep(index, 'up')} disabled={index === 0} title="Monter d'un rang" className="p-2 text-slate-400 hover:text-white disabled:opacity-20"><MoveUp size={16} /></button>
                                                    <button onClick={() => moveStep(index, 'down')} disabled={index === (config.workflow?.missionSteps?.length || 0) - 1} title="Descendre d'un rang" className="p-2 text-slate-400 hover:text-white disabled:opacity-20"><MoveDown size={16} /></button>
                                                    <button onClick={() => removeWorkflowStep(index)} title="Supprimer l'étape" className="p-2 text-slate-400 hover:text-rose-500 ml-2"><Trash2 size={16} /></button>
                                                </div>
                                            </div>
                                        ))}
                                        {(!config.workflow?.missionSteps || config.workflow.missionSteps.length === 0) && (
                                            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] space-y-4">
                                                <GitBranch size={40} className="text-white/5 mx-auto" />
                                                <p className="text-slate-500 font-bold text-xs uppercase tracking-[0.2em] italic max-w-xs mx-auto">
                                                    Aucune étape configurée. Le workflow par défaut de 3 étapes (Chef, Comptable, DG) sera appliqué.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10">
                                        <p className="text-xs text-amber-500/70 italic leading-relaxed text-center">
                                            <b>Note importante:</b> Le changement du workflow n'affecte pas les missions déjà soumises, mais s'appliquera instantanément à toutes les nouvelles demandes.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'labels' && (
                                <div className="space-y-10">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="p-3 bg-indigo-500/10 rounded-2xl"><Box className="text-indigo-500" /></div>
                                        <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Glossaire Métier</h3>
                                    </div>
                                    <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 flex items-start gap-4 mb-6">
                                        <ShieldCheck className="text-indigo-500 shrink-0 mt-1" size={24} />
                                        <div className="space-y-1">
                                            <h4 className="text-sm font-black text-white">White-Label Sémantique</h4>
                                            <p className="text-xs text-slate-400 leading-relaxed">Adaptez GEM à votre métier. Si votre projet ne concerne pas des "Ménages", remplacez ce terme par "Pylônes", "Sites", "Écoles" ou "Clients".</p>
                                        </div>
                                    </div>
                                    <div className="space-y-10">
                                        <div className="space-y-6">
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4">Entité Opérationnelle</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Singulier</label>
                                                    <input title="Nom singulier" placeholder="Ex: Ménage" type="text" value={config.labels?.household?.singular || 'Ménage'} onChange={e => updateLabel('household', 'singular', e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none" />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pluriel</label>
                                                    <input title="Nom pluriel" placeholder="Ex: Ménages" type="text" value={config.labels?.household?.plural || 'Ménages'} onChange={e => updateLabel('household', 'plural', e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-6 pt-4">
                                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-white/5 pb-4">Unités de Secteur / Zones</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Singulier</label>
                                                    <input title="Nom singulier zone" placeholder="Ex: Zone" type="text" value={config.labels?.zone?.singular || 'Zone'} onChange={e => updateLabel('zone', 'singular', e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none" />
                                                </div>
                                                <div className="space-y-3">
                                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Pluriel</label>
                                                    <input title="Nom pluriel zone" placeholder="Ex: Zones" type="text" value={config.labels?.zone?.plural || 'Zones'} onChange={e => updateLabel('zone', 'plural', e.target.value)} className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                </div>
            </ContentArea>
        </PageContainer>
    );
}
