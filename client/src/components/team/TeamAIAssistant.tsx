import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, Send, Loader2, Users, Target, TrendingUp, 
  AlertCircle, Lightbulb, Zap, UserCheck, Clock
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  suggestions?: AssignmentSuggestion[];
  alerts?: CapacityAlert[];
  timestamp: Date;
}

interface AssignmentSuggestion {
  taskId: number;
  taskTitle: string;
  suggestedMember: {
    id: number;
    name: string;
    reason: string;
  };
  alternativeMembers?: {
    id: number;
    name: string;
    reason: string;
  }[];
  aiSuitable: boolean;
  confidence: number;
}

interface CapacityAlert {
  type: 'overload' | 'underutilized' | 'skill_gap' | 'deadline_risk';
  severity: 'low' | 'medium' | 'high';
  memberId?: number;
  memberName?: string;
  message: string;
  suggestedAction: string;
}

// Predefined prompts for quick actions
const quickPrompts = [
  { icon: Users, text: "Show me everyone with available time this week", action: "available_members" },
  { icon: AlertCircle, text: "Flag any overloaded team members", action: "overloaded_check" },
  { icon: Target, text: "Who can take over critical UI bugs?", action: "skill_match_ui" },
  { icon: Lightbulb, text: "Suggest work for underutilized members", action: "suggest_work" },
  { icon: Zap, text: "Optimize task assignments with AI", action: "ai_optimize" },
];

export default function TeamAIAssistant({ onClose }: { onClose?: () => void }) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: "I'm your Team AI Assistant! I can help you manage workload, assign tasks, and optimize team capacity. What would you like to know?",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');

  // AI chat mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest('/api/team/ai-assistant', {
        method: 'POST',
        body: JSON.stringify({ 
          message,
          context: {
            previousMessages: messages.slice(-5), // Send last 5 messages for context
          }
        })
      });
      return response;
    },
    onSuccess: (data) => {
      const assistantMessage: Message = {
        id: Date.now().toString(),
        type: 'assistant',
        content: data.message,
        suggestions: data.suggestions,
        alerts: data.alerts,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to get AI response",
        variant: "destructive",
      });
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    sendMessageMutation.mutate(input);
    setInput('');
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    handleSend();
  };

  const handleAssignTask = async (suggestion: AssignmentSuggestion) => {
    try {
      await apiRequest(`/api/tasks/${suggestion.taskId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ 
          teamMemberId: suggestion.suggestedMember.id 
        })
      });
      
      toast({
        title: "Task assigned",
        description: `${suggestion.taskTitle} assigned to ${suggestion.suggestedMember.name}`,
      });

      // Add system message
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `✓ Task "${suggestion.taskTitle}" has been assigned to ${suggestion.suggestedMember.name}`,
        timestamp: new Date()
      }]);
    } catch (error: any) {
      toast({
        title: "Assignment failed",
        description: error.message || "Failed to assign task",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto h-[600px] flex flex-col">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Team AI Assistant</CardTitle>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              ✕
            </Button>
          )}
        </div>
        <CardDescription>
          Ask me about team capacity, task assignments, and workload optimization
        </CardDescription>
      </CardHeader>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.type === 'user' && "flex-row-reverse"
              )}
            >
              {message.type !== 'system' && (
                <Avatar className="h-8 w-8">
                  {message.type === 'assistant' ? (
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Brain className="h-4 w-4" />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback>U</AvatarFallback>
                  )}
                </Avatar>
              )}
              
              <div className={cn(
                "flex-1 space-y-2",
                message.type === 'user' && "flex flex-col items-end"
              )}>
                <div className={cn(
                  "rounded-lg px-4 py-2 max-w-[80%]",
                  message.type === 'user' && "bg-primary text-primary-foreground",
                  message.type === 'assistant' && "bg-muted",
                  message.type === 'system' && "bg-blue-50 text-blue-700 w-full text-center text-sm"
                )}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>

                {/* Assignment suggestions */}
                {message.suggestions && message.suggestions.length > 0 && (
                  <div className="space-y-2 max-w-[80%]">
                    {message.suggestions.map((suggestion, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{suggestion.taskTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                Suggested: {suggestion.suggestedMember.name}
                              </p>
                            </div>
                            <Badge variant={suggestion.confidence > 80 ? "default" : "secondary"}>
                              {suggestion.confidence}% match
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {suggestion.suggestedMember.reason}
                          </p>
                          {suggestion.aiSuitable && (
                            <div className="flex items-center gap-1 text-xs text-blue-600">
                              <Zap className="h-3 w-3" />
                              <span>AI can handle this task</span>
                            </div>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleAssignTask(suggestion)}
                            className="w-full"
                          >
                            <UserCheck className="h-3 w-3 mr-1" />
                            Assign to {suggestion.suggestedMember.name}
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Capacity alerts */}
                {message.alerts && message.alerts.length > 0 && (
                  <div className="space-y-2 max-w-[80%]">
                    {message.alerts.map((alert, idx) => (
                      <div
                        key={idx}
                        className={cn(
                          "rounded-lg p-3 text-sm",
                          alert.severity === 'high' && "bg-red-50 border border-red-200",
                          alert.severity === 'medium' && "bg-orange-50 border border-orange-200",
                          alert.severity === 'low' && "bg-yellow-50 border border-yellow-200"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <AlertCircle className={cn(
                            "h-4 w-4 mt-0.5",
                            alert.severity === 'high' && "text-red-500",
                            alert.severity === 'medium' && "text-orange-500",
                            alert.severity === 'low' && "text-yellow-500"
                          )} />
                          <div className="flex-1">
                            <p className="font-medium">{alert.message}</p>
                            <p className="text-xs mt-1 text-muted-foreground">
                              {alert.suggestedAction}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  {message.timestamp.toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <Brain className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t p-4 space-y-3">
        {/* Quick prompts */}
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt, idx) => (
            <Button
              key={idx}
              variant="outline"
              size="sm"
              onClick={() => handleQuickPrompt(prompt.text)}
              className="text-xs"
            >
              <prompt.icon className="h-3 w-3 mr-1" />
              {prompt.text}
            </Button>
          ))}
        </div>

        {/* Input field */}
        <div className="flex gap-2">
          <Input
            placeholder="Ask about team capacity, task assignments..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            disabled={sendMessageMutation.isPending}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || sendMessageMutation.isPending}
            size="icon"
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}