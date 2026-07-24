import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { AlertCircle, CheckCircle2, Code2, Hash, Loader2, Sparkles, TrendingUp } from 'lucide-react';

interface BacklogGeneratorProps {
  projectId: number;
}

export function BacklogGenerator({ projectId }: BacklogGeneratorProps) {
  const [feature, setFeature] = useState('');
  const [context, setContext] = useState('');
  const [generatedStories, setGeneratedStories] = useState<any[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate backlog mutation
  const generateBacklog = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/backlog/generate', 'POST', data),
    onSuccess: (data) => {
      setGeneratedStories(data.stories || []);
      toast({
        title: 'Backlog generated',
        description: `Created ${data.stories?.length || 0} user stories for your feature.`
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate backlog.',
        variant: 'destructive'
      });
    }
  });

  const handleGenerate = () => {
    if (!feature.trim()) {
      toast({
        title: 'Feature required',
        description: 'Please enter a feature or module description.',
        variant: 'destructive'
      });
      return;
    }
    generateBacklog.mutate({ feature, projectId, context });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getPointsColor = (points: number) => {
    if (points <= 3) return 'bg-green-100 text-green-700';
    if (points <= 8) return 'bg-yellow-100 text-yellow-700';
    return 'bg-orange-100 text-orange-700';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Backlog Generator</CardTitle>
          <CardDescription>
            Describe a feature or module and AI will generate a complete backlog with prioritized stories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="feature">Feature/Module Description</Label>
            <Input
              id="feature"
              placeholder="e.g., E-commerce checkout process with payment integration"
              value={feature}
              onChange={(e) => setFeature(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="context">Additional Context (Optional)</Label>
            <Textarea
              id="context"
              placeholder="Provide any specific requirements, constraints, or technical considerations..."
              rows={4}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateBacklog.isPending || !feature.trim()}
            className="w-full"
          >
            {generateBacklog.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Backlog...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Complete Backlog
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedStories.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Backlog</CardTitle>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                {generatedStories.length} Stories
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {generatedStories.map((story, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <h4 className="font-semibold text-lg flex-1">{story.title}</h4>
                        <div className="flex items-center gap-2">
                          <Badge className={getPointsColor(story.storyPoints || 0)}>
                            <Hash className="w-3 h-3 mr-1" />
                            {story.storyPoints} pts
                          </Badge>
                          <Badge className={getPriorityColor(story.priority)}>
                            {story.priority}
                          </Badge>
                          {story.roiScore && (
                            <Badge variant="outline" className="border-purple-300 text-purple-700">
                              <TrendingUp className="w-3 h-3 mr-1" />
                              ROI: {story.roiScore}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <p className="text-gray-700 bg-gray-50 p-3 rounded text-sm">
                        {story.story}
                      </p>

                      <div>
                        <p className="text-sm font-medium mb-2">Acceptance Criteria:</p>
                        <ul className="space-y-1">
                          {story.acceptanceCriteria?.map((criteria: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-gray-600">{criteria}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {story.dependencies && story.dependencies.length > 0 && (
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          <p className="text-sm text-amber-700">
                            Dependencies: {story.dependencies.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle2 className="w-5 h-5" />
                <p className="font-medium">
                  All stories have been saved to your project backlog
                </p>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Stories are prioritized by ROI score and can be synced to JIRA
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}