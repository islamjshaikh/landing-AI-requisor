import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  Sparkles, 
  User, 
  CheckCircle, 
  Loader2, 
  Play, 
  Plus,
  FolderOpen,
  Clock,
  BarChart3,
  Target,
  Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage, ChatAction } from "@shared/ai-types";
import { format } from "date-fns";

interface DynamicChatProps {
  projectId?: number;
  className?: string;
}

export function DynamicChat({ projectId, className }: DynamicChatProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [clarifications, setClarifications] = useState<any[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: `Hi! I'm your Requisor AI assistant. I can help you create and manage projects, analyze your work, and handle tasks through natural conversation.

**What I can do:**
• Create new projects from descriptions
• Add and manage tasks
• Analyze project health and progress
• Optimize timelines and workflows
• Answer questions about your work
• Execute actions based on your requests

**Try saying:**
"Create a new web app project" or "Show me overdue tasks" or "Analyze current project"

What would you like to work on?`,
        timestamp: new Date(),
        projectId
      };
      setMessages([welcomeMessage]);
    }
  }, [messages.length, projectId]);

  // Enhanced AI chat mutation with continuous conversation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, projectId, sessionId })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send message');
      }
      
      return response.json();
    },
    onMutate: () => {
      setIsTyping(true);
    },
    onSuccess: (data) => {
      // Update session ID if provided (for deep intelligence)
      if (data.sessionId) {
        setSessionId(data.sessionId);
      }
      
      // Update clarifications if provided
      if (data.clarifications) {
        setClarifications(data.clarifications);
      }
      
      const assistantMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.content,
        timestamp: new Date(),
        projectId,
        actions: data.actions || [],
        suggestions: data.suggestions || [],
        projectPlan: data.projectCanvas || data.projectPlan
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsTyping(false);
      
      // Refresh data after AI response
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens/budget'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens/usage'] });
    },
    onError: (error: Error) => {
      setIsTyping(false);
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Execute action mutation with real-time updates
  const executeActionMutation = useMutation({
    mutationFn: async (action: ChatAction) => {
      const response = await fetch('/api/ai/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, projectId })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to execute action');
      }
      return response.json();
    },
    onSuccess: (result, action) => {
      // Mark action as executed
      setMessages(prev => prev.map(msg => ({
        ...msg,
        actions: msg.actions?.map(a => 
          a.id === action.id ? { ...a, executed: true } : a
        )
      })));
      
      // Add system message about execution
      const systemMessage: ChatMessage = {
        id: `system_${Date.now()}`,
        role: 'assistant',
        content: `✅ **Action completed:** ${action.label}\n\n${result.message || 'Action executed successfully.'}`,
        timestamp: new Date(),
        projectId
      };
      setMessages(prev => [...prev, systemMessage]);
      
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens/budget'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tokens/usage'] });
      
      toast({
        title: "Action Completed",
        description: `Successfully executed: ${action.label}`,
      });
    },
    onError: (error: Error, action) => {
      toast({
        title: "Action Failed",
        description: `Failed to execute: ${action.label}. ${error.message}`,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sendMessageMutation.isPending) return;
    
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      projectId
    };
    
    setMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate(input.trim());
    setInput("");
  };

  const handleExecuteAction = (action: ChatAction) => {
    if (action.executed || executeActionMutation.isPending) return;
    executeActionMutation.mutate(action);
  };

  const quickSuggestions = [
    { icon: Plus, label: "Create Project", prompt: "Create a new project for building a mobile app" },
    { icon: FolderOpen, label: "View Projects", prompt: "Show me all my current projects" },
    { icon: Clock, label: "Overdue Tasks", prompt: "What tasks are overdue?" },
    { icon: BarChart3, label: "Project Analysis", prompt: "Analyze my project performance" },
    { icon: Target, label: "Optimize Timeline", prompt: "Help me optimize my project timeline" },
    { icon: Calendar, label: "This Week", prompt: "What should I focus on this week?" }
  ];

  const handleQuickSuggestion = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  return (
    <div className={cn("flex flex-col h-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden", className)}>
      {/* Minimal Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Requisor AI Assistant</h3>
            <p className="text-xs text-gray-500 mt-0.5">Chat naturally to manage your projects</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-500">
              {projectId ? 'Project Mode' : 'General Mode'}
            </span>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-6" ref={scrollAreaRef}>
        <div className="space-y-6 py-6">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex",
                message.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%]",
                message.role === 'user' ? "order-2" : ""
              )}>
                {/* Message bubble */}
                <div className={cn(
                  "rounded-2xl px-5 py-3",
                  message.role === 'user' 
                    ? "bg-gray-900 text-white" 
                    : "bg-gray-100 text-gray-900"
                )}>
                  <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                </div>
                {/* Timestamp */}
                <div className={cn(
                  "mt-1.5 text-xs text-gray-400",
                  message.role === 'user' ? "text-right" : ""
                )}>
                  {format(message.timestamp, 'HH:mm')}
                </div>

                {/* Action Buttons */}
                {message.actions && message.actions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {message.actions.map((action) => (
                      <Button
                        key={action.id}
                        variant={action.executed ? "secondary" : "default"}
                        size="sm"
                        onClick={() => handleExecuteAction(action)}
                        disabled={action.executed || executeActionMutation.isPending}
                        className="text-xs"
                      >
                        {action.executed ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : executeActionMutation.isPending ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Play className="w-3 h-3 mr-1" />
                        )}
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-2xl px-5 py-3">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-600">Thinking</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Suggestions (when conversation is new) */}
      {messages.length <= 1 && (
        <div className="px-6 py-4">
          <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider">Quick actions:</p>
          <div className="flex flex-wrap gap-2">
            {quickSuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleQuickSuggestion(suggestion.prompt)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium 
                  border border-gray-200 bg-white hover:bg-gray-50 transition-all hover:border-gray-300
                  text-gray-700"
              >
                <suggestion.icon className="h-3 w-3" />
                <span>{suggestion.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="p-6 bg-gray-50 border-t border-gray-100">
        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your projects..."
            disabled={sendMessageMutation.isPending}
            className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent placeholder-gray-400 text-sm"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || sendMessageMutation.isPending}
            className="flex-shrink-0 w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </form>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send. I can help you create projects, manage tasks, and optimize your workflow.
        </p>
      </div>
    </div>
  );
}