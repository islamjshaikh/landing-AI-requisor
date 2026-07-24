import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { ArrowLeft, CheckCircle2, CloudUpload, Copy, Info, Lightbulb, Loader2, PenTool, RefreshCw, Upload } from 'lucide-react';
import { Link } from 'wouter';

export default function JiraStoryWriter() {
  const [featureIdea, setFeatureIdea] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [businessValue, setBusinessValue] = useState('');
  const [generatedStory, setGeneratedStory] = useState<any>(null);
  const [savedStoryId, setSavedStoryId] = useState<number | null>(null);
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showJiraDialog, setShowJiraDialog] = useState(false);
  const [jiraProjectKey, setJiraProjectKey] = useState('');
  const [editingStory, setEditingStory] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch projects for JIRA export
  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects']
  });

  // Check JIRA integration status
  const { data: integration } = useQuery({
    queryKey: ['/api/jira/integration']
  });

  // Generate story mutation
  const generateStory = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/stories/write', 'POST', data),
    onSuccess: (data) => {
      setGeneratedStory(data);
      toast({
        title: 'Story Generated',
        description: 'Your user story has been created successfully.'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate story.',
        variant: 'destructive'
      });
    }
  });

  // Save to project mutation
  const saveToProject = useMutation({
    mutationFn: (data: any) => apiRequest('/api/jira/stories', 'POST', data),
    onSuccess: (data) => {
      setSavedStoryId(data.id);
      toast({
        title: 'Story Saved',
        description: 'User story has been added to your project backlog.'
      });
      
      // If user clicked push to JIRA and story wasn't saved yet, open dialog now
      if (showJiraDialog) {
        setEditingStory(generatedStory);
      }
    }
  });

  // Push to JIRA mutation
  const pushToJira = useMutation({
    mutationFn: (data: { storyId: number; projectKey: string }) => 
      apiRequest(`/api/jira/sync/push/${data.storyId}`, 'POST', { projectKey: data.projectKey }),
    onSuccess: (data) => {
      toast({
        title: 'Pushed to JIRA',
        description: `Story created in JIRA: ${data.jiraIssueKey}`
      });
      setShowJiraDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/jira/stories'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Push Failed',
        description: error.message || 'Failed to push story to JIRA.',
        variant: 'destructive'
      });
    }
  });

  // Fetch JIRA projects
  const { data: jiraProjects = [] } = useQuery({
    queryKey: ['/api/jira/projects'],
    enabled: !!integration?.isActive
  });

  const handleGenerate = () => {
    if (!featureIdea.trim()) {
      toast({
        title: 'Feature Required',
        description: 'Please describe the feature you want to build.',
        variant: 'destructive'
      });
      return;
    }
    generateStory.mutate({ 
      title: featureIdea,
      context: `Target User: ${targetUser || 'Not specified'}\nBusiness Value: ${businessValue || 'Not specified'}`
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied',
      description: 'Story copied to clipboard.'
    });
  };

  const handleReset = () => {
    setFeatureIdea('');
    setTargetUser('');
    setBusinessValue('');
    setGeneratedStory(null);
    setSavedStoryId(null);
    setEditingStory(null);
  };

  const handleSaveStory = () => {
    if (!generatedStory || !selectedProject) {
      toast({
        title: 'Project Required',
        description: 'Please select a project to save the story.',
        variant: 'destructive'
      });
      return;
    }

    const storyData = editingStory || generatedStory;
    saveToProject.mutate({
      projectId: parseInt(selectedProject),
      title: storyData.title,
      story: storyData.story,
      acceptanceCriteria: storyData.acceptanceCriteria,
      storyPoints: storyData.storyPoints
    });
  };

  const handlePushToJira = () => {
    if (!savedStoryId) {
      // Save first, then push
      handleSaveStory();
      return;
    }
    setEditingStory(generatedStory);
    setShowJiraDialog(true);
  };

  const confirmPushToJira = () => {
    if (!jiraProjectKey || !savedStoryId) {
      toast({
        title: 'Project Key Required',
        description: 'Please select a JIRA project.',
        variant: 'destructive'
      });
      return;
    }
    pushToJira.mutate({ storyId: savedStoryId, projectKey: jiraProjectKey });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/jira-agent">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to JIRA Tools
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">User Story Writer</h1>
              <p className="text-gray-600 mt-2">Transform feature ideas into well-structured user stories</p>
            </div>
            {integration?.isActive && (
              <Badge className="bg-green-100 text-green-700 border-green-200">
                <CloudUpload className="w-3 h-3 mr-1" />
                JIRA Connected
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Input Section */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create User Story</CardTitle>
                <CardDescription>
                  Describe the feature you want to build and let AI create a complete user story
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="feature">Feature Idea*</Label>
                  <Textarea
                    id="feature"
                    placeholder="Be as specific as possible. What should the feature do? What problem does it solve?"
                    value={featureIdea}
                    onChange={(e) => setFeatureIdea(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500">e.g., Administrator, Customer, Marketing Team</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user">Target User/Role (Optional)</Label>
                  <Input
                    id="user"
                    placeholder="Who will use this feature? Leave blank for AI to suggest appropriate roles"
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Who will use this feature? Leave blank for AI to suggest appropriate roles.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Business Value (Optional)</Label>
                  <Textarea
                    id="value"
                    placeholder="Explain the value this feature provides. Leave blank for AI to suggest"
                    value={businessValue}
                    onChange={(e) => setBusinessValue(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <p className="text-xs text-gray-500">Explain the value this feature provides. Leave blank for AI to suggest.</p>
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleGenerate}
                    disabled={generateStory.isPending || !featureIdea.trim()}
                    className="flex-1"
                  >
                    {generateStory.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <PenTool className="mr-2 h-4 w-4" />
                        Write User Story
                      </>
                    )}
                  </Button>
                  {generatedStory && (
                    <Button
                      onClick={handleReset}
                      variant="outline"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      New Story
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Writing Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Writing Tips</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">User Story Format</h4>
                  <p className="text-sm text-gray-600">As a [role], I want [feature], so that [value]</p>
                </div>
                
                <div>
                  <h4 className="font-medium mb-1">Good Acceptance Criteria</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Specific and measurable</li>
                    <li>• Testable - can be verified as done/not done</li>
                    <li>• Include edge cases and error scenarios</li>
                    <li>• Independent of implementation details</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-1">INVEST Principles</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• <strong>I</strong>ndependent - self-contained</li>
                    <li>• <strong>N</strong>egotiable - flexible in implementation</li>
                    <li>• <strong>V</strong>aluable - provides value to users</li>
                    <li>• <strong>E</strong>stimable - can be sized</li>
                    <li>• <strong>S</strong>mall - fits within a sprint</li>
                    <li>• <strong>T</strong>estable - clear completion criteria</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Output Section */}
          <div className="space-y-6">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Generated User Story</CardTitle>
              </CardHeader>
              <CardContent>
                {!generatedStory ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lightbulb className="h-8 w-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Story Generated Yet</h3>
                    <p className="text-gray-500">
                      Fill out the feature details on the left and click "Write User Story" to generate a well-structured user story with acceptance criteria.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* User Story */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold">User Story</h4>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(generatedStory.story)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-gray-800">{generatedStory.story}</p>
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <h4 className="font-semibold mb-2">Title</h4>
                      <p className="text-gray-700">{generatedStory.title}</p>
                    </div>

                    {/* Acceptance Criteria */}
                    <div>
                      <h4 className="font-semibold mb-2">Acceptance Criteria</h4>
                      <ul className="space-y-2">
                        {generatedStory.acceptanceCriteria?.map((criteria: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{criteria}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t space-y-3">
                      {projects.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <select
                              className="flex-1 px-3 py-2 border rounded-md"
                              value={selectedProject}
                              onChange={(e) => setSelectedProject(e.target.value)}
                            >
                              <option value="">Select a project...</option>
                              {projects.map((project: any) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              onClick={handleSaveStory}
                              disabled={!selectedProject || saveToProject.isPending}
                            >
                              {saveToProject.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Save to Project'
                              )}
                            </Button>
                          </div>
                          
                          {integration?.isActive && (
                            <Button
                              onClick={handlePushToJira}
                              className="w-full"
                              variant="outline"
                              disabled={pushToJira.isPending || (!savedStoryId && !selectedProject)}
                            >
                              {pushToJira.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Pushing to JIRA...
                                </>
                              ) : (
                                <>
                                  <Upload className="mr-2 h-4 w-4" />
                                  Push to JIRA
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      )}

                      {integration?.isActive && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            Save the story to a project first, then sync it to JIRA from the project backlog.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      {/* JIRA Push Dialog */}
      <Dialog open={showJiraDialog} onOpenChange={setShowJiraDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Push to JIRA</DialogTitle>
            <DialogDescription>
              Select a JIRA project to push this user story to.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Story Preview */}
            {editingStory && (
              <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={editingStory.title}
                    onChange={(e) => setEditingStory({ ...editingStory, title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Story</Label>
                  <Textarea
                    value={editingStory.story}
                    onChange={(e) => setEditingStory({ ...editingStory, story: e.target.value })}
                    rows={3}
                    className="mt-1 resize-none"
                  />
                </div>
              </div>
            )}
            
            <div>
              <Label htmlFor="jira-project">JIRA Project</Label>
              <Select value={jiraProjectKey} onValueChange={setJiraProjectKey}>
                <SelectTrigger id="jira-project">
                  <SelectValue placeholder="Select a JIRA project" />
                </SelectTrigger>
                <SelectContent>
                  {jiraProjects?.map((project: any) => (
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
            <Button onClick={confirmPushToJira} disabled={!jiraProjectKey || pushToJira.isPending}>
              {pushToJira.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Pushing...
                </>
              ) : (
                'Push to JIRA'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}