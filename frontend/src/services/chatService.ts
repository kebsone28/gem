import apiClient from '../api/client';

export interface ChatUserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  active: boolean;
  lastLogin?: string | null;
  online: boolean;
  blocked: boolean;
  blockedReason?: string | null;
  chatStatus?: 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
  chatStatusText?: string | null;
}

export interface ChatParticipant {
  id: string;
  userId: string;
  role: string;
  joinedAt: string;
  lastReadAt?: string;
  isCurrentUser: boolean;
  user: ChatUserSummary;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  sender: ChatUserSummary;
}

export interface ChatConversation {
  id: string;
  type: 'GLOBAL' | 'DIRECT' | 'GROUP';
  name?: string | null;
  scopeKey?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string | null;
  isGlobal: boolean;
  participants: ChatParticipant[];
  lastMessage?: ChatMessage | null;
  retentionDays?: number;
}

export interface ChatBootstrapResponse {
  users: ChatUserSummary[];
  conversations: ChatConversation[];
  presence: string[];
  blockedUserIds: string[];
  currentUserBlocked: boolean;
  globalConversationId: string;
}

const chatService = {
  async getBootstrap() {
    const response = await apiClient.get<ChatBootstrapResponse>('/chat/bootstrap');
    return response.data;
  },

  async getMessages(conversationId: string) {
    const response = await apiClient.get<{ messages: ChatMessage[] }>(
      `/chat/conversations/${conversationId}/messages`
    );
    return response.data.messages;
  },

  async clearHistory(conversationId: string) {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/chat/conversations/${conversationId}/messages`
    );
    return response.data;
  },

  async clearMyHistory(conversationId: string) {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
      `/chat/conversations/${conversationId}/my-history`
    );
    return response.data;
  },

  async updateRetention(conversationId: string, retentionDays: number) {
    const response = await apiClient.patch<{ success: boolean; retentionDays: number }>(
      `/chat/conversations/${conversationId}/retention`,
      { retentionDays }
    );
    return response.data;
  },

  async createConversation(payload: { participantIds: string[]; name?: string; isPublic?: boolean }) {
    const response = await apiClient.post<{ conversation: ChatConversation }>(
      '/chat/conversations',
      payload
    );
    return response.data.conversation;
  },

  async sendMessage(conversationId: string, content: string) {
    const response = await apiClient.post<{ message: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages`,
      { content }
    );
    return response.data.message;
  },

  async deleteMessage(conversationId: string, messageId: string) {
    const response = await apiClient.delete<{
      success: boolean;
      conversationId: string;
      messageId: string;
      lastMessage?: ChatMessage | null;
    }>(`/chat/conversations/${conversationId}/messages/${messageId}`);
    return response.data;
  },

  async setBlocked(userId: string, blocked: boolean, reason?: string) {
    const response = await apiClient.patch<{ userId: string; blocked: boolean; reason?: string | null }>(
      `/chat/users/${userId}/block`,
      { blocked, reason }
    );
    return response.data;
  },

  async deleteConversation(conversationId: string) {
    const response = await apiClient.delete<{ success: boolean; conversationId: string }>(
      `/chat/conversations/${conversationId}`
    );
    return response.data;
  },

  async editMessage(conversationId: string, messageId: string, content: string) {
    const response = await apiClient.patch<{ message: ChatMessage }>(
      `/chat/conversations/${conversationId}/messages/${messageId}`,
      { content }
    );
    return response.data.message;
  },

  async deleteMessageForMe(conversationId: string, messageId: string) {
    const response = await apiClient.delete<{ success: boolean; messageId: string }>(
      `/chat/conversations/${conversationId}/messages/${messageId}/me`
    );
    return response.data;
  },

  async resolveEntity(type: string, id: string) {
    const response = await apiClient.get<{
      title: string;
      subtitle: string;
      status?: string;
      link: string;
    }>('/chat/resolve', { params: { type, id } });
    return response.data;
  },

  async markAsRead(conversationId: string) {
    const response = await apiClient.post<{ success: boolean }>(
      `/chat/conversations/${conversationId}/read`
    );
    return response.data;
  },

  async updateUserStatus(status: string, statusText?: string) {
    const response = await apiClient.put<{ success: boolean; data: { userId: string; chatStatus: string; chatStatusText: string | null } }>(
      '/chat/status',
      { status, statusText }
    );
    return response.data;
  },

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<{ url: string; key: string }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default chatService;
