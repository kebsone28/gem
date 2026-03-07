/**
 * PhotoLightbox.tsx
 *
 * Affiche une photo en plein écran avec navigation entre photos du même ménage.
 * Appelé depuis le panneau de détail d'un ménage.
 */
import React, { useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PhotoLightboxProps {
    photos: { url: string; label: string }[];
    initialIndex?: number;
    onClose: () => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
    photos,
    initialIndex = 0,
    onClose,
}) => {
    const [current, setCurrent] = React.useState(initialIndex);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowRight') setCurrent(c => Math.min(c + 1, photos.length - 1));
            if (e.key === 'ArrowLeft') setCurrent(c => Math.max(c - 1, 0));
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose, photos.length]);

    const photo = photos[current];

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-2xl flex items-center justify-center"
        >
            {/* Close button */}
            <button
                onClick={onClose}
                title="Fermer"
                className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
            >
                <X size={18} />
            </button>

            {/* Download button */}
            <a
                href={photo.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                title="Télécharger"
                className="absolute top-4 right-16 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
            >
                <Download size={16} />
            </a>

            {/* Prev button */}
            {current > 0 && (
                <button
                    onClick={e => { e.stopPropagation(); setCurrent(c => c - 1); }}
                    title="Photo précédente"
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
                >
                    <ChevronLeft size={24} />
                </button>
            )}

            {/* Next button */}
            {current < photos.length - 1 && (
                <button
                    onClick={e => { e.stopPropagation(); setCurrent(c => c + 1); }}
                    title="Photo suivante"
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
                >
                    <ChevronRight size={24} />
                </button>
            )}

            {/* Image */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={current}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onClick={e => e.stopPropagation()}
                    className="max-w-4xl max-h-[80vh] w-full mx-4 flex flex-col items-center gap-3"
                >
                    <img
                        src={photo.url}
                        alt={photo.label}
                        className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl"
                    />
                    <div className="flex items-center gap-3">
                        <span className="text-white/60 text-xs">{photo.label}</span>
                        <span className="text-white/30 text-xs">{current + 1} / {photos.length}</span>
                    </div>
                    {/* Thumbnails */}
                    {photos.length > 1 && (
                        <div className="flex gap-2 mt-1">
                            {photos.map((p, i) => (
                                <button
                                    key={i}
                                    onClick={e => { e.stopPropagation(); setCurrent(i); }}
                                    title={p.label}
                                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${i === current ? 'border-white' : 'border-white/20 opacity-50 hover:opacity-75'}`}
                                >
                                    <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};
