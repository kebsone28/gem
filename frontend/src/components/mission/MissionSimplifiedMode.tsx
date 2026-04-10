import React, { useState } from 'react';
import { Camera, MapPin, Mic, CheckCircle2, ChevronRight, Menu } from 'lucide-react';
import type { MissionOrderData, MissionMember, MissionReportDay } from '../../pages/mission/core/missionTypes';

interface MissionSimplifiedModeProps {
  missionData: MissionOrderData;
  members: MissionMember[];
  onBack: () => void;
}

/**
 * COMPOSANT : Mode Terrain Simplifié
 * Interface mobile-first pour les techniciens sur le terrain.
 */
export const MissionSimplifiedMode: React.FC<MissionSimplifiedModeProps> = ({
  missionData,
  members,
  onBack
}) => {
  const [reportDays, setReportDays] = useState<MissionReportDay[]>(missionData.reportDays || []);
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isFullScreenMode, setIsFullScreenMode] = useState(true);

  console.log("Techniciens sur cette mission:", members.length);

  const currentDay = reportDays[currentDayIndex];

  const onUpdateDay = (index: number, field: string, value: any) => {
    const newDays = [...reportDays];
    newDays[index] = { ...newDays[index], [field]: value };
    setReportDays(newDays);
  };

  const onPhotoCapture = (index: number) => {
    // Simulation de capture photo (Update local pour démo)
    onUpdateDay(index, 'photo', 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=300');
  };

  const handleVoiceNote = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Reconnaissance vocale non supportée par votre navigateur');
      return;
    }

    if (!isRecording) {
      setIsRecording(true);
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.lang = 'fr-FR';
      recognition.start();

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        onUpdateDay(currentDayIndex, 'observation', (currentDay.observation || '') + ' ' + transcript);
        setIsRecording(false);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };
    }
  };

  const prevDay = () => {
    if (currentDayIndex > 0) setCurrentDayIndex(currentDayIndex - 1);
  };

  const nextDay = () => {
    if (currentDayIndex < reportDays.length - 1) setCurrentDayIndex(currentDayIndex + 1);
  };

  if (!currentDay) {
    return (
      <div className="h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-center">
        <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6">
           <MapPin className="text-indigo-500" size={40} />
        </div>
        <h2 className="text-white font-black text-xl mb-2 uppercase tracking-tighter">Aucun Planning</h2>
        <p className="text-slate-400 mb-8 max-w-xs text-sm">Veuillez configurer le planning de la mission avant de passer en mode terrain.</p>
        <button onClick={onBack} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-xs tracking-widest">
           Retour au Dashboard
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 transition-all ${
        isFullScreenMode ? 'fixed inset-0 z-[1000]' : ''
      }`}
    >
      {/* Header Simplifié */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 safe-area-inset-top shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsFullScreenMode(!isFullScreenMode)} 
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Basculer le mode plein écran"
                aria-label="Basculer le mode plein écran"
            >
              <Menu size={20} />
            </button>
            <div>
              <h2 className="font-black text-[10px] uppercase tracking-wider opacity-80">Mission: {missionData.orderNumber}</h2>
              <h3 className="font-black text-sm uppercase tracking-tight">Jour {currentDay.day} • {currentDay.title}</h3>
            </div>
          </div>
          <div className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
            {currentDayIndex + 1} / {reportDays.length}
          </div>
        </div>
      </div>

      {/* Zone d'Action Principale */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Statut jour */}
        <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-white/5">
          <button
            onClick={() => onUpdateDay(currentDayIndex, 'isCompleted', !currentDay.isCompleted)}
            aria-label="Marquer comme complété"
            title="Marquer comme complété"
            className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
              currentDay.isCompleted
                ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : 'border-slate-400 dark:border-slate-600'
            }`}
          >
            {currentDay.isCompleted ? <CheckCircle2 size={24} /> : <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600" />}
          </button>
          <div className="flex-1">
            <p className="text-xs font-black text-slate-700 dark:text-white uppercase tracking-tight">Objectif Atteint</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">Valider cette étape du terrain</p>
          </div>
        </div>

        {/* Capture Photo */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] block pl-1">
            Documentation Visuelle
          </label>
          <button
            onClick={() => onPhotoCapture(currentDayIndex)}
            title="Prendre une photo de terrain"
            aria-label="Prendre une photo de terrain"
            className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center transition-all bg-white dark:bg-slate-800 relative overflow-hidden ${
              currentDay.photo ? 'border-indigo-500' : 'border-slate-300 dark:border-slate-700'
            }`}
          >
            {currentDay.photo ? (
              <img src={currentDay.photo} alt="Terrain" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Camera size={40} className="text-slate-400" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Prendre une photo
                </span>
              </div>
            )}
            {currentDay.photo && (
                <div className="absolute top-3 right-3 p-1.5 bg-indigo-600 text-white rounded-lg shadow-lg">
                    <CheckCircle2 size={16} />
                </div>
            )}
          </button>
        </div>

        {/* Observation Jour */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] block pl-1">
            Notes d'Observation
          </label>
          <div className="relative">
            <textarea
              value={currentDay.observation || ''}
              onChange={(e) => onUpdateDay(currentDayIndex, 'observation', e.target.value)}
              placeholder="Saisissez vos notes ou utilisez le micro..."
              className="w-full p-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none h-32 shadow-sm"
            />
            <button 
                onClick={handleVoiceNote}
                title="Enregistrer une note vocale"
                aria-label="Enregistrer une note vocale"
                className={`absolute bottom-3 right-3 w-10 h-10 rounded-xl flex items-center justify-center transition-colors shadow-lg ${
                    isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-500 text-white hover:bg-indigo-600'
                }`}
            >
                <Mic size={18} />
            </button>
          </div>
        </div>

        {/* GPS */}
        <button
            onClick={() => {
              if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition((pos) => {
                  onUpdateDay(currentDayIndex, 'location', {
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude
                  });
                });
              }
            }}
            aria-label="Verrouiller la position GPS"
            title="Verrouiller la position GPS"
            className={`w-full py-4 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all ${
              currentDay.location
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-white/5'
            }`}
          >
            <MapPin size={18} />
            {currentDay.location 
                ? `GPS Verrouillé: ${currentDay.location.lat.toFixed(4)}, ${currentDay.location.lng.toFixed(4)}` 
                : 'Verrouiller Position GPS'}
          </button>
      </div>

      {/* Navigation Jours */}
      <div className="bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-white/5 p-4 safe-area-inset-bottom shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={prevDay}
            disabled={currentDayIndex === 0}
            title="Jour précédent"
            aria-label="Jour précédent"
            className="flex-1 py-4 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-30 transition-colors"
          >
            Précédent
          </button>
          
          <button
            onClick={nextDay}
            disabled={currentDayIndex === reportDays.length - 1}
            title="Jour suivant"
            aria-label="Jour suivant"
            className="flex-1 py-4 rounded-xl bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest disabled:opacity-30 flex items-center justify-center gap-2 transition-colors hover:bg-indigo-700"
          >
            Suivant <ChevronRight size={16} />
          </button>
        </div>
        
        {/* Progress Dots */}
        <div className="mt-4 flex justify-center gap-1.5">
            {reportDays.map((d, i) => (
                <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentDayIndex ? 'w-6 bg-indigo-500' : d.isCompleted ? 'w-1.5 bg-emerald-500' : 'w-1.5 bg-slate-200 dark:bg-slate-700'
                    }`}
                />
            ))}
        </div>
      </div>
    </div>
  );
};
