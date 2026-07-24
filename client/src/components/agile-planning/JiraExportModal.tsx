import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQuery } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { 
  Upload, 
  Loader2, 
  CheckCircle,
  XCircle,
  ExternalLink,
  AlertCircle,
  GitBranch,
  FileText,
  Eye,
  EyeOff,
  Plus
} from 'lucide-react';
import { JiraCredentialsDialog } from './JiraCredentialsDialog';

interface JiraProject {
  id: string;
  key: string;
  name: string;
}

interface Epic {
  id: string;
  name: string;
  description: string;
  stories: Array<{
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    storyPoints?: number;
    priority: string;
  }>;
}

interface AgilePlan {
  initiative: {
    id: string;
    name: string;
    description: string;
    epics: Epic[];
  };
}

interface ExportStatus {
  totalItems: number;
  completed: number;
  currentItem: string;
  errors: string[];
}

interface JiraExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: AgilePlan;
}

export function JiraExportModal({ isOpen, onClose, plan }: JiraExportModalProps) {
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [createProjectForm, setCreateProjectForm] = useState({
    name: '',
    key: '',
    description: '',
    projectTypeKey: 'software'
  });
  
  // Initialize selectedEpics based on plan data - default to all epics selected
  const [selectedEpics, setSelectedEpics] = useState<Set<string>>(() => {
    if (plan?.initiative?.epics) {
      return new Set(plan.initiative.epics.map(e => e.id));
    }
    return new Set();
  });
  const [selectiveMode, setSelectiveMode] = useState(false);
  const [selectedStoryIds, setSelectedStoryIds] = useState<string[]>([]);
  
  const [exportStatus, setExportStatus] = useState<ExportStatus | null>(null);
  const [exportResult, setExportResult] = useState<any>(null);
  const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
  
  // Reinitialize selected epics when modal opens with a new plan
  React.useEffect(() => {
    if (isOpen && plan?.initiative?.epics) {
      console.log('JiraExportModal - Modal opened with plan:', plan);
      console.log('JiraExportModal - Plan epics:', plan.initiative.epics);
      console.log('JiraExportModal - Epics count:', plan.initiative.epics.length);
      
      // Only reinitialize if the Set is empty (first load handled by useState initializer)
      setSelectedEpics(prev => {
        if (prev.size === 0 && plan.initiative.epics.length > 0) {
          const epicIds = plan.initiative.epics.map(e => e.id);
          console.log('JiraExportModal - Reinitializing with epic IDs:', epicIds);
          return new Set(epicIds);
        }
        return prev;
      });
    }
  }, [isOpen]);

  // Check if Jira is connected
  const { data: integration } = useQuery({
    queryKey: ['/api/jira/integration'],
    enabled: isOpen
  });

  // Fetch available Jira projects
  const { data: projects, isLoading: loadingProjects, error: projectsError, refetch: refetchProjects } = useQuery({
    queryKey: ['/api/jira/projects'],
    enabled: isOpen && !!integration && (integration.isConnected === true || integration.isActive === true),
    retry: false
  });
  
  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      // Trim values before sending
      const cleanedForm = {
        ...createProjectForm,
        name: createProjectForm.name.trim(),
        key: createProjectForm.key.trim(),
        description: createProjectForm.description.trim()
      };
      
      const response = await fetch('/api/jira/projects/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cleanedForm),
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle authentication errors specifically
        if (response.status === 401 && error.code === 'JIRA_AUTH_EXPIRED') {
          const authError = new Error(error.error || 'JIRA authentication failed');
          (authError as any).code = 'JIRA_AUTH_EXPIRED';
          throw authError;
        }
        
        throw new Error(error.error || error.message || 'Failed to create project');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Project created successfully!",
        description: `Project "${data.name}" (${data.key}) has been created in JIRA.`,
      });
      setSelectedProject(data.key);
      setShowCreateProject(false);
      setCreateProjectForm({
        name: '',
        key: '',
        description: '',
        projectTypeKey: 'software'
      });
      refetchProjects();
    },
    onError: (error: any) => {
      // Check if it's an authentication error
      if ((error as any).code === 'JIRA_AUTH_EXPIRED') {
        setShowCredentialsDialog(true);
        setShowCreateProject(false); // Close the create project dialog
        return;
      }
      
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Debug logging
  React.useEffect(() => {
    if (isOpen) {
      console.log('JiraExportModal - Integration:', integration);
      console.log('JiraExportModal - Integration isConnected:', integration?.isConnected);
      console.log('JiraExportModal - Integration isActive:', integration?.isActive);
      console.log('JiraExportModal - Projects query enabled:', isOpen && !!integration && (integration?.isConnected === true || integration?.isActive === true));
      console.log('JiraExportModal - Projects:', projects);
      console.log('JiraExportModal - Loading projects:', loadingProjects);
      console.log('JiraExportModal - Projects error:', projectsError);
    }
  }, [isOpen, integration, projects, loadingProjects, projectsError]);

  // Export to Jira mutation
  const exportToJira = useMutation({
    mutationFn: async () => {
      if (!selectedProject) {
        throw new Error('Please select a project');
      }

      console.log('Export - Plan initiative:', plan?.initiative);
      console.log('Export - Plan epics:', plan?.initiative?.epics);
      console.log('Export - Selected epics Set:', selectedEpics);
      console.log('Export - Selected epics IDs:', Array.from(selectedEpics));
      console.log('Export - Epic IDs in plan:', plan?.initiative?.epics?.map(e => e.id));
      
      if (!plan?.initiative?.epics || plan.initiative.epics.length === 0) {
        throw new Error('No epics found in the plan');
      }
      
      const selectedEpicsList = plan.initiative.epics.filter(e => {
        const isSelected = selectedEpics.has(e.id);
        console.log(`Epic ${e.id} (${e.name}) - Selected: ${isSelected}`);
        return isSelected;
      });
      const totalStories = selectedEpicsList.reduce((acc, epic) => acc + epic.stories.length, 0);
      
      console.log('Export - Selected epics list:', selectedEpicsList);
      console.log('Export - Total stories:', totalStories);
      console.log('Export - Selected epics array:', Array.from(selectedEpics));
      console.log('Export - Plan epic IDs:', plan.initiative.epics.map(e => e.id));
      
      if (selectedEpicsList.length === 0) {
        throw new Error('No epics selected for export');
      }
      
      const exportData = {
        plan: {
          initiative: {
            ...plan.initiative,
            epics: selectedEpicsList
          }
        },
        projectKey: selectedProject
      };
      
      console.log('Export - Request body to send:', exportData);
      console.log('Export - Epics in request:', exportData.plan.initiative.epics);
      console.log('Export - Number of epics:', exportData.plan.initiative.epics.length);
      
      setExportStatus({
        totalItems: selectedEpicsList.length + totalStories,
        completed: 0,
        currentItem: 'Preparing export...',
        errors: []
      });

      const response = await fetch('/api/agile-planning/export-to-jira', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plan: {
            initiative: {
              ...plan.initiative,
              epics: selectedEpicsList
            }
          },
          projectKey: selectedProject
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Export failed with response:', error);
        
        // Handle authentication errors specifically
        if (response.status === 401 && error.code === 'JIRA_AUTH_EXPIRED') {
          const authError = new Error(error.error || 'JIRA authentication failed');
          (authError as any).code = 'JIRA_AUTH_EXPIRED';
          throw authError;
        }
        
        throw new Error(error.message || 'Export failed');
      }

      const result = await response.json();
      console.log('Export result:', result);
      return result;
    },
    onSuccess: (data) => {
      setExportResult(data);
      toast({
        title: "Export successful!",
        description: `Exported ${data.epicsCreated} epics and ${data.storiesCreated} stories to Jira.`,
      });
    },
    onError: (error: any) => {
      console.error('Export error:', error);
      
      // Check if it's an authentication error
      if ((error as any).code === 'JIRA_AUTH_EXPIRED') {
        setShowCredentialsDialog(true);
        setExportStatus(null);
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 
        error.details ? JSON.stringify(error.details) : "Failed to export to Jira";
      
      toast({
        title: "Export failed",
        description: errorMessage,
        variant: "destructive"
      });
      setExportStatus(null);
    }
  });

  const handleExport = () => {
    exportToJira.mutate();
  };

  const handleSelectiveExport = () => {
    setSelectiveMode(true);
    // Initialize selected stories with all stories from selected epics
    if (plan?.initiative?.epics) {
      const selectedEpicsList = plan.initiative.epics.filter(e => selectedEpics.has(e.id));
      const allStoryIds = selectedEpicsList.flatMap(epic => epic.stories.map(story => story.id));
      console.log('Initializing selective export with:', {
        selectedEpicsCount: selectedEpicsList.length,
        totalStoriesFromSelectedEpics: allStoryIds.length,
        storyIds: allStoryIds
      });
      setSelectedStoryIds(allStoryIds);
    }
  };

  // Selective export mutation using the new API
  const selectiveExportToJira = useMutation({
    mutationFn: async () => {
      if (!selectedProject || !integration?.id) {
        throw new Error('Missing project or integration');
      }

      console.log('Selective export debug:', {
        selectedProject,
        integrationId: integration.id,
        selectedStoryIds,
        selectedStoryIdsLength: selectedStoryIds.length,
        planHasEpics: !!plan?.initiative?.epics,
        epicsCount: plan?.initiative?.epics?.length
      });

      const response = await fetch(`/api/jira/export/${integration.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          plan,
          selectedStoryIds
        })
      });

      if (!response.ok) {
        const error = await response.json();
        
        // Handle authentication errors specifically
        if (response.status === 401 && error.code === 'JIRA_AUTH_EXPIRED') {
          const authError = new Error(error.error || 'JIRA authentication failed');
          (authError as any).code = 'JIRA_AUTH_EXPIRED';
          throw authError;
        }
        
        throw new Error(error.message || 'Export failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Selective export successful!",
        description: `Exported ${data.storiesCreated} selected stories to Jira.`,
      });
      setSelectiveMode(false);
      setSelectedStoryIds([]);
    },
    onError: (error: any) => {
      // Check if it's an authentication error
      if ((error as any).code === 'JIRA_AUTH_EXPIRED') {
        setShowCredentialsDialog(true);
        return;
      }
      
      toast({
        title: "Selective export failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const toggleEpic = (epicId: string) => {
    const newSet = new Set(selectedEpics);
    if (newSet.has(epicId)) {
      newSet.delete(epicId);
    } else {
      newSet.add(epicId);
    }
    setSelectedEpics(newSet);
  };

  const getSelectedStats = () => {
    if (!plan?.initiative?.epics) {
      return {
        epics: 0,
        stories: 0,
        points: 0
      };
    }
    
    const selectedEpicsList = plan.initiative.epics.filter(e => selectedEpics.has(e.id));
    const totalStories = selectedEpicsList.reduce((acc, epic) => acc + epic.stories.length, 0);
    const totalPoints = selectedEpicsList.reduce((acc, epic) => 
      acc + epic.stories.reduce((sum, story) => sum + (story.storyPoints || 0), 0), 0
    );
    
    return {
      epics: selectedEpicsList.length,
      stories: totalStories,
      points: totalPoints
    };
  };

  const stats = getSelectedStats();

  // If Jira is not connected, show connection form
  if (!integration) {
    return (
      <JiraConnectionForm 
        isOpen={isOpen} 
        onClose={onClose} 
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/jira/integration'] });
        }}
      />
    );
  }

  // Export success view
  if (exportResult) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Complete!</DialogTitle>
            <DialogDescription>
              Your agile plan has been successfully exported to Jira.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">
                    Successfully exported to project {exportResult.projectKey}
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {exportResult.epicsCreated} epics and {exportResult.storiesCreated} stories created
                  </p>
                </div>
              </div>
            </div>
            
            {exportResult.jiraUrl && (
              <Button
                className="w-full"
                onClick={() => window.open(exportResult.jiraUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View in Jira
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      {/* Create Project Dialog */}
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New JIRA Project</DialogTitle>
            <DialogDescription>
              Create a new project in JIRA to export your agile plan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="e.g., Customer Portal"
                value={createProjectForm.name}
                onChange={(e) => setCreateProjectForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-key">Project Key</Label>
              <Input
                id="project-key"
                placeholder="e.g., CP (must be uppercase)"
                value={createProjectForm.key}
                onChange={(e) => setCreateProjectForm(prev => ({ ...prev, key: e.target.value.toUpperCase().trim() }))}
              />
              <p className="text-xs text-gray-500">
                Project keys are typically 2-10 uppercase letters.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description (optional)</Label>
              <Input
                id="project-description"
                placeholder="Brief description of the project"
                value={createProjectForm.description}
                onChange={(e) => setCreateProjectForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-type">Project Type</Label>
              <Select 
                value={createProjectForm.projectTypeKey} 
                onValueChange={(value) => setCreateProjectForm(prev => ({ ...prev, projectTypeKey: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="software">Software</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="service_desk">Service Desk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateProject(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createProjectMutation.mutate()}
              disabled={!createProjectForm.name || !createProjectForm.key || createProjectMutation.isPending}
            >
              {createProjectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Project
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Export Dialog */}
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Export to Jira</DialogTitle>
            <DialogDescription>
              Select a Jira project and choose which epics to export.
            </DialogDescription>
          </DialogHeader>
          
          {/* Test Auth Button - Debug only */}
          {!integration?.isConnected && !integration?.isActive && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800 mb-2">
                JIRA integration not configured. Please set up your JIRA credentials in Settings.
              </p>
            </div>
          )}
        
        <div className="space-y-4 py-4">
          {/* Project Selection */}
          <div className="space-y-2">
            <Label>Select Jira Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder={loadingProjects ? "Loading projects..." : "Choose a project"} />
              </SelectTrigger>
              <SelectContent>
                {projectsError ? (
                  <SelectItem value="error" disabled>
                    Error loading projects: {projectsError instanceof Error ? projectsError.message : 'Unknown error'}
                  </SelectItem>
                ) : !projects || projects.length === 0 ? (
                  <div className="p-2">
                    <p className="text-sm text-gray-500 mb-2">No projects available</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowCreateProject(true);
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create New Project
                    </Button>
                  </div>
                ) : (
                  projects.map((project: JiraProject) => (
                    <SelectItem key={project.key} value={project.key}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                        {project.key}
                      </Badge>
                      {project.name}
                    </div>
                  </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Epic Selection or Story Selection */}
          {!selectiveMode ? (
            <div className="space-y-2">
              <Label>Select Epics to Export</Label>
              <div className="border rounded-lg p-4 space-y-3 max-h-[300px] overflow-y-auto">
                {plan?.initiative?.epics && plan.initiative.epics.length > 0 ? (
                  plan.initiative.epics.map((epic) => (
                    <div key={epic.id} className="flex items-start gap-3">
                      <Checkbox
                        id={epic.id}
                        checked={selectedEpics.has(epic.id)}
                        onCheckedChange={() => toggleEpic(epic.id)}
                      />
                      <div className="flex-1 space-y-1">
                        <Label 
                          htmlFor={epic.id} 
                          className="text-sm font-medium cursor-pointer"
                        >
                          {epic.name}
                        </Label>
                        <p className="text-xs text-gray-500">
                          {epic.stories.length} stories · {epic.stories.reduce((sum, s) => sum + (s.storyPoints || 0), 0)} points
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No epics found in the plan</p>
                    <p className="text-xs mt-1">Please generate a plan first</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select Individual Stories to Export</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectiveMode(false)}
                >
                  ← Back to Epic Selection
                </Button>
              </div>
              <div className="border rounded-lg p-4 space-y-4 max-h-[300px] overflow-y-auto">
                {plan?.initiative?.epics?.map((epic) => (
                  <div key={epic.id} className="space-y-2">
                    <h4 className="font-medium text-sm">{epic.name}</h4>
                    <div className="space-y-2 ml-4">
                      {epic.stories.map((story) => (
                        <div key={story.id} className="flex items-start gap-3">
                          <Checkbox
                            id={story.id}
                            checked={selectedStoryIds.includes(story.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedStoryIds(prev => [...prev, story.id]);
                              } else {
                                setSelectedStoryIds(prev => prev.filter(id => id !== story.id));
                              }
                            }}
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={story.id} 
                              className="text-xs font-medium cursor-pointer"
                            >
                              {story.title}
                            </Label>
                            <p className="text-xs text-gray-500">
                              {story.storyPoints || 0} points · {story.priority || 'medium'} priority
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Export Summary */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium mb-2">Export Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-purple-600">{stats.epics}</div>
                <div className="text-xs text-gray-600">Epics</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.stories}</div>
                <div className="text-xs text-gray-600">Stories</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.points}</div>
                <div className="text-xs text-gray-600">Points</div>
              </div>
            </div>
          </div>

          {/* Export Progress */}
          {exportStatus && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{exportStatus.currentItem}</span>
                <span className="text-gray-500">
                  {exportStatus.completed} / {exportStatus.totalItems}
                </span>
              </div>
              <Progress 
                value={(exportStatus.completed / exportStatus.totalItems) * 100} 
                className="h-2"
              />
              {exportStatus.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
                  <p className="text-sm text-red-700">
                    {exportStatus.errors.length} error(s) occurred during export
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={onClose}
            disabled={exportToJira.isPending || selectiveExportToJira.isPending}
          >
            Cancel
          </Button>
          <div className="flex gap-2">
            {selectiveMode ? (
              <>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const allStoryIds = plan?.initiative?.epics?.flatMap(epic => epic.stories.map(story => story.id)) || [];
                    if (selectedStoryIds.length === allStoryIds.length) {
                      setSelectedStoryIds([]);
                    } else {
                      setSelectedStoryIds(allStoryIds);
                    }
                  }}
                >
                  {selectedStoryIds.length === (plan?.initiative?.epics?.flatMap(epic => epic.stories.map(story => story.id)) || []).length 
                    ? 'Deselect All' 
                    : 'Select All'}
                </Button>
                <Button 
                  onClick={() => selectiveExportToJira.mutate()}
                  disabled={!selectedProject || selectedStoryIds.length === 0 || selectiveExportToJira.isPending}
                >
                  {selectiveExportToJira.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Export Selected ({selectedStoryIds.length})
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline"
                  onClick={handleSelectiveExport}
                  disabled={!selectedProject || !integration?.id}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Selective Export
                </Button>
                <Button 
                  onClick={handleExport}
                  disabled={!selectedProject || selectedEpics.size === 0 || exportToJira.isPending}
                >
                  {exportToJira.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Exporting...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Export All
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    
    {/* Credentials Re-entry Dialog */}
    <JiraCredentialsDialog
      isOpen={showCredentialsDialog}
      onClose={() => setShowCredentialsDialog(false)}
      onSuccess={() => {
        setShowCredentialsDialog(false);
        refetchProjects();
        // Retry the export after successful credential update
        if (selectiveMode) {
          selectiveExportToJira.mutate();
        } else {
          exportToJira.mutate();
        }
      }}
    />
    </>
  );
}

// Component for collecting Jira credentials
function JiraConnectionForm({ isOpen, onClose, onSuccess }: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [showToken, setShowToken] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [formData, setFormData] = useState({
    jiraUrl: '',
    email: '',
    apiToken: ''
  });

  // Test connection before saving
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/jira/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Connection test failed');
      }
      
      return response.json();
    }
  });

  // Save integration
  const saveIntegrationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/jira/integration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save integration');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Jira connected successfully!",
        description: "You can now export your agile plans to Jira.",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to save integration",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formData.jiraUrl || !formData.email || !formData.apiToken) {
      toast({
        title: "Missing information",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    // Validate Jira URL format
    if (!formData.jiraUrl.includes('atlassian.net')) {
      toast({
        title: "Invalid Jira URL",
        description: "Please enter a valid Jira Cloud URL (e.g., https://yourcompany.atlassian.net)",
        variant: "destructive"
      });
      return;
    }

    setIsTestingConnection(true);
    
    try {
      // Test connection first
      const testResult = await testConnectionMutation.mutateAsync();
      
      toast({
        title: "Connection successful!",
        description: `Connected to ${testResult.siteName || 'Jira'}. Found ${testResult.projectCount || 0} projects.`,
      });
      
      // If test successful, save the integration
      await saveIntegrationMutation.mutateAsync();
      
    } catch (error) {
      // Error already handled by mutation
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect to Jira</DialogTitle>
          <DialogDescription>
            Enter your Jira credentials to start exporting your agile plans.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="jiraUrl">Jira Site URL</Label>
              <Input
                id="jiraUrl"
                type="url"
                placeholder="https://yourcompany.atlassian.net"
                value={formData.jiraUrl}
                onChange={(e) => setFormData({ ...formData, jiraUrl: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">
                Your Jira Cloud instance URL
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <p className="text-xs text-gray-500">
                The email address associated with your Jira account
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="apiToken">API Token</Label>
              <div className="relative">
                <Input
                  id="apiToken"
                  type={showToken ? 'text' : 'password'}
                  placeholder="Enter your Jira API token"
                  value={formData.apiToken}
                  onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Generate an API token from your{' '}
                <a 
                  href="https://id.atlassian.com/manage-profile/security/api-tokens" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Atlassian account settings
                </a>
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isTestingConnection || saveIntegrationMutation.isPending}
            >
              {isTestingConnection || saveIntegrationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isTestingConnection ? 'Testing Connection...' : 'Saving...'}
                </>
              ) : (
                'Connect to Jira'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}