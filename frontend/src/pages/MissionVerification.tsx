import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShieldCheck, ShieldAlert, Calendar, Users, MapPin, Building2, CheckCircle2, Clock } from 'lucide-react';
import axios from 'axios';
import { motion } from 'framer-motion';

interface VerifiedMission {
  valid: boolean;
  status: string;
  orderNumber: string;
  organization: string;
  title: string;
  startDate: string;
  endDate: string;
  purpose: string;
  region: string;
  members: { name: string; role: string }[];
  isCertified: boolean;
  verifiedAt: string;
}

export default function MissionVerification() {
  const { identifier } = useParams();
  const [data, setData] = useState<VerifiedMission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkMission = async () => {
      try {
        const response = await axios.get(`/api/missions/verify/${identifier}`);
        setData(response.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Erreur lors de la vérification');
      } finally {
        setLoading(false);
      }
    };
    checkMission();
  }, [identifier]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-16 h-16 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-black tracking-widest text-[10px] animate-pulse uppercase">Vérification de l'empreinte numérique...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-blue-500/30 font-sans p-6 md:p-12 flex flex-col items-center">
      
      {/* BACKGROUND EFFECTS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg z-10"
      >
        {/* LOGO AREA */}
        <div className="flex justify-center mb-10">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 mb-3 backdrop-blur-xl">
              <ShieldCheck className="text-blue-500" size={24} />
            </div>
            <h1 className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">Proquelec Security</h1>
          </div>
        </div>

        {error ? (
          <div className="glass-card !bg-rose-500/5 border-rose-500/20 p-8 text-center rounded-[2.5rem] relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-rose-500" />
            <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/20">
              <ShieldAlert className="text-rose-500" size={32} />
            </div>
            <h2 className="text-xl font-black mb-2 text-rose-500">MISSION NON TROUVÉE</h2>
            <p className="text-slate-400 text-sm mb-8 leading-relaxed italic">
              L'identifiant fourni ne correspond à aucun ordre de mission valide ou actif dans nos registres sécurisés.
            </p>
            <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">
              RETOUR À L'ACCUEIL
            </Link>
          </div>
        ) : data?.valid ? (
          <div className="space-y-6">
            
            {/* STATUS HEADER CARD */}
            <div className={`glass-card p-8 rounded-[3rem] text-center border-2 relative overflow-hidden ${data.isCertified ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-blue-500/20 bg-blue-500/5'}`}>
              <div className={`absolute top-0 left-0 w-full h-1.5 ${data.isCertified ? 'bg-emerald-500' : 'bg-blue-600'}`} />
              
              <div className="flex justify-center mb-6">
                 {data.isCertified ? (
                   <div className="relative">
                     <CheckCircle2 size={64} className="text-emerald-500" />
                     <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-emerald-950"
                      >
                        <ShieldCheck size={12} className="text-white" />
                      </motion.div>
                   </div>
                 ) : (
                   <Clock size={64} className="text-blue-400 opacity-50" />
                 )}
              </div>

              <h2 className={`text-2xl font-black tracking-tight mb-1 uppercase ${data.isCertified ? 'text-emerald-400' : 'text-blue-400'}`}>
                {data.isCertified ? 'Mission Certifiée' : 'Mission en Attente'}
              </h2>
              <div className="flex items-center justify-center gap-2 text-slate-500 font-black text-[10px] tracking-widest mb-4">
                <span>RÉF : {data.orderNumber}</span>
                <span className="w-1 h-1 rounded-full bg-slate-700" />
                <span>{data.organization}</span>
              </div>
              
              <div className={`inline-block px-4 py-1.5 rounded-full text-[9px] font-black tracking-widest ${data.isCertified ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                STATUT : {data.status.toUpperCase()}
              </div>
            </div>

            {/* DETAILS CONTENT */}
            <div className="glass-card p-8 rounded-[3rem] space-y-8 border-white/5">
              
              {/* Info Group */}
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <Building2 size={18} className="text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Objet de la Mission</label>
                    <p className="text-sm font-bold leading-relaxed">{data.purpose || data.title}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <MapPin size={18} className="text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Zone d'intervention</label>
                    <p className="text-sm font-bold">{data.region}</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                    <Calendar size={18} className="text-slate-400" />
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Période d'activité</label>
                    <p className="text-sm font-bold italic">Du {data.startDate} au {data.endDate}</p>
                  </div>
                </div>
              </div>

              {/* Team Group */}
              <div className="pt-6 border-t border-white/5">
                <div className="flex items-center gap-2 mb-6">
                  <Users size={16} className="text-blue-500" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Équipage Autorisé</h3>
                </div>
                
                <div className="grid gap-3">
                  {(data.members || []).length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic text-center py-4">Aucun missionnaire listé</p>
                  ) : (
                    (data.members || []).map((member, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/[0.08] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center font-black text-[10px]">
                          {i+1}
                        </div>
                        <span className="text-sm font-black tracking-tight">{member.name}</span>
                      </div>
                      <span className="text-[9px] font-black text-slate-500 italic uppercase tracking-tighter">{member.role}</span>
                    </div>
                  )))}
                </div>
              </div>

            </div>

            {/* FOOTER CERTAINTY */}
            <div className="text-center space-y-4 pt-4">
              <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em]">
                Certificat Digitale Authentique &bull; {new Date(data.verifiedAt).toLocaleString()}
              </p>
              <div className="flex justify-center gap-4">
                <div className="h-px w-12 bg-white/5 self-center" />
                <div className="w-2 h-2 rounded-full bg-blue-500 opacity-20" />
                <div className="h-px w-12 bg-white/5 self-center" />
              </div>
            </div>

          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
