import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export interface WebSocketMessage {
  type: 'project_update' | 'task_update' | 'team_update' | 'invitation_update';
  action: 'created' | 'updated' | 'deleted';
  data: any;
}

export function useWebSocket(enabled: boolean = true) {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      switch (message.type) {
        case 'project_update':
          // Invalidate project queries
          queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
          if (message.data.id) {
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.data.id}`] });
          }
          break;
          
        case 'task_update':
          // Invalidate task queries
          queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
          if (message.data.projectId) {
            queryClient.invalidateQueries({ queryKey: [`/api/projects/${message.data.projectId}/tasks`] });
          }
          break;
          
        case 'team_update':
          // Invalidate team member queries
          queryClient.invalidateQueries({ queryKey: ['/api/smart-bandwidth/team-members'] });
          break;
          
        case 'invitation_update':
          // Invalidate invitation queries
          queryClient.invalidateQueries({ queryKey: ['/api/invitations'] });
          if (message.action === 'created') {
            toast({
              title: "New invitation",
              description: `You have a new team invitation`,
            });
          }
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }, [queryClient, toast]);

  const connect = useCallback(() => {
    if (!enabled) return;
    
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
      };
      
      ws.current.onmessage = handleMessage;
      
      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        reconnectAttempts.current += 1;
        
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
      
      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
    }
  }, [enabled, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { sendMessage };
}