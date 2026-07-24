import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { AlertCircle, Brain, Calculator, CheckCircle2, Loader2 } from 'lucide-react';

interface StoryEstimatorProps {
  story: any;
  onClose: () => void;
}

export function StoryEstimator({ story, onClose }: StoryEstimatorProps) {
  const [additionalContext, setAdditionalContext] = useState('');
  const [estimation, setEstimation] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Estimate story mutation
  const estimateStory = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/jira/stories/${story.id}/estimate`, 'POST', data),
    onSuccess: (data) => {
      setEstimation(data);
      toast({
        title: 'Story estimated',
        description: `Estimated at ${data.storyPoints} story points.`
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${story.projectId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Estimation failed',
        description: error.message || 'Failed to estimate story.',
        variant: 'destructive'
      });
    }
  });

  const handleEstimate = () => {
    estimateStory.mutate({ context: additionalContext });
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getComplexityColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'bg-green-100 text-green-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI Story Point Estimation</DialogTitle>
          <DialogDescription>
            AI will analyze the story and provide a data-driven point estimate
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Story Details */}
          <Card>
            <CardContent className="pt-6">
              <h4 className="font-semibold mb-2">{story.title}</h4>
              <p className="text-gray-700 text-sm mb-3">{story.story}</p>
              
              {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm font-medium mb-1">Acceptance Criteria:</p>
                  <ul className="space-y-1">
                    {story.acceptanceCriteria.map((criteria: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-600">{criteria}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Context */}
          <div className="space-y-2">
            <Label htmlFor="context">Additional Context (Optional)</Label>
            <Textarea
              id="context"
              placeholder="Provide any technical constraints, dependencies, or team context..."
              rows={3}
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
            />
          </div>

          {/* Estimation Results */}
          {estimation && (
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">AI Estimation</h4>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700">
                        <Calculator className="w-3 h-3 mr-1" />
                        {estimation.storyPoints} Story Points
                      </Badge>
                      <Badge className={getConfidenceColor(estimation.confidence)}>
                        {estimation.confidence} confidence
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Complexity</p>
                      <Badge variant="outline" className={getComplexityColor(estimation.complexity)}>
                        {estimation.complexity}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Risk</p>
                      <Badge variant="outline" className={getComplexityColor(estimation.risk)}>
                        {estimation.risk}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Effort</p>
                      <Badge variant="outline" className={getComplexityColor(estimation.effort)}>
                        {estimation.effort}
                      </Badge>
                    </div>
                  </div>

                  {estimation.reasoning && (
                    <div>
                      <p className="text-sm font-medium mb-1">Reasoning:</p>
                      <p className="text-sm text-gray-700">{estimation.reasoning}</p>
                    </div>
                  )}

                  {estimation.factors && estimation.factors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Key Factors:</p>
                      <ul className="space-y-1">
                        {estimation.factors.map((factor: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="w-3 h-3 text-blue-600 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-600">{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={handleEstimate}
              disabled={estimateStory.isPending || estimation}
            >
              {estimateStory.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Estimating...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Estimate Story Points
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}