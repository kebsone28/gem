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
    const socket = getSocketInstance();
    if (!socket || !user?.id) return;

    const onMessage = (payload: { message: ChatMessage }) => {
      const msg = payload?.message;
      if (!msg) return;

      // Don't notify for our own messages
      if (msg.senderId === user.id) return;

      // Don't notify if we are already on the communication page
      if (location.pathname === '/communication') return;

      // Play notification sound
      try {
        const audio = new Audio(
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
        );
        audio.volume = 0.4;
        audio.play().catch(() => {});
      } catch (e) {
        console.error('Failed to play notification sound', e);
      }

      // Show toast alert
      toast(`${msg.sender.name}: ${msg.content.slice(0, 60)}${msg.content.length > 60 ? '...' : ''}`, {
        icon: '💬',
        duration: 5000,
        position: 'top-right',
        style: {
          background: '#1e293b',
          color: '#f8fafc',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
          cursor: 'pointer',
        },
        onClick: () => {
          navigate('/communication');
          toast.dismiss();
        },
      } as any);
    };

    socket.on('chat:message:new', onMessage);

    return () => {
      socket.off('chat:message:new', onMessage);
    };
  }, [user?.id, location.pathname, navigate]);

  return null;
}
