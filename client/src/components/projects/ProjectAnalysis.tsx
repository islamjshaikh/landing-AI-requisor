import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deepProjectAnalysis } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  BarChart2, 
  Cpu, 
  AlertTriangle, 
  CheckCircle, 
  FileSearch, 
  Lightbulb, 
  Activity,
  TrendingUp
} from "lucide-react";
import { AnalysisDimension, DeepAnalysisResult } from "@/types";

interface ProjectAnalysisProps {
  projectId: number;
}

export function ProjectAnalysis({ projectId }: ProjectAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: analysis, isLoading, isError, refetch } = useQuery<DeepAnalysisResult>({
    queryKey: [`/api/ai/deep-project-analysis/${projectId}`],
    enabled: false, // Don't run automatically
  });
  
  const analysisMutation = useMutation({
    mutationFn: async () => {
      setIsAnalyzing(true);
      const result = await deepProjectAnalysis(projectId);
      setIsAnalyzing(false);
      return result;
    },
    onSuccess: (data) => {
      queryClient.setQueryData([`/api/ai/deep-project-analysis/${projectId}`], data);
      queryClient.invalidateQueries({ queryKey: ['/api/insights'] });
    }
  });
  
  const handleAnalyzeClick = () => {
    analysisMutation.mutate();
  };
  
  const renderDimensionCard = (dimension: AnalysisDimension) => {
    // Determine score color based on score value
    let scoreColor = "text-gray-500";
    if (dimension.score >= 8) scoreColor = "text-green-500";
    else if (dimension.score >= 6) scoreColor = "text-blue-500";
    else if (dimension.score >= 4) scoreColor = "text-yellow-500";
    else scoreColor = "text-red-500";
    
    return (
      <Card key={dimension.name} className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-lg">{dimension.name}</CardTitle>
            <div className={`font-bold text-xl ${scoreColor}`}>{dimension.score}/10</div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-2">{dimension.assessment}</p>
          <Separator className="my-2" />
          <div className="mt-3">
            <h4 className="text-sm font-semibold mb-1 flex items-center">
              <Lightbulb className="h-4 w-4 mr-1" /> Recommendations
            </h4>
            <ul className="text-sm space-y-1 list-disc list-inside">
              {dimension.recommendations.map((rec: string, i: number) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Cpu className="mr-2 h-5 w-5" /> Advanced AI Analysis
          </h2>
          <p className="text-sm text-gray-500">
            Deep analysis of your project across multiple dimensions using AI
          </p>
        </div>
        <Button 
          onClick={handleAnalyzeClick}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <>Analyzing... <BarChart2 className="ml-2 h-4 w-4 animate-spin" /></>
          ) : (
            <>Run Advanced Analysis <FileSearch className="ml-2 h-4 w-4" /></>
          )}
        </Button>
      </div>
      
      {analysisMutation.isPending && (
        <Card className="p-6 my-4">
          <div className="space-y-3">
            <h3 className="text-lg font-medium">AI is analyzing your project...</h3>
            <p className="text-sm text-gray-500">
              We're performing a comprehensive evaluation of your project across multiple dimensions including methodology fit, resource allocation, timeline optimization, and more.
            </p>
            <Progress value={isAnalyzing ? 70 : 100} className="h-2" />
            <p className="text-xs text-gray-400">This may take up to 30 seconds</p>
          </div>
        </Card>
      )}
      
      {analysisMutation.isError && (
        <Alert variant="destructive" className="my-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Analysis Failed</AlertTitle>
          <AlertDescription>
            There was an error analyzing your project. Please try again later.
          </AlertDescription>
        </Alert>
      )}
      
      {analysis && (
        <div className="space-y-6 mt-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Project Health Score</CardTitle>
                  <CardDescription>Overall quality assessment of your project</CardDescription>
                </div>
                <div className="flex items-center text-3xl font-bold">
                  {analysis.overallRating}/10
                  {analysis.overallRating >= 7 ? (
                    <CheckCircle className="ml-2 h-6 w-6 text-green-500" />
                  ) : analysis.overallRating >= 5 ? (
                    <Activity className="ml-2 h-6 w-6 text-yellow-500" />
                  ) : (
                    <AlertTriangle className="ml-2 h-6 w-6 text-red-500" />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{analysis.summary}</p>
              
              <div className="mt-4">
                <div className="flex items-center mb-2">
                  <span className="font-medium mr-2">Recommended Methodology:</span>
                  <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                    {analysis.suggestedMethodology}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{analysis.methodologyRationale}</p>
              </div>
              
              {analysis.criticalMissingElements && analysis.criticalMissingElements.length > 0 && (
                <Alert className="mt-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Missing Critical Elements</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {analysis.criticalMissingElements.map((element: string, i: number) => (
                        <li key={i}>{element}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          
          <Tabs defaultValue="all" className="mt-6">
            <TabsList>
              <TabsTrigger value="all">All Dimensions</TabsTrigger>
              <TabsTrigger value="critical">
                Critical Issues 
                <span className="ml-1.5 bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {analysis.dimensions.filter((d: AnalysisDimension) => d.score < 5).length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="strengths">Strengths</TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {analysis.dimensions.map((dimension: AnalysisDimension) => 
                  renderDimensionCard(dimension)
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="critical" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {analysis.dimensions
                  .filter((d: AnalysisDimension) => d.score < 5)
                  .map((dimension: AnalysisDimension) => renderDimensionCard(dimension))}
                
                {analysis.dimensions.filter((d: AnalysisDimension) => d.score < 5).length === 0 && (
                  <div className="col-span-2 p-6 text-center border border-dashed rounded-lg">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <h3 className="text-lg font-medium">No Critical Issues</h3>
                    <p className="text-gray-500">Your project doesn't have any critically low-scoring dimensions.</p>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="strengths" className="mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                {analysis.dimensions
                  .filter((d: AnalysisDimension) => d.score >= 7)
                  .map((dimension: AnalysisDimension) => renderDimensionCard(dimension))}
                
                {analysis.dimensions.filter((d: AnalysisDimension) => d.score >= 7).length === 0 && (
                  <div className="col-span-2 p-6 text-center border border-dashed rounded-lg">
                    <TrendingUp className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                    <h3 className="text-lg font-medium">Room for Improvement</h3>
                    <p className="text-gray-500">No strong areas identified yet. Follow the recommendations to improve your project.</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}