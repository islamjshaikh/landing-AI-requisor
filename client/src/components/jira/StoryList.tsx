import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  AlertCircle, 
  ArrowUpDown, 
  Calculator, 
  CheckCircle2, 
  Cloud, 
  Edit2, 
  Hash, 
  Loader2, 
  RefreshCw, 
  Trash2, 
  TrendingUp,
  Upload
} from 'lucide-react';
import { StoryEstimator } from './StoryEstimator';

interface StoryListProps {
  projectId: number;
}

export function StoryList({ projectId }: StoryListProps) {
  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [sortBy, setSortBy] = useState('roiScore');
  const [filterStatus, setFilterStatus] = useState('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch stories
  const { data: stories = [], isLoading } = useQuery({
    queryKey: [`/api/jira/stories/${projectId}`]
  });

  // Fetch JIRA integration
  const { data: integration } = useQuery({
    queryKey: ['/api/jira/integration']
  });

  // Delete story mutation
  const deleteStory = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/jira/stories/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: 'Story deleted',
        description: 'User story has been removed from the backlog.'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
    }
  });

  // Push to JIRA mutation
  const pushToJira = useMutation({
    mutationFn: (data: any) => apiRequest(`/api/jira/sync/push/${data.storyId}`, 'POST', { projectKey: data.projectKey }),
    onSuccess: (data) => {
      toast({
        title: 'Pushed to JIRA',
        description: `Story created in JIRA: ${data.jiraIssueKey}`
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Push failed',
        description: error.message || 'Failed to push story to JIRA.',
        variant: 'destructive'
      });
    }
  });

  // Pull from JIRA mutation
  const pullFromJira = useMutation({
    mutationFn: (projectKey: string) => apiRequest(`/api/jira/sync/pull/${projectId}`, 'POST', { projectKey }),
    onSuccess: () => {
      toast({
        title: 'Synced from JIRA',
        description: 'Stories have been synced from JIRA.'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync from JIRA.',
        variant: 'destructive'
      });
    }
  });

  // Filter and sort stories
  const filteredStories = stories
    .filter((story: any) => {
      if (filterStatus === 'all') return true;
      return story.status === filterStatus;
    })
    .sort((a: any, b: any) => {
      switch (sortBy) {
        case 'roiScore':
          return (b.roiScore || 0) - (a.roiScore || 0);
        case 'storyPoints':
          return (a.storyPoints || 0) - (b.storyPoints || 0);
        case 'priority':
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) - 
                 (priorityOrder[b.priority as keyof typeof priorityOrder] || 2);
        default:
          return 0;
      }
    });

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-100 text-green-700';
      case 'in-progress':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Backlog Management</CardTitle>
            {integration?.isActive && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const projectKey = prompt('Enter JIRA project key (e.g., PROJ):');
                  if (projectKey) pullFromJira.mutate(projectKey);
                }}
                disabled={pullFromJira.isPending}
              >
                {pullFromJira.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span className="ml-2">Sync from JIRA</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="sort-by" className="text-xs">Sort by</Label>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger id="sort-by" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roiScore">ROI Score</SelectItem>
                  <SelectItem value="storyPoints">Story Points</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="filter-status" className="text-xs">Filter by status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger id="filter-status" className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stories</SelectItem>
                  <SelectItem value="todo">To Do</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Story List */}
      {filteredStories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">
              {filterStatus === 'all' 
                ? 'No stories in the backlog. Create stories using the Story Writer or Backlog Generator.'
                : `No ${filterStatus} stories found.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredStories.map((story: any) => (
            <Card key={story.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-lg">{story.title}</h4>
                      {story.jiraIssueKey && (
                        <p className="text-sm text-blue-600 flex items-center gap-1 mt-1">
                          <Cloud className="w-3 h-3" />
                          {story.jiraIssueKey}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {story.storyPoints && (
                        <Badge className="bg-purple-100 text-purple-700">
                          <Hash className="w-3 h-3 mr-1" />
                          {story.storyPoints} pts
                        </Badge>
                      )}
                      <Badge className={getPriorityColor(story.priority)}>
                        {story.priority}
                      </Badge>
                      <Badge className={getStatusColor(story.status)}>
                        {story.status}
                      </Badge>
                      {story.roiScore && (
                        <Badge variant="outline" className="border-purple-300 text-purple-700">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          ROI: {story.roiScore}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-700">{story.story}</p>

                  {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                    <div className="mt-2">
                      <p className="text-sm font-medium mb-1">Acceptance Criteria:</p>
                      <ul className="space-y-1">
                        {story.acceptanceCriteria.slice(0, 3).map((criteria: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-600">{criteria}</span>
                          </li>
                        ))}
                        {story.acceptanceCriteria.length > 3 && (
                          <li className="text-sm text-gray-500 ml-5">
                            +{story.acceptanceCriteria.length - 3} more criteria
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    {!story.storyPoints && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedStory(story)}
                      >
                        <Calculator className="w-3 h-3 mr-1" />
                        Estimate
                      </Button>
                    )}
                    {integration?.isActive && !story.jiraIssueKey && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const projectKey = prompt('Enter JIRA project key (e.g., PROJ):');
                          if (projectKey) {
                            pushToJira.mutate({ storyId: story.id, projectKey });
                          }
                        }}
                        disabled={pushToJira.isPending}
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        Push to JIRA
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteStory.mutate(story.id)}
                      disabled={deleteStory.isPending}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Story Estimator Modal */}
      {selectedStory && (
        <StoryEstimator
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
        />
      )}
    </div>
  );
}