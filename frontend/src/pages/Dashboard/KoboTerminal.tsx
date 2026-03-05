import { motion } from 'framer-motion';
import { ExternalLink, Info, ShieldAlert, MonitorCheck } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function KoboTerminal() {
    const { isDarkMode } = useTheme();
    const koboIframeUrl = "https://ee.kobotoolbox.org/i/bfVy1nud";

    return (
        <div className="min-h-screen p-4 md:p-8">
            {/* Header Section */}
            <header className="mb-10">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shadow-sm border border-indigo-500/20">
                                <MonitorCheck size={24} />
                            </div>
                            <div>
                                <h1 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                    Terminal Kobo <span className="text-indigo-500 font-bold tracking-widest uppercase text-xs ml-2 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/10">Mode Rattrapage</span>
                                </h1>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest mt-1">
                                    Saisie directe pour correction et mise à jour terrain
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <a
                            href={koboIframeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                        >
                            Ouvrir dans Kobo <ExternalLink size={14} />
                        </a>
                    </div>
                </motion.div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Main Form Area */}
                <div className="lg:col-span-3 space-y-6">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`relative rounded-[2.5rem] border overflow-hidden shadow-2xl transition-all h-[800px] ${isDarkMode ? 'bg-slate-950/40 border-slate-800 shadow-indigo-500/5' : 'bg-white border-slate-200'
                            }`}
                    >
                        {/* Decorative background glow */}
                        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />

                        <iframe
                            src={koboIframeUrl}
                            title="Formulaire Kobo GEM"
                            className="w-full h-full border-none"
                            loading="lazy"
                        />
                    </motion.div>
                </div>

                {/* Sidebar Info */}
                <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className={`p-6 rounded-3xl border transition-all ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-indigo-50/50 border-indigo-100'
                            }`}
                    >
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-indigo-500 mb-4 flex items-center gap-2">
                            <Info size={14} /> Instructions
                        </h3>
                        <ul className="space-y-4">
                            {[
                                "Utilisez ce terminal pour saisir les données non remontées par les équipes mobiles.",
                                "Assurez-vous d'avoir l'ID du ménage ou le nom de la zone avant de commencer.",
                                "Les données validées ici apparaîtront dans les rapports après la prochaine synchronisation cloud.",
                                "Utilisez le bouton 'Submit' en bas du formulaire pour enregistrer définitivement."
                            ].map((text, i) => (
                                <li key={i} className="flex gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                    <p className={`text-[11px] font-bold leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        {text}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 }}
                        className={`p-6 rounded-3xl border border-amber-500/20 bg-amber-500/5 transition-all outline outline-1 outline-amber-500/10`}
                    >
                        <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-500 mb-3 flex items-center gap-2">
                            <ShieldAlert size={14} /> Sécurité
                        </h3>
                        <p className="text-[10px] font-bold text-amber-600/80 leading-relaxed italic">
                            Chaque soumission est tracée avec votre identifiant de superviseur. Kobo ToolBox reste la "Source Unique de Vérité" pour l'ensemble du projet GEM.
                        </p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
