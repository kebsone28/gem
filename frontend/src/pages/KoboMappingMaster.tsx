import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Link2,
  Search,
  Save,
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  ArrowRight,
  Table,
  Settings2,
  Info,
  Lock,
  Unlock,
} from 'lucide-react';
import { PageContainer, PageHeader, ContentArea } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { organizationService } from '../services/organizationService';
import { auditService } from '../services/auditService';

/**
 * 🎯 KOBO MASTER ENGINE (Advanced Field Mapping & Sync Setup)
 * This allows admingem to dynamically map Kobo form fields to PROQUELEC DB fields.
 */
export default function KoboMappingMaster() {
  const { user } = useAuth();
  const [config, setConfig] = useState<any>({ kobo_field_mapping: {} });
  const [isSaving, setIsSaving] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [searchField, setSearchField] = useState('');
  const [isLocked, setIsLocked] = useState(true);

  // Predefined PROQUELEC Database Fields (Targets)
  const TARGET_FIELDS = [
    { id: 'numeroordre', label: "Numéro d'Ordre (Unique ID)", required: true, icon: Hash },
    { id: 'name', label: 'Nom du Chef de Ménage', required: true, icon: User },
    { id: 'phone', label: 'Téléphone Mobile', required: false, icon: Phone },
    { id: 'region', label: 'Région / Gouvernorat', required: true, icon: MapPin },
    { id: 'village', label: 'Village / Quartier', required: false, icon: Home },
    { id: 'deliveryStatus', label: 'Statut de Livraison', required: false, icon: Package },
    { id: 'client_signature', label: 'Signature Client', required: false, icon: PenTool },
    { id: 'gps_latitude', label: 'GPS: Latitude', required: false, icon: Navigation },
    { id: 'gps_longitude', label: 'GPS: Longitude', required: false, icon: Navigation },
  ];

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const data = await organizationService.getConfig();
      if (data?.config) {
        // We forcefully merge the defaults so any single empty or missing key gets filled.
        // This prevents gaps in the UI if the user previously saved a partial mapping.
        const defaultMapping = {
          numeroordre: 'Numero_ordre',
          name: 'nom_key',
          phone: 'telephone_key',
          region: 'region_key',
          village: '', // Intentional blank since we audited that it doesn't exist
          deliveryStatus: 'Situation_du_M_nage',
          client_signature: 'Je_confirme_la_remis_u_materiel_au_m_nage',
          gps_latitude: 'latitude_key',
          gps_longitude: 'longitude_key',
        };

        const currentMapping = data.config.kobo_field_mapping || {};
        const mergedMapping = { ...defaultMapping };

        Object.keys(defaultMapping).forEach((key) => {
          // Only override the default if the current mapping has a non-empty string for this key
          if (currentMapping[key] && currentMapping[key].trim() !== '') {
            mergedMapping[key as keyof typeof defaultMapping] = currentMapping[key];
          }
        });

        const activeConfig = {
          ...data.config,
          kobo_field_mapping: mergedMapping,
        };

        setConfig(activeConfig);
        setLastSync(new Date().toLocaleString());
      }
    } catch (err) {
      console.error('Failed to load kobo config');
    }
  };

  const handleMapChange = (targetId: string, koboField: string) => {
    const nextMapping = { ...config.kobo_field_mapping, [targetId]: koboField };
    setConfig({ ...config, kobo_field_mapping: nextMapping });
  };

  const saveMapping = async () => {
    setIsSaving(true);
    try {
      await organizationService.updateConfig(config);
      if (user) {
        auditService.logAction(
          user,
          'Mise à jour Mapping Kobo',
          'KOBO_ENGINE',
          `A modifié la configuration du mapping des champs terrain.`,
          'warning'
        );
      }
      // Artificial delay for premium feel
      await new Promise((r) => setTimeout(r, 1000));
      loadConfig();
      // Re-lock automatically after a massive infrastructure save
      setIsLocked(true);
    } catch (err) {
      console.error('Failed to save mapping');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer className="min-h-screen bg-slate-950 py-12">
      <PageHeader
        title="Kobo Engine Master"
        subtitle="Configuration avancée du mapping des données terrain"
        icon={<Settings2 size={24} className="text-blue-400" />}
      />

      <ContentArea className="max-w-6xl mx-auto space-y-10 p-8">
        {/* 🛡️ Header Insight */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-[3rem] p-10 relative overflow-hidden shadow-2xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-blue-400">
                  <Database size={24} />
                </div>
                <h2 className="text-3xl font-black text-white tracking-tight uppercase italic">
                  Architecture des Données
                </h2>
              </div>
              <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-xl">
                Gérez la correspondance entre vos formulaires KoboToolbox et la base de données
                centrale PROQUELEC. Les changements ici affectent instantanément les futures
                synchronisations terrain.
              </p>
            </div>
            <div className="flex flex-col items-end gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsLocked(!isLocked)}
                  className={`h-11 px-6 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-2 italic ${
                    isLocked
                      ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20'
                      : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'
                  }`}
                >
                  {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                  {isLocked ? 'Déverrouiller' : 'Interface Ouverte'}
                </button>
                <button
                  onClick={saveMapping}
                  disabled={isSaving || isLocked}
                  className="h-11 px-8 bg-blue-600 hover:bg-blue-500 rounded-xl text-[11px] font-black uppercase tracking-widest text-white transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center gap-3 italic disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <RefreshCcw size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {isSaving ? 'Synchronisation...' : 'Enregistrer'}
                </button>
              </div>
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-500" /> Dernière mise à jour:{' '}
                {lastSync || 'Jamais'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* 🔧 Mapping Grid */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between px-2 mb-4">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] italic">
                Champs de Destination PROQUELEC
              </h3>
              <div className="relative group">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600"
                />
                <input
                  type="text"
                  placeholder="Chercher un champ..."
                  value={searchField}
                  onChange={(e) => setSearchField(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-[10px] font-bold text-white outline-none focus:border-blue-500/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-4">
              {TARGET_FIELDS.filter((f) =>
                f.label.toLowerCase().includes(searchField.toLowerCase())
              ).map((field) => (
                <motion.div
                  key={field.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-6 bg-slate-900/30 border border-slate-800/50 hover:border-blue-500/30 rounded-3xl group transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 order border-white/5 rounded-2xl flex items-center justify-center text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <field.icon size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white uppercase italic tracking-tight">
                          {field.label}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">
                            ID: {field.id}
                          </span>
                          {field.required && (
                            <span className="text-[9px] font-black text-rose-500/80 uppercase tracking-widest bg-rose-500/5 px-2 py-0.5 rounded-full border border-rose-500/10">
                              Requis
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 flex items-center gap-4 max-w-sm">
                      <div className="shrink-0 text-slate-700">
                        <Link2 size={16} />
                      </div>
                      <input
                        type="text"
                        placeholder="Champ Kobo (ex: group_name/field_id)"
                        value={config.kobo_field_mapping?.[field.id] || ''}
                        onChange={(e) => handleMapChange(field.id, e.target.value)}
                        readOnly={isLocked}
                        className={`w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3.5 text-white font-mono text-xs placeholder:text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/30 transition-all ${isLocked ? 'opacity-50 cursor-locked focus:ring-0 select-none' : ''}`}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* 📊 Sidebar Info */}
          <div className="lg:col-span-4 space-y-8">
            <div className="p-8 bg-indigo-500/5 border border-indigo-500/10 rounded-[2.5rem] space-y-6">
              <h3 className="text-xs font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-3 italic">
                <Info size={16} /> Guide de Configuration
              </h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-[10px] shrink-0">
                    01
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Référez-vous au <strong>Name</strong> de la question dans votre fichier XLSForm
                    ou sur KoboToolbox.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-[10px] shrink-0">
                    02
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Pour les champs imbriqués, utilisez le format <strong>groupe/variable</strong>.
                  </p>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-black text-[10px] shrink-0">
                    03
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sauvegardez pour que le moteur de synchronisation prenne en compte les nouveaux
                    chemins.
                  </p>
                </div>
              </div>
            </div>

            {/* 🔒 Security Panel */}
            <div className="p-10 rounded-[3rem] bg-rose-500/5 border border-rose-500/10 h-fit">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-500">
                  <Lock size={18} />
                </div>
                <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest italic">
                  Contrôle Accès Master
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 font-bold leading-relaxed mb-6">
                Le mapping des champs est une opération à cœur ouvert. Les erreurs ici peuvent
                casser la traçabilité des ménages.
                <br />
                <br />
                <span className="text-white">Accès restreint à admingem uniquement.</span>
              </p>
              <div className="p-4 rounded-2xl bg-slate-950/50 border border-rose-500/10">
                <p className="text-[9px] font-black text-rose-500 uppercase tracking-[0.2em] mb-1">
                  Status Sécurité
                </p>
                <p className="text-[10px] text-white font-bold italic">
                  Session Administrateur Protégée
                </p>
              </div>
            </div>
          </div>
        </div>
      </ContentArea>
    </PageContainer>
  );
}

// ── Icons for mapping (Local aliases) ──────────────────────────────────────────
const Hash = (props: any) => <Link2 {...props} />;
const User = (props: any) => <Link2 {...props} />;
const Phone = (props: any) => <Link2 {...props} />;
const MapPin = (props: any) => <Link2 {...props} />;
const Home = (props: any) => <Link2 {...props} />;
const Package = (props: any) => <Link2 {...props} />;
const PenTool = (props: any) => <Link2 {...props} />;
const Navigation = (props: any) => <Link2 {...props} />;
