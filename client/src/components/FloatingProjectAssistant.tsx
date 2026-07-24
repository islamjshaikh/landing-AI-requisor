import React, { useState, useEffect } from "react";
import {
  MessageCircle,
  X,
  Minimize2,
  Maximize2,
  Send,
  Loader2,
  RotateCcw,
  History,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle, 
} from "@/components/ui/dialog";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  id: string;
  timestamp: Date;
  suggestedPrompts?: string[];
}

interface ConversationSession {
  id: string;
  startTime: Date;
  messages: ChatMessage[];
}

interface FloatingProjectAssistantProps {
  projectId?: number;
  projectName?: string;
}

export function FloatingProjectAssistant({
  projectId,
  projectName,
}: FloatingProjectAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("openChat") === "1") {
      setIsOpen(true);
      setIsMinimized(false);
      const url = new URL(window.location.href);
      url.searchParams.delete("openChat");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationSession[]
  >([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const { toast } = useToast();

  // Load current messages and conversation history
  useEffect(() => {
    if (!projectId) return;

    // Load current conversation
    const currentStored = localStorage.getItem(
      `project-assistant-current-${projectId}`,
    );
    if (currentStored) {
      try {
        const parsed = JSON.parse(currentStored) as Array<
          Omit<ChatMessage, "timestamp"> & { timestamp: string | number }
        >;
        const revived: ChatMessage[] = parsed.map((m) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
        setMessages(revived);
      } catch {
        localStorage.removeItem(`project-assistant-current-${projectId}`);
      }
    }

    // Load conversation history
    const historyStored = localStorage.getItem(
      `project-assistant-history-${projectId}`,
    );
    if (historyStored) {
      try {
        const parsed = JSON.parse(historyStored) as Array<
          Omit<ConversationSession, "startTime" | "messages"> & {
            startTime: string;
            messages: Array<
              Omit<ChatMessage, "timestamp"> & { timestamp: string }
            >;
          }
        >;
        const revived: ConversationSession[] = parsed.map((session) => ({
          ...session,
          startTime: new Date(session.startTime),
          messages: session.messages.map((m) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
        setConversationHistory(revived);
      } catch {
        localStorage.removeItem(`project-assistant-history-${projectId}`);
      }
    }
  }, [projectId]);

  const safeISOString = (d: Date | any): string => {
    try {
      const date = d instanceof Date ? d : new Date(d);
      if (isNaN(date.getTime())) return new Date().toISOString();
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  // Save current conversation
  useEffect(() => {
    if (projectId && messages.length > 0) {
      try {
        const toStore = messages.map((m) => ({
          ...m,
          timestamp: safeISOString(m.timestamp),
        }));
        localStorage.setItem(
          `project-assistant-current-${projectId}`,
          JSON.stringify(toStore),
        );
      } catch {}
    }
  }, [messages, projectId]);

  // Save conversation history
  useEffect(() => {
    if (projectId && conversationHistory.length > 0) {
      try {
        const toStore = conversationHistory.map((session) => ({
          ...session,
          startTime: safeISOString(session.startTime),
          messages: session.messages.map((m) => ({
            ...m,
            timestamp: safeISOString(m.timestamp),
          })),
        }));
        localStorage.setItem(
          `project-assistant-history-${projectId}`,
          JSON.stringify(toStore),
        );
      } catch {}
    }
  }, [conversationHistory, projectId]);

  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const conversationHistory = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      conversationHistory.push({
        role: "user" as const,
        content: message,
      });

      const response = await apiRequest("/api/ai/project-assistant", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          projectName,
          conversationHistory,
        }),
      });
      return response as {
        response?: string;
        message?: string;
        suggestedPrompts?: string[];
        actionsPerformed?: boolean;
      };
    },
    onSuccess: (data, variables) => {
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content:
          data.response ||
          data.message ||
          "Sorry, I could not generate a response.",
        id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
        timestamp: new Date(),
        suggestedPrompts: data.suggestedPrompts,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsTyping(false);

      if (data.actionsPerformed) {
        toast({
          title: "Actions completed",
          description:
            "I've updated the tasks as requested. Refresh the page to see the changes.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setIsTyping(false);
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: input,
      id: crypto.randomUUID?.() || String(Date.now() + Math.random()),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);
    sendMessage.mutate(userMessage.content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
  };

  const handleNewChat = () => {
    // Save current conversation to history if it has messages
    if (messages.length > 0) {
      const newSession: ConversationSession = {
        id: crypto.randomUUID?.() || String(Date.now()),
        startTime: messages[0]?.timestamp || new Date(),
        messages: messages,
      };
      setConversationHistory((prev) => [newSession, ...prev]);
    }

    // Clear current conversation
    setMessages([]);
    if (projectId) {
      localStorage.removeItem(`project-assistant-current-${projectId}`);
    }

    toast({
      title: "New chat started",
      description: "Previous conversation saved to history.",
    });
  };

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <button
              onClick={() => setIsOpen(true)}
              className="w-14 h-14 bg-gray-900 text-white rounded-full shadow-lg hover:bg-gray-800 transition-all hover:scale-105 flex items-center justify-center"
            >
              <MessageCircle className="h-6 w-6" />
            </button>
            {projectName && (
              <div className="absolute -top-2 -left-2 bg-emerald-500 text-white px-2 py-1 text-xs rounded-full max-w-[120px] truncate">
                {projectName}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`fixed bottom-6 right-6 z-50 ${
              isMinimized ? "w-72" : "w-96"
            } ${isMinimized ? "h-14" : "h-[600px]"} max-h-[80vh]`}
          >
            <Card className="w-full h-full flex flex-col shadow-2xl border-gray-100 bg-white rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-sm text-gray-900">
                      Requisor Project Assistant
                    </h3>
                    {projectName && !isMinimized && (
                      <p className="text-xs text-gray-500 truncate">
                        {projectName}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
                  <div className="flex gap-1">
                    {!isMinimized &&
                      (conversationHistory.length > 0 ||
                        messages.length > 0) && (
                        <button
                          onClick={() => setShowHistory(true)}
                          className="h-7 w-7 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                          title="View Chat History"
                          data-testid="button-view-history"
                        >
                          <History className="h-3.5 w-3.5 text-gray-600" />
                        </button>
                      )}
                    {!isMinimized && (
                      <button
                        onClick={handleNewChat}
                        className="h-7 w-7 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                        title="New Chat"
                        data-testid="button-new-chat"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-gray-600" />
                      </button>
                    )}
                    <button
                      onClick={() => setIsMinimized(!isMinimized)}
                      className="h-7 w-7 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                      data-testid="button-minimize-chat"
                    >
                      {isMinimized ? (
                        <Maximize2 className="h-3.5 w-3.5 text-gray-600" />
                      ) : (
                        <Minimize2 className="h-3.5 w-3.5 text-gray-600" />
                      )}
                    </button>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="h-7 w-7 rounded hover:bg-gray-100 flex items-center justify-center transition-colors"
                      data-testid="button-close-chat"
                    >
                      <X className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Chat Content */}
              {!isMinimized && (
                <>
                  <ScrollArea className="flex-1 p-4">
                    {messages.length === 0 && (
                      <div className="text-center text-gray-500 mt-8">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p className="text-sm font-medium">
                          Hi! I'm your Virtual Project Assistant
                        </p>
                        <p className="text-xs mt-2 text-gray-400">
                          I manage tasks, track progress, and help you stay
                          organized. Just talk to me naturally!
                        </p>
                        <div className="mt-6 space-y-2">
                          <p className="text-xs text-gray-400">Try saying:</p>
                          {[
                            "What's the project status?",
                            "Show me overdue tasks",
                            "Create a task for me",
                            "Assign tasks to the team",
                          ].map((prompt, idx) => (
                            <button
                              key={idx}
                              onClick={() => setInput(prompt)}
                              className="block mx-auto text-xs px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 text-gray-700 rounded-full transition-all"
                              data-testid={`suggested-prompt-${idx}`}
                            >
                              {prompt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {messages.map((message) => {
                        const ts = new Date(message.timestamp);
                        const safeTime = !isNaN(ts.getTime()) ? ts.toLocaleTimeString() : "";
                        return (
                          <div
                            key={message.id}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div className="max-w-[80%]">
                              <div
                                className={`rounded-2xl px-4 py-2.5 ${
                                  message.role === "user"
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">
                                  {message.content}
                                </p>

                                {/* Suggested Prompts */}
                                {message.suggestedPrompts &&
                                  message.suggestedPrompts.length > 0 && (
                                    <div className="mt-3 space-y-1">
                                      {message.suggestedPrompts.map(
                                        (prompt, idx) => (
                                          <button
                                            key={idx}
                                            onClick={() =>
                                              handlePromptClick(prompt)
                                            }
                                            className={`block w-full text-left text-xs rounded px-2 py-1 transition-colors ${
                                              message.role === "user"
                                                ? "bg-white/10 hover:bg-white/20 text-white"
                                                : "bg-purple-50 hover:bg-purple-100 text-purple-700"
                                            }`}
                                          >
                                            {prompt}
                                          </button>
                                        ),
                                      )}
                                    </div>
                                  )}
                              </div>
                              {/* Timestamp */}
                              <p
                                className={`text-xs mt-1 text-gray-400 ${
                                  message.role === "user" ? "text-right" : ""
                                }`}
                              >
                                {!isNaN(ts.getTime()) ? ts.toLocaleTimeString() : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}

                      {/* Typing Indicator */}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-gray-100 rounded-2xl px-4 py-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex space-x-1">
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "0ms" }}
                                />
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "150ms" }}
                                />
                                <div
                                  className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                  style={{ animationDelay: "300ms" }}
                                />
                              </div>
                              <span className="text-sm text-gray-600">
                                Thinking
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input Area */}
                  <div className="p-4 bg-gray-50 border-t border-gray-100">
                    <div className="flex gap-2 items-center">
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything about your project..."
                        className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-400 text-sm"
                        disabled={sendMessage.isPending}
                      />
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || sendMessage.isPending}
                        className="flex-shrink-0 w-9 h-9 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendMessage.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Chat History</DialogTitle>
            <DialogDescription>
              All conversations for {projectName || "this project"}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-6">
              {messages.length === 0 && conversationHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  No conversation history yet.
                </p>
              ) : (
                <>
                  {/* Current Conversation */}
                  {messages.length > 0 && (
                    <div>
                      <div className="sticky top-0 bg-white pb-2 mb-3 border-b">
                        <p className="text-sm font-semibold text-gray-700">
                          Current Conversation
                        </p>
                        <p className="text-xs text-gray-500">
                          Started {(() => { try { return new Date(messages[0]?.timestamp).toLocaleString(); } catch { return ""; } })()}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div className="max-w-[80%]">
                              <div
                                className={`rounded-2xl px-4 py-2.5 ${
                                  message.role === "user"
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">
                                  {message.content}
                                </p>
                              </div>
                              <p className="text-xs text-gray-400 mt-1 px-2">
                                {(() => { try { return new Date(message.timestamp).toLocaleTimeString(); } catch { return ""; } })()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Past Conversations */}
                  {conversationHistory.map((session, idx) => (
                    <div key={session.id}>
                      <div className="sticky top-0 bg-white pb-2 mb-3 border-b">
                        <p className="text-sm font-semibold text-gray-700">
                          Conversation {idx + 1}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(() => { try { return new Date(session.startTime).toLocaleString(); } catch { return ""; } })()}
                        </p>
                      </div>
                      <div className="space-y-3">
                        {session.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div className="max-w-[80%]">
                              <div
                                className={`rounded-2xl px-4 py-2.5 ${
                                  message.role === "user"
                                    ? "bg-gray-900 text-white"
                                    : "bg-gray-100 text-gray-900"
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">
                                  {message.content}
                                </p>
                              </div>
                              <p className="text-xs text-gray-400 mt-1 px-2">
                                {(() => { try { return new Date(message.timestamp).toLocaleTimeString(); } catch { return ""; } })()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
