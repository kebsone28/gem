import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Building2, User, Lock, ShieldCheck, Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authenticateMock, verify2FA, type MockUser } from '../utils/mockUsers';

type LoginStep = 'credentials' | '2fa';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFAAnswer, setTwoFAAnswer] = useState('');
    const [step, setStep] = useState<LoginStep>('credentials');
    const [pendingUser, setPendingUser] = useState<MockUser | null>(null);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleCredentials = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        await new Promise(resolve => setTimeout(resolve, 600));
        const user = authenticateMock(username, password);
        if (!user) {
            setError('Identifiant ou mot de passe incorrect.');
            setLoading(false);
            return;
        }
        if (user.requires2FA) {
            setPendingUser(user);
            setStep('2fa');
            setLoading(false);
            return;
        }
        login(user.username, user.role, user.name, user.teamId);
        navigate('/dashboard');
        setLoading(false);
    };

    const handle2FA = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!pendingUser || !verify2FA(pendingUser, twoFAAnswer)) {
            setError('Réponse secrète incorrecte. Accès refusé.');
            setLoading(false);
            return;
        }
        login(pendingUser.username, pendingUser.role, pendingUser.name, pendingUser.teamId);
        navigate('/dashboard');
        setLoading(false);
    };

    const resetToCredentials = () => {
        setStep('credentials');
        setPendingUser(null);
        setTwoFAAnswer('');
        setError('');
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-dark-bg px-4 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full blur-[120px] opacity-20 gradient-primary" />
                <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[100px] opacity-10 bg-accent" />
                {/* Grid pattern */}
                <div className="absolute inset-0" style={{
                    backgroundImage: `linear-gradient(oklch(0.30 0.02 250 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(0.30 0.02 250 / 0.15) 1px, transparent 1px)`,
                    backgroundSize: '60px 60px'
                }} />
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
                            <Zap className="text-white w-8 h-8 hidden" />
                        </div>
                        <h1 className="text-2xl font-bold text-dark-text tracking-tight">PROQUELEC</h1>
                        <p className="text-dark-text-muted mt-1 text-sm">Plateforme d'Électrification de Masse</p>
                    </div>

                    {error && (
                        <div className="bg-danger/10 border border-danger/30 text-danger p-3 rounded-[var(--radius-md)] text-sm mb-6 text-center font-medium">
                            {error}
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
                                        title="Afficher/Masquer"
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
                                className="w-full btn-primary py-3.5 text-sm flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><LogIn size={18} /> Se connecter</>
                                )}
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

                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-dark-text-secondary uppercase tracking-wider">
                                    {pendingUser.secret2FAQuestion}
                                </label>
                                <input
                                    type="password"
                                    value={twoFAAnswer}
                                    onChange={(e) => setTwoFAAnswer(e.target.value)}
                                    className="w-full bg-dark-bg border border-primary/30 rounded-[var(--radius-md)] py-3 px-4 text-dark-text focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:text-dark-text-muted text-center font-bold tracking-widest text-lg"
                                    placeholder="Votre réponse..."
                                    autoFocus
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
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
                                className="w-full text-dark-text-muted hover:text-dark-text-secondary text-xs font-medium transition-colors mt-1"
                            >
                                ← Retour à la connexion
                            </button>
                        </form>
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
