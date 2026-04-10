import React, { useRef, useState, useEffect } from 'react';
import { X, CheckCircle2, RotateCcw, PenTool } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SignatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (signatureBase64: string) => void;
    title?: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, title = "Signature du Chef de Mission" }: SignatureModalProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);

    useEffect(() => {
        if (isOpen && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                // Resize for high DPI
                const rect = canvas.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                ctx.scale(dpr, dpr);
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#1e293b';
                ctx.lineWidth = 2.5;
            }
        }
    }, [isOpen]);

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDrawing(true);
        setHasSigned(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const ctx = canvasRef.current?.getContext('2d');
        ctx?.beginPath();
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        const rect = canvasRef.current.getBoundingClientRect();
        let x, y;

        if ('touches' in e) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = (e as React.MouseEvent).clientX - rect.left;
            y = (e as React.MouseEvent).clientY - rect.top;
        }

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const clear = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            setHasSigned(false);
        }
    };

    const save = () => {
        if (!canvasRef.current || !hasSigned) return;
        // Trim white edges if possible, but for now just send as is
        const dataUrl = canvasRef.current.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
                    >
                        <header className="p-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                    <PenTool size={20} />
                                </div>
                                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight italic">{title}</h3>
                            </div>
                            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400 transition-colors" aria-label="Fermer">
                                <X size={20} />
                            </button>
                        </header>

                        <div className="p-6 space-y-4">
                            <div className="relative aspect-[16/9] bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-3xl overflow-hidden cursor-crosshair group">
                                <canvas
                                    ref={canvasRef}
                                    onMouseDown={startDrawing}
                                    onMouseMove={draw}
                                    onMouseUp={stopDrawing}
                                    onMouseLeave={stopDrawing}
                                    onTouchStart={startDrawing}
                                    onTouchMove={draw}
                                    onTouchEnd={stopDrawing}
                                    className="w-full h-full touch-none"
                                />
                                {!hasSigned && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 italic">Signer ici à l'aide de votre doigt ou souris</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={clear}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-100 dark:bg-slate-900 text-slate-500 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95"
                                >
                                    <RotateCcw size={14} /> Effacer
                                </button>
                                <button
                                    onClick={save}
                                    disabled={!hasSigned}
                                    className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-50"
                                >
                                    <CheckCircle2 size={14} /> Enregistrer la Signature
                                </button>
                            </div>
                        </div>

                        <footer className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-white/5 text-center">
                            <p className="text-xs font-medium text-slate-400 uppercase tracking-tighter">
                                Valeur juridique conforme au protocole PROQUELEC • {new Date().toLocaleDateString('fr-FR')}
                            </p>
                        </footer>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
