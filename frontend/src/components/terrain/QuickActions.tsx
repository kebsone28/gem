/**
 * Composant Quick Actions - Actions rapides pour le mode terrain
 * Position flottante pour accès rapide depuis n'importe quel écran
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  CheckCircle, 
  FileText, 
  AlertTriangle, 
  Navigation, 
  Phone,
  X,
  Plus
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  action: () => void;
}

interface QuickActionsProps {
  onPhoto?: () => void;
  onStatus?: () => void;
  onNote?: () => void;
  onAlert?: () => void;
  onNavigate?: () => void;
  onCall?: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onPhoto,
  onStatus,
  onNote,
  onAlert,
  onNavigate,
  onCall
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const actions: QuickAction[] = [
    { 
      id: 'photo', 
      label: 'Photo', 
      icon: <Camera className="w-5 h-5" />,
      color: 'bg-blue-500 hover:bg-blue-600',
      action: () => { onPhoto?.(); setIsOpen(false); }
    },
    { 
      id: 'status', 
      label: 'Statut', 
      icon: <CheckCircle className="w-5 h-5" />,
      color: 'bg-green-500 hover:bg-green-600',
      action: () => { onStatus?.(); setIsOpen(false); }
    },
    { 
      id: 'note', 
      label: 'Note', 
      icon: <FileText className="w-5 h-5" />,
      color: 'bg-yellow-500 hover:bg-yellow-600',
      action: () => { onNote?.(); setIsOpen(false); }
    },
    { 
      id: 'alert', 
      label: 'Alerte', 
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'bg-red-500 hover:bg-red-600',
      action: () => { onAlert?.(); setIsOpen(false); }
    },
    { 
      id: 'navigate', 
      label: 'Naviguer', 
      icon: <Navigation className="w-5 h-5" />,
      color: 'bg-purple-500 hover:bg-purple-600',
      action: () => { onNavigate?.(); setIsOpen(false); }
    },
    { 
      id: 'call', 
      label: 'Appeler', 
      icon: <Phone className="w-5 h-5" />,
      color: 'bg-teal-500 hover:bg-teal-600',
      action: () => { onCall?.(); setIsOpen(false); }
    },
  ];

  return (
    <div className="fixed bottom-24 right-4 z-50 md:hidden">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-14 right-0 flex flex-col-reverse gap-2"
          >
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={action.action}
                className={`${action.color} text-white p-3 rounded-full shadow-lg flex items-center gap-2`}
              >
                {action.icon}
                <span className="text-xs font-medium">{action.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`${isOpen ? 'bg-slate-600' : 'bg-blue-600'} text-white p-4 rounded-full shadow-xl`}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </motion.button>
    </div>
  );
};

/**
 * Bouton flottant pour mode hors-ligne
 */
export const OfflineIndicator: React.FC<{ isOffline: boolean; pendingCount?: number }> = ({ 
  isOffline, 
  pendingCount = 0 
}) => {
  if (!isOffline && pendingCount === 0) return null;

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 md:hidden">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`px-4 py-2 rounded-full flex items-center gap-2 shadow-lg ${
          isOffline ? 'bg-yellow-500' : 'bg-blue-500'
        } text-white text-sm font-medium`}
      >
        {isOffline ? (
          <>
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Mode hors-ligne
          </>
        ) : (
          <>
            <span className="w-2 h-2 bg-white rounded-full" />
            {pendingCount} action(s) en attente
          </>
        )}
      </motion.div>
    </div>
  );
};

/**
 * Indicateur de synchronisation
 */
export const SyncIndicator: React.FC<{ isSyncing: boolean; lastSync?: Date }> = ({ 
  isSyncing, 
  lastSync 
}) => {
  return (
    <div className="flex items-center gap-2 text-xs text-slate-400">
      {isSyncing ? (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>Synchronisation...</span>
        </div>
      ) : lastSync ? (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full" />
          <span>Sync: {new Date(lastSync).toLocaleTimeString()}</span>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Bouton de capture photo flottant
 */
export const FloatingPhotoButton: React.FC<{
  onCapture: () => void;
  onSelect: () => void;
  disabled?: boolean;
}> = ({ onCapture, onSelect, disabled }) => {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="fixed bottom-32 right-4 z-50 md:hidden">
      <AnimatePresence>
        {showOptions && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-12 right-0 flex flex-col gap-2"
          >
            <button
              onClick={() => { onCapture(); setShowOptions(false); }}
              disabled={disabled}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm"
            >
              <Camera className="w-4 h-4" />
              Caméra
            </button>
            <button
              onClick={() => { onSelect(); setShowOptions(false); }}
              disabled={disabled}
              className="bg-slate-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm"
            >
              <FileText className="w-4 h-4" />
              Galerie
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowOptions(!showOptions)}
        disabled={disabled}
        className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-xl"
      >
        <Camera className="w-6 h-6" />
      </motion.button>
    </div>
  );
};