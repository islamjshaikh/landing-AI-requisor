import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Loader2, RefreshCw, ThumbsUp, XCircle, CheckCircle2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ToolStatus } from '@shared/schema';
import { toast } from '@/hooks/use-toast';
import { getToolRecommendations, analyzeTask, updateToolStatus } from '@/lib/api';

/**
 * Types for tool recommendations
 */
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

type TaskToolRecommendationsProps = {
  taskId: number;
};

/**
 * Component for displaying and managing tool recommendations for a task
 */
export function TaskToolRecommendations({ taskId }: TaskToolRecommendationsProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();
  
  // Fetch tool recommendations
  const {
    data: recommendations,
    isLoading,
    isError,
    error,
    refetch
  } = useQuery({
    queryKey: ["/api/tasks", taskId, "tools"],
    queryFn: () => getToolRecommendations(taskId),
    enabled: !!taskId
  });
  
  // Mutation for analyzing task
  const analyzeTaskMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      return analyzeTask(taskId);
    },
    onSuccess: () => {
      refetch();
      toast({
        title: "Task Analyzed",
        description: "We've analyzed your task and found tool recommendations",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Analysis Failed",
        description: err.message || "Failed to analyze task. Please try again.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsAnalyzing(false);
    }
  });
  
  // Mutation for updating recommendation status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ toolId, status }: { toolId: number; status: string }) => {
      return updateToolStatus(taskId, toolId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", taskId, "tools"] });
    },
    onError: (err: any) => {
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update tool status",
        variant: "destructive",
      });
    }
  });
  
  // Handle status changes
  const handleStatusChange = (toolId: number, status: string) => {
    updateStatusMutation.mutate({ toolId, status });
  };
  
  // Handle analyzing task
  const handleAnalyzeTask = () => {
    analyzeTaskMutation.mutate();
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  // Show error state
  if (isError) {
    return (
      <div className="py-4 text-center">
        <p className="text-destructive">
          Error loading recommendations: {(error as Error)?.message || "Something went wrong"}
        </p>
        <Button variant="outline" className="mt-2" onClick={() => refetch()}>
          Try Again
        </Button>
      </div>
    );
  }
  
  // No recommendations yet
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-muted-foreground mb-4">
          No tool recommendations yet. Let AI analyze this task to suggest helpful tools.
        </p>
        <Button 
          onClick={handleAnalyzeTask}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Analyze Task
            </>
          )}
        </Button>
      </div>
    );
  }
  
  // Render recommendations
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Recommended Tools</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleAnalyzeTask}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Recommendations
            </>
          )}
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recommendations.map(({ recommendation, tool }) => (
          <Card key={recommendation.id} className="h-full flex flex-col">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center">
                    {tool.name}
                    {tool.freePlanAvailable && (
                      <Badge variant="outline" className="ml-2 bg-green-50 text-green-700 border-green-200">
                        Free Plan
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>{tool.category}</CardDescription>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        asChild
                        className="h-8 w-8"
                      >
                        <a 
                          href={tool.website} 
                          target="_blank" 
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Visit Website</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent className="flex-grow">
              <p className="text-sm text-muted-foreground">{tool.description}</p>
              {tool.pricing && (
                <p className="text-sm mt-2">
                  <span className="font-medium">Pricing:</span> {tool.pricing}
                </p>
              )}
            </CardContent>
            <CardFooter className="border-t pt-4 flex justify-between gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={recommendation.status === ToolStatus.USED ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => handleStatusChange(tool.id, ToolStatus.USED)}
                    >
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      Used
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Mark as used in your project</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={recommendation.status === ToolStatus.SAVED ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => handleStatusChange(tool.id, ToolStatus.SAVED)}
                    >
                      <ThumbsUp className="mr-1 h-4 w-4" />
                      Save
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Save for later consideration</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant={recommendation.status === ToolStatus.IGNORED ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => handleStatusChange(tool.id, ToolStatus.IGNORED)}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Ignore
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Hide this recommendation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
