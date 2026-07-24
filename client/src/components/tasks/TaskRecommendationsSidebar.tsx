import { useState, useEffect } from 'react';
import { Task, ToolStatus } from '@shared/schema';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, RefreshCw, ThumbsUp, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { getToolRecommendations, analyzeTask, updateToolStatus } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';

interface TaskRecommendationsSidebarProps {
  task: Task | null;
  onClose?: () => void;
}

type Tool = {
  id: number;
  name: string;
  description: string;
  category: string;
  freePlanAvailable: boolean;
  pricing: string | null;
  website: string;
  logoUrl: string | null;
  useCase: string | null;
  idealFor: string | null;
};

type ToolRecommendation = {
  recommendation: {
    id: number;
    taskId: number;
    toolId: number;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  tool: Tool;
};

export function TaskRecommendationsSidebar({ task, onClose }: TaskRecommendationsSidebarProps) {
  const queryClient = useQueryClient();
  
  // Automatically analyze task when it changes or when the component mounts
  useEffect(() => {
    if (task?.id) {
      // Auto-analyze task after a short delay
      const timer = setTimeout(() => {
        analyzeTaskMutation.mutate();
      }, 500); // Small delay to prevent too many calls if task changes rapidly
      
      return () => clearTimeout(timer);
    }
  }, [task?.id]);
  
  // Fetch tool recommendations
  const {
    data: recommendations,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["/api/tasks", task?.id, "tools"],
    queryFn: () => getToolRecommendations(task?.id as number),
    enabled: !!task?.id
  });
  
  // Mutation for analyzing task
  const analyzeTaskMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return Promise.reject("No task selected");
      return analyzeTask(task.id);
    },
    onSuccess: () => {
      refetch();
    },
    onError: (err: any) => {
      toast({
        title: "Analysis Failed",
        description: err.message || "Failed to analyze task. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Mutation for updating recommendation status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ toolId, status }: { toolId: number; status: string }) => {
      if (!task?.id) return Promise.reject("No task selected");
      return updateToolStatus(task.id, toolId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", task?.id, "tools"] });
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update tool status",
        variant: "destructive",
      });
    }
  });
  
  // No task selected
  if (!task) {
    return (
      <div className="flex flex-col h-full border-l bg-slate-50/80">
        <div className="p-4 border-b bg-white sticky top-0 z-10">
          <h2 className="text-lg font-medium">AI Tool Recommendations</h2>
          <p className="text-sm text-muted-foreground">Get personalized tool suggestions for your tasks</p>
        </div>
        
        <div className="flex flex-col justify-center items-center h-full p-6 text-center space-y-4">
          <div className="relative w-24 h-24 mb-4">
            <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-25"></div>
            <div className="absolute inset-2 bg-blue-200 rounded-full animate-pulse"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-blue-600"
              >
                <path d="M12 2v8"></path>
                <path d="m4.93 10.93 1.41 1.41"></path>
                <path d="M2 18h2"></path>
                <path d="M20 18h2"></path>
                <path d="m19.07 10.93-1.41 1.41"></path>
                <path d="M22 22H2"></path>
                <path d="m8 22 4-10 4 10"></path>
              </svg>
            </div>
          </div>
          
          <h3 className="text-xl font-semibold text-primary">Select Any Task</h3>
          <p className="text-muted-foreground max-w-xs">
            Click on a task from the left sidebar to get AI-powered tool recommendations tailored to help you complete it efficiently.
          </p>
          
          <div className="mt-4 flex flex-col gap-2 items-center">
            <div className="flex gap-2 animate-pulse">
              {[...Array(3)].map((_, i) => (
                <div 
                  key={i} 
                  className="h-2 w-2 rounded-full bg-blue-400"
                  style={{ animationDelay: `${i * 0.2}s` }}
                ></div>
              ))}
            </div>
            <span className="text-sm text-muted-foreground">Waiting for selection...</span>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full border-l bg-slate-50/80">
      <div className="p-4 border-b bg-white sticky top-0 z-10 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-medium">Let AI tools help you!</h2>
          <p className="text-sm text-muted-foreground truncate max-w-[250px]">
            {task.name}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="p-4 space-y-4 overflow-auto flex-grow">
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-8 w-20" />
            </div>
            
            {[1, 2].map((i) => (
              <Card key={i} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-full mt-1" />
                  <Skeleton className="h-4 w-3/4 mt-1" />
                </div>
                <div className="bg-slate-50 p-3 border-t">
                  <div className="flex justify-between">
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-20" />
                    <Skeleton className="h-9 w-20" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : isError ? (
          <div className="py-4 text-center">
            <p className="text-destructive">
              Error loading recommendations: {(error as Error)?.message || "Something went wrong"}
            </p>
            <Button variant="outline" className="mt-2" onClick={() => refetch()}>
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Recommended Tools</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => refetch()}
                className="h-8 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh Recommendations
              </Button>
            </div>
            
            {(!recommendations || recommendations.length === 0) ? (
              <div className="py-8 text-center">
                <div className="mb-6 relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 bg-blue-100 rounded-full animate-ping opacity-20"></div>
                  <div className="absolute inset-2 bg-blue-200 rounded-full animate-pulse"></div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
                  </div>
                </div>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Our AI is analyzing your task to find the perfect tools. This should only take a moment...
                </p>
                <div className="mt-4 w-48 h-2 mx-auto bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: '60%', animation: 'progress 2s ease-in-out infinite' }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {recommendations.map(({ recommendation, tool }: ToolRecommendation, index: number) => (
                  <div 
                    key={recommendation.id} 
                    className="animate-fadeIn" 
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <Card className="overflow-hidden border-2 hover:border-blue-300 hover:shadow-md transition-all duration-300">
                      <CardContent className="p-4 pb-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-lg text-blue-800">{tool.name}</h4>
                              {tool.freePlanAvailable && (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  Free Plan
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize flex items-center gap-1">
                              <span className="inline-block w-2 h-2 rounded-full bg-blue-400"></span>
                              {tool.category}
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            asChild
                            className="h-8 w-8 rounded-full hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          >
                            <a 
                              href={tool.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center justify-center"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                        
                        <div className="relative mt-3 border-l-2 border-blue-100 pl-3">
                          <p className="text-sm text-muted-foreground">{tool.description}</p>
                        </div>
                        
                        {tool.pricing && (
                          <div className="mt-3 p-2 bg-slate-50 rounded-md">
                            <p className="text-sm flex gap-2 items-center">
                              <span className="font-medium flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                                  <circle cx="12" cy="12" r="10"/>
                                  <path d="M16 8h-6.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H6"/>
                                  <path d="M12 18v2"/>
                                  <path d="M12 6v2"/>
                                </svg>
                                Pricing:
                              </span> 
                              {tool.pricing}
                            </p>
                          </div>
                        )}
                      </CardContent>
                      
                      <div className="bg-slate-50 p-3 mt-4 border-t">
                        <div className="flex justify-between gap-2">
                          <Button 
                            variant={recommendation.status === ToolStatus.USED ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "flex-1 text-xs h-9 transition-all duration-300",
                              recommendation.status === ToolStatus.USED ? 
                                "bg-green-600 hover:bg-green-700" : 
                                "text-green-700 border-green-200 hover:bg-green-50"
                            )}
                            onClick={() => updateStatusMutation.mutate({ 
                              toolId: tool.id, 
                              status: ToolStatus.USED 
                            })}
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            {recommendation.status === ToolStatus.USED ? "Already Using" : "Mark as Used"}
                          </Button>
                          
                          <Button 
                            variant={recommendation.status === ToolStatus.SAVED ? "default" : "outline"}
                            size="sm"
                            className={cn(
                              "flex-1 text-xs h-9 transition-all duration-300",
                              recommendation.status === ToolStatus.SAVED ? 
                                "bg-blue-600 hover:bg-blue-700" : 
                                "text-blue-700 border-blue-200 hover:bg-blue-50"
                            )}
                            onClick={() => updateStatusMutation.mutate({ 
                              toolId: tool.id, 
                              status: ToolStatus.SAVED 
                            })}
                          >
                            <ThumbsUp className="mr-1 h-3 w-3" />
                            {recommendation.status === ToolStatus.SAVED ? "Saved" : "Save for Later"}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
