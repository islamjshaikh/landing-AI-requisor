import React, { useState } from 'react';
import { Task } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, X, Sparkles, ExternalLink, Star, Clock, TrendingUp } from 'lucide-react';
import { TaskRecommendationsSidebar } from './TaskRecommendationsSidebar';
import { cn } from '@/lib/utils';

interface CollapsibleAIRecommendationsProps {
  task: Task | null;
  onClose: () => void;
}

export function CollapsibleAIRecommendations({ task, onClose }: CollapsibleAIRecommendationsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // If no task is selected, show minimized state
  if (!task) {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          variant="outline"
          size="sm"
          className="shadow-lg bg-white border-purple-200 text-purple-700 hover:bg-purple-50"
          onClick={() => {/* Could open task selection or show general recommendations */}}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI Tools Ready
        </Button>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <Button
          variant="outline"
          size="sm"
          className="shadow-lg bg-white border-blue-200 text-blue-700 hover:bg-blue-50"
          onClick={() => setIsMinimized(false)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI Recommendations ({task.title.slice(0, 20)}...)
        </Button>
      </div>
    );
  }

  return (
    <div className={cn(
      "fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-xl transition-all duration-300 z-40",
      isCollapsed ? "w-12" : "w-80"
    )}>
      {isCollapsed ? (
        // Collapsed state - just the expand button
        <div className="p-2 h-full flex flex-col items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(false)}
            className="mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex-1 flex items-center justify-center">
            <div className="writing-mode-vertical text-xs text-gray-500 transform rotate-180">
              AI Tools
            </div>
          </div>
        </div>
      ) : (
        // Expanded state - full recommendations panel
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                <h3 className="font-medium text-gray-900">AI Tools</h3>
              </div>
              
              <div className="flex items-center space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMinimized(true)}
                  className="h-8 w-8 p-0"
                  title="Minimize"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsCollapsed(true)}
                  className="h-8 w-8 p-0"
                  title="Collapse"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Task context */}
            <div className="mt-2">
              <p className="text-sm text-gray-600 truncate">{task.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {task.priority} priority
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {task.status.replace('-', ' ')}
                </Badge>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <TaskRecommendationsSidebar task={task} onClose={onClose} />
          </div>
        </div>
      )}
    </div>
  );
}