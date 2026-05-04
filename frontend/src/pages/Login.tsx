/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  User, 
  Lock, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowRight,
  Loader2,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../api/client';
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

  // -- Advanced Animation Logic (Framer Motion) --
  const mouseX = useMotionValue(window.innerWidth / 2);
  const mouseY = useMotionValue(window.innerHeight / 2);

  // Smooth springs for parallax
  const springConfig = { damping: 30, stiffness: 100 };
  const smoothX = useSpring(mouseX, springConfig);
  const smoothY = useSpring(mouseY, springConfig);

  // Background Parallax Transforms
  const watermarkX = useTransform(smoothX, [0, window.innerWidth], [-15, 15]);
  const watermarkY = useTransform(smoothY, [0, window.innerHeight], [-15, 15]);
  const gridX = useTransform(smoothX, [0, window.innerWidth], [-30, 30]);
  const gridY = useTransform(smoothY, [0, window.innerHeight], [-30, 30]);
  const haloX = useTransform(smoothX, [0, window.innerWidth], [-80, 80]);
  const haloY = useTransform(smoothY, [0, window.innerHeight], [-80, 80]);

  const handleMouseMove = (e: React.MouseEvent) => {
    mouseX.set(e.clientX);
    mouseY.set(e.clientY);
  };

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
    <div 
      onMouseMove={handleMouseMove}
      className="fixed inset-0 w-full h-full overflow-hidden bg-[#020617] font-outfit z-0"
    >
      {/* 0. DYNAMIC MOUSE SPOTLIGHT (Ultra-Premium Follower) */}
      <motion.div 
        style={{ 
          x: smoothX, 
          y: smoothY,
          translateX: '-50%',
          translateY: '-50%'
        }}
        className="pointer-events-none absolute z-10 w-[600px] h-[600px] bg-indigo-500/[0.08] blur-[120px] rounded-full pointer-events-none transition-opacity duration-500"
      />

      {/* 1. INTERACTIVE PARALLAX BACKGROUND */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {/* Parallax Halo (Deep layer) */}
        <motion.div 
          style={{ x: haloX, y: haloY }}
          className="absolute inset-0 flex items-center justify-center opacity-20"
        >
          <div className="w-[1000px] h-[1000px] bg-indigo-600/5 blur-[150px] rounded-full" />
        </motion.div>

        {/* Parallax Tech Grid */}
        <motion.div 
          style={{ 
            backgroundImage: 'radial-gradient(circle, rgba(99, 102, 241, 0.2) 1px, transparent 1px)', 
            backgroundSize: '40px 40px',
            x: gridX,
            y: gridY
          }} 
          className="absolute inset-[-10%] opacity-[0.12]" 
        />
        
        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden">
           {[...Array(15)].map((_, i) => (
             <motion.div 
               key={i}
               initial={{ opacity: 0 }}
               animate={{ opacity: [0, 1, 0] }}
               transition={{ duration: 5 + Math.random() * 5, repeat: Infinity, delay: Math.random() * 5 }}
               className="absolute bg-indigo-400/20 rounded-full blur-[1px]"
               style={{
                 width: Math.random() * 3 + 1 + 'px',
                 height: Math.random() * 3 + 1 + 'px',
                 top: Math.random() * 100 + '%',
                 left: Math.random() * 100 + '%',
                 animationDuration: Math.random() * 10 + 15 + 's',
               }}
             />
           ))}
        </div>

        {/* Giant Parallax Watermark */}
        <motion.div 
          style={{ x: watermarkX, y: watermarkY }}
          className="absolute inset-0 flex flex-col items-center justify-center select-none overflow-hidden"
        >
          <h2 className="text-[14vw] font-black leading-none uppercase tracking-tighter text-center bg-gradient-to-b from-white/[0.06] to-transparent bg-clip-text text-transparent">
            SÉCURITÉ<br />ÉLECTRIQUE
          </h2>
          <motion.p 
            animate={{ opacity: [0.03, 0.08, 0.03] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-[1.5vw] font-black text-indigo-500 tracking-[1.5em] uppercase mt-8"
          >
            Expertise Terrain
          </motion.p>
        </motion.div>
        
        {/* Interlaced Mesh */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.20] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <motion.path 
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
            d="M-100,300 C200,100 800,500 1200,200 T2200,400" 
            fill="none" 
            stroke="rgba(99, 102, 241, 0.4)" 
            strokeWidth="1" 
          />
        </svg>

        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-blue-600/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        {/* Integrated Safety Mission Phrase (Subtle but readable) */}
        <div className="mb-12 text-center animate-in fade-in slide-in-from-bottom-4 duration-1000">
          <p className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.6em] mb-3">Manifeste Opérationnel</p>
          <p className="text-sm sm:text-lg font-light text-slate-300 italic tracking-wide max-w-2xl px-6">
            "L'expertise de la <span className="text-white font-bold not-italic">sécurité électrique</span>, l'accessibilité d'une solution <span className="text-indigo-400 font-bold not-italic">universelle</span>."
          </p>
        </div>

        {/* 3. THE MAIN LOGIN CARD */}
        <motion.div 
          animate={error ? { x: [-2, 2, -2, 2, 0] } : {}}
          transition={{ duration: 0.4 }}
          className="w-full max-w-[940px] flex flex-col md:flex-row bg-white/[0.01] backdrop-blur-3xl rounded-[3rem] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative group"
        >
          {/* SCANNER EFFECT (Visible when loading) */}
          <AnimatePresence>
            {loading && (
              <motion.div 
                initial={{ top: "-100%" }}
                animate={{ top: "100%" }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="absolute left-0 w-full h-1/2 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent z-40 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Glass Shine Animation */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <motion.div 
            animate={{ left: ["-100%", "200%"] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 w-full h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -skew-x-12" 
          />
          
          {/* Left Panel: Branding (Fixed & Premium) */}
          <div className="hidden md:flex flex-col justify-between w-[38%] p-14 bg-indigo-500/[0.01] border-r border-white/10 relative overflow-hidden">
            <div className="relative z-10">
              {/* SHIELD PULSE */}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="relative w-14 h-14 bg-indigo-500/10 rounded-2xl flex items-center justify-center border border-indigo-500/20 mb-10 group"
              >
                <motion.div 
                  animate={{ scale: [1, 1.4, 1], opacity: [0.2, 0, 0.2] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-indigo-500 rounded-2xl blur-md"
                />
                <ShieldCheck size={28} className="text-indigo-400 relative z-10" />
              </motion.div>

              {/* LOGO GLITCH EFFECT ON HOVER */}
              <motion.div 
                whileHover="hover"
                className="relative cursor-default"
              >
                <motion.h1 
                  variants={{
                    hover: { x: [-1, 1, -1, 0], textShadow: "2px 0 #6366f1, -2px 0 #3b82f6" }
                  }}
                  className="text-5xl font-black tracking-tighter text-white mb-6 italic leading-tight uppercase select-none"
                >
                  GEM<span className="text-indigo-500">SAAS</span>
                </motion.h1>
              </motion.div>

              <div className="h-1 w-12 bg-indigo-500 rounded-full mb-6" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                Pilotage Stratégique &<br />Intelligence Terrain
              </p>
            </div>

            <div className="relative z-10 pt-10">
              <div className="flex items-center gap-4 text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">
                <span className="text-indigo-500/50">V.3.0</span>
                <span className="w-1 h-1 bg-slate-800 rounded-full" />
                <span>Encrypted Node</span>
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
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
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
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-11 pr-12 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
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

                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: "0 0 25px rgba(99, 102, 241, 0.4)" }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-4.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4 group relative overflow-hidden border-t border-white/20"
                  >
                    {/* Animated Shine Sweep */}
                    <motion.div 
                      animate={{ left: ["-100%", "200%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                      className="absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12" 
                    />

                    {loading ? (
                      <Loader2 size={20} className="animate-spin text-white" />
                    ) : (
                      <>
                        <span className="relative z-10 drop-shadow-md">Accéder au Système</span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform relative z-10" />
                      </>
                    )}
                  </motion.button>
                </form>
              )}

              {/* 2FA Step */}
              {step === '2fa' && (
                <motion.form 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handle2FA} 
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Réponse de sécurité</label>
                    <input
                      type="text"
                      required
                      value={twoFAAnswer}
                      onChange={(e) => setTwoFAAnswer(e.target.value)}
                      autoFocus
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white outline-none focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                  </div>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    disabled={loading} 
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin mx-auto text-white" /> : 'VÉRIFIER'}
                  </motion.button>
                  <button type="button" onClick={() => setStep('credentials')} className="w-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                    <ChevronLeft size={14} /> Retour
                  </button>
                </motion.form>
              )}

              {step === 'recovery' && (
                <motion.form 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  onSubmit={handleRecStep2} 
                  className="space-y-6"
                >
                   {recStep === 1 ? (
                     <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Réponse de sécurité</label>
                          <input
                            type="text"
                            required
                            value={recSecAns}
                            onChange={(e) => setRecSecAns(e.target.value)}
                            className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white outline-none focus:border-indigo-500/40 transition-all"
                          />
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          type="button" 
                          onClick={() => setRecStep(2)} 
                          className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
                        >
                          SUIVANT
                        </motion.button>
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
                          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white outline-none focus:border-indigo-500/40 transition-all"
                        />
                      </div>
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit" 
                        disabled={loading} 
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
                      >
                        {loading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'RÉINITIALISER'}
                      </motion.button>
                    </div>
                   )}
                   <button type="button" onClick={() => setStep('credentials')} className="w-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors">
                    <ChevronLeft size={14} /> Retour
                  </button>
                </motion.form>
              )}

            </div>
          </div>
        </motion.div>
      </div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-8 left-0 right-0 z-10 flex justify-center opacity-30">
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">
          Powered by PROQUELEC GEM Systems
        </p>
      </div>
    </div>
  );
}
