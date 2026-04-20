/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps, react-hooks/preserve-manual-memoization, prefer-const, no-empty, no-useless-escape, no-prototype-builtins, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-empty-object-type */
import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Navigation,
  Clock,
  Gauge,
  Volume2,
  VolumeX,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TurnInstruction {
  distance: number; // mètres
  duration: number; // secondes
  instruction: string;
  name?: string;
  type?: string;
  modifier?: string;
}

interface TurnByTurnInstructionsProps {
  instructions: TurnInstruction[];
  isDarkMode: boolean;
  totalDistance: number; // mètres
  totalDuration: number; // secondes;
}

export const TurnByTurnInstructions: React.FC<TurnByTurnInstructionsProps> = ({
  instructions,
  isDarkMode,
  totalDistance,
  totalDuration,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [lastSpokenStep, setLastSpokenStep] = useState(-1);

  // Auto-collapse si beaucoup d'étapes
  useEffect(() => {
    if (instructions.length > 15) {
      setExpanded(false);
    }
  }, [instructions.length]);

  // Text-to-speech pour les instructions
  useEffect(() => {
    if (!voiceEnabled || typeof window === 'undefined') return;

    // Parler l'instruction actuelle si elle a changé
    if (currentStep !== lastSpokenStep && currentStep < instructions.length) {
      const synth = window.speechSynthesis;

      // Annuler la parole précédente
      synth.cancel();

      const currentInstruction = instructions[currentStep];
      let textToSpeak = currentInstruction.instruction;

      // Ajouter le nom de la rue si disponible
      if (currentInstruction.name) {
        textToSpeak += ` sur ${currentInstruction.name}`;
      }

      // Ajouter la distance
      const distanceText =
        currentInstruction.distance < 1000
          ? `dans ${Math.round(currentInstruction.distance)} mètres`
          : `dans ${(currentInstruction.distance / 1000).toFixed(1)} kilomètres`;

      textToSpeak += `, ${distanceText}`;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'fr-FR';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      synth.speak(utterance);
      setLastSpokenStep(currentStep);
    }
  }, [currentStep, voiceEnabled, instructions, lastSpokenStep]);

  // Déterminer si on est proche de l'arrivée
  const distanceToDestination = instructions
    .slice(currentStep)
    .reduce((sum, step) => sum + step.distance, 0);
  const isNearArrival = distanceToDestination < 200; // < 200m

  if (!instructions || instructions.length === 0) {
    return null;
  }

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h${remainMins.toString().padStart(2, '0')}`;
  };

  const getManeuverIcon = (instruction: string | undefined): string => {
    const inst = (instruction || '').toLowerCase();
    if (inst.includes('droite') || inst.includes('right')) return '🔄 ↗️';
    if (inst.includes('gauche') || inst.includes('left')) return '🔄 ↖️';
    if (inst.includes('continuer') || inst.includes('continue') || inst.includes('straight'))
      return '⬆️';
    if (inst.includes('demi-tour') || inst.includes('uturn')) return '🔃';
    if (inst.includes('arrivée') || inst.includes('arrive')) return '🎯';
    if (inst.includes('départ') || inst.includes('depart') || inst.includes('start')) return '🚗';
    return '📍';
  };

  return (
    <div
      className={`rounded-2xl border overflow-hidden shadow-lg transition-all ${
        isDarkMode
          ? 'bg-slate-900/80 border-slate-700 text-white'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      {/* ─── HEADER COLLAPSIBLE ─── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`w-full flex items-center justify-between px-5 py-4 border-b font-bold transition-all ${
          isDarkMode ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-100 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-3">
          <Navigation size={18} className="text-blue-600" />
          <span>Itinéraire détaillé ({instructions.length} étapes)</span>
          <span
            className={`text-xs font-bold px-2 py-1 rounded-lg ${
              isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {formatDistance(totalDistance)} • {formatDuration(totalDuration)}
          </span>
          {/* Voice Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setVoiceEnabled(!voiceEnabled);
            }}
            className={`p-1.5 rounded-lg transition-all ${
              voiceEnabled
                ? isDarkMode
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : isDarkMode
                  ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
            }`}
            title={voiceEnabled ? 'Désactiver la voix' : 'Activer la voix'}
          >
            {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown size={20} />
        </motion.div>
      </button>

      {/* ─── CONTENT ─── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {/* Progress Bar */}
            <div
              className={`px-5 py-3 border-b ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
            >
              <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest mb-2 text-slate-500">
                <span>Progression</span>
                <span>
                  Étape {currentStep + 1} / {instructions.length}
                </span>
              </div>
              <div
                className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}
              >
                <motion.div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${((currentStep + 1) / instructions.length) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
              {/* Arrival Alert */}
              {isNearArrival && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${
                    isDarkMode
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                  }`}
                >
                  <AlertCircle size={14} className="animate-pulse" />
                  <span>🎯 ARRIVÉE IMMINENTE! {formatDistance(distanceToDestination)}</span>
                </motion.div>
              )}
            </div>

            {/* Current Step Highlight */}
            <div
              className={`px-5 py-4 border-b ${isDarkMode ? 'border-slate-700 bg-blue-500/10' : 'border-slate-100 bg-blue-50'}`}
            >
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">
                  {getManeuverIcon(instructions[currentStep]?.instruction)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm uppercase tracking-widest text-blue-600 mb-1">
                    Étape actuelle
                  </p>
                  <p className="text-lg font-bold leading-tight mb-2">
                    {instructions[currentStep]?.instruction || 'Continue'}
                  </p>
                  {instructions[currentStep]?.name && (
                    <p
                      className={`text-xs font-semibold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}
                    >
                      Rue: {instructions[currentStep].name}
                    </p>
                  )}
                  <div className="flex gap-4 mt-3">
                    <div className="flex items-center gap-1.5">
                      <Gauge size={14} className="text-amber-500" />
                      <span className="text-sm font-bold">
                        {formatDistance(instructions[currentStep]?.distance || 0)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-emerald-500" />
                      <span className="text-sm font-bold">
                        {formatDuration(instructions[currentStep]?.duration || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Steps List */}
            <div
              className={`max-h-96 overflow-y-auto ${isDarkMode ? 'divide-slate-700' : 'divide-slate-100'} divide-y`}
            >
              {instructions.map((step, index) => (
                <motion.button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-full text-left px-5 py-3 transition-all hover:bg-opacity-50 ${
                    index === currentStep
                      ? isDarkMode
                        ? 'bg-blue-500/20 border-l-4 border-blue-500'
                        : 'bg-blue-50 border-l-4 border-blue-600'
                      : index < currentStep
                        ? isDarkMode
                          ? 'opacity-60 hover:bg-slate-800'
                          : 'opacity-60 hover:bg-slate-100'
                        : isDarkMode
                          ? 'hover:bg-slate-800'
                          : 'hover:bg-slate-50'
                  }`}
                  whileHover={{ paddingLeft: '1.5rem' }}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl flex-shrink-0">
                      {getManeuverIcon(step.instruction)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">{step.instruction || 'Continue'}</p>
                      {step.name && (
                        <p
                          className={`text-xs truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-600'}`}
                        >
                          {step.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 ml-11 text-xs font-bold">
                    <span
                      className={
                        isDarkMode ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'
                      }
                    >
                      {formatDistance(step.distance)}
                    </span>
                    <span
                      className={
                        isDarkMode ? 'text-slate-500' : 'text-slate-600 dark:text-slate-400'
                      }
                    >
                      {formatDuration(step.duration)}
                    </span>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Navigation Controls */}
            <div
              className={`flex gap-2 p-4 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50'}`}
            >
              <button
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                className={`flex-1 px-3 py-2 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-2 ${
                  currentStep === 0
                    ? isDarkMode
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-slate-700 text-white hover:bg-slate-600'
                      : 'bg-slate-200 text-slate-900 hover:bg-slate-300'
                }`}
              >
                <ChevronUp size={16} /> Précédent
              </button>
              <button
                onClick={() => setCurrentStep(Math.min(instructions.length - 1, currentStep + 1))}
                disabled={currentStep === instructions.length - 1}
                className={`flex-1 px-3 py-2 rounded-lg font-bold transition-all text-sm flex items-center justify-center gap-2 ${
                  currentStep === instructions.length - 1
                    ? isDarkMode
                      ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    : isDarkMode
                      ? 'bg-blue-600 text-white hover:bg-blue-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Suivant <ChevronDown size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
