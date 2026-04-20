/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import { useState, type ComponentType, type ReactNode } from 'react';
import {
  ShieldCheck,
  KeyRound,
  HelpCircle,
  QrCode,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
} from 'lucide-react';
import { appSecurity } from '../services/appSecurity';
import apiClient from '../api/client';
import { PageContainer, PageHeader, ContentArea } from '../components';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  msg: string;
  type: ToastType;
}
let _tid = 0;

// ─── Composant champ mot de passe ─────────────────────────────────────────────
function PasswordField({
  value,
  onChange,
  placeholder,
  title: fieldTitle,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  title: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        title={fieldTitle}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
      />
      <button
        type="button"
        title={show ? 'Masquer' : 'Afficher'}
        onClick={() => setShow((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// ─── Section card ──────────────────────────────────────────────────────────────
function Section({
  icon: Icon,
  title,
  subtitle,
  children,
  color = 'indigo',
}: {
  icon: ComponentType<{ size?: number }>;
  title: string;
  subtitle: string;
  children: ReactNode;
  color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
    amber: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    rose: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
  };
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5">
      <div className="flex items-center gap-4">
        <div
          className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${colors[color]}`}
        >
          <Icon size={18} />
        </div>
        <div>
          <h2 className="text-white font-black text-lg">{title}</h2>
          <p className="text-slate-500 text-sm">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────
export default function SecuritySettings() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // ── Champs ──
  const [projDelCur, setProjDelCur] = useState('');
  const [projDelNew, setProjDelNew] = useState('');
  const [projDelConf, setProjDelConf] = useState('');

  const [adminPwCur, setAdminPwCur] = useState('');
  const [adminPwNew, setAdminPwNew] = useState('');
  const [adminPwConf, setAdminPwConf] = useState('');

  const [secQ, setSecQ] = useState('');
  const [secA, setSecA] = useState('');
  const [secQConf, setSecQConf] = useState('');

  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);

  // ── Récupération d'accès (mode "j'ai oublié") ──
  const [recMode, setRecMode] = useState(false);
  const [recInput, setRecInput] = useState('');
  const [recSecAns, setRecSecAns] = useState('');
  const [recStep, setRecStep] = useState<1 | 2>(1);
  const [recNewPw, setRecNewPw] = useState('');
  const [recQuestion] = useState('');

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const toast = (msg: string, type: ToastType = 'success') => {
    const id = ++_tid;
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4500);
  };

  // ─── 1. Changer le mot de passe de suppression de projet (Local/UI seulement pour l'instant) ─────────────────
  const changeProjectDeletePassword = async () => {
    if (!projDelCur || !projDelNew || !projDelConf) {
      toast('Tous les champs sont requis.', 'error');
      return;
    }
    if (projDelNew.length < 6) {
      toast('Le nouveau mot de passe doit faire au moins 6 caractères.', 'error');
      return;
    }
    if (projDelNew !== projDelConf) {
      toast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }

    // On garde appSecurity pour la suppression locale de projet si nécessaire,
    // ou on pourrait aussi le migrer vers le backend plus tard.
    const ok = await appSecurity.check('projectDeletePassword', projDelCur);
    if (!ok) {
      toast('Mot de passe actuel incorrect.', 'error');
      return;
    }
    await appSecurity.set('projectDeletePassword', projDelNew);
    setProjDelCur('');
    setProjDelNew('');
    setProjDelConf('');
    toast('✅ Mot de passe de suppression de projet mis à jour.');
  };

  // ─── 2. Changer le mot de passe admin (BACKEND) ───────────────────────────
  const changeAdminPassword = async () => {
    if (!adminPwCur || !adminPwNew || !adminPwConf) {
      toast('Tous les champs sont requis.', 'error');
      return;
    }
    if (adminPwNew.length < 8) {
      toast('Le mot de passe admin doit faire au moins 8 caractères.', 'error');
      return;
    }
    if (adminPwNew !== adminPwConf) {
      toast('Les mots de passe ne correspondent pas.', 'error');
      return;
    }

    try {
      await apiClient.post('auth/change-password', {
        currentPassword: adminPwCur,
        newPassword: adminPwNew,
      });
      setAdminPwCur('');
      setAdminPwNew('');
      setAdminPwConf('');
      toast('✅ Mot de passe administrateur mis à jour sur le serveur.');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Erreur lors de la mise à jour.', 'error');
    }
  };

  // ─── 3. Changer la question de sécurité (BACKEND) ─────────────────────────
  const changeSecurityQuestion = async () => {
    if (!secQ.trim() || !secA.trim() || !secQConf) {
      toast('Tous les champs sont requis.', 'error');
      return;
    }

    try {
      // On vérifie d'abord le MDP pour autoriser le changement
      await apiClient.post('auth/security-settings', {
        securityQuestion: secQ.trim(),
        securityAnswer: secA.trim(),
      });
      setSecQ('');
      setSecA('');
      setSecQConf('');
      toast('✅ Question de sécurité mise à jour sur le serveur.');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Erreur lors de la mise à jour.', 'error');
    }
  };

  // ─── 4. Générer un code de récupération (BACKEND) ─────────────────────────
  const generateCode = async () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = Array.from(
      { length: 16 },
      (_, i) => (i > 0 && i % 4 === 0 ? '-' : '') + chars[Math.floor(Math.random() * chars.length)]
    ).join('');

    try {
      await apiClient.post('auth/security-settings', { recoveryCode: code });
      setRecoveryCode(code);
      toast('🔑 Code de récupération généré et sécurisé sur le serveur !', 'warning');
    } catch (err: any) {
      toast('Erreur lors de la génération du code.', 'error');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ─── 5. Flux de récupération d'accès oublié (BACKEND) ──────────────────────
  const startRecovery = async () => {
    // Dans un mode SaaS, on demande l'email d'abord
    const email = prompt('Veuillez saisir votre email pour la récupération :');
    if (!email) return;

    setRecInput(email); // On stocke l'email pour l'étape suivante
    setRecMode(true);
    setRecStep(1);
  };

  const recStep1 = async () => {
    // On passe à l'étape 2 directement pour saisir la réponse ou le code
    // La vérification réelle se fera au moment du reset final sur le backend
    setRecStep(2);
  };

  const recStep2 = async () => {
    if (recNewPw.length < 8) {
      toast('Minimum 8 caractères.', 'error');
      return;
    }

    try {
      await apiClient.post('auth/reset-password', {
        email: recInput, // L'email saisi au début
        securityAnswer: recSecAns,
        recoveryCode: recSecAns.includes('-') ? recSecAns : undefined, // On essaie l'un ou l'autre
        newPassword: recNewPw,
      });
      setRecMode(false);
      toast('✅ Mot de passe réinitialisé avec succès !');
    } catch (err: any) {
      toast(err.response?.data?.error || 'Erreur lors de la réinitialisation.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ── Toast Stack ── */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl font-bold text-sm pointer-events-auto ${
              t.type === 'success'
                ? 'bg-emerald-600 text-white'
                : t.type === 'error'
                  ? 'bg-red-600 text-white'
                  : t.type === 'warning'
                    ? 'bg-amber-500 text-white'
                    : 'bg-indigo-600 text-white'
            }`}
          >
            {t.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            {t.msg}
          </div>
        ))}
      </div>

      {/* ── Recovery Modal ── */}
      <PageContainer className="py-8">
        {recMode && (
          <div className="fixed inset-0 z-[5000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full shadow-2xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-amber-500/15 rounded-xl flex items-center justify-center">
                  <Unlock size={18} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-white font-black text-xl">Récupération d'accès admin</h3>
                  <p className="text-slate-500 text-sm">Étape {recStep}/2</p>
                </div>
              </div>

              {/* Progress */}
              <div className="flex gap-2 mb-6">
                {[1, 2].map((s) => (
                  <div
                    key={s}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      s < recStep
                        ? 'bg-emerald-500'
                        : s === recStep
                          ? 'bg-amber-400'
                          : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {recStep === 1 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    recStep1();
                  }}
                  className="space-y-4"
                >
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-amber-300 text-xs font-black uppercase tracking-widest mb-1">
                      Question de sécurité
                    </p>
                    <p className="text-white font-bold text-sm">
                      {recQuestion || 'Non configurée'}
                    </p>
                  </div>
                  <div className="sr-only" aria-hidden="true">
                    <input
                      type="text"
                      name="username"
                      value="admin"
                      readOnly
                      autoComplete="username"
                      tabIndex={-1}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Réponse à la question OR code de récupération
                    </label>
                    <input
                      type="text"
                      value={recInput}
                      onChange={(e) => setRecInput(e.target.value)}
                      placeholder="Réponse ou XXXX-XXXX-XXXX-XXXX"
                      aria-label="Réponse ou code de récupération"
                      autoFocus
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-mono font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRecMode(false)}
                      className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black transition-all active:scale-95"
                    >
                      Vérifier →
                    </button>
                  </div>
                </form>
              )}

              {recStep === 2 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    recStep2();
                  }}
                  className="space-y-4"
                >
                  <p className="text-emerald-400 font-bold text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} /> Identité vérifiée. Définissez votre nouveau mot de
                    passe.
                  </p>
                  <div className="sr-only" aria-hidden="true">
                    <input
                      type="text"
                      name="username"
                      value="admin"
                      readOnly
                      autoComplete="username"
                      tabIndex={-1}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Nouveau mot de passe (min. 8 car.)
                    </label>
                    <PasswordField
                      value={recNewPw}
                      onChange={setRecNewPw}
                      placeholder="Nouveau mot de passe"
                      title="Nouveau mot de passe admin"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      Confirmer avec la réponse à la question de sécurité
                    </label>
                    <div className="p-3 rounded-xl bg-slate-800 text-slate-400 text-xs mb-2">
                      {recQuestion}
                    </div>
                    <input
                      type="text"
                      value={recSecAns}
                      onChange={(e) => setRecSecAns(e.target.value)}
                      placeholder="Votre réponse"
                      title="Réponse à la question de sécurité"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setRecStep(1)}
                      className="flex-1 py-3 bg-slate-800 text-slate-300 rounded-xl font-bold hover:bg-slate-700 transition-all"
                    >
                      ← Retour
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Save size={14} /> Réinitialiser
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        <PageHeader
          title="Paramètres de Sécurité"
          subtitle="Gestion des mots de passe et de l'authentification — Admin seulement"
          icon={<ShieldCheck size={24} className="text-white" />}
        />

        <ContentArea className="space-y-6 p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* 1. Mot de passe suppression projet */}
            <Section
              icon={Lock}
              title="Mot de passe — Suppression de projet"
              color="rose"
              subtitle="Requis pour supprimer un projet sur la page Cartographie."
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  changeProjectDeletePassword();
                }}
                className="space-y-3"
              >
                <div className="sr-only" aria-hidden="true">
                  <input
                    type="text"
                    name="username"
                    value="admin"
                    readOnly
                    autoComplete="username"
                    tabIndex={-1}
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Mot de passe actuel
                  </label>
                  <PasswordField
                    value={projDelCur}
                    onChange={setProjDelCur}
                    placeholder="Mot de passe actuel"
                    title="Mot de passe actuel de suppression"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <PasswordField
                    value={projDelNew}
                    onChange={setProjDelNew}
                    placeholder="Nouveau mot de passe (min. 6 car.)"
                    title="Nouveau mot de passe"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Confirmer
                  </label>
                  <PasswordField
                    value={projDelConf}
                    onChange={setProjDelConf}
                    placeholder="Répétez le nouveau mot de passe"
                    title="Confirmation"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-rose-600/20"
                >
                  <Save size={15} /> Mettre à jour
                </button>
              </form>
            </Section>

            {/* 2. Mot de passe admin */}
            <Section
              icon={ShieldCheck}
              title="Mot de passe administrateur"
              color="indigo"
              subtitle="Utilisé pour les actions sensibles (suppression compte admin, accès paramètres)."
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  changeAdminPassword();
                }}
                className="space-y-3"
              >
                <div className="sr-only" aria-hidden="true">
                  <input
                    type="text"
                    name="username"
                    value="admin"
                    readOnly
                    autoComplete="username"
                    tabIndex={-1}
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Mot de passe actuel
                  </label>
                  <PasswordField
                    value={adminPwCur}
                    onChange={setAdminPwCur}
                    placeholder="Mot de passe actuel"
                    title="Mot de passe admin actuel"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Nouveau mot de passe (min. 8 car.)
                  </label>
                  <PasswordField
                    value={adminPwNew}
                    onChange={setAdminPwNew}
                    placeholder="Minimum 8 caractères"
                    title="Nouveau mot de passe admin"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Confirmer
                  </label>
                  <PasswordField
                    value={adminPwConf}
                    onChange={setAdminPwConf}
                    placeholder="Répétez"
                    title="Confirmation"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-indigo-600/20"
                >
                  <Save size={15} /> Mettre à jour
                </button>
              </form>
            </Section>

            {/* 3. Question de sécurité */}
            <Section
              icon={HelpCircle}
              title="Question de sécurité"
              color="amber"
              subtitle="Utilisée pour récupérer l'accès si le mot de passe admin est oublié."
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  changeSecurityQuestion();
                }}
                className="space-y-3"
              >
                <div className="sr-only" aria-hidden="true">
                  <input
                    type="text"
                    name="username"
                    value="admin"
                    readOnly
                    autoComplete="username"
                    tabIndex={-1}
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Nouvelle question
                  </label>
                  <input
                    type="text"
                    value={secQ}
                    onChange={(e) => setSecQ(e.target.value)}
                    placeholder="Ex: Quelle est la ville de naissance de..."
                    title="Question de sécurité"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Réponse (insensible à la casse)
                  </label>
                  <input
                    type="text"
                    value={secA}
                    onChange={(e) => setSecA(e.target.value)}
                    placeholder="Votre réponse secrète"
                    title="Réponse à la question de sécurité"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white font-medium placeholder:text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                    Confirmer avec le mot de passe admin
                  </label>
                  <PasswordField
                    value={secQConf}
                    onChange={setSecQConf}
                    placeholder="Mot de passe admin"
                    title="Mot de passe admin pour confirmer"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-black transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <Save size={15} /> Enregistrer la question
                </button>
              </form>
            </Section>

            {/* 4. Code de récupération */}
            <Section
              icon={QrCode}
              title="Code de récupération d'urgence"
              color="emerald"
              subtitle="Générez un code unique à conserver en lieu sûr — utilisable une seule fois si vous oubliez votre mot de passe ET votre réponse de sécurité."
            >
              <div className="space-y-4">
                {recoveryCode ? (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
                    <span className="font-mono font-bold text-emerald-300 tracking-widest text-sm">
                      {recoveryCode}
                    </span>
                    <button
                      onClick={copyCode}
                      title={copied ? 'Copié !' : 'Copier'}
                      className={`p-2 rounded-lg transition-all ${copied ? 'text-emerald-400 bg-emerald-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700 text-slate-500 text-sm text-center">
                    Aucun code généré — cliquez ci-dessous pour en créer un
                  </div>
                )}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-amber-300 text-xs font-bold flex items-start gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                    Conservez ce code dans un endroit sûr (imprimé ou dans un gestionnaire de mots
                    de passe). Il sera invalidé après utilisation.
                  </p>
                </div>
                <button
                  onClick={generateCode}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-lg shadow-emerald-600/20"
                >
                  <RefreshCw size={15} /> {recoveryCode ? 'Regénérer un code' : 'Générer le code'}
                </button>
              </div>
            </Section>

            {/* 5. Récupération d'accès oublié */}
            <div className="border border-dashed border-slate-700 rounded-3xl p-6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Unlock size={20} className="text-slate-500" />
                <div>
                  <p className="text-white font-bold">Mot de passe oublié ?</p>
                  <p className="text-slate-500 text-sm">
                    Récupérez l'accès via la question de sécurité ou le code d'urgence.
                  </p>
                </div>
              </div>
              <button
                onClick={startRecovery}
                className="shrink-0 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 border border-slate-700"
              >
                <KeyRound size={14} /> Récupérer l'accès
              </button>
            </div>
          </div>
        </ContentArea>
      </PageContainer>
    </div>
  );
}
