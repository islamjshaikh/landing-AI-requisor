import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Search, Zap, ArrowRight, Save, Trash2, Bot, Workflow } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface WorkflowNode {
  id: string;
  name: string;
  description: string;
  role: string;
  category: string;
  website?: string;
  pricing?: string;
}

interface WorkflowEdge {
  from: string;
  to: string;
  description: string;
}

interface GeneratedWorkflow {
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  explanation: string;
}

export default function WorkflowBuilder() {
  const [query, setQuery] = useState('');
  const [currentWorkflow, setCurrentWorkflow] = useState<GeneratedWorkflow | null>(null);
  const { toast } = useToast();

  const generateWorkflowMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest('/api/workflows/generate', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (workflow) => {
      setCurrentWorkflow(workflow);
      toast({
        title: "Workflow Generated",
        description: `Created "${workflow.name}" with ${workflow.nodes.length} tools`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate workflow",
        variant: "destructive"
      });
    }
  });

  const handleGenerateWorkflow = () => {
    if (!query.trim()) {
      toast({
        title: "Query Required",
        description: "Please describe what you want to accomplish",
        variant: "destructive"
      });
      return;
    }
    generateWorkflowMutation.mutate(query.trim());
  };

  const handleClearWorkflow = () => {
    setCurrentWorkflow(null);
    setQuery('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !generateWorkflowMutation.isPending) {
      handleGenerateWorkflow();
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl min-h-full">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
            <Workflow className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">AI Workflow Builder</h1>
            <p className="text-gray-600">Create intelligent workflows with complementary AI tools</p>
          </div>
        </div>

        {/* Search Interface */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-blue-600" />
              Describe Your Goal
            </CardTitle>
            <CardDescription>
              Tell us what you want to accomplish and we'll create a complete workflow of AI tools
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., 'Create animations for my YouTube channel' or 'Build a mobile app with AI features'"
                  className="pl-10 text-base"
                  disabled={generateWorkflowMutation.isPending}
                />
              </div>
              <Button
                onClick={handleGenerateWorkflow}
                disabled={generateWorkflowMutation.isPending || !query.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {generateWorkflowMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Generate Workflow
                  </>
                )}
              </Button>
            </div>

            {/* Example Prompts */}
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Try these examples:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  "Create content for social media marketing",
                  "Build a data analysis pipeline",
                  "Design and prototype a mobile app",
                  "Automate customer support workflows"
                ].map((example) => (
                  <Button
                    key={example}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setQuery(example)}
                    disabled={generateWorkflowMutation.isPending}
                  >
                    {example}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generated Workflow Display */}
      {currentWorkflow && (
        <div className="space-y-6">
          {/* Workflow Header */}
          <Card className="border-green-200 bg-green-50">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-xl text-green-800">
                    {currentWorkflow.name}
                  </CardTitle>
                  <CardDescription className="text-green-700 mt-2">
                    {currentWorkflow.description}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Workflow
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleClearWorkflow}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Workflow Steps */}
          <div className="grid gap-4">
            <h3 className="text-lg font-semibold">Workflow Steps</h3>
            
            <div className="relative">
              {/* Workflow nodes with connecting lines */}
              <div className="space-y-6">
                {currentWorkflow.nodes.map((node, index) => (
                  <div key={node.id} className="relative">
                    {/* Connecting arrow */}
                    {index < currentWorkflow.nodes.length - 1 && (
                      <div className="absolute left-8 -bottom-3 z-10">
                        <ArrowRight className="h-6 w-6 text-blue-500 bg-white rounded-full p-1 border-2 border-blue-200" />
                      </div>
                    )}
                    
                    {/* Tool card */}
                    <Card className="border-blue-200 hover:border-blue-300 transition-colors">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3 mb-2">
                              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                                Step {index + 1}
                              </Badge>
                              <Badge variant="outline" className="text-purple-700 border-purple-300">
                                {node.role}
                              </Badge>
                            </div>
                            <CardTitle className="text-lg">{node.name}</CardTitle>
                            <CardDescription className="text-sm mt-1">
                              {node.description}
                            </CardDescription>
                          </div>
                          <Badge className="bg-gray-100 text-gray-700">
                            {node.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      
                      {/* Show connection description */}
                      {index < currentWorkflow.edges.length && (
                        <CardContent className="pt-0">
                          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md border-l-4 border-blue-400">
                            <strong>Flow:</strong> {currentWorkflow.edges[index]?.description}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow Explanation */}
          {currentWorkflow.explanation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-blue-600" />
                  Why This Workflow?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 leading-relaxed">
                  {currentWorkflow.explanation}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {!currentWorkflow && !generateWorkflowMutation.isPending && (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="h-16 w-16 text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              Ready to Build Your Workflow
            </h3>
            <p className="text-gray-500 text-center max-w-md">
              Describe what you want to accomplish and we'll create an intelligent workflow 
              of AI tools that work together to achieve your goal.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}