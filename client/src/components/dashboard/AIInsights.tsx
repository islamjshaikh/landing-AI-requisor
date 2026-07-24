import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CardSkeleton } from "@/components/ui/skeleton";
import { InsightItem, InsightType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { 
  Cpu, 
  RefreshCw,
  AlertTriangle, 
  CheckCircle,
  TrendingUp,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";

export function AIInsights() {
  const [insightsLoaded, setInsightsLoaded] = useState(false);
  const { toast } = useToast();
  
  // Query for fetching AI insights
  const { 
    data: insights, 
    isLoading, 
    isError, 
    refetch,
    isSuccess
  } = useQuery({
    queryKey: ["/api/insights"],
    enabled: false, // Don't fetch automatically on mount
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
  
  // Handle query success and error
  useEffect(() => {
    if (isSuccess) {
      setInsightsLoaded(true);
    } else if (isError) {
      setInsightsLoaded(false);
    }
  }, [isSuccess, isError]);
  
  // Mutation for generating action plan
  const generateActionPlan = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/action-plan", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Action Plan Generated",
        description: "Your AI action plan is ready to review.",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to generate action plan",
        description: error.message || "There was an error creating the action plan.",
        variant: "destructive",
      });
    },
  });

  const handleLoadInsights = () => {
    refetch();
  };

  const getInsightIcon = (type: InsightType) => {
    switch (type) {
      case 'bottleneck':
        return <AlertTriangle className="text-amber-600 mr-2" size={18} />;
      case 'resource-conflict':
        return <AlertTriangle className="text-amber-600 mr-2" size={18} />;
      case 'timeline-risk':
        return <TrendingUp className="text-blue-600 mr-2" size={18} />;
      case 'on-track':
        return <CheckCircle className="text-green-600 mr-2" size={18} />;
      default:
        return <AlertTriangle className="text-amber-600 mr-2" size={18} />;
    }
  };

  const getInsightColor = (type: InsightType) => {
    switch (type) {
      case 'bottleneck':
        return 'bg-amber-50';
      case 'resource-conflict':
        return 'bg-amber-50';
      case 'timeline-risk':
        return 'bg-blue-50';
      case 'on-track':
        return 'bg-green-50';
      default:
        return 'bg-amber-50';
    }
  };

  const getInsightTextColor = (type: InsightType) => {
    switch (type) {
      case 'bottleneck':
        return 'text-amber-800';
      case 'resource-conflict':
        return 'text-amber-800';
      case 'timeline-risk':
        return 'text-blue-800';
      case 'on-track':
        return 'text-green-800';
      default:
        return 'text-amber-800';
    }
  };

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-800">AI Insights</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 h-[calc(100%-2rem)]">
        {isLoading && <CardSkeleton height={300} />}

        {!isLoading && !insightsLoaded && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
              <Cpu className="h-10 w-10" />
            </div>
            <h3 className="text-slate-400 font-medium mb-2">Failed to load AI insights</h3>
            <p className="text-sm text-slate-500 mb-4">Insights could not be generated at this time.</p>
            <Button 
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg text-sm"
              onClick={handleLoadInsights}
            >
              <RefreshCw className="mr-2 h-4 w-4" />Refresh
            </Button>
          </div>
        )}

        {!isLoading && insightsLoaded && (
          <div className="space-y-4">
            {/* Resource Conflict */}
            <div className="bg-amber-50 rounded-lg p-3">
              <h4 className="text-amber-800 font-medium flex items-center">
                <AlertTriangle className="text-amber-600 mr-2" size={16} />
                Resource Conflict Detected
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                Development team is overallocated by 15% in the next sprint.
              </p>
            </div>

            {/* Project Optimization */}
            <div className="bg-blue-50 rounded-lg p-3">
              <h4 className="text-blue-800 font-medium flex items-center">
                <TrendingUp className="text-blue-600 mr-2" size={16} />
                Project Optimization
              </h4>
              <p className="text-sm text-blue-700 mt-1">
                Resequencing 3 tasks could reduce project timeline by 5 days.
              </p>
            </div>

            {/* On-Track Projects */}
            <div className="bg-green-50 rounded-lg p-3">
              <h4 className="text-green-800 font-medium flex items-center">
                <CheckCircle className="text-green-600 mr-2" size={16} />
                On-Track Projects
              </h4>
              <p className="text-sm text-green-700 mt-1">
                6 of 8 projects are progressing as planned with no critical issues.
              </p>
            </div>

            {/* Generate Action Plan */}
            <div className="mt-6">
              <Button 
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm"
                onClick={() => generateActionPlan.mutate()}
                disabled={generateActionPlan.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Action Plan
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
