import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CheckCircle2, Loader2, PenTool, Save, Sparkles } from 'lucide-react';

interface StoryWriterProps {
  projectId: number;
}

export function StoryWriter({ projectId }: StoryWriterProps) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [generatedStory, setGeneratedStory] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Generate story mutation
  const generateStory = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/stories/write', 'POST', data),
    onSuccess: (data) => {
      setGeneratedStory(data);
      toast({
        title: 'Story generated',
        description: 'AI has created a user story based on your input.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation failed',
        description: error.message || 'Failed to generate story.',
        variant: 'destructive'
      });
    }
  });

  // Save story mutation
  const saveStory = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/stories', 'POST', data),
    onSuccess: () => {
      toast({
        title: 'Story saved',
        description: 'User story has been added to your backlog.'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
      // Reset form
      setTitle('');
      setContext('');
      setGeneratedStory(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Save failed',
        description: error.message || 'Failed to save story.',
        variant: 'destructive'
      });
    }
  });

  const handleGenerate = () => {
    if (!title.trim()) {
      toast({
        title: 'Title required',
        description: 'Please enter a story title.',
        variant: 'destructive'
      });
      return;
    }
    generateStory.mutate({ title, projectId, context });
  };

  const handleSave = () => {
    if (generatedStory) {
      saveStory.mutate({
        projectId,
        ...generatedStory,
        acceptanceCriteria: generatedStory.acceptanceCriteria || []
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>AI Story Writer</CardTitle>
          <CardDescription>
            Enter a feature title and let AI write a complete user story with acceptance criteria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="story-title">Story Title</Label>
            <Input
              id="story-title"
              placeholder="e.g., User authentication with social login"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="story-context">Additional Context (Optional)</Label>
            <Textarea
              id="story-context"
              placeholder="Provide any additional context, requirements, or constraints..."
              rows={4}
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateStory.isPending || !title.trim()}
            className="w-full"
          >
            {generateStory.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating Story...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate User Story
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {generatedStory && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Story</CardTitle>
              <Badge variant="secondary" className="bg-purple-100 text-purple-700">
                AI Generated
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Title</h4>
              <p className="text-gray-700">{generatedStory.title}</p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">User Story</h4>
              <p className="text-gray-700 bg-gray-50 p-3 rounded">
                {generatedStory.story}
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Acceptance Criteria</h4>
              <ul className="space-y-2">
                {generatedStory.acceptanceCriteria?.map((criteria: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{criteria}</span>
                  </li>
                ))}
              </ul>
            </div>

            <Alert className="bg-blue-50 border-blue-200">
              <AlertDescription>
                Review the generated story and acceptance criteria. You can edit them after saving.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleSave}
              disabled={saveStory.isPending}
              className="w-full"
            >
              {saveStory.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving Story...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save to Backlog
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}