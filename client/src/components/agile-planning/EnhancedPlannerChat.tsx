import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, 
  Loader2, 
  MessageSquare, 
  Sparkles,
  User,
  Bot
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  action?: any;
}

interface EnhancedPlannerChatProps {
  canvas: any;
  onCanvasUpdate: (canvas: any) => void;
  onActionPerformed: (action: any) => void;
}

export function EnhancedPlannerChat({ 
  canvas, 
  onCanvasUpdate, 
  onActionPerformed 
}: EnhancedPlannerChatProps) {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [actionHistory, setActionHistory] = useState<string[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Enhanced AI processing mutation
  const processMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiRequest('/api/agile-planning/enhanced-chat', {
        method: 'POST',
        body: JSON.stringify({
          message,
          canvas: canvas,
          chatHistory: messages.slice(-3), // Last 3 messages for context
          actionHistory: actionHistory.slice(-5) // Last 5 actions
        })
      });
    },
    onSuccess: (response) => {
      // Add assistant response to chat
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        content: response.explanation || 'Action completed',
        role: 'assistant',
        timestamp: new Date(),
        action: response.action
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update action history
      const actionDescription = `${response.action}: ${response.explanation || 'Performed action'}`;
      setActionHistory(prev => [...prev, actionDescription]);
      
      // Apply canvas update if needed
      if (response.updatedCanvas) {
        onCanvasUpdate(response.updatedCanvas);
        onActionPerformed(response);
      }
      
      // Show success notification
      toast({
        title: "Action Completed",
        description: response.explanation || "Successfully processed your request",
      });
    },
    onError: (error: any) => {
      console.error('Enhanced chat error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process your request",
        variant: "destructive"
      });
    }
  });

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
        if (scrollElement) {
          scrollElement.scrollTop = scrollElement.scrollHeight;
        }
      }
    };
    
    // Use setTimeout to ensure DOM has updated
    setTimeout(scrollToBottom, 100);
  }, [messages, processMessageMutation.isPending]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || processMessageMutation.isPending) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      content: chatInput,
      role: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // Process with enhanced AI
    processMessageMutation.mutate(chatInput);
    
    setChatInput('');
  };

  // Quick action buttons
  const quickActions = [
    "Add a new story for user authentication",
    "Update the first epic description",
    "Add acceptance criteria to login story", 
    "Create epic for data management",
    "Estimate story points for all stories",
    "Regenerate the testing section"
  ];

  const handleQuickAction = (action: string) => {
    setChatInput(action);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-violet-500" />
          Enhanced AI Assistant
          <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700">
            Context-Aware
          </Badge>
        </CardTitle>
        <p className="text-sm text-gray-600">
          I understand your project context and can make targeted updates
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 p-0">
        {/* Chat Messages */}
        <div className="flex-1 px-4 overflow-hidden">
          <ScrollArea className="h-full chat-scroll-area" ref={scrollAreaRef}>
            <div className="space-y-4 py-4">
            {messages.length === 0 && (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">
                  Start chatting to modify your agile plan
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  I can add stories, update epics, or regenerate sections
                </p>
              </div>
            )}

            <AnimatePresence>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' 
                        ? 'bg-violet-100 text-violet-600' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>

                    {/* Message Bubble */}
                    <div className={`rounded-lg px-4 py-2 min-w-0 flex-1 ${
                      message.role === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-gray-100 text-gray-900'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap chat-message">{message.content}</p>
                      {message.action && (
                        <div className="mt-2 text-xs opacity-75">
                          <Badge variant="secondary" className="text-xs">
                            {message.action.action}
                          </Badge>
                        </div>
                      )}
                      <p className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Loading indicator */}
            {processMessageMutation.isPending && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm text-gray-600">Analyzing and updating...</span>
                  </div>
                </div>
              </motion.div>
            )}
            </div>
          </ScrollArea>
        </div>

        {/* Quick Actions */}
        {messages.length === 0 && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-500 mb-2">Quick actions:</p>
            <div className="flex flex-wrap gap-2">
              {quickActions.slice(0, 3).map((action, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickAction(action)}
                  className="text-xs h-7 px-2 border-violet-200 text-violet-700 hover:bg-violet-50"
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 pb-4">
          <div className="flex gap-2">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Add a story, update epic, or ask for analysis..."
              disabled={processMessageMutation.isPending}
              className="flex-1"
            />
            <Button 
              onClick={handleSendMessage}
              disabled={processMessageMutation.isPending || !chatInput.trim()}
              size="sm"
            >
              {processMessageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}