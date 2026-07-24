import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  ArrowLeft, 
  CheckCircle2, 
  CloudUpload, 
  Copy, 
  Edit2, 
  ExternalLink, 
  FileText, 
  Hash, 
  Layers, 
  Lightbulb, 
  Loader2, 
  PenTool, 
  Plus, 
  Settings, 
  Sparkles, 
  Target, 
  Trash2, 
  Upload 
} from 'lucide-react';
import { Link } from 'wouter';

interface UserStory {
  id: number;
  title: string;
  story: string;
  acceptanceCriteria: string[];
  storyPoints?: number;
  priority: string;
  status: string;
  jiraIssueKey?: string;
  complexity?: string;
  risk?: string;
  effort?: string;
  roiScore?: number;
  createdAt: string;
}

interface JiraIntegration {
  id: number;
  jiraUrl: string;
  email: string;
  apiToken: string;
  isActive: boolean;
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
  projectTypeKey: string;
}

export default function JiraAgentNew() {
  const [activeTab, setActiveTab] = useState('story-writer');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch projects
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects']
  });

  // Fetch JIRA integration
  const { data: jiraIntegration, isLoading: isLoadingIntegration } = useQuery({
    queryKey: ['/api/jira/integration']
  });

  // Fetch user stories for selected project
  const { data: userStories = [], isLoading: isLoadingStories } = useQuery({
    queryKey: [`/api/jira/stories/${selectedProject}`],
    enabled: !!selectedProject && selectedProject !== '' && !isNaN(parseInt(selectedProject))
  });

  // Fetch JIRA projects
  const { data: jiraProjects = [] } = useQuery({
    queryKey: ['/api/jira/projects'],
    enabled: !!jiraIntegration?.isActive
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/ai-agents">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to AI Agents
              </Button>
            </Link>
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  <Sparkles className="h-4 w-4 mr-1 inline" />
                  AI-Powered
                </div>
                <Badge variant="secondary">Active</Badge>
              </div>
              <h1 className="text-3xl font-bold text-gray-900">JIRA Agile Agent</h1>
              <p className="text-gray-600">
                Transform ideas into stories, estimate effort, and sync with JIRA
              </p>
            </div>
          </div>
          
          {/* Project Selector */}
          <div className="flex items-center space-x-4">
            <div className="min-w-[200px]">
              <Label htmlFor="project-select">Select Project *</Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger id="project-select" className={!selectedProject ? "border-orange-300" : ""}>
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.length > 0 ? (
                    projects.map((project: any) => (
                      <SelectItem key={project.id} value={project.id.toString()}>
                        {project.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-projects" disabled>
                      No projects available. Create a project first.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!selectedProject && (
                <p className="text-sm text-orange-600 mt-1">
                  Project selection required
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Integration Status */}
        {!jiraIntegration?.isActive && (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <Settings className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>JIRA integration is not configured. Set up your connection to enable sync features.</span>
                <Button variant="outline" size="sm" onClick={() => setActiveTab('integration')}>
                  Configure JIRA
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="story-writer">
              <PenTool className="h-4 w-4 mr-2" />
              Story Writer
            </TabsTrigger>
            <TabsTrigger value="backlog">
              <Layers className="h-4 w-4 mr-2" />
              Backlog Generator
            </TabsTrigger>
            <TabsTrigger value="stories">
              <FileText className="h-4 w-4 mr-2" />
              Stories ({userStories.length})
            </TabsTrigger>
            <TabsTrigger value="integration">
              <Settings className="h-4 w-4 mr-2" />
              JIRA Integration
            </TabsTrigger>
          </TabsList>

          {/* Story Writer Tab */}
          <TabsContent value="story-writer" className="space-y-6">
            <StoryWriter 
              projectId={selectedProject && !isNaN(parseInt(selectedProject)) ? parseInt(selectedProject) : null}
              jiraIntegration={jiraIntegration}
              jiraProjects={jiraProjects}
            />
          </TabsContent>

          {/* Backlog Generator Tab */}
          <TabsContent value="backlog" className="space-y-6">
            <BacklogGenerator 
              projectId={selectedProject && !isNaN(parseInt(selectedProject)) ? parseInt(selectedProject) : null}
              jiraIntegration={jiraIntegration}
              jiraProjects={jiraProjects}
            />
          </TabsContent>

          {/* Stories Management Tab */}
          <TabsContent value="stories" className="space-y-6">
            <StoriesManager 
              projectId={selectedProject && !isNaN(parseInt(selectedProject)) ? parseInt(selectedProject) : null}
              userStories={userStories}
              jiraIntegration={jiraIntegration}
              jiraProjects={jiraProjects}
              isLoading={isLoadingStories}
            />
          </TabsContent>

          {/* JIRA Integration Tab */}
          <TabsContent value="integration" className="space-y-6">
            <JiraIntegrationManager 
              integration={jiraIntegration}
              isLoading={isLoadingIntegration}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Story Writer Component
function StoryWriter({ projectId, jiraIntegration, jiraProjects }: {
  projectId: number | null;
  jiraIntegration: JiraIntegration | null;
  jiraProjects: JiraProject[];
}) {
  const [featureIdea, setFeatureIdea] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [businessValue, setBusinessValue] = useState('');
  const [generatedStory, setGeneratedStory] = useState<any>(null);
  const [showJiraDialog, setShowJiraDialog] = useState(false);
  const [selectedJiraProject, setSelectedJiraProject] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateStory = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/stories/write', 'POST', data),
    onSuccess: (data) => {
      setGeneratedStory(data);
      toast({
        title: 'Story Generated Successfully',
        description: 'AI has created a well-structured user story for you.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate story. Please try again.',
        variant: 'destructive'
      });
    }
  });

  const saveStory = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/stories', 'POST', data),
    onSuccess: () => {
      toast({
        title: 'Story Saved',
        description: 'User story has been added to your project backlog.'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
      // Reset form
      setFeatureIdea('');
      setTargetUser('');
      setBusinessValue('');
      setGeneratedStory(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save story.',
        variant: 'destructive'
      });
    }
  });

  const handleGenerate = () => {
    if (!featureIdea.trim()) {
      toast({
        title: 'Feature Idea Required',
        description: 'Please enter a feature idea to generate a story.',
        variant: 'destructive'
      });
      return;
    }

    if (!projectId) {
      toast({
        title: 'Project Required',
        description: 'Please select a project first.',
        variant: 'destructive'
      });
      return;
    }

    generateStory.mutate({
      title: featureIdea,
      projectId,
      context: `Target User: ${targetUser}, Business Value: ${businessValue}`.trim()
    });
  };

  const handleSave = () => {
    if (!generatedStory || !projectId) return;

    saveStory.mutate({
      projectId,
      title: generatedStory.title,
      story: generatedStory.story,
      acceptanceCriteria: generatedStory.acceptanceCriteria || [],
      priority: 'medium',
      status: 'todo'
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <PenTool className="h-5 w-5 mr-2" />
            Create User Story
          </CardTitle>
          <CardDescription>
            Describe your feature idea and let AI generate a well-structured user story
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="feature-idea">Feature Idea *</Label>
            <Input
              id="feature-idea"
              value={featureIdea}
              onChange={(e) => setFeatureIdea(e.target.value)}
              placeholder="e.g., email integration, user notifications, file upload..."
            />
          </div>

          <div>
            <Label htmlFor="target-user">Target User/Role (Optional)</Label>
            <Input
              id="target-user"
              value={targetUser}
              onChange={(e) => setTargetUser(e.target.value)}
              placeholder="e.g., Administrator, Customer, Marketing Team..."
            />
          </div>

          <div>
            <Label htmlFor="business-value">Business Value (Optional)</Label>
            <Textarea
              id="business-value"
              value={businessValue}
              onChange={(e) => setBusinessValue(e.target.value)}
              placeholder="Explain the value this feature provides..."
              rows={3}
            />
          </div>

          <Button 
            onClick={handleGenerate}
            disabled={generateStory.isPending || !featureIdea.trim() || !projectId}
            className="w-full"
          >
            {generateStory.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Story...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate User Story
              </>
            )}
          </Button>
          
          {/* Helper text when button is disabled */}
          {(!featureIdea.trim() || !projectId) && (
            <div className="text-sm text-gray-500 mt-2">
              {!projectId && <p>• Please select a project first</p>}
              {!featureIdea.trim() && <p>• Please enter a feature idea</p>}
            </div>
          )}

          {/* Writing Tips */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center">
              <Lightbulb className="h-4 w-4 mr-2" />
              Writing Tips
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Be specific about the feature or functionality</li>
              <li>• Include the target user type if relevant</li>
              <li>• Mention the business value or user benefit</li>
              <li>• Keep it concise but descriptive</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Generated Story */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Generated User Story
          </CardTitle>
          <CardDescription>
            AI-generated story following agile best practices
          </CardDescription>
        </CardHeader>
        <CardContent>
          {generatedStory ? (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Story Title</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="font-medium">{generatedStory.title}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">User Story</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <p className="text-gray-800">{generatedStory.story}</p>
                </div>
              </div>

              <div>
                <Label className="text-sm font-medium text-gray-700">Acceptance Criteria</Label>
                <div className="mt-1 p-3 bg-gray-50 rounded-md">
                  <ul className="space-y-1">
                    {generatedStory.acceptanceCriteria?.map((criteria: string, index: number) => (
                      <li key={index} className="flex items-start">
                        <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-800">{criteria}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button 
                  onClick={handleSave}
                  disabled={saveStory.isPending}
                  className="flex-1"
                >
                  {saveStory.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Save to Backlog
                    </>
                  )}
                </Button>
                
                {jiraIntegration?.isActive && (
                  <Button 
                    variant="outline"
                    onClick={() => setShowJiraDialog(true)}
                    disabled={saveStory.isPending}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Push to JIRA
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No story generated yet</p>
              <p className="text-sm text-gray-400">
                Fill out the form and click "Generate User Story" to get started
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* JIRA Push Dialog */}
      <Dialog open={showJiraDialog} onOpenChange={setShowJiraDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Push to JIRA</DialogTitle>
            <DialogDescription>
              Select which JIRA project to push this story to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="jira-project">JIRA Project</Label>
              <Select value={selectedJiraProject} onValueChange={setSelectedJiraProject}>
                <SelectTrigger>
                  <SelectValue placeholder="Select JIRA project..." />
                </SelectTrigger>
                <SelectContent>
                  {jiraProjects.map((project) => (
                    <SelectItem key={project.key} value={project.key}>
                      {project.name} ({project.key})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJiraDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              // TODO: Implement JIRA push
              toast({ title: 'JIRA Push', description: 'Coming soon!' });
              setShowJiraDialog(false);
            }}>
              Push to JIRA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Backlog Generator Component
function BacklogGenerator({ projectId, jiraIntegration, jiraProjects }: {
  projectId: number | null;
  jiraIntegration: JiraIntegration | null;
  jiraProjects: JiraProject[];
}) {
  const [featureDescription, setFeatureDescription] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [generatedBacklog, setGeneratedBacklog] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateBacklog = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/backlog/generate', 'POST', data),
    onSuccess: (data) => {
      setGeneratedBacklog(data);
      toast({
        title: 'Backlog Generated',
        description: `Created ${data.stories?.length || 0} user stories for your feature.`
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate backlog.',
        variant: 'destructive'
      });
    }
  });

  const saveBacklog = useMutation({
    mutationFn: (stories: any[]) => {
      return Promise.all(stories.map(story => 
        apiRequest('/api/jira/stories', 'POST', {
          projectId,
          title: story.title,
          story: story.story,
          acceptanceCriteria: story.acceptanceCriteria || [],
          priority: story.priority || 'medium',
          status: 'todo'
        })
      ));
    },
    onSuccess: () => {
      toast({
        title: 'Backlog Saved',
        description: 'All stories have been added to your project backlog.'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
      // Reset form
      setFeatureDescription('');
      setAdditionalContext('');
      setGeneratedBacklog(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save backlog.',
        variant: 'destructive'
      });
    }
  });

  const handleGenerate = () => {
    if (!featureDescription.trim()) {
      toast({
        title: 'Feature Description Required',
        description: 'Please describe the feature you want to build.',
        variant: 'destructive'
      });
      return;
    }

    if (!projectId) {
      toast({
        title: 'Project Required',
        description: 'Please select a project first.',
        variant: 'destructive'
      });
      return;
    }

    generateBacklog.mutate({
      feature: featureDescription,
      projectId,
      context: additionalContext
    });
  };

  const handleSaveAll = () => {
    if (!generatedBacklog?.stories || !projectId) return;
    saveBacklog.mutate(generatedBacklog.stories);
  };

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Layers className="h-5 w-5 mr-2" />
            Generate Product Backlog
          </CardTitle>
          <CardDescription>
            Describe a feature or module and get a complete set of prioritized user stories
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="feature-description">Feature Description *</Label>
            <Textarea
              id="feature-description"
              value={featureDescription}
              onChange={(e) => setFeatureDescription(e.target.value)}
              placeholder="e.g., User authentication system, E-commerce checkout flow, Project management dashboard..."
              rows={4}
            />
          </div>

          <div>
            <Label htmlFor="additional-context">Additional Context (Optional)</Label>
            <Textarea
              id="additional-context"
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              placeholder="Include any technical requirements, constraints, or specific user needs..."
              rows={3}
            />
          </div>

          <Button 
            onClick={handleGenerate}
            disabled={generateBacklog.isPending || !featureDescription.trim() || !projectId}
            className="w-full"
          >
            {generateBacklog.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Backlog...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Backlog
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Backlog */}
      {generatedBacklog && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Generated Backlog ({generatedBacklog.stories?.length || 0} stories)
                </CardTitle>
                <CardDescription>
                  Prioritized user stories ready for development
                </CardDescription>
              </div>
              <div className="flex space-x-2">
                <Button 
                  onClick={handleSaveAll}
                  disabled={saveBacklog.isPending}
                >
                  {saveBacklog.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Save All Stories
                    </>
                  )}
                </Button>
                
                {jiraIntegration?.isActive && (
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    Bulk Push to JIRA
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {generatedBacklog.stories?.map((story: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-lg">{story.title}</h4>
                    <div className="flex items-center space-x-2">
                      <Badge variant={story.priority === 'high' ? 'destructive' : 
                                    story.priority === 'medium' ? 'default' : 'secondary'}>
                        {story.priority}
                      </Badge>
                      {story.storyPoints && (
                        <Badge variant="outline">
                          {story.storyPoints} pts
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-gray-700 mb-3">{story.story}</p>
                  
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Acceptance Criteria
                    </Label>
                    <ul className="space-y-1">
                      {story.acceptanceCriteria?.map((criteria: string, critIndex: number) => (
                        <li key={critIndex} className="flex items-start text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-600">{criteria}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {story.dependencies && story.dependencies.length > 0 && (
                    <div className="mt-3">
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                        Dependencies
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {story.dependencies.map((dep: string, depIndex: number) => (
                          <Badge key={depIndex} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Stories Manager Component
function StoriesManager({ projectId, userStories, jiraIntegration, jiraProjects, isLoading }: {
  projectId: number | null;
  userStories: UserStory[];
  jiraIntegration: JiraIntegration | null;
  jiraProjects: JiraProject[];
  isLoading: boolean;
}) {
  const [selectedStories, setSelectedStories] = useState<number[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const deleteStory = useMutation({
    mutationFn: (storyId: number) => apiRequest(`/api/jira/stories/${storyId}`, 'DELETE'),
    onSuccess: () => {
      toast({
        title: 'Story Deleted',
        description: 'The user story has been removed from your backlog.'
      });
      queryClient.invalidateQueries({ queryKey: [`/api/jira/stories/${projectId}`] });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete story.',
        variant: 'destructive'
      });
    }
  });

  const handleDelete = (storyId: number) => {
    if (confirm('Are you sure you want to delete this story?')) {
      deleteStory.mutate(storyId);
    }
  };

  const toggleStorySelection = (storyId: number) => {
    setSelectedStories(prev => 
      prev.includes(storyId) 
        ? prev.filter(id => id !== storyId)
        : [...prev, storyId]
    );
  };

  const selectAllStories = () => {
    setSelectedStories(userStories.map(story => story.id));
  };

  const clearSelection = () => {
    setSelectedStories([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!projectId) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Please select a project to view stories</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Actions Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAllStories}
                  disabled={userStories.length === 0}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedStories.length === 0}
                >
                  Clear Selection
                </Button>
              </div>
              
              {selectedStories.length > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">
                    {selectedStories.length} selected
                  </span>
                  {jiraIntegration?.isActive && (
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Push to JIRA
                    </Button>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Badge variant="secondary">
                {userStories.length} Total Stories
              </Badge>
              <Badge variant="outline">
                {userStories.filter(s => s.jiraIssueKey).length} Synced
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stories List */}
      <div className="space-y-4">
        {userStories.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-2">No stories in this project yet</p>
              <p className="text-sm text-gray-400">
                Use the Story Writer or Backlog Generator to create your first stories
              </p>
            </CardContent>
          </Card>
        ) : (
          userStories.map((story) => (
            <Card key={story.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      checked={selectedStories.includes(story.id)}
                      onChange={() => toggleStorySelection(story.id)}
                      className="mt-1"
                    />
                    <div className="flex-1">
                      <h3 className="font-medium text-lg mb-1">{story.title}</h3>
                      <p className="text-gray-600 mb-3">{story.story}</p>
                      
                      {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
                        <div className="mb-3">
                          <Label className="text-sm font-medium text-gray-700 mb-2 block">
                            Acceptance Criteria
                          </Label>
                          <ul className="space-y-1">
                            {story.acceptanceCriteria.map((criteria, index) => (
                              <li key={index} className="flex items-start text-sm">
                                <CheckCircle2 className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-600">{criteria}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={story.priority === 'high' ? 'destructive' : 
                                  story.priority === 'medium' ? 'default' : 'secondary'}>
                      {story.priority}
                    </Badge>
                    {story.storyPoints && (
                      <Badge variant="outline">
                        {story.storyPoints} pts
                      </Badge>
                    )}
                    {story.jiraIssueKey && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {story.jiraIssueKey}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Status: {story.status}</span>
                    <span>Created: {new Date(story.createdAt).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm">
                      <Hash className="h-4 w-4 mr-2" />
                      Estimate
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDelete(story.id)}
                      disabled={deleteStory.isPending}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// JIRA Integration Manager Component
function JiraIntegrationManager({ integration, isLoading }: {
  integration: JiraIntegration | null;
  isLoading: boolean;
}) {
  const [jiraUrl, setJiraUrl] = useState('');
  const [email, setEmail] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (integration) {
      setJiraUrl(integration.jiraUrl);
      setEmail(integration.email);
      setApiToken(integration.apiToken);
    }
  }, [integration]);

  const saveIntegration = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/integration', 'POST', data),
    onSuccess: () => {
      toast({
        title: 'Integration Saved',
        description: 'JIRA integration has been configured successfully.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/jira/integration'] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Configuration Failed',
        description: error.message || 'Failed to save JIRA integration.',
        variant: 'destructive'
      });
    }
  });

  const handleSave = () => {
    if (!jiraUrl.trim() || !email.trim() || !apiToken.trim()) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields.',
        variant: 'destructive'
      });
      return;
    }

    saveIntegration.mutate({
      jiraUrl: jiraUrl.trim(),
      email: email.trim(),
      apiToken: apiToken.trim()
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            JIRA Integration Setup
          </CardTitle>
          <CardDescription>
            Configure your JIRA connection to enable two-way sync
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="jira-url">JIRA URL *</Label>
            <Input
              id="jira-url"
              value={jiraUrl}
              onChange={(e) => setJiraUrl(e.target.value)}
              placeholder="https://your-domain.atlassian.net"
              disabled={!isEditing && integration?.isActive}
            />
          </div>

          <div>
            <Label htmlFor="jira-email">Email *</Label>
            <Input
              id="jira-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@company.com"
              disabled={!isEditing && integration?.isActive}
            />
          </div>

          <div>
            <Label htmlFor="api-token">API Token *</Label>
            <Input
              id="api-token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Your JIRA API token"
              disabled={!isEditing && integration?.isActive}
            />
            <p className="text-sm text-gray-500 mt-1">
              Generate at: JIRA → Profile → Personal Access Tokens
            </p>
          </div>

          <div className="flex space-x-2">
            {integration?.isActive && !isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Configuration
                </Button>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Connected</span>
                </div>
              </>
            ) : (
              <>
                <Button
                  onClick={handleSave}
                  disabled={saveIntegration.isPending}
                >
                  {saveIntegration.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Testing Connection...
                    </>
                  ) : (
                    <>
                      <CloudUpload className="h-4 w-4 mr-2" />
                      Save & Test Connection
                    </>
                  )}
                </Button>
                {isEditing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsEditing(false);
                      if (integration) {
                        setJiraUrl(integration.jiraUrl);
                        setEmail(integration.email);
                        setApiToken(integration.apiToken);
                      }
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Setup Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lightbulb className="h-5 w-5 mr-2" />
            Setup Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm">
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center mr-3 text-xs font-medium">1</span>
              <div>
                <strong>Go to your JIRA instance</strong> (e.g., https://your-company.atlassian.net)
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center mr-3 text-xs font-medium">2</span>
              <div>
                <strong>Navigate to your profile</strong> → Account Settings → Security → API tokens
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center mr-3 text-xs font-medium">3</span>
              <div>
                <strong>Create a new API token</strong> with appropriate permissions
              </div>
            </li>
            <li className="flex items-start">
              <span className="bg-blue-100 text-blue-800 rounded-full w-6 h-6 flex items-center justify-center mr-3 text-xs font-medium">4</span>
              <div>
                <strong>Copy the token</strong> and paste it in the API Token field above
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}