/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, type FormEvent } from 'react';
import logger from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, ShieldCheck, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
import { PageContainer } from '../components';
import type { User as DBUser } from '../utils/types';

type LoginStep = 'credentials' | '2fa' | 'recovery';

function getApiErrorMessage(err: any, fallback: string) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const serverError = data?.error;
  const serverMessage = data?.message;
  const networkMessage = err?.message || '';

  if (status === 401) {
    return serverError || 'Identifiant, mot de passe ou réponse de sécurité incorrecte.';
  }

  if (status === 400) {
    return serverError || serverMessage || fallback;
  }

  if (status === 403) {
    return serverError || 'Accès refusé.';
  }

  if (status === 404) {
    return serverError || 'Compte introuvable.';
  }

  if (status === 503) {
    return (
      serverMessage ||
      "Backend ou base de données indisponible. Vérifiez que le serveur backend est bien démarré."
    );
  }

  if (!err?.response) {
    return 'Serveur backend indisponible. Vérifiez que `npm run dev:saas` est bien lancé.';
  }

  if (status === 500) {
    return serverMessage || serverError || 'Erreur serveur interne.';
  }

  return serverError || serverMessage || networkMessage || fallback;
}

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

  // Track renders in development (mount only - prevents excessive re-renders)
  const renderCount = useRef(0);
  renderCount.current++;

  const handleCredentials = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('auth/login', {
        email: username.trim(),
        password: password,
      });

      const { accessToken: token1, token: token2, user: userPayload } = response.data;
      const accessToken = token1 || token2;
      logger.debug('🔐 LOGIN RESPONSE DEBUG:', { userPayload, accessToken });
      const emailResp = userPayload?.email || '';
      const roleResp = userPayload?.role || '';
      const nameResp = userPayload?.name || '';
      const orgResp = userPayload?.organization;
      const orgConfigResp = userPayload?.organizationConfig;
      const idResp = userPayload?.id;
      const requires2FA = userPayload?.requires2FA;
      logger.debug('🔐 EXTRACTED FIELDS:', { emailResp, roleResp, nameResp, orgResp, idResp });

      if (requires2FA) {
        setPendingUser({
          email: emailResp,
          role: roleResp,
          name: nameResp,
          organization: orgResp,
          organizationConfig: orgConfigResp,
          id: idResp,
          requires2FA,
          accessToken,
        } as any);
        setStep('2fa');
        setError('Validation secondaire requise. Saisissez votre réponse de sécurité pour continuer.');
        setLoading(false);
        return;
      }

      login(
        emailResp,
        roleResp,
        nameResp,
        orgResp,
        idResp,
        accessToken,
        orgConfigResp,
        userPayload?.permissions
      );
      navigate('/dashboard');
    } catch (err: any) {
      logger.error('🔴 Login error:', err);
      setError(getApiErrorMessage(err, 'Identifiant ou mot de passe incorrect.'));
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
        answer: twoFAAnswer,
      });

      const { user, accessToken: token1, token: token2 } = data;
      const accessToken = token1 || token2;
      login(
        user.email,
        user.role,
        user.name,
        user.organization,
        user.id,
        accessToken,
        user.organizationConfig,
        user.permissions
      );
      navigate('/dashboard');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Réponse secrète incorrecte. Accès refusé.'));
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
    const email = username.trim() || prompt('Veuillez saisir votre email :');
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
        newPassword: recNewPw,
      });

      setRecoveryInfo(
        '✅ Mot de passe réinitialisé. Connectez-vous avec vos nouveaux identifiants.'
      );
      setStep('credentials');
      setPassword(''); // On vide l'ancien MDP
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Erreur lors de la réinitialisation.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer maxWidth="full" className="min-h-screen p-0 m-0">
      {/* Background - Wanekoo Solid Navy */}
      <div className="min-h-screen flex text-white bg-surface px-4 relative overflow-hidden font-inter">
        {/* Subtle depth accents */}
        <div className="absolute top-[10%] left-[20%] w-[30%] h-[30%] bg-primary/20 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[20%] right-[10%] w-[40%] h-[40%] bg-blue-600/10 blur-[180px] rounded-full pointer-events-none" />

        <div className="w-full max-w-5xl mx-auto flex items-center justify-center my-auto z-10">
          <div className="flex flex-col md:flex-row w-full bg-surface-alt rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-white/5 overflow-hidden">
            {/* Left Branding/Info Panel - Wanekoo Style */}
            <div className="hidden md:flex flex-col justify-between w-1/2 p-16 bg-gradient-to-br from-primary-deep via-primary to-primary-light text-white relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>

              <div className="relative z-10">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-[24px] bg-white/10 border border-white/20 mb-10 shadow-lg">
                  <ShieldCheck size={40} className="text-white drop-shadow-md" />
                </div>
                <h1 className="text-5xl lg:text-6xl font-black tracking-tighter mb-6 leading-none italic uppercase">
                  GEM<span className="text-blue-200">SAAS</span>
                </h1>
                <p className="text-lg text-blue-100/80 font-bold max-w-sm leading-relaxed">
                  Solution de pilotage terrain et de gestion stratégique pour projets d'envergure.
                </p>
              </div>

              <div className="relative z-10 flex items-center gap-6 text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mt-12">
                <span className="flex items-center gap-2">
                  <Lock size={14} /> SÉCURISÉ
                </span>
                <span className="flex items-center gap-2">•</span>
                <span className="flex items-center gap-2 text-white">
                  <Eye size={14} /> MULTI-TENANT 3.0
                </span>
              </div>
            </div>

            {/* Right Login Form Panel */}
            <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center relative">
              <div className="w-full max-w-sm mx-auto">
                <div className="md:hidden flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                    <ShieldCheck size={20} className="text-white" />
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">GEM SAAS</h2>
                </div>

                <h2 className="text-4xl font-black tracking-tighter text-white mb-2 italic">
                  {step === 'credentials' && 'Connexion'}
                  {step === '2fa' && 'Sécurité 2FA'}
                  {step === 'recovery' && 'Récupération'}
                </h2>
                <p className="text-blue-300/40 text-[11px] font-black uppercase tracking-[0.2em] mb-10">
                  {step === 'credentials' && 'Accédez à votre espace de travail sécurisé.'}
                  {step === '2fa' && 'Veuillez entrer votre code de vérification.'}
                  {step === 'recovery' && 'Réinitialisez votre accès.'}
                </p>

                {error && (
                  <div className="mb-6 p-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-bold text-red-600 dark:text-red-400 flex items-start gap-2">
                      <AlertCircle size={18} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </p>
                  </div>
                )}

                {recoveryInfo && (
                  <div className="mb-6 p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {recoveryInfo}
                    </p>
                  </div>
                )}

                {/* STEP: CREDENTIALS */}
                {step === 'credentials' && (
                  <form onSubmit={handleCredentials} className="space-y-5">
                    <div className="space-y-2">
                      <label
                        htmlFor="username"
                        className="text-[10px] font-black text-blue-300/30 uppercase tracking-[0.2em] ml-1"
                      >
                        Identifiant
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                          <User
                            size={18}
                            className="text-blue-800 group-focus-within:text-primary transition-colors"
                          />
                        </div>
                        <input
                          type="text"
                          required
                          name="username"
                          id="username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full pl-12 pr-4 py-5 rounded-2xl bg-white/5 border border-white/5 text-white placeholder-blue-600/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-bold tracking-tight"
                          placeholder="Votre identifiant"
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center ml-1">
                        <label
                          htmlFor="password"
                          className="text-[10px] font-black text-blue-300/30 uppercase tracking-[0.2em]"
                        >
                          Mot de passe
                        </label>
                        <button
                          type="button"
                          onClick={startRecovery}
                          className="text-[10px] font-black text-primary hover:text-white transition-colors tracking-widest uppercase italic"
                        >
                          Oublié ?
                        </button>
                      </div>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                          <Lock
                            size={18}
                            className="text-blue-800 group-focus-within:text-primary transition-colors"
                          />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          name="password"
                          id="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-12 pr-12 py-5 rounded-2xl bg-white/5 border border-white/5 text-white placeholder-blue-600/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:bg-white/10 transition-all font-bold tracking-tight"
                          placeholder="••••••••"
                          autoComplete="current-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                          aria-label={
                            showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                          }
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-5 mt-6 bg-primary hover:bg-primary-light active:scale-95 text-white rounded-2xl font-black text-xs uppercase tracking-[0.25em] shadow-2xl shadow-primary/20 transition-all disabled:opacity-70 flex justify-center items-center gap-3"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <LogIn size={18} strokeWidth={3} /> SE CONNECTER
                        </>
                      )}
                    </button>
                  </form>
                )}

                {/* STEP: 2FA */}
                {step === '2fa' && (
                  <form onSubmit={handle2FA} className="space-y-5">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                        Autentification Double Facteur
                      </label>
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <ShieldCheck
                            size={18}
                            className="text-slate-400 group-focus-within:text-purple-500 transition-colors"
                          />
                        </div>
                        <input
                          type="text"
                          required
                          name="twoFAAnswer"
                          id="twoFAAnswer"
                          value={twoFAAnswer}
                          onChange={(e) => setTwoFAAnswer(e.target.value)}
                          className="w-full pl-11 pr-4 py-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all font-medium"
                          placeholder="Entrez votre réponse secrète"
                          autoComplete="one-time-code"
                          autoFocus
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-bold text-sm uppercase tracking-widest shadow-lg shadow-purple-500/30 transition-all hover:-translate-y-0.5 disabled:opacity-70 flex justify-center items-center gap-2"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <ShieldCheck size={18} /> VÉRIFIER
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={resetToCredentials}
                        className="w-full py-4 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold text-sm uppercase tracking-widest transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}

                {/* STEP: RECOVERY */}
                {step === 'recovery' && (
                  <form
                    onSubmit={recStep === 1 ? handleRecStep1 : handleRecStep2}
                    className="space-y-5"
                  >
                    {recStep === 1 ? (
                      <>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                            Question de sécurité
                          </label>
                          <p className="text-sm text-slate-900 dark:text-white font-medium p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                            {recQuestion}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                            Votre réponse
                          </label>
                          <input
                            type="text"
                            required
                            name="securityAnswer"
                            id="securityAnswer"
                            value={recSecAns}
                            onChange={(e) => setRecSecAns(e.target.value)}
                            className="w-full px-4 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-medium"
                            placeholder="Saisissez votre réponse"
                            autoComplete="off"
                            autoFocus
                          />
                        </div>
                      </>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest ml-1">
                          Nouveau mot de passe
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Lock size={18} className="text-slate-400" />
                          </div>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            required
                            name="newPassword"
                            id="newPassword"
                            value={recNewPw}
                            onChange={(e) => setRecNewPw(e.target.value)}
                            className="w-full pl-11 pr-12 py-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-medium"
                            placeholder="8 caractères minimum"
                            minLength={8}
                            autoComplete="new-password"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                            aria-label="Afficher le mot de passe"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 mt-4">
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg transition-all hover:-translate-y-0.5 disabled:opacity-70 flex justify-center items-center"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : recStep === 1 ? (
                          'SUIVANT'
                        ) : (
                          'RÉINITIALISER'
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={resetToCredentials}
                        className="w-full py-4 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white font-bold text-sm uppercase tracking-widest transition-colors"
                      >
                        Retour à la connexion
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
