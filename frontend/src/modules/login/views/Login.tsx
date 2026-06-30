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
  ChevronLeft,
  Zap,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion';
import { useAuth } from '@contexts/AuthContext';
import apiClient from '@/api/client';
import { normalizeRole, ROLES as AppRole } from '@core/security/permissions';
import type { User as DBUser } from '@utils/types';

type LoginStep = 'sector-select' | 'credentials' | '2fa' | 'recovery';

const hasSectorAccess = (userPayload: any, sectorKey: string) => {
  if (!sectorKey) return true;
  const roleNormalized = normalizeRole(userPayload?.role || '');
  const isAdmin = userPayload?.isPlatformAdmin || roleNormalized === AppRole.ADMIN || roleNormalized === AppRole.PLATFORM_ADMIN;
  if (isAdmin) return true;
  
  const userPermissions = userPayload?.permissions || [];
  const requiredPermission = `sector.${sectorKey}`;
  return userPermissions.includes(requiredPermission);
};

const SECTORS = [
  {
    key: 'gem',
    label: 'GEM',
    role: "Electrification Massive",
    description: 'Suivi terrain, raccordements, menages, logistique et pilotage.',
    note: 'Choix du secteur, pas du projet',
    icon: Zap,
    gradient: 'from-amber-500/20 via-orange-500/10 to-slate-950',
    accent: 'from-amber-400 to-orange-500',
    borderColor: 'border-amber-400/20 hover:border-amber-300/50',
    iconColor: 'text-amber-300',
    badgeClass: 'bg-amber-400/10 text-amber-200 border-amber-300/20',
    glowClass: 'bg-amber-500/20',
  },
  {
    key: 'mes',
    label: 'MES',
    role: 'Mise En Service',
    description: 'Branchement, pose compteur, contrôle qualité et validation.',
    note: 'Choix du secteur, pas du projet',
    icon: Activity,
    gradient: 'from-sky-500/20 via-indigo-500/10 to-slate-950',
    accent: 'from-sky-400 to-indigo-500',
    borderColor: 'border-sky-400/20 hover:border-sky-300/50',
    iconColor: 'text-sky-300',
    badgeClass: 'bg-sky-400/10 text-sky-200 border-sky-300/20',
    glowClass: 'bg-sky-500/20',
  },
];

const getSectorLandingPath = (sectorKey?: string) =>
  sectorKey ? `/projects?domainType=${encodeURIComponent(sectorKey)}` : '/projects';

// Positions stables des particules (calculées une seule fois au chargement du module)
const PARTICLE_POSITIONS = Array.from({ length: 15 }, () => ({
  width: Math.random() * 3 + 1,
  height: Math.random() * 3 + 1,
  top: Math.random() * 100,
  left: Math.random() * 100,
  animationDuration: Math.random() * 10 + 15,
  duration: 5 + Math.random() * 5,
  delay: Math.random() * 5,
}));

function getApiErrorMessage(err: any, fallback: string) {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const serverError = data?.error;
  const serverMessage = data?.message;
  const networkMessage = err?.message || '';

  const getMessageFromError = (errorVal: any): string | null => {
    if (!errorVal) return null;
    if (typeof errorVal === 'string') return errorVal;
    if (typeof errorVal === 'object') {
      if (errorVal.message) return errorVal.message;
      if (Array.isArray(errorVal.errors) && errorVal.errors.length > 0) {
        return errorVal.errors.join(', ');
      }
    }
    return null;
  };

  const extractedError = getMessageFromError(serverError);

  if (status === 401) {
    return extractedError || 'Identifiant ou mot de passe incorrect.';
  }
  if (status === 503) {
    return serverMessage || 'Serveur indisponible.';
  }
  if (!err?.response) {
    return 'Serveur backend injoignable.';
  }
  return extractedError || serverMessage || networkMessage || fallback;
}


export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [twoFAAnswer, setTwoFAAnswer] = useState('');
  const [step, setStep] = useState<LoginStep>('sector-select');
  const [selectedSector, setSelectedSector] = useState<any>(null);
  const [pendingUser, setPendingUser] = useState<DBUser | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailChange = (value: string) => {
    setUsername(value);
    if (value && !EMAIL_REGEX.test(value)) {
      setEmailError('Format d\'email invalide');
    } else {
      setEmailError('');
    }
  };

  const getPasswordStrength = (pw: string): { label: string; color: string; width: string } => {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    const levels = [
      { label: 'Très faible', color: 'bg-red-500', width: 'w-1/5' },
      { label: 'Faible', color: 'bg-orange-500', width: 'w-2/5' },
      { label: 'Moyen', color: 'bg-yellow-500', width: 'w-3/5' },
      { label: 'Fort', color: 'bg-lime-500', width: 'w-4/5' },
      { label: 'Très fort', color: 'bg-emerald-500', width: 'w-full' },
    ];
    return levels[Math.min(score, 4)];
  };

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

      const { user: userPayload } = response.data;
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
        } as any);
        setStep('2fa');
        setInfo('Une validation de sécurité supplémentaire est requise.');
        setLoading(false);
        return;
      }

      if (selectedSector && !hasSectorAccess(userPayload, selectedSector.key)) {
        setError(`Vous n'avez pas l'autorisation d'accéder au secteur "${selectedSector.label}".`);
        setLoading(false);
        return;
      }

      if (selectedSector) {
        localStorage.setItem('selectedSector', selectedSector.key);
      } else {
        localStorage.removeItem('selectedSector');
      }

      login(
        emailResp,
        roleResp,
        nameResp,
        orgResp,
        idResp,
        orgConfigResp,
        userPayload?.permissions,
        userPayload?.organizationId,  // ✅ Pass org UUID so ProjectContext can load projects
      );
      navigate(getSectorLandingPath(selectedSector?.key));
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
    setInfo(null);

    try {
      const { data } = await apiClient.post('auth/verify-2fa', {
        email: pendingUser.email,
        answer: twoFAAnswer,
      });
      const { user } = data;

      if (selectedSector && !hasSectorAccess(user, selectedSector.key)) {
        setError(`Vous n'avez pas l'autorisation d'accéder au secteur "${selectedSector.label}".`);
        setLoading(false);
        return;
      }

      if (selectedSector) {
        localStorage.setItem('selectedSector', selectedSector.key);
      } else {
        localStorage.removeItem('selectedSector');
      }

      login(
        user.email,
        user.role,
        user.name,
        user.organization,
        user.id,
        user.organizationConfig,
        user.permissions,
        user.organizationId,  // ✅ Pass org UUID from 2FA response
      );
      navigate(getSectorLandingPath(selectedSector?.key));
    } catch {
      setError('Réponse de sécurité incorrecte.');
    } finally {
      setLoading(false);
    }
  };

  const startRecovery = () => {
    const email = username.trim();
    if (!email) {
      setError("Veuillez d'abord saisir votre email dans le champ identifiant.");
      return;
    }
    setRecInput(email);
    setStep('recovery');
    setRecStep(1);
    setError('');
    setInfo(null);
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
    } catch {
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
          translateY: '-50%',
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
            backgroundImage:
              'radial-gradient(circle, rgba(99, 102, 241, 0.2) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            x: gridX,
            y: gridY,
          }}
          className="absolute inset-[-10%] opacity-[0.12]"
        />

        {/* Floating Particles */}
        <div className="absolute inset-0 overflow-hidden">
          {PARTICLE_POSITIONS.map((pos, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ duration: pos.duration, repeat: Infinity, delay: pos.delay }}
              className="absolute bg-indigo-400/20 rounded-full blur-[1px]"
              style={{
                width: `${pos.width}px`,
                height: `${pos.height}px`,
                top: `${pos.top}%`,
                left: `${pos.left}%`,
                animationDuration: `${pos.animationDuration}s`,
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
            SÉCURITÉ
            <br />
            ÉLECTRIQUE
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
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.20] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <motion.path
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 2, ease: 'easeInOut' }}
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
          <p className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.6em] mb-3">
            Manifeste Opérationnel
          </p>
          <p className="text-sm sm:text-lg font-light text-slate-300 italic tracking-wide max-w-2xl px-6">
            "L'expertise de la{' '}
            <span className="text-white font-bold not-italic">sécurité électrique</span>,
            l'accessibilité d'une solution{' '}
            <span className="text-indigo-400 font-bold not-italic">universelle</span>."
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
                initial={{ top: '-100%' }}
                animate={{ top: '100%' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                className="absolute left-0 w-full h-1/2 bg-gradient-to-b from-transparent via-indigo-500/10 to-transparent z-40 pointer-events-none"
              />
            )}
          </AnimatePresence>

          {/* Glass Shine Animation */}
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <motion.div
            animate={{ left: ['-100%', '200%'] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
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
              <motion.div whileHover="hover" className="relative cursor-default">
                <motion.h1
                  variants={{
                    hover: { x: [-1, 1, -1, 0], textShadow: '2px 0 #6366f1, -2px 0 #3b82f6' },
                  }}
                  className="text-5xl font-black tracking-tighter text-white mb-6 italic leading-tight uppercase select-none"
                >
                  GED <span className="text-indigo-500">OS</span>
                </motion.h1>
              </motion.div>

              <div className="h-1 w-12 bg-indigo-500 rounded-full mb-6" />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                Pilotage Stratégique &<br />
                Intelligence Terrain
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
          <div className="flex-1 p-6 md:p-10 flex flex-col justify-center overflow-y-auto max-h-[85vh] md:max-h-none">
            <div className={`${step === 'sector-select' ? 'max-w-[620px]' : 'max-w-[340px]'} mx-auto w-full transition-all duration-300`}>
              {/* Step Title */}
              <div className="mb-6 text-center md:text-left">
                <h2 className="text-xl font-black text-white tracking-tight italic mb-2 uppercase">
                  {step === 'sector-select'
                    ? "Choisissez un secteur d'activite"
                    : step === 'credentials'
                      ? `Connexion - Secteur ${selectedSector?.label || ''}`
                      : step === '2fa'
                        ? 'Sécurité'
                        : 'Récupération'}
                </h2>
                <div className="h-1 w-12 bg-indigo-500 rounded-full mx-auto md:mx-0" />
                {step === 'sector-select' && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-400 max-w-2xl">
                    Le secteur definit votre espace metier `GEM` ou `MES`. Le choix du projet se fera ensuite dans l'accueil.
                  </p>
                )}
              </div>

              {error && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl animate-in slide-in-from-top-2">
                  <AlertCircle size={16} className="text-rose-400 shrink-0" />
                  <span className="text-[11px] font-bold text-rose-300">{error}</span>
                </div>
              )}

              {info && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl animate-in slide-in-from-top-2">
                  <ShieldCheck size={16} className="text-indigo-400 shrink-0" />
                  <span className="text-[11px] font-bold text-indigo-300">{info}</span>
                </div>
              )}

              {recoveryInfo && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl animate-in slide-in-from-top-2">
                  <span className="text-[11px] font-bold text-emerald-300">{recoveryInfo}</span>
                </div>
              )}

              {/* Sector Selection Grid */}
              {step === 'sector-select' && (
                <div className="space-y-5 animate-in fade-in duration-500">
                  <div className="rounded-[2rem] border border-white/8 bg-white/[0.03] p-4 md:p-5">
                    <div className="flex items-center justify-between gap-4 border-b border-white/6 pb-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                          Portes d'entree
                        </p>
                        <h3 className="mt-2 text-lg font-black text-white">
                          Deux univers, un meme socle GED OS
                        </h3>
                      </div>
                      <div className="hidden md:flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">
                        Secteur puis projet
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SECTORS.map((sector) => {
                      const IconComponent = sector.icon;
                      return (
                        <motion.button
                          key={sector.key}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => {
                            setSelectedSector(sector);
                            setStep('credentials');
                          }}
                          className={`group relative overflow-hidden rounded-[1.75rem] border bg-gradient-to-br ${sector.gradient} ${sector.borderColor} p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl`}
                        >
                          <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full blur-3xl transition-opacity duration-300 group-hover:opacity-80 ${sector.glowClass}`} />
                          <div className="relative z-10 flex h-full flex-col">
                            <div className="flex items-start justify-between gap-3">
                              <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] ${sector.badgeClass}`}>
                                <IconComponent size={14} className={sector.iconColor} />
                                {sector.label}
                              </div>
                              <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] ${sector.iconColor}`}>
                                <IconComponent size={18} />
                              </div>
                            </div>
                            <div className="mt-8">
                              <h3 className="text-2xl font-black tracking-tight text-white">
                                {sector.label}
                              </h3>
                              <p className="mt-2 text-sm font-bold text-slate-200">
                                {sector.role}
                              </p>
                              <p className="mt-3 max-w-xs text-xs leading-relaxed text-slate-400">
                                {sector.description}
                              </p>
                            </div>
                            <div className="mt-6 flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                                {sector.note}
                              </span>
                              <div className={`h-1.5 w-16 rounded-full bg-gradient-to-r ${sector.accent}`} />
                            </div>
                          </div>
                        </motion.button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Step: Credentials */}
              {step === 'credentials' && (
                <form onSubmit={handleCredentials} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Identifiant
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <User
                          size={16}
                          className="text-slate-600 group-focus-within:text-indigo-400 transition-colors"
                        />
                      </div>
                      <input
                        id="login-username"
                        aria-label="Identifiant"
                        type="email"
                        required
                        value={username}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className="w-full bg-white/[0.03] border border-white/5 rounded-2xl pl-11 pr-4 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all outline-none"
                        placeholder="oumarkebe@proquelec.sn"
                        autoComplete="email"
                      />
                      {emailError && (
                        <p className="text-[10px] text-red-400 font-bold mt-1 ml-1">{emailError}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center px-1">
                      <label
                        htmlFor="login-password"
                        className="text-[9px] font-black text-slate-500 uppercase tracking-widest"
                      >
                        Mot de passe
                      </label>
                      <button
                        type="button"
                        onClick={startRecovery}
                        className="text-[9px] font-black text-indigo-400/60 hover:text-indigo-400 uppercase tracking-widest transition-colors"
                      >
                        Perdu ?
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock
                          size={16}
                          className="text-slate-600 group-focus-within:text-indigo-400 transition-colors"
                        />
                      </div>
                      <input
                        id="login-password"
                        aria-label="Mot de passe"
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
                        aria-pressed={showPassword}
                        aria-label={
                          showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                        }
                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-600 hover:text-indigo-400 transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(99, 102, 241, 0.4)' }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-4.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-blue-600 text-white rounded-2xl font-black text-[12px] uppercase tracking-[0.3em] shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all disabled:opacity-50 flex items-center justify-center gap-3 mt-4 group relative overflow-hidden border-t border-white/20"
                  >
                    {/* Animated Shine Sweep */}
                    <motion.div
                      animate={{ left: ['-100%', '200%'] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        repeatDelay: 1,
                      }}
                      className="absolute top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                    />

                    {loading ? (
                      <Loader2 size={20} className="animate-spin text-white" />
                    ) : (
                      <>
                        <span className="relative z-10 drop-shadow-md">Accéder au Système</span>
                        <ArrowRight
                          size={18}
                          className="group-hover:translate-x-1 transition-transform relative z-10"
                        />
                      </>
                    )}
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => {
                      setStep('sector-select');
                      setSelectedSector(null);
                      setError('');
                    }}
                    className="w-full mt-4 flex items-center justify-center gap-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                  >
                    <ChevronLeft size={14} /> Retour aux secteurs
                  </button>
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
                    <label
                      htmlFor="login-2fa"
                      className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1"
                    >
                      Réponse de sécurité
                    </label>
                    <input
                      id="login-2fa"
                      type="text"
                      required
                      value={twoFAAnswer}
                      onChange={(e) => setTwoFAAnswer(e.target.value)}
                      autoFocus
                      placeholder="Saisissez votre réponse secrète"
                      className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 outline-none focus:border-indigo-500/40 focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    />
                    <p className="text-[10px] text-slate-500 font-medium mt-1 ml-1">
                      Répondez à la question de sécurité que vous avez définie lors de votre inscription.
                    </p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all"
                  >
                    {loading ? (
                      <Loader2 size={18} className="animate-spin mx-auto text-white" />
                    ) : (
                      'VÉRIFIER'
                    )}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => setStep('credentials')}
                    className="w-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                  >
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
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Réponse de sécurité
                        </label>
                        <input
                          type="text"
                          required
                          value={recSecAns}
                          onChange={(e) => setRecSecAns(e.target.value)}
                          id="recovery-answer"
                          aria-label="Réponse de sécurité"
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
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          Nouveau mot de passe
                        </label>
                        <input
                          type="password"
                          required
                          value={recNewPw}
                          onChange={(e) => setRecNewPw(e.target.value)}
                          id="recovery-new-password"
                          aria-label="Nouveau mot de passe"
                          placeholder="••••••••"
                          className="w-full bg-white/[0.03] border border-white/5 rounded-2xl px-5 py-4 text-[13px] font-bold text-white placeholder:text-slate-700 outline-none focus:border-indigo-500/40 transition-all"
                        />
                        {recNewPw.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${getPasswordStrength(recNewPw).color} ${getPasswordStrength(recNewPw).width}`}
                              />
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                              {getPasswordStrength(recNewPw).label}
                            </p>
                          </div>
                        )}
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all"
                      >
                        {loading ? (
                          <Loader2 size={18} className="animate-spin mx-auto" />
                        ) : (
                          'RÉINITIALISER'
                        )}
                      </motion.button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep('credentials')}
                    className="w-full flex items-center justify-center gap-2 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
                  >
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
          Powered by GED OS Systems
        </p>
      </div>
    </div>
  );
}
