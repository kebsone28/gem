import { useState, useEffect, useRef, type FormEvent } from 'react';
import logger from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import type { User as DBUser } from '../utils/types';
import { trackRender } from '../utils/debugHelper';


type LoginStep = 'credentials' | '2fa' | 'recovery';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFAAnswer, setTwoFAAnswer] = useState('');
    const [step, setStep] = useState<LoginStep>('credentials');
    const [pendingUser, setPendingUser] = useState<DBUser | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    // -- Recovery state --
    const [recInput, setRecInput] = useState('');
    const [recStep, setRecStep] = useState<1 | 2>(1);
    const [recQuestion, setRecQuestion] = useState('');
    const [recNewPw, setRecNewPw] = useState('');
    const [recSecAns, setRecSecAns] = useState('');
    const [recoveryInfo, setRecoveryInfo] = useState('');

    // Track renders in development
    const renderCount = useRef(0);
    useEffect(() => {
        renderCount.current++;
        trackRender('Login');
        console.log(`📊 [DIAGNOSTIC] Login render #${renderCount.current}`);
    });

    const handleCredentials = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await apiClient.post('auth/login', {
                email: username.trim(),
                password: password
            });

            const { accessToken, user: userPayload } = response.data;
            // copy only the minimal fields we need to avoid retaining a potentially large object
            const emailResp = userPayload?.email || '';
            const roleResp = userPayload?.role || '';
            const nameResp = userPayload?.name || '';
            const orgResp = userPayload?.organization;
            const idResp = userPayload?.id;
            const requires2FA = userPayload?.requires2FA;

            if (requires2FA) {
                setPendingUser({
                    email: emailResp,
                    role: roleResp,
                    name: nameResp,
                    organization: orgResp,
                    id: idResp,
                    requires2FA,
                    accessToken
                } as any);
                setStep('2fa');
                setLoading(false);
                return;
            }

            login(emailResp, roleResp, nameResp, orgResp, idResp, accessToken);
            navigate('/dashboard');
        } catch (err: any) {
            logger.error('Login error:', err);
            
            if (err.response?.status === 503 || err.message?.includes('Network Error')) {
                setError('⚠️ Base de données inaccessible. Veuillez vérifier que le serveur backend et la base de données sont lancés.');
            } else {
                setError(err.response?.data?.error || 'Identifiant ou mot de passe incorrect.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handle2FA = async (e: FormEvent) => {
        e.preventDefault();
        if (!pendingUser) return;

        setLoading(true);
        setError('');

        try {
            const { data } = await apiClient.post('auth/verify-2fa', {
                email: pendingUser.email,
                answer: twoFAAnswer
            });

            const { user, accessToken } = data;
            login(user.email, user.role, user.name, user.organization, user.id, accessToken);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Réponse secrète incorrecte. Accès refusé.');
        } finally {
            setLoading(false);
        }
    };

    const resetToCredentials = () => {
        setStep('credentials');
        setPendingUser(null);
        setTwoFAAnswer('');
        setError('');
        setRecoveryInfo('');
    };

    const startRecovery = async () => {
        // En mode SaaS, on a besoin de l'email pour savoir quelle question poser
        const email = username.trim() || prompt("Veuillez saisir votre email :");
        if (!email) return;

        setRecInput(email);
        setStep('recovery');
        setRecStep(1);
        setRecQuestion("Veuillez saisir votre réponse de sécurité ou votre code d'urgence ci-dessous.");
        setError('');
    };

    const handleRecStep1 = async (e: FormEvent) => {
        e.preventDefault();
        // Dans ce flux simplifié, on passe à la saisie du nouveau MDP
        // La validation réelle se fera au moment du clic final via l'API
        setRecStep(2);
    };

    const handleRecStep2 = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (recNewPw.length < 8) {
            setError('Le mot de passe doit faire au moins 8 caractères.');
            setLoading(false);
            return;
        }

        try {
            await apiClient.post('auth/reset-password', {
                email: recInput, // L'identifiant/email
                securityAnswer: recSecAns,
                recoveryCode: recSecAns.includes('-') ? recSecAns : undefined,
                newPassword: recNewPw
            });

            setRecoveryInfo('✅ Mot de passe réinitialisé. Connectez-vous avec vos nouveaux identifiants.');
            setStep('credentials');
            setPassword(''); // On vide l'ancien MDP
        } catch (err: any) {
            setError(err.response?.data?.error || 'Erreur lors de la réinitialisation.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[120px] opacity-20 gradient-primary" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10 bg-accent" />
                {/* Grid pattern */}
                <div className="absolute inset-0 opacity-[0.15] bg-[linear-gradient(theme(colors.slate.800)_1px,transparent_1px),linear-gradient(90deg,theme(colors.slate.800)_1px,transparent_1px)] bg-[size:60px_60px]" />
            </div>

            <div className="max-w-md w-full relative z-10">
                <div className="bg-dark-surface/90 backdrop-blur-2xl rounded-[var(--radius-2xl)] shadow-elevated p-8 border border-dark-border">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 mb-4 rounded-[var(--radius-xl)] shadow-[var(--shadow-glow)] overflow-hidden gradient-hero">
                            <img
                                src="/logo-proquelec.png"
                                alt="PROQUELEC"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-dark-text tracking-tight">PROQUELEC</h1>
                        <p className="text-dark-text-muted mt-1 text-sm">Plateforme d'Électrification de Masse</p>
                    </div>

                    {error && (
                        <div className="bg-danger/10 border border-danger/30 text-danger p-3 rounded-[var(--radius-md)] text-sm mb-6 text-center font-medium">
                            {error}
                        </div>
                    )}

                    {recoveryInfo && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-[var(--radius-md)] text-sm mb-6 text-center font-medium">
                            {recoveryInfo}
                        </div>
                    )}

                    {step === 'credentials' && (
                        <form onSubmit={handleCredentials} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-dark-text-secondary uppercase tracking-wider">Nom d'utilisateur</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-text-muted" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-[var(--radius-md)] py-3 pl-10 pr-4 text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-dark-text-muted"
                                        placeholder="ex: admin"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-dark-text-secondary uppercase tracking-wider">Mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-text-muted" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-dark-bg border border-dark-border rounded-[var(--radius-md)] py-3 pl-10 pr-12 text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all placeholder:text-dark-text-muted"
                                        placeholder="••••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        title="Afficher/Masquer le mot de passe"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-dark-text-muted hover:text-dark-text-secondary transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                title="Se connecter"
                                className="w-full btn-primary py-3.5 text-sm flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><LogIn size={18} /> Se connecter</>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={startRecovery}
                                title="Mot de passe oublié ?"
                                className="w-full text-dark-text-muted hover:text-dark-text-secondary text-xs font-medium transition-colors mt-4 text-center"
                            >
                                Mot de passe oublié ?
                            </button>
                        </form>
                    )}

                    {step === '2fa' && pendingUser && (
                        <form onSubmit={handle2FA} className="space-y-5">
                            <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] gradient-primary-soft border border-primary/20">
                                <ShieldCheck className="text-primary shrink-0" size={22} />
                                <div>
                                    <p className="text-primary font-semibold text-sm">Double authentification</p>
                                    <p className="text-dark-text-muted text-xs mt-0.5">Compte administrateur détecté.</p>
                                </div>
                            </div>

                            {/* Accessibility: hidden username field for password manager - accessible but hidden */}
                            <div className="sr-only" aria-hidden="true">
                                <input type="text" name="username" value={pendingUser.email} readOnly autoComplete="username" tabIndex={-1} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-dark-text-secondary uppercase tracking-wider">
                                    {pendingUser.securityQuestion}
                                </label>
                                <input
                                    type="password"
                                    value={twoFAAnswer}
                                    onChange={(e) => setTwoFAAnswer(e.target.value)}
                                    className="w-full bg-dark-bg border border-primary/30 rounded-[var(--radius-md)] py-3 px-4 text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-dark-text-muted text-center font-bold tracking-widest text-lg"
                                    placeholder="Votre réponse..."
                                    autoComplete="current-password"
                                    autoFocus
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                title="Vérifier et accéder"
                                className="w-full btn-primary py-3.5 text-sm flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><ShieldCheck size={18} /> Vérifier &amp; Accéder</>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={resetToCredentials}
                                title="Retour à la connexion"
                                className="w-full text-dark-text-muted hover:text-dark-text-secondary text-xs font-medium transition-colors mt-1"
                            >
                                ← Retour à la connexion
                            </button>
                        </form>
                    )}

                    {step === 'recovery' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 p-4 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20">
                                <Lock className="text-amber-400 shrink-0" size={22} />
                                <div>
                                    <p className="text-amber-400 font-semibold text-sm">Récupération d'accès</p>
                                    <p className="text-dark-text-muted text-xs mt-0.5">Étape {recStep}/2</p>
                                </div>
                            </div>

                            {recStep === 1 ? (
                                <form onSubmit={handleRecStep1} className="space-y-5">
                                    <div className="p-4 rounded-xl bg-dark-bg border border-dark-border">
                                        <p className="text-dark-text-secondary text-[10px] font-bold uppercase tracking-widest mb-1">Question de sécurité</p>
                                        <p className="text-dark-text font-bold text-sm italic">"{recQuestion}"</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-dark-text-secondary uppercase tracking-wider">Réponse OU Code d'urgence</label>
                                        <input
                                            type="text"
                                            value={recInput}
                                            onChange={(e) => setRecInput(e.target.value)}
                                            className="w-full bg-dark-bg border border-dark-border rounded-[var(--radius-md)] py-3 px-4 text-dark-text focus:outline-none focus:ring-2 focus:ring-amber-500/40 transition-all placeholder:text-dark-text-muted text-center font-mono"
                                            placeholder="Réponse ou XXXX-XXXX..."
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <button type="submit" title="Vérifier l'identité" className="w-full btn-primary py-3.5 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-black">
                                        Vérifier l'identité →
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleRecStep2} className="space-y-5">
                                    {/* Accessibility: hidden username field */}
                                    <div className="sr-only" aria-hidden="true">
                                        <input type="text" name="username" value={username} readOnly autoComplete="username" tabIndex={-1} />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-dark-text-secondary uppercase tracking-wider">Nouveau mot de passe</label>
                                        <input
                                            type="password"
                                            value={recNewPw}
                                            onChange={(e) => setRecNewPw(e.target.value)}
                                            className="w-full bg-dark-bg border border-dark-border rounded-[var(--radius-md)] py-3 px-4 text-dark-text focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-mono"
                                            placeholder="Minimum 8 caractères"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-dark-text-secondary uppercase tracking-wider italic">Confirmation : {recQuestion}</label>
                                        <input
                                            type="text"
                                            value={recSecAns}
                                            onChange={(e) => setRecSecAns(e.target.value)}
                                            className="w-full bg-dark-bg border border-dark-border rounded-[var(--radius-md)] py-3 px-4 text-dark-text focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all"
                                            placeholder="Réponse à la question"
                                            required
                                        />
                                    </div>
                                    <button type="submit" className="w-full btn-primary py-3.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-500 text-white">
                                        Réinitialiser l'accès
                                    </button>
                                </form>
                            )}

                            <button
                                type="button"
                                onClick={resetToCredentials}
                                className="w-full text-dark-text-muted hover:text-dark-text-secondary text-xs font-medium transition-colors mt-2"
                            >
                                ← Retour à la connexion
                            </button>
                        </div>
                    )}

                    <div className="mt-6 pt-5 border-t border-dark-border text-center">
                        <p className="text-dark-text-muted text-xs">
                            Plateforme centralisée d'électrification — GEM SaaS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
