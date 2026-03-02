import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Building2, User, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';
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

        // Simulate network delay
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

        // No 2FA needed — log in directly
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
        <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/4 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-3xl" />
            </div>

            <div className="max-w-md w-full relative z-10">
                {/* Logo card */}
                <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl shadow-black/40 p-8 border border-slate-800">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-20 h-20 mb-4 rounded-2xl shadow-lg shadow-indigo-500/20 overflow-hidden bg-indigo-600">
                            <img
                                src="/logo-proquelec.png"
                                alt="PROQUELEC"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                            <Building2 className="text-white w-10 h-10 hidden" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tight">PROQUELEC</h1>
                        <p className="text-slate-400 mt-1 text-sm font-medium">Plateforme SaaS d'Électrification</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/40 text-red-400 p-3 rounded-xl text-sm mb-6 text-center font-medium flex items-center justify-center gap-2">
                            <span className="text-red-400">⚠</span> {error}
                        </div>
                    )}

                    {/* STEP 1: Credentials */}
                    {step === 'credentials' && (
                        <form onSubmit={handleCredentials} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nom d'utilisateur</label>
                                <div className="relative">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type="text"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                                        placeholder="ex: maçongem"
                                        autoComplete="username"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Mot de passe</label>
                                <div className="relative">
                                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3 pl-10 pr-12 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-600"
                                        placeholder="••••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        title="Afficher/Masquer le mot de passe"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 mt-2"
                            >
                                {loading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <><LogIn size={18} /> Se connecter</>
                                )}
                            </button>
                        </form>
                    )}

                    {/* STEP 2: 2FA for Admin */}
                    {step === '2fa' && pendingUser && (
                        <form onSubmit={handle2FA} className="space-y-5">
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 mb-2">
                                <ShieldCheck className="text-indigo-400 shrink-0" size={22} />
                                <div>
                                    <p className="text-indigo-300 font-black text-sm">Double authentification</p>
                                    <p className="text-slate-400 text-xs mt-0.5">Compte administrateur détecté.</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                    {pendingUser.secret2FAQuestion}
                                </label>
                                <input
                                    type="password"
                                    value={twoFAAnswer}
                                    onChange={(e) => setTwoFAAnswer(e.target.value)}
                                    className="w-full bg-slate-950 border border-indigo-500/40 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600 text-center font-black tracking-widest text-lg"
                                    placeholder="Votre réponse..."
                                    autoFocus
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2"
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
                                className="w-full text-slate-500 hover:text-slate-300 text-xs font-bold transition-colors mt-1"
                            >
                                ← Retour à la connexion
                            </button>
                        </form>
                    )}

                    <div className="mt-6 pt-5 border-t border-slate-800 text-center">
                        <p className="text-slate-600 text-xs">
                            Plateforme centralisée d'électrification massive — GEM SaaS
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
