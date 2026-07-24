import { storage } from "../storage";

export class ChatService {
  private userSessions: Map<string, string> = new Map();

  async getOrCreateSession(
    userId: string,
    projectId?: number,
  ): Promise<string> {
    // Check if user has an active session
    let sessionId = this.userSessions.get(userId);

    if (!sessionId) {
      // Create new session
      const result = await storage.createChatSession(userId, projectId);
      sessionId = result.sessionId;
      this.userSessions.set(userId, sessionId);

      // Clean up old sessions (keep last 5 sessions per user)
      await storage.deleteOldChatSessions(userId, 5);
    }

    return sessionId;
  }

  async saveMessage(
    sessionId: string,
    role: "user" | "assistant",
    content: string,
    metadata?: any,
  ): Promise<void> {
    await storage.saveChatMessage(sessionId, role, content, metadata);
  }

  async getChatHistory(sessionId: string): Promise<any[]> {
    return await storage.getChatHistory(sessionId);
  }

  async getUserSessions(userId: string): Promise<any[]> {
    return await storage.getUserChatSessions(userId);
  }

  clearUserSession(userId: string): void {
    this.userSessions.delete(userId);
  }
}

export const chatService = new ChatService();
