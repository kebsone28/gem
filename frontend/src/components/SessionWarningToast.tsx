import { useEffect, useState, useCallback, useRef } from 'react';
import { Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const TIMEOUT_MS = 30 * 60 * 1000;    // 30 minutes
const WARNING_MS = 2 * 60 * 1000;     // warn at 2 minutes remaining

export default function SessionWarningToast() {
    const { user, logout } = useAuth();
    const [showWarning, setShowWarning] = useState(false);
    const [countdown, setCountdown] = useState(120); // seconds
    const lastActivityRef = useRef(Date.now());
    const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const clearAllTimers = () => {
        if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        if (countdownRef.current) clearInterval(countdownRef.current);
    };

    const scheduleTimers = useCallback(() => {
        clearAllTimers();
        setShowWarning(false);

        warningTimerRef.current = setTimeout(() => {
            setShowWarning(true);
            setCountdown(WARNING_MS / 1000);
            countdownRef.current = setInterval(() => {
                setCountdown(c => {
                    if (c <= 1) {
                        if (countdownRef.current) clearInterval(countdownRef.current);
                        return 0;
                    }
                    return c - 1;
                });
            }, 1000);
        }, TIMEOUT_MS - WARNING_MS);

        logoutTimerRef.current = setTimeout(() => {
            logout();
        }, TIMEOUT_MS);
    }, [logout]);

    const resetActivity = useCallback(() => {
        lastActivityRef.current = Date.now();
        scheduleTimers();
    }, [scheduleTimers]);

    const handleExtend = () => {
        resetActivity();
    };

    useEffect(() => {
        if (!user) {
            clearAllTimers();
            return;
        }

        scheduleTimers();

        const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
        events.forEach(ev => window.addEventListener(ev, resetActivity, { passive: true }));

        return () => {
            events.forEach(ev => window.removeEventListener(ev, resetActivity));
            clearAllTimers();
        };
    }, [user, scheduleTimers, resetActivity]);

    if (!user || !showWarning) return null;

    const mins = Math.floor(countdown / 60);
    const secs = String(countdown % 60).padStart(2, '0');

    return (
        <div className="fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-slate-900 border border-amber-500/40 rounded-2xl p-5 shadow-2xl shadow-black/50 max-w-sm w-full">
                <div className="flex items-start gap-3 mb-4">
                    <div className="p-2 bg-amber-500/10 rounded-xl border border-amber-500/20 shrink-0">
                        <Clock size={18} className="text-amber-400" />
                    </div>
                    <div>
                        <p className="text-white font-black text-sm">Session expirée bientôt</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                            Vous serez déconnecté dans{' '}
                            <span className="text-amber-400 font-black tabular-nums">
                                {mins > 0 ? `${mins}:${secs}` : `${countdown}s`}
                            </span>
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExtend}
                        className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black py-2.5 rounded-xl transition-all"
                    >
                        <RefreshCw size={13} />
                        Rester connecté
                    </button>
                    <button
                        onClick={logout}
                        className="px-4 text-slate-500 hover:text-white text-xs font-bold rounded-xl border border-slate-800 hover:border-slate-700 transition-all"
                    >
                        Déconnexion
                    </button>
                </div>
            </div>
        </div>
    );
}
