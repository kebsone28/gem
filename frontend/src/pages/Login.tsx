/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useRef, type FormEvent } from 'react';
import logger from '../utils/logger';
import { useNavigate } from 'react-router-dom';
import { LogIn, User, Lock, ShieldCheck, Eye, EyeOff, AlertCircle, ChevronLeft } from 'lucide-react';
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
    return serverError || 'Identifiant ou mot de passe incorrect.';
  }
  if (status === 503) {
    return serverMessage || "Serveur indisponible.";
  }
  if (!err?.response) {
    return 'Serveur backend injoignable.';
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
  const [recSecAns, setRecSecAns] = useState('');
  const [recNewPw, setRecNewPw] = useState('');
  const [recoveryInfo, setRecoveryInfo] = useState('');

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
      const emailResp = userPayload?.email || '';
      const roleResp = userPayload?.role || '';
      const nameResp = userPayload?.name || '';
      const orgResp = userPayload?.organization;
      const orgConfigResp = userPayload?.organizationConfig;
      const idResp = userPayload?.id;
      const requires2FA = userPayload?.requires2FA;

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
        setError('Validation secondaire requise.');
        setLoading(false);
        return;
      }

      login(emailResp, roleResp, nameResp, orgResp, idResp, accessToken, orgConfigResp, userPayload?.permissions);
      navigate('/dashboard');
    } catch (err: any) {
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
      login(user.email, user.role, user.name, user.organization, user.id, accessToken, user.organizationConfig, user.permissions);
      navigate('/dashboard');
    } catch (err: any) {
      setError('Réponse de sécurité incorrecte.');
    } finally {
      setLoading(false);
    }
  };

  const startRecovery = () => {
    const email = username.trim() || prompt('Veuillez saisir votre email :');
    if (!email) return;
    setRecInput(email);
    setStep('recovery');
    setRecStep(1);
    setError('');
  };

  const handleRecStep2 = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await apiClient.post('auth/reset-password', {
        email: recInput,
        securityAnswer: recSecAns,
        newPassword: recNewPw,
      });
      setRecoveryInfo('Mot de passe réinitialisé.');
      setStep('credentials');
    } catch (err: any) {
      setError('Échec de la réinitialisation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer maxWidth="full" className="min-h-screen p-0 m-0 overflow-hidden bg-slate-950 font-outfit">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none" />
      </div>

      <div className="relative z-10 flex items-center justify-center min-h-screen px-4 py-12">
        <div className="w-full max-w-[900px] flex flex-col md:flex-row bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] border border-white/5 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-700">
          
          {/* Left Panel: Branding */}
          <div className="hidden md:flex flex-col justify-between w-[40%] p-12 bg-gradient-to-br from-indigo-600/20 to-transparent border-r border-white/5">
            <div>
              <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center border border-indigo-500/30 mb-8 shadow-inner">
                <ShieldCheck size={24} className="text-indigo-400" />
              </div>
              <h1 className="text-4xl font-black tracking-tighter text-white mb-4 italic leading-tight uppercase">
                GEM<span className="text-indigo-500">SAAS</span>
              </h1>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-widest leading-relaxed max-w-[200px]">
                Plateforme intelligente de pilotage opérationnel terrain.
              </p>
            </div>

            <div className="space-y-4">
              <div className="h-[1px] w-full bg-gradient-to-r from-white/10 to-transparent" />
              <div className="flex items-center gap-4 text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
                <span>Vers. 3.0.4</span>
                <span className="w-1 h-1 bg-indigo-500 rounded-full" />
                <span>Sécurisé TLS 1.3</span>
              </div>
            </div>
          </div>

          {/* Right Panel: Form */}
          <div className="flex-1 p-8 md:p-14 flex flex-col justify-center">
            <div className="max-w-[340px] mx-auto w-full">
              
              {/* Step Title */}
              <div className="mb-10 text-center md:text-left">
                <h2 className="text-2xl font-black text-white tracking-tight italic mb-2 uppercase">
                  {step === 'credentials' ? 'Connexion' : step === '2fa' ? 'Sécurité' : 'Récupération'}
                </h2>
                <div className="h-1 w-12 bg-indigo-500 rounded-full mx-auto md:mx-0" />
              </div>

              {error && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in slide-in-from-top-2">
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span className="text-[11px] font-bold text-rose-300">{error}</span>
                </div>
              )}

              {recoveryInfo && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in slide-in-from-top-2">
                  <span className="text-[11px] font-bold text-emerald-300">{recoveryInfo}</span>
                </div>
              )}

              {/* Form Step: Credentials */}
              {step === 'credentials' && (
                <form onSubmit={handleCredentials} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Identifiant</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User size={16} className="text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                      </div>
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-slate-950/40 border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                        placeholder="admin@proquelec.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mot de passe</label>
                      <button type="button" onClick={startRecovery} className="text-[9px] font-black text-indigo-400/60 hover:text-indigo-400 uppercase tracking-widest transition-colors">Perdu ?</button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock size={16} className="text-slate-600 group-focus-within:text-indigo-400 transition-colors" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-950/40 border border-white/5 rounded-2xl pl-11 pr-12 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-600 hover:text-indigo-400 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-2xl font-black text-[11px] uppercase tracking-[0.25em] shadow-xl shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>ACCÉDER <LogIn size={14} /></>
                    )}
                  </button>
                </form>
              )}

              {/* Other steps simplified for brevity but styled same way */}
              {step === '2fa' && (
                <form onSubmit={handle2FA} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Réponse de sécurité</label>
                    <input
                      type="text"
                      required
                      value={twoFAAnswer}
                      onChange={(e) => setTwoFAAnswer(e.target.value)}
                      autoFocus
                      className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white outline-none focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>
                  <button type="submit" disabled={loading} className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all">
                    VÉRIFIER
                  </button>
                  <button type="button" onClick={() => setStep('credentials')} className="w-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                    <ChevronLeft size={14} /> Retour
                  </button>
                </form>
              )}

              {step === 'recovery' && (
                <form onSubmit={handleRecStep2} className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                   {recStep === 1 ? (
                     <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Réponse de sécurité</label>
                        <input
                          type="text"
                          required
                          value={recSecAns}
                          onChange={(e) => setRecSecAns(e.target.value)}
                          className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white outline-none focus:border-indigo-500/40 transition-all"
                        />
                        <button type="button" onClick={() => setRecStep(2)} className="w-full py-4.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest mt-4">SUIVANT</button>
                     </div>
                   ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Nouveau mot de passe</label>
                        <input
                          type="password"
                          required
                          value={recNewPw}
                          onChange={(e) => setRecNewPw(e.target.value)}
                          className="w-full bg-slate-950/40 border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white outline-none focus:border-indigo-500/40 transition-all"
                        />
                      </div>
                      <button type="submit" disabled={loading} className="w-full py-4.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest">RÉINITIALISER</button>
                    </div>
                   )}
                   <button type="button" onClick={() => setStep('credentials')} className="w-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                    <ChevronLeft size={14} /> Retour
                  </button>
                </form>
              )}

            </div>
          </div>
        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center opacity-30">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">
          Powered by PROQUELEC GEM Systems
        </p>
      </div>
    </PageContainer>
  );
}
