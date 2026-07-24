import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, Brain, Calculator, Info, Loader2, TrendingUp } from 'lucide-react';
import { Link } from 'wouter';

export default function JiraStoryEstimator() {
  const [storyTitle, setStoryTitle] = useState('');
  const [storyDescription, setStoryDescription] = useState('');
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [estimation, setEstimation] = useState<any>(null);
  const { toast } = useToast();

  // Estimate story mutation
  const estimateStory = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/stories/estimate', 'POST', data),
    onSuccess: (data) => {
      setEstimation(data);
      toast({
        title: 'Estimation Complete',
        description: `Estimated at ${data.storyPoints} story points with ${data.confidence} confidence.`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Estimation Failed',
        description: error.message || 'Failed to estimate story.',
        variant: 'destructive'
      });
    }
  });

  const handleEstimate = () => {
    if (!storyTitle.trim() || !storyDescription.trim()) {
      toast({
        title: 'Story Details Required',
        description: 'Please provide both title and description.',
        variant: 'destructive'
      });
      return;
    }

    const storyData = {
      title: storyTitle,
      story: storyDescription,
      acceptanceCriteria: acceptanceCriteria.split('\n').filter(c => c.trim()),
      context: additionalContext
    };

    estimateStory.mutate(storyData);
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
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

  const fibonacciScale = [1, 2, 3, 5, 8, 13, 21];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/jira-agent">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to JIRA Tools
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Story Point Estimator</h1>
            <p className="text-gray-600 mt-2">AI-powered story point estimation based on complexity analysis</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Story Details</CardTitle>
                <CardDescription>
                  Provide your user story details for AI-driven point estimation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Story Title*</Label>
                  <input
                    id="title"
                    type="text"
                    className="w-full px-3 py-2 border rounded-md"
                    placeholder="e.g., User authentication with social login"
                    value={storyTitle}
                    onChange={(e) => setStoryTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Story Description*</Label>
                  <Textarea
                    id="description"
                    placeholder="As a [user], I want [feature], so that [benefit]..."
                    value={storyDescription}
                    onChange={(e) => setStoryDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="criteria">Acceptance Criteria (one per line)</Label>
                  <Textarea
                    id="criteria"
                    placeholder="Given [context], when [action], then [result]..."
                    value={acceptanceCriteria}
                    onChange={(e) => setAcceptanceCriteria(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="context">Additional Context (Optional)</Label>
                  <Textarea
                    id="context"
                    placeholder="Technical constraints, dependencies, team context..."
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <Button
                  onClick={handleEstimate}
                  disabled={estimateStory.isPending || !storyTitle.trim() || !storyDescription.trim()}
                  className="w-full"
                >
                  {estimateStory.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Complexity...
                    </>
                  ) : (
                    <>
                      <Brain className="mr-2 h-4 w-4" />
                      Estimate Story Points
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Estimation Scale */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fibonacci Scale</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {fibonacciScale.map((points) => (
                    <div
                      key={points}
                      className={`px-4 py-2 rounded-lg border-2 font-medium ${
                        estimation?.storyPoints === points
                          ? 'bg-purple-100 border-purple-500 text-purple-700'
                          : 'bg-gray-50 border-gray-200 text-gray-600'
                      }`}
                    >
                      {points}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-3">
                  We use the Fibonacci sequence for story point estimation to reflect the inherent uncertainty in larger tasks.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Results Section */}
          <div className="space-y-6">
            {!estimation ? (
              <Card className="h-full">
                <CardContent className="py-16">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Calculator className="h-8 w-8 text-purple-600" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Estimation Yet</h3>
                    <p className="text-gray-500 max-w-sm mx-auto">
                      Enter your user story details and click "Estimate Story Points" to get an AI-powered estimation.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Main Estimation */}
                <Card className="border-purple-200 bg-purple-50/50">
                  <CardHeader>
                    <CardTitle>AI Estimation Result</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center mb-6">
                      <div className="text-5xl font-bold text-purple-700 mb-2">
                        {estimation.storyPoints}
                      </div>
                      <p className="text-lg text-gray-600">Story Points</p>
                      <Badge className={`mt-2 ${getConfidenceColor(estimation.confidence)}`}>
                        {estimation.confidence} confidence
                      </Badge>
                    </div>

                    {/* Complexity Breakdown */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1">Complexity</p>
                        <Badge variant="outline" className={getComplexityColor(estimation.complexity)}>
                          {estimation.complexity}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1">Risk</p>
                        <Badge variant="outline" className={getComplexityColor(estimation.risk)}>
                          {estimation.risk}
                        </Badge>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1">Effort</p>
                        <Badge variant="outline" className={getComplexityColor(estimation.effort)}>
                          {estimation.effort}
                        </Badge>
                      </div>
                    </div>

                    {/* Reasoning */}
                    {estimation.reasoning && (
                      <Alert className="bg-white border-purple-200">
                        <Brain className="h-4 w-4 text-purple-600" />
                        <AlertDescription>
                          <strong>AI Analysis:</strong> {estimation.reasoning}
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Key Factors */}
                {estimation.factors && estimation.factors.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Key Factors Considered</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {estimation.factors.map((factor: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <TrendingUp className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-700">{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Team Velocity Info */}
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Team Velocity:</strong> This estimation assumes an average team velocity. 
                    Adjust based on your team's historical performance and current capacity.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}