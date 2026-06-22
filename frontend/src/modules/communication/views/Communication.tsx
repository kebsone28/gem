/* GED OS Communication Module - v2.1.1 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GED OS Chat — Messagerie d'équipe opérationnelle
 * Fonctionnalités : réactions, réponses citées, @mentions, indicateurs de frappe,
 * commandes rapides, recherche, markdown, panneau de conversation, avatars colorés.
 */
function safeToastError(e: any, fallback: string) {
  const err = e?.response?.data?.error;
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return (err as { message?: string }).message || fallback;
}

import React, { useEffect, useState, useRef, memo, useCallback, useMemo, Fragment } from 'react';
import { useNavigate, Link } from 'react-router-dom';

import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Edit3,
  FileText,
  Flag,
  Globe2,
  Info,
  Lock,
  Mic,
  Paperclip,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  ShieldBan,
  ShieldCheck,
  Smile,
  Star,
  Trash,
  Users2,
  Volume2,
  VolumeX,
  X,
  Zap,
  MessageSquare,
  MessagesSquare,
  AtSign,
  Command,
  LayoutGrid,
  Map,
  BarChart2,
  CalendarRange,
  HelpCircle,
  Play,
  Pause,
  StopCircle,
  Settings2,
  Trash2,
  UserMinus,
} from 'lucide-react';
import { PageContainer, LoadingState } from '@components/layout';
import { useAuth } from '@contexts/AuthContext';
import { usePermissions } from '@hooks/usePermissions';
import { PERMISSIONS } from '@core/security/permissions';
import { getSocketInstance } from '@hooks/useWebSockets';

import chatService, {
  type ChatConversation,
  type ChatMessage,
  type ChatUserSummary,
  type ChatBootstrapResponse,
} from '@services/chatService';
import * as missionService from '@services/missionService';
import apiClient from '@/api/client';
import logger from '@services/logger';

// Inline household search service (no dedicated frontend service file)
const householdService = {
  getHouseholds: async (params: { search?: string; limit?: number }) => {
    try {
      const response = await apiClient.get('/households', { params });
      return response.data?.households || response.data || [];
    } catch {
      return [];
    }
  },
};

// ══════════════════════════════════════════════════════
// TYPES & INTERFACES
// ══════════════════════════════════════════════════════

interface LocalReaction {
  emoji: string;
  userIds: string[];
}

interface ReplyContext {
  messageId: string;
  senderName: string;
  preview: string;
}

interface TypingUser {
  userId: string;
  name: string;
  ts: number;
}

interface PinnedMessageEntry {
  messageId: string;
  content: string;
  senderName: string;
  pinnedAt: number;
}

// ══════════════════════════════════════════════════════
// CONSTANTS
// ══════════════════════════════════════════════════════

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '✅', '👀'];

const QUICK_COMMANDS = [
  { cmd: '/ia', desc: 'Demander à GED OS AI 🤖 (ex: /ia quelle est la norme ?)', icon: <Zap size={14} className="text-violet-400" /> },
  { cmd: '/ménage', desc: 'Chercher un ménage (Nom ou N°)', icon: <Users2 size={14} /> },
  { cmd: '/mission', desc: 'Lier une mission', icon: <Flag size={14} /> },
  { cmd: '/status', desc: 'Diffuser un statut terrain', icon: <Zap size={14} /> },
  { cmd: '/alert', desc: 'Envoyer une alerte', icon: <Bell size={14} /> },
  { cmd: '/rapport', desc: 'Partager un rapport', icon: <FileText size={14} /> },
];

const AVATAR_COLORS = [
  'bg-indigo-500',
  'bg-rose-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-orange-500',
  'bg-teal-500',
  'bg-fuchsia-500',
  'bg-lime-500',
];

// ══════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(value?: string | null): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatDateSeparator(value: string): string {
  const d = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Very simple markdown-like rendering */
function renderMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on bold **text**, italic *text*, code `text`, strikethrough ~~text~~, replies and attachments
  const regex =
    /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|~~(.+?)~~|\[reply:([^\]]+)\]|\[(IMAGE|AUDIO|FILE):([^|]+)\|([^\]]+)\])/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(processLinks(text.slice(lastIndex, match.index), parts.length));
    }
    if (match[2]) parts.push(<strong key={match.index}>{match[2]}</strong>);
    else if (match[3]) parts.push(<em key={match.index}>{match[3]}</em>);
    else if (match[4])
      parts.push(
        <code
          key={match.index}
          className="bg-black/30 rounded px-1 py-0.5 text-[13px] font-mono text-cyan-300"
        >
          {match[4]}
        </code>
      );
    else if (match[5])
      parts.push(
        <del key={match.index} className="opacity-60">
          {match[5]}
        </del>
      );
    else if (match[7]) {
      // This is IMAGE/AUDIO/FILE
      const type = match[7];
      const filename = match[8];
      const dataUrl = match[9];

      if (type === 'IMAGE') {
        parts.push(
          <div key={match.index} className="mt-2 mb-1">
            <img
              src={dataUrl}
              alt={filename}
              className="max-w-full rounded-lg max-h-64 object-contain shadow-sm border border-white/10"
            />
            <p className="text-[10px] opacity-70 mt-1">{filename}</p>
          </div>
        );
      } else if (type === 'AUDIO') {
        parts.push(
          <div key={match.index} className="mt-2 mb-1">
            <audio controls src={dataUrl} className="w-full max-w-[250px] h-9 custom-audio" />
            <p className="text-[10px] opacity-70 mt-1">{filename}</p>
          </div>
        );
      } else {
        parts.push(
          <a
            key={match.index}
            href={dataUrl}
            download={filename}
            className="flex items-center gap-2 mt-2 mb-1 p-2.5 bg-black/20 rounded-xl hover:bg-black/30 transition-colors border border-white/5 w-fit"
          >
            <div className="bg-indigo-500/20 p-1.5 rounded-lg text-indigo-300 shrink-0">
              <Paperclip size={16} />
            </div>
            <span className="text-[13px] font-medium underline truncate max-w-[200px]">
              {filename}
            </span>
          </a>
        );
      }
    }
    // [reply:...] is handled separately in extractReplyFromContent
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(processLinks(text.slice(lastIndex), parts.length + 1000));
  }

  return parts.length > 0 ? parts : [processLinks(text, 0)];
}

function processLinks(text: string, baseKey: number): React.ReactNode {
  // Detect http links and mission refs like [MISSION-2024-00001]
  const linkRegex = /(https?:\/\/[^\s]+|\[MISSION-[\w-]+\])/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m;
  while ((m = linkRegex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith('http')) {
      parts.push(
        <a
          key={baseKey + m.index}
          href={m[0]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
        >
          {m[0]}
        </a>
      );
    } else {
      parts.push(
        <span
          key={baseKey + m.index}
          className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded text-[12px] font-mono cursor-pointer hover:bg-indigo-500/40"
        >
          {m[0]}
        </span>
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length > 1 ? <Fragment>{parts}</Fragment> : parts[0] || text;
}

function extractReplyFromContent(content: string): {
  replyBlock: string | null;
  actualContent: string;
} {
  // Format: > Réponse à [Name]:\n> preview...\n\nactual content
  if (!content.startsWith('> ')) return { replyBlock: null, actualContent: content };
  const lines = content.split('\n');
  const replyLines: string[] = [];
  let i = 0;
  while (i < lines.length && lines[i].startsWith('> ')) {
    replyLines.push(lines[i].slice(2));
    i++;
  }
  // Skip blank line after quote
  if (lines[i] === '') i++;
  const actualContent = lines.slice(i).join('\n').trim();
  return { replyBlock: replyLines.join('\n'), actualContent };
}

function buildReplyContent(reply: ReplyContext, newContent: string): string {
  const preview = reply.preview.length > 80 ? reply.preview.slice(0, 80) + '…' : reply.preview;
  return `> Réponse à ${reply.senderName}:\n> ${preview}\n\n${newContent}`;
}

// ══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════

/** Colored avatar with initials */
const GedOsAvatar = memo(
  ({
    name,
    size = 10,
    online,
    status,
  }: {
    name: string;
    size?: number;
    online?: boolean;
    status?: 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
  }) => {
    const colorClass = getAvatarColor(name);
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    const px = `h-${size} w-${size}`;

    let statusColor = 'bg-slate-600';
    if (online) {
      if (status === 'AWAY') statusColor = 'bg-amber-400';
      else if (status === 'DND') statusColor = 'bg-rose-500';
      else statusColor = 'bg-emerald-400'; // ONLINE ou non défini
    }

    return (
      <div
        className={`relative shrink-0 ${px} rounded-full ${colorClass} flex items-center justify-center text-white font-bold shadow-lg select-none`}
        style={{ fontSize: size * 1.6 }}
        title={name}
      >
        {initial}
        {online !== undefined && (
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${statusColor}`}
          />
        )}
      </div>
    );
  }
);
GedOsAvatar.displayName = 'GedOsAvatar';

/** Animated typing dots */
const TypingIndicator = memo(({ users }: { users: TypingUser[] }) => {
  const aiUser = users.find(u => u.name?.includes('GED OS AI'));
  const humanUsers = users.filter(u => !u.name?.includes('GED OS AI'));

  const label =
    aiUser && humanUsers.length === 0
      ? `GED OS AI 🤖 est en train d'analyser…`
      : humanUsers.length === 1
        ? `${humanUsers[0].name} écrit…`
        : humanUsers.length === 2
          ? `${humanUsers[0].name} et ${humanUsers[1].name} écrivent…`
          : `${users.length} personnes écrivent…`;

  const isAiTyping = !!aiUser && humanUsers.length === 0;

  return (
    <div className="h-9 px-4 flex items-center shrink-0">
      <AnimatePresence initial={false}>
        {users.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className={`flex items-center gap-1 rounded-full px-3 py-1 backdrop-blur-sm border ${
              isAiTyping
                ? 'bg-violet-500/10 border-violet-500/30'
                : 'bg-slate-800/40 border-white/5'
            }`}
          >
            <div className="flex gap-1 mr-2">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className={`h-1 w-1 rounded-full ${
                    isAiTyping ? 'bg-violet-400' : 'bg-indigo-400'
                  }`}
                  animate={{ opacity: [0.4, 1, 0.4], scale: isAiTyping ? [1, 1.5, 1] : [1, 1, 1] }}
                  transition={{ duration: isAiTyping ? 0.8 : 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </div>
            <span className={`text-[11px] italic ${
              isAiTyping ? 'text-violet-300 font-medium' : 'text-slate-400'
            }`}>{label}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
TypingIndicator.displayName = 'TypingIndicator';

/** Date separator between messages */
const DateSeparator = memo(({ date }: { date: string }) => (
  <div className="flex items-center gap-3 my-4 px-4 select-none">
    <div className="flex-1 h-px bg-white/8" />
    <span className="text-[11px] text-slate-500 font-medium bg-slate-900/80 px-3 py-1 rounded-full">
      {formatDateSeparator(date)}
    </span>
    <div className="flex-1 h-px bg-white/8" />
  </div>
));
DateSeparator.displayName = 'DateSeparator';

/** Emoji reaction bar */
const ReactionBar = memo(
  ({
    reactions,
    messageId,
    currentUserId,
    onReact,
  }: {
    reactions: LocalReaction[];
    messageId: string;
    currentUserId: string;
    onReact: (messageId: string, emoji: string) => void;
  }) => {
    if (reactions.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {reactions.map((r) => {
          const mine = r.userIds.includes(currentUserId);
          return (
            <button
              key={r.emoji}
              onClick={() => onReact(messageId, r.emoji)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] border transition-all ${mine ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' : 'bg-slate-800/60 border-white/8 text-slate-400 hover:bg-slate-700/60'}`}
              title={`Réaction ${r.emoji}`}
            >
              <span>{r.emoji}</span>
              <span className="font-semibold">{r.userIds.length}</span>
            </button>
          );
        })}
      </div>
    );
  }
);
ReactionBar.displayName = 'ReactionBar';

/** Emoji picker popup */
const EmojiPicker = memo(
  ({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) => (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className="absolute z-50 bottom-full mb-2 bg-slate-800 border border-white/10 rounded-2xl p-2 shadow-2xl flex gap-1"
    >
      {EMOJI_REACTIONS.map((e) => (
        <button
          key={e}
          onClick={() => {
            onSelect(e);
            onClose();
          }}
          className="h-8 w-8 flex items-center justify-center text-xl hover:bg-slate-700 rounded-xl transition-colors"
          title={`Réagir avec ${e}`}
        >
          {e}
        </button>
      ))}
    </motion.div>
  )
);
EmojiPicker.displayName = 'EmojiPicker';

/** Pinned messages bar */
const PinnedBar = memo(
  ({ pinned, onDismiss }: { pinned: PinnedMessageEntry; onDismiss: () => void }) => (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex items-center gap-3 px-4 py-2 bg-indigo-500/10 border-b border-indigo-500/20 cursor-pointer hover:bg-indigo-500/15 transition-colors"
    >
      <Pin size={14} className="text-indigo-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-indigo-400 font-semibold uppercase tracking-wide">
          Message épinglé
        </p>
        <p className="text-[13px] text-slate-300 truncate">{pinned.content}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="text-slate-500 hover:text-white transition-colors"
        title="Fermer"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
);
PinnedBar.displayName = 'PinnedBar';

/** Message context menu */
const MessageContextMenu = memo(
  ({
    x,
    y,
    isOwn,
    isAdmin,
    canPin,
    onClose,
    onReply,
    onReact,
    onCopy,
    onPin,
    onStar,
    onDelete,
    onEdit,
    onDeleteForMe,
  }: {
    x: number;
    y: number;
    msg: ChatMessage;
    isOwn: boolean;
    isAdmin: boolean;
    canPin: boolean;
    onClose: () => void;
    onReply: () => void;
    onReact: (emoji: string) => void;
    onCopy: () => void;
    onPin: () => void;
    onStar: () => void;
    onDelete: () => void;
    onEdit: () => void;
    onDeleteForMe: () => void;
  }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handle = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
      };
      document.addEventListener('mousedown', handle);
      return () => document.removeEventListener('mousedown', handle);
    }, [onClose]);

    // Adjust position to keep in viewport
    const adjustedX = Math.min(x, window.innerWidth - 200);
    const adjustedY = Math.min(y, window.innerHeight - 300);

    return (
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{ position: 'fixed', left: adjustedX, top: adjustedY, zIndex: 1000 }}
        className="bg-slate-800 border border-white/10 rounded-2xl shadow-2xl py-1 min-w-[180px] overflow-hidden"
      >
        {/* Quick reactions */}
        <div className="flex gap-1 px-2 py-2 border-b border-white/8">
          {EMOJI_REACTIONS.slice(0, 6).map((e) => (
            <button
              key={e}
              onClick={() => {
                onReact(e);
                onClose();
              }}
              className="h-8 w-8 flex items-center justify-center text-lg hover:bg-slate-700 rounded-xl transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
        {[
          {
            icon: <Reply size={15} />,
            label: 'Répondre',
            action: () => {
              onReply();
              onClose();
            },
          },
          {
            icon: <Copy size={15} />,
            label: 'Copier',
            action: () => {
              onCopy();
              onClose();
            },
          },
          {
            icon: <Star size={15} />,
            label: 'Marquer',
            action: () => {
              onStar();
              onClose();
            },
          },
          ...(canPin
            ? [
                {
                  icon: <Pin size={15} />,
                  label: 'Épingler',
                  action: () => {
                    onPin();
                    onClose();
                  },
                },
              ]
            : []),
          ...(isOwn
            ? [
                {
                  icon: <Edit3 size={15} />,
                  label: 'Modifier',
                  action: () => {
                    onEdit();
                    onClose();
                  },
                },
              ]
            : []),
          {
            icon: <Trash size={15} />,
            label: 'Supprimer pour moi',
            action: () => {
              onDeleteForMe();
              onClose();
            },
            danger: true,
          },
          ...(isOwn || isAdmin
            ? [
                {
                  icon: <Trash2 size={15} />,
                  label: 'Supprimer pour tous',
                  action: () => {
                    onDelete();
                    onClose();
                  },
                  danger: true,
                },
              ]
            : []),
        ].map((item) => (
          <button
            key={item.label}
            onClick={item.action}
            className={`flex items-center gap-3 w-full px-4 py-2.5 text-[13px] transition-colors ${(item as any).danger ? 'text-rose-400 hover:bg-rose-500/10' : 'text-slate-300 hover:bg-slate-700'}`}
          >
            <span className={(item as any).danger ? 'text-rose-400' : 'text-slate-400'}>
              {item.icon}
            </span>
            {item.label}
          </button>
        ))}
      </motion.div>
    );
  }
);
MessageContextMenu.displayName = 'MessageContextMenu';

/** Smart Context Card for internal GED OS links (Households, Missions, etc.) */
const GedOsContextCard = memo(({ type, id }: { type: string; id: string }) => {
  const [data, setData] = useState<{
    title: string;
    subtitle: string;
    status?: string;
    link: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    chatService
      .resolveEntity(type, id)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type, id]);

  if (loading)
    return (
      <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 animate-pulse">
        <div className="h-10 w-10 bg-white/10 rounded-lg shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/10 rounded w-2/3" />
          <div className="h-2 bg-white/10 rounded w-1/2" />
        </div>
      </div>
    );

  if (!data) return null;

  const Icon = type === 'household' ? Users2 : type === 'mission' ? Flag : Info;
  const statusColor =
    data.status === 'COMPLETED' || data.status === 'VALIDATED'
      ? 'text-emerald-400 bg-emerald-500/10'
      : data.status === 'IN_PROGRESS'
        ? 'text-amber-400 bg-amber-500/10'
        : 'text-slate-400 bg-white/5';

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 p-3 bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-xl flex items-center gap-3 hover:border-indigo-500/40 transition-all cursor-pointer group"
      onClick={() => navigate(data.link)}
    >
      <div
        className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${type === 'household' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-rose-500/20 text-rose-400'}`}
      >
        <Icon size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-white truncate">{data.title}</p>
          {data.status && (
            <span
              className={`text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded ${statusColor}`}
            >
              {data.status}
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 truncate">{data.subtitle}</p>
      </div>
      <ChevronRight
        size={14}
        className="text-slate-700 group-hover:text-indigo-400 transition-colors"
      />
    </motion.div>
  );
});
GedOsContextCard.displayName = 'GedOsContextCard';

/** Specialized audio player for voice messages */
const ChatAudioPlayer = memo(({ url, duration }: { url: string; duration?: number }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Pre-load audio
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.onended = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    audio.ontimeupdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
        setCurrentTime(audio.currentTime);
      }
    };
    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((e) => logger.warn('[AUDIO_PLAY_ERROR]', e));
    }
    setPlaying(!playing);
  };

  const formatTime = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 py-2 min-w-[240px] bg-white/5 rounded-2xl px-3 border border-white/5">
      <button
        onClick={togglePlay}
        className="h-9 w-9 shrink-0 rounded-full bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-400 transition-all shadow-lg shadow-indigo-500/20"
      >
        {playing ? (
          <Pause size={18} fill="currentColor" />
        ) : (
          <Play size={18} className="ml-0.5" fill="currentColor" />
        )}
      </button>
      <div className="flex-1 space-y-1">
        <div className="flex justify-between items-center text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : '--:--'}</span>
        </div>
        <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 bg-indigo-400 rounded-full"
            style={{ width: `${progress}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.2 }}
          />
        </div>
      </div>
    </div>
  );
});
ChatAudioPlayer.displayName = 'ChatAudioPlayer';

/** Checks if a string is a valid JSON file/media payload */
function isJson(str: string): boolean {
  if (!str || typeof str !== 'string' || !str.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(str);
    return typeof parsed === 'object' && parsed !== null && ('type' in parsed || 'url' in parsed);
  } catch {
    return false;
  }
}

/** Full message bubble with all features */
const MessageBubble = memo(
  ({
    msg,
    nextMsg,
    isOwn,
    isAdmin,
    currentUserId,
    reactions,
    starred,
    showName,
    onReply,
    onReact,
    onDelete,
    onDeleteForMe,
    onPin,
    onStar,
    onEdit,
    conversation,
  }: {
    msg: ChatMessage;
    prevMsg?: ChatMessage;
    nextMsg?: ChatMessage;
    isOwn: boolean;
    isAdmin: boolean;
    currentUserId: string;
    reactions: LocalReaction[];
    starred: boolean;
    pinned: boolean;
    showAvatar: boolean;
    showName: boolean;
    onReply: (msg: ChatMessage) => void;
    onReact: (messageId: string, emoji: string) => void;
    onDelete: (messageId: string) => void;
    onDeleteForMe: (messageId: string) => void;
    onPin: (msg: ChatMessage) => void;
    onStar: (msg: ChatMessage) => void;
    onEdit: (msg: ChatMessage) => void;
    conversation: ChatConversation;
  }) => {
    const [showMenu, setShowMenu] = useState(false);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [hovered, setHovered] = useState(false);
    const bubbleRef = useRef<HTMLDivElement>(null);

    const hasFile = isJson(msg.content);
    const fileData = hasFile ? JSON.parse(msg.content) : null;
    const actualContent = hasFile ? '' : msg.content;

    // Detect AI bot messages
    const isAiMessage = msg.sender?.email === 'ged-os-ai@ged-os.com' || msg.sender?.name?.includes('GED OS AI');

    // Detection of GED OS-Links
    const householdMatch = msg.content.match(/households\/([a-f0-9-]{36})/i);
    const missionMatch = msg.content.match(/missions\/([a-f0-9-]{36})/i);

    const { replyBlock, actualContent: replyExtracted } = useMemo(
      () => extractReplyFromContent(msg.content),
      [msg.content]
    );

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      setMenuPos({ x: e.clientX, y: e.clientY });
      setShowMenu(true);
    }, []);

    const groupEnd = !nextMsg || nextMsg.senderId !== msg.senderId;

    return (
      <div
        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showName ? 'mt-3' : 'mt-0.5'} px-2 md:px-4 group`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setShowEmojiPicker(false);
        }}
      >
        {/* Avatar (other user) */}
        {!isOwn && (
          <div className="shrink-0 mr-2 self-end mb-1">
            {groupEnd ? (
              isAiMessage ? (
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                  <span className="text-[15px] select-none">🤖</span>
                </div>
              ) : (
                <GedOsAvatar name={msg.sender.name} size={8} online={msg.sender.online} status={msg.sender.chatStatus} />
              )
            ) : <div className="w-8" />}
          </div>
        )}

        <div className="max-w-[80%] sm:max-w-[70%] relative">
          {/* Sender name — with AI badge if needed */}
          {showName && !isOwn && (
            <div
              className={`text-[12px] font-semibold mb-1 flex items-center gap-1.5 ${
                isAiMessage
                  ? 'text-violet-400'
                  : getAvatarColor(msg.sender.name).replace('bg-', 'text-').replace('-500', '-400')
              }`}
            >
              {msg.sender.name}
              {isAiMessage && (
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-widest bg-violet-500/15 text-violet-400 border border-violet-500/30 px-1.5 py-0.5 rounded-full">
                  <Zap size={8} />AI
                </span>
              )}
            </div>
          )}

          {/* Quick action bar (on hover) */}
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`absolute -top-9 ${isOwn ? 'right-0' : 'left-0'} flex items-center gap-1 bg-slate-800 border border-white/10 rounded-xl px-2 py-1 shadow-lg z-10`}
              >
                <div className="relative">
                  <button
                    onClick={() => setShowEmojiPicker((p) => !p)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                    title="Ajouter une réaction"
                  >
                    <Smile size={14} />
                  </button>
                  <AnimatePresence>
                    {showEmojiPicker && (
                      <EmojiPicker
                        onSelect={(e) => onReact(msg.id, e)}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => onReply(msg)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Répondre"
                >
                  <Reply size={14} />
                </button>
                <button
                  onClick={() => onStar(msg)}
                  className={`p-1.5 rounded-lg transition-colors ${starred ? 'text-amber-400 hover:bg-amber-500/10' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                  title={starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                >
                  <Star size={14} />
                </button>
                <button
                  onClick={(e) => {
                    setMenuPos({ x: e.clientX, y: e.clientY });
                    setShowMenu(true);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                  title="Plus d'options"
                >
                  <ChevronDown size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Context menu */}
          <AnimatePresence>
            {showMenu && (
              <MessageContextMenu
                x={menuPos.x}
                y={menuPos.y}
                msg={msg}
                isOwn={isOwn}
                isAdmin={isAdmin}
                canPin={true}
                onClose={() => setShowMenu(false)}
                onReply={() => onReply(msg)}
                onReact={(e) => onReact(msg.id, e)}
                onCopy={() => {
                  navigator.clipboard.writeText(replyExtracted);
                  toast.success('Copié !');
                }}
                onPin={() => onPin(msg)}
                onStar={() => onStar(msg)}
                onEdit={() => onEdit(msg)}
                onDelete={() => onDelete(msg.id)}
                onDeleteForMe={() => onDeleteForMe(msg.id)}
              />
            )}
          </AnimatePresence>

          {/* Bubble */}
          <div
            ref={bubbleRef}
            onContextMenu={handleContextMenu}
            className={`relative rounded-[20px] px-4 py-2.5 shadow-sm cursor-default select-text transition-all ${
              isOwn
                ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-500/10'
                : isAiMessage
                  ? 'bg-gradient-to-br from-violet-900/80 to-indigo-900/60 text-slate-100 rounded-tl-none border border-violet-500/20 shadow-lg shadow-violet-900/20'
                  : 'bg-slate-800 text-slate-100 rounded-tl-none border border-white/5'
            } ${hovered ? 'shadow-md brightness-110' : ''}`}
          >
            {/* Starred indicator */}
            {starred && (
              <Star size={10} className="absolute top-2 right-2 text-amber-400 opacity-70" />
            )}

            {/* Reply quote */}
            {replyBlock && (
              <div
                className={`mb-2 pl-3 border-l-2 ${isOwn ? 'border-indigo-400/60' : 'border-slate-500'} rounded`}
              >
                <p
                  className={`text-[11px] font-semibold mb-0.5 ${isOwn ? 'text-indigo-300' : 'text-slate-400'}`}
                >
                  {replyBlock.split('\n')[0].replace('Réponse à ', '').replace(':', '')}
                </p>
                <p
                  className={`text-[12px] truncate ${isOwn ? 'text-indigo-200/70' : 'text-slate-500'}`}
                >
                  {replyBlock.split('\n').slice(1).join(' ').trim()}
                </p>
              </div>
            )}

            {/* Content with markdown or media */}
            <div className="text-[14.5px] leading-relaxed break-words whitespace-pre-wrap pr-10 pb-1 font-normal">
              {hasFile ? (
                <>
                  {fileData.type === 'image' && (
                    <img
                      src={fileData.url}
                      alt={fileData.name}
                      className="max-w-full rounded-lg my-1 cursor-pointer"
                      onClick={() => window.open(fileData.url, '_blank')}
                    />
                  )}
                  {fileData.type === 'audio' && (
                    <ChatAudioPlayer url={fileData.url} duration={fileData.duration} />
                  )}
                  {fileData.type === 'file' && (
                    <a
                      href={fileData.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 bg-white/5 p-2.5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors my-1"
                    >
                      <FileText size={20} className="text-indigo-300" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-bold truncate">{fileData.name}</p>
                        <p className="text-[10px] opacity-50">
                          {(fileData.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </a>
                  )}
                </>
              ) : (
                <>
                  {actualContent && (
                    <div className="relative pr-2">
                      {renderMarkdown(actualContent)}
                      {msg.editedAt && (
                        <span className="text-[9px] text-slate-500 italic block mt-1">
                          (modifié)
                        </span>
                      )}
                    </div>
                  )}

                  {/* GED OS Context Cards */}
                  {householdMatch && <GedOsContextCard type="household" id={householdMatch[1]} />}
                  {missionMatch && <GedOsContextCard type="mission" id={missionMatch[1]} />}
                </>
              )}
            </div>

            {/* Timestamp + Read Status */}
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className={`text-[10px] ${isOwn ? 'text-indigo-300/80' : 'text-slate-500'}`}>
                {formatTime(msg.createdAt)}
              </span>
              {isOwn && (() => {
                const readers =
                  conversation?.participants?.filter(
                    (p: any) =>
                      p.userId !== msg.senderId &&
                      p.lastReadAt &&
                      new Date(p.lastReadAt).getTime() >= new Date(msg.createdAt).getTime()
                  ) || [];
                const isReadByAll =
                  readers.length > 0 && readers.length >= (conversation?.participants?.length || 1) - 1;
                const isReadBySome = readers.length > 0;
                
                const readerNames = readers.map((r: any) => r.user.name).join(', ');
                const tooltipText = isReadBySome ? `Lu par : ${readerNames}` : 'Envoyé';

                return (
                  <div title={tooltipText} className="cursor-help">
                    {isReadByAll ? (
                      <CheckCheck size={12} className="text-emerald-400" />
                    ) : isReadBySome ? (
                      <CheckCheck size={12} className="text-indigo-300" />
                    ) : (
                      <Check size={12} className="text-indigo-300/50" />
                    )}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Reactions */}
          <ReactionBar
            reactions={reactions}
            messageId={msg.id}
            currentUserId={currentUserId}
            onReact={onReact}
          />
        </div>

        {/* Avatar own side spacer */}
        {isOwn && <div className="w-2 shrink-0" />}
      </div>
    );
  }
);
MessageBubble.displayName = 'MessageBubble';

/** Conversation info panel */
const ConversationInfoPanel = memo(
  ({
    conversation,
    users,
    isAdmin,
    onClose,
    onToggleBlock,
  }: {
    conversation: ChatConversation;
    users: ChatUserSummary[];
    isAdmin: boolean;
    onClose: () => void;
    onToggleBlock: (member: ChatUserSummary) => void;
  }) => {
    const members = conversation.participants.map((p) => {
      const full = users.find((u) => u.id === p.userId);
      return { ...p, user: full || p.user };
    });

    return (
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-80 shrink-0 bg-slate-900 border-l border-white/8 flex flex-col h-full overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/8">
          <h3 className="text-[15px] font-semibold text-white">Informations</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Fermer le panneau"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Conversation icon */}
          <div className="flex flex-col items-center gap-3">
            <div
              className={`h-20 w-20 rounded-full flex items-center justify-center text-4xl shadow-xl ${
                conversation.isGlobal
                  ? 'bg-rose-500/20'
                  : conversation.type === 'GROUP'
                    ? 'bg-violet-500/20'
                    : 'bg-emerald-500/20'
              }`}
            >
              {conversation.isGlobal ? (
                <Globe2 size={36} className="text-rose-400" />
              ) : conversation.type === 'GROUP' ? (
                <Users2 size={36} className="text-violet-400" />
              ) : (
                <MessageSquare size={36} className="text-emerald-400" />
              )}
            </div>
            <div className="text-center">
              <h4 className="text-[16px] font-bold text-white">
                {conversation.name || (conversation.isGlobal ? 'Salle générale' : 'Conversation')}
              </h4>
              <p className="text-[13px] text-slate-400 mt-0.5">{members.length} participant(s)</p>
            </div>
          </div>

          {/* Members */}
          <div>
            <h5 className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-3">
              Membres
            </h5>
            <div className="space-y-2">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors group"
                >
                  <GedOsAvatar name={m.user.name} size={8} online={m.user.online} status={m.user.chatStatus} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white truncate">{m.user.name}</p>
                    <p className="text-[12px] text-slate-400 truncate">{m.user.role}</p>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => onToggleBlock(m.user)}
                      className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all ${m.user.blocked ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-rose-400 hover:bg-rose-500/10'}`}
                    >
                      {m.user.blocked ? <ShieldCheck size={14} /> : <ShieldBan size={14} />}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }
);
ConversationInfoPanel.displayName = 'ConversationInfoPanel';

/** Enhanced composer with @mentions, commands, file, voice */
const GemChatComposer = memo(
  ({
    disabled,
    conversationId,
    users,
    replyTo,
    onSend,
    onCancelReply,
    editingMessage,
    onCancelEdit,
    onSaveEdit,
  }: {
    disabled: boolean;
    conversationId: string;
    users: ChatUserSummary[];
    replyTo: ReplyContext | null;
    onSend: (content: string) => Promise<void>;
    onCancelReply: () => void;
    editingMessage: ChatMessage | null;
    onCancelEdit: () => void;
    onSaveEdit: (id: string, content: string) => Promise<void>;
  }) => {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
      if (editingMessage) {
        setText(editingMessage.content);
        if (textareaRef.current) {
          textareaRef.current.focus();
          // Adjust height
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.style.height = 'auto';
              textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
            }
          }, 0);
        }
      } else {
        setText('');
      }
    }, [editingMessage]);
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [commandQuery, setCommandQuery] = useState<string | null>(null);
    const [householdQuery, setHouseholdQuery] = useState<string | null>(null);
    const [missionQuery, setMissionQuery] = useState<string | null>(null);
    const [foundHouseholds, setFoundHouseholds] = useState<any[]>([]);
    const [foundMissions, setFoundMissions] = useState<any[]>([]);
    const [searchingHouseholds, setSearchingHouseholds] = useState(false);
    const [searchingMissions, setSearchingMissions] = useState(false);
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingTimeRef = useRef(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Emit typing events
    useEffect(() => {
      if (!conversationId || !text.trim()) return;
      const socket = getSocketInstance();
      socket?.emit('chat:typing', { conversationId });
    }, [text, conversationId]);

    // Clear interval on unmount
    useEffect(() => {
      return () => {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
      };
    }, []);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setText(val);
      // Auto-resize
      e.target.style.height = 'auto';
      e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;

      // Check for @mention
      const cursorPos = e.target.selectionStart;
      const textBefore = val.slice(0, cursorPos);

      const mentionMatch = textBefore.match(/@(\w*)$/);
      const householdCmdMatch = textBefore.match(/\/m[eé]nage\s+(.*)$/i);
      const missionCmdMatch = textBefore.match(/\/mission\s+(.*)$/i);

      if (mentionMatch) {
        setMentionQuery(mentionMatch[1]);
        setCommandQuery(null);
        setHouseholdQuery(null);
        setMissionQuery(null);
      } else if (householdCmdMatch) {
        setHouseholdQuery(householdCmdMatch[1]);
        setMentionQuery(null);
        setCommandQuery(null);
        setMissionQuery(null);
      } else if (missionCmdMatch) {
        setMissionQuery(missionCmdMatch[1]);
        setMentionQuery(null);
        setCommandQuery(null);
        setHouseholdQuery(null);
      } else if (val.startsWith('/') && !val.includes(' ')) {
        const cmd = val.slice(1).toLowerCase();
        setCommandQuery(cmd);
        setMentionQuery(null);
        setHouseholdQuery(null);
        setMissionQuery(null);
      } else {
        setMentionQuery(null);
        setCommandQuery(null);
        setHouseholdQuery(null);
        setMissionQuery(null);
      }
    };

    // Household search effect
    useEffect(() => {
      if (!householdQuery || householdQuery.length < 2) {
        setFoundHouseholds([]);
        setSearchingHouseholds(false);
        return;
      }
      setSearchingHouseholds(true);
      const timer = setTimeout(async () => {
        try {
          const results = await householdService.getHouseholds({
            search: householdQuery,
            limit: 5,
          });
          setFoundHouseholds(results);
        } catch (e) {
          logger.error('[HOUSEHOLD_SEARCH_ERROR]', e);
        } finally {
          setSearchingHouseholds(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }, [householdQuery]);

    // Mission search effect
    useEffect(() => {
      if (!missionQuery || missionQuery.length < 2) {
        setFoundMissions([]);
        setSearchingMissions(false);
        return;
      }
      setSearchingMissions(true);
      const timer = setTimeout(async () => {
        try {
          const results = await missionService.getMissions({ search: missionQuery, limit: 5 });
          setFoundMissions(results);
        } catch (e) {
          logger.error('[MISSION_SEARCH_ERROR]', e);
        } finally {
          setSearchingMissions(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }, [missionQuery]);

    const handleMentionSelect = (user: ChatUserSummary) => {
      const cursorPos = textareaRef.current?.selectionStart || text.length;
      const textBefore = text.slice(0, cursorPos);
      const textAfter = text.slice(cursorPos);
      const replaced = textBefore.replace(/@\w*$/, `@${user.name} `);
      setText(replaced + textAfter);
      setMentionQuery(null);
      textareaRef.current?.focus();
    };

    const handleCommandSelect = (cmd: string) => {
      if (cmd === 'menage' || cmd === 'ménage' || cmd === '/menage' || cmd === '/ménage') {
        setText('/ménage ');
      } else {
        setText((cmd.startsWith('/') ? cmd : `/${cmd}`) + ' ');
      }
      setCommandQuery(null);
      textareaRef.current?.focus();
    };

    const handleHouseholdSelect = (h: any) => {
      const link = `${window.location.origin}/households/${h.id}`;
      const replaced = text.replace(/\/m[eé]nage\s+.*$/i, link);
      setText(replaced);
      setHouseholdQuery(null);
      setFoundHouseholds([]);
      textareaRef.current?.focus();
    };

    const handleMissionSelect = (m: any) => {
      const link = `${window.location.origin}/missions/${m.id}`;
      const replaced = text.replace(/\/mission\s+.*$/i, link);
      setText(replaced);
      setMissionQuery(null);
      setFoundMissions([]);
      textareaRef.current?.focus();
    };

    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

    const handleToggleRecording = async () => {
      if (disabled) return;

      if (!recording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const recorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = async () => {
            const finalTime = recordingTimeRef.current; // Use Ref to avoid closure issues
            const audioBlob = new Blob(chunks, { type: 'audio/webm' });
            const file = new File([audioBlob], 'vocal.webm', { type: 'audio/webm' });

            try {
              setSending(true);
              const { url } = await chatService.uploadFile(file);
              const fileInfo = JSON.stringify({
                type: 'audio',
                url,
                name: 'Message vocal',
                duration: finalTime,
              });
              await handleSend(fileInfo);
            } catch (err) {
              logger.error('[VOICE_SEND_ERROR]', err);
              toast.error("Échec de l'envoi du vocal.");
            } finally {
              setSending(false);
              setRecordingTime(0);
            }
          };

          setMediaRecorder(recorder);
          recorder.start();
          setRecording(true);
          setRecordingTime(0);
          recordingTimeRef.current = 0;
          recordingIntervalRef.current = setInterval(() => {
            setRecordingTime((p) => p + 1);
            recordingTimeRef.current += 1;
          }, 1000);
        } catch (err) {
          logger.error('[VOICE_REC_ERROR]', err);
          toast.error("Impossible d'accéder au micro.");
        }
      } else {
        if (recordingIntervalRef.current) clearInterval(recordingIntervalRef.current);
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        }
        setRecording(false);
      }
    };

    const cancelRecording = () => {
      if (mediaRecorder) {
        mediaRecorder.onstop = null; // Prevent sending
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
      }
      setRecording(false);
    };

    const [isUrgent, setIsUrgent] = useState(false);

    const handleSend = async (customContent?: string) => {
      let content = customContent || text.trim();
      if (!content || disabled || sending) return;

      if (editingMessage && !customContent) {
        await onSaveEdit(editingMessage.id, content);
        return;
      }

      if (isUrgent && !customContent) {
        content = `🚨 **URGENT** : ${content}`;
      }

      setSending(true);
      try {
        const finalContent = replyTo ? buildReplyContent(replyTo, content) : content;
        await onSend(finalContent);
        setText('');
        setIsUrgent(false);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        onCancelReply();
      } finally {
        setSending(false);
        setShowActionMenu(false);
      }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || disabled) return;

      try {
        setSending(true);
        const { url } = await chatService.uploadFile(file);

        const fileInfo = JSON.stringify({
          type: file.type.startsWith('image/')
            ? 'image'
            : file.type.startsWith('audio/')
              ? 'audio'
              : 'file',
          url,
          name: file.name,
          size: file.size,
        });

        await handleSend(fileInfo);
      } catch (err) {
        logger.error('[CHAT_UPLOAD_ERROR]', err);
        toast.error("Échec de l'envoi du fichier.");
      } finally {
        setSending(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    const filteredUsers =
      mentionQuery !== null
        ? users
            .filter((u) => u.name.toLowerCase().startsWith(mentionQuery.toLowerCase()))
            .slice(0, 5)
        : [];

    const filteredCommands =
      commandQuery !== null
        ? QUICK_COMMANDS.filter((c) => c.cmd.slice(1).startsWith(commandQuery.toLowerCase()))
        : [];

    return (
      <div className="bg-slate-900/95 backdrop-blur-md border-t border-white/8 shrink-0">
        {/* Reply preview */}
        <AnimatePresence>
          {replyTo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-start gap-3 px-4 py-2.5 border-b border-white/8 bg-slate-800/50"
            >
              <div className="flex-1 pl-3 border-l-2 border-indigo-500 min-w-0">
                <p className="text-[11px] font-semibold text-indigo-400">{replyTo.senderName}</p>
                <p className="text-[12px] text-slate-400 truncate">{replyTo.preview}</p>
              </div>
              <button
                onClick={onCancelReply}
                className="text-slate-500 hover:text-white transition-colors mt-0.5"
                title="Annuler la réponse"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Edit preview */}
        <AnimatePresence>
          {editingMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="flex items-start gap-3 px-4 py-2.5 border-b border-white/8 bg-amber-900/20"
            >
              <div className="flex-1 pl-3 border-l-2 border-amber-500 min-w-0">
                <p className="text-[11px] font-semibold text-amber-400">Modification du message</p>
                <p className="text-[12px] text-slate-400 truncate">{editingMessage.content}</p>
              </div>
              <button
                onClick={onCancelEdit}
                className="text-slate-500 hover:text-white transition-colors mt-0.5"
                title="Annuler la modification"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Household search results */}
        <AnimatePresence>
          {(foundHouseholds.length > 0 || searchingHouseholds) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full mb-1 left-4 right-4 bg-slate-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
            >
              <div className="p-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Recherche ménage (Nom ou N°)
                </p>
                {searchingHouseholds && (
                  <div className="h-2 w-2 bg-indigo-500 rounded-full animate-ping" />
                )}
              </div>

              {searchingHouseholds && foundHouseholds.length === 0 && (
                <div className="px-4 py-3 text-[12px] text-slate-500 italic">
                  Recherche en cours...
                </div>
              )}

              {foundHouseholds.length === 0 && !searchingHouseholds && (
                <div className="px-4 py-3 text-[12px] text-slate-500 italic">
                  Aucun ménage trouvé pour "{householdQuery}"
                </div>
              )}
              {foundHouseholds.map((h) => (
                <button
                  key={h.id}
                  onClick={() => handleHouseholdSelect(h)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-slate-700 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                    <Users2 size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-white truncate">
                        {h.chefPrenom} {h.chefNom}
                      </p>
                      <span className="text-[10px] bg-white/10 px-1.5 rounded font-mono text-slate-300">
                        #{h.numeroordre}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {h.village || h.zone || 'Localisation inconnue'}
                    </p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mission search results */}
        <AnimatePresence>
          {(foundMissions.length > 0 || searchingMissions) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full mb-1 left-4 right-4 bg-slate-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
            >
              <div className="p-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Recherche mission
                </p>
                {searchingMissions && (
                  <div className="h-2 w-2 bg-rose-500 rounded-full animate-ping" />
                )}
              </div>

              {searchingMissions && foundMissions.length === 0 && (
                <div className="px-4 py-3 text-[12px] text-slate-500 italic">
                  Recherche mission...
                </div>
              )}

              {foundMissions.length === 0 && !searchingMissions && (
                <div className="px-4 py-3 text-[12px] text-slate-500 italic">
                  Aucune mission trouvée
                </div>
              )}
              {foundMissions.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleMissionSelect(m)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-slate-700 transition-colors text-left"
                >
                  <div className="h-8 w-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                    <Flag size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-bold text-white truncate">{m.title}</p>
                      <span className="text-[9px] bg-white/10 px-1.5 rounded font-bold text-slate-400 uppercase tracking-tighter">
                        {m.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {new Date(m.startDate).toLocaleDateString()} · {m.zone?.name || 'Sans zone'}
                    </p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Menu (Plus Button Popup) */}
        <AnimatePresence>
          {showActionMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="absolute bottom-full mb-4 left-4 w-72 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-[60] p-3 grid grid-cols-2 gap-2"
            >
              <div className="col-span-2 px-2 pb-1">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  Actions opérationnelles
                </p>
              </div>

              <button
                onClick={() => handleCommandSelect('/ménage')}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-indigo-500/20 border border-white/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users2 size={20} />
                </div>
                <span className="text-[11px] font-bold text-white">Ménage</span>
              </button>

              <button
                onClick={() => handleCommandSelect('/mission')}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-rose-500/20 border border-white/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Flag size={20} />
                </div>
                <span className="text-[11px] font-bold text-white">Mission</span>
              </button>

              <button
                onClick={() => handleCommandSelect('/alert')}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-orange-500/20 border border-white/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Bell size={20} />
                </div>
                <span className="text-[11px] font-bold text-white">Alerte</span>
              </button>

              <button
                onClick={() => handleCommandSelect('/status')}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-emerald-500/20 border border-white/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap size={20} />
                </div>
                <span className="text-[11px] font-bold text-white">Status</span>
              </button>

              <button
                onClick={() => handleCommandSelect('/urgent')}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-red-500/20 border border-white/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <AlertTriangle size={20} />
                </div>
                <span className="text-[11px] font-bold text-white">Urgent</span>
              </button>

              <button
                onClick={() => handleCommandSelect('/rapport')}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-cyan-500/20 border border-white/5 transition-all group"
              >
                <div className="h-10 w-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText size={20} />
                </div>
                <span className="text-[11px] font-bold text-white">Rapport</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* @mention dropdown */}
        <AnimatePresence>
          {filteredUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full mb-1 left-4 right-4 bg-slate-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
            >
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => handleMentionSelect(u)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-slate-700 transition-colors text-left"
                  title={u.name}
                >
                  <GedOsAvatar name={u.name} size={7} online={u.online} />
                  <div>
                    <p className="text-[13px] font-medium text-white">{u.name}</p>
                    <p className="text-[11px] text-slate-400">{u.role}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* /command dropdown */}
        <AnimatePresence>
          {filteredCommands.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute bottom-full mb-1 left-4 right-4 bg-slate-800 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50"
            >
              {filteredCommands.map((c) => (
                <button
                  key={c.cmd}
                  onClick={() => handleCommandSelect(c.cmd)}
                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-slate-700 transition-colors"
                  title={c.cmd}
                >
                  <span className="text-cyan-400">{c.icon}</span>
                  <div className="text-left">
                    <p className="text-[13px] font-mono font-semibold text-white">{c.cmd}</p>
                    <p className="text-[11px] text-slate-400">{c.desc}</p>
                  </div>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main composer row */}
        <div className="flex items-end gap-2 px-3 py-3">
          {/* Attachment */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowActionMenu(!showActionMenu)}
              className={`p-2.5 rounded-xl transition-all ${
                showActionMenu
                  ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Actions rapides"
            >
              <Plus size={18} className={showActionMenu ? 'rotate-45' : ''} />
            </button>

            <button
              disabled={disabled || recording}
              title="Joindre un fichier"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-40"
            >
              <Paperclip size={18} />
            </button>
          </div>

          <button
            disabled={disabled || recording}
            title="Marquer comme urgent"
            onClick={() => setIsUrgent(!isUrgent)}
            className={`p-2.5 rounded-xl transition-colors disabled:opacity-40 ${isUrgent ? 'bg-rose-500/20 text-rose-500' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'}`}
          >
            <Zap size={18} fill={isUrgent ? 'currentColor' : 'none'} />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
            title="Sélectionner un fichier"
          />

          {/* Text input or Recording indicator */}
          <div className="relative flex-1 flex items-center">
            {recording ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex-1 flex items-center gap-3 bg-slate-800 rounded-2xl border border-rose-500/30 px-4 h-[46px] w-full overflow-hidden"
              >
                <div className="flex items-center gap-1 shrink-0">
                  <div className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="text-rose-400 text-sm font-bold font-mono tabular-nums w-12 text-center">
                    {Math.floor(recordingTime / 60)}:
                    {(recordingTime % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                {/* Waveform animation */}
                <div className="flex-1 flex items-center justify-center gap-0.5 h-6">
                  {[...Array(12)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: [4, 16, 4],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 0.6,
                        delay: i * 0.05,
                      }}
                      className="w-1 bg-indigo-500/40 rounded-full"
                    />
                  ))}
                </div>

                <button
                  onClick={cancelRecording}
                  className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                  title="Annuler"
                >
                  <StopCircle size={16} />
                </button>
              </motion.div>
            ) : (
              <textarea
                ref={textareaRef}
                rows={1}
                value={text}
                onChange={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                  if (e.key === 'Escape') {
                    onCancelReply();
                    onCancelEdit();
                    setMentionQuery(null);
                    setCommandQuery(null);
                  }
                }}
                placeholder={
                  disabled
                    ? 'Messagerie bloquée'
                    : 'Message… (@mention, /commande, **gras**, *italique*)'
                }
                disabled={disabled || sending}
                className="w-full resize-none rounded-2xl bg-slate-800 border border-white/8 px-4 py-3 text-[14.5px] text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10 min-h-[46px] max-h-[150px]"
              />
            )}
          </div>

          {/* Voice / Send */}
          {text.trim() || recording ? (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => (recording ? handleToggleRecording() : void handleSend())}
              disabled={disabled || sending}
              className={`flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl shadow-lg transition-all disabled:opacity-50 ${
                recording
                  ? 'bg-emerald-600 text-white shadow-emerald-500/25 hover:bg-emerald-500'
                  : 'bg-indigo-600 text-white shadow-indigo-500/25 hover:bg-indigo-500'
              }`}
            >
              {sending ? (
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : recording ? (
                <Send size={18} className="ml-0.5" />
              ) : (
                <Send size={18} className="ml-0.5" />
              )}
            </motion.button>
          ) : (
            <button
              disabled={disabled}
              title="Message vocal"
              onClick={handleToggleRecording}
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-2xl transition-all disabled:opacity-40 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <Mic size={18} />
            </button>
          )}
        </div>

        {/* Shortcuts hint */}
        <div className="flex items-center gap-4 px-4 pb-2 text-[10px] text-slate-600">
          <span>
            <kbd className="bg-slate-800 rounded px-1">↵</kbd> Envoyer
          </span>
          <span>
            <kbd className="bg-slate-800 rounded px-1">Shift+↵</kbd> Nouvelle ligne
          </span>
          <span>
            <kbd className="bg-slate-800 rounded px-1">@</kbd> Mention
          </span>
          <span>
            <kbd className="bg-slate-800 rounded px-1">/</kbd> Commande
          </span>
        </div>
      </div>
    );
  }
);
GemChatComposer.displayName = 'GemChatComposer';

// ══════════════════════════════════════════════════════
// CHAT HELP MODAL
// ══════════════════════════════════════════════════════
function ChatHelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-indigo-500/20 flex items-center justify-center">
              <HelpCircle size={20} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Guide d'utilisation GED OS Chat</h2>
              <p className="text-xs text-slate-400">Fonctionnalités avancées et raccourcis</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          <section>
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCheck size={16} /> Statuts & Présence
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></span>
                <div>
                  <p className="text-sm text-white font-medium">En ligne</p>
                  <p className="text-xs text-slate-400">Actif et disponible</p>
                </div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]"></span>
                <div>
                  <p className="text-sm text-white font-medium">Absent</p>
                  <p className="text-xs text-slate-400">Temporairement éloigné</p>
                </div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
                <div>
                  <p className="text-sm text-white font-medium">Ne pas déranger</p>
                  <p className="text-xs text-slate-400">Occupé, notifications réduites</p>
                </div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-slate-600 shadow-[0_0_8px_rgba(71,85,105,0.5)]"></span>
                <div>
                  <p className="text-sm text-white font-medium">Hors ligne</p>
                  <p className="text-xs text-slate-400">Non connecté</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">Cliquez sur votre avatar en haut à gauche pour modifier votre statut.</p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <CheckCheck size={16} /> Accusés de lecture
            </h3>
            <div className="space-y-3">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <Check size={16} className="text-indigo-300/50 flex-shrink-0" />
                <p className="text-sm text-slate-300"><strong>Envoyé</strong> : Le message a bien été transmis au serveur.</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <CheckCheck size={16} className="text-indigo-300 flex-shrink-0" />
                <p className="text-sm text-slate-300"><strong>Lu par certains</strong> : Une partie des membres a lu le message.</p>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-white/5 flex items-center gap-3">
                <CheckCheck size={16} className="text-emerald-400 flex-shrink-0" />
                <p className="text-sm text-slate-300"><strong>Lu par tous</strong> : L'intégralité du groupe a lu le message.</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">Survolez les coches d'un de vos messages pour voir exactement qui l'a lu.</p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-violet-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Zap size={16} /> GED OS AI — Assistant Intelligent 🤖
            </h3>
            <div className="bg-gradient-to-br from-violet-900/30 to-indigo-900/20 border border-violet-500/20 rounded-xl p-4 mb-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                GED OS AI est votre assistant terrain intelligent, directement intégré dans le chat. Il répond à vos questions techniques, normes électriques, et questions opérationnelles — en temps réel.
              </p>
            </div>
            <div className="space-y-3">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-violet-500/10">
                <p className="text-xs font-bold text-violet-300 mb-2 uppercase tracking-wide">Comment l'invoquer</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <kbd className="bg-violet-900/50 border border-violet-500/30 text-violet-300 px-2 py-0.5 rounded-lg text-xs font-mono font-bold">/ia</kbd>
                    <span className="text-xs text-slate-400">suivi de votre question</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <kbd className="bg-violet-900/50 border border-violet-500/30 text-violet-300 px-2 py-0.5 rounded-lg text-xs font-mono font-bold">@GED OS</kbd>
                    <span className="text-xs text-slate-400">mention dans n'importe quel message</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-violet-500/10">
                <p className="text-xs font-bold text-violet-300 mb-2 uppercase tracking-wide">Exemples concrets</p>
                <div className="space-y-1.5">
                  {[
                    '/ia Quelle est la norme pour le câblage BT au Sénégal ?',
                    '/ia Comment calculer la capacité d\'un disjoncteur 63A ?',
                    '/ia Quels documents sont nécessaires pour une mission de terrain ?',
                    '@GED OS Donne-moi une checklist de sécurité électrique',
                  ].map((ex) => (
                    <div key={ex} className="flex items-start gap-2">
                      <span className="text-violet-500 mt-0.5 shrink-0">›</span>
                      <code className="text-[11px] text-slate-400 font-mono">{ex}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2 italic">Les réponses IA apparaissent avec un fond violet distinctif et le badge <span className="text-violet-400 font-bold">⚡ AI</span>.</p>
          </section>

          <section>
            <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare size={16} /> Outils de communication
            </h3>
            <div className="grid grid-cols-1 gap-2">
              <div className="flex items-start gap-3 p-2">
                <AtSign size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">Mentions (@)</p>
                  <p className="text-xs text-slate-400">Tapez <kbd className="bg-slate-800 px-1 rounded text-indigo-300">@</kbd> suivi du nom pour interpeller un collaborateur.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2">
                <Reply size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">Réponses</p>
                  <p className="text-xs text-slate-400">Cliquez sur <Reply size={12} className="inline mx-1"/> pour répondre spécifiquement à un message et garder le contexte.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2">
                <Smile size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">Réactions Emoji</p>
                  <p className="text-xs text-slate-400">Survolez un message et cliquez sur <Smile size={12} className="inline mx-1"/> pour ajouter une réaction rapide (👍, ❤️, etc.).</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2">
                <Pin size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">Épingler & Favoris</p>
                  <p className="text-xs text-slate-400">Épinglez <Pin size={12} className="inline mx-1"/> des messages vitaux pour tout le groupe, ou mettez en favori <Star size={12} className="inline mx-1"/> pour votre propre usage.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-2">
                <Command size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-white font-medium">Commandes Spéciales</p>
                  <p className="text-xs text-slate-400">Tapez <kbd className="bg-slate-800 px-1 rounded text-indigo-300">/ménage</kbd> dans le champ de texte pour chercher un ménage par nom ou numéro.</p>
                </div>
              </div>
            </div>
          </section>

        </div>
        
        <div className="p-4 border-t border-white/10 bg-slate-800/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// MAIN COMMUNICATION COMPONENT
// ══════════════════════════════════════════════════════

export default function Communication() {
  const { user } = useAuth();
  const { isAdmin, isDG, peut } = usePermissions();

  // ── Core state ──────────────────────────────────────
  const [bootstrapping, setBootstrapping] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [users, setUsers] = useState<ChatUserSummary[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, ChatMessage[]>
  >({});
  const [activeConversationId, setActiveConversationId] = useState('');
  const [currentUserBlocked, setCurrentUserBlocked] = useState(false);

  // ── UI state ─────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'chats' | 'contacts'>('chats');
  const [search, setSearch] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [socketVersion, setSocketVersion] = useState(0);
  const [socketConnected, setSocketConnected] = useState(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

  // ── Enhanced features state ───────────────────────────
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [replyTo, setReplyTo] = useState<ReplyContext | null>(null);
  const [reactions, setReactions] = useState<Record<string, LocalReaction[]>>({});
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<PinnedMessageEntry | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, TypingUser[]>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [showCleanupMenu, setShowCleanupMenu] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearMyConfirm, setShowClearMyConfirm] = useState(false);

  // ── Group creation ────────────────────────────────────
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isGroupPublic, setIsGroupPublic] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null); // Sentinel div at the bottom of the message list
  const chatContainerRef = useRef<HTMLDivElement>(null); // Ref for the chat container
  const activeMessageCountRef = useRef(0);
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Computed ──────────────────────────────────────────
  const activeConversation = conversations.find((c) => c.id === activeConversationId) ?? null;
  const activeMessages = activeConversation
    ? (messagesByConversation[activeConversation.id] ?? [])
    : [];

  const activeTyping = useMemo(() => {
    const list = (typingUsers[activeConversationId] ?? []).filter(
      (t) => t.userId !== user?.id && Date.now() - t.ts < 5000
    );
    return list;
  }, [typingUsers, activeConversationId, user?.id]);

  // ── Search ─────────────────────────────────────────────
  useEffect(() => {
    if (!searchOpen || !searchQuery.trim() || !activeConversationId) {
      setSearchResults([]);
      return;
    }
    const needle = searchQuery.toLowerCase();
    const results = (messagesByConversation[activeConversationId] ?? [])
      .filter((m) => m.content.toLowerCase().includes(needle))
      .slice()
      .reverse()
      .slice(0, 20);
    setSearchResults(results);
  }, [searchQuery, searchOpen, activeConversationId, messagesByConversation]);

  // ── Persist prefs ──────────────────────────────────────
  useEffect(() => {
    try {
      const s = localStorage.getItem('ged_os_chat_sound');
      if (s !== null) setSoundEnabled(s === 'true');
      const u = localStorage.getItem('ged_os_chat_unread');
      if (u) {
        const parsed = JSON.parse(u) as Record<string, number>;
        setUnreadCounts(parsed);
      }
      const star = localStorage.getItem('ged_os_chat_starred');
      if (star) setStarred(new Set(JSON.parse(star)));
    } catch {
      /* noop — localStorage peut être indisponible */
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ged_os_chat_sound', String(soundEnabled));
  }, [soundEnabled]);
  useEffect(() => {
    localStorage.setItem('ged_os_chat_unread', JSON.stringify(unreadCounts));
  }, [unreadCounts]);
  useEffect(() => {
    localStorage.setItem('ged_os_chat_starred', JSON.stringify([...starred]));
  }, [starred]);

  // ── Auto-scroll ────────────────────────────────────────
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  }, []);

  useEffect(() => {
    // Scroll to bottom when a new message is received from the current user, or if near bottom
    // Or on initial load of messages
    const count = activeMessages.length;
    const container = chatContainerRef.current;
    if (
      activeMessageCountRef.current === 0 || // Initial load
      count === 0 || // Conversation cleared
      count < activeMessageCountRef.current // Messages deleted
    ) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    } else if (count > activeMessageCountRef.current) {
      // New messages added
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 250;
        const lastMsg = activeMessages[count - 1];
        if (isNearBottom || lastMsg?.senderId === user?.id) {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    }
    activeMessageCountRef.current = count;
  }, [activeMessages.length, activeConversationId, user?.id]); // Removed scrollToBottom from dependencies as it now depends on activeMessages.length

  useEffect(() => {
    activeMessageCountRef.current = 0;
    if (activeConversationId) {
      setUnreadCounts((c) => {
        const n = { ...c };
        delete n[activeConversationId];
        return n;
      });
    }
    setReplyTo(null);
    setSearchOpen(false);
    setSearchQuery('');
    setPinned(null);
    setShowInfo(false);
  }, [activeConversationId]);

  // ── Filters ────────────────────────────────────────────
  const displayedUsers = useMemo(
    () =>
      users.filter((m) => {
        if (m.id === user?.id) return false;
        const needle = search.trim().toLowerCase();
        if (!needle) return true;
        return m.name.toLowerCase().includes(needle) || m.email.toLowerCase().includes(needle);
      }),
    [users, user?.id, search]
  );

  const filteredConversations = useMemo(
    () =>
      [...conversations]
        .filter((c) => {
          const needle = search.trim().toLowerCase();
          if (!needle) return true;
          const label = c.isGlobal ? 'Salle générale' : c.name || '';
          const participants = c.participants.map((p) => p.user?.name || '').join(' ');
          const lastMsg = c.lastMessage?.content || '';
          return [label, participants, lastMsg].some((s) => s.toLowerCase().includes(needle));
        })
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [conversations, search]
  );

  const totalUnread = Object.values(unreadCounts).reduce((s, n) => s + n, 0);

  // ── Bootstrap ──────────────────────────────────────────
  const loadBootstrap = useCallback(async () => {
    try {
      setBootstrapping(true);
      const payload: ChatBootstrapResponse = await chatService.getBootstrap();
      setUsers(payload.users);
      setConversations(payload.conversations);
      setCurrentUserBlocked(payload.currentUserBlocked);
      const defaultId = payload.globalConversationId || payload.conversations[0]?.id || '';
      if (defaultId) setActiveConversationId(defaultId);
    } catch (e: any) {
      toast.error(safeToastError(e, 'Impossible de charger la messagerie.'));
    } finally {
      setBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  // ── Load messages ──────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId || messagesByConversation[activeConversationId]) return;
    let active = true;
    const load = async () => {
      setLoadingMessages(true);
      try {
        const msgs = await chatService.getMessages(activeConversationId);
        if (!active) return;
        setMessagesByConversation((c) => ({ ...c, [activeConversationId]: msgs }));
      } catch (e: any) {
        if (!active) return;
        toast.error(safeToastError(e, 'Impossible de charger les messages.'));
      } finally {
        if (active) setLoadingMessages(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [activeConversationId, messagesByConversation]);

  // ── Socket events ──────────────────────────────────────
  // ── Socket events + reconnexion automatique avec backoff exponentiel ────────────
  useEffect(() => {
    const h = () => {
      setSocketVersion((v) => v + 1);
      setSocketConnected(true);
      reconnectAttemptsRef.current = 0;
    };
    window.addEventListener('socket:ready', h);

    const socket = getSocketInstance();
    if (socket) {
      const handleConnect = () => {
        setSocketConnected(true);
        reconnectAttemptsRef.current = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
      };
      const handleDisconnect = (reason: string) => {
        setSocketConnected(false);
        // Ne tenter de reconnexion que sur déconnexion involontaire
        if (reason === 'io server disconnect' || reason === 'io client disconnect') return;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30_000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          const s = getSocketInstance();
          if (s && !s.connected) s.connect();
        }, delay);
      };
      socket.on('connect', handleConnect);
      socket.on('disconnect', handleDisconnect);
      return () => {
        window.removeEventListener('socket:ready', h);
        socket.off('connect', handleConnect);
        socket.off('disconnect', handleDisconnect);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      };
    }
    return () => window.removeEventListener('socket:ready', h);
  }, []);

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket) return;
    conversations.forEach((c) => socket.emit('join_room', `chat_conversation_${c.id}`));
  }, [conversations, socketVersion]);

  useEffect(() => {
    const socket = getSocketInstance();
    if (!socket || !user?.id) return;

    const onPresence = (p: { userIds: string[] }) => {
      const ids = new Set(p?.userIds || []);
      setUsers((u) => u.map((m) => ({ ...m, online: ids.has(m.id) })));
    };

    const onConversation = (p: { conversation: ChatConversation }) => {
      if (!p?.conversation) return;
      socket.emit('join_room', `chat_conversation_${p.conversation.id}`);
      setConversations((c) => {
        const exists = c.find((x) => x.id === p.conversation.id);
        const next = exists
          ? c.map((x) => (x.id === p.conversation.id ? p.conversation : x))
          : [p.conversation, ...c];
        return next.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      if (!activeConversationId) setActiveConversationId(p.conversation.id);
    };

    const onMessage = (p: { message: ChatMessage }) => {
      const msg = p?.message;
      if (!msg) return;
      const isActive =
        msg.conversationId === activeConversationId && document.visibilityState === 'visible';

      if (msg.senderId !== user?.id) {
        setUnreadCounts((c) => ({ ...c, [msg.conversationId]: (c[msg.conversationId] || 0) + 1 }));

        if (!isActive) {
          if (soundEnabled) {
            try {
              const a = new Audio(
                'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
              );
              a.volume = 0.3;
              a.play().catch(() => {});
            } catch {
              /* noop — audio non supporté dans ce contexte */
            }
          }
          toast(`${msg.sender.name}: ${msg.content.slice(0, 50)}`, {
            icon: '💬',
            duration: 3000,
            id: `msg-${msg.id}`,
          });
        }
      }

      setMessagesByConversation((c) => {
        const ex = c[msg.conversationId] || [];
        if (ex.some((x) => x.id === msg.id)) return c;
        return { ...c, [msg.conversationId]: [...ex, msg] };
      });
      setConversations((c) =>
        c
          .map((x) =>
            x.id === msg.conversationId ? { ...x, lastMessage: msg, updatedAt: msg.createdAt } : x
          )
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );

      // Clear typing for this sender
      setTypingUsers((prev) => ({
        ...prev,
        [msg.conversationId]: (prev[msg.conversationId] || []).filter(
          (t) => t.userId !== msg.senderId
        ),
      }));
    };

    const onTyping = (p: { conversationId: string; userId: string; name: string }) => {
      if (!p?.conversationId || p.userId === user.id) return;
      const key = `${p.conversationId}:${p.userId}`;
      if (typingTimersRef.current[key]) clearTimeout(typingTimersRef.current[key]);
      setTypingUsers((prev) => {
        const list = (prev[p.conversationId] || []).filter((t) => t.userId !== p.userId);
        return {
          ...prev,
          [p.conversationId]: [...list, { userId: p.userId, name: p.name, ts: Date.now() }],
        };
      });
      typingTimersRef.current[key] = setTimeout(() => {
        setTypingUsers((prev) => ({
          ...prev,
          [p.conversationId]: (prev[p.conversationId] || []).filter((t) => t.userId !== p.userId),
        }));
      }, 4000);
    };

    const onBlockState = (p: { userId: string; blocked: boolean; reason?: string | null }) => {
      setUsers((c) =>
        c.map((m) =>
          m.id === p.userId ? { ...m, blocked: p.blocked, blockedReason: p.reason || null } : m
        )
      );
      if (p.userId === user.id) {
        setCurrentUserBlocked(p.blocked);
        if (p.blocked) {
          toast.error('Votre accès a été bloqué.');
        } else {
          toast.success('Votre accès a été rétabli.');
        }
      }
    };

    const onConvDeleted = (p: { conversationId: string }) => {
      setConversations((c) => c.filter((x) => x.id !== p.conversationId));
      if (activeConversationId === p.conversationId) setActiveConversationId('');
    };

    const onMsgDeleted = (p: {
      conversationId: string;
      messageId: string;
      lastMessage?: ChatMessage | null;
    }) => {
      setMessagesByConversation((c) => {
        const ex = c[p.conversationId];
        if (!ex) return c;
        return { ...c, [p.conversationId]: ex.filter((m) => m.id !== p.messageId) };
      });
      setConversations((c) =>
        c.map((x) =>
          x.id === p.conversationId
            ? {
                ...x,
                lastMessage: p.lastMessage || null,
                updatedAt: p.lastMessage?.createdAt || x.createdAt,
              }
            : x
        )
      );
    };

    const onRead = (p: { conversationId: string; userId: string }) => {
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === p.conversationId) {
            return {
              ...c,
              participants: c.participants.map((part) =>
                part.userId === p.userId ? { ...part, lastReadAt: new Date().toISOString() } : part
              ),
            };
          }
          return c;
        })
      );
    };

    const onHistoryCleared = (p: { conversationId: string }) => {
      setMessagesByConversation((c) => ({ ...c, [p.conversationId]: [] }));
      setConversations((c) =>
        c.map((x) => (x.id === p.conversationId ? { ...x, lastMessage: null, updatedAt: new Date().toISOString() } : x))
      );
    };

    const onUserStatus = (p: { userId: string; chatStatus: string; chatStatusText: string | null }) => {
      setUsers((c) =>
        c.map((m) =>
          m.id === p.userId ? { ...m, chatStatus: p.chatStatus as any, chatStatusText: p.chatStatusText } : m
        )
      );
    };

    socket.on('chat:presence', onPresence);
    socket.on('chat:conversation:new', onConversation);
    socket.on('chat:message:new', onMessage);
    socket.on('chat:typing', onTyping);
    socket.on('chat:message:deleted', onMsgDeleted);
    socket.on('chat:user:block-state', onBlockState);
    socket.on('chat:conversation:deleted', onConvDeleted);
    socket.on('chat:conversation:read', onRead);
    socket.on('chat:history:cleared', onHistoryCleared);
    socket.on('chat:user:status', onUserStatus);

    return () => {
      socket.off('chat:presence', onPresence);
      socket.off('chat:conversation:new', onConversation);
      socket.off('chat:message:new', onMessage);
      socket.off('chat:typing', onTyping);
      socket.off('chat:message:deleted', onMsgDeleted);
      socket.off('chat:user:block-state', onBlockState);
      socket.off('chat:conversation:deleted', onConvDeleted);
      socket.off('chat:conversation:read', onRead);
      socket.off('chat:history:cleared', onHistoryCleared);
      socket.off('chat:user:status', onUserStatus);
    };
  }, [activeConversationId, socketVersion, user?.id, soundEnabled]);

  // Mark as read when conversation becomes active or new message arrives
  useEffect(() => {
    if (activeConversationId && activeConversation) {
      const hasUnread = (unreadCounts[activeConversationId] || 0) > 0;
      if (hasUnread) {
        void chatService.markAsRead(activeConversationId);
        setUnreadCounts((c) => ({ ...c, [activeConversationId]: 0 }));
      }
    }
  }, [activeConversationId, activeMessages.length, activeConversation, unreadCounts]);

  // ── Actions ────────────────────────────────────────────
  const getConvLabel = useCallback(
    (c: ChatConversation) => {
      if (c.isGlobal) return '🌐 Salle générale';
      if (c.name) return c.name;
      const others = c.participants.filter((p) => p.userId !== user?.id).map((p) => p.user.name);
      return others.length > 0 ? others.join(', ') : 'Conversation';
    },
    [user?.id]
  );

  const getConvMeta = useCallback(
    (c: ChatConversation) => {
      if (c.isGlobal) return 'Canal commun à tous';
      const others = c.participants.filter((p) => p.userId !== user?.id);
      if (c.type === 'DIRECT') return others[0]?.user.online ? '● En ligne' : '○ Hors ligne';
      return `${c.participants.length} membres`;
    },
    [user?.id]
  );

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!activeConversationId) return;
      try {
        const msg = await chatService.sendMessage(activeConversationId, content);
        setMessagesByConversation((c) => {
          const ex = c[activeConversationId] || [];
          if (ex.some((x) => x.id === msg.id)) return c;
          return { ...c, [activeConversationId]: [...ex, msg] };
        });
        setConversations((c) =>
          c
            .map((x) =>
              x.id === activeConversationId
                ? { ...x, lastMessage: msg, updatedAt: msg.createdAt }
                : x
            )
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        );
      } catch (e: any) {
        toast.error(safeToastError(e, "Impossible d'envoyer."));
        throw e;
      }
    },
    [activeConversationId]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      if (!activeConversationId) return;
      try {
        const updated = await chatService.editMessage(activeConversationId, messageId, content);
        setMessagesByConversation((prev) => {
          const list = prev[activeConversationId] || [];
          return {
            ...prev,
            [activeConversationId]: list.map((m) => (m.id === messageId ? updated : m)),
          };
        });
        setEditingMessage(null);
        toast.success('Message modifié.');
      } catch (e: any) {
        toast.error(safeToastError(e, 'Impossible de modifier.'));
      }
    },
    [activeConversationId]
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!activeConversationId || !window.confirm('Supprimer ce message pour tous ?')) return;
      try {
        await chatService.deleteMessage(activeConversationId, messageId);
        toast.success('Message supprimé.');
      } catch (e: any) {
        toast.error(safeToastError(e, 'Impossible de supprimer.'));
      }
    },
    [activeConversationId]
  );

  const handleDeleteMessageForMe = useCallback(
    async (messageId: string) => {
      if (!activeConversationId) return;
      try {
        await chatService.deleteMessageForMe(activeConversationId, messageId);
        setMessagesByConversation((prev) => {
          const list = prev[activeConversationId] || [];
          return {
            ...prev,
            [activeConversationId]: list.filter((m) => m.id !== messageId),
          };
        });
        toast.success('Masqué pour vous.');
      } catch (e: any) {
        toast.error(safeToastError(e, 'Impossible de supprimer.'));
      }
    },
    [activeConversationId]
  );

  const handleReact = useCallback(
    (messageId: string, emoji: string) => {
      if (!user?.id) return;
      setReactions((prev) => {
        const msgReactions = [...(prev[messageId] || [])];
        const idx = msgReactions.findIndex((r) => r.emoji === emoji);
        if (idx >= 0) {
          const r = msgReactions[idx];
          const userIds = r.userIds.includes(user.id)
            ? r.userIds.filter((id) => id !== user.id)
            : [...r.userIds, user.id];
          if (userIds.length === 0) msgReactions.splice(idx, 1);
          else msgReactions[idx] = { ...r, userIds };
        } else {
          msgReactions.push({ emoji, userIds: [user.id] });
        }
        return { ...prev, [messageId]: msgReactions };
      });
    },
    [user?.id]
  );

  const handleReply = useCallback((msg: ChatMessage) => {
    const { actualContent } = extractReplyFromContent(msg.content);
    setReplyTo({ messageId: msg.id, senderName: msg.sender.name, preview: actualContent });
  }, []);

  const handleStar = useCallback((msg: ChatMessage) => {
    setStarred((prev) => {
      const n = new Set(prev);
      if (n.has(msg.id)) {
        n.delete(msg.id);
      } else {
        n.add(msg.id);
      }
      return n;
    });
  }, []);

  const handlePin = useCallback((msg: ChatMessage) => {
    const { actualContent } = extractReplyFromContent(msg.content);
    setPinned({
      messageId: msg.id,
      content: actualContent,
      senderName: msg.sender.name,
      pinnedAt: Date.now(),
    });
    toast.success('Message épinglé', { duration: 2000 });
  }, []);

  const handleOpenDirect = useCallback(async (targetId: string) => {
    try {
      const c = await chatService.createConversation({ participantIds: [targetId] });
      setConversations((prev) => {
        const exists = prev.some((x) => x.id === c.id);
        const next = exists ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
        return next.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      setActiveConversationId(c.id);
      setActiveTab('chats');
    } catch (e: any) {
      toast.error(safeToastError(e, "Impossible d'ouvrir."));
    }
  }, []);

  const handleCreateGroup = useCallback(async () => {
    if (selectedUserIds.length === 0) return;
    try {
      const c = await chatService.createConversation({
        participantIds: selectedUserIds,
        name: groupName.trim() || undefined,
        isPublic: isGroupPublic,
      });
      setConversations((prev) => {
        const exists = prev.some((x) => x.id === c.id);
        const next = exists ? prev.map((x) => (x.id === c.id ? c : x)) : [c, ...prev];
        return next.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );
      });
      setActiveConversationId(c.id);
      setSelectedUserIds([]);
      setGroupName('');
      setIsGroupPublic(false);
      setActiveTab('chats');
      toast.success(
        isGroupPublic
          ? 'Canal créé !'
          : selectedUserIds.length > 1
            ? 'Groupe créé !'
            : 'Conversation ouverte !'
      );
    } catch (e: any) {
      toast.error(safeToastError(e, 'Impossible de créer.'));
    }
  }, [selectedUserIds, groupName, isGroupPublic]);

  const handleDeleteConv = useCallback(async (id: string) => {
    if (!window.confirm('Quitter / supprimer cette conversation ?')) return;
    try {
      await chatService.deleteConversation(id);
    } catch (e: any) {
      toast.error(safeToastError(e, 'Impossible de supprimer.'));
    }
  }, []);

  const handleToggleBlock = useCallback(
    async (member: ChatUserSummary) => {
      const nextBlocked = !member.blocked;
      const reason =
        nextBlocked && isAdmin
          ? prompt(`Motif du blocage de ${member.name}`, member.blockedReason || '') || undefined
          : undefined;
      try {
        const r = await chatService.setBlocked(member.id, nextBlocked, reason);
        setUsers((c) =>
          c.map((m) =>
            m.id === member.id ? { ...m, blocked: r.blocked, blockedReason: r.reason || null } : m
          )
        );
        toast.success(r.blocked ? `${member.name} bloqué.` : `${member.name} débloqué.`);
      } catch (e: any) {
        toast.error(safeToastError(e, 'Impossible.'));
      }
    },
    [isAdmin]
  );

  const handleClearHistory = useCallback(async () => {
    if (!activeConversationId) {
      toast.error("Aucune conversation active pour le vidage.");
      return;
    }
    setShowClearConfirm(false);
    try {
      const res = await chatService.clearHistory(activeConversationId);
      setMessagesByConversation((prev) => ({ ...prev, [activeConversationId]: [] }));
      setConversations(prev => prev.map(c =>
        c.id === activeConversationId ? { ...c, lastMessage: null, updatedAt: new Date().toISOString() } : c
      ));
      const count = (res as any).deletedCount ?? '?';
      toast.success(`L'historique a été vidé (${count} messages supprimés).`);
    } catch (e: any) {
      const errorMsg = safeToastError(e, e?.message || 'Erreur lors du nettoyage.');
      toast.error(errorMsg);
    }
  }, [activeConversationId]);

  const handleClearMyHistory = useCallback(async () => {
    if (!activeConversationId) return;
    setShowClearMyConfirm(false);
    try {
      await chatService.clearMyHistory(activeConversationId);
      setMessagesByConversation((prev) => ({ ...prev, [activeConversationId]: [] }));
      toast.success('Votre vue a été nettoyée.');
    } catch (e: any) {
      toast.error(safeToastError(e, 'Erreur lors du nettoyage.'));
    }
  }, [activeConversationId]);

  const handleUpdateRetention = useCallback(
    async (days: number) => {
      if (!activeConversationId) return;
      try {
        await chatService.updateRetention(activeConversationId, days);
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, retentionDays: days } : c))
        );
        toast.success(`Rétention mise à jour : ${days === 0 ? 'Permanent' : days + ' jours'}`);
      } catch (e: any) {
        toast.error(safeToastError(e, 'Erreur lors de la mise à jour.'));
      }
    },
    [activeConversationId]
  );

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════

  if (bootstrapping) {
    return (
      <PageContainer maxWidth="full">
        <LoadingState text="Connexion à GED OS Chat…" minHeight="min-h-[60vh]" />
      </PageContainer>
    );
  }

  const hasActiveConv = !!activeConversation;
  const currentUserProfile = users.find((u) => u.id === user?.id);

  return (
    <>
    {/* h-full : le Layout fournit h-dvh via gem-app-shell → main → immersive div */}
    {/* Le chat ne fait que remplir l'espace disponible sans jamais déborder */}
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ═══════════════ LEFT SIDEBAR ═══════════════ */}
        <div
          className={`flex flex-col w-full md:w-80 lg:w-[340px] shrink-0 bg-slate-900/60 backdrop-blur-md border-r border-white/8 ${hasActiveConv ? 'hidden md:flex' : 'flex'}`}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-3 relative">
              <div 
                className="cursor-pointer"
                onClick={() => {
                  const menu = document.getElementById('status-menu');
                  if (menu) menu.classList.toggle('hidden');
                }}
              >
                <GedOsAvatar name={user?.name || 'U'} size={9} online={currentUserProfile?.online ?? true} status={currentUserProfile?.chatStatus} />
              </div>
              <div className="cursor-pointer" onClick={() => {
                const menu = document.getElementById('status-menu');
                if (menu) menu.classList.toggle('hidden');
              }}>
                <h1 className="text-[14px] font-bold text-white leading-tight">{user?.name}</h1>
                <p className="text-[11px] flex items-center gap-1 mt-0.5" style={{
                  color: currentUserProfile?.chatStatus === 'AWAY' ? '#fbbf24' : 
                         currentUserProfile?.chatStatus === 'DND' ? '#f43f5e' : 
                         currentUserProfile?.chatStatus === 'OFFLINE' ? '#475569' : '#34d399'
                }}>
                  <span className={`h-1.5 w-1.5 rounded-full inline-block ${
                    currentUserProfile?.chatStatus === 'AWAY' ? 'bg-amber-400' :
                    currentUserProfile?.chatStatus === 'DND' ? 'bg-rose-500' :
                    currentUserProfile?.chatStatus === 'OFFLINE' ? 'bg-slate-600' : 'bg-emerald-400 animate-pulse'
                  }`} />
                  {currentUserProfile?.chatStatus === 'AWAY' ? 'Absent' : 
                   currentUserProfile?.chatStatus === 'DND' ? 'Ne pas déranger' : 
                   currentUserProfile?.chatStatus === 'OFFLINE' ? 'Hors ligne' : 'En ligne'}
                  <ChevronDown size={10} className="ml-1 opacity-50" />
                </p>
              </div>

              {/* Status Dropdown Menu */}
              <div id="status-menu" className="hidden absolute top-full left-0 mt-2 w-48 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                <div className="p-2 border-b border-white/5 bg-white/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Modifier le statut</p>
                </div>
                {[
                  { value: 'ONLINE', label: 'En ligne', color: 'bg-emerald-400' },
                  { value: 'AWAY', label: 'Absent', color: 'bg-amber-400' },
                  { value: 'DND', label: 'Ne pas déranger', color: 'bg-rose-500' },
                  { value: 'OFFLINE', label: 'Hors ligne', color: 'bg-slate-600' }
                ].map(s => (
                  <button
                    key={s.value}
                    onClick={() => {
                      chatService.updateUserStatus(s.value).then(() => {
                        document.getElementById('status-menu')?.classList.add('hidden');
                        toast.success('Statut mis à jour');
                      }).catch(() => toast.error('Erreur lors de la mise à jour'));
                    }}
                    className={`flex items-center gap-3 w-full px-4 py-2 text-left text-[12px] hover:bg-slate-700 transition-colors ${currentUserProfile?.chatStatus === s.value ? 'bg-slate-700/50 font-bold text-white' : 'text-slate-300'}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${s.color}`} />
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {totalUnread > 0 && (
                <span className="h-5 px-1.5 min-w-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
              <button
                onClick={() => setSoundEnabled((p) => !p)}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title={soundEnabled ? 'Désactiver sons' : 'Activer sons'}
              >
                {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
              <button
                onClick={() => {
                  setActiveTab((t) => (t === 'chats' ? 'contacts' : 'chats'));
                  setSearch('');
                }}
                className={`p-1.5 rounded-lg transition-colors ${activeTab === 'contacts' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white hover:bg-slate-800'}`}
                title="Contacts"
              >
                <AtSign size={16} />
              </button>
              <button
                onClick={() => setShowHelpModal(true)}
                className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Aide & Guide d'utilisation"
              >
                <HelpCircle size={16} />
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2 border-b border-white/8">
            <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-white/8 focus-within:border-indigo-500/40 transition-all">
              <Search size={14} className="text-slate-500 shrink-0" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={activeTab === 'chats' ? 'Rechercher…' : 'Chercher un membre…'}
                title={activeTab === 'chats' ? 'Rechercher une discussion' : 'Chercher un membre'}
                className="flex-1 bg-transparent border-none focus:outline-none text-[13px] text-slate-200 placeholder-slate-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="text-slate-500 hover:text-white transition-colors"
                  title="Effacer la recherche"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-white/10">
            {activeTab === 'chats' ? (
              <>
                {filteredConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-600 px-6 text-center gap-2">
                    <MessagesSquare size={28} />
                    <p className="text-sm">Aucune discussion</p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isActive = conv.id === activeConversationId;
                    const unread = unreadCounts[conv.id] || 0;
                    const isGlobal = conv.isGlobal;
                    const isGroup = conv.type === 'GROUP';
                    // For direct chats, show the other person's avatar
                    const otherParticipant =
                      !isGlobal && !isGroup
                        ? conv.participants?.find((p: { userId: string }) => p.userId !== user?.id)
                        : null;
                    const otherUser = otherParticipant
                      ? users.find((u) => u.id === otherParticipant.userId)
                      : null;
                    const lastMsgPreview =
                      conv.lastMessage?.content?.slice(0, 55) || 'Aucun message';
                    const isLastMine = conv.lastMessage?.senderId === user?.id;

                    return (
                      <motion.button
                        key={conv.id}
                        layout
                        onClick={() => setActiveConversationId(conv.id)}
                        className={`relative flex items-center gap-3 w-full px-3 py-3 transition-all group ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-600/20 to-violet-600/10'
                            : 'hover:bg-slate-800/50'
                        }`}
                        title={getConvLabel(conv)}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <motion.div
                            layoutId="activeBar"
                            className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-indigo-400 to-violet-500"
                          />
                        )}

                        {/* Avatar */}
                        <div className="relative shrink-0">
                          {isGlobal ? (
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shadow-lg shadow-rose-500/20">
                              <Globe2 size={20} className="text-white" />
                            </div>
                          ) : isGroup ? (
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
                              <Users2 size={20} className="text-white" />
                            </div>
                          ) : otherUser ? (
                            <GedOsAvatar name={otherUser.name} size={12} online={otherUser.online} />
                          ) : (
                            <div className="h-12 w-12 rounded-2xl bg-slate-700 flex items-center justify-center">
                              <MessageSquare size={18} className="text-slate-400" />
                            </div>
                          )}
                          {/* Unread dot */}
                          {unread > 0 && (
                            <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-[10px] font-black flex items-center justify-center shadow-md shadow-indigo-500/40">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>

                        {/* Text content */}
                        <div className="flex-1 min-w-0 text-left">
                          <div className="flex justify-between items-center mb-0.5">
                            <span
                              className={`text-[13.5px] truncate leading-tight ${
                                unread ? 'font-bold text-white' : 'font-semibold text-slate-200'
                              }`}
                            >
                              {getConvLabel(conv)}
                            </span>
                            <span
                              className={`text-[10px] shrink-0 ml-2 tabular-nums ${
                                unread ? 'text-indigo-400 font-bold' : 'text-slate-600'
                              }`}
                            >
                              {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {isLastMine && (
                              <CheckCheck size={12} className="shrink-0 text-indigo-400" />
                            )}
                            <span
                              className={`text-[12px] truncate ${
                                unread ? 'text-slate-300' : 'text-slate-500'
                              }`}
                            >
                              {lastMsgPreview}
                            </span>
                          </div>
                        </div>
                      </motion.button>
                    );
                  })
                )}
              </>
            ) : (
              <div className="p-3 space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 px-2 mb-2">
                    Équipe · {displayedUsers.filter((u) => u.online).length} en ligne
                  </p>
                  {displayedUsers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer group"
                      onClick={() => void handleOpenDirect(member.id)}
                    >
                      <GedOsAvatar name={member.name} size={9} online={member.online} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-slate-200 truncate">
                          {member.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{member.role}</p>
                      </div>
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleToggleBlock(member);
                            }}
                            className={`p-1.5 rounded-lg ${member.blocked ? 'text-emerald-400 hover:bg-emerald-500/10' : 'text-rose-400 hover:bg-rose-500/10'}`}
                            title={member.blocked ? 'Débloquer' : 'Bloquer'}
                          >
                            {member.blocked ? <ShieldCheck size={13} /> : <ShieldBan size={13} />}
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={selectedUserIds.includes(member.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            setSelectedUserIds((c) =>
                              c.includes(member.id)
                                ? c.filter((id) => id !== member.id)
                                : [...c, member.id]
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-0"
                          title={`Sélectionner ${member.name}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <AnimatePresence>
                  {selectedUserIds.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="bg-slate-800/80 rounded-2xl p-4 border border-white/8 shadow-xl"
                    >
                      <h3 className="text-[13px] font-bold text-white mb-3 flex items-center gap-2">
                        <Users2 size={14} className="text-indigo-400" />
                        {selectedUserIds.length > 1
                          ? `Groupe (${selectedUserIds.length})`
                          : 'Discussion privée'}
                      </h3>
                      {selectedUserIds.length > 1 && (
                        <>
                          <input
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Nom du groupe…"
                            title="Nom du groupe"
                            className="w-full bg-slate-900 rounded-xl px-3 py-2 text-[13px] text-white border border-white/8 focus:border-indigo-500/40 focus:outline-none mb-3 placeholder-slate-600"
                          />
                          <label className="flex items-center gap-2 text-[12px] text-slate-400 mb-4 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isGroupPublic}
                              onChange={(e) => setIsGroupPublic(e.target.checked)}
                              className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                              title="Rendre le canal public"
                            />
                            <Globe2 size={12} /> Canal public (visible par tous)
                          </label>
                        </>
                      )}
                      <button
                        onClick={() => void handleCreateGroup()}
                        className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus size={14} />{' '}
                        {selectedUserIds.length > 1 ? 'Créer le groupe' : 'Ouvrir la discussion'}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          {/* ── Bottom navigation bar ── */}
          <div className="shrink-0 border-t border-white/[0.06] bg-slate-950/80 backdrop-blur-md">
            {/* Dashboard link */}
            <div className="px-3 pt-3 pb-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600/10 to-violet-600/10 border border-indigo-500/20 text-slate-300 hover:text-white hover:from-indigo-600/20 hover:to-violet-600/20 hover:border-indigo-500/40 transition-all group text-[12.5px] font-semibold"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/30 shrink-0">
                  <LayoutGrid size={14} className="text-white" />
                </span>
                <span className="flex-1">Tableau de bord</span>
                <ChevronRight
                  size={14}
                  className="text-slate-600 group-hover:text-indigo-400 transition-colors"
                />
              </Link>
            </div>

            {/* Quick nav pills */}
            <div className="flex items-center gap-1 px-3 pb-3">
              {(
                [
                  {
                    to: '/operations/map',
                    icon: <Map size={14} />,
                    label: 'Terrain',
                    perm: PERMISSIONS.UI_MAP,
                    color: 'hover:text-emerald-400 hover:bg-emerald-500/10',
                  },
                  {
                    to: '/rapports',
                    icon: <BarChart2 size={14} />,
                    label: 'Rapports',
                    perm: null,
                    color: 'hover:text-blue-400 hover:bg-blue-500/10',
                  },
                  {
                    to: '/planning',
                    icon: <CalendarRange size={14} />,
                    label: 'Planning',
                    perm: PERMISSIONS.UI_MAP,
                    color: 'hover:text-amber-400 hover:bg-amber-500/10',
                  },
                  {
                    to: '/aide',
                    icon: <HelpCircle size={14} />,
                    label: 'Aide',
                    perm: null,
                    color: 'hover:text-rose-400 hover:bg-rose-500/10',
                  },
                ] as {
                  to: string;
                  icon: React.ReactNode;
                  label: string;
                  perm: string | null;
                  color: string;
                }[]
              )
                .filter(({ perm }) => !perm || peut(perm))
                .map(({ to, icon, label, color }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-slate-600 ${color} transition-all text-[9.5px] font-semibold uppercase tracking-wider`}
                    title={label}
                  >
                    {icon}
                    <span>{label}</span>
                  </Link>
                ))}
            </div>
          </div>
        </div>

        {/* ═══════════════ MAIN CHAT AREA ═══════════════ */}
        {hasActiveConv ? (
          <div className="flex flex-1 min-w-0 relative">
            <div className="flex flex-col flex-1 min-w-0 relative bg-slate-950">
              {/* Background texture */}
              <div
                className="absolute inset-0 opacity-[0.015] pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '32px 32px',
                }}
              />

              {/* ── Chat header ── */}
              <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900/80 backdrop-blur-md border-b border-white/8 z-20 shrink-0">
                <div className="flex items-center gap-2 md:gap-3 min-w-0">
                  <button
                    onClick={() => setActiveConversationId('')}
                    className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
                    title="Retour"
                  >
                    <ArrowLeft size={20} />
                  </button>
                  <div
                    className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${
                      activeConversation.isGlobal
                        ? 'bg-rose-500/15 text-rose-400'
                        : activeConversation.type === 'GROUP'
                          ? 'bg-violet-500/15 text-violet-400'
                          : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {activeConversation.isGlobal ? (
                      <Globe2 size={16} />
                    ) : activeConversation.type === 'GROUP' ? (
                      <Users2 size={16} />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                  </div>
                  <div className="min-w-0 cursor-pointer" onClick={() => setShowInfo((p) => !p)}>
                    <h2 className="text-[14px] font-semibold text-white truncate leading-tight">
                      {getConvLabel(activeConversation)}
                    </h2>
                    <p className="text-[11px] text-slate-500 truncate">
                      {activeTyping.length > 0
                        ? `${activeTyping[0].name} écrit…`
                        : getConvMeta(activeConversation)}
                    </p>
                  </div>
                </div>

                {/* Indicateur reconnexion WebSocket */}
                {!socketConnected && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 shrink-0">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-[10px] text-amber-400 font-bold hidden sm:block">
                      Reconnexion...
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setSearchOpen((p) => !p);
                      setSearchQuery('');
                    }}
                    className={`p-1.5 rounded-lg transition-colors ${searchOpen ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    title="Rechercher"
                  >
                    <Search size={16} />
                  </button>
                  <button
                    onClick={() => setShowInfo((p) => !p)}
                    className={`p-1.5 rounded-lg transition-colors ${showInfo ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    title="Informations"
                  >
                    <Info size={16} />
                  </button>

                  {/* Menu Options de nettoyage — contrôlé par état */}
                  <div className="relative">
                    <button
                      id="cleanup-menu-btn"
                      aria-label="Options de nettoyage"
                      onClick={() => setShowCleanupMenu((p) => !p)}
                      className={`p-1.5 rounded-lg transition-colors ${showCleanupMenu ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                    >
                      <Settings2 size={16} />
                    </button>

                    {showCleanupMenu && (
                      <div className="absolute top-full right-0 mt-1 w-56 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden">
                        <div className="p-2 border-b border-white/5 bg-white/5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Options de nettoyage
                          </p>
                        </div>

                        <button
                          onClick={() => { setShowCleanupMenu(false); setShowClearMyConfirm(true); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-[12.5px] text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <UserMinus size={14} className="text-amber-400" />
                          Vider pour mon compte
                        </button>

                        {(isAdmin || isDG) && (
                          <button
                            id="clear-all-history-btn"
                            aria-label="Vider l'historique pour tous"
                            onClick={() => { setShowCleanupMenu(false); setShowClearConfirm(true); }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-left text-[12.5px] text-rose-400 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 size={14} />
                            Vider pour tous (Admin)
                          </button>
                        )}

                        <div className="p-2 border-t border-white/5 bg-white/5">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Rétention automatique
                          </p>
                        </div>

                        {[
                          { label: 'Permanent', days: 0 },
                          { label: '7 jours', days: 7 },
                          { label: '30 jours', days: 30 },
                          { label: '90 jours', days: 90 },
                        ].map((opt) => (
                          <button
                            key={opt.days}
                            onClick={() => { handleUpdateRetention(opt.days); setShowCleanupMenu(false); }}
                            className={`flex items-center justify-between w-full px-4 py-2 text-left text-[12px] transition-colors ${
                              activeConversation.retentionDays === opt.days
                                ? 'bg-indigo-600/20 text-indigo-400 font-bold'
                                : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Clock size={12} />
                              {opt.label}
                            </div>
                            {activeConversation.retentionDays === opt.days && <Check size={12} />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {!activeConversation.isGlobal && (
                    <button
                      onClick={() => void handleDeleteConv(activeConversation.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Supprimer la conversation"
                    >
                      <Trash size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* ── Search bar ── */}
              <AnimatePresence>
                {searchOpen && (
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: 'auto' }}
                    exit={{ height: 0 }}
                    className="bg-slate-900/60 border-b border-white/8 overflow-hidden z-10 shrink-0"
                  >
                    <div className="flex items-center gap-3 px-4 py-2.5">
                      <Search size={14} className="text-slate-500" />
                      <input
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Rechercher dans cette conversation…"
                        title="Rechercher dans cette conversation"
                        className="flex-1 bg-transparent border-none focus:outline-none text-[13px] text-slate-200 placeholder-slate-500"
                      />
                      {searchResults.length > 0 && (
                        <span className="text-[11px] text-slate-500">
                          {searchResults.length} résultat(s)
                        </span>
                      )}
                      <button
                        onClick={() => {
                          setSearchOpen(false);
                          setSearchQuery('');
                        }}
                        className="text-slate-500 hover:text-white"
                        title="Fermer la recherche"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    {searchResults.length > 0 && (
                      <div className="max-h-48 overflow-y-auto border-t border-white/8">
                        {searchResults.map((m) => (
                          <button
                            key={m.id}
                            className="flex items-start gap-3 w-full px-4 py-2 hover:bg-slate-800/50 text-left transition-colors"
                            title={`Aller au message de ${m.sender.name}`}
                          >
                            <GedOsAvatar name={m.sender.name} size={7} />
                            <div className="min-w-0">
                              <p className="text-[12px] font-medium text-slate-300">
                                {m.sender.name} · {formatTime(m.createdAt)}
                              </p>
                              <p className="text-[12px] text-slate-500 truncate">{m.content}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Pinned message ── */}
              <AnimatePresence>
                {pinned && <PinnedBar pinned={pinned} onDismiss={() => setPinned(null)} />}
              </AnimatePresence>

              {/* ── Messages ── */}
              {'Notification' in window && Notification.permission !== 'granted' && (
                <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between z-20 shrink-0">
                  <div className="flex items-center gap-2 text-amber-200 text-[11px]">
                    <span>⚠️ Notifications de bureau désactivées.</span>
                  </div>
                  <button
                    onClick={() =>
                      Notification.requestPermission().then(() => window.location.reload())
                    }
                    className="text-[10px] bg-amber-500 text-amber-950 px-2 py-1 rounded font-bold hover:bg-amber-400 transition-colors"
                  >
                    ACTIVER
                  </button>
                </div>
              )}
              <div
                ref={chatContainerRef}
                className="flex-1 overflow-y-auto py-2 z-10 scroll-smooth [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10"
              >
                {currentUserBlocked && (
                  <div className="flex justify-center mb-4 mt-2">
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-4 py-2 rounded-xl text-[13px] flex items-center gap-2">
                      <Lock size={14} /> Messagerie bloquée
                    </div>
                  </div>
                )}

                {loadingMessages && activeMessages.length === 0 && (
                  <div className="flex justify-center items-center h-32">
                    <div className="h-8 w-8 rounded-full border-2 border-slate-700 border-t-indigo-500 animate-spin" />
                  </div>
                )}

                {!loadingMessages && activeMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-600">
                    <MessageSquare size={32} />
                    <p className="text-[13px]">Dites bonjour ! 👋</p>
                  </div>
                ) : (
                  <div className="flex flex-col">
                    {activeMessages.map((msg, i) => {
                      const prev = activeMessages[i - 1];
                      const next = activeMessages[i + 1];
                      const isOwn =
                        String(msg.senderId) === String(user?.id) ||
                        String(msg.sender?.id) === String(user?.id);
                      const showName = !isOwn && (!prev || prev.senderId !== msg.senderId);
                      const showAvatar = !prev || prev.senderId !== msg.senderId;
                      const showDate =
                        !prev ||
                        new Date(prev.createdAt).toDateString() !==
                          new Date(msg.createdAt).toDateString();

                      const msgReactions = reactions[msg.id] || [];
                      const isStarred = starred.has(msg.id);
                      const isPinned = pinned?.messageId === msg.id;

                      return (
                        <Fragment key={msg.id}>
                          {showDate && <DateSeparator date={msg.createdAt} />}
                          <MessageBubble
                            msg={msg}
                            prevMsg={prev}
                            nextMsg={next}
                            isOwn={isOwn}
                            isAdmin={isAdmin}
                            currentUserId={user?.id || ''}
                            reactions={msgReactions}
                            starred={isStarred}
                            pinned={isPinned}
                            showAvatar={showAvatar}
                            showName={showName}
                            onReply={handleReply}
                            onReact={handleReact}
                            onDelete={handleDeleteMessage}
                            onDeleteForMe={handleDeleteMessageForMe}
                            onEdit={setEditingMessage}
                            onPin={handlePin}
                            onStar={handleStar}
                            conversation={activeConversation!}
                          />
                        </Fragment>
                      );
                    })}
                  </div>
                )}

                {/* Typing indicator */}
                <AnimatePresence>
                  {activeTyping.length > 0 && <TypingIndicator users={activeTyping} />}
                </AnimatePresence>

                <div ref={messagesEndRef} className="h-2" />
              </div>

              {/* ── Scroll to bottom button ── */}
              <div className="absolute bottom-[80px] right-4 z-20">
                <AnimatePresence>
                  {(() => {
                    const c = chatContainerRef.current;
                    const show = c && c.scrollHeight - c.scrollTop - c.clientHeight > 400;
                    return show ? (
                      <motion.button
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0 }}
                        onClick={() => scrollToBottom()}
                        className="h-10 w-10 rounded-full bg-slate-800 border border-white/10 text-slate-400 hover:text-white shadow-xl flex items-center justify-center hover:bg-slate-700 transition-all"
                      >
                        <ChevronDown size={18} />
                      </motion.button>
                    ) : null;
                  })()}
                </AnimatePresence>
              </div>

              {/* ── Composer ── */}
              <div className="z-10 relative shrink-0">
                <GemChatComposer
                  disabled={currentUserBlocked}
                  conversationId={activeConversationId}
                  users={users}
                  replyTo={replyTo}
                  onSend={handleSendMessage}
                  onCancelReply={() => setReplyTo(null)}
                  editingMessage={editingMessage}
                  onCancelEdit={() => setEditingMessage(null)}
                  onSaveEdit={handleEditMessage}
                />
              </div>
            </div>

            {/* ── Info panel ── */}
            <AnimatePresence>
              {showInfo && (
                <ConversationInfoPanel
                  conversation={activeConversation}
                  users={users}
                  isAdmin={isAdmin}
                  onClose={() => setShowInfo(false)}
                  onToggleBlock={handleToggleBlock}
                />
              )}
            </AnimatePresence>
          </div>
        ) : (
          /* ── Empty state ── */
          <div className="hidden md:flex flex-1 flex-col items-center justify-center relative bg-slate-950">
            <div
              className="absolute inset-0 opacity-[0.015] pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '32px 32px',
              }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-6 z-10 max-w-[420px] text-center px-8"
            >
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center shadow-2xl shadow-indigo-500/25">
                <MessagesSquare size={44} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-2">GED OS Chat</h1>
                <p className="text-[14px] text-slate-500 leading-relaxed">
                  Messagerie d'équipe opérationnelle pour la gestion terrain. Sélectionnez une
                  conversation ou créez un groupe.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full text-left">
                {[
                  { icon: <Reply size={14} />, label: 'Réponses citées' },
                  { icon: <Smile size={14} />, label: 'Réactions emoji' },
                  { icon: <AtSign size={14} />, label: '@mentions' },
                  { icon: <Pin size={14} />, label: 'Messages épinglés' },
                  { icon: <Command size={14} />, label: 'Commandes /opérations' },
                  { icon: <Star size={14} />, label: 'Messages favoris' },
                ].map((f) => (
                  <div
                    key={f.label}
                    className="flex items-center gap-2 bg-slate-900/60 border border-white/8 rounded-xl px-3 py-2.5"
                  >
                    <span className="text-indigo-400">{f.icon}</span>
                    <span className="text-[12px] text-slate-400">{f.label}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-600">
                <Lock size={11} /> <span>Connexion sécurisée · Chiffrement en transit</span>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>

    {/* ── Modale confirmation : Vider pour TOUS ── */}
    {showClearConfirm && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-all-modal-title"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) setShowClearConfirm(false); }}
      >
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-rose-500/15 flex items-center justify-center">
              <Trash2 size={20} className="text-rose-400" />
            </div>
            <div>
              <h3 id="clear-all-modal-title" className="text-[15px] font-bold text-white leading-tight">
                Vider l&apos;historique pour tous
              </h3>
              <p className="text-[13px] text-slate-400 mt-1">
                Cette action supprime définitivement tous les messages de la conversation pour <strong className="text-white">tous les participants</strong>. Elle est irréversible.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              id="clear-all-cancel-btn"
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 text-[13px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              id="clear-all-confirm-btn"
              onClick={handleClearHistory}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors"
            >
              Vider pour tous
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Modale confirmation : Vider mon historique ── */}
    {showClearMyConfirm && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clear-my-modal-title"
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) setShowClearMyConfirm(false); }}
      >
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4">
          <div className="flex items-start gap-4 mb-5">
            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-amber-500/15 flex items-center justify-center">
              <UserMinus size={20} className="text-amber-400" />
            </div>
            <div>
              <h3 id="clear-my-modal-title" className="text-[15px] font-bold text-white leading-tight">
                Vider mon historique
              </h3>
              <p className="text-[13px] text-slate-400 mt-1">
                Les messages disparaîtront de votre vue uniquement. Les autres participants continueront à les voir.
              </p>
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <button
              id="clear-my-cancel-btn"
              onClick={() => setShowClearMyConfirm(false)}
              className="px-4 py-2 text-[13px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-white/10 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              id="clear-my-confirm-btn"
              onClick={handleClearMyHistory}
              className="px-4 py-2 text-[13px] font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-lg transition-colors"
            >
              Vider ma vue
            </button>
          </div>
        </div>
      </div>
    )}

    {/* ── Modale d'aide ── */}
    {showHelpModal && (
      <ChatHelpModal onClose={() => setShowHelpModal(false)} />
    )}
    </>
  );
}
