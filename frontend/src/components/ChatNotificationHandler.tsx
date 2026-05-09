import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getSocketInstance } from '../hooks/useWebSockets';
import { useAuth } from '../contexts/AuthContext';
import { type ChatMessage } from '../services/chatService';

/**
 * ChatNotificationHandler
 * Listen for chat messages globally and show notifications when not on the chat page.
 */
export default function ChatNotificationHandler() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Request notification permission on mount
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('[CHAT-NOTIF] Permission requested:', permission);
        });
      } else {
        console.log('[CHAT-NOTIF] Current permission:', Notification.permission);
      }
    }

    const socket = getSocketInstance();
    if (!socket || !user?.id) return;

    const onMessage = (payload: { message: ChatMessage }) => {
      const msg = payload?.message;
      if (!msg) return;

      // Don't notify for our own messages
      if (msg.senderId === user.id) return;

      // Don't notify if we are already on the communication page (and window is active/focused)
      const isFocused = document.hasFocus();
      if (location.pathname === '/communication' && isFocused) return;

      // System notification if window is minimized, hidden or NOT focused
      if ((document.visibilityState === 'hidden' || !isFocused) && 'Notification' in window && Notification.permission === 'granted') {
        const orgLogo = (user as any)?.organizationConfig?.branding?.logo;

        new Notification(`💬 Nouveau message de ${msg.sender.name}`, {
          body: msg.content.slice(0, 100),
          icon: orgLogo || '/logo-proquelec.png',
          tag: 'chat-notification',
          renotify: true
        }).onclick = () => {
          window.focus();
          navigate('/communication');
        };
      }

      // Play notification sound
      try {
        const audio = new Audio(
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
        );
        audio.volume = 0.4;
        audio.play().catch(() => { });
      } catch (e) {
        console.error('Failed to play notification sound', e);
      }

      // Show toast alert
      toast.custom((t) => (
        <div
          className={`${t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-2 ring-indigo-500/50 ring-offset-2 ring-offset-slate-950 overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform`}
          onClick={() => {
            navigate('/communication');
            toast.dismiss(t.id);
          }}
        >
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shadow-lg">
                  <span className="text-lg">💬</span>
                </div>
              </div>
              <div className="ml-4 flex-1">
                <p className="text-sm font-bold text-white">
                  {msg.sender.name}
                </p>
                <p className="mt-1 text-sm text-slate-300 line-clamp-2 italic">
                  "{msg.content}"
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-white/10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toast.dismiss(t.id);
              }}
              className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-white focus:outline-none"
            >
              Fermer
            </button>
          </div>
        </div>
      ), {
        duration: 20000,
        position: 'top-center',
      });
    };

    socket.on('chat:message:new', onMessage);

    return () => {
      socket.off('chat:message:new', onMessage);
    };
  }, [user?.id, location.pathname, navigate]);

  return null;
}
