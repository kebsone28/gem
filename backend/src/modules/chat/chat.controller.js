import prisma from '../../core/utils/prisma.js';
import { tracerAction } from '../../services/audit.service.js';
import { socketService } from '../../services/socket.service.js';
import { hasPrismaDelegate, isPrismaSchemaDriftError } from '../../core/utils/prismaCompat.js';

const CHAT_TYPES = {
  GLOBAL: 'GLOBAL',
  DIRECT: 'DIRECT',
  GROUP: 'GROUP',
};

const GLOBAL_SCOPE_KEY = 'global-room';

const userSelect = {
  id: true,
  email: true,
  name: true,
  roleLegacy: true,
  active: true,
  lastLogin: true,
};

const conversationInclude = {
  participants: {
    include: {
      user: {
        select: userSelect,
      },
    },
    orderBy: {
      joinedAt: 'asc',
    },
  },
  messages: {
    take: 1,
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      sender: {
        select: userSelect,
      },
    },
  },
};

const messageInclude = {
  sender: {
    select: userSelect,
  },
};

const getConversationRoom = (conversationId) => `chat_conversation_${conversationId}`;

function isChatPersistenceAvailable() {
  return (
    hasPrismaDelegate(prisma, 'chatConversation') &&
    hasPrismaDelegate(prisma, 'chatUserBlock') &&
    hasPrismaDelegate(prisma, 'chatMessage')
  );
}

function createChatUnavailableError() {
  const error = new Error('La messagerie n’est pas encore disponible sur ce serveur. Finalisez la mise à niveau de la base puis réessayez.');
  error.statusCode = 503;
  error.code = 'CHAT_UNAVAILABLE';
  return error;
}

function assertChatPersistenceAvailable() {
  if (!isChatPersistenceAvailable()) {
    throw createChatUnavailableError();
  }
}

const toSafeUser = (user, activeBlocksByUserId = new Map(), onlineUserIds = new Set()) => {
  if (!user) {
    return {
      id: 'unknown',
      email: 'deleted@user',
      name: 'Utilisateur supprimé',
      role: 'UNKNOWN',
      active: false,
      online: false,
      blocked: false,
      blockedReason: null,
    };
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name || user.email,
    role: user.roleLegacy || 'CHEF_EQUIPE',
    active: user.active !== false,
    lastLogin: user.lastLogin,
    online: onlineUserIds.has(user.id),
    blocked: activeBlocksByUserId.has(user.id),
    blockedReason: activeBlocksByUserId.get(user.id)?.reason || null,
  };
};

const toSafeMessage = (message) => {
  if (!message) return null;
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    sender: toSafeUser(message.sender),
  };
};

const toSafeConversation = (conversation, currentUserId, activeBlocksByUserId = new Map(), onlineUserIds = new Set()) => {
  if (!conversation) return null;
  
  const lastMessage = conversation.messages?.[0] ? toSafeMessage(conversation.messages[0]) : null;

  return {
    id: conversation.id,
    type: conversation.type,
    name:
      conversation.type === CHAT_TYPES.GLOBAL
        ? conversation.name || 'Salle générale'
        : conversation.name || null,
    scopeKey: conversation.scopeKey,
    createdById: conversation.createdById || null,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    archivedAt: conversation.archivedAt,
    isGlobal: conversation.type === CHAT_TYPES.GLOBAL,
    participants: (conversation.participants || []).map((participant) => ({
      id: participant.id,
      userId: participant.userId,
      role: participant.role,
      joinedAt: participant.joinedAt,
      user: toSafeUser(participant.user, activeBlocksByUserId, onlineUserIds),
      isCurrentUser: participant.userId === currentUserId,
    })),
    lastMessage,
  };
};

async function ensureGlobalConversation(organizationId, userId) {
  return prisma.chatConversation.upsert({
    where: {
      organizationId_scopeKey: {
        organizationId,
        scopeKey: GLOBAL_SCOPE_KEY,
      },
    },
    update: {
      name: 'Salle générale',
      type: CHAT_TYPES.GLOBAL,
    },
    create: {
      organizationId,
      type: CHAT_TYPES.GLOBAL,
      name: 'Salle générale',
      scopeKey: GLOBAL_SCOPE_KEY,
      createdById: userId,
    },
    include: conversationInclude,
  });
}

async function getActiveBlocksByUserId(organizationId) {
  const activeBlocks = await prisma.chatUserBlock.findMany({
    where: {
      organizationId,
      active: true,
    },
  });

  return new Map(activeBlocks.map((entry) => [entry.userId, entry]));
}

async function getAccessibleConversation(organizationId, userId, conversationId) {
  return prisma.chatConversation.findFirst({
    where: {
      id: conversationId,
      organizationId,
      OR: [
        { type: CHAT_TYPES.GLOBAL },
        {
          participants: {
            some: { userId },
          },
        },
      ],
    },
    include: conversationInclude,
  });
}

async function assertCanWriteToChat(organizationId, userId) {
  assertChatPersistenceAvailable();

  const blockEntry = await prisma.chatUserBlock.findFirst({
    where: {
      organizationId,
      userId,
    },
  });

  if (blockEntry?.active) {
    const error = new Error('Votre accès au chat a été bloqué par un administrateur.');
    error.statusCode = 403;
    throw error;
  }
}

async function getConversationMessagesForUser(organizationId, userId, conversationId, limit = 100) {
  const conversation = await getAccessibleConversation(organizationId, userId, conversationId);

  if (!conversation) {
    return null;
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      organizationId,
      conversationId,
    },
    include: messageInclude,
    orderBy: {
      createdAt: 'asc',
    },
    take: Math.min(Math.max(Number(limit) || 100, 1), 250),
  });

  return { conversation, messages };
}

async function broadcastConversationToParticipants(conversation, participantUserIds, currentUserId) {
  const activeBlocksByUserId = await getActiveBlocksByUserId(conversation.organizationId);
  const onlineUserIds = new Set(socketService.getOrganizationPresence(conversation.organizationId));

  const payload = {
    conversation: toSafeConversation(conversation, currentUserId, activeBlocksByUserId, onlineUserIds),
  };

  participantUserIds.forEach((participantUserId) => {
    socketService.emitToUser(participantUserId, 'chat:conversation:new', payload);
  });
}

async function sendBootstrapFallback(res, organizationId, userId) {
  const users = await prisma.user.findMany({
    where: { organizationId },
    orderBy: [{ active: 'desc' }, { name: 'asc' }, { email: 'asc' }],
    select: userSelect,
  });

  const onlineUserIds = new Set(socketService.getOrganizationPresence(organizationId));
  const safeUsers = users.map((user) => toSafeUser(user, new Map(), onlineUserIds));

  res.json({
    users: safeUsers,
    conversations: [],
    presence: Array.from(onlineUserIds),
    blockedUserIds: [],
    currentUserBlocked: false,
    globalConversationId: null,
    degraded: true,
    message: 'La messagerie sera disponible apres la mise a niveau serveur.',
  });
}

export const getChatBootstrap = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    if (!organizationId || !userId) {
        return res.status(400).json({ error: 'Session invalide : organizationId ou userId manquant.' });
    }

    console.log(`[CHAT_BOOTSTRAP] Starting for user ${userId} in org ${organizationId}`);

    if (!isChatPersistenceAvailable()) {
      return sendBootstrapFallback(res, organizationId, userId);
    }

    const [globalConversation, users, conversations, activeBlocksByUserId] = await Promise.all([
      ensureGlobalConversation(organizationId, userId).catch(e => {
          console.error('[CHAT_BOOTSTRAP] ensureGlobalConversation failed:', e);
          throw e;
      }),
      prisma.user.findMany({
        where: { organizationId },
        orderBy: [{ active: 'desc' }, { name: 'asc' }, { email: 'asc' }],
        select: userSelect,
      }).catch(e => {
          console.error('[CHAT_BOOTSTRAP] findMany users failed:', e);
          throw e;
      }),
      prisma.chatConversation.findMany({
        where: {
          organizationId,
          OR: [
            { type: CHAT_TYPES.GLOBAL },
            {
              participants: {
                some: { userId },
              },
            },
          ],
        },
        include: conversationInclude,
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      }).catch(e => {
          console.error('[CHAT_BOOTSTRAP] findMany conversations failed:', e);
          throw e;
      }),
      getActiveBlocksByUserId(organizationId).catch(e => {
          console.error('[CHAT_BOOTSTRAP] getActiveBlocksByUserId failed:', e);
          throw e;
      }),
    ]);

    console.log(`[CHAT_BOOTSTRAP] Data fetched. GlobalConv: ${globalConversation?.id}, Users: ${users.length}, Convs: ${conversations.length}`);

    const onlineUserIds = new Set(socketService.getOrganizationPresence(organizationId));
    const safeUsers = users.map((user) => toSafeUser(user, activeBlocksByUserId, onlineUserIds));

    const uniqueConversations = new Map();
    [globalConversation, ...conversations].forEach((conversation) => {
      if (!conversation) return;
      try {
        uniqueConversations.set(
            conversation.id,
            toSafeConversation(conversation, userId, activeBlocksByUserId, onlineUserIds)
          );
      } catch (convError) {
          console.error(`[CHAT_BOOTSTRAP] Error transforming conversation ${conversation.id}:`, convError);
      }
    });

    res.json({
      users: safeUsers,
      conversations: Array.from(uniqueConversations.values()),
      presence: Array.from(onlineUserIds),
      blockedUserIds: Array.from(activeBlocksByUserId.keys()),
      currentUserBlocked: activeBlocksByUserId.has(userId),
      globalConversationId: globalConversation.id,
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      return sendBootstrapFallback(res, req.user.organizationId, req.user.id);
    }
    console.error('[CHAT_BOOTSTRAP_ERROR]', error);
    res.status(500).json({ error: 'Erreur lors du chargement de la messagerie.', details: error.message });
  }
};

export const createConversation = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { participantIds, name } = req.body || {};

    assertChatPersistenceAvailable();
    await assertCanWriteToChat(organizationId, userId);

    const requestedIds = Array.isArray(participantIds) ? participantIds.filter(Boolean) : [];
    const finalParticipantIds = Array.from(new Set([userId, ...requestedIds]));

    if (finalParticipantIds.length < 2) {
      return res
        .status(400)
        .json({ error: 'Sélectionnez au moins un autre membre pour démarrer une conversation.' });
    }

    const users = await prisma.user.findMany({
      where: {
        organizationId,
        id: { in: finalParticipantIds },
        active: true,
      },
      select: userSelect,
    });

    if (users.length !== finalParticipantIds.length) {
      return res
        .status(400)
        .json({ error: 'Un ou plusieurs utilisateurs sélectionnés sont invalides ou inactifs.' });
    }

    const sortedIds = [...finalParticipantIds].sort();
    const isPublic = req.body?.isPublic === true;
    const isDirect = sortedIds.length === 2 && !req.body?.name && !isPublic;
    const scopeKey = isDirect ? `direct:${sortedIds.join(':')}` : null;
    const type = isPublic ? CHAT_TYPES.GLOBAL : (isDirect ? CHAT_TYPES.DIRECT : CHAT_TYPES.GROUP);

    let conversation = null;

    if (scopeKey) {
      conversation = await prisma.chatConversation.findFirst({
        where: {
          organizationId,
          scopeKey,
        },
        include: conversationInclude,
      });
    }

    if (!conversation) {
      conversation = await prisma.chatConversation.create({
        data: {
          organizationId,
          type,
          name: isDirect ? null : (typeof name === 'string' && name.trim()) || (isPublic ? 'Canal public' : 'Groupe de discussion'),
          scopeKey,
          createdById: userId,
          participants: {
            create: finalParticipantIds.map((participantUserId) => ({
              organizationId,
              userId: participantUserId,
              role: participantUserId === userId ? 'OWNER' : 'MEMBER',
            })),
          },
        },
        include: conversationInclude,
      });

      await tracerAction({
        userId,
        organizationId,
        action: 'CHAT_CONVERSATION_CREATED',
        resource: 'ChatConversation',
        resourceId: conversation.id,
        details: {
          type: conversation.type,
          participants: finalParticipantIds,
        },
        req,
      }).catch((auditError) => {
        console.warn('[CHAT_AUDIT] createConversation failed:', auditError.message);
      });
    }

    await broadcastConversationToParticipants(conversation, finalParticipantIds, userId);

    const activeBlocksByUserId = await getActiveBlocksByUserId(organizationId);
    const onlineUserIds = new Set(socketService.getOrganizationPresence(organizationId));

    res.status(201).json({
      conversation: toSafeConversation(conversation, userId, activeBlocksByUserId, onlineUserIds),
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      error.statusCode = 503;
      error.message = 'La messagerie n’est pas encore disponible sur ce serveur. Finalisez la mise à niveau de la base puis réessayez.';
    }
    console.error('[CHAT_CREATE_CONVERSATION_ERROR]', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Erreur lors de la création de la conversation.',
      ...(error.code && { code: error.code }),
    });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { conversationId } = req.params;
    const { limit } = req.query;

    assertChatPersistenceAvailable();
    const result = await getConversationMessagesForUser(organizationId, userId, conversationId, limit);

    if (!result) {
      return res.status(404).json({ error: 'Conversation introuvable ou accès refusé.' });
    }

    res.json({
      messages: result.messages.map(toSafeMessage),
    });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      error.statusCode = 503;
      error.message = 'La messagerie n’est pas encore disponible sur ce serveur. Finalisez la mise à niveau de la base puis réessayez.';
    }
    console.error('[CHAT_GET_MESSAGES_ERROR]', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Erreur lors du chargement des messages.',
      ...(error.code && { code: error.code }),
    });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { conversationId } = req.params;
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';

    if (!content) {
      return res.status(400).json({ error: 'Le message est vide.' });
    }

    assertChatPersistenceAvailable();
    await assertCanWriteToChat(organizationId, userId);

    const conversation = await getAccessibleConversation(organizationId, userId, conversationId);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation introuvable ou accès refusé.' });
    }

    const message = await prisma.chatMessage.create({
      data: {
        organizationId,
        conversationId,
        senderId: userId,
        content,
      },
      include: messageInclude,
    });

    await prisma.chatConversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const payload = {
      message: toSafeMessage(message),
    };

    socketService.emit('chat:message:new', payload, getConversationRoom(conversationId));

    res.status(201).json(payload);
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      error.statusCode = 503;
      error.message = 'La messagerie n’est pas encore disponible sur ce serveur. Finalisez la mise à niveau de la base puis réessayez.';
    }
    console.error('[CHAT_SEND_MESSAGE_ERROR]', error);
    res.status(error.statusCode || 500).json({
      error: error.message || "Erreur lors de l'envoi du message.",
      ...(error.code && { code: error.code }),
    });
  }
};

export const toggleUserChatBlock = async (req, res) => {
  try {
    const { organizationId, id: adminUserId } = req.user;
    const { userId } = req.params;
    const { blocked, reason } = req.body || {};

    assertChatPersistenceAvailable();

    if (userId === adminUserId) {
      return res.status(400).json({ error: 'Vous ne pouvez pas vous bloquer vous-même.' });
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
      select: userSelect,
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const blockEntry = await prisma.chatUserBlock.upsert({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
      update: {
        active: !!blocked,
        reason: blocked ? (typeof reason === 'string' ? reason.trim() || null : null) : null,
        blockedById: adminUserId,
        blockedAt: blocked ? new Date() : undefined,
        unblockedAt: blocked ? null : new Date(),
      },
      create: {
        organizationId,
        userId,
        blockedById: adminUserId,
        active: !!blocked,
        reason: blocked ? (typeof reason === 'string' ? reason.trim() || null : null) : null,
        blockedAt: new Date(),
      },
    });

    await tracerAction({
      userId: adminUserId,
      organizationId,
      action: blocked ? 'CHAT_USER_BLOCKED' : 'CHAT_USER_UNBLOCKED',
      resource: 'ChatUserBlock',
      resourceId: blockEntry.id,
      details: {
        targetUserId: userId,
        reason: blockEntry.reason,
      },
      req,
    }).catch((auditError) => {
      console.warn('[CHAT_AUDIT] toggleUserChatBlock failed:', auditError.message);
    });

    const payload = {
      userId,
      blocked: !!blocked,
      reason: blockEntry.reason || null,
    };

    socketService.emit('chat:user:block-state', payload, `org_${organizationId}`);
    socketService.emitToUser(userId, 'chat:user:block-state', payload);

    res.json(payload);
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      error.statusCode = 503;
      error.message = 'La messagerie n’est pas encore disponible sur ce serveur. Finalisez la mise à niveau de la base puis réessayez.';
    }
    console.error('[CHAT_BLOCK_ERROR]', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Erreur lors de la mise à jour du blocage.',
      ...(error.code && { code: error.code }),
    });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const { organizationId, id: userId } = req.user;
    const { conversationId } = req.params;

    assertChatPersistenceAvailable();

    const conversation = await prisma.chatConversation.findFirst({
      where: { id: conversationId, organizationId }
    });

    if (!conversation || conversation.type === CHAT_TYPES.GLOBAL) {
      return res.status(403).json({ error: 'Action non autorisée sur cette conversation.' });
    }

    await prisma.chatConversation.delete({
      where: { id: conversationId }
    });

    socketService.emit('chat:conversation:deleted', { conversationId }, `org_${organizationId}`);

    res.json({ success: true, conversationId });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      error.statusCode = 503;
      error.message = 'La messagerie n’est pas encore disponible sur ce serveur. Finalisez la mise à niveau de la base puis réessayez.';
    }
    console.error('[CHAT_DELETE_ERROR]', error);
    res.status(error.statusCode || 500).json({
      error: error.message || 'Erreur lors de la suppression de la conversation.',
      ...(error.code && { code: error.code }),
    });
  }
};
