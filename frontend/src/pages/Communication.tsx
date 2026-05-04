/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Circle,
  Globe2,
  Lock,
  MessageSquare,
  MessagesSquare,
  Plus,
  Search,
  Send,
  ShieldBan,
  ShieldCheck,
  Trash,
  Users2,
} from 'lucide-react';
import { PageContainer, PageHeader, EmptyState, LoadingState } from '../components/layout';
import { ModulePageShell, DASHBOARD_INPUT, DASHBOARD_TEXTAREA, MODULE_ACCENTS } from '../components/dashboards/DashboardComponents';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { getSocketInstance } from '../hooks/useWebSockets';
import chatService, {
  type ChatBootstrapResponse,
  type ChatConversation,
  type ChatMessage,
  type ChatUserSummary,
} from '../services/chatService';

const accent = MODULE_ACCENTS.planning;

const getConversationRoom = (conversationId: string) => `chat_conversation_${conversationId}`;

function formatTime(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function Communication() {
  const { user } = useAuth();
  const { isAdmin } = usePermissions();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [users, setUsers] = useState<ChatUserSummary[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>({});
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const [composer, setComposer] = useState('');
  const [groupName, setGroupName] = useState('');
  const [isGroupPublic, setIsGroupPublic] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [currentUserBlocked, setCurrentUserBlocked] = useState(false);
  const [socketVersion, setSocketVersion] = useState(0);
  const [unreadConversations, setUnreadConversations] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messagesByConversation, activeConversationId]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeConversationId) || null;
  const activeConversationMessages = activeConversation ? messagesByConversation[activeConversation.id] || [] : [];
  const onlineUsersCount = users.filter((member) => member.online).length;
  const blockedUsersCount = users.filter((member) => member.blocked).length;

  const displayedUsers = users.filter((member) => {
    if (member.id === user?.id) return false;
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return (
      member.name.toLowerCase().includes(needle) ||
      member.email.toLowerCase().includes(needle) ||
      member.role.toLowerCase().includes(needle)
    );
  });

  const filteredConversations = conversations.filter((conversation) => {
    const needle = conversationSearch.trim().toLowerCase();
    if (!needle) return true;

    const haystacks = [
      getConversationLabel(conversation),
      getConversationMeta(conversation),
      conversation.lastMessage?.content || '',
      ...(conversation.participants || []).map((participant) => participant.user?.name || ''),
    ];

    return haystacks.some((value) => String(value).toLowerCase().includes(needle));
  });

  const globalConversations = filteredConversations.filter((conversation) => conversation.isGlobal);
  const groupConversations = filteredConversations.filter(
    (conversation) => conversation.type === 'GROUP' && !conversation.isGlobal
  );
  const directConversations = filteredConversations.filter((conversation) => conversation.type === 'DIRECT');

  const loadBootstrap = async () => {
    try {
      setBootstrapping(true);
      const payload: ChatBootstrapResponse = await chatService.getBootstrap();
      setUsers(payload.users);
      setConversations(payload.conversations);
      setCurrentUserBlocked(payload.currentUserBlocked);
      setActiveConversationId((current) => current || payload.globalConversationId || payload.conversations[0]?.id || '');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de charger la messagerie.');
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => {
    void loadBootstrap();
  }, []);

  useEffect(() => {
    if (!activeConversationId || messagesByConversation[activeConversationId]) return;

    let active = true;

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const messages = await chatService.getMessages(activeConversationId);
        if (!active) return;
        setMessagesByConversation((current) => ({
          ...current,
          [activeConversationId]: messages,
        }));
      } catch (error: any) {
        if (!active) return;
        toast.error(error?.response?.data?.error || 'Impossible de charger cette conversation.');
      } finally {
        if (active) setLoadingMessages(false);
      }
    };

    void loadMessages();

    return () => {
      active = false;
    };
  }, [activeConversationId, messagesByConversation]);

  useEffect(() => {
    const handleReady = () => setSocketVersion((current) => current + 1);
    window.addEventListener('socket:ready', handleReady);
    return () => window.removeEventListener('socket:ready', handleReady);
  }, []);

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket) return;

    conversations.forEach((conversation) => {
      socket.emit('join_room', getConversationRoom(conversation.id));
    });
  }, [conversations, socketVersion]);

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket || !user?.id) return;

    const handlePresence = (payload: { userIds: string[] }) => {
      const onlineIds = new Set(payload?.userIds || []);
      setUsers((current) =>
        current.map((member) => ({
          ...member,
          online: onlineIds.has(member.id),
        }))
      );
    };

    const handleConversation = (payload: { conversation: ChatConversation }) => {
      if (!payload?.conversation) return;

      socket.emit('join_room', getConversationRoom(payload.conversation.id));

      setConversations((current) => {
        const existing = current.find((item) => item.id === payload.conversation.id);
        const next = existing
          ? current.map((item) => (item.id === payload.conversation.id ? payload.conversation : item))
          : [payload.conversation, ...current];
        return [...next].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });

      if (!activeConversationId) {
        setActiveConversationId(payload.conversation.id);
      }
    };

    const handleMessage = (payload: { message: ChatMessage }) => {
      const message = payload?.message;
      if (!message) return;

      if (message.conversationId !== activeConversationId || document.visibilityState !== 'visible') {
        if (message.conversationId !== activeConversationId) {
          setUnreadConversations((current) => new Set(current).add(message.conversationId));
        }

        if (message.senderId !== user?.id) {
          toast(`Vous avez un message de ${message.sender.name}`, { icon: '💬', duration: 4000 });
          try {
            const utterance = new SpeechSynthesisUtterance(`Vous avez un message de ${message.sender.name}`);
            utterance.lang = 'fr-FR';
            utterance.rate = 1.0;
            window.speechSynthesis.speak(utterance);
          } catch (error) {
            console.error('Audio notification failed:', error);
          }
        }
      }

      setMessagesByConversation((current) => {
        const existing = current[message.conversationId] || [];
        if (existing.some((item) => item.id === message.id)) {
          return current;
        }
        return {
          ...current,
          [message.conversationId]: [...existing, message],
        };
      });

      setConversations((current) => {
        const next = current.map((conversation) =>
          conversation.id === message.conversationId
            ? {
              ...conversation,
              lastMessage: message,
              updatedAt: message.createdAt,
            }
            : conversation
        );

        return [...next].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
    };

    const handleBlockState = (payload: { userId: string; blocked: boolean; reason?: string | null }) => {
      if (!payload?.userId) return;

      setUsers((current) =>
        current.map((member) =>
          member.id === payload.userId
            ? {
              ...member,
              blocked: payload.blocked,
              blockedReason: payload.reason || null,
            }
            : member
        )
      );

      if (payload.userId === user.id) {
        setCurrentUserBlocked(payload.blocked);
        if (payload.blocked) {
          toast.error('Votre accès à la messagerie a été bloqué par un administrateur.');
        } else {
          toast.success('Votre accès à la messagerie a été rétabli.');
        }
      }
    };

  const handleConversationDeleted = (payload: { conversationId: string }) => {
      setConversations((current) => current.filter((c) => c.id !== payload.conversationId));
      setActiveConversationId((current) => (current === payload.conversationId ? '' : current));
    };

    const handleMessageDeleted = (payload: {
      conversationId: string;
      messageId: string;
      conversation?: ChatConversation;
      lastMessage?: ChatMessage | null;
    }) => {
      if (!payload?.conversationId || !payload?.messageId) return;

      setMessagesByConversation((current) => {
        const existing = current[payload.conversationId];
        if (!existing) return current;
        return {
          ...current,
          [payload.conversationId]: existing.filter((message) => message.id !== payload.messageId),
        };
      });

      if (payload.conversation) {
        setConversations((current) =>
          current
            .map((conversation) =>
              conversation.id === payload.conversationId ? payload.conversation ?? conversation : conversation
            )
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
        return;
      }

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === payload.conversationId
            ? {
                ...conversation,
                lastMessage: payload.lastMessage || null,
                updatedAt: payload.lastMessage?.createdAt || conversation.createdAt,
              }
            : conversation
        )
      );
    };

    socket.on('chat:presence', handlePresence);
    socket.on('chat:conversation:new', handleConversation);
    socket.on('chat:message:new', handleMessage);
    socket.on('chat:message:deleted', handleMessageDeleted);
    socket.on('chat:user:block-state', handleBlockState);
    socket.on('chat:conversation:deleted', handleConversationDeleted);

    return () => {
      socket.off('chat:presence', handlePresence);
      socket.off('chat:conversation:new', handleConversation);
      socket.off('chat:message:new', handleMessage);
      socket.off('chat:message:deleted', handleMessageDeleted);
      socket.off('chat:user:block-state', handleBlockState);
      socket.off('chat:conversation:deleted', handleConversationDeleted);
    };
  }, [activeConversationId, socketVersion, user?.id]);

  const getConversationLabel = (conversation: ChatConversation) => {
    if (conversation.isGlobal) return 'Salle générale';
    if (conversation.name) return conversation.name;

    const others = conversation.participants
      .filter((participant) => participant.userId !== user?.id)
      .map((participant) => participant.user.name);

    return others.length > 0 ? others.join(', ') : 'Conversation privée';
  };

  const getConversationMeta = (conversation: ChatConversation) => {
    if (conversation.isGlobal) {
      return 'Canal commun à toute l’organisation';
    }

    const others = conversation.participants.filter((participant) => participant.userId !== user?.id);
    if (conversation.type === 'DIRECT') {
      return others[0]?.user.online ? 'En ligne' : 'Hors ligne';
    }

    return `${others.length} membre(s)`;
  };

  const handleUserSelection = (userId: string) => {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const handleOpenDirectConversation = async (targetUserId: string) => {
    try {
      const conversation = await chatService.createConversation({ participantIds: [targetUserId] });
      setConversations((current) => {
        const exists = current.some((item) => item.id === conversation.id);
        const next = exists
          ? current.map((item) => (item.id === conversation.id ? conversation : item))
          : [conversation, ...current];
        return [...next].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      setActiveConversationId(conversation.id);
      setSelectedUserIds([]);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible d’ouvrir cette discussion privée.');
    }
  };

  const handleCreateSelectedConversation = async () => {
    if (selectedUserIds.length === 0) {
      toast.error('Sélectionnez au moins un membre.');
      return;
    }

    try {
      const conversation = await chatService.createConversation({
        participantIds: selectedUserIds,
        name: selectedUserIds.length > 1 || isGroupPublic ? groupName.trim() || undefined : undefined,
        isPublic: isGroupPublic,
      });
      setConversations((current) => {
        const exists = current.some((item) => item.id === conversation.id);
        const next = exists
          ? current.map((item) => (item.id === conversation.id ? conversation : item))
          : [conversation, ...current];
        return [...next].sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      setActiveConversationId(conversation.id);
      setSelectedUserIds([]);
      setGroupName('');
      setIsGroupPublic(false);
      toast.success(isGroupPublic ? 'Canal public créé.' : selectedUserIds.length > 1 ? 'Salon de groupe créé.' : 'Discussion privée ouverte.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de créer cette conversation.');
    }
  };

  const handleToggleBlock = async (member: ChatUserSummary) => {
    const nextBlocked = !member.blocked;
    const reason =
      nextBlocked && isAdmin
        ? window.prompt(`Motif du blocage de ${member.name} dans la messagerie`, member.blockedReason || '')
        : undefined;

    try {
      const payload = await chatService.setBlocked(member.id, nextBlocked, reason || undefined);
      setUsers((current) =>
        current.map((entry) =>
          entry.id === member.id
            ? {
              ...entry,
              blocked: payload.blocked,
              blockedReason: payload.reason || null,
            }
            : entry
        )
      );
      toast.success(payload.blocked ? `${member.name} est bloqué dans le chat.` : `${member.name} est débloqué.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de modifier ce blocage.');
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!window.confirm("Voulez-vous vraiment supprimer ou quitter cette conversation ?")) return;
    try {
      await chatService.deleteConversation(conversationId);
      // The socket event will handle the UI update
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Impossible de supprimer la conversation.");
    }
  };

  const handleDeleteMessage = async (conversationId: string, messageId: string) => {
    if (!window.confirm('Supprimer définitivement ce message du chat ?')) return;
    try {
      await chatService.deleteMessage(conversationId, messageId);
      toast.success('Message supprimé.');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Impossible de supprimer ce message.');
    }
  };

  const handleSendMessage = async () => {
    if (!activeConversationId) return;

    const content = composer.trim();
    if (!content) return;

    try {
      setSending(true);
      const message = await chatService.sendMessage(activeConversationId, content);
      setMessagesByConversation((current) => {
        const existing = current[activeConversationId] || [];
        if (existing.some((item) => item.id === message.id)) {
          return current;
        }
        return {
          ...current,
          [activeConversationId]: [...existing, message],
        };
      });
      setConversations((current) =>
        [...current]
          .map((conversation) =>
            conversation.id === activeConversationId
              ? { ...conversation, lastMessage: message, updatedAt: message.createdAt }
              : conversation
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
      setComposer('');
    } catch (error: any) {
      toast.error(error?.response?.data?.error || "Impossible d'envoyer ce message.");
    } finally {
      setSending(false);
    }
  };

  if (bootstrapping) {
    return (
      <PageContainer maxWidth="full">
        <LoadingState text="Chargement de la messagerie..." minHeight="min-h-[60vh]" />
      </PageContainer>
    );
  }

  const renderConversationBtn = (conversation: ChatConversation) => (
    <button
      key={conversation.id}
      type="button"
      onClick={() => {
        setActiveConversationId(conversation.id);
        setUnreadConversations((current) => {
          const next = new Set(current);
          next.delete(conversation.id);
          return next;
        });
      }}
      className={`w-full rounded-xl border p-2 text-left transition-all duration-300 relative overflow-hidden ${conversation.id === activeConversationId
          ? (conversation.isGlobal ? 'border-rose-500/40 bg-rose-500/10 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : 'border-violet-500/40 bg-violet-500/10 shadow-[0_0_15px_rgba(139,92,246,0.15)]')
          : (conversation.isGlobal ? 'border-rose-500/20 bg-rose-500/5 hover:border-rose-500/40 hover:bg-rose-500/10 hover:shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'border-white/8 bg-white/[0.03] hover:border-violet-500/30 hover:bg-violet-500/5 hover:shadow-[0_0_15px_rgba(139,92,246,0.1)]')
        }`}
    >
      {unreadConversations.has(conversation.id) && (
        <div className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
      )}
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-xl border p-2 ${conversation.isGlobal
            ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
            : conversation.type === 'GROUP'
              ? 'border-violet-500/20 bg-violet-500/10 text-violet-300'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          }`}>
          {conversation.isGlobal ? <Globe2 size={14} /> : conversation.type === 'GROUP' ? <Users2 size={14} /> : <MessageSquare size={14} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {getConversationLabel(conversation)}
              </p>
              <p className="mt-1 text-xs text-slate-400">{getConversationMeta(conversation)}</p>
            </div>
            <span className="text-[11px] text-slate-500">
              {conversation.lastMessage ? formatTime(conversation.lastMessage.createdAt) : ''}
            </span>
          </div>

          <p className="mt-3 line-clamp-2 text-xs text-slate-400">
            {conversation.lastMessage?.content || 'Aucun message pour le moment.'}
          </p>
        </div>
      </div>
    </button>
  );

  return (
    <PageContainer maxWidth="full" className="space-y-6 pt-20 pb-10">
      <PageHeader
        title="Communication d’équipe"
        subtitle="Salon général, conversations privées, groupes ciblés et régulation admin en temps réel."
        icon={MessagesSquare}
        accent="planning"
        actions={
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${accent.badge}`}>
              <Circle size={8} className="fill-current" />
              {users.filter((member) => member.online).length} en ligne
            </span>
            {currentUserBlocked && (
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-300">
                <Lock size={12} />
                Chat bloqué
              </span>
            )}
          </div>
        }
      />

      <style>{`
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes messageSlideUp {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      <ModulePageShell accent="planning">
        <div className="mb-4 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${accent.badge}`}>
                <Circle size={8} className="fill-current" />
                {onlineUsersCount} en ligne
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300">
                {filteredConversations.length} conversation(s)
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-300">
                {unreadConversations.size} non lue(s)
              </span>
              {isAdmin && blockedUsersCount > 0 && (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                  {blockedUsersCount} accès bloqué(s)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                Actif: {activeConversation ? getConversationLabel(activeConversation) : 'Aucune conversation'}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2">
                {activeConversationMessages.length} message(s) chargé(s)
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="order-1 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-3">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-violet-300">
                <Users2 size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Membres</h2>
                <p className="text-xs text-slate-400">Présence live et sélection de groupe</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Rechercher un membre"
                  className={`${DASHBOARD_INPUT} pl-11`}
                />
              </div>

              <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                {displayedUsers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => void handleOpenDirectConversation(member.id)}
                    className="w-full rounded-xl border border-white/8 bg-white/[0.03] p-2 text-left transition hover:border-white/15 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(member.id)}
                        onChange={() => handleUserSelection(member.id)}
                        onClick={(event) => event.stopPropagation()}
                        className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-950/60 text-violet-500"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">{member.name}</p>
                            <p className="truncate text-[11px] uppercase tracking-[0.16em] text-slate-500">{member.role}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] ${member.online ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                            <Circle size={6} className={member.online ? 'fill-emerald-300' : 'fill-slate-500'} />
                            {member.online ? 'On' : 'Off'}
                          </span>
                        </div>

                        <p className="mt-2 truncate text-xs text-slate-400">{member.email}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">
                            {member.blocked
                              ? member.blockedReason || 'Bloqué dans le chat'
                              : member.lastLogin
                                ? `Dernier accès ${formatDateTime(member.lastLogin)}`
                                : 'Aucune connexion enregistrée'}
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleOpenDirectConversation(member.id);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-violet-300 transition hover:bg-violet-500/20"
                            >
                              <MessageSquare size={10} />
                              MP
                            </button>
                            {isAdmin && member.id !== user?.id && (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleToggleBlock(member);
                                }}
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${member.blocked
                                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                    : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                                  }`}
                              >
                                {member.blocked ? <ShieldCheck size={10} /> : <ShieldBan size={10} />}
                                {member.blocked ? 'Débloquer' : 'Bloquer'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {displayedUsers.length === 0 && (
                  <EmptyState
                    title="Aucun membre"
                    description="Aucun utilisateur ne correspond à ce filtre."
                    icon={<Users2 size={22} />}
                    className="py-10"
                  />
                )}
              </div>

              {selectedUserIds.length > 0 && (
                <div
                  className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2 animate-slide-up-fade"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-white">Nouveau groupe</p>
                      <p className="text-xs text-violet-300">{selectedUserIds.length} membre(s) sélectionné(s)</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleCreateSelectedConversation()}
                      disabled={currentUserBlocked || selectedUserIds.length === 0}
                      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-[11px] font-black uppercase tracking-[0.14em] text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${accent.primaryButton}`}
                    >
                      <Plus size={14} />
                      Ouvrir
                    </button>
                  </div>

                  {(selectedUserIds.length > 1 || isGroupPublic) && (
                    <input
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value)}
                      placeholder="Nom du groupe (optionnel)"
                      className={`${DASHBOARD_INPUT} mt-3`}
                    />
                  )}
                  <label className="mt-3 flex items-center gap-2 cursor-pointer text-xs text-violet-200 hover:text-white transition-colors">
                    <input
                      type="checkbox"
                      checked={isGroupPublic}
                      onChange={(e) => setIsGroupPublic(e.target.checked)}
                      className="rounded border-white/20 bg-white/5 text-violet-500 focus:ring-violet-500/30"
                    />
                    Groupe public (visible par tous)
                  </label>
                </div>
              )}
            </div>
          </section>

          <section className="order-2 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-3">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-violet-300">
                <MessageSquare size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Conversations</h2>
                <p className="text-xs text-slate-400">Salon général, privé ou groupe</p>
              </div>
            </div>

            <div className="mb-3 relative">
              <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={conversationSearch}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder="Rechercher une conversation"
                className={`${DASHBOARD_INPUT} pl-11`}
              />
            </div>

            <div className="max-h-[350px] space-y-4 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
              {globalConversations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-rose-400 pl-1">Canaux Publics</h3>
                  {globalConversations.map(renderConversationBtn)}
                </div>
              )}

              {groupConversations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-violet-400 pl-1 mt-2">Groupes Privés</h3>
                  {groupConversations.map(renderConversationBtn)}
                </div>
              )}

              {directConversations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-[9px] font-black uppercase tracking-widest text-emerald-400 pl-1 mt-2">Messages Privés</h3>
                  {directConversations.map(renderConversationBtn)}
                </div>
              )}

              {filteredConversations.length === 0 && (
                <EmptyState
                  title="Aucune conversation"
                  description="Aucun salon ne correspond à cette recherche."
                  icon={<MessageSquare size={22} />}
                  className="py-12"
                />
              )}
            </div>
          </section>

          <section className="order-3 xl:col-span-2 rounded-[1.75rem] border border-white/10 bg-slate-950/35 p-3">
            {activeConversation ? (
              <div className="flex h-[600px] flex-col">
                <div className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-white/8 pb-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-white">
                        {getConversationLabel(activeConversation)}
                      </h2>
                      {activeConversation.isGlobal && (
                        <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-300">
                          Public
                        </span>
                      )}
                      {!activeConversation.isGlobal && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteConversation(activeConversation.id)}
                          className="ml-3 rounded-lg border border-rose-500/20 bg-rose-500/10 p-1.5 text-rose-400 transition hover:bg-rose-500/20 hover:text-rose-300"
                          title="Supprimer la conversation"
                        >
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-400">{getConversationMeta(activeConversation)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeConversation.participants
                      .filter((participant) => participant.userId !== user?.id)
                      .slice(0, 4)
                      .map((participant) => (
                        <span
                          key={participant.id}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-medium ${participant.user.online
                              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                              : 'border-white/10 bg-white/[0.04] text-slate-300'
                            }`}
                        >
                          <Circle size={8} className={participant.user.online ? 'fill-emerald-300' : 'fill-slate-500'} />
                          {participant.user.name}
                        </span>
                      ))}
                  </div>
                </div>

                {currentUserBlocked && (
                  <div className="mt-4 shrink-0 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                    L’administrateur a désactivé votre capacité d’écriture dans la messagerie. Vous pouvez encore consulter les échanges.
                  </div>
                )}

                <div className="mt-4 flex-1 min-h-0 space-y-3 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10">
                  {loadingMessages && !messagesByConversation[activeConversation.id] ? (
                    <LoadingState text="Chargement des messages..." minHeight="min-h-[280px]" />
                  ) : activeConversationMessages.length === 0 ? (
                    <EmptyState
                      title="Aucun message"
                      description="Démarrez la conversation avec votre équipe."
                      icon={<MessageSquare size={22} />}
                      className="min-h-[280px]"
                    />
                  ) : (
                    activeConversationMessages.map((message) => {
                      const own = message.senderId === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${own ? 'justify-end' : 'justify-start'} animate-message-slide-up`}
                        >
                          <div
                            className={`max-w-[80%] rounded-[1.5rem] border px-4 py-3 shadow-[0_18px_36px_rgba(2,6,23,0.18)] ${own
                                ? 'border-violet-500/20 bg-violet-500/14 text-white'
                                : 'border-white/8 bg-white/[0.04] text-slate-100'
                              }`}
                          >
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <span className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${own ? 'text-violet-200' : 'text-slate-400'}`}>
                                {own ? 'Vous' : message.sender.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500">{formatTime(message.createdAt)}</span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteMessage(message.conversationId, message.id)}
                                    className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-1 text-rose-300 transition hover:bg-rose-500/20"
                                    title="Supprimer ce message"
                                  >
                                    <Trash size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="mt-4 shrink-0 border-t border-white/8 pt-4">
                  <div className="grid gap-3">
                    <textarea
                      rows={4}
                      value={composer}
                      onChange={(event) => setComposer(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder={
                        currentUserBlocked
                          ? 'Messagerie bloquée par un administrateur.'
                          : 'Écrire un message...'
                      }
                      disabled={currentUserBlocked || sending}
                      className={DASHBOARD_TEXTAREA}
                    />

                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-slate-500">
                        Entrée pour envoyer, `Shift + Entrée` pour une nouvelle ligne.
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleSendMessage()}
                        disabled={currentUserBlocked || sending || !composer.trim()}
                        className={`inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[11px] font-black uppercase tracking-[0.14em] text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${accent.primaryButton}`}
                      >
                        <Send size={14} />
                        Envoyer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState
                title="Sélectionnez une conversation"
                description="Ouvrez la salle générale, un message privé ou un groupe."
                icon={<MessagesSquare size={22} />}
                className="h-[600px]"
              />
            )}
          </section>
        </div>
      </ModulePageShell>
    </PageContainer>
  );
}
